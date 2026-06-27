import type { Context } from 'hono';
import { parseJsonSafe } from '../db/base';
import { getRssBundleBySlug, getRssBundleFeedIds, listCategories, getFeedsInCategory } from '../db/feeds';
import { getItemsForFeeds, type DbItemForRss } from '../db/items';
import { buildRSSFeed } from '../services/rss-builder';
import type { RSSItem } from '../types/rss';
import type { FeedItemMedia } from '../types/feed';

type HonoEnv = { Bindings: Env };

function slugify(name: string): string {
	return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function toRssItem(item: DbItemForRss): RSSItem {
	const media = parseJsonSafe<FeedItemMedia[]>(item.media, []);
	const enclosures = media.map(m => m.url);
	const thumbnail =
		media.find(m => m.type === 'photo')?.url ??
		media.find(m => m.type === 'video')?.thumbnailUrl;
	return {
		uri: item.link,
		author: item.author || item.feed_title,
		title: item.title || item.text.slice(0, 80) || 'Untitled',
		content: item.content_html ?? item.text,
		enclosures,
		thumbnail,
		timestamp: item.timestamp,
	};
}

export async function handleRssBundleFeed(c: Context<HonoEnv>): Promise<Response> {
	const raw = c.req.param('slug') ?? '';
	const slug = raw.replace(/\.xml$/i, '');
	const db = c.env.DB;
	const limit = Math.min(Number(c.req.query('limit') ?? '50'), 100);

	let feedIds: string[] = [];
	let title = slug;
	let description = '';

	// 1. Explicit bundle (exact slug match, admin-defined)
	const bundle = await getRssBundleBySlug(db, slug);
	if (bundle) {
		feedIds = await getRssBundleFeedIds(db, bundle.id);
		title = bundle.title;
		description = bundle.description;
	} else {
		// 2. Category fallback (slugified name match)
		const categories = await listCategories(db);
		const match = categories.find(cat => slugify(cat.name) === slug);
		if (match) {
			const feeds = await getFeedsInCategory(db, match.id);
			feedIds = feeds.map(f => f.id);
			title = match.name;
			description = `${match.name} — combined RSS feed`;
		}
	}

	if (feedIds.length === 0) {
		return c.json({ error: 'Feed bundle not found', slug }, 404);
	}

	const items = await getItemsForFeeds(db, feedIds, limit);
	const xml = buildRSSFeed({
		title,
		link: new URL(c.req.url).toString(),
		description: description || title,
		items: items.map(toRssItem),
	});

	return c.text(xml, 200, { 'Content-Type': 'application/rss+xml; charset=utf-8' });
}
