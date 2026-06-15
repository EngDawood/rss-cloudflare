import { createBot } from '../services/telegram-bot';

export interface ToolMetadata {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: {
			type: 'object';
			required?: string[];
			properties: Record<string, {
				type: string;
				description: string;
				items?: { type: string };
			}>;
		};
	};
}

export function resolveToolsMetadata(enabledTools: string[]): ToolMetadata[] {
	const tools: ToolMetadata[] = [];

	if (enabledTools.includes('telegram')) {
		tools.push({
			type: 'function',
			function: {
				name: 'telegram_send_message',
				description: 'Send a message or formatted post to a Telegram chat/channel.',
				parameters: {
					type: 'object',
					required: ['chatId', 'text'],
					properties: {
						chatId: {
							type: 'string',
							description: 'The Telegram Chat ID or Channel ID (e.g. -100... or @channelname).'
						},
						text: {
							type: 'string',
							description: 'The text message content. Standard HTML formatting is supported (e.g., <b>, <i>, <a>).'
						}
					}
				}
			}
		});
	}

	if (enabledTools.includes('emdash')) {
		tools.push({
			type: 'function',
			function: {
				name: 'emdash_mcp_call',
				description: 'Execute content/media/taxonomy management tools on the Emdash blog CMS via MCP.',
				parameters: {
					type: 'object',
					required: ['toolName', 'arguments'],
					properties: {
						toolName: {
							type: 'string',
							description: 'The name of the Emdash MCP tool (e.g. content_create, content_list, content_publish).'
						},
						arguments: {
							type: 'object',
							description: 'The JSON object containing arguments for the tool.'
						}
					}
				}
			}
		});
	}

	return tools;
}

export async function executeTool(name: string, args: any, env: Env): Promise<any> {
	if (name === 'telegram_send_message') {
		const bot = createBot(env);
		const result = await bot.api.sendMessage(args.chatId, args.text, {
			parse_mode: 'HTML'
		});
		return { success: true, messageId: result.message_id };
	}

	if (name === 'emdash_mcp_call') {
		const emdashUrl = env.EMDASH_URL || 'https://engdawood.com';
		const mcpEndpoint = `${emdashUrl}/_emdash/api/mcp`;

		const response = await fetch(mcpEndpoint, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${env.EMDASH_TOKEN}`
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					name: args.toolName,
					arguments: args.arguments
				},
				id: 1
			})
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Emdash MCP returned HTTP ${response.status}: ${text}`);
		}

		return await response.json();
	}

	throw new Error(`Tool "${name}" is not implemented.`);
}
