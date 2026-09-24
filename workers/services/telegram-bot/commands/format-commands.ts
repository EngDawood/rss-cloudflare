import type { Bot } from 'grammy';
import { getChannelConfigFromD1, getGlobalFormat, getGlobalCheckInterval, setGlobalCheckInterval } from '../../../db/d1';
import { resolveChannelArg } from '../helpers/channel-resolver';
import { resolveFormatSettings } from '../../../utils/telegram-format';
import { buildFormatKeyboard, buildGlobalFormatView } from '../views/keyboard-builders';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';
import { registerArgCommand, askForArg, channelPrompt, channelSourcesHint } from '../helpers/command-args';

/**
 * Register format settings commands.
 */
export function registerFormatCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	const db = env.DB;
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);

	// /set_default — bot-wide defaults; /set_default @channel — channel default format settings
	bot.command('set_default', async (ctx) => {
		const arg = ctx.match?.trim();
		if (!arg) {
			const view = buildGlobalFormatView(await getGlobalFormat(db));
			const interval = await getGlobalCheckInterval(db);
			await ctx.reply(
				view.text +
					`\n\n⏱ Default check interval for <b>new</b> channels: <b>${interval} min</b>\n` +
					'<code>/set_default delay &lt;minutes&gt;</code> to change it.',
				{ parse_mode: 'HTML', reply_markup: view.keyboard }
			);
			return;
		}

		// /set_default delay [minutes] — bot-wide default check interval for new channels
		if (/^delay\b/i.test(arg)) {
			const minsArg = arg.replace(/^delay\s*/i, '').trim();
			if (!minsArg) {
				const current = await getGlobalCheckInterval(db);
				await ctx.reply(
					`⏱ Default check interval for new channels: <b>${current} min</b>\n\n` +
						'Send <code>/set_default delay &lt;minutes&gt;</code> to change it (minimum 5).\n' +
						'This only applies to newly registered channels — use <code>/delay @channel</code> to change an existing one.',
					{ parse_mode: 'HTML' }
				);
				return;
			}
			const minutes = parseInt(minsArg, 10);
			if (isNaN(minutes) || minutes < 5) {
				await ctx.reply('Delay must be at least 5 minutes.');
				return;
			}
			await setGlobalCheckInterval(db, minutes);
			await ctx.reply(`⏱ Default check interval for new channels set to <b>${minutes} min</b>`, { parse_mode: 'HTML' });
			return;
		}

		const resolved = await resolveChannelArg(bot, db, arg);
		if (!resolved) { await ctx.reply(`Channel "${arg}" not found.`); return; }
		const config = await getChannelConfigFromD1(db, resolved.id);
		if (!config) { await ctx.reply('Channel not registered.'); return; }

		const current = resolveFormatSettings(config.defaultFormat, undefined, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			current,
			`fd:${resolved.id}`,
			`ch:${resolved.id}`,
			`fd_r:${resolved.id}`
		);
		await ctx.reply(
			`<b>Set the default settings for subscriptions.</b>\n\n` +
			`The unset settings of a subscription will fall back to the settings on this page.`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
	});

	// /set @channel @source — per-source format settings
	registerArgCommand(bot, 'set', async (ctx, argStr) => {
		const args = argStr ? argStr.split(/\s+/) : [];
		if (args.length === 0) {
			await askForArg(ctx, kv, adminId, 'set', '', channelPrompt('whose source you want to format.'));
			return;
		}
		if (args.length === 1) {
			const ch = await resolveChannelArg(bot, db, args[0]);
			if (!ch) { await ctx.reply(`Channel "${args[0]}" not found.`); return; }
			await askForArg(ctx, kv, adminId, 'set', args[0],
				`Send the source in <b>${escapeHtmlBot(ch.title)}</b> to format.` +
				await channelSourcesHint(db, ch.id)
			);
			return;
		}
		const [channelRef, ...sourceRefParts] = args;
		const sourceRef = sourceRefParts.join(' ');
		const resolvedChannel = await resolveChannelArg(bot, db, channelRef);
		if (!resolvedChannel) { await ctx.reply(`Channel "${channelRef}" not found.`); return; }
		const config = await getChannelConfigFromD1(db, resolvedChannel.id);
		if (!config) { await ctx.reply('Channel not registered.'); return; }

		const sourceValue = sourceRef.replace(/^[@#]/, '');
		const source = config.sources.find((s) => s.value === sourceValue || s.id === sourceValue || s.value === sourceRef);
		if (!source) {
			await ctx.reply(`Source "${sourceRef}" not found in <b>${config.channelTitle}</b>.`, { parse_mode: 'HTML' });
			return;
		}

		const current = resolveFormatSettings(config.defaultFormat, source.format, await getGlobalFormat(db));
		const keyboard = buildFormatKeyboard(
			current,
			`fs:${resolvedChannel.id}:${source.id}`,
			`src_detail:${resolvedChannel.id}:${source.id}`,
			`fs_r:${resolvedChannel.id}:${source.id}`
		);
		await ctx.reply(
			`<b>Format settings for ${escapeHtmlBot(source.value)}</b>\n` +
			`Channel: <b>${config.channelTitle}</b>`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
	});
}
