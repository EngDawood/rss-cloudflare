import { InlineKeyboard } from 'grammy';
import type { Bot, Context } from 'grammy';
import { getAdminState, setAdminState } from '../storage/admin-state';
import { addChannelDirect } from './add-channel-flow';
import { handleAddSourceValue, handleRemoveChannelConfirm } from './add-source-flow';
import { detectMediaUrl } from '../../../utils/url-detector';
import { downloadAndSendMedia } from './download-and-send';
import { fetchYouTubeQualities, fetchFacebookInfo, fetchTikTokInfo } from '../../media-downloader';
import { getChannelConfig, saveChannelConfig } from '../storage/kv-operations';
import { resolveFormatSettings } from '../../../utils/telegram-format';
import { buildFormatKeyboard } from '../views/keyboard-builders';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';
import type { AdminState } from '../../../types/telegram';

/**
 * Register the main text handler to process multi-step admin flows.
 */
export function registerTextInputHandler(bot: Bot, env: Env, kv: KVNamespace): void {
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);

	bot.on('message:text', async (ctx) => {
		const text = ctx.message.text;
		if (text.startsWith('/')) {
			// Special case for /skip in custom format input
			const state = await getAdminState(kv, adminId);
			if (state?.action === 'setting_format_custom' && text === '/skip') {
				await handleSetFormatCustom(ctx, bot, kv, adminId, state, '');
				return;
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
						context: { downloadUrl: url, downloadPlatform: platform },
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
				await addChannelDirect(ctx, bot, kv, adminId, text.trim());
				break;
			case 'adding_source':
				await handleAddSourceValue(ctx, bot, kv, adminId, state, text, env);
				break;
			case 'removing_channel':
				await handleRemoveChannelConfirm(ctx, kv, adminId, state, text);
				break;
			case 'setting_format_custom':
				await handleSetFormatCustom(ctx, bot, kv, adminId, state, text);
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
	text: string
): Promise<void> {
	const { channelId, sourceId, settingKey } = state.context || {};
	if (!channelId || !settingKey) return;

	const config = await getChannelConfig(kv, channelId);
	if (!config) { await ctx.reply('Channel not found.'); return; }

	const value = text.trim();

	if (sourceId) {
		// Update source-specific setting
		const source = config.sources.find((s) => s.id === sourceId);
		if (!source) { await ctx.reply('Source not found.'); return; }
		if (!source.format) source.format = {};
		if (value === '') delete (source.format as any)[settingKey];
		else (source.format as any)[settingKey] = value;
		await saveChannelConfig(kv, channelId, config);

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
		await saveChannelConfig(kv, channelId, config);

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

	await setAdminState(kv, adminId, null);
}
