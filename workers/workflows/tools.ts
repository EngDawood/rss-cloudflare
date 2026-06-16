import { Bot } from 'grammy';
import { searchItems, getItemById, dbItemToFeedItem, getFeedById } from '../db/d1';
import { sendMediaToChannel } from '../services/telegram-bot';
import type { TelegramMediaMessage } from '../types/telegram';

/**
 * Tool catalog for agent workflows. The LLM never performs side effects itself:
 * each turn the workflow passes these OpenAI-format schemas, the model replies
 * with `tool_calls`, and the workflow executes each via {@link executeTool}.
 */

export interface ToolMetadata {
	type: 'function';
	function: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
	};
}

/** Context threaded into tool execution (the workflow's bound destination, etc.). */
export interface ToolContext {
	boundChatId?: string | null;
}

const TOOL_CATALOG: Record<string, ToolMetadata> = {
	telegram_send_message: {
		type: 'function',
		function: {
			name: 'telegram_send_message',
			description:
				'Send a text message to Telegram. Leave chatId empty to use the workflow\'s bound destination. ' +
				'Supports Telegram HTML (<b>, <i>, <a href>).',
			parameters: {
				type: 'object',
				required: ['text'],
				properties: {
					text: { type: 'string', description: 'The message body (Telegram HTML allowed).' },
					chatId: { type: 'string', description: 'Optional override chat id; defaults to the bound destination.' },
				},
			},
		},
	},
	emdash_mcp_call: {
		type: 'function',
		function: {
			name: 'emdash_mcp_call',
			description:
				'Call an Emdash CMS tool via JSON-RPC. Typical flow: schema_get_collection (learn fields) → ' +
				'content_create (creates a DRAFT) → optionally content_publish. Leave items as draft unless told to publish. ' +
				'Rich-text fields take Portable Text JSON arrays. Other tools: content_list, content_get, content_update, ' +
				'content_unpublish, search.',
			parameters: {
				type: 'object',
				required: ['toolName'],
				properties: {
					toolName: { type: 'string', description: 'The Emdash tool name, e.g. "content_create".' },
					arguments: { type: 'object', description: 'Arguments object for the Emdash tool.' },
				},
			},
		},
	},
	search_items: {
		type: 'function',
		function: {
			name: 'search_items',
			description: 'Search stored feed items (read and unread) by keyword. Use to pull extra context.',
			parameters: {
				type: 'object',
				required: ['query'],
				properties: {
					query: { type: 'string', description: 'Search keyword.' },
					feedId: { type: 'string', description: 'Optional feed id filter.' },
					limit: { type: 'number', description: 'Max items (default 10).' },
				},
			},
		},
	},
	get_item: {
		type: 'function',
		function: {
			name: 'get_item',
			description: 'Fetch a single stored feed item (full text, media, topics) by its id.',
			parameters: {
				type: 'object',
				required: ['id'],
				properties: {
					id: { type: 'string', description: 'The item id.' },
				},
			},
		},
	},
};

/** Resolve OpenAI function schemas for the enabled tool keys. Unknown keys are skipped. */
export function resolveToolsMetadata(enabledTools: string[]): ToolMetadata[] {
	return enabledTools.map(key => TOOL_CATALOG[key]).filter(Boolean);
}

/** Execute one tool call. Returns a JSON-serializable result for the message history. */
export async function executeTool(
	name: string,
	args: Record<string, any>,
	env: Env,
	ctx: ToolContext,
): Promise<unknown> {
	switch (name) {
		case 'telegram_send_message': {
			const chatId = args.chatId || ctx.boundChatId;
			if (!chatId) return { error: 'No chatId provided and no bound destination configured.' };
			if (!args.text) return { error: 'text is required.' };
			const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
			const message: TelegramMediaMessage = { type: 'text', caption: String(args.text) };
			await sendMediaToChannel(bot, parseInt(String(chatId), 10), message);
			return { ok: true, chatId: String(chatId) };
		}
		case 'emdash_mcp_call': {
			return callEmdash(env, args.toolName, args.arguments ?? {});
		}
		case 'search_items': {
			if (!args.query) return { error: 'query is required.' };
			return searchItems(env.DB, { query: args.query, feedId: args.feedId, limit: args.limit || 10 });
		}
		case 'get_item': {
			if (!args.id) return { error: 'id is required.' };
			const row = await getItemById(env.DB, args.id);
			if (!row) return { error: `Item ${args.id} not found.` };
			const feed = await getFeedById(env.DB, row.feed_id);
			return dbItemToFeedItem(row, feed?.title ?? '', feed?.url ?? '');
		}
		default:
			return { error: `Unknown tool: ${name}` };
	}
}

/** POST a JSON-RPC tools/call to the Emdash MCP endpoint. */
async function callEmdash(env: Env, toolName: string, toolArgs: unknown): Promise<unknown> {
	if (!toolName) return { error: 'toolName is required.' };
	const base = (env.EMDASH_URL || '').replace(/\/$/, '');
	if (!base) return { error: 'EMDASH_URL is not configured.' };
	const res = await fetch(`${base}/_emdash/api/mcp`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
			Authorization: `Bearer ${env.EMDASH_TOKEN}`,
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/call',
			params: { name: toolName, arguments: toolArgs },
		}),
	});
	const text = await res.text();
	if (!res.ok) return { error: `Emdash HTTP ${res.status}`, body: text.slice(0, 500) };
	try {
		const json = JSON.parse(text);
		return json.result ?? json.error ?? json;
	} catch {
		return { raw: text.slice(0, 1000) };
	}
}
