import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import { executeTool, resolveToolsMetadata } from './tools';
import { normalizeGatewayModel } from '../services/chat-agent';

interface AgentWorkflowPayload {
	workflowId: string;
	items: any[];
}


export class AgentWorkflow extends WorkflowEntrypoint<Env, AgentWorkflowPayload> {
	async run(event: WorkflowEvent<AgentWorkflowPayload>, step: WorkflowStep) {
		const { workflowId, items } = event.payload;

		// 1. Load configuration from D1
		const config = await step.do('load-config', async () => {
			const row = await this.env.DB.prepare(
				'SELECT * FROM agent_workflows WHERE id = ?'
			).bind(workflowId).first<{
				id: string;
				name: string;
				ai_model: string;
				system_prompt: string;
				enabled_tools: string;
			}>();

			if (!row) {
				throw new Error(`Workflow configuration ${workflowId} not found.`);
			}

			return {
				id: row.id,
				name: row.name,
				ai_model: row.ai_model,
				system_prompt: row.system_prompt,
				enabled_tools: JSON.parse(row.enabled_tools) as string[]
			};
		});

		const messages: Array<{
			role: 'system' | 'user' | 'assistant' | 'tool';
			content?: string;
			name?: string;
			tool_call_id?: string;
			tool_calls?: any[];
		}> = [
			{ role: 'system', content: config.system_prompt },
			{ role: 'user', content: `Here are the latest items:\n\n${JSON.stringify(items)}` }
		];

		let loop = true;
		let turn = 0;
		const maxTurns = 5;

		const resolvedModel = normalizeGatewayModel(config.ai_model);

		while (loop && turn < maxTurns) {
			turn++;

			// 2. LLM completion step (OpenAI-compatible AI Gateway endpoint)
			const assistantMessage = await step.do(`llm-turn-${turn}`, async () => {
				const gatewayUrl = 'https://gateway.ai.cloudflare.com/v1/c53938b50ea00b247dcd72dd2e9eada3/rss-summarizer/compat/chat/completions';
				const tools = resolveToolsMetadata(config.enabled_tools);

				const response = await fetch(gatewayUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'cf-aig-authorization': `Bearer ${this.env.AI_GATEWAY_TOKEN}`
					},
					body: JSON.stringify({
						model: resolvedModel,
						messages: messages.map(m => ({
							role: m.role,
							content: m.content,
							name: m.name,
							tool_call_id: m.tool_call_id,
							tool_calls: m.tool_calls
						})),
						tools: tools.length > 0 ? tools : undefined,
						tool_choice: tools.length > 0 ? 'auto' : undefined
					})
				});

				if (!response.ok) {
					throw new Error(`AI Gateway returned status ${response.status}: ${await response.text()}`);
				}

				const data = await response.json() as {
					choices?: {
						message?: {
							role: 'assistant';
							content?: string | null;
							tool_calls?: Array<{
								id: string;
								type: 'function';
								function: {
									name: string;
									arguments: string;
								};
							}>;
						};
					}[];
				};

				const msg = data.choices?.[0]?.message;
				if (!msg) {
					throw new Error('AI Gateway returned empty message.');
				}

				return msg;
			});

			messages.push(assistantMessage);

			// 3. Tool execution step (if tools called)
			if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
				for (const call of assistantMessage.tool_calls) {
					const { name, arguments: rawArgs } = call.function;
					const parsedArgs = JSON.parse(rawArgs);

					const toolResult = await step.do(`tool-call-${turn}-${call.id}-${name}`, async () => {
						return await executeTool(name, parsedArgs, this.env);
					});

					messages.push({
						role: 'tool',
						tool_call_id: call.id,
						name,
						content: JSON.stringify(toolResult)
					});
				}
			} else {
				loop = false; // LLM finished and did not call any tools
			}
		}
	}
}
