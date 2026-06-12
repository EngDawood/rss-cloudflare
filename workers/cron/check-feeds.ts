import { getChannels, getTelegramSubscriptions } from '../db/d1';
import type { DbChannel } from '../db/d1';
import type { FeedItem, FeedMediaFilter } from '../types/feed';

/**
 * Cron handler: determine which feeds are due (via D1 channels + subscriptions),
 * deduplicate by feed_id, and push one FetchTask per unique due feed.
 */
export async function checkAllFeeds(env: Env): Promise<void> {
	const channels = await getChannels(env.DB);
	if (channels.length === 0) return;

	const now = Date.now();
	const dueFeedIds = new Set<string>();

	for (const channel of channels) {
		if (!channel.enabled) continue;
		if (!isChannelDue(channel, now)) continue;

		const subs = await getTelegramSubscriptions(env.DB, channel.id);
		for (const sub of subs) {
			if (sub.enabled) dueFeedIds.add(sub.feed_id);
		}
	}

	if (dueFeedIds.size === 0) return;

	for (const feedId of dueFeedIds) {
		try {
			await env.FEED_FETCH_QUEUE.send({ type: 'fetch', feedId });
			console.log(`[Cron] Queued fetch for feed ${feedId}`);
		} catch (err) {
			console.error(`[Cron] Failed to queue feed ${feedId}:`, err);
		}
	}
}

/**
 * Bucket-based schedule check. Channels are spread across buckets derived from
 * their ID hash, so load is distributed evenly across the cron interval.
 */
function isChannelDue(channel: DbChannel, now: number): boolean {
	const bucketSizeMinutes = 5;
	if (channel.check_interval_minutes <= bucketSizeMinutes) return true;

	const currentMinute = Math.floor(now / 60000);
	const currentBucket = Math.floor(currentMinute / bucketSizeMinutes);
	const bucketsInInterval = Math.floor(channel.check_interval_minutes / bucketSizeMinutes);

	let hash = 0;
	for (let i = 0; i < channel.id.length; i++) {
		hash = (hash << 5) - hash + channel.id.charCodeAt(i);
		hash |= 0;
	}
	const offsetBucket = Math.abs(hash) % bucketsInInterval;

	return currentBucket % bucketsInInterval === offsetBucket;
}

/**
 * Filter items by media type.
 */
export function filterItems(items: FeedItem[], filter: FeedMediaFilter): FeedItem[] {
	if (filter === 'all') return items;
	return items.filter(item => item.mediaType === filter);
}
