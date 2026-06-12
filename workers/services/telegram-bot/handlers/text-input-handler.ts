import { InlineKeyboard } from 'grammy';
import type { Bot, Context } from 'grammy';
import { getAdminState, setAdminState, clearAdminState } from '../storage/admin-state';
import { addChannelDirect } from './add-channel-flow';
import { handleAddSourceValue, handleRemoveChannelConfirm } from './add-source-flow';
import { detectMediaUrl } from '../../../utils/url-detector';
import { downloadAndSendMedia } from './download-and-send';
import { fetchYouTubeQualities, fetchFacebookInfo, fetchTikTokInfo } from '../../media-downloader';
import { getChannelConfigFromD1, saveChannelConfigToD1 } from '../../../db/d1';
import { resolveFormatSettings } from '../../../utils/telegram-format';
import { buildFormatKeyboard } from '../views/keyboard-builders';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';
import { handleSetTelegraphToken } from '../commands/telegraph-commands';
import { setChannelAiModel, setChannelAiPrompt, setConfig, getConfig, resolveAiModel, resolveAiPrompt } from '../../../db/d1';
import { fetchFeed } from '../../feed-fetcher';
import { summarizeItem } from '../../ai-summarizer';
import { parseSourceRef } from '../helpers/source-parser';
import { fetchAndSendLatest } from './fetch-and-send';
import type { AdminState, ChannelSource } from '../../../types/telegram';

/**
 * Register the main text handler to process multi-step admin flows.
 */
export function registerTextInputHandler(bot: Bot, env: Env, kv: KVNamespace): void {
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);
	const db = env.DB;

	// Handle forwarded messages from channels — lets admins register private channels
	// by simply forwarding any message from the channel to the bot.
	bot.on('message', async (ctx, next) => {
		const origin = (ctx.message as any).forward_origin;
		if (origin?.type === 'channel' && origin.chat) {
			await addChannelDirect(ctx, bot, db, adminId, String(origin.chat.id), kv);
			return;
		}
		await next();
	});

	bot.on('message:text', async (ctx) => {
		const text = ctx.message.text;
		if (text.startsWith('/')) {
			const state = await getAdminState(kv, adminId);
			if (text === '/skip') {
				if (state?.action === 'setting_format_custom') {
					await handleSetFormatCustom(ctx, bot, kv, adminId, state, '', db);
					return;
				}
				if (state?.action === 'setting_telegraph_token') {
					await handleSetTelegraphToken(ctx, kv, adminId, '', env.TELEGRAPH_ACCESS_TOKEN);
					return;
				}
				if (state?.action === 'setting_ai_model') {
					await handleSetAiModel(ctx, kv, adminId, state, '', db);
					return;
				}
				if (state?.action === 'setting_ai_prompt') {
					await handleSetAiPrompt(ctx, kv, adminId, state, '', db);
					return;
				}
				if (state?.action === 'testing_ai_summary') {
					await clearAdminState(kv, adminId);
					await ctx.reply('Test cancelled.');
					return;
				}
			}
			return;
		}

		// Detect supported media URLs before checking admin state
		const detected = detectMediaUrl(text);
		if (detected) {
			// ... (keep existing media detection logic)
			const { platform, url } = detected;

			// YouTube — fetch qualities and show picker
			if (platform === 'YouTube') {
				const statusMsg = await ctx.reply('Fetching available qualities...');
				// Store state before the slow fetch so /cancel can clean up the message
				// even if the Worker times out before fetchYouTubeQualities returns.
				await setAdminState(kv, adminId, {
					action: 'downloading_media',
					context: { downloadUrl: url, downloadPlatform: platform, statusMessageId: statusMsg.message_id },
				});
				const ytInfo = await fetchYouTubeQualities(url);
				if (ytInfo && ytInfo.qualities.length > 0) {
					const keyboard = new InlineKeyboard();
					// Add quality buttons (max 4 per row)
					for (const q of ytInfo.qualities.slice(0, 4)) {
						const label = q.size ? `${q.quality} (${q.size})` : q.quality;
						keyboard.text(label, `dl:yt:${q.quality}`);
					}
					keyboard.row().text('Audio', 'dl:audio');
					await bot.api.editMessageText(
						ctx.chat!.id,
						statusMsg.message_id,
						`<b>${platform}</b> — Choose quality:`,
						{ parse_mode: 'HTML', reply_markup: keyboard }
					);
					await setAdminState(kv, adminId, {
						action: 'downloading_media',
						context: {
							downloadUrl: url,
							downloadPlatform: platform,
							qualities: ytInfo.qualities,
							downloadCaption: ytInfo.caption,
							statusMessageId: statusMsg.message_id,
						},
					});
				} else {
					// Fallback: simple video/audio picker
					const keyboard = new InlineKeyboard()
						.text('Video', 'dl:video')
						.text('Audio', 'dl:audio');
					await bot.api.editMessageText(
						ctx.chat!.id,
						statusMsg.message_id,
						`<b>${platform}</b> — Choose format:`,
						{ parse_mode: 'HTML', reply_markup: keyboard }
					);
					await setAdminState(kv, adminId, {
						action: 'downloading_media',
						context: { downloadUrl: url, downloadPlatform: platform, statusMessageId: statusMsg.message_id },
					});
				}
				return;
			}

			// TikTok — image posts download directly; video posts show Video / Audio picker
			if (platform === 'TikTok') {
				const statusMsg = await ctx.reply('Fetching post info...');
				const ttInfo = await fetchTikTokInfo(url);
				if (ttInfo?.isImagePost) {
					// Slideshow — auto-download, no picker needed
					await downloadAndSendMedia(bot, ctx.chat!.id, url, platform, 'auto', statusMsg.message_id, undefined, { kv, adminId });
				} else {
					const keyboard = new InlineKeyboard()
						.text('Video', 'dl:sd')
						.text('Audio', 'dl:audio');
					await bot.api.editMessageText(
						ctx.chat!.id,
						statusMsg.message_id,
						`<b>${platform}</b> — Choose format:`,
						{ parse_mode: 'HTML', reply_markup: keyboard }
					);
					await setAdminState(kv, adminId, {
						action: 'downloading_media',
						context: { downloadUrl: url, downloadPlatform: platform },
					});
				}
				return;
			}

			// Facebook — show HD/SD picker if multiple qualities available
			if (platform === 'Facebook') {
				const statusMsg = await ctx.reply('Fetching video info...');
				const fbInfo = await fetchFacebookInfo(url);
				if (fbInfo) {
					const keyboard = new InlineKeyboard()
						.text(fbInfo.hdLabel, 'dl:hd')
						.text(fbInfo.sdLabel, 'dl:sd');
					await bot.api.editMessageText(
						ctx.chat!.id,
						statusMsg.message_id,
						`<b>${platform}</b> — Choose quality:`,
						{ parse_mode: 'HTML', reply_markup: keyboard }
					);
					await setAdminState(kv, adminId, {
						action: 'downloading_media',
						context: { downloadUrl: url, downloadPlatform: platform },
					});
				} else {
					await downloadAndSendMedia(bot, ctx.chat!.id, url, platform, 'auto', statusMsg.message_id, undefined, { kv, adminId });
				}
				return;
			}

			// Automatic download for other platforms
			const mode = (platform === 'SoundCloud' || platform === 'Spotify') ? 'audio' : 'auto';
			await downloadAndSendMedia(bot, ctx.chat!.id, url, platform, mode, undefined, undefined, { kv, adminId });
			return;
		}

		const state = await getAdminState(kv, adminId);
		if (!state) {
			await ctx.reply('No active action. Use /start to see commands.');
			return;
		}

		switch (state.action) {
			case 'adding_channel':
				await addChannelDirect(ctx, bot, db, adminId, text.trim(), kv);
				break;
			case 'adding_source':
				await handleAddSourceValue(ctx, bot, kv, adminId, state, text, env, db);
				break;
			case 'removing_channel':
				await handleRemoveChannelConfirm(ctx, kv, adminId, state, text, db);
				break;
			case 'setting_format_custom':
				await handleSetFormatCustom(ctx, bot, kv, adminId, state, text, db);
				break;
			case 'setting_telegraph_token':
				await handleSetTelegraphToken(ctx, kv, adminId, text, env.TELEGRAPH_ACCESS_TOKEN);
				break;
			case 'setting_ai_model':
				await handleSetAiModel(ctx, kv, adminId, state, text, db);
				break;
			case 'setting_ai_prompt':
				await handleSetAiPrompt(ctx, kv, adminId, state, text, db);
				break;
			case 'testing_ai_summary':
				await handleTestAiSummary(ctx, kv, adminId, state, text, db, env);
				break;
			case 'testing_source':
				await handleTestingSource(ctx, bot, env, kv, adminId, text.trim(), db);
				break;
		}
	});
}

async function handleSetFormatCustom(
	ctx: Context,
	bot: Bot,
	kv: KVNamespace,
	adminId: number,
	state: AdminState,
	text: string,
	db: D1Database,
): Promise<void> {
	const { channelId, sourceId, settingKey } = state.context || {};
	if (!channelId || !settingKey) return;

	const config = await getChannelConfigFromD1(db, channelId);
	if (!config) { await ctx.reply('Channel not found.'); return; }

	const value = text.trim();

	if (sourceId) {
		// Update source-specific setting
		const source = config.sources.find((s) => s.id === sourceId);
		if (!source) { await ctx.reply('Source not found.'); return; }
		if (!source.format) source.format = {};
		if (value === '') delete (source.format as any)[settingKey];
		else (source.format as any)[settingKey] = value;
		await saveChannelConfigToD1(db, channelId, config);

		const current = resolveFormatSettings(config.defaultFormat, source.format);
		const keyboard = buildFormatKeyboard(
			current,
			`fs:${channelId}:${sourceId}`,
			`src_detail:${channelId}:${sourceId}`,
			`fs_r:${channelId}:${sourceId}`
		);
		await ctx.reply(
			`<b>Updated ${settingKey} for ${escapeHtmlBot(source.value)}</b>\n` +
			`Channel: <b>${config.channelTitle}</b>`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
	} else {
		// Update channel default setting
		if (!config.defaultFormat) config.defaultFormat = {};
		if (value === '') delete (config.defaultFormat as any)[settingKey];
		else (config.defaultFormat as any)[settingKey] = value;
		await saveChannelConfigToD1(db, channelId, config);

		const current = resolveFormatSettings(config.defaultFormat);
		const keyboard = buildFormatKeyboard(
			current,
			`fd:${channelId}`,
			`ch:${channelId}`,
			`fd_r:${channelId}`
		);
		await ctx.reply(
			`<b>Updated default ${settingKey}</b>\n` +
			`Channel: <b>${config.channelTitle}</b>`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
	}

	await clearAdminState(kv, adminId);
}

async function handleSetAiModel(
	ctx: Context,
	kv: KVNamespace,
	adminId: number,
	state: AdminState,
	text: string,
	db: D1Database,
): Promise<void> {
	const { channelId, sourceId } = state.context || {};
	const model = text.trim() || null;

	if (!channelId) {
		await setConfig(db, 'ai_model', model ?? '');
	} else {
		const key = sourceId ? `${channelId}:${sourceId}` : channelId;
		await setChannelAiModel(db, key, model);
	}
	await clearAdminState(kv, adminId);

	const label = model ? `<code>${escapeHtmlBot(model)}</code>` : 'default';
	let backCallback: string;
	if (!channelId) backCallback = 'ai:g_m';
	else if (sourceId) backCallback = `ai:src_m:${channelId}:${sourceId}`;
	else backCallback = `ai:ch_m:${channelId}`;

	const keyboard = new InlineKeyboard().text('← Back', backCallback);
	await ctx.reply(`Model set to ${label}`, { parse_mode: 'HTML', reply_markup: keyboard });
}

async function handleTestAiSummary(
	ctx: Context,
	kv: KVNamespace,
	adminId: number,
	state: AdminState,
	text: string,
	db: D1Database,
	env: Env,
): Promise<void> {
	const { channelId, sourceId } = state.context || {};
	const url = text.trim();
	await clearAdminState(kv, adminId);

	const statusMsg = await ctx.reply('⏳ Fetching feed...');
	const chatId = ctx.chat!.id;

	const result = await fetchFeed(url);
	if (result.items.length === 0) {
		const errText = result.errors.map((e) => e.message).join(', ') || 'No items found.';
		await ctx.api.editMessageText(chatId, statusMsg.message_id, `❌ ${escapeHtmlBot(errText)}`, { parse_mode: 'HTML' });
		return;
	}

	const item = result.items[0];
	if (!item.text || item.text.trim().length < 50) {
		await ctx.api.editMessageText(chatId, statusMsg.message_id, '❌ First item has no text content (need ≥50 chars).');
		return;
	}

	await ctx.api.editMessageText(chatId, statusMsg.message_id, '⏳ Generating summary...');

	let model: string | undefined;
	let prompt: string | undefined;

	if (channelId) {
		const [m, p] = await Promise.all([
			resolveAiModel(db, channelId, sourceId),
			resolveAiPrompt(db, channelId, sourceId),
		]);
		if (m) model = m;
		if (p) prompt = p;
	} else {
		const [m, p] = await Promise.all([getConfig(db, 'ai_model'), getConfig(db, 'ai_prompt')]);
		if (m) model = m;
		if (p) prompt = p;
	}

	let summary: string | null = null;
	try {
		summary = await summarizeItem(item, env, model || undefined, prompt || undefined);
	} catch (err: any) {
		await ctx.api.editMessageText(chatId, statusMsg.message_id, `❌ AI Error: ${err.message}`);
		return;
	}

	if (!summary) {
		await ctx.api.editMessageText(chatId, statusMsg.message_id, '❌ AI returned no summary. Check gateway token and model settings.');
		return;
	}

	const usedModel = model || env.DEFAULT_AI_MODEL || 'nvidia/llama-3.1-nemotron-70b-instruct';
	const levelLabel = sourceId ? `Source: ${sourceId}` : channelId ? `Channel: ${channelId}` : 'Global';
	const replyText =
		`🧪 <b>AI Test Result</b> — <i>${escapeHtmlBot(levelLabel)}</i>\n\n` +
		`📰 <b>${escapeHtmlBot(item.title || 'Untitled')}</b>\n` +
		`Model: <code>${escapeHtmlBot(usedModel)}</code>\n\n` +
		`📝 <i>${escapeHtmlBot(summary)}</i>`;

	await ctx.api.editMessageText(chatId, statusMsg.message_id, replyText, { parse_mode: 'HTML' });
}

async function handleSetAiPrompt(
	ctx: Context,
	kv: KVNamespace,
	adminId: number,
	state: AdminState,
	text: string,
	db: D1Database,
): Promise<void> {
	const { channelId, sourceId } = state.context || {};
	const prompt = text.trim() || null;

	if (!channelId) {
		await setConfig(db, 'ai_prompt', prompt ?? '');
	} else {
		const key = sourceId ? `${channelId}:${sourceId}` : channelId;
		await setChannelAiPrompt(db, key, prompt);
	}
	await clearAdminState(kv, adminId);

	const label = prompt ? '✅ Custom prompt saved.' : '✅ Prompt reset to default.';
	let backCallback: string;
	if (!channelId) backCallback = 'ai:g_p';
	else if (sourceId) backCallback = `ai:src_p:${channelId}:${sourceId}`;
	else backCallback = `ai:ch_p:${channelId}`;

	const keyboard = new InlineKeyboard().text('← Back', backCallback);
	await ctx.reply(label, { reply_markup: keyboard });
}

async function handleTestingSource(
	ctx: Context,
	bot: Bot,
	env: Env,
	kv: KVNamespace,
	adminId: number,
	text: string,
	db: D1Database,
): Promise<void> {
	// Parse optional leading count: "5 @username" or just "@username"
	let count = 1;
	let sourceRef = text;
	const match = text.match(/^(\d+)\s+(.+)$/);
	if (match) {
		count = Math.min(Math.max(parseInt(match[1], 10), 1), 10);
		sourceRef = match[2];
	}

	const parsed = parseSourceRef(sourceRef);
	if (!parsed) {
		await ctx.reply(
			'Invalid source. Expected:\n' +
			'<code>@username</code>, <code>-t username</code>, <code>-rss https://...</code>, or a URL\n\n' +
			'Try again or use /cancel to abort.',
			{ parse_mode: 'HTML', reply_markup: { force_reply: true, selective: true } }
		);
		return;
	}

	await clearAdminState(kv, adminId);

	await ctx.reply(`Fetching latest ${count} from <b>${parsed.value}</b>...`, { parse_mode: 'HTML' });

	const source: ChannelSource = {
		id: parsed.id,
		type: parsed.type,
		value: parsed.value,
		mediaFilter: 'all',
		enabled: true,
	};

	await fetchAndSendLatest(bot, env, ctx.chat!.id, source, count, false, db);
}
