import { describe, it, expect } from 'vitest';
import { formatFeedItem, resolveFormatSettings } from '../workers/utils/telegram-format';
import { DEFAULT_FORMAT_SETTINGS } from '../workers/constants';
import type { FeedItem } from '../workers/types/feed';
import type { FormatSettings } from '../workers/types/telegram';

// ---------------------------------------------------------------------------
// Shared Fixtures
// ---------------------------------------------------------------------------

/** Default mock: non-Instagram, non-TikTok, mediaType 'none'. */
const mockItem: FeedItem = {
	id: '123',
	link: 'https://example.com/post/1',
	title: 'Post Title',
	text: 'Hello world, this is a test post with some ads. Click here for more!',
	author: 'John Doe',
	feedTitle: 'Example Feed',
	feedLink: 'https://example.com',
	timestamp: Date.now(),
	mediaType: 'none',
	media: [],
};

const instagramItem: FeedItem = {
	...mockItem,
	link: 'https://www.instagram.com/p/ABC123/',
	feedLink: 'https://www.instagram.com/user',
	feedTitle: 'user — Instagram',
	mediaType: 'photo',
	media: [{ type: 'photo', url: 'https://cdn.instagram.com/photo.jpg' }],
};

const tiktokItem: FeedItem = {
	...mockItem,
	link: 'https://www.tiktok.com/@user/video/123',
	feedLink: 'https://www.tiktok.com/@user',
	feedTitle: 'user — TikTok',
	text: 'Amazing video (1.2M views) #fyp',
	mediaType: 'video',
	media: [{ type: 'video', url: 'https://cdn.tiktok.com/video.mp4', thumbnailUrl: 'https://cdn.tiktok.com/thumb.jpg' }],
};

// ---------------------------------------------------------------------------
// resolveFormatSettings
// ---------------------------------------------------------------------------

describe('resolveFormatSettings', () => {
	it('should return defaults when called with no arguments', () => {
		const result = resolveFormatSettings();
		expect(result).toEqual(DEFAULT_FORMAT_SETTINGS);
	});

	it('should merge channel defaults over hardcoded defaults', () => {
		const result = resolveFormatSettings({ notification: 'muted', author: 'enable' });
		expect(result.notification).toBe('muted');
		expect(result.author).toBe('enable');
		// Other fields stay at default
		expect(result.media).toBe('enable');
		expect(result.sourceFormat).toBe('disable');
	});

	it('should merge source overrides over channel defaults', () => {
		const channelDefaults: Partial<FormatSettings> = { notification: 'muted', author: 'enable' };
		const sourceOverrides: Partial<FormatSettings> = { notification: 'normal', media: 'disable' };
		const result = resolveFormatSettings(channelDefaults, sourceOverrides);
		// Source override wins for notification
		expect(result.notification).toBe('normal');
		// Channel default preserved for author
		expect(result.author).toBe('enable');
		// Source override applied
		expect(result.media).toBe('disable');
	});

	it('should allow partial overrides', () => {
		const result = resolveFormatSettings(undefined, { customHeader: '📢 Breaking' });
		expect(result.customHeader).toBe('📢 Breaking');
		// Everything else stays default
		expect(result.notification).toBe('normal');
		expect(result.hashtags).toBe('enable');
		expect(result.lengthLimit).toBe(0);
	});
});

// ---------------------------------------------------------------------------
// formatFeedItem — message type routing
// ---------------------------------------------------------------------------

describe('formatFeedItem — message type routing', () => {
	const photoItem: FeedItem = {
		...mockItem,
		mediaType: 'photo',
		media: [{ type: 'photo', url: 'https://example.com/photo.jpg' }],
	};
	const videoItem: FeedItem = {
		...mockItem,
		mediaType: 'video',
		media: [{ type: 'video', url: 'https://example.com/video.mp4', thumbnailUrl: 'https://example.com/thumb.jpg' }],
	};
	const albumItem: FeedItem = {
		...mockItem,
		mediaType: 'album',
		media: [
			{ type: 'photo', url: 'https://example.com/1.jpg' },
			{ type: 'photo', url: 'https://example.com/2.jpg' },
		],
	};
	const emptyAlbumItem: FeedItem = {
		...mockItem,
		mediaType: 'album',
		media: [],
	};

	it('should return photo type for photo items', () => {
		const result = formatFeedItem(photoItem);
		expect(result.type).toBe('photo');
		expect(result.url).toBe('https://example.com/photo.jpg');
	});

	it('should return video type with thumbnailUrl for video items', () => {
		const result = formatFeedItem(videoItem);
		expect(result.type).toBe('video');
		expect(result.url).toBe('https://example.com/video.mp4');
		expect(result.thumbnailUrl).toBe('https://example.com/thumb.jpg');
	});

	it('should return mediagroup type for album items', () => {
		const result = formatFeedItem(albumItem);
		expect(result.type).toBe('mediagroup');
		expect(result.media).toHaveLength(2);
		// First item gets caption + parse_mode
		expect(result.media![0]).toMatchObject({
			type: 'photo',
			media: 'https://example.com/1.jpg',
			parse_mode: 'HTML',
		});
		expect(result.media![0].caption).toBeDefined();
		// Second item has no caption/parse_mode
		expect(result.media![1]).toEqual({
			type: 'photo',
			media: 'https://example.com/2.jpg',
		});
	});

	it('should return text type for album with empty media array', () => {
		const result = formatFeedItem(emptyAlbumItem);
		expect(result.type).toBe('text');
	});

	it('should return text type for none mediaType', () => {
		const result = formatFeedItem(mockItem);
		expect(result.type).toBe('text');
	});

	it('should return text type when media setting is disable', () => {
		const settings = resolveFormatSettings(undefined, { media: 'disable' });
		// Even a photo item should become text when media is disabled
		const result = formatFeedItem(photoItem, settings);
		expect(result.type).toBe('text');
	});
});

// ---------------------------------------------------------------------------
// formatFeedItem — caption building
// ---------------------------------------------------------------------------

describe('formatFeedItem — caption building', () => {
	// --- Cleanup text ---

	it('should clean up text based on settings', () => {
		const settings = resolveFormatSettings(undefined, {
			cleanupText: 'ads\nClick here for more!',
		});
		const result = formatFeedItem(mockItem, settings);
		expect(result.caption).toContain('Hello world, this is a test post with some .');
		expect(result.caption).not.toContain('ads');
		expect(result.caption).not.toContain('Click here for more!');
	});

	it('should perform case-insensitive cleanup', () => {
		const settings = resolveFormatSettings(undefined, {
			cleanupText: 'HELLO\nTEST',
		});
		const result = formatFeedItem(mockItem, settings);
		expect(result.caption).toContain('world, this is a post with some ads.');
		expect(result.caption).not.toContain('Hello');
		expect(result.caption).not.toContain('test');
	});

	it('should handle special characters in cleanup text', () => {
		const itemWithSpecialChars: FeedItem = {
			...mockItem,
			text: 'Buy now for $19.99! (Limited offer)',
		};
		const settings = resolveFormatSettings(undefined, {
			cleanupText: '$19.99\n(Limited offer)',
		});
		const result = formatFeedItem(itemWithSpecialChars, settings);
		expect(result.caption).toContain('Buy now for !');
		expect(result.caption).not.toContain('$19.99');
		expect(result.caption).not.toContain('(Limited offer)');
	});

	// --- Custom header / footer / hashtags ---

	it('should prepend custom header', () => {
		const settings = resolveFormatSettings(undefined, { customHeader: '📢 BREAKING' });
		const result = formatFeedItem(mockItem, settings);
		// Header should appear before the main text
		const headerIdx = result.caption.indexOf('📢 BREAKING');
		const textIdx = result.caption.indexOf('Hello world');
		expect(headerIdx).toBeGreaterThanOrEqual(0);
		expect(headerIdx).toBeLessThan(textIdx);
	});

	it('should append custom footer', () => {
		const settings = resolveFormatSettings(undefined, { customFooter: '© 2025 My Channel' });
		const result = formatFeedItem(mockItem, settings);
		expect(result.caption).toContain('© 2025 My Channel');
		// Footer appears after main text
		const textIdx = result.caption.indexOf('Hello world');
		const footerIdx = result.caption.indexOf('© 2025 My Channel');
		expect(footerIdx).toBeGreaterThan(textIdx);
	});

	it('should append custom hashtags', () => {
		const settings = resolveFormatSettings(undefined, { customHashtags: '#tech #news' });
		const result = formatFeedItem(mockItem, settings);
		expect(result.caption).toContain('#tech #news');
	});

	// --- TikTok views ---

	it('should remove TikTok view counts when enabled for TikTok items', () => {
		const settings = resolveFormatSettings(undefined, { removeTikTokViews: 'enable' });
		const result = formatFeedItem(tiktokItem, settings);
		expect(result.caption).not.toMatch(/\(1\.2M views\)/);
		expect(result.caption).toContain('Amazing video');
	});

	it('should NOT remove view counts for non-TikTok items', () => {
		const nonTikTokWithViews: FeedItem = {
			...mockItem,
			text: 'Great content (1.2M views)',
		};
		const settings = resolveFormatSettings(undefined, { removeTikTokViews: 'enable' });
		const result = formatFeedItem(nonTikTokWithViews, settings);
		expect(result.caption).toContain('(1.2M views)');
	});

	// --- Hashtags ---

	it('should remove hashtags when hashtags setting is disable', () => {
		const item: FeedItem = { ...mockItem, text: 'Check this out #amazing #trending' };
		const settings = resolveFormatSettings(undefined, { hashtags: 'disable' });
		const result = formatFeedItem(item, settings);
		expect(result.caption).not.toContain('#amazing');
		expect(result.caption).not.toContain('#trending');
		expect(result.caption).toContain('Check this out');
	});

	it('should link Instagram hashtags when hashtags enabled and item is Instagram', () => {
		const igItem: FeedItem = {
			...instagramItem,
			text: 'Sunset vibes #nature #photography',
		};
		const settings = resolveFormatSettings(undefined, { hashtags: 'enable' });
		const result = formatFeedItem(igItem, settings);
		expect(result.caption).toContain('<a href="https://www.instagram.com/explore/tags/nature">#nature</a>');
		expect(result.caption).toContain('<a href="https://www.instagram.com/explore/tags/photography">#photography</a>');
	});

	// --- Title ---

	it('should prepend bold title for text-only non-Instagram items', () => {
		const item: FeedItem = {
			...mockItem,
			title: 'Breaking News',
			text: 'Something happened today.',
			mediaType: 'none',
		};
		const result = formatFeedItem(item);
		expect(result.caption).toContain('<b>Breaking News</b>');
		// Title should appear before the body text
		const titleIdx = result.caption.indexOf('<b>Breaking News</b>');
		const textIdx = result.caption.indexOf('Something happened today.');
		expect(titleIdx).toBeLessThan(textIdx);
	});

	it('should NOT prepend title for Instagram items', () => {
		const igItem: FeedItem = {
			...instagramItem,
			title: 'Instagram Post',
			text: 'Check this out!',
			mediaType: 'none',
		};
		const result = formatFeedItem(igItem);
		expect(result.caption).not.toContain('<b>Instagram Post</b>');
	});

	// --- AI Summary ---

	it('should prepend italic AI summary when present without telegraphUrl', () => {
		const item: FeedItem = {
			...mockItem,
			summary: 'AI-generated summary of the post.',
		};
		const result = formatFeedItem(item);
		expect(result.caption).toContain('<i>AI-generated summary of the post.</i>');
		// Summary should appear before the main text
		const summaryIdx = result.caption.indexOf('<i>AI-generated summary');
		const textIdx = result.caption.indexOf('Hello world');
		expect(summaryIdx).toBeLessThan(textIdx);
	});

	it('should use summary as body text when telegraphUrl is present', () => {
		const item: FeedItem = {
			...mockItem,
			summary: 'This is the summary that replaces text.',
			telegraphUrl: 'https://telegra.ph/Article-01-01',
		};
		const result = formatFeedItem(item);
		// Summary replaces the original text entirely — it should be the body (not italic-wrapped as prepend)
		expect(result.caption).toContain('This is the summary that replaces text.');
		// Original text should NOT appear
		expect(result.caption).not.toContain('Hello world');
		// Telegraph instant view link in footer
		expect(result.caption).toContain('Instant View');
	});

	// --- HTML escaping ---

	it('should escape HTML special characters in text', () => {
		const item: FeedItem = {
			...mockItem,
			title: 'A & B',
			text: '1 < 2 > 0 & "quotes"',
			mediaType: 'none',
		};
		const result = formatFeedItem(item);
		expect(result.caption).toContain('A &amp; B');
		expect(result.caption).toContain('1 &lt; 2 &gt; 0 &amp;');
	});

	// --- Caption truncation ---

	it('should truncate caption to 1024 chars for media items', () => {
		const longText = 'A'.repeat(2000);
		const photoItem: FeedItem = {
			...mockItem,
			text: longText,
			mediaType: 'photo',
			media: [{ type: 'photo', url: 'https://example.com/photo.jpg' }],
		};
		const result = formatFeedItem(photoItem);
		expect(result.type).toBe('photo');
		// Caption must not exceed 1024 chars
		expect(result.caption.length).toBeLessThanOrEqual(1024);
		// Should end with ellipsis (…)
		expect(result.caption).toContain('…');
	});
});
