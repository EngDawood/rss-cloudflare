import type { FeedItem, FeedItemMedia, FeedItemMediaType } from '../types/feed';

// ── D1 row shapes ────────────────────────────────────────────────────────────

export interface DbFeed {
	id: string;
	source_type: string;   // SourceType — 'rss_url' for legacy/RSS feeds
	source_value: string;  // URL for rss_url; username for instagram_user; etc.
	title: string;
	enabled: number;
	check_interval_minutes: number;
	last_fetched_at: number | null;
	created_at: number;
	ai_summary: string;   // 'inherit' | 'enable' | 'disable'
	url: string;          // back-compat alias of source_value (SELECT-aliased)
	// Health tracking
	last_error: string | null;
	last_success_at: number | null;
	consecutive_failures: number;
}

export interface DbFeedWithCounts extends DbFeed {
	total_count: number;
	unread_count: number;
	telegram_channel_ids: string | null; // comma-separated channel IDs from GROUP_CONCAT, null if none
}

export interface DbItem {
	feed_id: string;
	id: string;
	title: string;
	link: string;
	author: string;
	topics: string;      // JSON string[]
	text: string;
	content_html: string | null;
	media: string;       // JSON FeedItemMedia[]
	media_type: string;
	timestamp: number;
	read: number;
	fetched_at: number;
	summary: string | null;
}

export interface DbItemCompact {
	feed_id: string;
	id: string;
	title: string;
	link: string;
	author: string;
	topics: string[];    // parsed
	timestamp: number;
	feed_title: string;
	feed_url: string;
	read: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function genId(): string {
	return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

export function parseJsonSafe<T>(json: string, fallback: T): T {
	try { return JSON.parse(json); } catch { return fallback; }
}

export function dbItemToFeedItem(row: DbItem, feedTitle: string, feedLink: string): FeedItem {
	return {
		id: row.id,
		link: row.link,
		title: row.title,
		text: row.text,
		contentHtml: row.content_html ?? undefined,
		author: row.author,
		feedTitle,
		feedLink,
		timestamp: row.timestamp,
		mediaType: row.media_type as FeedItemMediaType,
		media: parseJsonSafe<FeedItemMedia[]>(row.media, []),
		topics: parseJsonSafe<string[]>(row.topics, []),
		summary: row.summary ?? undefined,
	};
}
