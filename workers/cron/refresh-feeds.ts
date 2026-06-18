import { getFeeds, upsertItems, updateLastFetched } from '../db/d1';
import { fetchFeed } from '../services/feed-fetcher';

/**
 * Cron handler: refresh all enabled saved feeds and upsert new items into D1.
 * Called from the scheduled() handler alongside checkAllFeeds().
 */
export async function refreshSavedFeeds(env: Env): Promise<void> {
	const db = env.DB;
	const feeds = await getFeeds(db);
	const enabled = feeds.filter(f => f.enabled === 1);

	await Promise.allSettled(
		enabled.map(async (feed) => {
			try {
				const result = await fetchFeed(feed.url, feed.title || undefined);
				const inserted = await upsertItems(db, feed.id, result.items);
				await updateLastFetched(db, feed.id);
				console.log(`[RefreshFeeds] ${feed.title || feed.url}: ${inserted} new items`);
			} catch (err) {
				console.error(`[RefreshFeeds] Error refreshing ${feed.url}:`, err);
			}
		})
	);
}
