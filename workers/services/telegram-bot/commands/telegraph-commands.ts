import { type Bot, InlineKeyboard } from 'grammy';
import { getAdminConfig, saveAdminConfig } from '../storage/kv-operations';
import { setAdminState, clearAdminState } from '../storage/admin-state';

const THRESHOLDS = [300, 500, 1000, 2000];

function buildTelegraphKeyboard(enabled: boolean, threshold: number, hasKvToken: boolean): InlineKeyboard {
	const kb = new InlineKeyboard();
	kb.text(enabled ? '✅ Enabled' : '❌ Disabled', 'tf:toggle').row();
	for (const t of THRESHOLDS) {
		kb.text(threshold === t ? `• ${t} chars` : `${t} chars`, `tf:threshold:${t}`);
	}
	kb.row().text('🔑 Set Token', 'tf:set_token');
	if (hasKvToken) kb.text('🗑 Clear Token', 'tf:clear_token');
	return kb;
}

function buildStatusText(enabled: boolean, threshold: number, hasKvToken: boolean, hasEnvToken: boolean): string {
	let tokenLine: string;
	if (hasKvToken) {
		tokenLine = '🔑 Token: <b>set via bot</b>' + (hasEnvToken ? ' (overrides env)' : '');
	} else if (hasEnvToken) {
		tokenLine = '🔑 Token: configured via <code>TELEGRAPH_ACCESS_TOKEN</code> env';
	} else {
		tokenLine = '⚠️ Token: <b>not set</b> — use "Set Token" or add <code>TELEGRAPH_ACCESS_TOKEN</code> secret';
	}
	return (
		`<b>Telegraph Instant View</b>\n\n` +
		`${tokenLine}\n` +
		`Status: ${enabled ? '✅ Enabled' : '❌ Disabled'}\n` +
		`Threshold: <b>${threshold} chars</b> — posts longer than this get a Telegraph page\n\n` +
		`When enabled, long text articles (no media) are published to Telegraph so readers get an Instant View link.`
	);
}

export function registerTelegraphCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);

	bot.command('telegraph', async (ctx) => {
		const config = await getAdminConfig(kv);
		const { enabled, threshold, token } = config.telegraph;
		await ctx.reply(
			buildStatusText(enabled, threshold, !!token, !!env.TELEGRAPH_ACCESS_TOKEN),
			{ parse_mode: 'HTML', reply_markup: buildTelegraphKeyboard(enabled, threshold, !!token) }
		);
	});

	bot.callbackQuery('tf:toggle', async (ctx) => {
		const config = await getAdminConfig(kv);
		config.telegraph.enabled = !config.telegraph.enabled;
		await saveAdminConfig(kv, config);
		const { enabled, threshold, token } = config.telegraph;
		await ctx.editMessageText(
			buildStatusText(enabled, threshold, !!token, !!env.TELEGRAPH_ACCESS_TOKEN),
			{ parse_mode: 'HTML', reply_markup: buildTelegraphKeyboard(enabled, threshold, !!token) }
		);
		await ctx.answerCallbackQuery({ text: enabled ? 'Telegraph enabled' : 'Telegraph disabled' });
	});

	bot.callbackQuery(/^tf:threshold:(\d+)$/, async (ctx) => {
		const t = parseInt(ctx.match[1], 10);
		if (!THRESHOLDS.includes(t)) { await ctx.answerCallbackQuery(); return; }
		const config = await getAdminConfig(kv);
		config.telegraph.threshold = t;
		await saveAdminConfig(kv, config);
		const { enabled, threshold, token } = config.telegraph;
		await ctx.editMessageText(
			buildStatusText(enabled, threshold, !!token, !!env.TELEGRAPH_ACCESS_TOKEN),
			{ parse_mode: 'HTML', reply_markup: buildTelegraphKeyboard(enabled, threshold, !!token) }
		);
		await ctx.answerCallbackQuery({ text: `Threshold set to ${t} chars` });
	});

	bot.callbackQuery('tf:set_token', async (ctx) => {
		await setAdminState(kv, adminId, { action: 'setting_telegraph_token' });
		await ctx.answerCallbackQuery();
		await ctx.reply('Send me the Telegraph access token.\n\nSend /skip to cancel.');
	});

	bot.callbackQuery('tf:clear_token', async (ctx) => {
		const config = await getAdminConfig(kv);
		delete config.telegraph.token;
		await saveAdminConfig(kv, config);
		const { enabled, threshold, token } = config.telegraph;
		await ctx.editMessageText(
			buildStatusText(enabled, threshold, !!token, !!env.TELEGRAPH_ACCESS_TOKEN),
			{ parse_mode: 'HTML', reply_markup: buildTelegraphKeyboard(enabled, threshold, !!token) }
		);
		await ctx.answerCallbackQuery({ text: 'KV token cleared — falling back to env' });
	});
}

/**
 * Handle the telegraph token text input step (called from text-input-handler).
 */
export async function handleSetTelegraphToken(
	ctx: { reply: (text: string, opts?: any) => Promise<any> },
	kv: KVNamespace,
	adminId: number,
	text: string,
	envToken: string | undefined
): Promise<void> {
	await clearAdminState(kv, adminId);

	if (!text) {
		await ctx.reply('Cancelled — no token saved.');
		return;
	}

	const config = await getAdminConfig(kv);
	config.telegraph.token = text.trim();
	await saveAdminConfig(kv, config);

	const hasEnv = !!envToken;
	await ctx.reply(
		`✅ Telegraph token saved.\n\n` +
		(hasEnv ? 'This token <b>overrides</b> the <code>TELEGRAPH_ACCESS_TOKEN</code> env var.' : 'Token is now active.'),
		{ parse_mode: 'HTML' }
	);
}
