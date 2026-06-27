import type { FeedItem } from '../types/feed';
import { parseJsonSafe } from './base';
import type { DbItem, DbItemCompact } from './base';
import { getMcpSubscribedFeedIds } from './feeds';

// ── Item CRUD ─────────────────────────────────────────────────────────────────

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
		orderBy?: 'newest_published' | 'oldest_published' | 'newly_added' | 'oldest_added';
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { feedId, limit = 50, query, since, unreadOnly = true, readOnly = false, orderBy = 'newest_published' } = opts ?? {};

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

	let orderByClause = 'i.timestamp DESC';
	if (orderBy === 'oldest_published') {
		orderByClause = 'i.timestamp ASC';
	} else if (orderBy === 'newly_added') {
		orderByClause = 'i.fetched_at DESC';
	} else if (orderBy === 'oldest_added') {
		orderByClause = 'i.fetched_at ASC';
	}

	params.push(limit);
	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp, i.read,
		       f.title as feed_title, f.source_value as feed_url
		FROM items i JOIN feeds f ON f.id = i.feed_id
		WHERE ${where.length ? where.join(' AND ') : '1=1'}
		ORDER BY ${orderByClause} LIMIT ?
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
		orderBy?: 'newest_published' | 'oldest_published' | 'newly_added' | 'oldest_added';
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { query, feedId, since, unreadOnly = false, readOnly = false, limit = 50, orderBy = 'newest_published' } = opts;

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

	let orderByClause = 'i.timestamp DESC';
	if (orderBy === 'oldest_published') {
		orderByClause = 'i.timestamp ASC';
	} else if (orderBy === 'newly_added') {
		orderByClause = 'i.fetched_at DESC';
	} else if (orderBy === 'oldest_added') {
		orderByClause = 'i.fetched_at ASC';
	}

	params.push(limit);
	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp, i.read,
		       f.title as feed_title, f.source_value as feed_url
		FROM items i JOIN feeds f ON f.id = i.feed_id
		WHERE ${where.join(' AND ')}
		ORDER BY ${orderByClause} LIMIT ?
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

// ── MCP browse: per-consumer read cursor + subscription scoping ──────────────────

/** Mark items read/unread for the MCP workspace only (writes to `mcp_read`). */
export async function markMcpItemsRead(db: D1Database, ids: string[], read: boolean): Promise<void> {
	if (ids.length === 0) return;
	const now = Math.floor(Date.now() / 1000);
	const stmts = ids.map(id =>
		read
			? db.prepare('INSERT INTO mcp_read (item_id, read_at) VALUES (?, ?) ON CONFLICT(item_id) DO NOTHING').bind(id, now)
			: db.prepare('DELETE FROM mcp_read WHERE item_id = ?').bind(id),
	);
	await db.batch(stmts);
}

/**
 * Effective MCP feed scope: subscribed feeds, optionally intersected with a
 * caller-requested feedId / feedId[]. Returns [] when nothing matches.
 */
async function resolveMcpFeedScope(db: D1Database, feedId?: string | string[]): Promise<string[]> {
	const subscribed = await getMcpSubscribedFeedIds(db);
	if (subscribed.length === 0) return [];
	if (!feedId) return subscribed;
	const requested = Array.isArray(feedId) ? feedId : [feedId];
	return subscribed.filter(id => requested.includes(id));
}

export async function listNewItemsMcp(
	db: D1Database,
	opts?: {
		feedId?: string | string[];
		limit?: number;
		query?: string;
		since?: number;
		unreadOnly?: boolean;
		orderBy?: 'newest_published' | 'oldest_published' | 'newly_added' | 'oldest_added';
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { feedId, limit = 50, query, since, unreadOnly = true, orderBy = 'newest_published' } = opts ?? {};

	const feedIds = await resolveMcpFeedScope(db, feedId);
	if (feedIds.length === 0) return [];

	const placeholders = feedIds.map(() => '?').join(',');
	const where: string[] = [`i.feed_id IN (${placeholders})`];
	const params: unknown[] = [...feedIds];
	if (unreadOnly) where.push('mr.item_id IS NULL');
	if (query) {
		const like = `%${query}%`;
		where.push('(i.title LIKE ? OR i.text LIKE ? OR i.author LIKE ?)');
		params.push(like, like, like);
	}
	if (since) { where.push('i.timestamp >= ?'); params.push(since); }

	let orderByClause = 'i.timestamp DESC';
	if (orderBy === 'oldest_published') {
		orderByClause = 'i.timestamp ASC';
	} else if (orderBy === 'newly_added') {
		orderByClause = 'i.fetched_at DESC';
	} else if (orderBy === 'oldest_added') {
		orderByClause = 'i.fetched_at ASC';
	}

	params.push(limit);

	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp,
		       (CASE WHEN mr.item_id IS NOT NULL THEN 1 ELSE 0 END) as read,
		       f.title as feed_title, f.source_value as feed_url
		FROM items i
		JOIN feeds f ON f.id = i.feed_id
		LEFT JOIN mcp_read mr ON mr.item_id = i.id
		WHERE ${where.join(' AND ')}
		ORDER BY ${orderByClause} LIMIT ?
	`;
	const result = await db.prepare(sql).bind(...params).all<Raw>();
	return result.results.map(row => ({ ...row, topics: parseJsonSafe<string[]>(row.topics, []) }));
}

export async function searchItemsMcp(
	db: D1Database,
	opts: {
		query: string;
		feedId?: string | string[];
		since?: number;
		unreadOnly?: boolean;
		limit?: number;
		orderBy?: 'newest_published' | 'oldest_published' | 'newly_added' | 'oldest_added';
	},
): Promise<DbItemCompact[]> {
	type Raw = Omit<DbItemCompact, 'topics'> & { topics: string };
	const { query, feedId, since, unreadOnly = false, limit = 50, orderBy = 'newest_published' } = opts;

	const feedIds = await resolveMcpFeedScope(db, feedId);
	if (feedIds.length === 0) return [];

	const like = `%${query}%`;
	const placeholders = feedIds.map(() => '?').join(',');
	const where: string[] = ['(i.title LIKE ? OR i.text LIKE ? OR i.author LIKE ?)', `i.feed_id IN (${placeholders})`];
	const params: unknown[] = [like, like, like, ...feedIds];
	if (unreadOnly) where.push('mr.item_id IS NULL');
	if (since) { where.push('i.timestamp >= ?'); params.push(since); }

	let orderByClause = 'i.timestamp DESC';
	if (orderBy === 'oldest_published') {
		orderByClause = 'i.timestamp ASC';
	} else if (orderBy === 'newly_added') {
		orderByClause = 'i.fetched_at DESC';
	} else if (orderBy === 'oldest_added') {
		orderByClause = 'i.fetched_at ASC';
	}

	params.push(limit);

	const sql = `
		SELECT i.feed_id, i.id, i.title, i.link, i.author, i.topics, i.timestamp,
		       (CASE WHEN mr.item_id IS NOT NULL THEN 1 ELSE 0 END) as read,
		       f.title as feed_title, f.source_value as feed_url
		FROM items i
		JOIN feeds f ON f.id = i.feed_id
		LEFT JOIN mcp_read mr ON mr.item_id = i.id
		WHERE ${where.join(' AND ')}
		ORDER BY ${orderByClause} LIMIT ?
	`;
	const result = await db.prepare(sql).bind(...params).all<Raw>();
	return result.results.map(row => ({ ...row, topics: parseJsonSafe<string[]>(row.topics, []) }));
}

// ── RSS bundle item query ─────────────────────────────────────────────────────

export interface DbItemForRss extends DbItem {
	feed_title: string;
	feed_url: string;
}

export async function getItemsForFeeds(
	db: D1Database,
	feedIds: string[],
	limit = 50,
): Promise<DbItemForRss[]> {
	if (feedIds.length === 0) return [];
	const placeholders = feedIds.map(() => '?').join(',');
	const result = await db.prepare(`
		SELECT i.*, f.title AS feed_title, f.source_value AS feed_url
		FROM items i
		JOIN feeds f ON f.id = i.feed_id
		WHERE i.feed_id IN (${placeholders})
		ORDER BY i.timestamp DESC
		LIMIT ?
	`).bind(...feedIds, limit).all<DbItemForRss>();
	return result.results;
}

/** Get a stored item by id, but only if its feed is within the MCP scope. */
export async function getItemByIdMcp(db: D1Database, id: string): Promise<DbItem | null> {
	const feedIds = await getMcpSubscribedFeedIds(db);
	if (feedIds.length === 0) return null;
	const placeholders = feedIds.map(() => '?').join(',');
	return db.prepare(`SELECT * FROM items WHERE id = ? AND feed_id IN (${placeholders}) LIMIT 1`)
		.bind(id, ...feedIds).first<DbItem>();
}
