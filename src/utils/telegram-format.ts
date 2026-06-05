import type { FeedItem } from '../types/feed';
import type { FormatSettings, TelegramMediaMessage } from '../types/telegram';
import { DEFAULT_FORMAT_SETTINGS } from '../constants';

/**
 * Merge hardcoded defaults < channel defaults < source overrides.
 */
export function resolveFormatSettings(
	channelDefaults?: Partial<FormatSettings>,
	sourceOverrides?: Partial<FormatSettings>
): FormatSettings {
	return {
		...DEFAULT_FORMAT_SETTINGS,
		...channelDefaults,
		...sourceOverrides,
	};
}

/**
 * Convert a FeedItem into a Telegram-ready message structure.
 * Uses HTML parse mode for captions (supports <a>, <b>, <i> tags).
 */
export function formatFeedItem(item: FeedItem, settings?: FormatSettings): TelegramMediaMessage {
	const resolved = settings ?? DEFAULT_FORMAT_SETTINGS;

	// 'only_media' sends media with footer only (no caption body)
	const caption = resolved.media === 'only_media'
		? buildFooter(item, resolved)
		: buildTelegramCaption(item, resolved);

	// 'disable' sends text-only message with no media
	if (resolved.media === 'disable') {
		return { type: 'text', caption };
	}

	switch (item.mediaType) {
		case 'photo':
			return { type: 'photo', url: item.media[0]?.url, caption };

		case 'video':
			return {
				type: 'video',
				url: item.media[0]?.url,
				thumbnailUrl: item.media[0]?.thumbnailUrl,
				caption,
			};

		case 'album': {
			if (item.media.length === 0) {
				return { type: 'text', caption };
			}
			const media = item.media.map((m, idx) => ({
				type: m.type,
				media: m.url,
				// Only first item gets caption in a media group
				...(idx === 0 ? { caption, parse_mode: 'HTML' } : {}),
			}));
			return { type: 'mediagroup', media, caption };
		}

		case 'none':
		default:
			return { type: 'text', caption };
	}
}

function buildTelegramCaption(item: FeedItem, settings: FormatSettings): string {
	let rawText = item.text;

	// Apply cleanup text (remove specified phrases)
	if (settings.cleanupText) {
		const phrases = settings.cleanupText.split('\n').map((p) => p.trim()).filter((p) => p.length > 0);
		for (const phrase of phrases) {
			// Case-insensitive global replacement of the phrase
			const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(escapedPhrase, 'gi');
			rawText = rawText.replace(regex, '');
		}
		rawText = rawText.replace(/\s+/g, ' ').trim();
	}

	let text = escapeHtml(rawText);

	// Prepend article title for non-Instagram text items (RSS articles, blog posts)
	const titlePrefix = item.title &&
		item.mediaType === 'none' &&
		!isInstagramItem(item) &&
		!text.startsWith(escapeHtml(item.title).substring(0, 20));
	if (titlePrefix) {
		text = `<b>${escapeHtml(item.title)}</b>\n\n${text}`;
	}

	// Handle TikTok views removal
	if (settings.removeTikTokViews === 'enable' && isTikTokItem(item)) {
		// Pattern matches " (123.4K views)" or " (1.2M views)" or " (100 views)"
		text = text.replace(/\s?\(\d+(\.\d+)?[KM]?\s+views\)/gi, '').trim();
	}

	// Handle hashtags
	if (settings.hashtags === 'disable') {
		// Remove hashtags (word starting with # followed by alphanumeric)
		text = text.replace(/#\w+/g, '').replace(/\s+/g, ' ').trim();
	} else if (isInstagramItem(item)) {
		// Link hashtags to Instagram URLs
		text = text.replace(/#([\w]+)/g, '<a href="https://www.instagram.com/explore/tags/$1">#$1</a>');
	}

	// Instagram-specific: link @mentions
	if (isInstagramItem(item)) {
		text = text.replace(/@([\w.]+)/g, '<a href="https://www.instagram.com/$1">@$1</a>');
	}

	// Add custom header
	if (settings.customHeader) {
		text = settings.customHeader + '\n\n' + text;
	}

	// Add extra hashtags
	if (settings.customHashtags) {
		text = text + '\n\n' + settings.customHashtags;
	}

	// Add custom footer
	if (settings.customFooter) {
		text = text + '\n\n' + settings.customFooter;
	}

	const footer = buildFooter(item, settings);

	// Telegram limits: 1024 for media captions, 4096 for text messages
	const telegramLimit = settings.media === 'disable' || item.mediaType === 'none' ? 4096 : 1024;
	const effectiveLimit = settings.lengthLimit > 0
		? Math.min(settings.lengthLimit, telegramLimit)
		: telegramLimit;
	const maxCaptionBody = effectiveLimit - footer.length;

	if (text.length > maxCaptionBody) {
		text = text.substring(0, maxCaptionBody - 1) + '\u2026';
	}

	return text + footer;
}

function buildFooter(item: FeedItem, settings: FormatSettings): string {
	const showAuthor = settings.author === 'enable' && item.author;
	const postUrl = item.link;
	const sourceName = item.feedTitle || 'Source';

	let base = '\n\n';
	if (item.telegraphUrl) {
		base += `⚡️ <a href="${item.telegraphUrl}">Instant View</a>\n`;
	}
	if (settings.hashtags !== 'disable' && item.topics?.length) {
		const tags = item.topics.map(t => '#' + t.replace(/\s+/g, '_').replace(/[^\w]/g, '')).filter(Boolean).join(' ');
		if (tags) base += tags + '\n';
	}

	switch (settings.sourceFormat) {
		case 'title_link':
			return showAuthor
				? `${base}<a href="${postUrl}">View on ${escapeHtml(sourceName)}</a> | ${escapeHtml(item.author)}`
				: `${base}<a href="${postUrl}">View on ${escapeHtml(sourceName)}</a>`;
		case 'link_only':
			return showAuthor
				? `${base}<a href="${postUrl}">${escapeHtml(item.author)} \u2014 ${escapeHtml(sourceName)}</a>`
				: `${base}<a href="${postUrl}">${escapeHtml(sourceName)}</a>`;
		case 'bare_url':
			return showAuthor
				? `${base}${escapeHtml(item.author)}\n${postUrl}`
				: `${base}${postUrl}`;
		case 'disable':
			return showAuthor
				? `${base}${escapeHtml(item.author)}`
				: (base.length > 2 ? base.trimEnd() : '');
		default:
			return base.length > 2 ? base.trimEnd() : '';
	}
}

function isInstagramItem(item: FeedItem): boolean {
	return item.link.includes('instagram.com') || item.feedLink.includes('instagram.com') || item.feedLink.includes('picnob.info');
}

function isTikTokItem(item: FeedItem): boolean {
	return item.link.includes('tiktok.com') || item.feedLink.includes('tiktok.com');
}

function escapeHtml(str: string): string {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
