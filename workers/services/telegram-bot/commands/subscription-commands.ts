import type { Bot } from 'grammy';
import type { ChannelSource } from '../../../types/telegram';
import { getChannelsListD1, getChannelConfigFromD1, saveChannelConfigToD1, upsertChannel, insertPostLog } from '../../../db/d1';
import { resolveChannelArg } from '../helpers/channel-resolver';
import { parseSourceRef, sourceTypeLabel, sourceTypeIcon, detectRSSBridgeSource } from '../helpers/source-parser';
import { fetchAndSendLatest } from '../handlers/fetch-and-send';
import { fetchForSource } from '../../source-fetcher';
import { fetchFeed } from '../../feed-fetcher';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';
import { registerArgCommand, askForArg, channelPrompt, channelSourcesHint } from '../helpers/command-args';

/**
 * Register subscription management commands.
 */
export function registerSubscriptionCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	const db = env.DB;
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);

	// /list — List all subscriptions across all channels
	bot.command('list', async (ctx) => {
		const channels = await getChannelsListD1(db);
		if (channels.length === 0) {
			await ctx.reply('No channels configured. Use /add @channel to add one.');
			return;
		}

		let text = '<b>Your Subscriptions:</b>\n\n';
		let foundAny = false;

		for (const channelId of channels) {
			const config = await getChannelConfigFromD1(db, channelId);
			if (!config || config.sources.length === 0) continue;

			foundAny = true;
			text += `<b>${config.channelTitle}</b>:\n`;
			for (const src of config.sources) {
				const status = src.enabled ? '✅' : '❌';
				const icon = sourceTypeIcon(src.type);
				text += `  ${status} ${icon} <code>${escapeHtmlBot(src.value)}</code>\n`;
			}
			text += '\n';
		}

		if (!foundAny) {
			text = 'No subscriptions found in any channel. Use <code>/sub</code> to add one.';
		}

		await ctx.reply(text, { parse_mode: 'HTML' });
	});

	// /sub @channel @iguser  OR  /sub @channel #hashtag  OR  /sub @channel https://...
	registerArgCommand(bot, 'sub', async (ctx, argStr) => {
		const args = argStr ? argStr.split(/\s+/) : [];
		if (args.length === 0) {
			await askForArg(ctx, kv, adminId, 'sub', '', channelPrompt('to subscribe.'));
			return;
		}
		if (args.length === 1) {
			const ch = await resolveChannelArg(bot, db, args[0]);
			if (!ch) {
				await ctx.reply(`Channel "${args[0]}" not found. Register it first with <code>/add ${args[0]}</code>`, { parse_mode: 'HTML' });
				return;
			}
			await askForArg(ctx, kv, adminId, 'sub', args[0],
				`Send the source to subscribe <b>${escapeHtmlBot(ch.title)}</b> to:\n\n` +
				'<code>@iguser</code> — Instagram user\n' +
				'<code>#hashtag</code> — Instagram hashtag\n' +
				'<code>tiktok @username</code> — TikTok user\n' +
				'<code>https://feed-url</code> — RSS/Atom feed\n\n' +
				'Add a number to also post the latest items, e.g. <code>@natgeo 5</code>'
			);
			return;
		}
		const channelRef = args[0];
		// Source ref might be a URL with special chars — rejoin remaining args (except trailing number)
		let sourceRefParts = args.slice(1);
		let postCount = 0;
		const lastArg = sourceRefParts[sourceRefParts.length - 1];
		if (/^\d+$/.test(lastArg) && sourceRefParts.length > 1) {
			postCount = Math.min(Math.max(parseInt(lastArg, 10), 1), 12);
			sourceRefParts = sourceRefParts.slice(0, -1);
		}
		const sourceRef = sourceRefParts.join(' ');

		const resolved = await resolveChannelArg(bot, db, channelRef);
		if (!resolved) {
			await ctx.reply(`Channel "${channelRef}" not found. Register it first with <code>/add ${channelRef}</code>`, { parse_mode: 'HTML' });
			return;
		}

		if (!resolved.isMember) {
			await ctx.reply(
				`⚠️ <b>Warning:</b> The bot is not a member of <b>${resolved.title}</b>.\n\n` +
				'Please add the bot to the channel/group as an <b>administrator</b> so it can post updates.',
				{ parse_mode: 'HTML' }
			);
		}

		// Auto-register channel if not yet registered
		let config = await getChannelConfigFromD1(db, resolved.id);
		if (!config) {
			config = { channelTitle: resolved.title, enabled: true, checkIntervalMinutes: 30, lastCheckTimestamp: 0, sources: [] };
			await upsertChannel(db, {
				id: resolved.id,
				name: resolved.title,
				enabled: true,
				checkIntervalMinutes: 30,
				lastCheckTimestamp: 0,
			});
		}

		let parsed = parseSourceRef(sourceRef);
		if (!parsed) {
			await ctx.reply('Invalid source. Use @username, #hashtag, or a feed URL.');
			return;
		}

		// Auto-detect RSS-Bridge URLs and convert to native types for failover support
		if (parsed.type === 'rss_url') {
			const bridgeSource = detectRSSBridgeSource(parsed.value);
			if (bridgeSource) {
				parsed = bridgeSource;
			}
		}

		if (config.sources.some((s) => s.value === parsed.value)) {
			await ctx.reply(`Already subscribed to <b>${escapeHtmlBot(parsed.value)}</b> in <b>${resolved.title}</b>.`, { parse_mode: 'HTML' });
			return;
		}

		// --- Validate feed before saving ---
		await ctx.reply('⏳ Validating feed...');

		if (parsed.type === 'rss_url') {
			// Strict validation: must be valid RSS/Atom XML
			const result = await fetchFeed(parsed.value);
			const isNotFeed = result.errors.some((e) => e.message?.includes('not RSS or Atom'));
			if (isNotFeed) {
				await ctx.reply('❌ This URL is not a valid RSS/Atom feed.');
				return;
			}
			if (result.errors.length > 0 && result.items.length === 0) {
				const errMsg = result.errors.map((e) => e.message).join('; ');
				await ctx.reply(`❌ Could not fetch feed: ${errMsg}`);
				return;
			}
		} else {
			// Lenient validation for RSS-Bridge-based sources (instagram, tiktok)
			// RSS-Bridge may be temporarily down, so save anyway but warn
			const tempSource: ChannelSource = { id: parsed.id, type: parsed.type, value: parsed.value, mediaFilter: 'all', enabled: true };
			const result = await fetchForSource(tempSource, env);
			if (result.items.length === 0 && result.errors.length > 0) {
				const errMsg = result.errors.map((e) => e.message).join('; ');
				await ctx.reply(
					`⚠️ Could not verify source right now (RSS-Bridge may be down):\n<code>${escapeHtmlBot(errMsg.slice(0, 200))}</code>\n\nSaving anyway — will retry on next cron check.`,
					{ parse_mode: 'HTML' }
				);
			}
		}

		const source: ChannelSource = { id: parsed.id, type: parsed.type, value: parsed.value, mediaFilter: 'all', enabled: true };
		config.sources.push(source);
		await saveChannelConfigToD1(db, resolved.id, config);

		const typeLabel = sourceTypeLabel(parsed.type);
		if (postCount > 0) {
			await ctx.reply(
				`✅ <b>${resolved.title}</b> subscribed to ${typeLabel}: <b>${escapeHtmlBot(parsed.value)}</b>\n\nFetching latest ${postCount} post(s)...`,
				{ parse_mode: 'HTML' }
			);
			await fetchAndSendLatest(bot, env, parseInt(resolved.id, 10), source, postCount, false, db);
		} else {
			await ctx.reply(
				`✅ <b>${resolved.title}</b> subscribed to ${typeLabel}: <b>${escapeHtmlBot(parsed.value)}</b>\n\nNew posts will arrive on next cron check.`,
				{ parse_mode: 'HTML' }
			);
		}
	});

	// /unsub @channel source
	registerArgCommand(bot, 'unsub', async (ctx, argStr) => {
		const args = argStr ? argStr.split(/\s+/) : [];
		if (args.length === 0) {
			await askForArg(ctx, kv, adminId, 'unsub', '', channelPrompt('to unsubscribe from.'));
			return;
		}
		if (args.length === 1) {
			const ch = await resolveChannelArg(bot, db, args[0]);
			if (!ch) { await ctx.reply(`Channel "${args[0]}" not found.`); return; }
			await askForArg(ctx, kv, adminId, 'unsub', args[0],
				`Send the source to remove from <b>${escapeHtmlBot(ch.title)}</b> (@username, #hashtag, or feed URL).` +
				await channelSourcesHint(db, ch.id)
			);
			return;
		}
		const [channelRef, ...sourceRefParts] = args;
		const sourceRef = sourceRefParts.join(' ');
		const resolved = await resolveChannelArg(bot, db, channelRef);
		if (!resolved) { await ctx.reply(`Channel "${channelRef}" not found.`); return; }

		const config = await getChannelConfigFromD1(db, resolved.id);
		if (!config) { await ctx.reply('Channel not registered.'); return; }

		const parsed = parseSourceRef(sourceRef);
		const before = config.sources.length;
		config.sources = config.sources.filter((s) => {
			// Match by value
			if (parsed && s.value === parsed.value) return false;
			if (s.value === sourceRef.replace(/^[@#]/, '')) return false;
			return true;
		});
		if (config.sources.length === before) {
			await ctx.reply(`Source "${sourceRef}" not found in <b>${resolved.title}</b>.`, { parse_mode: 'HTML' });
			return;
		}
		await saveChannelConfigToD1(db, resolved.id, config);
		await ctx.reply(`✅ Removed <b>${escapeHtmlBot(sourceRef)}</b> from <b>${resolved.title}</b>.`, { parse_mode: 'HTML' });
	});

	// /delay @channel <minutes>
	registerArgCommand(bot, 'delay', async (ctx, argStr) => {
		const args = argStr ? argStr.split(/\s+/) : [];
		if (args.length === 0) {
			await askForArg(ctx, kv, adminId, 'delay', '', channelPrompt('to set the check interval for.'));
			return;
		}
		if (args.length === 1) {
			const ch = await resolveChannelArg(bot, db, args[0]);
			if (!ch) { await ctx.reply(`Channel "${args[0]}" not found.`); return; }
			await askForArg(ctx, kv, adminId, 'delay', args[0],
				`Send the check interval in minutes for <b>${escapeHtmlBot(ch.title)}</b> (minimum 5).\n\nExample: <code>30</code>`
			);
			return;
		}
		const [channelRef, mins] = args;
		const minutes = parseInt(mins, 10);
		if (isNaN(minutes) || minutes < 5) {
			await ctx.reply('Delay must be at least 5 minutes.');
			return;
		}
		const resolvedChannel = await resolveChannelArg(bot, db, channelRef);
		if (!resolvedChannel) { await ctx.reply(`Channel "${channelRef}" not found.`); return; }

		const config = await getChannelConfigFromD1(db, resolvedChannel.id);
		if (!config) { await ctx.reply('Channel not registered.'); return; }

		config.checkIntervalMinutes = minutes;
		await saveChannelConfigToD1(db, resolvedChannel.id, config);
		await ctx.reply(`⏱ <b>${resolvedChannel.title}</b> delay set to <b>${minutes} min</b>`, { parse_mode: 'HTML' });
	});

	// /seed @channel [@source] — mark sources as read without sending
	registerArgCommand(bot, 'seed', async (ctx, argStr) => {
		const args = argStr ? argStr.split(/\s+/) : [];
		if (args.length === 0) {
			await askForArg(ctx, kv, adminId, 'seed', '',
				channelPrompt('to mark as read.') +
				'\n\nAdd a source after it to seed only that one, e.g. <code>@mychannel @natgeo</code>'
			);
			return;
		}
		const channelRef = args[0];
		const sourceRef = args.length > 1 ? args.slice(1).join(' ') : null;

		const resolved = await resolveChannelArg(bot, db, channelRef);
		if (!resolved) {
			await ctx.reply(`Channel "${channelRef}" not found.`);
			return;
		}

		const config = await getChannelConfigFromD1(db, resolved.id);
		if (!config || config.sources.length === 0) {
			await ctx.reply('No sources configured for this channel.');
			return;
		}

		// Determine which sources to seed
		let sourcesToSeed: ChannelSource[];
		if (sourceRef) {
			const parsed = parseSourceRef(sourceRef);
			if (!parsed) {
				await ctx.reply('Invalid source. Use @username, #hashtag, or a feed URL.');
				return;
			}
			const found = config.sources.find((s) => s.value === parsed.value);
			if (!found) {
				await ctx.reply(`Source "${sourceRef}" not found in <b>${resolved.title}</b>.`, { parse_mode: 'HTML' });
				return;
			}
			sourcesToSeed = [found];
		} else {
			sourcesToSeed = config.sources.filter((s) => s.enabled);
		}

		await ctx.reply(`Seeding ${sourcesToSeed.length} source(s) for <b>${resolved.title}</b>...`, { parse_mode: 'HTML' });

		const results: string[] = [];
		for (const source of sourcesToSeed) {
			try {
				const result = await fetchForSource(source, env);
				if (result.items.length === 0) {
					results.push(`${sourceTypeIcon(source.type)} ${escapeHtmlBot(source.value)} — no items found`);
					continue;
				}
				// Insert post_log rows to mark items as seeded (replaces KV sent-set)
				for (const item of result.items) {
					await insertPostLog(db, {
						itemId: item.id,
						chatId: resolved.id,
						messageType: 'seeded',
						captionPreview: item.title.slice(0, 200),
						status: 'ok',
					});
				}
				results.push(`${sourceTypeIcon(source.type)} ${escapeHtmlBot(source.value)} — marked ${result.items.length} items as seen`);
			} catch (err) {
				results.push(`${sourceTypeIcon(source.type)} ${escapeHtmlBot(source.value)} — error: ${err}`);
			}
		}

		await ctx.reply(`<b>Seed complete:</b>\n${results.join('\n')}`, { parse_mode: 'HTML' });
	});
}
