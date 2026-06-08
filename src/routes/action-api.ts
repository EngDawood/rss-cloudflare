import type { Context } from 'hono';
import { Bot } from 'grammy';
import { fetchFeed } from '../services/feed-fetcher';
import { formatFeedItem, resolveFormatSettings } from '../utils/telegram-format';
import { sendMediaToChannel } from '../services/telegram-bot/handlers/send-media';
import { enrichFeedItems } from '../utils/media-enrichment';
import { summarizeItem } from '../services/ai-summarizer';
import {
	getFeeds, getFeedById, getFeedByUrl, insertFeed, removeFeed, setFeedEnabled,
	updateLastFetched, upsertItems, listNewItems, searchItems, getItemById,
	markItemsRead, getConfig, setConfig, dbItemToFeedItem,
	getChats, getChatByName, getDefaultChat, upsertChat, removeChat, setDefaultChat,
	insertNote, listNotes, searchNotes, deleteNote,
	insertPostLog, listPostLog, recall, updateItemSummary
} from '../db/d1';
import type { TelegramMediaMessage } from '../types/telegram';

type HonoEnv = { Bindings: Env };

async function resolveTarget(
	db: D1Database,
	target?: string,
): Promise<{ chatId: number; chatName?: string }> {
	if (!target) {
		const def = await getDefaultChat(db);
		if (!def) throw new Error('No target specified and no default chat configured. Register a chat first.');
		return { chatId: parseInt(def.chat_id, 10), chatName: def.name };
	}
	const byName = await getChatByName(db, target);
	if (byName) return { chatId: parseInt(byName.chat_id, 10), chatName: byName.name };
	const numId = parseInt(target, 10);
	if (!isNaN(numId)) return { chatId: numId };
	throw new Error(`Unknown chat target: "${target}". Use a registered chat name or a numeric chat id.`);
}

async function logAndSend(
	db: D1Database,
	bot: Bot,
	chatId: number,
	chatName: string | undefined,
	message: TelegramMediaMessage,
	itemId?: string,
): Promise<void> {
	const captionPreview = message.caption.slice(0, 200);
	try {
		await sendMediaToChannel(bot, chatId, message);
		await insertPostLog(db, {
			itemId,
			chatName,
			chatId: String(chatId),
			messageType: message.type,
			captionPreview,
			status: 'ok',
		});
	} catch (e) {
		await insertPostLog(db, {
			itemId,
			chatName,
			chatId: String(chatId),
			messageType: message.type,
			captionPreview,
			status: 'error',
			error: e instanceof Error ? e.message : String(e),
		});
		throw e;
	}
}

export async function handleActionApi(c: Context<HonoEnv>): Promise<Response> {
	// 1. Authenticate if MCP_AUTH_TOKEN is configured
	const auth = c.req.header('Authorization');
	const mcpToken = c.env.MCP_AUTH_TOKEN;
	if (mcpToken && auth !== `Bearer ${mcpToken}`) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	// 2. Parse request
	let body: { action: string; params?: any };
	try {
		body = await c.req.json();
	} catch (e) {
		return c.json({ error: 'Invalid JSON request body' }, 400);
	}

	const { action, params = {} } = body;
	const db = c.env.DB;

	try {
		switch (action) {
			// ── Feed management ──────────────────────────────────────────────────────
			case 'list_feeds': {
				const feeds = await getFeeds(db);
				return c.json({ data: feeds });
			}
			case 'add_feed': {
				const { url, title } = params;
				if (!url) return c.json({ error: 'url parameter is required' }, 400);
				const existing = await getFeedByUrl(db, url);
				if (existing) return c.json({ data: { message: 'Feed already exists', feed: existing } });

				const result = await fetchFeed(url, title);
				const feedTitle = title || result.feedTitle || url;
				const feed = await insertFeed(db, url, feedTitle);
				const inserted = await upsertItems(db, feed.id, result.items);
				await updateLastFetched(db, feed.id);
				return c.json({ data: { feed, itemsInserted: inserted, errors: result.errors } });
			}
			case 'remove_feed': {
				const { feedId } = params;
				if (!feedId) return c.json({ error: 'feedId is required' }, 400);
				const feed = await getFeedById(db, feedId);
				if (!feed) return c.json({ error: `Feed ${feedId} not found` }, 404);
				await removeFeed(db, feedId);
				return c.json({ data: { removed: feedId, title: feed.title } });
			}
			case 'set_feed_enabled': {
				const { feedId, enabled } = params;
				if (!feedId || enabled === undefined) return c.json({ error: 'feedId and enabled are required' }, 400);
				await setFeedEnabled(db, feedId, !!enabled);
				return c.json({ data: { feedId, enabled } });
			}

			// ── Fetch / refresh ───────────────────────────────────────────────────────
			case 'refresh_feed': {
				const { feedId } = params;
				if (!feedId) return c.json({ error: 'feedId is required' }, 400);
				const feed = await getFeedById(db, feedId);
				if (!feed) return c.json({ error: `Feed ${feedId} not found` }, 404);
				const result = await fetchFeed(feed.url, feed.title || undefined);
				const inserted = await upsertItems(db, feedId, result.items);
				await updateLastFetched(db, feedId);
				return c.json({ data: { feedId, itemsFetched: result.items.length, itemsInserted: inserted, errors: result.errors } });
			}
			case 'refresh_all': {
				const feeds = await getFeeds(db);
				const enabled = feeds.filter(f => f.enabled === 1);
				const results: Array<{ feedId: string; title: string; inserted: number; errors: number }> = [];
				for (const feed of enabled) {
					try {
						const result = await fetchFeed(feed.url, feed.title || undefined);
						const inserted = await upsertItems(db, feed.id, result.items);
						await updateLastFetched(db, feed.id);
						results.push({ feedId: feed.id, title: feed.title, inserted, errors: result.errors.length });
					} catch (e) {
						results.push({ feedId: feed.id, title: feed.title, inserted: 0, errors: 1 });
					}
				}
				return c.json({ data: { refreshed: results.length, results } });
			}
			case 'fetch_rss_feed': {
				const { url, count = 10 } = params;
				if (!url) return c.json({ error: 'url is required' }, 400);
				const result = await fetchFeed(url);
				const items = result.items.slice(0, count).map(item => ({
					id: item.id,
					title: item.title,
					link: item.link,
					author: item.author,
					topics: item.topics ?? [],
					timestamp: item.timestamp,
					mediaType: item.mediaType,
					text: item.text.slice(0, 500),
				}));
				return c.json({ data: { feedTitle: result.feedTitle, feedLink: result.feedLink, items, errors: result.errors } });
			}

			// ── Browse / read tracking ─────────────────────────────────────────────────
			case 'list_new_items': {
				const { feedId, query, since, limit = 50 } = params;
				const items = await listNewItems(db, { feedId, query, since, limit });
				return c.json({ data: items });
			}
			case 'search_items': {
				const { query, feedId, since, unreadOnly = false, limit = 50 } = params;
				if (!query) return c.json({ error: 'query is required' }, 400);
				const items = await searchItems(db, { query, feedId, since, unreadOnly, limit });
				return c.json({ data: items });
			}
			case 'get_item': {
				const { id, markRead = false } = params;
				if (!id) return c.json({ error: 'id is required' }, 400);
				const row = await getItemById(db, id);
				if (!row) return c.json({ error: `Item ${id} not found` }, 404);
				if (markRead) await markItemsRead(db, [id], true);
				return c.json({
					data: {
						...row,
						topics: JSON.parse(row.topics || '[]'),
						media: JSON.parse(row.media || '[]'),
					}
				});
			}
			case 'mark_read': {
				const { ids } = params;
				if (!ids || !Array.isArray(ids)) return c.json({ error: 'ids array is required' }, 400);
				await markItemsRead(db, ids, true);
				return c.json({ data: { marked: ids.length } });
			}
			case 'mark_unread': {
				const { ids } = params;
				if (!ids || !Array.isArray(ids)) return c.json({ error: 'ids array is required' }, 400);
				await markItemsRead(db, ids, false);
				return c.json({ data: { marked: ids.length } });
			}

			// ── Chat management ───────────────────────────────────────────────────────
			case 'list_chats': {
				const chats = await getChats(db);
				return c.json({ data: chats });
			}
			case 'add_chat': {
				const { name, chatId, type = 'channel', makeDefault = false } = params;
				if (!name || !chatId) return c.json({ error: 'name and chatId are required' }, 400);
				const chat = await upsertChat(db, name, chatId, type, makeDefault);
				return c.json({ data: chat });
			}
			case 'remove_chat': {
				const { name } = params;
				if (!name) return c.json({ error: 'name is required' }, 400);
				const chat = await getChatByName(db, name);
				if (!chat) return c.json({ error: `Chat "${name}" not found` }, 404);
				await removeChat(db, name);
				return c.json({ data: { removed: name } });
			}
			case 'set_default_chat': {
				const { name } = params;
				if (!name) return c.json({ error: 'name is required' }, 400);
				const chat = await getChatByName(db, name);
				if (!chat) return c.json({ error: `Chat "${name}" not found` }, 404);
				await setDefaultChat(db, name);
				return c.json({ data: { default: name } });
			}

			// ── Post ──────────────────────────────────────────────────────────────────
			case 'post_to_telegram': {
				const { id, target } = params;
				if (!id) return c.json({ error: 'id is required' }, 400);
				const row = await getItemById(db, id);
				if (!row) return c.json({ error: `Item ${id} not found` }, 404);

				const feed = await getFeedById(db, row.feed_id);
				const feedTitle = feed?.title ?? '';
				const feedLink = feed?.url ?? '';

				const { chatId, chatName } = await resolveTarget(db, target);

				const item = dbItemToFeedItem(row, feedTitle, feedLink);
				await enrichFeedItems([item], { token: c.env.TELEGRAPH_ACCESS_TOKEN });

				const settings = resolveFormatSettings();
				const message = formatFeedItem(item, settings);

				const bot = new Bot(c.env.TELEGRAM_BOT_TOKEN);
				await logAndSend(db, bot, chatId, chatName, message, id);

				return c.json({ data: { ok: true, chatId, chatName, itemId: id } });
			}
			case 'post_message': {
				const { target, type, caption, mediaUrl, media, itemId } = params;
				const { chatId, chatName } = await resolveTarget(db, target);
				const bot = new Bot(c.env.TELEGRAM_BOT_TOKEN);
				let message: TelegramMediaMessage;

				if (itemId) {
					const row = await getItemById(db, itemId);
					if (!row) return c.json({ error: `Item ${itemId} not found` }, 404);
					const feed = await getFeedById(db, row.feed_id);
					const item = dbItemToFeedItem(row, feed?.title ?? '', feed?.url ?? '');
					await enrichFeedItems([item], { token: c.env.TELEGRAPH_ACCESS_TOKEN });
					message = formatFeedItem(item, resolveFormatSettings());
					if (caption) message = { ...message, caption };
				} else {
					const msgType = type ?? 'text';
					const cap = caption ?? '';
					if (msgType === 'text') {
						message = { type: 'text', caption: cap };
					} else if (msgType === 'album') {
						const items = media ?? [];
						if (items.length === 0) return c.json({ error: 'album type requires at least one item in media[]' }, 400);
						message = {
							type: 'mediagroup',
							caption: cap,
							media: items.map((m: any, i: number) => ({
								type: m.type,
								media: m.url,
								...(i === 0 ? { caption: cap, parse_mode: 'HTML' } : {}),
							})),
						};
					} else {
						if (!mediaUrl) return c.json({ error: `type "${msgType}" requires mediaUrl` }, 400);
						message = { type: msgType as 'photo' | 'video' | 'audio', url: mediaUrl, caption: cap };
					}
				}

				await logAndSend(db, bot, chatId, chatName, message, itemId);
				return c.json({ data: { ok: true, chatId, chatName, type: message.type } });
			}

			// ── Notes ─────────────────────────────────────────────────────────────────
			case 'save_note': {
				const { content, tags, refItemId, refChat } = params;
				if (!content) return c.json({ error: 'content is required' }, 400);
				const note = await insertNote(db, { content, tags, refItemId, refChat });
				return c.json({ data: { ...note, tags: JSON.parse(note.tags) } });
			}
			case 'list_notes': {
				const { limit = 50, tag } = params;
				const notes = await listNotes(db, limit, tag);
				return c.json({ data: notes.map(n => ({ ...n, tags: JSON.parse(n.tags) })) });
			}
			case 'search_notes': {
				const { query, limit = 50 } = params;
				if (!query) return c.json({ error: 'query is required' }, 400);
				const notes = await searchNotes(db, query, limit);
				return c.json({ data: notes.map(n => ({ ...n, tags: JSON.parse(n.tags) })) });
			}
			case 'delete_note': {
				const { id } = params;
				if (!id) return c.json({ error: 'id is required' }, 400);
				await deleteNote(db, id);
				return c.json({ data: { deleted: id } });
			}

			// ── Memory recall ─────────────────────────────────────────────────────────
			case 'recall': {
				const { limit = 50, since } = params;
				const entries = await recall(db, limit, since);
				return c.json({ data: entries });
			}
			case 'list_post_log': {
				const { limit = 50, itemId, chatId } = params;
				const logs = await listPostLog(db, limit, { itemId, chatId });
				return c.json({ data: logs });
			}

			// ── Config ────────────────────────────────────────────────────────────────
			case 'get_config': {
				const telegramChatId = await getConfig(db, 'telegram_chat_id');
				const aiSummaryEnabled = await getConfig(db, 'ai_summary_enabled');
				const aiModel = await getConfig(db, 'ai_model');
				const aiPrompt = await getConfig(db, 'ai_prompt');
				return c.json({ data: { telegramChatId, aiSummaryEnabled, aiModel, aiPrompt } });
			}
			case 'set_config': {
				const { key, value } = params;
				if (!key || value === undefined) return c.json({ error: 'key and value are required' }, 400);
				await setConfig(db, key, value);
				return c.json({ data: { [key]: value } });
			}

			// ── AI On-Demand Summary (Added for Dashboard UI) ────────────────────────
			case 'summarize_item': {
				const { itemId } = params;
				if (!itemId) return c.json({ error: 'itemId is required' }, 400);
				const row = await getItemById(db, itemId);
				if (!row) return c.json({ error: `Item ${itemId} not found` }, 404);
				const feed = await getFeedById(db, row.feed_id);
				const item = dbItemToFeedItem(row, feed?.title ?? '', feed?.url ?? '');

				const globalModel = await getConfig(db, 'ai_model') || undefined;
				const globalPrompt = await getConfig(db, 'ai_prompt') || undefined;

				const summary = await summarizeItem(item, c.env, globalModel, globalPrompt);
				if (summary) {
					await updateItemSummary(db, row.feed_id, row.id, summary);
				}
				return c.json({ data: { summary } });
			}

			default:
				return c.json({ error: `Unknown action: "${action}"` }, 400);
		}
	} catch (e: any) {
		console.error(`[API] Error executing action "${action}":`, e);
		return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
	}
}

export async function handleChatApi(c: Context<HonoEnv>): Promise<Response> {
	const auth = c.req.header('Authorization');
	const mcpToken = c.env.MCP_AUTH_TOKEN;
	if (mcpToken && auth !== `Bearer ${mcpToken}`) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	let body: { messages: Array<{ role: 'user' | 'assistant'; content: string }> };
	try {
		body = await c.req.json();
	} catch (e) {
		return c.json({ error: 'Invalid JSON request body' }, 400);
	}

	const { messages = [] } = body;
	if (messages.length === 0) {
		return c.json({ error: 'messages array is required and cannot be empty' }, 400);
	}

	try {
		const { runChatAgent } = await import('../services/chat-agent');
		const result = await runChatAgent(messages, c.env);
		return c.json({ data: result });
	} catch (e: any) {
		console.error('[API] Error in chat agent:', e);
		return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
	}
}
