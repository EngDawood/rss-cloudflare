import type { Context } from 'hono';
import { Bot } from 'grammy';
import type { FeedItem, FeedItemMedia, FeedItemMediaType } from '../types/feed';
import type { FormatSettings } from '../types/telegram';
import { formatFeedItem, resolveFormatSettings } from '../utils/telegram-format';
import { sendMediaToChannel } from '../services/telegram-bot/handlers/send-media';
import { getAdminConfig } from '../services/telegram-bot/storage/kv-operations';
import { enrichFeedItems } from '../utils/media-enrichment';
import { getFoloChannelIds, getChannelConfigFromD1 } from '../db/d1';

type HonoEnv = { Bindings: Env };

interface FoloMedia {
	url: string;
	type: 'photo' | 'video';
	preview_image_url?: string;
	width?: number;
	height?: number;
	blurhash?: string;
}

interface FoloWebhookPayload {
	entry: {
		id: string;
		guid: string;
		feedId: string;
		title: string | null;
		description: string | null;
		content: string | null;
		author: string | null;
		url: string | null;
		publishedAt: string;
		insertedAt: string;
		media: FoloMedia[] | null;
	};
	feed: {
		url: string;
		siteUrl: string;
		title: string | null;
		description: string | null;
		image: string | null;
		id?: string;
		language?: string | null;
	};
	view: number;
}

function deriveMediaType(media: FoloMedia[] | null): FeedItemMediaType {
	if (!media || media.length === 0) return 'none';
	if (media.length > 1) return 'album';
	return media[0].type === 'video' ? 'video' : 'photo';
}

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.trim();
}

function payloadToFeedItem(payload: FoloWebhookPayload): FeedItem {
	const { entry, feed } = payload;
	const mediaItems: FeedItemMedia[] = (entry.media || []).map((m) => ({
		type: m.type,
		url: m.url,
		thumbnailUrl: m.preview_image_url,
	}));

	const rawText = entry.content || entry.description || '';
	const text = rawText.includes('<') ? stripHtml(rawText) : rawText;

	return {
		id: entry.guid || entry.id,
		link: entry.url || '',
		title: entry.title || '',
		text,
		contentHtml: entry.content || undefined,
		author: entry.author || '',
		feedTitle: feed.title || '',
		feedLink: feed.siteUrl || feed.url,
		timestamp: new Date(entry.publishedAt).getTime() / 1000,
		mediaType: deriveMediaType(entry.media),
		media: mediaItems,
	};
}

export async function handleFoloWebhook(c: Context<HonoEnv>): Promise<Response> {
	const env = c.env;

	// Optional token verification
	const secret = env.FOLO_WEBHOOK_SECRET;
	if (secret) {
		const token = c.req.query('token');
		if (token !== secret) {
			return c.json({ error: 'Unauthorized' }, 401);
		}
	}

	// Parse body
	let payload: FoloWebhookPayload;
	try {
		payload = await c.req.json<FoloWebhookPayload>();
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	if (!payload?.entry || !payload?.feed) {
		return c.json({ error: 'Invalid payload: missing entry or feed' }, 400);
	}

	// Load subscribed channels from D1
	const channels = await getFoloChannelIds(env.DB);
	if (channels.length === 0) {
		return c.json({ ok: true, sent: 0, note: 'No channels subscribed' });
	}

	// Dedup: always compute a key; fall back to feedId+publishedAt when guid/id absent
	const dedupeKey = payload.entry.guid || payload.entry.id || `${payload.entry.feedId}:${payload.entry.publishedAt}`;
	const cacheKey = `folo:sent:${dedupeKey}`;
	try {
		const isSent = await env.CACHE.get(cacheKey);
		if (isSent) {
			console.log(`[folo] Duplicate payload detected for key: ${dedupeKey}. Skipping.`);
			return c.json({ ok: true, sent: 0, note: 'Duplicate payload skipped' });
		}
		await env.CACHE.put(cacheKey, '1', { expirationTtl: 86400 });
	} catch (err) {
		console.warn('[folo] Error checking/updating KV deduplication cache:', err);
	}

	const feedItem = payloadToFeedItem(payload);

	// Try Telegraph / Media Enrichment
	try {
		const adminConfig = await getAdminConfig(env.CACHE);
		await enrichFeedItems([feedItem], {
			token: adminConfig.telegraph.token || env.TELEGRAPH_ACCESS_TOKEN,
			enabled: adminConfig.telegraph.enabled,
			threshold: adminConfig.telegraph.threshold,
		});
	} catch (err) {
		console.warn('[folo] Folo webhook enrichment failed:', err);
	}

	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	let sent = 0;

	for (const channelId of channels) {
		try {
			let formatSettings: FormatSettings | undefined;
			const config = await getChannelConfigFromD1(env.DB, channelId);
			if (config) {
				formatSettings = resolveFormatSettings(config.defaultFormat);
			}

			const message = formatFeedItem(feedItem, formatSettings);
			await sendMediaToChannel(bot, parseInt(channelId, 10), message, formatSettings);
			sent++;
		} catch (err: any) {
			console.error(`[folo] Failed to send to channel ${channelId}:`, err.message);
		}
	}

	return c.json({ ok: true, sent, total: channels.length });
}
