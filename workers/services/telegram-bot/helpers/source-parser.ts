import type { SourceType } from '../../../types/telegram';
import { RSS_BRIDGE_INSTANCES, RSSHUB_INSTANCES } from '../../source-fetcher';

// rsshub.app is the official instance — always redirect to alternatives
const RSSHUB_APP = 'https://rsshub.app';

/**
 * Detect if a URL is from rsshub.app or a known RSSHub instance.
 * Returns the path+search string (e.g. "/anthropic/news") or null.
 */
function detectRSSHubPath(url: string): string | null {
	try {
		const parsed = new URL(url);
		const origin = parsed.origin;
		const isRSSHub =
			origin === RSSHUB_APP ||
			RSSHUB_INSTANCES.some((inst) => origin === inst || url.startsWith(inst));
		if (!isRSSHub) return null;
		return parsed.pathname + (parsed.search || '');
	} catch {
		return null;
	}
}

/**
 * Generate a short hash for a URL to use as source ID suffix.
 */
export function shortHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return Math.abs(hash).toString(36);
}

/**
 * Parse a source reference string into structured type/value/id.
 * @param ref - Source reference: URL, #hashtag, or @username
 * @returns Parsed source object or null if invalid
 */
export function parseSourceRef(ref: string): { type: SourceType; value: string; id: string } | null {
	if (!ref || typeof ref !== 'string') return null;

	const trimmed = ref.trim();

	// Explicit RSS override: "-rss url"
	const rssMatch = trimmed.match(/^-rss\s+(https?:\/\/[^\s]+)/i);
	if (rssMatch) {
		const url = rssMatch[1];
		return { type: 'rss_url', value: url, id: `rss_${shortHash(url)}` };
	}

	// TikTok explicit: "-t username" or "tiktok username"
	const tiktokExplicitMatch = trimmed.match(/^(?:-t|tiktok)\s+@?([\w.-]+)/i);
	if (tiktokExplicitMatch) {
		const tiktokUser = tiktokExplicitMatch[1];
		return { type: 'tiktok_user', value: tiktokUser, id: `tiktok_${shortHash(tiktokUser)}` };
	}

	// Instagram explicit: "-i username" or "instagram username"
	const igExplicitMatch = trimmed.match(/^(?:-i|instagram)\s+@?([\w.-]+)/i);
	if (igExplicitMatch) {
		const igUser = igExplicitMatch[1];
		return { type: 'instagram_user', value: igUser, id: `usr_${shortHash(igUser)}` };
	}

	// Instagram Story explicit: "-s username", "story username", or "igstory username"
	const igStoryMatch = trimmed.match(/^(?:-s|story|igstory)\s+@?([\w.-]+)/i);
	if (igStoryMatch) {
		const igUser = igStoryMatch[1].toLowerCase();
		return { type: 'instagram_story', value: igUser, id: `igst_${shortHash(igUser)}` };
	}

	// URLs: Profile routing or fallback to RSS
	if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
		// TikTok Profile Link
		const tiktokUrlMatch = trimmed.match(/^https?:\/\/(?:www\.)?tiktok\.com\/@([\w.-]+)/i);
		if (tiktokUrlMatch) {
			const tiktokUser = tiktokUrlMatch[1];
			return { type: 'tiktok_user', value: tiktokUser, id: `tiktok_${shortHash(tiktokUser)}` };
		}

		// Instagram Profile Link
		const igUrlMatch = trimmed.match(/^https?:\/\/(?:www\.)?instagram\.com\/([\w.-]+)/i);
		if (igUrlMatch) {
			const igUser = igUrlMatch[1];
			// Avoid matching sub-pages like /p/ or /reel/
			if (!['p', 'reel', 'tv', 'explore', 'stories'].includes(igUser)) {
				return { type: 'instagram_user', value: igUser, id: `usr_${shortHash(igUser)}` };
			}
		}

		// RSS-Bridge URL (known instance) → extract native source for failover support
		const rssBridgeSource = detectRSSBridgeSource(trimmed);
		if (rssBridgeSource) {
			return rssBridgeSource;
		}

		// RSSHub URL (rsshub.app or known instance) → extract path for instance failover
		const rsshubPath = detectRSSHubPath(trimmed);
		if (rsshubPath) {
			return { type: 'rsshub_url', value: rsshubPath, id: `rsshub_${shortHash(rsshubPath)}` };
		}

		// Generic RSS/Atom URL
		return { type: 'rss_url', value: trimmed, id: `rss_${shortHash(trimmed)}` };
	}

	// Instagram hashtag
	if (trimmed.startsWith('#')) {
		const value = trimmed.replace(/^#/, '');
		if (!value) return null; // Prevent empty hashtag
		return { type: 'instagram_tag', value, id: `tag_${shortHash(value)}` };
	}

	// Default fallback (Instagram user, strip @ if present)
	const value = trimmed.replace(/^@/, '');
	if (!value) return null; // Prevent empty username
	return { type: 'instagram_user', value, id: `usr_${shortHash(value)}` };
}

/**
 * Get an emoji icon representing the source type.
 */
export function sourceTypeIcon(type: string): string {
	switch (type) {
		case 'instagram_user':
		case 'username': // legacy
			return '👤';
		case 'instagram_tag':
		case 'hashtag': // legacy
			return '#️⃣';
		case 'instagram_story':
			return '📸';
		case 'tiktok_user':
			return '🎵';
		case 'rsshub_url':
			return '📡';
		case 'rss_url':
			return '🌐';
		default:
			return '📡';
	}
}

/**
 * Get a human-readable label for the source type.
 */
export function sourceTypeLabel(type: string): string {
	switch (type) {
		case 'instagram_user':
		case 'username':
			return 'IG User';
		case 'instagram_tag':
		case 'hashtag':
			return 'IG Tag';
		case 'instagram_story':
			return 'IG Story';
		case 'tiktok_user':
			return 'TikTok';
		case 'rsshub_url':
			return 'RSSHub';
		case 'rss_url':
			return 'RSS';
		default:
			return type;
	}
}

/**
 * Detect if a URL is from a known RSS-Bridge instance and extract the native source type.
 * E.g., an InstagramBridge URL → { type: 'instagram_user', value: 'someuser', id: 'usr_xxx' }
 * Returns null if not a recognized RSS-Bridge URL or unknown bridge type.
 */
export function detectRSSBridgeSource(url: string): { type: SourceType; value: string; id: string } | null {
	try {
		const parsed = new URL(url);
		const origin = parsed.origin;

		// Check if the URL's origin matches any known RSS-Bridge instance
		const isRSSBridge = RSS_BRIDGE_INSTANCES.some((inst) => origin === inst || url.startsWith(inst));
		if (!isRSSBridge) return null;

		const params = parsed.searchParams;
		const bridge = params.get('bridge');

		if (bridge === 'InstagramBridge') {
			const context = params.get('context');
			if (context === 'Username') {
				const u = params.get('u');
				if (u) return { type: 'instagram_user', value: u, id: `usr_${shortHash(u)}` };
			}
			if (context === 'Hashtag') {
				const h = params.get('h');
				if (h) return { type: 'instagram_tag', value: h, id: `tag_${shortHash(h)}` };
			}
		}

		if (bridge === 'TikTokBridge') {
			const username = params.get('username');
			if (username) return { type: 'tiktok_user', value: username, id: `tiktok_${shortHash(username)}` };
		}

		return null;
	} catch {
		return null;
	}
}
