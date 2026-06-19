// ── Chats CRUD ────────────────────────────────────────────────────────────────

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
