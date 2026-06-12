import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { getChannelsListD1, getChannelConfigFromD1 } from '../../../db/d1';
import { setAdminState } from '../storage/admin-state';
import {
	getConfig,
	setConfig,
	getChannelAiSummary,
	getChannelAiRow,
	setChannelAiSummary,
	setChannelAiModel,
	setChannelAiPrompt,
	type AiSummarySetting,
} from '../../../db/d1';

// ── Predefined model options ──────────────────────────────────────────────────

const MODEL_OPTIONS: Record<string, { label: string; value: string }> = {
	nv70b: { label: 'NVIDIA Llama 70B', value: 'nvidia/llama-3.1-nemotron-70b-instruct' },
	gg20f: { label: 'Gemini 2.0 Flash',  value: 'google/gemini-2.0-flash' },
	gg15f: { label: 'Gemini 1.5 Flash',  value: 'google/gemini-1.5-flash' },
	gq70b: { label: 'Groq Llama 70B',    value: 'groq/llama-3.3-70b-versatile' },
	gq8b:  { label: 'Groq Llama 8B',     value: 'groq/llama-3.1-8b-instant' },
	msLg:  { label: 'Mistral Large',      value: 'mistral/mistral-large-latest' },
	kimi:  { label: 'Kimi K2.6',          value: 'moonshotai/kimi-k2.6' },
	cr70b: { label: 'Cerebras Llama 70B', value: 'cerebras/llama3.1-70b' },
	orLma: { label: 'OpenRouter Llama 70B', value: 'openrouter/meta-llama/llama-3.3-70b-instruct' },
};

const DEFAULT_MODEL_VALUE = 'nvidia/llama-3.1-nemotron-70b-instruct';

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(s: string, n: number): string {
	return s.length > n ? s.slice(0, n) + '…' : s;
}

function settingEmoji(s: AiSummarySetting): string {
	if (s === 'enable') return '✅';
	if (s === 'disable') return '❌';
	return '⬆️';
}

function modelDisplay(model: string | null): string {
	if (!model) return 'Default';
	const found = Object.values(MODEL_OPTIONS).find(m => m.value === model);
	if (found) return found.label;
	const parts = model.split('/');
	return truncate(parts[parts.length - 1], 18);
}

function promptDisplay(prompt: string | null): string {
	if (!prompt) return 'Default';
	return 'Custom';
}

async function isGlobalEnabled(db: D1Database): Promise<boolean> {
	return (await getConfig(db, 'ai_summary_enabled')) === '1';
}

// ── Model keyboard builder ────────────────────────────────────────────────────

function buildModelKeyboard(
	currentModel: string | null,
	setCbPrefix: string,   // e.g. "ai:g_ms", "ai:ch_ms:-100x", "ai:src_ms:-100x:@user"
	resetCb: string,
	customCb: string,
	backCb: string,
): InlineKeyboard {
	const keyboard = new InlineKeyboard();
	const rows: Array<[string, string][]> = [];
	const entries = Object.entries(MODEL_OPTIONS);
	
	let currentRow: [string, string][] = [];
	for (let i = 0; i < entries.length; i++) {
		const [key, { label, value }] = entries[i];
		const mark = currentModel === value ? '●' : '○';
		currentRow.push([`${mark} ${label}`, `${setCbPrefix}:${key}`]);
		
		if (currentRow.length === 2) { // 2 items per row looks balanced on mobile screen
			rows.push(currentRow);
			currentRow = [];
		}
	}
	if (currentRow.length > 0) {
		rows.push(currentRow);
	}

	for (const row of rows) {
		if (row.length) {
			for (const [label, cb] of row) keyboard.text(label, cb);
			keyboard.row();
		}
	}
	keyboard
		.text('✏️ Custom...', customCb).row()
		.text('🔄 Reset to Default', resetCb).row()
		.text('← Back', backCb);
	return keyboard;
}

// ── Menu builders ─────────────────────────────────────────────────────────────

async function mainMenuContent(
	db: D1Database,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
	const enabled = await isGlobalEnabled(db);
	const globalModel = await getConfig(db, 'ai_model') || null;
	const globalPrompt = await getConfig(db, 'ai_prompt') || null;
	const statusLine = enabled ? '✅ <b>Enabled</b>' : '❌ <b>Disabled</b>';
	const text =
		`🤖 <b>AI Summary Settings</b>\n\n` +
		`Global default: ${statusLine}\n` +
		`Model: <i>${escapeHtml(modelDisplay(globalModel))}</i>\n` +
		`Prompt: <i>${promptDisplay(globalPrompt)}</i>\n\n` +
		`<i>Sources inherit from channel; channels inherit from global.</i>`;
	const keyboard = new InlineKeyboard()
		.text(enabled ? '🔴 Disable Global' : '🟢 Enable Global', 'ai:toggle').row()
		.text('🔧 Global Model ▶', 'ai:g_m').text('📝 Global Prompt ▶', 'ai:g_p').row()
		.text('📺 Channel & Source Settings ▶', 'ai:channels').row()
		.text('🧪 Test AI', 'ai:g_test');
	return { text, keyboard };
}

async function channelMenuContent(
	db: D1Database,
	channelId: string,
	config: { channelTitle?: string; sources?: { id: string; value: string }[] } | null,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
	const row = await getChannelAiRow(db, channelId);
	const { ai_summary: setting, ai_model: model, ai_prompt: prompt } = row;
	const enabled = await isGlobalEnabled(db);
	const effective =
		setting !== 'inherit'
			? setting
			: enabled
				? 'enabled (from global)'
				: 'disabled (from global)';
	const title = escapeHtml(config?.channelTitle || channelId);
	const text =
		`🤖 <b>AI Summary — ${title}</b>\n\n` +
		`Setting: <b>${settingEmoji(setting)} ${setting}</b>\n` +
		`Effective: <i>${effective}</i>\n` +
		`Model: <i>${escapeHtml(modelDisplay(model))}</i>\n` +
		`Prompt: <i>${promptDisplay(prompt)}</i>\n\n` +
		`Sources below inherit this unless overridden.`;

	const opts: AiSummarySetting[] = ['enable', 'disable', 'inherit'];
	const keyboard = new InlineKeyboard();
	for (const opt of opts) {
		keyboard.text(
			`${opt === setting ? '●' : '○'} ${opt.charAt(0).toUpperCase() + opt.slice(1)}`,
			`ai:ch_set:${channelId}:${opt}`,
		);
	}
	keyboard.row();
	if (config?.sources && config.sources.length > 0) {
		keyboard.text('📰 Sources ▶', `ai:sources:${channelId}`).row();
	}
	keyboard
		.text(`🔧 Model ▶`, `ai:ch_m:${channelId}`).text(`📝 Prompt ▶`, `ai:ch_p:${channelId}`).row()
		.text('🧪 Test AI', `ai:ch_test:${channelId}`).row()
		.text('← Back', 'ai:channels');
	return { text, keyboard };
}

async function sourceMenuContent(
	db: D1Database,
	channelId: string,
	sourceId: string,
	sourceValue: string,
	config: { channelTitle?: string } | null,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
	const srcRow = await getChannelAiRow(db, `${channelId}:${sourceId}`);
	const channelSetting = await getChannelAiSummary(db, channelId);
	const globalEnabled = await isGlobalEnabled(db);
	const { ai_summary: sourceSetting, ai_model: model, ai_prompt: prompt } = srcRow;

	let effective: string;
	if (sourceSetting !== 'inherit') {
		effective = sourceSetting;
	} else if (channelSetting !== 'inherit') {
		effective = `${channelSetting} (from channel)`;
	} else {
		effective = globalEnabled ? 'enabled (from global)' : 'disabled (from global)';
	}

	const text =
		`🤖 <b>AI Summary — ${escapeHtml(sourceValue)}</b>\n` +
		`<i>${escapeHtml(config?.channelTitle || channelId)}</i>\n\n` +
		`Setting: <b>${settingEmoji(sourceSetting)} ${sourceSetting}</b>\n` +
		`Effective: <i>${effective}</i>\n` +
		`Model: <i>${escapeHtml(modelDisplay(model))}</i>\n` +
		`Prompt: <i>${promptDisplay(prompt)}</i>`;

	const opts: AiSummarySetting[] = ['enable', 'disable', 'inherit'];
	const keyboard = new InlineKeyboard();
	for (const opt of opts) {
		keyboard.text(
			`${opt === sourceSetting ? '●' : '○'} ${opt.charAt(0).toUpperCase() + opt.slice(1)}`,
			`ai:src_set:${channelId}:${sourceId}:${opt}`,
		);
	}
	keyboard.row()
		.text('🔧 Model ▶', `ai:src_m:${channelId}:${sourceId}`)
		.text('📝 Prompt ▶', `ai:src_p:${channelId}:${sourceId}`)
		.row()
		.text('🧪 Test AI', `ai:src_test:${channelId}:${sourceId}`)
		.row()
		.text('← Back', `ai:sources:${channelId}`);
	return { text, keyboard };
}

async function globalModelContent(db: D1Database): Promise<{ text: string; keyboard: InlineKeyboard }> {
	const model = await getConfig(db, 'ai_model') || null;
	const text =
		`🔧 <b>Global AI Model</b>\n\n` +
		`Currently: <code>${escapeHtml(model ?? DEFAULT_MODEL_VALUE)}</code>` +
		(model ? '' : ' <i>(default)</i>') + '\n\n' +
		`<i>Applies to all channels/sources unless overridden at a lower level.</i>`;
	const keyboard = buildModelKeyboard(model, 'ai:g_ms', 'ai:g_mr', 'ai:g_mc', 'ai:menu');
	return { text, keyboard };
}

async function channelModelContent(
	db: D1Database,
	channelId: string,
	config: { channelTitle?: string } | null,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
	const row = await getChannelAiRow(db, channelId);
	const model = row.ai_model;
	const title = escapeHtml(config?.channelTitle || channelId);
	const text =
		`🔧 <b>Model — ${title}</b>\n\n` +
		`Currently: <code>${escapeHtml(model ?? DEFAULT_MODEL_VALUE)}</code>` +
		(model ? '' : ' <i>(default)</i>') + '\n\n' +
		`<i>Overrides global model for this channel and its sources (unless sources override).</i>`;
	const keyboard = buildModelKeyboard(
		model,
		`ai:ch_ms:${channelId}`,
		`ai:ch_mr:${channelId}`,
		`ai:ch_mc:${channelId}`,
		`ai:ch:${channelId}`,
	);
	return { text, keyboard };
}

async function sourceModelContent(
	db: D1Database,
	channelId: string,
	sourceId: string,
	sourceValue: string,
	config: { channelTitle?: string } | null,
): Promise<{ text: string; keyboard: InlineKeyboard }> {
	const row = await getChannelAiRow(db, `${channelId}:${sourceId}`);
	const model = row.ai_model;
	const text =
		`🔧 <b>Model — ${escapeHtml(sourceValue)}</b>\n` +
		`<i>${escapeHtml(config?.channelTitle || channelId)}</i>\n\n` +
		`Currently: <code>${escapeHtml(model ?? DEFAULT_MODEL_VALUE)}</code>` +
		(model ? '' : ' <i>(default)</i>') + '\n\n' +
		`<i>Overrides channel/global model for this source only.</i>`;
	const keyboard = buildModelKeyboard(
		model,
		`ai:src_ms:${channelId}:${sourceId}`,
		`ai:src_mr:${channelId}:${sourceId}`,
		`ai:src_mc:${channelId}:${sourceId}`,
		`ai:src:${channelId}:${sourceId}`,
	);
	return { text, keyboard };
}

function promptContent(
	level: string,
	prompt: string | null,
	editCb: string,
	resetCb: string,
	backCb: string,
): { text: string; keyboard: InlineKeyboard } {
	const preview = prompt
		? `<blockquote>${escapeHtml(truncate(prompt, 300))}</blockquote>`
		: '<i>(using default Arabic summarizer prompt)</i>';
	const text = `📝 <b>Custom Prompt — ${level}</b>\n\n${preview}`;
	const keyboard = new InlineKeyboard()
		.text('✏️ Edit Prompt', editCb).row()
		.text('🔄 Reset to Default', resetCb).row()
		.text('← Back', backCb);
	return { text, keyboard };
}

// ── Command registration ───────────────────────────────────────────────────────

export function registerAiCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	const db = env.DB;
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);

	// /ai — main menu
	bot.command('ai', async (ctx) => {
		const { text, keyboard } = await mainMenuContent(db);
		await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
	});

	// Back to main menu
	bot.callbackQuery('ai:menu', async (ctx) => {
		const { text, keyboard } = await mainMenuContent(db);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	// Toggle global default
	bot.callbackQuery('ai:toggle', async (ctx) => {
		const enabled = await isGlobalEnabled(db);
		await setConfig(db, 'ai_summary_enabled', enabled ? '0' : '1');
		const { text, keyboard } = await mainMenuContent(db);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: `AI Summary ${!enabled ? 'enabled' : 'disabled'} globally` });
	});

	// ── Global model ──────────────────────────────────────────────────────────

	bot.callbackQuery('ai:g_m', async (ctx) => {
		const { text, keyboard } = await globalModelContent(db);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:g_ms:([^:]+)$/, async (ctx) => {
		const key = ctx.match![1];
		const value = MODEL_OPTIONS[key]?.value;
		if (value) await setConfig(db, 'ai_model', value);
		const { text, keyboard } = await globalModelContent(db);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: value ? `Model set to ${MODEL_OPTIONS[key].label}` : 'Unknown model' });
	});

	bot.callbackQuery('ai:g_mr', async (ctx) => {
		await setConfig(db, 'ai_model', '');
		const { text, keyboard } = await globalModelContent(db);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: 'Reset to default model' });
	});

	bot.callbackQuery('ai:g_mc', async (ctx) => {
		await setAdminState(kv, adminId, { action: 'setting_ai_model', context: {} });
		await ctx.editMessageText(
			'Enter the model ID (e.g. <code>google/gemini-2.0-flash</code>)\nor send /skip to reset to default:',
			{ parse_mode: 'HTML' },
		);
		await ctx.answerCallbackQuery();
	});

	// ── Global prompt ─────────────────────────────────────────────────────────

	bot.callbackQuery('ai:g_p', async (ctx) => {
		const prompt = await getConfig(db, 'ai_prompt') || null;
		const { text, keyboard } = promptContent('Global', prompt, 'ai:g_pe', 'ai:g_pr', 'ai:menu');
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery('ai:g_pe', async (ctx) => {
		await setAdminState(kv, adminId, { action: 'setting_ai_prompt', context: {} });
		await ctx.editMessageText(
			'Enter your custom system prompt (replaces the default Arabic summarizer prompt).\nSend /skip to reset to default:',
		);
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery('ai:g_pr', async (ctx) => {
		await setConfig(db, 'ai_prompt', '');
		const { text, keyboard } = promptContent('Global', null, 'ai:g_pe', 'ai:g_pr', 'ai:menu');
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: 'Prompt reset to default' });
	});

	// ── Channel list ──────────────────────────────────────────────────────────

	bot.callbackQuery('ai:channels', async (ctx) => {
		const channelIds = await getChannelsListD1(db);
		if (channelIds.length === 0) {
			await ctx.answerCallbackQuery({ text: 'No channels registered yet.' });
			return;
		}
		const keyboard = new InlineKeyboard();
		for (const cid of channelIds) {
			const cfg = await getChannelConfigFromD1(db, cid);
			const setting = await getChannelAiSummary(db, cid);
			const label = truncate(cfg?.channelTitle || cid, 22) + ` [${setting}]`;
			keyboard.text(label, `ai:ch:${cid}`).row();
		}
		keyboard.text('← Back', 'ai:menu');
		await ctx.editMessageText(
			'📺 <b>Channel AI Settings</b>\n\nSelect a channel:',
			{ parse_mode: 'HTML', reply_markup: keyboard },
		);
		await ctx.answerCallbackQuery();
	});

	// ── Channel detail ────────────────────────────────────────────────────────

	bot.callbackQuery(/^ai:ch:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		const config = await getChannelConfigFromD1(db, channelId);
		const { text, keyboard } = await channelMenuContent(db, channelId, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:ch_set:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, value] = ctx.match!;
		await setChannelAiSummary(db, channelId, value as AiSummarySetting);
		const config = await getChannelConfigFromD1(db, channelId);
		const { text, keyboard } = await channelMenuContent(db, channelId, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: `Set to: ${value}` });
	});

	// ── Channel model ─────────────────────────────────────────────────────────

	bot.callbackQuery(/^ai:ch_m:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		const config = await getChannelConfigFromD1(db, channelId);
		const { text, keyboard } = await channelModelContent(db, channelId, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:ch_ms:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, key] = ctx.match!;
		const value = MODEL_OPTIONS[key]?.value;
		if (value) await setChannelAiModel(db, channelId, value);
		const config = await getChannelConfigFromD1(db, channelId);
		const { text, keyboard } = await channelModelContent(db, channelId, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: value ? `Set to ${MODEL_OPTIONS[key].label}` : 'Unknown model' });
	});

	bot.callbackQuery(/^ai:ch_mr:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		await setChannelAiModel(db, channelId, null);
		const config = await getChannelConfigFromD1(db, channelId);
		const { text, keyboard } = await channelModelContent(db, channelId, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: 'Model reset to default' });
	});

	bot.callbackQuery(/^ai:ch_mc:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		await setAdminState(kv, adminId, { action: 'setting_ai_model', context: { channelId } });
		await ctx.editMessageText(
			'Enter the model ID (e.g. <code>groq/llama-3.3-70b-versatile</code>)\nor send /skip to reset to default:',
			{ parse_mode: 'HTML' },
		);
		await ctx.answerCallbackQuery();
	});

	// ── Channel prompt ────────────────────────────────────────────────────────

	bot.callbackQuery(/^ai:ch_p:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		const row = await getChannelAiRow(db, channelId);
		const config = await getChannelConfigFromD1(db, channelId);
		const level = config?.channelTitle || channelId;
		const { text, keyboard } = promptContent(
			level, row.ai_prompt,
			`ai:ch_pe:${channelId}`, `ai:ch_pr:${channelId}`, `ai:ch:${channelId}`,
		);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:ch_pe:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		await setAdminState(kv, adminId, { action: 'setting_ai_prompt', context: { channelId } });
		await ctx.editMessageText('Enter your custom system prompt.\nSend /skip to reset to default:');
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:ch_pr:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		await setChannelAiPrompt(db, channelId, null);
		const row = await getChannelAiRow(db, channelId);
		const config = await getChannelConfigFromD1(db, channelId);
		const level = config?.channelTitle || channelId;
		const { text, keyboard } = promptContent(
			level, row.ai_prompt,
			`ai:ch_pe:${channelId}`, `ai:ch_pr:${channelId}`, `ai:ch:${channelId}`,
		);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: 'Prompt reset to default' });
	});

	// ── Sources list ──────────────────────────────────────────────────────────

	bot.callbackQuery(/^ai:sources:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config?.sources?.length) {
			await ctx.answerCallbackQuery({ text: 'No sources found.' });
			return;
		}
		const keyboard = new InlineKeyboard();
		for (const src of config.sources) {
			const s = await getChannelAiSummary(db, `${channelId}:${src.id}`);
			keyboard
				.text(`${truncate(src.value, 20)} [${s}]`, `ai:src:${channelId}:${src.id}`)
				.row();
		}
		keyboard.text('← Back', `ai:ch:${channelId}`);
		await ctx.editMessageText(
			`📰 <b>Source AI Settings</b>\n<i>${escapeHtml(config.channelTitle || channelId)}</i>`,
			{ parse_mode: 'HTML', reply_markup: keyboard },
		);
		await ctx.answerCallbackQuery();
	});

	// ── Source detail ─────────────────────────────────────────────────────────

	bot.callbackQuery(/^ai:src:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found.' }); return; }
		const { text, keyboard } = await sourceMenuContent(db, channelId, sourceId, source.value, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:src_set:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId, value] = ctx.match!;
		await setChannelAiSummary(db, `${channelId}:${sourceId}`, value as AiSummarySetting);
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found.' }); return; }
		const { text, keyboard } = await sourceMenuContent(db, channelId, sourceId, source.value, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: `Set to: ${value}` });
	});

	// ── Source model ──────────────────────────────────────────────────────────

	bot.callbackQuery(/^ai:src_m:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found.' }); return; }
		const { text, keyboard } = await sourceModelContent(db, channelId, sourceId, source.value, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:src_ms:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId, key] = ctx.match!;
		const value = MODEL_OPTIONS[key]?.value;
		if (value) await setChannelAiModel(db, `${channelId}:${sourceId}`, value);
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found.' }); return; }
		const { text, keyboard } = await sourceModelContent(db, channelId, sourceId, source.value, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: value ? `Set to ${MODEL_OPTIONS[key].label}` : 'Unknown model' });
	});

	bot.callbackQuery(/^ai:src_mr:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		await setChannelAiModel(db, `${channelId}:${sourceId}`, null);
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found.' }); return; }
		const { text, keyboard } = await sourceModelContent(db, channelId, sourceId, source.value, config);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: 'Model reset to default' });
	});

	bot.callbackQuery(/^ai:src_mc:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		await setAdminState(kv, adminId, { action: 'setting_ai_model', context: { channelId, sourceId } });
		await ctx.editMessageText(
			'Enter the model ID (e.g. <code>mistral/mistral-large-latest</code>)\nor send /skip to reset to default:',
			{ parse_mode: 'HTML' },
		);
		await ctx.answerCallbackQuery();
	});

	// ── Source prompt ─────────────────────────────────────────────────────────

	bot.callbackQuery(/^ai:src_p:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		const row = await getChannelAiRow(db, `${channelId}:${sourceId}`);
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		const level = source?.value ?? sourceId;
		const { text, keyboard } = promptContent(
			level, row.ai_prompt,
			`ai:src_pe:${channelId}:${sourceId}`,
			`ai:src_pr:${channelId}:${sourceId}`,
			`ai:src:${channelId}:${sourceId}`,
		);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:src_pe:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		await setAdminState(kv, adminId, { action: 'setting_ai_prompt', context: { channelId, sourceId } });
		await ctx.editMessageText('Enter your custom system prompt.\nSend /skip to reset to default:');
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:src_pr:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		await setChannelAiPrompt(db, `${channelId}:${sourceId}`, null);
		const row = await getChannelAiRow(db, `${channelId}:${sourceId}`);
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		const level = source?.value ?? sourceId;
		const { text, keyboard } = promptContent(
			level, row.ai_prompt,
			`ai:src_pe:${channelId}:${sourceId}`,
			`ai:src_pr:${channelId}:${sourceId}`,
			`ai:src:${channelId}:${sourceId}`,
		);
		await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery({ text: 'Prompt reset to default' });
	});

	// ── Test AI ───────────────────────────────────────────────────────────────

	bot.callbackQuery('ai:g_test', async (ctx) => {
		await setAdminState(kv, adminId, { action: 'testing_ai_summary', context: {} });
		await ctx.editMessageText(
			'🧪 <b>Test AI Summary (Global settings)</b>\n\nSend an RSS or Atom feed URL to test with:',
			{ parse_mode: 'HTML' },
		);
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:ch_test:(.+)$/, async (ctx) => {
		const channelId = ctx.match![1];
		const config = await getChannelConfigFromD1(db, channelId);
		const title = escapeHtml(config?.channelTitle || channelId);
		await setAdminState(kv, adminId, { action: 'testing_ai_summary', context: { channelId } });
		await ctx.editMessageText(
			`🧪 <b>Test AI Summary — ${title}</b>\n\nSend an RSS or Atom feed URL to test with:`,
			{ parse_mode: 'HTML' },
		);
		await ctx.answerCallbackQuery();
	});

	bot.callbackQuery(/^ai:src_test:([^:]+):([^:]+)$/, async (ctx) => {
		const [, channelId, sourceId] = ctx.match!;
		const config = await getChannelConfigFromD1(db, channelId);
		const source = config?.sources?.find((s) => s.id === sourceId);
		const label = escapeHtml(source?.value ?? sourceId);
		await setAdminState(kv, adminId, { action: 'testing_ai_summary', context: { channelId, sourceId } });
		await ctx.editMessageText(
			`🧪 <b>Test AI Summary — ${label}</b>\n\nSend an RSS or Atom feed URL to test with:`,
			{ parse_mode: 'HTML' },
		);
		await ctx.answerCallbackQuery();
	});
}
