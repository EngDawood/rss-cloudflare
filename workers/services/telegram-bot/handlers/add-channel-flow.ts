import { InlineKeyboard } from 'grammy';
import type { Bot, Context } from 'grammy';
import { resolveChannel } from '../helpers/channel-resolver';
import { getChannelById, upsertChannel, getGlobalCheckInterval } from '../../../db/d1';
import { clearAdminState } from '../storage/admin-state';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';

/**
 * Directly add a channel by @username or ID.
 */
export async function addChannelDirect(
	ctx: Context,
	bot: Bot,
	db: D1Database,
	adminId: number,
	arg: string,
	kv: KVNamespace,
): Promise<void> {
	const resolved = await resolveChannel(bot, arg);
	if (!resolved) {
		await ctx.reply(
			`Could not find channel "${arg}". Make sure:\n` +
				'• The bot is added as admin to the channel\n' +
				'• You use @username or the numeric ID',
			{ parse_mode: 'HTML' }
		);
		return;
	}

	if (!resolved.isMember) {
		await ctx.reply(
			`⚠️ <b>Warning:</b> The bot is not a member of <b>${resolved.title}</b>.\n\n` +
				'Please add the bot to the channel/group as an <b>administrator</b> so it can post updates.',
			{ parse_mode: 'HTML' }
		);
	}

	const existing = await getChannelById(db, resolved.id);
	if (existing) {
		await clearAdminState(kv, adminId);
		await ctx.reply(`<b>${resolved.title}</b> is already registered. Use /channels to manage.`, { parse_mode: 'HTML' });
		return;
	}

	await upsertChannel(db, {
		id: resolved.id,
		name: resolved.title,
		enabled: true,
		checkIntervalMinutes: await getGlobalCheckInterval(db),
		lastCheckTimestamp: 0,
	});
	await clearAdminState(kv, adminId);

	const keyboard = new InlineKeyboard()
		.text('Configure this channel', `ch:${resolved.id}`);

	await ctx.reply(
		`✅ <b>${resolved.title}</b> added!\n\nNow subscribe to sources:\n<code>/sub @${arg.replace(/^@/, '')} @iguser</code> or\n<code>/sub @${arg.replace(/^@/, '')} https://feed-url</code>`,
		{ parse_mode: 'HTML', reply_markup: keyboard }
	);
}

/**
 * Register the chat the command was sent from (your DM with the bot, or any
 * group/channel) as a channel, so it gets the same /channels management UI
 * as a registered Telegram channel. Triggered by "/add me".
 */
export async function addPersonalChat(
	ctx: Context,
	db: D1Database,
	adminId: number,
	kv: KVNamespace,
): Promise<void> {
	const chatId = String(ctx.chat!.id);
	// Fixed single-word name: /sub, /unsub etc. resolve a channel by matching
	// a stored name against one whitespace-split token, so anything with a
	// space (a real display name, a group title) wouldn't be referenceable.
	const name = 'Personal';
	const displayName =
		ctx.chat!.type === 'private'
			? [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ') || ctx.from?.username || 'this chat'
			: ('title' in ctx.chat! ? ctx.chat.title : 'this chat');

	const existing = await getChannelById(db, chatId);
	if (existing) {
		await clearAdminState(kv, adminId);
		await ctx.reply(`<b>${escapeHtmlBot(existing.name)}</b> (this chat) is already registered. Use /channels to manage.`, { parse_mode: 'HTML' });
		return;
	}

	await upsertChannel(db, {
		id: chatId,
		name,
		enabled: true,
		checkIntervalMinutes: await getGlobalCheckInterval(db),
		lastCheckTimestamp: 0,
	});
	await clearAdminState(kv, adminId);

	const keyboard = new InlineKeyboard().text('Configure this chat', `ch:${chatId}`);

	await ctx.reply(
		`✅ This chat (<b>${escapeHtmlBot(displayName)}</b>) is now registered as <b>${name}</b>!\n\n` +
			`Now subscribe to sources:\n<code>/sub ${name} @iguser</code> or\n<code>/sub ${name} https://feed-url</code>\n\n` +
			`Manage it anytime from /channels, same as any other channel.`,
		{ parse_mode: 'HTML', reply_markup: keyboard }
	);
}
