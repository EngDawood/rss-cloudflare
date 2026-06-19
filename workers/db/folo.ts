// ── Folo webhook channel subscriptions ───────────────────────────────────────

export async function getFoloChannelIds(db: D1Database): Promise<string[]> {
	const result = await db.prepare('SELECT channel_id FROM folo_channels ORDER BY created_at ASC').all<{ channel_id: string }>();
	return result.results.map(r => r.channel_id);
}

export async function addFoloChannel(db: D1Database, channelId: string): Promise<void> {
	await db.prepare('INSERT OR IGNORE INTO folo_channels (channel_id) VALUES (?)').bind(channelId).run();
}

export async function removeFoloChannel(db: D1Database, channelId: string): Promise<void> {
	await db.prepare('DELETE FROM folo_channels WHERE channel_id = ?').bind(channelId).run();
}

// ── Folo named webhooks ──────────────────────────────────────────────────────

export interface FoloWebhookRecord {
	id: string;
	name: string;
	token: string | null;
	created_at: number;
}

export async function createFoloWebhook(db: D1Database, id: string, name: string, token?: string): Promise<FoloWebhookRecord> {
	await db.prepare('INSERT INTO folo_webhooks (id, name, token) VALUES (?, ?, ?)')
		.bind(id, name, token ?? null).run();
	return { id, name, token: token ?? null, created_at: Math.floor(Date.now() / 1000) };
}

export async function listFoloWebhooks(db: D1Database): Promise<FoloWebhookRecord[]> {
	const result = await db.prepare('SELECT * FROM folo_webhooks ORDER BY created_at ASC').all<FoloWebhookRecord>();
	return result.results;
}

export async function getFoloWebhook(db: D1Database, id: string): Promise<FoloWebhookRecord | null> {
	const result = await db.prepare('SELECT * FROM folo_webhooks WHERE id = ?').bind(id).first<FoloWebhookRecord>();
	return result ?? null;
}

export async function deleteFoloWebhook(db: D1Database, id: string): Promise<void> {
	await db.prepare('DELETE FROM folo_webhooks WHERE id = ?').bind(id).run();
}

export async function getFoloWebhookChannels(db: D1Database, webhookId: string): Promise<string[]> {
	const result = await db.prepare(
		'SELECT channel_id FROM folo_webhook_channels WHERE webhook_id = ? ORDER BY created_at ASC'
	).bind(webhookId).all<{ channel_id: string }>();
	return result.results.map(r => r.channel_id);
}

export async function addFoloWebhookChannel(db: D1Database, channelId: string, webhookId: string): Promise<void> {
	await db.prepare('INSERT OR IGNORE INTO folo_webhook_channels (channel_id, webhook_id) VALUES (?, ?)')
		.bind(channelId, webhookId).run();
}

export async function removeFoloWebhookChannel(db: D1Database, channelId: string, webhookId: string): Promise<void> {
	await db.prepare('DELETE FROM folo_webhook_channels WHERE channel_id = ? AND webhook_id = ?')
		.bind(channelId, webhookId).run();
}
