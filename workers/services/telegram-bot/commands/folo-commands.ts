import { Bot, InlineKeyboard } from 'grammy';
import { resolveChannelArg } from '../helpers/channel-resolver';
import {
	getFoloChannelIds, addFoloChannel, removeFoloChannel, getChannelById,
	listFoloWebhooks, getFoloWebhook, createFoloWebhook, deleteFoloWebhook,
	getFoloWebhookChannels, addFoloWebhookChannel, removeFoloWebhookChannel,
	getFoloFeeds, getTelegramSubscriptions, addTelegramSubscription, removeTelegramSubscription,
} from '../../../db/d1';

/**
 * /folo                             — list all webhooks (legacy + named)
 * /folo new <id> <name>             — create a named webhook (auto-generates token)
 * /folo del <id>                    — delete a named webhook
 * /folo info <id>                   — show URL + subscribed channels for a named webhook
 * /folo add @channel                — subscribe channel to legacy webhook (env secret)
 * /folo add <id> @channel           — subscribe channel to a named webhook
 * /folo remove @channel             — unsubscribe from legacy webhook
 * /folo remove <id> @channel        — unsubscribe from a named webhook
 */
export function registerFoloCommands(bot: Bot, env: Env, _kv: KVNamespace): void {
	bot.command('folo', async (ctx) => {
		const args = ctx.message?.text?.split(/\s+/).slice(1) || [];
		const subcommand = args[0]?.toLowerCase();

		// /folo new <id> <name>
		if (subcommand === 'new') {
			const id = args[1];
			const name = args.slice(2).join(' ');
			if (!id || !name) {
				await ctx.reply(
					'Usage: <code>/folo new &lt;id&gt; &lt;name&gt;</code>\n' +
					'Example: <code>/folo new personal Personal Feeds</code>',
					{ parse_mode: 'HTML' }
				);
				return;
			}
			if (await getFoloWebhook(env.DB, id)) {
				await ctx.reply(`A webhook with ID <code>${id}</code> already exists.`, { parse_mode: 'HTML' });
				return;
			}
			const token = crypto.randomUUID().replace(/-/g, '');
			await createFoloWebhook(env.DB, id, name, token);
			const webhookUrl = `${env.WORKER_URL}/folo?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`;
			await ctx.reply(
				`✅ Webhook <b>${name}</b> created!\n\n` +
				`<b>URL:</b>\n<code>${webhookUrl}</code>\n\n` +
				`Add channels: <code>/folo add ${id} @channel</code>`,
				{ parse_mode: 'HTML' }
			);
			return;
		}

		// /folo del <id>
		if (subcommand === 'del') {
			const id = args[1];
			if (!id) {
				await ctx.reply('Usage: <code>/folo del &lt;id&gt;</code>', { parse_mode: 'HTML' });
				return;
			}
			const webhook = await getFoloWebhook(env.DB, id);
			if (!webhook) {
				await ctx.reply(`No webhook found with ID <code>${id}</code>.`, { parse_mode: 'HTML' });
				return;
			}
			await deleteFoloWebhook(env.DB, id);
			await ctx.reply(
				`✅ Webhook <b>${webhook.name}</b> deleted (subscriptions removed).`,
				{ parse_mode: 'HTML' }
			);
			return;
		}

		// /folo info <id>
		if (subcommand === 'info') {
			const id = args[1];
			if (!id) {
				await ctx.reply('Usage: <code>/folo info &lt;id&gt;</code>', { parse_mode: 'HTML' });
				return;
			}
			const webhook = await getFoloWebhook(env.DB, id);
			if (!webhook) {
				await ctx.reply(`No webhook found with ID <code>${id}</code>.`, { parse_mode: 'HTML' });
				return;
			}
			const tokenPart = webhook.token
				? `&token=${encodeURIComponent(webhook.token)}`
				: '';
			const webhookUrl = `${env.WORKER_URL}/folo?id=${encodeURIComponent(id)}${tokenPart}`;
			const channelIds = await getFoloWebhookChannels(env.DB, id);
			let channelList = 'No channels subscribed.';
			if (channelIds.length > 0) {
				const lines: string[] = [];
				for (const cid of channelIds) {
					const ch = await getChannelById(env.DB, cid);
					lines.push(`• ${ch?.name || cid} (<code>${cid}</code>)`);
				}
				channelList = lines.join('\n');
			}
			await ctx.reply(
				`<b>${webhook.name}</b> (<code>${id}</code>)\n\n` +
				`<b>URL:</b>\n<code>${webhookUrl}</code>\n\n` +
				`<b>Channels:</b>\n${channelList}`,
				{ parse_mode: 'HTML' }
			);
			return;
		}

		// /folo add — two forms:
		//   /folo add @channel          → legacy (env secret webhook)
		//   /folo add <id> @channel     → named webhook
		if (subcommand === 'add') {
			const isLegacy = args[1]?.startsWith('@') || (args[1] && /^-?\d+$/.test(args[1]));
			if (isLegacy) {
				// Legacy subscribe
				const channelArg = args[1];
				if (!channelArg) {
					await ctx.reply('Usage: <code>/folo add @channel</code> or <code>/folo add &lt;webhookId&gt; @channel</code>', { parse_mode: 'HTML' });
					return;
				}
				const resolved = await resolveChannelArg(bot, env.DB, channelArg);
				if (!resolved) {
					await ctx.reply(`Could not resolve channel: <code>${channelArg}</code>`, { parse_mode: 'HTML' });
					return;
				}
				const existing = await getFoloChannelIds(env.DB);
				if (existing.includes(resolved.id)) {
					await ctx.reply(`<b>${resolved.title}</b> is already subscribed to the legacy Folo webhook.`, { parse_mode: 'HTML' });
					return;
				}
				await addFoloChannel(env.DB, resolved.id);
				const secret = env.FOLO_WEBHOOK_SECRET;
				const tokenPart = secret ? `?token=${encodeURIComponent(secret)}` : '';
				const webhookUrl = `${env.WORKER_URL}/folo${tokenPart}`;
				await ctx.reply(
					`✅ <b>${resolved.title}</b> subscribed to the Folo webhook.\n\n` +
					`<b>URL:</b>\n<code>${webhookUrl}</code>`,
					{ parse_mode: 'HTML' }
				);
			} else {
				// Named webhook subscribe
				const id = args[1];
				const channelArg = args[2];
				if (!id || !channelArg) {
					await ctx.reply('Usage: <code>/folo add &lt;webhookId&gt; @channel</code>', { parse_mode: 'HTML' });
					return;
				}
				const webhook = await getFoloWebhook(env.DB, id);
				if (!webhook) {
					await ctx.reply(`No webhook found with ID <code>${id}</code>.`, { parse_mode: 'HTML' });
					return;
				}
				const resolved = await resolveChannelArg(bot, env.DB, channelArg);
				if (!resolved) {
					await ctx.reply(`Could not resolve channel: <code>${channelArg}</code>`, { parse_mode: 'HTML' });
					return;
				}
				await addFoloWebhookChannel(env.DB, resolved.id, id);
				await ctx.reply(
					`✅ <b>${resolved.title}</b> subscribed to webhook <b>${webhook.name}</b>.`,
					{ parse_mode: 'HTML' }
				);
			}
			return;
		}

		// /folo remove — two forms:
		//   /folo remove @channel          → legacy
		//   /folo remove <id> @channel     → named webhook
		if (subcommand === 'remove') {
			const isLegacy = args[1]?.startsWith('@') || (args[1] && /^-?\d+$/.test(args[1]));
			if (isLegacy) {
				const channelArg = args[1];
				const resolved = await resolveChannelArg(bot, env.DB, channelArg);
				if (!resolved) {
					await ctx.reply(`Could not resolve channel: <code>${channelArg}</code>`, { parse_mode: 'HTML' });
					return;
				}
				await removeFoloChannel(env.DB, resolved.id);
				await ctx.reply(`✅ <b>${resolved.title}</b> unsubscribed from the legacy Folo webhook.`, { parse_mode: 'HTML' });
			} else {
				const id = args[1];
				const channelArg = args[2];
				if (!id || !channelArg) {
					await ctx.reply('Usage: <code>/folo remove &lt;webhookId&gt; @channel</code>', { parse_mode: 'HTML' });
					return;
				}
				const webhook = await getFoloWebhook(env.DB, id);
				if (!webhook) {
					await ctx.reply(`No webhook found with ID <code>${id}</code>.`, { parse_mode: 'HTML' });
					return;
				}
				const resolved = await resolveChannelArg(bot, env.DB, channelArg);
				if (!resolved) {
					await ctx.reply(`Could not resolve channel: <code>${channelArg}</code>`, { parse_mode: 'HTML' });
					return;
				}
				await removeFoloWebhookChannel(env.DB, resolved.id, id);
				await ctx.reply(
					`✅ <b>${resolved.title}</b> unsubscribed from webhook <b>${webhook.name}</b>.`,
					{ parse_mode: 'HTML' }
				);
			}
			return;
		}

		// /folo sub @channel
		if (subcommand === 'sub' || subcommand === 'subscribe') {
			const channelArg = args[1];
			if (!channelArg) {
				await ctx.reply('Usage: <code>/folo sub @channel</code>', { parse_mode: 'HTML' });
				return;
			}
			const resolved = await resolveChannelArg(bot, env.DB, channelArg);
			if (!resolved) {
				await ctx.reply(`Could not resolve channel: <code>${channelArg}</code>`, { parse_mode: 'HTML' });
				return;
			}

			const foloFeeds = await getFoloFeeds(env.DB);
			if (foloFeeds.length === 0) {
				await ctx.reply('No Folo feeds are currently registered. Feeds are registered automatically when they push new articles via Folo webhooks.');
				return;
			}

			const subs = await getTelegramSubscriptions(env.DB, resolved.id);
			const subbedFeedIds = new Set(subs.map(s => s.feed_id));

			const keyboard = new InlineKeyboard();
			for (const feed of foloFeeds) {
				const isSubbed = subbedFeedIds.has(feed.id);
				const label = `${isSubbed ? '✅' : '➕'} ${feed.title || feed.source_value}`;
				const callbackData = isSubbed
					? `folounsub:${resolved.id}:${feed.id}`
					: `folosub:${resolved.id}:${feed.id}`;
				keyboard.text(label, callbackData).row();
			}

			await ctx.reply(
				`<b>Folo Feed Subscriptions for ${resolved.title}</b>\n\n` +
				`Click on a feed to subscribe/unsubscribe this channel:`,
				{ parse_mode: 'HTML', reply_markup: keyboard }
			);
			return;
		}

		// /folo — overview
		const secret = env.FOLO_WEBHOOK_SECRET;
		const legacyTokenPart = secret ? `?token=${encodeURIComponent(secret)}` : '';
		const legacyUrl = `${env.WORKER_URL}/folo${legacyTokenPart}`;
		const legacyChannelIds = await getFoloChannelIds(env.DB);
		const webhooks = await listFoloWebhooks(env.DB);

		const legacyLine = secret
			? `<b>Legacy webhook</b> (env secret): <code>${legacyUrl}</code>\n  ${legacyChannelIds.length} channel(s) subscribed`
			: '<b>Legacy webhook:</b> no env secret set';

		let webhookLines = 'No named webhooks created yet.';
		if (webhooks.length > 0) {
			const lines: string[] = [];
			for (const wh of webhooks) {
				const count = (await getFoloWebhookChannels(env.DB, wh.id)).length;
				lines.push(`• <b>${wh.name}</b> (<code>${wh.id}</code>) — ${count} channel(s)`);
			}
			webhookLines = lines.join('\n');
		}

		await ctx.reply(
			'<b>Folo Webhook Integration</b>\n\n' +
			legacyLine + '\n\n' +
			'<b>Named webhooks:</b>\n' + webhookLines + '\n\n' +
			'<b>Commands:</b>\n' +
			'<code>/folo new &lt;id&gt; &lt;name&gt;</code> — create webhook\n' +
			'<code>/folo info &lt;id&gt;</code> — URL + channels\n' +
			'<code>/folo add &lt;id&gt; @channel</code> — subscribe to webhook\n' +
			'<code>/folo remove &lt;id&gt; @channel</code> — unsubscribe from webhook\n' +
			'<code>/folo sub @channel</code> — subscribe to custom feed\n' +
			'<code>/folo del &lt;id&gt;</code> — delete webhook',
			{ parse_mode: 'HTML' }
		);
	});

	bot.callbackQuery(/^folosub:(-?\d+):([a-f0-9]+)$/, async (ctx) => {
		const match = ctx.match;
		if (!match) return;
		const channelId = match[1];
		const feedId = match[2];

		await addTelegramSubscription(env.DB, { channelId, feedId });
		await ctx.answerCallbackQuery({ text: 'Subscribed successfully!' });

		// Update keyboard
		await updateFoloSubKeyboard(ctx, channelId, env.DB);
	});

	bot.callbackQuery(/^folounsub:(-?\d+):([a-f0-9]+)$/, async (ctx) => {
		const match = ctx.match;
		if (!match) return;
		const channelId = match[1];
		const feedId = match[2];

		await removeTelegramSubscription(env.DB, channelId, feedId);
		await ctx.answerCallbackQuery({ text: 'Unsubscribed successfully!' });

		// Update keyboard
		await updateFoloSubKeyboard(ctx, channelId, env.DB);
	});
}

async function updateFoloSubKeyboard(ctx: any, channelId: string, db: D1Database) {
	const foloFeeds = await getFoloFeeds(db);
	const subs = await getTelegramSubscriptions(db, channelId);
	const subbedFeedIds = new Set(subs.map(s => s.feed_id));

	const keyboard = new InlineKeyboard();
	for (const feed of foloFeeds) {
		const isSubbed = subbedFeedIds.has(feed.id);
		const label = `${isSubbed ? '✅' : '➕'} ${feed.title || feed.source_value}`;
		const callbackData = isSubbed
			? `folounsub:${channelId}:${feed.id}`
			: `folosub:${channelId}:${feed.id}`;
		keyboard.text(label, callbackData).row();
	}

	try {
		await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
	} catch (err) {
		console.warn('Failed to edit callback keyboard:', err);
	}
}
