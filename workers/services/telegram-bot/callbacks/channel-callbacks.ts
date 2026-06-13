import { InlineKeyboard } from 'grammy';
import type { Bot } from 'grammy';
import { clearFailedPosts } from '../storage/kv-operations';
import { getChannelConfigFromD1, saveChannelConfigToD1, removeChannel } from '../../../db/d1';
import { showChannelConfig, showChannelsList, showFailedPosts } from '../views/channel-views';
import { editOrReply } from '../helpers/edit-or-reply';

/**
 * Register callback query handlers for channel management.
 */
export function registerChannelCallbacks(bot: Bot, env: Env, kv: KVNamespace): void {
	const db = env.DB;

	// Channel list → channel config
	bot.callbackQuery(/^ch:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		await showChannelConfig(ctx, db, channelId);
		await ctx.answerCallbackQuery();
	});

	// Toggle channel enabled/disabled
	bot.callbackQuery(/^ch_toggle:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }

		config.enabled = !config.enabled;
		await saveChannelConfigToD1(db, channelId, config);
		await showChannelConfig(ctx, db, channelId);
		await ctx.answerCallbackQuery({ text: config.enabled ? '✅ Enabled' : '❌ Disabled' });
	});

	// View failed posts
	bot.callbackQuery(/^failed_posts:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		await showFailedPosts(ctx, kv, db, channelId);
		await ctx.answerCallbackQuery();
	});

	// Clear failed posts log
	bot.callbackQuery(/^clear_failed:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		await clearFailedPosts(kv, channelId);
		await showFailedPosts(ctx, kv, db, channelId);
		await ctx.answerCallbackQuery({ text: 'Log cleared' });
	});

	// Remove channel (confirmation prompt)
	bot.callbackQuery(/^ch_remove:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const keyboard = new InlineKeyboard()
			.text('Yes, remove it', `ch_remove_confirm:${channelId}`)
			.text('Cancel', `ch:${channelId}`);
		await editOrReply(ctx,
			`Remove channel <code>${channelId}</code>?\n\nThis will delete all its sources.`,
			{ parse_mode: 'HTML', reply_markup: keyboard }
		);
		await ctx.answerCallbackQuery();
	});

	// Confirm channel removal
	bot.callbackQuery(/^ch_remove_confirm:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		await removeChannel(db, channelId);
		await editOrReply(ctx, `Channel <code>${channelId}</code> removed.`, { parse_mode: 'HTML' });
		await ctx.answerCallbackQuery({ text: 'Channel removed' });
	});

	// Set check interval options
	bot.callbackQuery(/^set_interval:([^:]+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const keyboard = new InlineKeyboard()
			.text('15 min', `interval:${channelId}:15`)
			.text('30 min', `interval:${channelId}:30`)
			.row()
			.text('1 hour', `interval:${channelId}:60`)
			.text('2 hours', `interval:${channelId}:120`)
			.row()
			.text('6 hours', `interval:${channelId}:360`)
			.text('12 hours', `interval:${channelId}:720`)
			.row()
			.text('« Back', `ch:${channelId}`);

		await editOrReply(ctx, '<b>Select check delay:</b>', { parse_mode: 'HTML', reply_markup: keyboard });
		await ctx.answerCallbackQuery();
	});

	// Apply interval
	bot.callbackQuery(/^interval:([^:]+):(\d+)$/, async (ctx) => {
		const channelId = ctx.match[1];
		const minutes = parseInt(ctx.match[2], 10);
		const config = await getChannelConfigFromD1(db, channelId);
		if (!config) { await ctx.answerCallbackQuery({ text: 'Channel not found' }); return; }

		config.checkIntervalMinutes = minutes;
		await saveChannelConfigToD1(db, channelId, config);
		await showChannelConfig(ctx, db, channelId);
		await ctx.answerCallbackQuery({ text: `Delay: ${minutes} min` });
	});

	// Back to channels list
	bot.callbackQuery('back:channels', async (ctx) => {
		await showChannelsList(ctx, db, 'edit');
		await ctx.answerCallbackQuery();
	});
}
