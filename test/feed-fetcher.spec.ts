import { describe, it, expect } from 'vitest';
import { parseXML } from '../workers/services/feed-fetcher';

describe('feed-fetcher parser fallback id', () => {
	it('should generate deterministic fallback id when guid/id and link are missing', () => {
		const mockAtomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <link rel="alternate" href="https://example.com"/>
  <entry>
    <title>Entry Title Without ID</title>
    <content type="html">This is entry content description</content>
    <author><name>Author Name</name></author>
  </entry>
</feed>`;

		const result = parseXML(mockAtomXml);
		expect(result.items.length).toBe(1);
		const item = result.items[0];
		
		// The item should have a calculated id starting with "hash-" because id and link are missing
		expect(item.id).toContain('hash-');
		expect(item.id.length).toBeGreaterThan(5);
		
		// It should be deterministic
		const result2 = parseXML(mockAtomXml);
		expect(result2.items[0].id).toBe(item.id);
	});

	it('should fallback to uuid if content (title and text) is completely empty', () => {
		const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test RSS</title>
    <link>https://example.com</link>
    <item>
      <!-- Completely empty item -->
    </item>
  </channel>
</rss>`;

		const result = parseXML(mockRssXml);
		expect(result.items.length).toBe(1);
		const item = result.items[0];
		
		// The item should have a fallback id starting with "fallback-" because there's no title/text/link/guid
		expect(item.id).toContain('fallback-');
		expect(item.id.length).toBeGreaterThan(10);
	});

	it('should use guid or link if they are present', () => {
		const mockRssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test RSS</title>
    <link>https://example.com</link>
    <item>
      <guid>specific-guid-123</guid>
      <title>Item Title</title>
      <description>Item Description</description>
    </item>
  </channel>
</rss>`;

		const result = parseXML(mockRssXml);
		expect(result.items.length).toBe(1);
		const item = result.items[0];
		expect(item.id).toBe('specific-guid-123');
	});

	it('should normalize Imgsed link to standard Instagram link', () => {
		const mockAtomXml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Test Feed</title>
  <link rel="alternate" href="https://imgsed.com/claudeai/"/>
  <entry>
    <title>Post - claudeai - Post Title</title>
    <link rel="alternate" href="https://imgsed.com/p/DVjsHcAEldb/"/>
    <content type="html">Setting up Claude doesn’t mean starting from scratch.</content>
    <author><name>claudeai</name></author>
  </entry>
</feed>`;

		const result = parseXML(mockAtomXml);
		expect(result.feedLink).toBe('https://www.instagram.com/claudeai/');
		expect(result.items.length).toBe(1);
		expect(result.items[0].link).toBe('https://www.instagram.com/p/DVjsHcAEldb/');
	});
});
