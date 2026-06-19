import { genId } from './base';

// ── Notes CRUD ────────────────────────────────────────────────────────────────

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
