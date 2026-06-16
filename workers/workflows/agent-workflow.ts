import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import type { DbItemCompact } from '../db/d1';
import {
	getWorkflow, getFeedById, setRunStatus, appendRunEvent,
} from '../db/d1';
import { GATEWAY_URL, normalizeGatewayModel } from '../services/chat-agent';
import { resolveToolsMetadata, executeTool, type ToolContext } from './tools';

export interface AgentWorkflowParams {
	workflowId: string;
	runId: string;
	items: DbItemCompact[];
	trigger: string;
}

interface GatewayMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content?: string | null;
	tool_call_id?: string;
	name?: string;
	tool_calls?: Array<{
		id: string;
		type: string;
		function: { name: string; arguments: string };
	}>;
}

/**
 * Durable agent runner. Each turn passes OpenAI-format tool schemas to the AI
 * Gateway; the model replies with tool_calls; the workflow executes each in its
 * own step.do() checkpoint and loops. Every D1 write lives INSIDE a step body,
 * so cached steps are skipped on replay and events are written exactly once.
 */
export class AgentWorkflow extends WorkflowEntrypoint<Env, AgentWorkflowParams> {
	async run(event: WorkflowEvent<AgentWorkflowParams>, step: WorkflowStep): Promise<unknown> {
		const env = this.env;
		const { workflowId, runId, items, trigger } = event.payload;
		let seq = 0;

		try {
			// 1. Load config + bound destination + watched feed metadata.
			const config = await step.do('load-config', async () => {
				const wf = await getWorkflow(env.DB, workflowId);
				if (!wf) throw new Error(`Workflow ${workflowId} not found`);
				const feeds: Array<{ id: string; title: string; url: string }> = [];
				for (const feedId of wf.feed_ids) {
					const feed = await getFeedById(env.DB, feedId);
					if (feed) feeds.push({ id: feed.id, title: feed.title, url: feed.url });
				}
				await setRunStatus(env.DB, runId, 'running');
				return {
					name: wf.name,
					aiModel: wf.ai_model,
					systemPrompt: wf.system_prompt,
					temperature: wf.temperature,
					maxTurns: wf.max_turns,
					enabledTools: JSON.parse(wf.enabled_tools || '[]') as string[],
					targetChatId: wf.target_chat_id,
					targetChatName: wf.target_chat_name,
					feeds,
				};
			});

			const tools = resolveToolsMetadata(config.enabledTools);
			const toolCtx: ToolContext = { boundChatId: config.targetChatId };
			const resolvedModel = normalizeGatewayModel(config.aiModel);

			// 2. Build the message history with an injected context block.
			const contextBlock = [
				`# Workflow: ${config.name}`,
				config.targetChatId
					? `Bound Telegram destination: ${config.targetChatName || config.targetChatId} (id ${config.targetChatId}). ` +
					  `When you call telegram_send_message you may omit chatId to use this destination.`
					: 'No Telegram destination is bound; pass an explicit chatId if you send.',
				'',
				'## Watched feeds',
				config.feeds.length
					? config.feeds.map(f => `- ${f.title || f.url} (${f.url}) [id: ${f.id}]`).join('\n')
					: '- (none)',
				'',
				'## New items for this run',
				items.length
					? items.map(i => `- [${i.id}] ${i.title} — ${i.author || 'unknown'} (${i.link})`).join('\n')
					: '- (none)',
			].join('\n');

			const messages: GatewayMessage[] = [
				{ role: 'system', content: config.systemPrompt },
				{ role: 'user', content: contextBlock },
			];

			// 3. Tool-calling loop.
			let finalOutput = '';
			for (let turn = 1; turn <= config.maxTurns; turn++) {
				const turnSeq = ++seq;
				const assistant = await step.do(`llm-turn-${turn}`, async () => {
					const res = await fetch(GATEWAY_URL, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
							'cf-aig-metadata': JSON.stringify({ purpose: 'workflow', workflowId, runId }),
						},
						body: JSON.stringify({
							model: resolvedModel,
							messages,
							temperature: config.temperature,
							...(tools.length ? { tools, tool_choice: 'auto' } : {}),
						}),
					});
					if (!res.ok) {
						const text = await res.text();
						throw new Error(`Gateway error ${res.status}: ${text.slice(0, 500)}`);
					}
					const data = (await res.json()) as { choices?: Array<{ message?: GatewayMessage }> };
					const msg = data.choices?.[0]?.message;
					if (!msg) throw new Error('Gateway returned no message');
					await appendRunEvent(env.DB, runId, turnSeq, 'llm_turn', `llm-turn-${turn}`, {
						content: (msg.content || '').slice(0, 1000),
						tool_calls: (msg.tool_calls || []).map(t => ({ name: t.function.name, arguments: t.function.arguments })),
					});
					return msg;
				});

				messages.push(assistant);
				if (assistant.content) finalOutput = assistant.content;

				const toolCalls = assistant.tool_calls ?? [];
				if (toolCalls.length === 0) break;

				for (let i = 0; i < toolCalls.length; i++) {
					const call = toolCalls[i];
					const callSeq = ++seq;
					const result = await step.do(`tool-${turn}-${i}-${call.function.name}`, async () => {
						let args: Record<string, any> = {};
						try { args = JSON.parse(call.function.arguments || '{}'); } catch { /* keep {} */ }
						const out = await executeTool(call.function.name, args, env, toolCtx);
						await appendRunEvent(env.DB, runId, callSeq, 'tool_call', call.function.name, {
							args,
							result: out,
						});
						// Tool output is always JSON-serializable; surface it to the step as a string.
						return JSON.stringify(out ?? null);
					});
					messages.push({
						role: 'tool',
						tool_call_id: call.id,
						name: call.function.name,
						content: result.slice(0, 4000),
					});
				}
			}

			// 4. Finalize.
			const finishSeq = ++seq;
			await step.do('finalize', async () => {
				await appendRunEvent(env.DB, runId, finishSeq, 'output', 'finalize', { output: finalOutput.slice(0, 2000) });
				await setRunStatus(env.DB, runId, 'complete', {
					output: finalOutput.slice(0, 4000),
					finishedAt: Math.floor(Date.now() / 1000),
				});
			});

			return { ok: true, output: finalOutput };
		} catch (err) {
			const errSeq = ++seq;
			const message = err instanceof Error ? err.message : String(err);
			await step.do(`error-${errSeq}`, async () => {
				await appendRunEvent(env.DB, runId, errSeq, 'error', 'error', { message });
				await setRunStatus(env.DB, runId, 'errored', {
					error: message,
					finishedAt: Math.floor(Date.now() / 1000),
				});
			});
			throw err;
		}
	}
}
