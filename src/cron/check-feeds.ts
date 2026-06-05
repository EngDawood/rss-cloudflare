import { Bot, GrammyError } from 'grammy';
import type { ChannelConfig, ChannelSource } from '../types/telegram';
import type { FeedItem, FeedMediaFilter, FetchResult } from '../types/feed';
import { fetchFeed } from '../services/feed-fetcher';
import { fetchInstagramUser, fetchInstagramTag, fetchForSource } from '../services/source-fetcher';
import { getChannelConfig, saveChannelConfig, sendMediaToChannel, addFailedPost } from '../services/telegram-bot';
import { sendFallbackMessage } from '../services/telegram-bot/helpers/fallback-sender';
import { formatFeedItem, resolveFormatSettings } from '../utils/telegram-format';
import { getCached, setCached } from '../utils/cache';
import {
	CACHE_KEY_TELEGRAM_CHANNELS,
	CACHE_PREFIX_TELEGRAM_SENT,
	TELEGRAM_CONFIG_TTL,
} from '../constants';
import { enrichFeedItems } from '../utils/media-enrichment';
import { FileTooLargeError } from '../services/telegram-bot/handlers/send-media';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Send an alert DM to the admin. Silently fails if notification itself errors.
 */
async function alertAdmin(bot: Bot, adminId: number, message: string): Promise<void> {
	try {
		await bot.api.sendMessage(adminId, message, { parse_mode: 'HTML' });
	} catch (e) {
		console.error('[Alert] Failed to notify admin:', e);
	}
}

/** Truncate error text to avoid hitting Telegram message limits. */
function truncErr(err: unknown, maxLen = 300): string {
	const msg = err instanceof Error ? err.message : String(err);
	return msg.length > maxLen ? msg.slice(0, maxLen) + '...' : msg;
}

/**
 * Cron handler: iterate all channels, and push fetch tasks to the queue.
 */
export async function checkAllFeeds(env: Env): Promise<void> {
	const channelsRaw = await getCached(env.CACHE, CACHE_KEY_TELEGRAM_CHANNELS);
	if (!channelsRaw) return;

	const channels: string[] = JSON.parse(channelsRaw);
	if (channels.length === 0) return;

	const now = Date.now();

	for (const channelId of channels) {
		try {
			await scheduleChannelCheck(channelId, now, env);
		} catch (err) {
			console.error(`Error scheduling channel ${channelId}:`, err);
		}
	}
}

/**
 * Check if a channel is due for a sync, and if so, queue its enabled sources.
 */
async function scheduleChannelCheck(channelId: string, now: number, env: Env): Promise<void> {
	const config = await getChannelConfig(env.CACHE, channelId);
	if (!config || !config.enabled) return;

	// Skip if no active sources exist
	const activeSources = config.sources.filter(s => s.enabled);
	if (activeSources.length === 0) return;

	const bucketSizeMinutes = 5; // Cron runs every 5 minutes
	
	if (config.checkIntervalMinutes > bucketSizeMinutes) {
		const currentMinute = Math.floor(now / 60000);
		const currentBucket = Math.floor(currentMinute / bucketSizeMinutes);
		const bucketsInInterval = Math.floor(config.checkIntervalMinutes / bucketSizeMinutes);
		
		// Create deterministic offset for this channel to spread load
		let hash = 0;
		for (let i = 0; i < channelId.length; i++) {
			hash = (hash << 5) - hash + channelId.charCodeAt(i);
			hash |= 0;
		}
		const offsetBucket = Math.abs(hash) % bucketsInInterval;
		
		if (currentBucket % bucketsInInterval !== offsetBucket) {
			return; // Not this channel's turn
		}
	}

	// Queue each enabled source for Tier 1 fetching
	for (const source of activeSources) {
		try {
			await env.FEED_FETCH_QUEUE.send({
				type: 'fetch',
				channelId,
				sourceId: source.id
			});
			console.log(`[Queue] Pushed fetch task for ${source.value} in channel ${channelId}`);
		} catch (err) {
			console.error(`[Queue] Failed to push fetch task for ${source.value}:`, err);
		}
	}
}

// (Removed checkChannel and checkSource as they are replaced by the Queue Handler)


/**
 * Filter items by media type. Handles both new and legacy filter values.
 */
function filterItems(items: FeedItem[], filter: FeedMediaFilter): FeedItem[] {
	if (filter === 'all') return items;
	return items.filter((item) => item.mediaType === filter);
}

/**
 * Migrate legacy mediaType/mediaFilter values to FeedMediaFilter.
 */
function migrateMediaFilter(source: ChannelSource): FeedMediaFilter {
	// Handle both old field name (mediaType) and new (mediaFilter)
	const raw = (source.mediaFilter ?? (source as any).mediaType ?? 'all') as string;
	switch (raw) {
		case 'picture': return 'photo';
		case 'multiple': return 'album';
		default: return raw as FeedMediaFilter;
	}
}
