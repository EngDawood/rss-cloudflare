import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { Bot } from 'grammy';
import { fetchFeed } from '../services/feed-fetcher';
import { formatFeedItem, resolveFormatSettings } from '../utils/telegram-format';
import { enrichFeedItems } from '../utils/media-enrichment';
import {
	getFeeds, getFeedById, getFeedByUrl, insertFeed, upsertFeedBySource, removeFeed, setFeedEnabled,
	updateLastFetched, upsertItems, listNewItems, searchItems, getItemById,
	markItemsRead, getConfig, setConfig, dbItemToFeedItem,
	getChats, getChatByName, upsertChat, removeChat, setDefaultChat,
	insertNote, listNotes, searchNotes, deleteNote,
	listPostLog, recall,
} from '../db/d1';
import { resolveTarget, logAndSend } from '../services/post-service';
import type { TelegramMediaMessage } from '../types/telegram';

function ok(data: unknown) {
	return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
	return { content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }], isError: true };
}

export function registerTools(server: McpServer, env: Env): void {
	const db = env.DB;

	// ── Feed management ──────────────────────────────────────────────────────

	server.tool(
		'add_feed',
		'Add an RSS/Atom feed URL to the saved list and fetch its initial items.',
		{ url: z.string().url(), title: z.string().optional() },
		async ({ url, title }) => {
			try {
				const existing = await getFeedByUrl(db, url);
				if (existing) return ok({ message: 'Feed already exists', feed: existing });

				const result = await fetchFeed(url, title);
				const feedTitle = title || result.feedTitle || url;
				const feed = await upsertFeedBySource(db, { sourceType: 'rss_url', sourceValue: url, title: feedTitle });
				const inserted = await upsertItems(db, feed.id, result.items);
				await updateLastFetched(db, feed.id);
				return ok({ feed, itemsInserted: inserted, errors: result.errors });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'list_feeds',
		'List all saved feeds with their total and unread item counts.',
		{},
		async () => {
			try {
				const feeds = await getFeeds(db);
				return ok(feeds);
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'remove_feed',
		'Remove a saved feed and all its stored items.',
		{ feedId: z.string() },
		async ({ feedId }) => {
			try {
				const feed = await getFeedById(db, feedId);
				if (!feed) return err(`Feed ${feedId} not found`);
				await removeFeed(db, feedId);
				return ok({ removed: feedId, title: feed.title });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'set_feed_enabled',
		'Enable or disable a saved feed from being auto-refreshed by the cron.',
		{ feedId: z.string(), enabled: z.boolean() },
		async ({ feedId, enabled }) => {
			try {
				const feed = await getFeedById(db, feedId);
				if (!feed) return err(`Feed ${feedId} not found`);
				await setFeedEnabled(db, feedId, enabled);
				return ok({ feedId, enabled });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// ── Fetch / refresh ───────────────────────────────────────────────────────

	server.tool(
		'refresh_feed',
		'Fetch the latest items for a saved feed and store any new ones.',
		{ feedId: z.string() },
		async ({ feedId }) => {
			try {
				const feed = await getFeedById(db, feedId);
				if (!feed) return err(`Feed ${feedId} not found`);
				const result = await fetchFeed(feed.url, feed.title || undefined);
				const inserted = await upsertItems(db, feedId, result.items);
				await updateLastFetched(db, feedId);
				return ok({ feedId, itemsFetched: result.items.length, itemsInserted: inserted, errors: result.errors });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'refresh_all',
		'Refresh all enabled saved feeds.',
		{},
		async () => {
			try {
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
				return ok({ refreshed: results.length, results });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'fetch_rss_feed',
		'Ad-hoc: fetch any RSS/Atom URL and return items without storing them.',
		{ url: z.string().url(), count: z.number().int().min(1).max(100).optional().default(10) },
		async ({ url, count }) => {
			try {
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
				return ok({ feedTitle: result.feedTitle, feedLink: result.feedLink, items, errors: result.errors });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// ── Browse / read tracking ─────────────────────────────────────────────────

	server.tool(
		'list_new_items',
		'List unread items (compact). Filter by feedId, keyword query (title/text/author), or since (Unix timestamp).',
		{
			feedId: z.string().optional(),
			query: z.string().optional(),
			since: z.number().int().optional(),
			limit: z.number().int().min(1).max(200).optional().default(50),
		},
		async ({ feedId, query, since, limit }) => {
			try {
				const items = await listNewItems(db, { feedId, query, since, limit });
				return ok(items);
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'search_items',
		'Search all stored items (read + unread) by keyword across title, text, and author. Filter further by feedId, since (Unix timestamp), or unreadOnly.',
		{
			query: z.string().min(1),
			feedId: z.string().optional(),
			since: z.number().int().optional(),
			unreadOnly: z.boolean().optional().default(false),
			limit: z.number().int().min(1).max(200).optional().default(50),
		},
		async ({ query, feedId, since, unreadOnly, limit }) => {
			try {
				const items = await searchItems(db, { query, feedId, since, unreadOnly, limit });
				return ok(items);
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'get_item',
		'Get the full stored item by id (title, text, contentHtml, media, topics, link). Pass markRead=true to mark it as read.',
		{ id: z.string(), markRead: z.boolean().optional().default(false) },
		async ({ id, markRead }) => {
			try {
				const row = await getItemById(db, id);
				if (!row) return err(`Item ${id} not found`);
				if (markRead) await markItemsRead(db, [id], true);
				return ok({
					...row,
					topics: JSON.parse(row.topics || '[]'),
					media: JSON.parse(row.media || '[]'),
				});
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'mark_read',
		'Mark one or more items as read.',
		{ ids: z.array(z.string()).min(1) },
		async ({ ids }) => {
			try {
				await markItemsRead(db, ids, true);
				return ok({ marked: ids.length });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'mark_unread',
		'Mark one or more items as unread.',
		{ ids: z.array(z.string()).min(1) },
		async ({ ids }) => {
			try {
				await markItemsRead(db, ids, false);
				return ok({ marked: ids.length });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// ── Config ────────────────────────────────────────────────────────────────

	server.tool(
		'get_config',
		'Get the MCP configuration (e.g. stored telegramChatId).',
		{},
		async () => {
			try {
				const telegramChatId = await getConfig(db, 'telegram_chat_id');
				return ok({ telegramChatId });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);


	// ── Action ────────────────────────────────────────────────────────────────

	server.tool(
		'post_to_telegram',
		'Send a stored item to a Telegram channel. target can be a chat name or raw numeric id; omit to use the default chat.',
		{
			id: z.string(),
			target: z.string().optional(),
		},
		async ({ id, target }) => {
			try {
				const row = await getItemById(db, id);
				if (!row) return err(`Item ${id} not found`);

				const feed = await getFeedById(db, row.feed_id);
				const feedTitle = feed?.title ?? '';
				const feedLink = feed?.url ?? '';

				const { chatId, chatName } = await resolveTarget(db, target);

				const item = dbItemToFeedItem(row, feedTitle, feedLink);
				await enrichFeedItems([item], { token: env.TELEGRAPH_ACCESS_TOKEN });

				const settings = resolveFormatSettings();
				const message = formatFeedItem(item, settings);

				const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
				await logAndSend(db, bot, chatId, chatName, message, id);

				return ok({ ok: true, chatId, chatName, itemId: id });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// ── Chat management ───────────────────────────────────────────────────────

	server.tool(
		'add_chat',
		'Register a named Telegram chat (channel, group, private, bot). Pass makeDefault=true to make it the default target.',
		{
			name: z.string().min(1),
			chatId: z.string(),
			type: z.enum(['channel', 'group', 'private', 'bot']).optional().default('channel'),
			makeDefault: z.boolean().optional().default(false),
		},
		async ({ name, chatId, type, makeDefault }) => {
			try {
				const chat = await upsertChat(db, name, chatId, type, makeDefault);
				return ok(chat);
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'list_chats',
		'List all registered Telegram chats with their names, ids, types, and which is the default.',
		{},
		async () => {
			try {
				const chats = await getChats(db);
				return ok(chats);
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'remove_chat',
		'Remove a registered Telegram chat by name.',
		{ name: z.string() },
		async ({ name }) => {
			try {
				const chat = await getChatByName(db, name);
				if (!chat) return err(`Chat "${name}" not found`);
				await removeChat(db, name);
				return ok({ removed: name });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'set_default_chat',
		'Set an existing registered chat as the default target for post_to_telegram and post_message.',
		{ name: z.string() },
		async ({ name }) => {
			try {
				const chat = await getChatByName(db, name);
				if (!chat) return err(`Chat "${name}" not found`);
				await setDefaultChat(db, name);
				return ok({ default: name });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// Back-compat: kept so existing callers don't break.
	server.tool(
		'set_telegram_chat',
		'(Legacy) Set the default Telegram chat id. Prefer add_chat for named multi-chat support.',
		{ chatId: z.string() },
		async ({ chatId }) => {
			try {
				await upsertChat(db, 'default', chatId, 'channel', true);
				return ok({ telegramChatId: chatId });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// ── Notes ─────────────────────────────────────────────────────────────────

	server.tool(
		'save_note',
		'Save a freeform note or recap. Optionally tag it and/or link it to a stored item or chat.',
		{
			content: z.string().min(1),
			tags: z.array(z.string()).optional(),
			refItemId: z.string().optional(),
			refChat: z.string().optional(),
		},
		async ({ content, tags, refItemId, refChat }) => {
			try {
				const note = await insertNote(db, { content, tags, refItemId, refChat });
				return ok({ ...note, tags: JSON.parse(note.tags) });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'list_notes',
		'List saved notes, newest first. Optionally filter by tag.',
		{
			limit: z.number().int().min(1).max(200).optional().default(50),
			tag: z.string().optional(),
		},
		async ({ limit, tag }) => {
			try {
				const notes = await listNotes(db, limit, tag);
				return ok(notes.map(n => ({ ...n, tags: JSON.parse(n.tags) })));
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'search_notes',
		'Full-text search over note content (case-insensitive substring match).',
		{
			query: z.string().min(1),
			limit: z.number().int().min(1).max(200).optional().default(50),
		},
		async ({ query, limit }) => {
			try {
				const notes = await searchNotes(db, query, limit);
				return ok(notes.map(n => ({ ...n, tags: JSON.parse(n.tags) })));
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'delete_note',
		'Delete a saved note by id.',
		{ id: z.string() },
		async ({ id }) => {
			try {
				await deleteNote(db, id);
				return ok({ deleted: id });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// ── Memory recall ─────────────────────────────────────────────────────────

	server.tool(
		'recall',
		'Unified chronological timeline of notes and post activity, newest first. Use since (Unix timestamp) to limit to recent entries.',
		{
			limit: z.number().int().min(1).max(200).optional().default(50),
			since: z.number().int().optional(),
		},
		async ({ limit, since }) => {
			try {
				const entries = await recall(db, limit, since);
				return ok(entries);
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	server.tool(
		'list_post_log',
		'List the post history (auto-written on every send). Filter by itemId or chatId.',
		{
			limit: z.number().int().min(1).max(200).optional().default(50),
			itemId: z.string().optional(),
			chatId: z.string().optional(),
		},
		async ({ limit, itemId, chatId }) => {
			try {
				const logs = await listPostLog(db, limit, { itemId, chatId });
				return ok(logs);
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);

	// ── Custom post ───────────────────────────────────────────────────────────

	server.tool(
		'post_message',
		`Send a custom message to Telegram, or post a stored item with an overridden caption/target.
- target: chat name or raw numeric id; omit to use the default chat.
- If itemId is given, the stored item is loaded and formatted; caption overrides the generated one.
- Otherwise type + caption + mediaUrl/media are used directly.`,
		{
			target: z.string().optional(),
			type: z.enum(['text', 'photo', 'video', 'audio', 'album']).optional(),
			caption: z.string().optional(),
			mediaUrl: z.string().url().optional(),
			media: z.array(z.object({
				type: z.enum(['photo', 'video']),
				url: z.string().url(),
			})).optional(),
			itemId: z.string().optional(),
		},
		async ({ target, type, caption, mediaUrl, media, itemId }) => {
			try {
				const { chatId, chatName } = await resolveTarget(db, target);
				const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
				let message: TelegramMediaMessage;

				if (itemId) {
					const row = await getItemById(db, itemId);
					if (!row) return err(`Item ${itemId} not found`);
					const feed = await getFeedById(db, row.feed_id);
					const item = dbItemToFeedItem(row, feed?.title ?? '', feed?.url ?? '');
					await enrichFeedItems([item], { token: env.TELEGRAPH_ACCESS_TOKEN });
					message = formatFeedItem(item, resolveFormatSettings());
					if (caption) message = { ...message, caption };
				} else {
					const msgType = type ?? 'text';
					const cap = caption ?? '';
					if (msgType === 'text') {
						message = { type: 'text', caption: cap };
					} else if (msgType === 'album') {
						const items = media ?? [];
						if (items.length === 0) return err('album type requires at least one item in media[]');
						message = {
							type: 'mediagroup',
							caption: cap,
							media: items.map((m, i) => ({
								type: m.type,
								media: m.url,
								...(i === 0 ? { caption: cap, parse_mode: 'HTML' } : {}),
							})),
						};
					} else {
						if (!mediaUrl) return err(`type "${msgType}" requires mediaUrl`);
						message = { type: msgType as 'photo' | 'video' | 'audio', url: mediaUrl, caption: cap };
					}
				}

				await logAndSend(db, bot, chatId, chatName, message, itemId);
				return ok({ ok: true, chatId, chatName, type: message.type });
			} catch (e) {
				return err(e instanceof Error ? e.message : String(e));
			}
		},
	);
}
