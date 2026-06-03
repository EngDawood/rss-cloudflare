import type { FeedItem, FeedItemMedia, FeedItemMediaType } from '../types/feed';

// ── D1 row shapes ────────────────────────────────────────────────────────────

export interface DbFeed {
	id: string;
	url: string;
	title: string;
	enabled: number;
	last_fetched_at: number | null;
	created_at: number;
}

export interface DbFeedWithCounts extends DbFeed {
	total_count: number;
	unread_count: number;
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
	};
}

// ── Feed CRUD ─────────────────────────────────────────────────────────────────

export async function getFeeds(db: D1Database): Promise<DbFeedWithCounts[]> {
	const result = await db.prepare(`
		SELECT f.*,
			COUNT(i.id) as total_count,
			SUM(CASE WHEN i.read = 0 THEN 1 ELSE 0 END) as unread_count
		FROM feeds f
		LEFT JOIN items i ON i.feed_id = f.id
		GROUP BY f.id
		ORDER BY f.created_at ASC
	`).all<DbFeedWithCounts>();
	return result.results;
}

export async function getFeedById(db: D1Database, feedId: string): Promise<DbFeed | null> {
	return db.prepare('SELECT * FROM feeds WHERE id = ?').bind(feedId).first<DbFeed>();
}

export async function getFeedByUrl(db: D1Database, url: string): Promise<DbFeed | null> {
	return db.prepare('SELECT * FROM feeds WHERE url = ?').bind(url).first<DbFeed>();
}

export async function insertFeed(db: D1Database, url: string, title: string): Promise<DbFeed> {
	const id = genId();
	const now = Math.floor(Date.now() / 1000);
	await db.prepare(
		'INSERT INTO feeds (id, url, title, enabled, created_at) VALUES (?, ?, ?, 1, ?)'
	).bind(id, url, title, now).run();
	return { id, url, title, enabled: 1, last_fetched_at: null, created_at: now };
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
		feedId?: string;
		limit?: number;
		query?: string;
		since?: number;
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { feedId, limit = 50, query, since } = opts ?? {};

	const where: string[] = ['i.read = 0'];
	const params: unknown[] = [];

	if (feedId) { where.push('i.feed_id = ?'); params.push(feedId); }
	if (query) {
		const like = `%${query}%`;
		where.push('(i.title LIKE ? OR i.text LIKE ? OR i.author LIKE ?)');
		params.push(like, like, like);
	}
	if (since) { where.push('i.timestamp >= ?'); params.push(since); }

	params.push(limit);
	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp,
		       f.title as feed_title, f.url as feed_url
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

export async function searchItems(
	db: D1Database,
	opts: {
		query: string;
		feedId?: string;
		since?: number;
		unreadOnly?: boolean;
		limit?: number;
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { query, feedId, since, unreadOnly = false, limit = 50 } = opts;

	const like = `%${query}%`;
	const where: string[] = ['(i.title LIKE ? OR i.text LIKE ? OR i.author LIKE ?)'];
	const params: unknown[] = [like, like, like];

	if (unreadOnly) { where.push('i.read = 0'); }
	if (feedId) { where.push('i.feed_id = ?'); params.push(feedId); }
	if (since) { where.push('i.timestamp >= ?'); params.push(since); }

	params.push(limit);
	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp,
		       f.title as feed_title, f.url as feed_url
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
