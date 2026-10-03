import type { FeedItem, FeedItemMedia, FeedItemMediaType } from '../types/feed';
import { downloadMedia } from '../services/media-downloader';
import { createTelegraphPage } from './telegraph';

export interface TelegraphOptions {
	token?: string;
	enabled?: boolean;
	threshold?: number;
}

/**
 * Enrich feed items that have no media but link to a supported platform (e.g. TikTok).
 * Uses the media downloader to resolve actual video/image URLs.
 * Mutates items in-place. Non-fatal: failures leave items unchanged (sent as text).
 * If telegraph.token is set and telegraph.enabled is true, converts long articles into Telegraph pages.
 */
export async function enrichFeedItems(items: FeedItem[], telegraph?: TelegraphOptions): Promise<void> {
	const token = telegraph?.token;
	const enabled = telegraph?.enabled ?? true;
	const threshold = telegraph?.threshold ?? 500;

	for (const item of items) {
		// 0. X (Twitter) posts: full text + media from the FxTwitter API
		if (TWEET_URL_RE.test(item.link)) {
			await enrichTweet(item);
			continue;
		}

		// 1. Telegraph Article Enrichment
		if (enabled && token && item.contentHtml && item.text.length > threshold) {
			const url = await createTelegraphPage(item.title, item.author || item.feedTitle || 'RSS-Bridge', item.contentHtml, token);
			if (url) {
				item.telegraphUrl = url;
			}
		}

		// 2. Media Enrichment
		// If it's TikTok or Douyin, we ALWAYS want to try enrichment because the RSS enclosure is usually just a cover photo.
		// For other platforms, we only enrich if media is missing.
		const isShortVideo = item.link.includes('tiktok.com') || item.link.includes('douyin.com');
		if (item.media.length > 0 && !isShortVideo) continue;

		try {
			const result = await downloadMedia(item.link, 'auto');
			if (result.status !== 'success' || !result.media?.length) continue;

			const enriched: FeedItemMedia[] = result.media
				.filter(m => m.type === 'photo' || m.type === 'video')
				.map(m => ({
					type: m.type as 'photo' | 'video',
					url: m.url,
					thumbnailUrl: result.thumbnail,
				}));

			if (enriched.length === 0) continue;

			// Replace RSS media with enriched media (direct video/images)
			item.media = enriched;
			item.mediaType = deriveMediaType(enriched);
		} catch (err) {
			console.warn(`[Enrich] Media enrichment failed for ${item.link}:`, (err as Error).message);
		}
	}
}

const TWEET_URL_RE = /^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/i;
const FXTWITTER_API = 'https://api.fxtwitter.com';

interface FxMedia { type: string; url: string; thumbnail_url?: string }
interface FxTweet {
	text?: string;
	author?: { name?: string; screen_name?: string };
	media?: { all?: FxMedia[]; photos?: FxMedia[]; videos?: FxMedia[] } | null;
	quote?: FxTweet;
}

/**
 * Replace RSSHub's truncated text / missing media with the FxTwitter status API data
 * (full text incl. long "note" tweets, photos, videos, GIFs, quoted tweet).
 * Mutates the item in place. Non-fatal: on any failure the RSSHub data is kept.
 */
async function enrichTweet(item: FeedItem): Promise<void> {
	const m = item.link.match(TWEET_URL_RE);
	if (!m) return;
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 10000);
		const res = await fetch(`${FXTWITTER_API}/${m[1]}/status/${m[2]}`, {
			signal: controller.signal,
			headers: { 'User-Agent': 'rss-bridge-worker/1.0 (+https://rss.feed.engdawood.com)' },
		});
		clearTimeout(timeout);
		if (!res.ok) return;
		const tweet = ((await res.json()) as { tweet?: FxTweet }).tweet;
		if (!tweet?.text) return;

		let text = tweet.text;
		const q = tweet.quote;
		if (q?.text) {
			const who = q.author?.screen_name ? `${q.author.name || q.author.screen_name} (@${q.author.screen_name})` : (q.author?.name || '');
			text += `\n\n↪ ${who}:\n${q.text}`;
		}
		item.text = text;
		item.title = '';

		// Own media first; fall back to the quoted tweet's media when the post has none.
		const src = (tweet.media?.all?.length || tweet.media?.photos?.length || tweet.media?.videos?.length) ? tweet.media : q?.media;
		const all = src?.all ?? [...(src?.photos ?? []), ...(src?.videos ?? [])];
		const media: FeedItemMedia[] = all
			.filter((x) => x.url)
			.map((x) => ({
				type: x.type === 'photo' ? 'photo' : 'video',
				url: x.url,
				thumbnailUrl: x.thumbnail_url,
			}));
		if (media.length > 0) {
			item.media = media;
			item.mediaType = deriveMediaType(media);
		}
	} catch (err) {
		console.warn(`[Enrich] FxTwitter failed for ${item.link}:`, (err as Error).message);
	}
}

function deriveMediaType(media: FeedItemMedia[]): FeedItemMediaType {
	if (media.length === 0) return 'none';
	if (media.length > 1) return 'album';
	return media[0].type === 'video' ? 'video' : 'photo';
}
