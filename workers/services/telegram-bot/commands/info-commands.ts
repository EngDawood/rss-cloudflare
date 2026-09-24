import type { Bot } from 'grammy';
import { getAdminState, clearAdminState } from '../storage/admin-state';
import { BOT_COMMANDS } from '../../../routes/setup';

/**
 * Register basic information and control commands.
 */
export function registerInfoCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	const adminId = parseInt(env.ADMIN_TELEGRAM_ID, 10);

	bot.command('start', async (ctx) => {
		await ctx.reply(
			'<b>Welcome to RSS Feed Bridge!</b>\n\n' +
				'I help you track Instagram profiles, TikTok users, and RSS feeds, and automatically post updates to your Telegram channels.\n\n' +
				'<b>Quick Subscriptions:</b>\n' +
				'/sub @channel @user — Subscribe to IG user\n' +
				'/sub @channel #tag — Subscribe to IG hashtag\n' +
				'/sub @channel tiktok @user — Subscribe to TikTok user\n' +
				'/sub @channel https://... — Subscribe to RSS feed\n' +
				'/unsub @channel source — Unsubscribe\n\n' +
				'<b>Management:</b>\n' +
				'/channels — Manage your channels\n' +
				'/add @channel — Register a new channel\n' +
				'/add me — Register this chat (e.g. your personal DM) instead\n' +
				'/list — See all active subscriptions\n' +
				'/status — Overview of all channels\n' +
				'/chats — Manage named chats (post targets & default)\n\n' +
				'<b>Configuration:</b>\n' +
				'/set @channel source — Custom format for a source\n' +
				'/set_default — Default format for all channels\n' +
				'/set_default @channel — Default format for a channel\n' +
				'/set_default delay 30 — Default check interval for new channels\n' +
				'/delay @channel 30 — Set check interval (min)\n' +
				'/telegraph — Configure Telegraph Instant View\n' +
				'/ai — Configure AI summary settings\n\n' +
				'<b>More:</b>\n' +
				'• Send any supported URL (TikTok, IG, X, YT) to download media\n' +
				'• Use /cancel to stop any current action\n' +
				'• Use /help for detailed instructions',
			{ parse_mode: 'HTML' }
		);
		await ctx.api.setMyCommands(BOT_COMMANDS).catch(() => {});
	});

	bot.command('help', async (ctx) => {
		await ctx.reply(
			'<b>Getting Started:</b>\n\n' +
				'1. Add this bot to your Telegram channel as an administrator.\n' +
				'2. Link the channel: <code>/add @your_channel_name</code>\n' +
				'3. Subscribe to a source: <code>/sub @your_channel_name @instagram_user</code>\n' +
				'4. Sit back! The bot will now automatically check for and post updates.\n\n' +
				'<b>Supported Source Types:</b>\n' +
				'• <code>@username</code> — Instagram profile\n' +
				'• <code>#hashtag</code> — Instagram hashtag\n' +
				'• <code>tiktok @username</code> — TikTok profile\n' +
				'• <code>https://...</code> — Any valid RSS/Atom feed URL\n\n' +
				'<b>Helpful Examples:</b>\n' +
				'• <code>/sub @my_channel @natgeo</code>\n' +
				'• <code>/sub @my_channel #nature</code>\n' +
				'• <code>/unsub @my_channel @natgeo</code>\n' +
				'• <code>/delay @my_channel 60</code> (check every hour)\n\n' +
				'<b>Media Download:</b>\n' +
				'Simply paste a link from TikTok, Instagram, X/Twitter, YouTube, Facebook, Threads, SoundCloud, Spotify, or Pinterest to download and receive the media file directly.\n\n' +
				'<b>Telegraph Instant View:</b>\n' +
				'Use <code>/telegraph</code> to enable/disable automatic Telegraph pages for long RSS articles, set the character threshold, and manage the access token.\n\n' +
				'<b>Default Check Interval:</b>\n' +
				'Use <code>/set_default delay &lt;minutes&gt;</code> to change the default check interval applied to newly registered channels (existing channels keep <code>/delay @channel</code>).\n\n' +
				'<b>AI Summaries:</b>\n' +
				'Use <code>/ai</code> to enable AI-generated summaries at the global, channel, or source level.\n\n' +
				'<b>Named Chats (post targets):</b>\n' +
				'These are separate from your auto-post channels — used as manual/AI-agent post targets, one of which can be the default.\n' +
				'• <code>/chats</code> — list named chats\n' +
				'• <code>/addchat name @user_or_id [type] [default]</code> — add or update\n' +
				'• <code>/defaultchat name</code> — set the default\n' +
				'• <code>/rmchat name</code> — remove\n\n' +
				'<b>Personal Mode:</b>\n' +
				'Your own DM with the bot can be a subscription target too, managed exactly like a channel.\n' +
				'• <code>/add me</code> — register this chat\n' +
				'• Then <code>/sub Personal @iguser</code> etc. (use the name shown after registering)\n' +
				'• Shows up in <code>/channels</code> and <code>/status</code> alongside your real channels',
			{ parse_mode: 'HTML' }
		);
	});

	bot.command('cancel', async (ctx) => {
		const state = await getAdminState(kv, adminId);
		await clearAdminState(kv, adminId);
		// Edit any stuck in-progress status message (e.g. "Fetching available qualities...")
		if (state?.context?.statusMessageId) {
			try {
				await bot.api.editMessageText(ctx.chat!.id, state.context.statusMessageId, 'Cancelled.');
			} catch { /* message may already be gone */ }
		}
		await ctx.reply('Current action cancelled. How else can I help?');
	});
}
