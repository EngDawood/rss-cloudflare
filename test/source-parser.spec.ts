import { describe, it, expect } from 'vitest';
import {
	parseSourceRef,
	shortHash,
	sourceTypeIcon,
	sourceTypeLabel,
	detectRSSBridgeSource,
	detectRSSHubSource,
} from '../workers/services/telegram-bot/helpers/source-parser';

// ---------------------------------------------------------------------------
// parseSourceRef
// ---------------------------------------------------------------------------
describe('parseSourceRef', () => {
	// --- Null / empty inputs ---

	it('should return null for empty string', () => {
		expect(parseSourceRef('')).toBeNull();
	});

	it('should return null for whitespace-only input', () => {
		expect(parseSourceRef('   ')).toBeNull();
		expect(parseSourceRef('\t\n')).toBeNull();
	});

	it('should return null for @ alone', () => {
		expect(parseSourceRef('@')).toBeNull();
	});

	it('should return null for # alone', () => {
		expect(parseSourceRef('#')).toBeNull();
	});

	// --- Default / bare inputs ---

	it('should parse bare username as instagram_user', () => {
		const result = parseSourceRef('baharadawna');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^usr_/);
	});

	it('should parse @username as instagram_user', () => {
		const result = parseSourceRef('@baharadawna');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^usr_/);
	});

	// --- Hashtag ---

	it('should parse #hashtag as instagram_tag', () => {
		const result = parseSourceRef('#travel');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_tag');
		expect(result!.value).toBe('travel');
		expect(result!.id).toMatch(/^tag_/);
	});

	// --- Explicit TikTok ---

	it('should parse -t username as tiktok_user', () => {
		const result = parseSourceRef('-t khaby.lame');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('tiktok_user');
		expect(result!.value).toBe('khaby.lame');
		expect(result!.id).toMatch(/^tiktok_/);
	});

	it('should parse tiktok @username as tiktok_user', () => {
		const result = parseSourceRef('tiktok @khaby.lame');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('tiktok_user');
		expect(result!.value).toBe('khaby.lame');
		expect(result!.id).toMatch(/^tiktok_/);
	});

	// --- Explicit Instagram ---

	it('should parse -i username as instagram_user', () => {
		const result = parseSourceRef('-i baharadawna');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^usr_/);
	});

	// --- Instagram Story ---

	it('should parse -s username as instagram_story with lowercased value', () => {
		const result = parseSourceRef('-s BaharAdawna');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_story');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^igst_/);
	});

	it('should parse story username as instagram_story', () => {
		const result = parseSourceRef('story someuser');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_story');
		expect(result!.value).toBe('someuser');
		expect(result!.id).toMatch(/^igst_/);
	});

	// --- Explicit RSS ---

	it('should parse -rss URL as rss_url', () => {
		const url = 'https://example.com/feed.xml';
		const result = parseSourceRef(`-rss ${url}`);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_url');
		expect(result!.value).toBe(url);
		expect(result!.id).toMatch(/^rss_/);
	});

	// --- URL-based detection ---

	it('should parse TikTok profile URL as tiktok_user', () => {
		const result = parseSourceRef('https://www.tiktok.com/@khaby.lame');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('tiktok_user');
		expect(result!.value).toBe('khaby.lame');
		expect(result!.id).toMatch(/^tiktok_/);
	});

	it('should parse Instagram profile URL as instagram_user', () => {
		const result = parseSourceRef('https://www.instagram.com/baharadawna');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^usr_/);
	});

	it('should NOT parse Instagram /p/ URL as instagram_user', () => {
		const result = parseSourceRef('https://www.instagram.com/p/ABC123');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_url');
		expect(result!.value).toBe('https://www.instagram.com/p/ABC123');
		expect(result!.id).toMatch(/^rss_/);
	});

	it('should NOT parse Instagram /reel/ URL as instagram_user', () => {
		const result = parseSourceRef('https://www.instagram.com/reel/ABC123');
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_url');
		expect(result!.value).toBe('https://www.instagram.com/reel/ABC123');
		expect(result!.id).toMatch(/^rss_/);
	});

	// --- RSS-Bridge URL auto-detection (via parseSourceRef) ---

	it('should auto-detect RSS-Bridge Instagram username URL', () => {
		const url =
			'https://rss.bloat.cat/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=baharadawna&media_type=all';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^usr_/);
	});

	it('should auto-detect RSS-Bridge Instagram hashtag URL', () => {
		const url =
			'https://rssbridge.prenghy.org/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Hashtag&h=travel&media_type=all';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_tag');
		expect(result!.value).toBe('travel');
		expect(result!.id).toMatch(/^tag_/);
	});

	it('should auto-detect RSS-Bridge TikTok URL', () => {
		const url =
			'https://rss-bridge.org/bridge01/?action=display&bridge=TikTokBridge&context=By+user&username=khaby.lame&format=Atom';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('tiktok_user');
		expect(result!.value).toBe('khaby.lame');
		expect(result!.id).toMatch(/^tiktok_/);
	});

	it('should auto-detect RSSHub Instagram stories URL as instagram_story', () => {
		const url = 'https://rsshub.rssforever.com/picnob.info/user/baharadawna/stories?limit=10';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_story');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^igst_/);
	});

	it('should auto-detect RSSHub Instagram posts URL as instagram_user', () => {
		const url = 'https://rsshub.cups.moe/picnob.info/user/baharadawna/posts?limit=10';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toMatch(/^usr_/);
	});

	it('should detect rsshub.app URLs as rsshub_url', () => {
		const url = 'https://rsshub.app/anthropic/news';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub_url');
		expect(result!.value).toBe('/anthropic/news');
		expect(result!.id).toMatch(/^rsshub_/);
	});

	it('should fall back to rss_url for generic URLs', () => {
		const url = 'https://news.ycombinator.com/rss';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_url');
		expect(result!.value).toBe(url);
		expect(result!.id).toMatch(/^rss_/);
	});

	it('should fall back to rss_url for unrecognized bridges', () => {
		const url =
			'https://rss.bloat.cat/?action=display&bridge=YoutubeBridge&channel=UCxxxx&format=Atom';
		const result = parseSourceRef(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_url');
		expect(result!.value).toBe(url);
		expect(result!.id).toMatch(/^rss_/);
	});
});

// ---------------------------------------------------------------------------
// shortHash
// ---------------------------------------------------------------------------
describe('shortHash', () => {
	it('should return deterministic hash for same input', () => {
		const a = shortHash('hello');
		const b = shortHash('hello');
		expect(a).toBe(b);
	});

	it('should return different hashes for different inputs', () => {
		const a = shortHash('hello');
		const b = shortHash('world');
		expect(a).not.toBe(b);
	});

	it('should return base36 string', () => {
		const hash = shortHash('test-input');
		// base36 uses only digits 0-9 and lowercase letters a-z
		expect(hash).toMatch(/^[0-9a-z]+$/);
	});
});

// ---------------------------------------------------------------------------
// sourceTypeIcon
// ---------------------------------------------------------------------------
describe('sourceTypeIcon', () => {
	it('should return correct emoji for each source type', () => {
		expect(sourceTypeIcon('instagram_user')).toBe('👤');
		expect(sourceTypeIcon('instagram_tag')).toBe('#️⃣');
		expect(sourceTypeIcon('instagram_story')).toBe('📸');
		expect(sourceTypeIcon('tiktok_user')).toBe('🎵');
		expect(sourceTypeIcon('rsshub_url')).toBe('📡');
		expect(sourceTypeIcon('rsshub')).toBe('📡');
		expect(sourceTypeIcon('rss_bridge')).toBe('🌉');
		expect(sourceTypeIcon('rss_url')).toBe('🌐');
	});

	it('should return default emoji for unknown type', () => {
		expect(sourceTypeIcon('something_unknown')).toBe('📡');
	});

	it('should handle legacy type names', () => {
		expect(sourceTypeIcon('username')).toBe('👤');
		expect(sourceTypeIcon('hashtag')).toBe('#️⃣');
	});
});

// ---------------------------------------------------------------------------
// sourceTypeLabel
// ---------------------------------------------------------------------------
describe('sourceTypeLabel', () => {
	it('should return correct label for each source type', () => {
		expect(sourceTypeLabel('instagram_user')).toBe('IG User');
		expect(sourceTypeLabel('instagram_tag')).toBe('IG Tag');
		expect(sourceTypeLabel('instagram_story')).toBe('IG Story');
		expect(sourceTypeLabel('tiktok_user')).toBe('TikTok');
		expect(sourceTypeLabel('rsshub_url')).toBe('RSSHub');
		expect(sourceTypeLabel('rsshub')).toBe('RSSHub');
		expect(sourceTypeLabel('rss_bridge')).toBe('RSS-Bridge');
		expect(sourceTypeLabel('rss_url')).toBe('RSS');
		// legacy
		expect(sourceTypeLabel('username')).toBe('IG User');
		expect(sourceTypeLabel('hashtag')).toBe('IG Tag');
	});

	it('should return type as-is for unknown type', () => {
		expect(sourceTypeLabel('some_custom_type')).toBe('some_custom_type');
	});
});

// ---------------------------------------------------------------------------
// detectRSSHubSource
// ---------------------------------------------------------------------------
describe('detectRSSHubSource', () => {
	it('should return null for non-RSSHub URLs', () => {
		expect(detectRSSHubSource('https://example.com/feed.xml')).toBeNull();
		expect(detectRSSHubSource('https://news.ycombinator.com/rss')).toBeNull();
	});

	it('should detect picnob posts as instagram_user', () => {
		const url = 'https://rsshub.cups.moe/picnob.info/user/baharadawna/posts?limit=10';
		const result = detectRSSHubSource(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toBe(`usr_${shortHash('baharadawna')}`);
	});

	it('should detect picnob stories as instagram_story', () => {
		const url = 'https://rsshub.rssforever.com/picnob.info/user/baharadawna/stories?limit=10';
		const result = detectRSSHubSource(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_story');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toBe(`igst_${shortHash('baharadawna')}`);
	});

	it('should detect picnob paths via rsshub.app as instagram sources', () => {
		const postsUrl = 'https://rsshub.app/picnob.info/user/someuser/posts';
		const postsResult = detectRSSHubSource(postsUrl);
		expect(postsResult!.type).toBe('instagram_user');
		expect(postsResult!.value).toBe('someuser');

		const storiesUrl = 'https://rsshub.app/picnob.info/user/someuser/stories';
		const storiesResult = detectRSSHubSource(storiesUrl);
		expect(storiesResult!.type).toBe('instagram_story');
		expect(storiesResult!.value).toBe('someuser');
	});

	it('should return rsshub_url for non-picnob RSSHub paths', () => {
		const url = 'https://rsshub.cups.moe/anthropic/news';
		const result = detectRSSHubSource(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub_url');
		expect(result!.value).toBe('/anthropic/news');
		expect(result!.id).toMatch(/^rsshub_/);
	});

	it('should return rsshub_url for rsshub.app non-picnob paths', () => {
		const url = 'https://rsshub.app/hackernews/best';
		const result = detectRSSHubSource(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub_url');
		expect(result!.value).toBe('/hackernews/best');
	});
});

// ---------------------------------------------------------------------------
// detectRSSBridgeSource
// ---------------------------------------------------------------------------
describe('detectRSSBridgeSource', () => {
	it('should return null for non-RSS-Bridge URLs', () => {
		expect(detectRSSBridgeSource('https://example.com/feed.xml')).toBeNull();
		expect(detectRSSBridgeSource('https://news.ycombinator.com/rss')).toBeNull();
	});

	it('should return null for RSS-Bridge URL with unknown bridge', () => {
		const url =
			'https://rss.bloat.cat/?action=display&bridge=YoutubeBridge&channel=UCxxxx&format=Atom';
		expect(detectRSSBridgeSource(url)).toBeNull();
	});

	it('should extract Instagram user from InstagramBridge URL', () => {
		const url =
			'https://rss.bloat.cat/?action=display&bridge=InstagramBridge&format=Atom&context=Username&u=baharadawna';
		const result = detectRSSBridgeSource(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_user');
		expect(result!.value).toBe('baharadawna');
		expect(result!.id).toBe(`usr_${shortHash('baharadawna')}`);
	});

	it('should extract Instagram tag from InstagramBridge URL', () => {
		const url =
			'https://rssbridge.prenghy.org/?action=display&bridge=InstagramBridge&format=Atom&context=Hashtag&h=travel';
		const result = detectRSSBridgeSource(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('instagram_tag');
		expect(result!.value).toBe('travel');
		expect(result!.id).toBe(`tag_${shortHash('travel')}`);
	});

	it('should extract TikTok user from TikTokBridge URL', () => {
		const url =
			'https://rss-bridge.org/bridge01/?action=display&bridge=TikTokBridge&context=By+user&username=khaby.lame&format=Atom';
		const result = detectRSSBridgeSource(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('tiktok_user');
		expect(result!.value).toBe('khaby.lame');
		expect(result!.id).toBe(`tiktok_${shortHash('khaby.lame')}`);
	});
});
