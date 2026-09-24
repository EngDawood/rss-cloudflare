import type { Bot } from 'grammy';
import { getChannelsListD1, getChannelConfigFromD1, saveChannelConfigToD1 } from '../../../db/d1';
import { setAdminState } from '../storage/admin-state';
import { resolveChannelArg } from '../helpers/channel-resolver';
import { showChannelsList } from '../views/channel-views';
import { addChannelDirect, addPersonalChat } from '../handlers/add-channel-flow';
import { registerArgCommand, askForArg, channelPrompt } from '../helpers/command-args';

/**
 * Register channel management commands.
 */
export function registerChannelCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);
	const db = env.DB;

	// /add @channel or /add -100xxx
	bot.command('add', async (ctx) => {
		const arg = ctx.match?.trim();
		if (arg?.toLowerCase() === 'me') {
			// Register this chat itself (e.g. your personal DM) as a manageable channel
			await addPersonalChat(ctx, db, adminId, kv);
		} else if (arg) {
			// Direct add with argument
			await addChannelDirect(ctx, bot, db, adminId, arg, kv);
		} else {
			await setAdminState(kv, adminId, { action: 'adding_channel' });
			await ctx.reply(
				'Send me the channel <b>@username</b> or <b>ID</b>\n\n' +
					'Example: <code>@mychannel</code> or <code>-1001234567890</code>\n\n' +
					'Or send <code>/add me</code> to register <i>this chat</i> (e.g. your personal DM) instead.\n\n' +
					'Use /cancel to abort.',
				{ parse_mode: 'HTML' }
			);
		}
	});

	bot.command('channels', async (ctx) => {
		await showChannelsList(ctx, db);
	});

	bot.command('status', async (ctx) => {
		const channels = await getChannelsListD1(db);
		if (channels.length === 0) {
			await ctx.reply('No channels configured. Use /add @channel to add one.');
			return;
		}

		let text = '<b>Status Overview</b>\n\n';
		for (const channelId of channels) {
			const config = await getChannelConfigFromD1(db, channelId);
			if (!config) continue;
			const status = config.enabled ? '✅' : '❌';
			text += `${status} <b>${config.channelTitle}</b>\n`;
			text += `   Sources: ${config.sources.length} | Delay: ${config.checkIntervalMinutes}m\n\n`;
		}
		await ctx.reply(text, { parse_mode: 'HTML' });
	});

	// /enable @channel
	registerArgCommand(bot, 'enable', async (ctx, arg) => {
		if (!arg) { await askForArg(ctx, kv, adminId, 'enable', '', channelPrompt('to enable.')); return; }
		const resolved = await resolveChannelArg(bot, db, arg);
		if (!resolved) { await ctx.reply('Channel not found.'); return; }
		const config = await getChannelConfigFromD1(db, resolved.id);
		if (!config) { await ctx.reply('Channel not registered.'); return; }
		config.enabled = true;
		await saveChannelConfigToD1(db, resolved.id, config);
		await ctx.reply(`✅ <b>${resolved.title}</b> enabled.`, { parse_mode: 'HTML' });
	});

	// /disable @channel
	registerArgCommand(bot, 'disable', async (ctx, arg) => {
		if (!arg) { await askForArg(ctx, kv, adminId, 'disable', '', channelPrompt('to disable.')); return; }
		const resolved = await resolveChannelArg(bot, db, arg);
		if (!resolved) { await ctx.reply('Channel not found.'); return; }
		const config = await getChannelConfigFromD1(db, resolved.id);
		if (!config) { await ctx.reply('Channel not registered.'); return; }
		config.enabled = false;
		await saveChannelConfigToD1(db, resolved.id, config);
		await ctx.reply(`❌ <b>${resolved.title}</b> disabled.`, { parse_mode: 'HTML' });
	});
}
