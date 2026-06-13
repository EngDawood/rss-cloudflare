import { describe, it, expect } from 'vitest';
import { parseXML } from '../workers/services/feed-fetcher';

// ---------------------------------------------------------------------------
// Helpers — minimal Atom / RSS wrappers to keep fixtures DRY
// ---------------------------------------------------------------------------

const wrapAtom = (entries: string, title = 'Test Atom Feed', link = 'https://atom.example.com') => `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${title}</title>
  <link rel="alternate" href="${link}"/>
  ${entries}
</feed>`;

const wrapRSS = (items: string, title = 'Test RSS Feed', link = 'https://rss.example.com') => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${title}</title>
    <link>${link}</link>
    ${items}
  </channel>
</rss>`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseXML', () => {
	// -----------------------------------------------------------------------
	// Basic Atom & RSS parsing
	// -----------------------------------------------------------------------
	describe('Atom feed parsing', () => {
		it('should parse Atom feed with entries', () => {
			const xml = wrapAtom(`
				<entry>
					<id>urn:entry:1</id>
					<link rel="alternate" href="https://atom.example.com/post/1"/>
					<title>First Post</title>
					<content type="html">Hello from Atom</content>
					<author><name>Alice</name></author>
					<published>2025-01-15T12:00:00Z</published>
				</entry>
				<entry>
					<id>urn:entry:2</id>
					<link rel="alternate" href="https://atom.example.com/post/2"/>
					<title>Second Post</title>
					<content type="html">Another Atom entry</content>
					<author><name>Bob</name></author>
					<updated>2025-01-16T08:30:00Z</updated>
				</entry>
			`);

			const result = parseXML(xml);

			expect(result.items).toHaveLength(2);
			expect(result.errors).toHaveLength(0);

			const first = result.items[0];
			expect(first.id).toBe('urn:entry:1');
			expect(first.link).toBe('https://atom.example.com/post/1');
			expect(first.title).toBe('First Post');
			expect(first.text).toBe('Hello from Atom');
			expect(first.author).toBe('Alice');
			expect(first.timestamp).toBe(Math.floor(new Date('2025-01-15T12:00:00Z').getTime() / 1000));

			const second = result.items[1];
			expect(second.id).toBe('urn:entry:2');
			expect(second.author).toBe('Bob');
			// Updated falls back to <updated> when <published> is absent
			expect(second.timestamp).toBe(Math.floor(new Date('2025-01-16T08:30:00Z').getTime() / 1000));
		});

		it('should extract feed-level title and link from Atom feed', () => {
			const xml = wrapAtom('', 'My Atom Title', 'https://my-atom.example.com');

			const result = parseXML(xml);

			expect(result.feedTitle).toBe('My Atom Title');
			expect(result.feedLink).toBe('https://my-atom.example.com');
			expect(result.items).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
		});
	});

	describe('RSS feed parsing', () => {
		it('should parse RSS 2.0 feed with items', () => {
			const xml = wrapRSS(`
				<item>
					<guid>guid-abc-123</guid>
					<link>https://rss.example.com/article/1</link>
					<title>RSS Article</title>
					<description>This is an RSS item description</description>
					<author>Charlie</author>
					<pubDate>Mon, 20 Jan 2025 15:00:00 GMT</pubDate>
				</item>
			`);

			const result = parseXML(xml);

			expect(result.items).toHaveLength(1);
			expect(result.errors).toHaveLength(0);

			const item = result.items[0];
			expect(item.id).toBe('guid-abc-123');
			expect(item.link).toBe('https://rss.example.com/article/1');
			expect(item.title).toBe('RSS Article');
			expect(item.text).toBe('This is an RSS item description');
			expect(item.author).toBe('Charlie');
			expect(item.timestamp).toBe(Math.floor(new Date('Mon, 20 Jan 2025 15:00:00 GMT').getTime() / 1000));
		});

		it('should extract feed-level title and link from RSS feed', () => {
			const xml = wrapRSS('', 'My RSS Title', 'https://my-rss.example.com');

			const result = parseXML(xml);

			expect(result.feedTitle).toBe('My RSS Title');
			expect(result.feedLink).toBe('https://my-rss.example.com');
			expect(result.items).toHaveLength(0);
		});
	});

	// -----------------------------------------------------------------------
	// Feed title override
	// -----------------------------------------------------------------------
	describe('overrideFeedTitle', () => {
		it('should use overrideFeedTitle when provided', () => {
			const xml = wrapAtom(`
				<entry>
					<id>entry-1</id>
					<title>Post</title>
					<content type="html">body</content>
				</entry>
			`, 'Original Title');

			const result = parseXML(xml, 'Custom Override Title');

			expect(result.feedTitle).toBe('Custom Override Title');
			expect(result.items[0].feedTitle).toBe('Custom Override Title');
		});
	});

	// -----------------------------------------------------------------------
	// Fallback ID generation
	// -----------------------------------------------------------------------
	describe('fallback ID generation', () => {
		it('should generate deterministic hash- fallback id when guid/id and link are missing', () => {
			const xml = wrapAtom(`
				<entry>
					<title>Entry Title Without ID</title>
					<content type="html">This is entry content description</content>
					<author><name>Author Name</name></author>
				</entry>
			`);

			const result = parseXML(xml);
			expect(result.items).toHaveLength(1);
			const item = result.items[0];

			// hash- prefix from djb2 of title + text
			expect(item.id).toMatch(/^hash-/);
			expect(item.id.length).toBeGreaterThan(5);

			// Deterministic — same input → same hash
			const result2 = parseXML(xml);
			expect(result2.items[0].id).toBe(item.id);
		});

		it('should fallback to uuid if content is completely empty', () => {
			const xml = wrapRSS(`
				<item>
					<!-- Completely empty item -->
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items).toHaveLength(1);
			const item = result.items[0];

			// fallback- prefix with random UUID fragment
			expect(item.id).toMatch(/^fallback-/);
			expect(item.id.length).toBeGreaterThan(10);
		});

		it('should use guid or link if they are present', () => {
			const xml = wrapRSS(`
				<item>
					<guid>specific-guid-123</guid>
					<title>Item Title</title>
					<description>Item Description</description>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items).toHaveLength(1);
			expect(result.items[0].id).toBe('specific-guid-123');
		});

		it('should use link as id when guid is missing in RSS', () => {
			const xml = wrapRSS(`
				<item>
					<link>https://example.com/post/99</link>
					<title>No GUID</title>
					<description>Body</description>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items[0].id).toBe('https://example.com/post/99');
		});
	});

	// -----------------------------------------------------------------------
	// HTML entity decoding
	// -----------------------------------------------------------------------
	describe('HTML entity decoding', () => {
		it('should decode HTML entities in text content', () => {
			const xml = wrapRSS(`
				<item>
					<guid>entity-test</guid>
					<title>Entities</title>
					<description>&amp;quot;Hello&amp;quot; she said &amp;amp; waved&amp;hellip; it&amp;#39;s an &amp;mdash; em-dash &amp;#x27;hex&amp;#x27; and &amp;#60;tag&amp;#60;</description>
				</item>
			`);

			const result = parseXML(xml);
			const text = result.items[0].text;

			expect(text).toContain('"Hello"');
			expect(text).toContain('& waved');
			expect(text).toContain('…');
			expect(text).toContain("it's");
			expect(text).toContain('—');
			expect(text).toContain("'hex'");
			expect(text).toContain('<tag<');
		});
	});

	// -----------------------------------------------------------------------
	// Media extraction — Atom
	// -----------------------------------------------------------------------
	describe('Atom media extraction', () => {
		it('should extract media from Atom enclosures', () => {
			const xml = wrapAtom(`
				<entry>
					<id>media-atom-1</id>
					<title>Video Post</title>
					<content type="html">A video post</content>
					<link rel="alternate" href="https://atom.example.com/post/v1"/>
					<link rel="enclosure" type="video/mp4" href="https://cdn.example.com/video.mp4"/>
				</entry>
			`);

			const result = parseXML(xml);
			const item = result.items[0];

			expect(item.media).toHaveLength(1);
			expect(item.media[0].type).toBe('video');
			expect(item.media[0].url).toBe('https://cdn.example.com/video.mp4');
		});

		it('should extract images from content HTML when no enclosures', () => {
			const xml = wrapAtom(`
				<entry>
					<id>img-atom-1</id>
					<title>Image Post</title>
					<content type="html">&lt;p&gt;Check this out&lt;/p&gt;&lt;img src="https://cdn.example.com/photo.jpg"/&gt;</content>
				</entry>
			`);

			const result = parseXML(xml);
			const item = result.items[0];

			expect(item.media).toHaveLength(1);
			expect(item.media[0].type).toBe('photo');
			expect(item.media[0].url).toBe('https://cdn.example.com/photo.jpg');
		});

		it('should extract video from content HTML with poster thumbnail', () => {
			const xml = wrapAtom(`
				<entry>
					<id>vid-html-1</id>
					<title>Video in Content</title>
					<content type="html">&lt;video poster="https://cdn.example.com/thumb.jpg"&gt;&lt;source src="https://cdn.example.com/clip.mp4" type="video/mp4"/&gt;&lt;/video&gt;</content>
				</entry>
			`);

			const result = parseXML(xml);
			const item = result.items[0];

			expect(item.media).toHaveLength(1);
			expect(item.media[0].type).toBe('video');
			expect(item.media[0].url).toBe('https://cdn.example.com/clip.mp4');
			expect(item.media[0].thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
		});
	});

	// -----------------------------------------------------------------------
	// Media extraction — RSS
	// -----------------------------------------------------------------------
	describe('RSS media extraction', () => {
		it('should extract media from RSS enclosures', () => {
			const xml = wrapRSS(`
				<item>
					<guid>media-rss-1</guid>
					<title>Photo Post</title>
					<description>A photo</description>
					<enclosure url="https://cdn.example.com/image.jpg" type="image/jpeg" length="102400"/>
				</item>
			`);

			const result = parseXML(xml);
			const item = result.items[0];

			expect(item.media).toHaveLength(1);
			expect(item.media[0].type).toBe('photo');
			expect(item.media[0].url).toBe('https://cdn.example.com/image.jpg');
		});
	});

	// -----------------------------------------------------------------------
	// Media deduplication
	// -----------------------------------------------------------------------
	describe('media deduplication', () => {
		it('should deduplicate media URLs', () => {
			const xml = wrapAtom(`
				<entry>
					<id>dedup-1</id>
					<title>Duplicated Media</title>
					<content type="html">text</content>
					<link rel="enclosure" type="image/jpeg" href="https://cdn.example.com/same.jpg"/>
					<link rel="enclosure" type="image/jpeg" href="https://cdn.example.com/same.jpg"/>
					<link rel="enclosure" type="image/png" href="https://cdn.example.com/other.png"/>
				</entry>
			`);

			const result = parseXML(xml);
			const item = result.items[0];

			// Only 2 unique URLs
			expect(item.media).toHaveLength(2);
			const urls = item.media.map(m => m.url);
			expect(urls).toContain('https://cdn.example.com/same.jpg');
			expect(urls).toContain('https://cdn.example.com/other.png');
		});
	});

	// -----------------------------------------------------------------------
	// deriveMediaType
	// -----------------------------------------------------------------------
	describe('deriveMediaType', () => {
		it('should derive mediaType as none when no media', () => {
			const xml = wrapRSS(`
				<item>
					<guid>no-media</guid>
					<title>Plain Text</title>
					<description>No attachments here</description>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items[0].mediaType).toBe('none');
			expect(result.items[0].media).toHaveLength(0);
		});

		it('should derive mediaType as photo for single image', () => {
			const xml = wrapRSS(`
				<item>
					<guid>single-photo</guid>
					<title>Photo</title>
					<description>One photo</description>
					<enclosure url="https://cdn.example.com/photo.jpg" type="image/jpeg"/>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items[0].mediaType).toBe('photo');
		});

		it('should derive mediaType as video for single video', () => {
			const xml = wrapRSS(`
				<item>
					<guid>single-video</guid>
					<title>Video</title>
					<description>One video</description>
					<enclosure url="https://cdn.example.com/video.mp4" type="video/mp4"/>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items[0].mediaType).toBe('video');
		});

		it('should derive mediaType as album when multiple media', () => {
			const xml = wrapAtom(`
				<entry>
					<id>album-entry</id>
					<title>Album Post</title>
					<content type="html">Gallery</content>
					<link rel="enclosure" type="image/jpeg" href="https://cdn.example.com/a.jpg"/>
					<link rel="enclosure" type="image/png" href="https://cdn.example.com/b.png"/>
					<link rel="enclosure" type="video/mp4" href="https://cdn.example.com/c.mp4"/>
				</entry>
			`);

			const result = parseXML(xml);
			expect(result.items[0].mediaType).toBe('album');
			expect(result.items[0].media).toHaveLength(3);
		});
	});

	// -----------------------------------------------------------------------
	// Topics / categories
	// -----------------------------------------------------------------------
	describe('topics extraction', () => {
		it('should extract topics from Atom category elements', () => {
			const xml = wrapAtom(`
				<entry>
					<id>atom-topics</id>
					<title>Categorized Entry</title>
					<content type="html">Tagged post</content>
					<category term="tech"/>
					<category term="ai"/>
					<category term="cloudflare"/>
				</entry>
			`);

			const result = parseXML(xml);
			expect(result.items[0].topics).toEqual(['tech', 'ai', 'cloudflare']);
		});

		it('should extract topics from RSS category elements', () => {
			const xml = wrapRSS(`
				<item>
					<guid>rss-topics</guid>
					<title>Categorized Item</title>
					<description>Tagged RSS</description>
					<category>sports</category>
					<category>news</category>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items[0].topics).toEqual(['sports', 'news']);
		});

		it('should omit topics when no category elements exist', () => {
			const xml = wrapRSS(`
				<item>
					<guid>no-topics</guid>
					<title>No Categories</title>
					<description>Body</description>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items[0].topics).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// Instagram <br><br> caption pattern
	// -----------------------------------------------------------------------
	describe('Instagram br-br caption extraction', () => {
		it('should use Instagram br-br caption extraction pattern', () => {
			const html =
				'<img src="https://cdn.example.com/ig.jpg"/>' +
				'<br><br>' +
				'This is the actual caption text 📸 #sunset';

			const xml = wrapAtom(`
				<entry>
					<id>ig-entry</id>
					<title>IG Post</title>
					<content type="html">${html.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</content>
				</entry>
			`);

			const result = parseXML(xml);
			const item = result.items[0];

			// Text should be the caption after the last <br><br>, not the img tag
			expect(item.text).toContain('This is the actual caption text');
			expect(item.text).toContain('#sunset');
			expect(item.text).not.toContain('<img');
		});
	});

	// -----------------------------------------------------------------------
	// contentHtml preservation
	// -----------------------------------------------------------------------
	describe('contentHtml', () => {
		it('should preserve contentHtml on items when present', () => {
			const xml = wrapAtom(`
				<entry>
					<id>html-entry</id>
					<title>Rich Content</title>
					<content type="html">&lt;p&gt;Formatted &lt;strong&gt;bold&lt;/strong&gt; text&lt;/p&gt;</content>
				</entry>
			`);

			const result = parseXML(xml);
			const item = result.items[0];

			expect(item.contentHtml).toBeDefined();
			expect(item.contentHtml).toContain('<p>');
			expect(item.contentHtml).toContain('<strong>bold</strong>');
		});

		it('should set contentHtml to undefined when no content', () => {
			const xml = wrapRSS(`
				<item>
					<guid>empty-html</guid>
					<title>Empty</title>
				</item>
			`);

			const result = parseXML(xml);
			expect(result.items[0].contentHtml).toBeUndefined();
		});
	});

	// -----------------------------------------------------------------------
	// Edge cases
	// -----------------------------------------------------------------------
	describe('edge cases', () => {
		it('should handle empty XML gracefully', () => {
			const xml = '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>';

			const result = parseXML(xml);

			expect(result.items).toHaveLength(0);
			expect(result.errors).toHaveLength(0);
			expect(result.feedTitle).toBe('Untitled Feed');
			expect(result.feedLink).toBe('');
		});

		it('should default feedTitle to "Untitled Feed" when no title element exists', () => {
			const xml = '<?xml version="1.0"?><rss version="2.0"><channel><link>https://x.com</link></channel></rss>';

			const result = parseXML(xml);
			expect(result.feedTitle).toBe('Untitled Feed');
		});
	});
});
