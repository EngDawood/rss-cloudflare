import type { Bot } from 'grammy';
import { resolveChannelArg } from '../helpers/channel-resolver';
import { getFoloChannelIds, addFoloChannel, removeFoloChannel, getChannelById } from '../../../db/d1';

/**
 * Register /folo command — manage which channels receive Folo webhook pushes.
 *
 * /folo              — show webhook URL + subscribed channels
 * /folo add @channel — subscribe a channel
 * /folo remove @channel — unsubscribe a channel
 */
export function registerFoloCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	bot.command('folo', async (ctx) => {
		const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
		const subcommand = args[0]?.toLowerCase();
		const channelArg = args[1];

		const secret = env.FOLO_WEBHOOK_SECRET;
		const tokenPart = secret ? `?token=${encodeURIComponent(secret)}` : '';
		const webhookUrl = `${env.WORKER_URL}/folo${tokenPart}`;

		// /folo add @channel
		if (subcommand === 'add') {
			if (!channelArg) {
				await ctx.reply('Usage: <code>/folo add @channel</code>', { parse_mode: 'HTML' });
				return;
			}
			const resolved = await resolveChannelArg(bot, env.DB, channelArg);
			if (!resolved) {
				await ctx.reply(`Could not resolve channel: <code>${channelArg}</code>`, { parse_mode: 'HTML' });
				return;
			}
			const channels = await getFoloChannelIds(env.DB);
			if (channels.includes(resolved.id)) {
				await ctx.reply(`<b>${resolved.title}</b> is already subscribed to Folo.`, { parse_mode: 'HTML' });
				return;
			}
			await addFoloChannel(env.DB, resolved.id);
			await ctx.reply(
				`✅ <b>${resolved.title}</b> will now receive Folo webhook posts.\n\n` +
					`Webhook URL:\n<code>${webhookUrl}</code>`,
				{ parse_mode: 'HTML' }
			);
			return;
		}

		// /folo remove @channel
		if (subcommand === 'remove') {
			if (!channelArg) {
				await ctx.reply('Usage: <code>/folo remove @channel</code>', { parse_mode: 'HTML' });
				return;
			}
			const resolved = await resolveChannelArg(bot, env.DB, channelArg);
			if (!resolved) {
				await ctx.reply(`Could not resolve channel: <code>${channelArg}</code>`, { parse_mode: 'HTML' });
				return;
			}
			const channels = await getFoloChannelIds(env.DB);
			if (!channels.includes(resolved.id)) {
				await ctx.reply(`<b>${resolved.title}</b> is not subscribed to Folo.`, { parse_mode: 'HTML' });
				return;
			}
			await removeFoloChannel(env.DB, resolved.id);
			await ctx.reply(`✅ <b>${resolved.title}</b> removed from Folo subscribers.`, { parse_mode: 'HTML' });
			return;
		}

		// /folo — show status
		const channelIds = await getFoloChannelIds(env.DB);
		let channelList = 'No channels subscribed yet.';
		if (channelIds.length > 0) {
			const lines: string[] = [];
			for (const id of channelIds) {
				const channel = await getChannelById(env.DB, id);
				const title = channel?.name || id;
				lines.push(`• ${title} (<code>${id}</code>)`);
			}
			channelList = lines.join('\n');
		}

		await ctx.reply(
			'<b>Folo Webhook Integration</b>\n\n' +
				`<b>Webhook URL:</b>\n<code>${webhookUrl}</code>\n\n` +
				'<b>Subscribed channels:</b>\n' +
				channelList + '\n\n' +
				'<b>Commands:</b>\n' +
				'<code>/folo add @channel</code> — subscribe\n' +
				'<code>/folo remove @channel</code> — unsubscribe',
			{ parse_mode: 'HTML' }
		);
	});
}
