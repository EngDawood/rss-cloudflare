import type { Bot } from 'grammy';
import type { FeedItem } from '../../../types/feed';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';
import { FileTooLargeError } from '../handlers/send-media';

/**
 * Send a fallback message when the original media fails.
 * Tries to send thumbnail (if available) with caption + link, or just text with link.
 */
export async function sendFallbackMessage(
	bot: Bot,
	chatId: number,
	item: FeedItem,
	fallbackMode: 'thumbnail_link' | 'thumbnail' = 'thumbnail_link',
	error?: unknown
): Promise<void> {
	const thumbnail = item.media[0]?.thumbnailUrl;
	const link = item.link;

	let caption = item.text
		? `${escapeHtmlBot(item.text.substring(0, 1000))}${item.text.length > 1000 ? '…' : ''}`
		: '';

	// Add error note if available
	if (error instanceof FileTooLargeError) {
		caption += `\n\n⚠️ <b>File exceeds Telegram's 50MB limit.</b>`;
	}

	if (fallbackMode === 'thumbnail_link') {
		caption += caption ? `\n\n<a href="${link}">View original post</a>` : `<a href="${link}">View original post</a>`;
	}

	if (thumbnail) {
		// Send thumbnail image with caption
		await bot.api.sendPhoto(chatId, thumbnail, {
			caption,
			parse_mode: 'HTML',
		});
	} else {
		// No thumbnail, send text
		await bot.api.sendMessage(chatId, caption || 'Media failed to send.', {
			parse_mode: 'HTML',
		});
	}
}
