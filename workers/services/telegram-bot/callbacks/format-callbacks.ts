import type { Bot } from 'grammy';
import type { FormatSettings } from '../../../types/telegram';
import { getChannelConfigFromD1, saveChannelConfigToD1, getGlobalFormat, setGlobalFormat } from '../../../db/d1';
import { resolveFormatSettings } from '../../../utils/telegram-format';
import { cycleFormatValue, formatValueText } from '../helpers/format-settings';
import { buildFormatKeyboard, buildGlobalFormatView } from '../views/keyboard-builders';
import { editOrReply } from '../helpers/edit-or-reply';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';
import { FORMAT_LABELS } from '../../../constants';
import { setAdminState } from '../storage/admin-state';

/**
 * Register callback query handlers for format settings management.
 */
export function registerFormatCallbacks(bot: Bot, env: Env, kv: KVNamespace): void {
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);
	const db = env.DB;

	// Cycle source format setting: fs:CHID:SRCID:SETTING
	bot.callbackQuery(/^fs:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const sourceId = ctx.match[2];
		const setting = ctx.match[3] as keyof FormatSettings;
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }
		const source = config.sources.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found' }); return; }

		if (!source.format) source.format = {};
		const current = resolveFormatSettings(config.defaultFormat, source.format, await getGlobalFormat(db));
		const nextVal = cycleFormatValue(setting, current[setting] as string | number);
		if (setting === 'lengthLimit') {
			source.format[setting] = parseInt(nextVal, 10);
		} else {
			(source.format as any)[setting] = nextVal;
		}
		await saveChannelConfigToD1(db, channelId, config);

		const updated = resolveFormatSettings(config.defaultFormat, source.format, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			updated,
			`fs:${channelId}:${sourceId}`,
			`src_detail:${channelId}:${sourceId}`,
			`fs_r:${channelId}:${sourceId}`
		);
		await editOrReply(ctx,
			`<b>Format settings for ${escapeHtmlBot(source.value)}</b>\n` +
			`Channel: <b>${config.channelTitle}</b>`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
		await ctx.answerCallbackQuery({ text: `${FORMAT_LABELS[setting].label}: ${formatValueText(setting, nextVal)}` });
	});

	// Trigger custom text input for source: fsc:CHID:SRCID:SETTING
	bot.callbackQuery(/^fsc:([^:]+):([^:]+):([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const sourceId = ctx.match[2];
		const setting = ctx.match[3] as keyof FormatSettings;
		const label = FORMAT_LABELS[setting].label;

		await setAdminState(kv, adminId, {
			action: 'setting_format_custom',
			context: { channelId, sourceId, settingKey: setting },
		});

		await ctx.reply(`Please send the text for <b>${label}</b> (or send /skip to clear it):`, { parse_mode: 'HTML' });
		await ctx.answerCallbackQuery();
	});

	// Cycle channel default format setting: fd:CHID:SETTING
	bot.callbackQuery(/^fd:([^:]+):([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const setting = ctx.match[2] as keyof FormatSettings;
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }

		if (!config.defaultFormat) config.defaultFormat = {};
		const current = resolveFormatSettings(config.defaultFormat, undefined, await getGlobalFormat(db));
		const nextVal = cycleFormatValue(setting, current[setting] as string | number);
		if (setting === 'lengthLimit') {
			config.defaultFormat[setting] = parseInt(nextVal, 10);
		} else {
			(config.defaultFormat as any)[setting] = nextVal;
		}
		await saveChannelConfigToD1(db, channelId, config);

		const updated = resolveFormatSettings(config.defaultFormat, undefined, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			updated,
			`fd:${channelId}`,
			`ch:${channelId}`,
			`fd_r:${channelId}`
		);
		await editOrReply(ctx,
			`<b>Set the default settings for subscriptions.</b>\n\n` +
			`The unset settings of a subscription will fall back to the settings on this page.`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
		await ctx.answerCallbackQuery({ text: `${FORMAT_LABELS[setting].label}: ${formatValueText(setting, nextVal)}` });
	});

	// Trigger custom text input for channel default: fdc:CHID:SETTING
	bot.callbackQuery(/^fdc:([^:]+):([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const setting = ctx.match[2] as keyof FormatSettings;
		const label = FORMAT_LABELS[setting].label;

		await setAdminState(kv, adminId, {
			action: 'setting_format_custom',
			context: { channelId, settingKey: setting },
		});

		await ctx.reply(`Please send the default text for <b>${label}</b> (or send /skip to clear it):`, { parse_mode: 'HTML' });
		await ctx.answerCallbackQuery();
	});

	// View source format settings: fs_v:CHID:SRCID
	bot.callbackQuery(/^fs_v:([^:]+):([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const sourceId = ctx.match[2];
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }
		const source = config.sources.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found' }); return; }

		const current = resolveFormatSettings(config.defaultFormat, source.format, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			current,
			`fs:${channelId}:${sourceId}`,
			`src_detail:${channelId}:${sourceId}`,
			`fs_r:${channelId}:${sourceId}`
		);
		await editOrReply(ctx,
			`<b>Format settings for ${escapeHtmlBot(source.value)}</b>\n` +
			`Channel: <b>${config.channelTitle}</b>`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
		await ctx.answerCallbackQuery();
	});

	// View channel default format settings: fd_v:CHID
	bot.callbackQuery(/^fd_v:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }

		const current = resolveFormatSettings(config.defaultFormat, undefined, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			current,
			`fd:${channelId}`,
			`ch:${channelId}`,
			`fd_r:${channelId}`
		);
		await editOrReply(ctx,
			`<b>Set the default settings for subscriptions.</b>\n\n` +
			`The unset settings of a subscription will fall back to the settings on this page.`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
		await ctx.answerCallbackQuery();
	});

	// Reset source format to channel defaults: fs_r:CHID:SRCID
	bot.callbackQuery(/^fs_r:([^:]+):([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const sourceId = ctx.match[2];
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }
		const source = config.sources.find((s) => s.id === sourceId);
		if (!source) { await ctx.answerCallbackQuery({ text: 'Source not found' }); return; }

		delete source.format;
		await saveChannelConfigToD1(db, channelId, config);

		const current = resolveFormatSettings(config.defaultFormat, undefined, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			current,
			`fs:${channelId}:${sourceId}`,
			`src_detail:${channelId}:${sourceId}`,
			`fs_r:${channelId}:${sourceId}`
		);
		await editOrReply(ctx,
			`<b>Format settings for ${escapeHtmlBot(source.value)}</b>\n` +
			`Channel: <b>${config.channelTitle}</b>\n\n<i>Reset to channel defaults.</i>`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
		await ctx.answerCallbackQuery({ text: 'Reset to defaults' });
	});

	// Cycle bot-wide default format setting: fg:SETTING
	bot.callbackQuery(/^fg:([^:]+)$/, async (ctx) => {
		const setting = ctx.match[1] as keyof FormatSettings;
		const globalFormat = await getGlobalFormat(db);
		const current = resolveFormatSettings(undefined, undefined, globalFormat);
		const nextVal = cycleFormatValue(setting, current[setting] as string | number);
		if (setting === 'lengthLimit') {
			globalFormat[setting] = parseInt(nextVal, 10);
		} else {
			(globalFormat as any)[setting] = nextVal;
		}
		await setGlobalFormat(db, globalFormat);

		const view = buildGlobalFormatView(globalFormat);
		await editOrReply(ctx, view.text, { parse_mode: 'HTML', reply_markup: view.keyboard });
		await ctx.answerCallbackQuery({ text: `${FORMAT_LABELS[setting].label}: ${formatValueText(setting, nextVal)}` });
	});

	// Trigger custom text input for bot-wide default: fgc:SETTING
	bot.callbackQuery(/^fgc:([^:]+)$/, async (ctx) => {
		const setting = ctx.match[1] as keyof FormatSettings;
		const label = FORMAT_LABELS[setting].label;

		await setAdminState(kv, adminId, {
			action: 'setting_format_custom',
			context: { settingKey: setting },
		});

		await ctx.reply(`Please send the bot default text for <b>${label}</b> (or send /skip to clear it):`, { parse_mode: 'HTML' });
		await ctx.answerCallbackQuery();
	});

	// Reset bot-wide defaults to hardcoded defaults: fg_r
	bot.callbackQuery('fg_r', async (ctx) => {
		await setGlobalFormat(db, {});
		const view = buildGlobalFormatView({});
		await editOrReply(ctx, `${view.text}\n\n<i>Reset to system defaults.</i>`, { parse_mode: 'HTML', reply_markup: view.keyboard });
		await ctx.answerCallbackQuery({ text: 'Reset to defaults' });
	});

	// Close bot-wide defaults page: fg_x
	bot.callbackQuery('fg_x', async (ctx) => {
		await ctx.deleteMessage().catch(() => {});
		await ctx.answerCallbackQuery();
	});

	// Reset channel defaults to bot defaults: fd_r:CHID
	bot.callbackQuery(/^fd_r:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }

		delete config.defaultFormat;
		await saveChannelConfigToD1(db, channelId, config);

		const current = resolveFormatSettings(undefined, undefined, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			current,
			`fd:${channelId}`,
			`ch:${channelId}`,
			`fd_r:${channelId}`
		);
		await editOrReply(ctx,
			`<b>Set the default settings for subscriptions.</b>\n\n` +
			`The unset settings of a subscription will fall back to the settings on this page.\n\n<i>Reset to bot defaults.</i>`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
		await ctx.answerCallbackQuery({ text: 'Reset to defaults' });
	});
}
