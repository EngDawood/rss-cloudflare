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
 * Resolve effective model: source → channel → global config key → null.
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
 * Resolve effective prompt: source → channel → global config key → null.
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
