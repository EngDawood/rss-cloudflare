import type { Bot } from 'grammy';
import { getChats, getChatByName, upsertChat, removeChat, setDefaultChat } from '../../../db/chats';
import { resolveChannel } from '../helpers/channel-resolver';
import { escapeHtml } from '../../../utils/text';

/**
 * Register named-chat management commands (the `chats` table: default/manual
 * post targets used by post_to_telegram/post_message, distinct from the
 * `channels` auto-post subscriptions managed by /add and /channels).
 */
export function registerChatCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	const db = env.DB;

	bot.command('chats', async (ctx) => {
		const chats = await getChats(db);
		if (chats.length === 0) {
			await ctx.reply('No named chats configured.\n\nUse /addchat name @user_or_id to add one.');
			return;
		}
		let text = '<b>Named Chats</b>\n\n';
		for (const chat of chats) {
			const star = chat.is_default ? ' ⭐ default' : '';
			text += `• <b>${escapeHtml(chat.name)}</b> — <code>${escapeHtml(chat.chat_id)}</code> (${escapeHtml(chat.type)})${star}\n`;
		}
		text +=
			'\n<code>/addchat name @user_or_id [type] [default]</code> — add or update\n' +
			'<code>/defaultchat name</code> — set default\n' +
			'<code>/rmchat name</code> — remove';
		await ctx.reply(text, { parse_mode: 'HTML' });
	});

	bot.command('addchat', async (ctx) => {
		const parts = (ctx.match?.trim() ?? '').split(/\s+/).filter(Boolean);
		if (parts.length < 2) {
			await ctx.reply(
				'Usage: <code>/addchat name @user_or_id [type] [default]</code>\n\n' +
					'Example: <code>/addchat news @mychannel channel default</code>',
				{ parse_mode: 'HTML' }
			);
			return;
		}
		const [name, target, ...rest] = parts;
		const makeDefault = rest.includes('default');
		const type = rest.find((r) => r !== 'default') ?? 'channel';

		let chatId: string;
		if (/^-?\d+$/.test(target)) {
			chatId = target;
		} else {
			const resolved = await resolveChannel(bot, target.startsWith('@') ? target : `@${target}`);
			if (!resolved) {
				await ctx.reply(`Could not resolve "${escapeHtml(target)}".`);
				return;
			}
			chatId = resolved.id;
		}

		const chat = await upsertChat(db, name, chatId, type, makeDefault);
		await ctx.reply(
			`✅ Saved <b>${escapeHtml(chat.name)}</b> → <code>${escapeHtml(chat.chat_id)}</code>` +
				(chat.is_default ? ' (default)' : ''),
			{ parse_mode: 'HTML' }
		);
	});

	bot.command('rmchat', async (ctx) => {
		const name = ctx.match?.trim();
		if (!name) {
			await ctx.reply('Usage: <code>/rmchat name</code>', { parse_mode: 'HTML' });
			return;
		}
		const chat = await getChatByName(db, name);
		if (!chat) {
			await ctx.reply(`Chat "${escapeHtml(name)}" not found.`, { parse_mode: 'HTML' });
			return;
		}
		await removeChat(db, name);
		await ctx.reply(`🗑️ Removed "${escapeHtml(name)}".`, { parse_mode: 'HTML' });
	});

	bot.command('defaultchat', async (ctx) => {
		const name = ctx.match?.trim();
		if (!name) {
			await ctx.reply('Usage: <code>/defaultchat name</code>', { parse_mode: 'HTML' });
			return;
		}
		const chat = await getChatByName(db, name);
		if (!chat) {
			await ctx.reply(`Chat "${escapeHtml(name)}" not found.`, { parse_mode: 'HTML' });
			return;
		}
		await setDefaultChat(db, name);
		await ctx.reply(`⭐ "${escapeHtml(name)}" is now the default chat.`, { parse_mode: 'HTML' });
	});
}
