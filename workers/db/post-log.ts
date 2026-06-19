import { genId, parseJsonSafe } from './base';

// ── Post log CRUD ─────────────────────────────────────────────────────────────

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

/**
 * Has this item already been successfully posted to this chat?
 */
export async function wasPostedToChannel(db: D1Database, chatId: string, itemId: string): Promise<boolean> {
	const row = await db.prepare(
		`SELECT 1 FROM post_log WHERE chat_id = ? AND item_id = ? AND status = 'ok' LIMIT 1`,
	).bind(chatId, itemId).first();
	return row !== null;
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
