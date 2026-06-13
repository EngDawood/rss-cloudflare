import type { Bot } from 'grammy';
import { getChatByName, getDefaultChat, insertPostLog } from '../db/d1';
import { sendMediaToChannel } from './telegram-bot/handlers/send-media';
import type { TelegramMediaMessage } from '../types/telegram';

/**
 * PostService — single canonical home for the "resolve a post target" and
 * "send + log" helpers shared by the MCP tools (`mcp/tools.ts`) and the
 * Action API (`routes/action-api.ts`). Previously these were duplicated
 * near-verbatim in both files.
 */

/**
 * Resolve a post target (chat name, raw numeric id, or default chat) to a
 * concrete `{ chatId, chatName? }`.
 *
 * @throws if no target is given and no default chat is configured, or the
 *         target is neither a known chat name nor a numeric id.
 */
export async function resolveTarget(
	db: D1Database,
	target?: string,
): Promise<{ chatId: number; chatName?: string }> {
	if (!target) {
		const def = await getDefaultChat(db);
		if (!def) throw new Error('No target specified and no default chat configured. Use add_chat first.');
		return { chatId: parseInt(def.chat_id, 10), chatName: def.name };
	}
	const byName = await getChatByName(db, target);
	if (byName) return { chatId: parseInt(byName.chat_id, 10), chatName: byName.name };
	const numId = parseInt(target, 10);
	if (!isNaN(numId)) return { chatId: numId };
	throw new Error(`Unknown chat target: "${target}". Use a registered chat name or a numeric chat id.`);
}

/**
 * Send a media message to a chat and write a `post_log` row recording the
 * outcome (ok or error). Re-throws on failure after logging.
 */
export async function logAndSend(
	db: D1Database,
	bot: Bot,
	chatId: number,
	chatName: string | undefined,
	message: TelegramMediaMessage,
	itemId?: string,
): Promise<void> {
	const captionPreview = message.caption.slice(0, 200);
	try {
		await sendMediaToChannel(bot, chatId, message);
		await insertPostLog(db, {
			itemId,
			chatName,
			chatId: String(chatId),
			messageType: message.type,
			captionPreview,
			status: 'ok',
		});
	} catch (e) {
		await insertPostLog(db, {
			itemId,
			chatName,
			chatId: String(chatId),
			messageType: message.type,
			captionPreview,
			status: 'error',
			error: e instanceof Error ? e.message : String(e),
		});
		throw e;
	}
}
