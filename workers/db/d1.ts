import type { FeedItem, FeedItemMedia, FeedItemMediaType, FeedMediaFilter } from '../types/feed';
import type { ChannelConfig, ChannelSource, SourceType, FormatSettings } from '../types/telegram';

// ── D1 row shapes ────────────────────────────────────────────────────────────

export interface DbFeed {
	id: string;
	source_type: string;   // SourceType — 'rss_url' for legacy/RSS feeds
	source_value: string;  // URL for rss_url; username for instagram_user; etc.
	title: string;
	enabled: number;
	check_interval_minutes: number;
	last_fetched_at: number | null;
	created_at: number;
	ai_summary: string;   // 'inherit' | 'enable' | 'disable'
	url: string;          // back-compat alias of source_value (SELECT-aliased)
}

export interface DbFeedWithCounts extends DbFeed {
	total_count: number;
	unread_count: number;
	telegram_channel_ids: string | null; // comma-separated channel IDs from GROUP_CONCAT, null if none
}

export interface DbItem {
	feed_id: string;
	id: string;
	title: string;
	link: string;
	author: string;
	topics: string;      // JSON string[]
	text: string;
	content_html: string | null;
	media: string;       // JSON FeedItemMedia[]
	media_type: string;
	timestamp: number;
	read: number;
	fetched_at: number;
	summary: string | null;
}

export interface DbItemCompact {
	feed_id: string;
	id: string;
	title: string;
	link: string;
	author: string;
	topics: string[];    // parsed
	timestamp: number;
	feed_title: string;
	feed_url: string;
	read: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function genId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

function parseJsonSafe<T>(json: string, fallback: T): T {
	try { return JSON.parse(json); } catch { return fallback; }
}

export function dbItemToFeedItem(row: DbItem, feedTitle: string, feedLink: string): FeedItem {
	return {
		id: row.id,
		link: row.link,
		title: row.title,
		text: row.text,
		contentHtml: row.content_html ?? undefined,
		author: row.author,
		feedTitle,
		feedLink,
		timestamp: row.timestamp,
		mediaType: row.media_type as FeedItemMediaType,
		media: parseJsonSafe<FeedItemMedia[]>(row.media, []),
		topics: parseJsonSafe<string[]>(row.topics, []),
		summary: row.summary ?? undefined,
	};
}

// ── Feed CRUD ─────────────────────────────────────────────────────────────────

export async function getFeeds(db: D1Database): Promise<DbFeedWithCounts[]> {
	const result = await db.prepare(`
		SELECT f.*, f.source_value AS url,
			COUNT(i.id) as total_count,
			SUM(CASE WHEN i.read = 0 THEN 1 ELSE 0 END) as unread_count,
			(SELECT GROUP_CONCAT(ts.channel_id) FROM telegram_subscriptions ts WHERE ts.feed_id = f.id) as telegram_channel_ids
		FROM feeds f
		LEFT JOIN items i ON i.feed_id = f.id
		GROUP BY f.id
		ORDER BY f.created_at ASC
	`).all<DbFeedWithCounts>();
	return result.results;
}

export async function getChannels(db: D1Database): Promise<DbChannel[]> {
	const result = await db.prepare(
		'SELECT id, name, enabled FROM channels ORDER BY name ASC'
	).all<DbChannel>();
	return result.results;
}

export async function getFeedById(db: D1Database, feedId: string): Promise<DbFeed | null> {
	return db.prepare('SELECT *, source_value AS url FROM feeds WHERE id = ?').bind(feedId).first<DbFeed>();
}

/** Look up a feed by its (source_type, source_value) identity. */
export async function getFeedBySource(
	db: D1Database,
	sourceType: SourceType,
	sourceValue: string,
): Promise<DbFeed | null> {
	return db.prepare('SELECT *, source_value AS url FROM feeds WHERE source_type = ? AND source_value = ?')
		.bind(sourceType, sourceValue).first<DbFeed>();
}

/** Back-compat: look up an `rss_url` feed by its URL. */
export async function getFeedByUrl(db: D1Database, url: string): Promise<DbFeed | null> {
	return getFeedBySource(db, 'rss_url', url);
}

/**
 * Insert a core feed identified by (source_type, source_value). When a feed
 * with the same identity already exists, the existing row is reused
 * (INSERT OR IGNORE) — this is the de-duplication guarantee.
 */
export async function upsertFeedBySource(
	db: D1Database,
	opts: { sourceType: SourceType; sourceValue: string; title?: string; checkIntervalMinutes?: number },
): Promise<DbFeed> {
	const existing = await getFeedBySource(db, opts.sourceType, opts.sourceValue);
	if (existing) return existing;
	const id = genId();
	const now = Math.floor(Date.now() / 1000);
	const interval = opts.checkIntervalMinutes ?? 60;
	await db.prepare(
		`INSERT OR IGNORE INTO feeds (id, source_type, source_value, title, enabled, check_interval_minutes, created_at)
		 VALUES (?, ?, ?, ?, 1, ?, ?)`
	).bind(id, opts.sourceType, opts.sourceValue, opts.title ?? '', interval, now).run();
	const row = await getFeedBySource(db, opts.sourceType, opts.sourceValue);
	return row ?? {
		id, source_type: opts.sourceType, source_value: opts.sourceValue, title: opts.title ?? '',
		enabled: 1, check_interval_minutes: interval, last_fetched_at: null, created_at: now,
		ai_summary: 'inherit', url: opts.sourceValue,
	};
}

/** Back-compat: insert an `rss_url` feed from a URL. */
export async function insertFeed(db: D1Database, url: string, title: string): Promise<DbFeed> {
	return upsertFeedBySource(db, { sourceType: 'rss_url', sourceValue: url, title });
}

export async function removeFeed(db: D1Database, feedId: string): Promise<void> {
	await db.prepare('DELETE FROM feeds WHERE id = ?').bind(feedId).run();
}

export async function setFeedEnabled(db: D1Database, feedId: string, enabled: boolean): Promise<void> {
	await db.prepare('UPDATE feeds SET enabled = ? WHERE id = ?')
		.bind(enabled ? 1 : 0, feedId).run();
}

export async function updateLastFetched(db: D1Database, feedId: string): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	await db.prepare('UPDATE feeds SET last_fetched_at = ? WHERE id = ?').bind(now, feedId).run();
}

// ── Item upsert ───────────────────────────────────────────────────────────────

/** Insert new items; skip existing ones (INSERT OR IGNORE). Returns count inserted. */
export async function upsertItems(db: D1Database, feedId: string, items: FeedItem[]): Promise<number> {
	if (items.length === 0) return 0;
	const now = Math.floor(Date.now() / 1000);
	let inserted = 0;
	// Batch in groups of 20 to stay within D1 batch limits
	for (let i = 0; i < items.length; i += 20) {
		const batch = items.slice(i, i + 20);
		const stmts = batch.map(item =>
			db.prepare(
				`INSERT OR IGNORE INTO items
					(feed_id, id, title, link, author, topics, text, content_html, media, media_type, timestamp, fetched_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			).bind(
				feedId,
				item.id,
				item.title,
				item.link,
				item.author,
				JSON.stringify(item.topics ?? []),
				item.text,
				item.contentHtml ?? null,
				JSON.stringify(item.media),
				item.mediaType,
				item.timestamp,
				now
			)
		);
		const results = await db.batch(stmts);
		inserted += results.filter(r => r.meta.rows_written > 0).length;
	}
	return inserted;
}

// ── Browse / read tracking ────────────────────────────────────────────────────

export async function listNewItems(
	db: D1Database,
	opts?: {
		feedId?: string | string[];
		limit?: number;
		query?: string;
		since?: number;
		unreadOnly?: boolean;
		readOnly?: boolean;
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { feedId, limit = 50, query, since, unreadOnly = true, readOnly = false } = opts ?? {};

	const where: string[] = [];
	if (readOnly) {
		where.push('i.read = 1');
	} else if (unreadOnly) {
		where.push('i.read = 0');
	}
	const params: unknown[] = [];

	if (feedId) {
		if (Array.isArray(feedId)) {
			if (feedId.length > 0) {
				const placeholders = feedId.map(() => '?').join(',');
				where.push(`i.feed_id IN (${placeholders})`);
				params.push(...feedId);
			}
		} else {
			where.push('i.feed_id = ?');
			params.push(feedId);
		}
	}
	if (query) {
		const like = `%${query}%`;
		where.push('(i.title LIKE ? OR i.text LIKE ? OR i.author LIKE ?)');
		params.push(like, like, like);
	}
	if (since) { where.push('i.timestamp >= ?'); params.push(since); }

	params.push(limit);
	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp, i.read,
		       f.title as feed_title, f.source_value as feed_url
		FROM items i JOIN feeds f ON f.id = i.feed_id
		WHERE ${where.length ? where.join(' AND ') : '1=1'}
		ORDER BY i.timestamp DESC LIMIT ?
	`;
	const result = await db.prepare(sql).bind(...params).all<Raw>();
	return result.results.map(row => ({
		...row,
		topics: parseJsonSafe<string[]>(row.topics, []),
	}));
}

export async function searchItems(
	db: D1Database,
	opts: {
		query: string;
		feedId?: string | string[];
		since?: number;
		unreadOnly?: boolean;
		readOnly?: boolean;
		limit?: number;
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { query, feedId, since, unreadOnly = false, readOnly = false, limit = 50 } = opts;

	const like = `%${query}%`;
	const where: string[] = ['(i.title LIKE ? OR i.text LIKE ? OR i.author LIKE ?)'];
	const params: unknown[] = [like, like, like];

	if (readOnly) {
		where.push('i.read = 1');
	} else if (unreadOnly) {
		where.push('i.read = 0');
	}
	if (feedId) {
		if (Array.isArray(feedId)) {
			if (feedId.length > 0) {
				const placeholders = feedId.map(() => '?').join(',');
				where.push(`i.feed_id IN (${placeholders})`);
				params.push(...feedId);
			}
		} else {
			where.push('i.feed_id = ?');
			params.push(feedId);
		}
	}
	if (since) { where.push('i.timestamp >= ?'); params.push(since); }

	params.push(limit);
	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp, i.read,
		       f.title as feed_title, f.source_value as feed_url
		FROM items i JOIN feeds f ON f.id = i.feed_id
		WHERE ${where.join(' AND ')}
		ORDER BY i.timestamp DESC LIMIT ?
	`;
	const result = await db.prepare(sql).bind(...params).all<Raw>();
	return result.results.map(row => ({
		...row,
		topics: parseJsonSafe<string[]>(row.topics, []),
	}));
}

export async function getItemById(db: D1Database, id: string): Promise<DbItem | null> {
	return db.prepare('SELECT * FROM items WHERE id = ? LIMIT 1').bind(id).first<DbItem>();
}

export async function markItemsRead(db: D1Database, ids: string[], read: boolean): Promise<void> {
	if (ids.length === 0) return;
	const val = read ? 1 : 0;
	const stmts = ids.map(id => db.prepare('UPDATE items SET read = ? WHERE id = ?').bind(val, id));
	await db.batch(stmts);
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getConfig(db: D1Database, key: string): Promise<string | null> {
	const row = await db.prepare('SELECT value FROM config WHERE key = ?')
		.bind(key).first<{ value: string }>();
	return row?.value ?? null;
}

export async function setConfig(db: D1Database, key: string, value: string): Promise<void> {
	await db.prepare(
		'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
	).bind(key, value).run();
}

// ── Chats ─────────────────────────────────────────────────────────────────────

export interface DbChat {
	name: string;
	chat_id: string;
	type: string;
	is_default: number;
	created_at: number;
}

export async function getChats(db: D1Database): Promise<DbChat[]> {
	const result = await db.prepare('SELECT * FROM chats ORDER BY created_at ASC').all<DbChat>();
	return result.results;
}

export async function getChatByName(db: D1Database, name: string): Promise<DbChat | null> {
	return db.prepare('SELECT * FROM chats WHERE name = ?').bind(name).first<DbChat>();
}

export async function getDefaultChat(db: D1Database): Promise<DbChat | null> {
	return db.prepare('SELECT * FROM chats WHERE is_default = 1 LIMIT 1').first<DbChat>();
}

export async function upsertChat(
	db: D1Database,
	name: string,
	chatId: string,
	type: string,
	makeDefault: boolean,
): Promise<DbChat> {
	const now = Math.floor(Date.now() / 1000);
	if (makeDefault) {
		await db.batch([
			db.prepare('UPDATE chats SET is_default = 0 WHERE is_default = 1'),
			db.prepare(
				`INSERT INTO chats (name, chat_id, type, is_default, created_at) VALUES (?, ?, ?, 1, ?)
				 ON CONFLICT(name) DO UPDATE SET chat_id = excluded.chat_id, type = excluded.type, is_default = 1`,
			).bind(name, chatId, type, now),
		]);
	} else {
		await db.prepare(
			`INSERT INTO chats (name, chat_id, type, is_default, created_at) VALUES (?, ?, ?, 0, ?)
			 ON CONFLICT(name) DO UPDATE SET chat_id = excluded.chat_id, type = excluded.type`,
		).bind(name, chatId, type, now).run();
	}
	return { name, chat_id: chatId, type, is_default: makeDefault ? 1 : 0, created_at: now };
}

export async function removeChat(db: D1Database, name: string): Promise<void> {
	await db.prepare('DELETE FROM chats WHERE name = ?').bind(name).run();
}

export async function setDefaultChat(db: D1Database, name: string): Promise<void> {
	await db.batch([
		db.prepare('UPDATE chats SET is_default = 0 WHERE is_default = 1'),
		db.prepare('UPDATE chats SET is_default = 1 WHERE name = ?').bind(name),
	]);
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export interface DbNote {
	id: string;
	content: string;
	tags: string;          // JSON string[]
	ref_item_id: string | null;
	ref_chat: string | null;
	created_at: number;
}

export async function insertNote(db: D1Database, opts: {
	content: string;
	tags?: string[];
	refItemId?: string;
	refChat?: string;
}): Promise<DbNote> {
	const id = genId();
	const now = Math.floor(Date.now() / 1000);
	const tags = JSON.stringify(opts.tags ?? []);
	await db.prepare(
		'INSERT INTO notes (id, content, tags, ref_item_id, ref_chat, created_at) VALUES (?, ?, ?, ?, ?, ?)',
	).bind(id, opts.content, tags, opts.refItemId ?? null, opts.refChat ?? null, now).run();
	return { id, content: opts.content, tags, ref_item_id: opts.refItemId ?? null, ref_chat: opts.refChat ?? null, created_at: now };
}

export async function listNotes(db: D1Database, limit = 50, tag?: string): Promise<DbNote[]> {
	if (tag) {
		const result = await db.prepare(
			`SELECT * FROM notes WHERE tags LIKE ? ORDER BY created_at DESC LIMIT ?`,
		).bind(`%"${tag}"%`, limit).all<DbNote>();
		return result.results;
	}
	const result = await db.prepare('SELECT * FROM notes ORDER BY created_at DESC LIMIT ?').bind(limit).all<DbNote>();
	return result.results;
}

export async function searchNotes(db: D1Database, query: string, limit = 50): Promise<DbNote[]> {
	const result = await db.prepare(
		'SELECT * FROM notes WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?',
	).bind(`%${query}%`, limit).all<DbNote>();
	return result.results;
}

export async function deleteNote(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
}

// ── Post log ──────────────────────────────────────────────────────────────────

export interface DbPostLog {
	id: string;
	item_id: string | null;
	chat_name: string | null;
	chat_id: string;
	message_type: string;
	caption_preview: string;
	status: string;
	error: string | null;
	posted_at: number;
}

export async function insertPostLog(db: D1Database, opts: {
	itemId?: string;
	chatName?: string;
	chatId: string;
	messageType: string;
	captionPreview: string;
	status: 'ok' | 'error';
	error?: string;
}): Promise<void> {
	const id = genId();
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		`INSERT INTO post_log (id, item_id, chat_name, chat_id, message_type, caption_preview, status, error, posted_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).bind(
		id,
		opts.itemId ?? null,
		opts.chatName ?? null,
		opts.chatId,
		opts.messageType,
		opts.captionPreview.slice(0, 200),
		opts.status,
		opts.error ?? null,
		now,
	).run();
}

export async function listPostLog(
	db: D1Database,
	limit = 50,
	filter?: { itemId?: string; chatId?: string },
): Promise<DbPostLog[]> {
	let sql = 'SELECT * FROM post_log';
	const params: unknown[] = [];
	const where: string[] = [];
	if (filter?.itemId) { where.push('item_id = ?'); params.push(filter.itemId); }
	if (filter?.chatId) { where.push('chat_id = ?'); params.push(filter.chatId); }
	if (where.length) sql += ' WHERE ' + where.join(' AND ');
	sql += ' ORDER BY posted_at DESC LIMIT ?';
	params.push(limit);
	const result = await db.prepare(sql).bind(...params).all<DbPostLog>();
	return result.results;
}

// ── AI summary helpers ────────────────────────────────────────────────────────

export type AiSummarySetting = 'enable' | 'disable' | 'inherit';

/** Store (or update) the AI-generated summary for an item. */
export async function updateItemSummary(
	db: D1Database,
	feedId: string,
	itemId: string,
	summary: string,
): Promise<void> {
	await db.prepare('UPDATE items SET summary = ? WHERE feed_id = ? AND id = ?')
		.bind(summary, feedId, itemId).run();
}

/**
 * Get the AI summary setting for a channel or source.
 * key is either "{channelId}" (channel level) or "{channelId}:{sourceId}" (source level).
 */
export async function getChannelAiSummary(
	db: D1Database,
	key: string,
): Promise<AiSummarySetting> {
	const row = await db.prepare('SELECT ai_summary FROM channel_ai_settings WHERE channel_id = ?')
		.bind(key).first<{ ai_summary: string }>();
	return (row?.ai_summary ?? 'inherit') as AiSummarySetting;
}

/** Upsert the AI summary setting for a channel or source. */
export async function setChannelAiSummary(
	db: D1Database,
	key: string,
	value: AiSummarySetting,
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		`INSERT INTO channel_ai_settings (channel_id, ai_summary, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(channel_id) DO UPDATE SET ai_summary = excluded.ai_summary, updated_at = excluded.updated_at`,
	).bind(key, value, now).run();
}

/** Get the AI summary setting for a D1-registered feed. */
export async function getFeedAiSummary(db: D1Database, feedId: string): Promise<AiSummarySetting> {
	const row = await db.prepare('SELECT ai_summary FROM feeds WHERE id = ?')
		.bind(feedId).first<{ ai_summary: string }>();
	return (row?.ai_summary ?? 'inherit') as AiSummarySetting;
}

/** Update the AI summary setting for a D1-registered feed. */
export async function setFeedAiSummary(
	db: D1Database,
	feedId: string,
	value: AiSummarySetting,
): Promise<void> {
	await db.prepare('UPDATE feeds SET ai_summary = ? WHERE id = ?').bind(value, feedId).run();
}

export interface ChannelAiRow {
	ai_summary: AiSummarySetting;
	ai_model: string | null;
	ai_prompt: string | null;
}

/** Fetch all AI settings for a channel or source key in one query. */
export async function getChannelAiRow(db: D1Database, key: string): Promise<ChannelAiRow> {
	const row = await db.prepare(
		'SELECT ai_summary, ai_model, ai_prompt FROM channel_ai_settings WHERE channel_id = ?',
	).bind(key).first<{ ai_summary: string; ai_model: string | null; ai_prompt: string | null }>();
	return {
		ai_summary: (row?.ai_summary ?? 'inherit') as AiSummarySetting,
		ai_model: row?.ai_model ?? null,
		ai_prompt: row?.ai_prompt ?? null,
	};
}

/** Upsert only the ai_model column for a channel or source key. */
export async function setChannelAiModel(db: D1Database, key: string, model: string | null): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		`INSERT INTO channel_ai_settings (channel_id, ai_model, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(channel_id) DO UPDATE SET ai_model = excluded.ai_model, updated_at = excluded.updated_at`,
	).bind(key, model, now).run();
}

/** Upsert only the ai_prompt column for a channel or source key. */
export async function setChannelAiPrompt(db: D1Database, key: string, prompt: string | null): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		`INSERT INTO channel_ai_settings (channel_id, ai_prompt, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(channel_id) DO UPDATE SET ai_prompt = excluded.ai_prompt, updated_at = excluded.updated_at`,
	).bind(key, prompt, now).run();
}

/**
 * Resolve effective model: source → channel → global config key → null (caller uses DEFAULT_MODEL).
 */
export async function resolveAiModel(
	db: D1Database,
	channelId: string,
	sourceId?: string,
): Promise<string | null> {
	if (sourceId) {
		const src = await db.prepare('SELECT ai_model FROM channel_ai_settings WHERE channel_id = ?')
			.bind(`${channelId}:${sourceId}`).first<{ ai_model: string | null }>();
		if (src?.ai_model) return src.ai_model;
	}
	const ch = await db.prepare('SELECT ai_model FROM channel_ai_settings WHERE channel_id = ?')
		.bind(channelId).first<{ ai_model: string | null }>();
	if (ch?.ai_model) return ch.ai_model;
	const global = await getConfig(db, 'ai_model');
	return global || null;
}

/**
 * Resolve effective prompt: source → channel → global config key → null (caller uses SYSTEM_PROMPT).
 */
export async function resolveAiPrompt(
	db: D1Database,
	channelId: string,
	sourceId?: string,
): Promise<string | null> {
	if (sourceId) {
		const src = await db.prepare('SELECT ai_prompt FROM channel_ai_settings WHERE channel_id = ?')
			.bind(`${channelId}:${sourceId}`).first<{ ai_prompt: string | null }>();
		if (src?.ai_prompt) return src.ai_prompt;
	}
	const ch = await db.prepare('SELECT ai_prompt FROM channel_ai_settings WHERE channel_id = ?')
		.bind(channelId).first<{ ai_prompt: string | null }>();
	if (ch?.ai_prompt) return ch.ai_prompt;
	const global = await getConfig(db, 'ai_prompt');
	return global || null;
}

/**
 * Resolve the effective AI summary enabled state for a bot channel/source.
 * Resolution order: source level → channel level → global default.
 */
export async function resolveAiSummaryEnabled(
	db: D1Database,
	channelId: string,
	sourceId?: string,
): Promise<boolean> {
	// Source-level override
	if (sourceId) {
		const src = await db.prepare('SELECT ai_summary FROM channel_ai_settings WHERE channel_id = ?')
			.bind(`${channelId}:${sourceId}`).first<{ ai_summary: string }>();
		if (src && src.ai_summary !== 'inherit') return src.ai_summary === 'enable';
	}
	// Channel-level override
	const ch = await db.prepare('SELECT ai_summary FROM channel_ai_settings WHERE channel_id = ?')
		.bind(channelId).first<{ ai_summary: string }>();
	if (ch && ch.ai_summary !== 'inherit') return ch.ai_summary === 'enable';
	// Global default (disabled by default)
	const global = await getConfig(db, 'ai_summary_enabled');
	return global === '1';
}

// ── Recall (unified timeline) ─────────────────────────────────────────────────

export interface RecallEntry {
	kind: 'note' | 'post';
	id: string;
	when: number;           // created_at for notes, posted_at for posts
	summary: string;        // content for notes, caption_preview for posts
	tags: string[];         // parsed; always [] for posts
	itemId: string | null;
	chatId: string | null;
	chatName: string | null;
	messageType: string | null;
	status: string | null;
}

export async function recall(db: D1Database, limit = 50, since?: number): Promise<RecallEntry[]> {
	const whereNotes = since ? 'WHERE created_at >= ?' : '';
	const wherePosts = since ? 'WHERE posted_at >= ?' : '';
	const params: unknown[] = since ? [since, since, limit] : [limit];
	const sql = `
		SELECT 'note' AS kind, id, created_at AS when_ts, content AS summary,
		       tags, ref_item_id AS item_id, ref_chat AS chat_id, NULL AS chat_name,
		       NULL AS message_type, NULL AS status
		FROM notes
		${whereNotes}
		UNION ALL
		SELECT 'post', id, posted_at, caption_preview, '[]', item_id, chat_id, chat_name,
		       message_type, status
		FROM post_log
		${wherePosts}
		ORDER BY when_ts DESC
		LIMIT ?
	`;
	type Raw = {
		kind: string;
		id: string;
		when_ts: number;
		summary: string;
		tags: string;
		item_id: string | null;
		chat_id: string | null;
		chat_name: string | null;
		message_type: string | null;
		status: string | null;
	};
	const result = await db.prepare(sql).bind(...params).all<Raw>();
	return result.results.map(row => ({
		kind: row.kind as 'note' | 'post',
		id: row.id,
		when: row.when_ts,
		summary: row.summary,
		tags: parseJsonSafe<string[]>(row.tags, []),
		itemId: row.item_id,
		chatId: row.chat_id,
		chatName: row.chat_name,
		messageType: row.message_type,
		status: row.status,
	}));
}

// ── Core consumers: channels + subscriptions (migration 0005) ─────────────────
// One core `feeds` table feeds two typed consumers. Each consumer owns its own
// subscription table; they share the content pipe, never each other's view.
//   Telegram consumer : channels + telegram_subscriptions; dedup via post_log
//   MCP consumer       : mcp_subscriptions; dedup via items.read (global cursor)

export interface DbChannel {
	id: string;                      // numeric Telegram chat id, as text
	name: string;
	enabled: number;
	check_interval_minutes: number;
	default_format: string | null;  // JSON Partial<FormatSettings>
	last_check_timestamp: number;
	created_at: number;
}

export interface DbTelegramSubscription {
	id: string;
	feed_id: string;
	channel_id: string;
	media_filter: string;
	format: string | null;          // JSON Partial<FormatSettings>
	enabled: number;
	created_at: number;
}

export interface DbMcpSubscription {
	id: string;
	feed_id: string;
	label: string | null;
	enabled: number;
	created_at: number;
}

// ── Channels ──────────────────────────────────────────────────────────────────

export async function getChannels(db: D1Database): Promise<DbChannel[]> {
	const result = await db.prepare('SELECT * FROM channels ORDER BY created_at ASC').all<DbChannel>();
	return result.results;
}

export async function getChannelById(db: D1Database, id: string): Promise<DbChannel | null> {
	return db.prepare('SELECT * FROM channels WHERE id = ?').bind(id).first<DbChannel>();
}

/** Insert or update a channel by its (numeric) Telegram id. */
export async function upsertChannel(
	db: D1Database,
	opts: {
		id: string;
		name?: string;
		enabled?: boolean;
		checkIntervalMinutes?: number;
		defaultFormat?: Partial<FormatSettings> | null;
		lastCheckTimestamp?: number;
	},
): Promise<void> {
	const now = Math.floor(Date.now() / 1000);
	const format = opts.defaultFormat === undefined || opts.defaultFormat === null
		? null
		: JSON.stringify(opts.defaultFormat);
	await db.prepare(
		`INSERT INTO channels (id, name, enabled, check_interval_minutes, default_format, last_check_timestamp, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			enabled = excluded.enabled,
			check_interval_minutes = excluded.check_interval_minutes,
			default_format = excluded.default_format,
			last_check_timestamp = excluded.last_check_timestamp`,
	).bind(
		opts.id,
		opts.name ?? '',
		opts.enabled === false ? 0 : 1,
		opts.checkIntervalMinutes ?? 60,
		format,
		opts.lastCheckTimestamp ?? 0,
		now,
	).run();
}

export async function removeChannel(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM channels WHERE id = ?').bind(id).run();
}

export async function setChannelEnabled(db: D1Database, id: string, enabled: boolean): Promise<void> {
	await db.prepare('UPDATE channels SET enabled = ? WHERE id = ?').bind(enabled ? 1 : 0, id).run();
}

export async function updateChannelLastCheck(db: D1Database, id: string, timestamp: number): Promise<void> {
	await db.prepare('UPDATE channels SET last_check_timestamp = ? WHERE id = ?').bind(timestamp, id).run();
}

// ── Telegram subscriptions ────────────────────────────────────────────────────

export async function getTelegramSubscriptions(db: D1Database, channelId?: string): Promise<DbTelegramSubscription[]> {
	if (channelId) {
		const result = await db.prepare('SELECT * FROM telegram_subscriptions WHERE channel_id = ? ORDER BY created_at ASC')
			.bind(channelId).all<DbTelegramSubscription>();
		return result.results;
	}
	const result = await db.prepare('SELECT * FROM telegram_subscriptions ORDER BY created_at ASC')
		.all<DbTelegramSubscription>();
	return result.results;
}

export async function getTelegramSubscriptionsByFeed(db: D1Database, feedId: string): Promise<DbTelegramSubscription[]> {
	const result = await db.prepare('SELECT * FROM telegram_subscriptions WHERE feed_id = ? AND enabled = 1')
		.bind(feedId).all<DbTelegramSubscription>();
	return result.results;
}

/** Subscribe a Telegram channel to a core feed (idempotent on channel_id+feed_id). */
export async function addTelegramSubscription(
	db: D1Database,
	opts: { channelId: string; feedId: string; mediaFilter?: FeedMediaFilter; format?: Partial<FormatSettings> | null },
): Promise<void> {
	const id = genId();
	const now = Math.floor(Date.now() / 1000);
	const format = opts.format === undefined || opts.format === null ? null : JSON.stringify(opts.format);
	await db.prepare(
		`INSERT INTO telegram_subscriptions (id, feed_id, channel_id, media_filter, format, enabled, created_at)
		 VALUES (?, ?, ?, ?, ?, 1, ?)
		 ON CONFLICT(channel_id, feed_id) DO UPDATE SET
			media_filter = excluded.media_filter,
			format = excluded.format`,
	).bind(id, opts.feedId, opts.channelId, opts.mediaFilter ?? 'all', format, now).run();
}

export async function removeTelegramSubscription(db: D1Database, channelId: string, feedId: string): Promise<void> {
	await db.prepare('DELETE FROM telegram_subscriptions WHERE channel_id = ? AND feed_id = ?')
		.bind(channelId, feedId).run();
}

export async function setTelegramSubscriptionEnabled(
	db: D1Database,
	channelId: string,
	feedId: string,
	enabled: boolean,
): Promise<void> {
	await db.prepare('UPDATE telegram_subscriptions SET enabled = ? WHERE channel_id = ? AND feed_id = ?')
		.bind(enabled ? 1 : 0, channelId, feedId).run();
}

// ── MCP subscriptions ─────────────────────────────────────────────────────────

export async function getMcpSubscriptions(db: D1Database): Promise<DbMcpSubscription[]> {
	const result = await db.prepare('SELECT * FROM mcp_subscriptions WHERE enabled = 1 ORDER BY created_at ASC')
		.all<DbMcpSubscription>();
	return result.results;
}

/** Feed ids the MCP workspace is subscribed to (enabled only). */
export async function getMcpSubscribedFeedIds(db: D1Database): Promise<string[]> {
	const result = await db.prepare('SELECT feed_id FROM mcp_subscriptions WHERE enabled = 1')
		.all<{ feed_id: string }>();
	return result.results.map(r => r.feed_id);
}

/** Subscribe the MCP workspace to a core feed (idempotent on feed_id). */
export async function addMcpSubscription(db: D1Database, feedId: string, label?: string): Promise<void> {
	const id = genId();
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		`INSERT INTO mcp_subscriptions (id, feed_id, label, enabled, created_at)
		 VALUES (?, ?, ?, 1, ?)
		 ON CONFLICT(feed_id) DO UPDATE SET label = excluded.label, enabled = 1`,
	).bind(id, feedId, label ?? null, now).run();
}

export async function removeMcpSubscription(db: D1Database, feedId: string): Promise<void> {
	await db.prepare('DELETE FROM mcp_subscriptions WHERE feed_id = ?').bind(feedId).run();
}

// ── Telegram dedup (post_log) ─────────────────────────────────────────────────

/**
 * Has this item already been successfully posted to this chat? Backed by the
 * idx_postlog_chat_item index. Only `status = 'ok'` rows count, so a failed
 * send is retried on the next cycle.
 */
export async function wasPostedToChannel(db: D1Database, chatId: string, itemId: string): Promise<boolean> {
	const row = await db.prepare(
		`SELECT 1 FROM post_log WHERE chat_id = ? AND item_id = ? AND status = 'ok' LIMIT 1`,
	).bind(chatId, itemId).first();
	return row !== null;
}

// ── D1 ChannelConfig facade ───────────────────────────────────────────────────
// Bridges the KV-era ChannelConfig shape to D1 so the ~16 bot command/callback
// files can be migrated with minimal churn. The source `id` is always the feed
// UUID (stable, unique per core feed) when read back from D1.

/** Reconstruct a KV-era ChannelConfig from D1 (channels + telegram_subscriptions + feeds). */
export async function getChannelConfigFromD1(db: D1Database, channelId: string): Promise<ChannelConfig | null> {
	const channel = await getChannelById(db, channelId);
	if (!channel) return null;

	const subs = await getTelegramSubscriptions(db, channelId);
	const sources: ChannelSource[] = [];
	for (const sub of subs) {
		const feed = await getFeedById(db, sub.feed_id);
		if (feed) sources.push(dbTelegramSubToChannelSource(sub, feed));
	}

	return {
		channelTitle: channel.name,
		enabled: channel.enabled === 1,
		checkIntervalMinutes: channel.check_interval_minutes,
		lastCheckTimestamp: channel.last_check_timestamp,
		sources,
		defaultFormat: channel.default_format
			? parseJsonSafe<Partial<FormatSettings>>(channel.default_format, {})
			: undefined,
	};
}

/**
 * Write a KV-era ChannelConfig back to D1.
 * Syncs the channels row and telegram_subscriptions (upserts new, removes deleted).
 * Sources are always resolved by (source_type, source_value) → canonical feed.id,
 * so shortHash-based ids from bot flows are transparently replaced by feed UUIDs.
 */
export async function saveChannelConfigToD1(
	db: D1Database,
	channelId: string,
	config: ChannelConfig,
): Promise<void> {
	await upsertChannel(db, {
		id: channelId,
		name: config.channelTitle,
		enabled: config.enabled,
		checkIntervalMinutes: config.checkIntervalMinutes,
		defaultFormat: config.defaultFormat ?? null,
		lastCheckTimestamp: config.lastCheckTimestamp,
	});

	const existingSubs = await getTelegramSubscriptions(db, channelId);
	const newFeedIds = new Set<string>();

	for (const source of config.sources) {
		const feed = await upsertFeedBySource(db, {
			sourceType: source.type as SourceType,
			sourceValue: source.value,
		});
		newFeedIds.add(feed.id);
		await addTelegramSubscription(db, {
			channelId,
			feedId: feed.id,
			mediaFilter: source.mediaFilter,
			format: source.format ?? null,
		});
		if (!source.enabled) {
			await setTelegramSubscriptionEnabled(db, channelId, feed.id, false);
		} else {
			await setTelegramSubscriptionEnabled(db, channelId, feed.id, true);
		}
	}

	for (const sub of existingSubs) {
		if (!newFeedIds.has(sub.feed_id)) {
			await removeTelegramSubscription(db, channelId, sub.feed_id);
		}
	}
}

/** Return all D1 channel IDs — replaces getChannelsList(kv). */
export async function getChannelsListD1(db: D1Database): Promise<string[]> {
	const channels = await getChannels(db);
	return channels.map(c => c.id);
}

/** Find a channel ID by its stored name (case-insensitive) — replaces findChannelByName(kv, name). */
export async function findChannelByNameD1(db: D1Database, name: string): Promise<string | null> {
	const clean = name.replace(/^@/, '').toLowerCase();
	const channels = await getChannels(db);
	const found = channels.find(
		c => c.name.toLowerCase() === clean || c.name.toLowerCase() === `@${clean}`,
	);
	return found?.id ?? null;
}

// ── Mapper: telegram_subscription (+ feed) → ChannelSource ────────────────────
// Bridges the D1 core-feeds world back to the KV-era `ChannelSource` shape so
// the existing Telegram formatting/fetch code can stay unchanged. The source id
// is the feed id (stable, unique per core feed).
export function dbTelegramSubToChannelSource(
	sub: DbTelegramSubscription,
	feed: Pick<DbFeed, 'source_type' | 'source_value'>,
): ChannelSource {
	return {
		id: sub.feed_id,
		type: feed.source_type as SourceType,
		value: feed.source_value,
		mediaFilter: sub.media_filter as FeedMediaFilter,
		enabled: sub.enabled === 1,
		format: sub.format ? parseJsonSafe<Partial<FormatSettings>>(sub.format, {}) : undefined,
	};
}

