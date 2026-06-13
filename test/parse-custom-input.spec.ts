import { describe, it, expect } from 'vitest';
import { parseCustomInput } from '../test/test';
import { RSS_BRIDGE_INSTANCES, RSSHUB_INSTANCES } from '../workers/services/source-fetcher';

describe('parseCustomInput', () => {
	it('should classify RSSHub URL by known instance host', () => {
		const instance = RSSHUB_INSTANCES[0]; // e.g. https://rsshub.rssforever.com
		const result = parseCustomInput(`${instance}/tiktok/user/testuser`);
		expect(result.type).toBe('rsshub');
	});

	it('should classify RSSHub URL by rsshub in hostname', () => {
		const result = parseCustomInput('https://my-rsshub.example.com/some/route');
		expect(result.type).toBe('rsshub');
	});

	it('should extract pathname from RSSHub URL', () => {
		const instance = RSSHUB_INSTANCES[0];
		const result = parseCustomInput(`${instance}/tiktok/user/testuser?limit=5`);
		expect(result.type).toBe('rsshub');
		expect(result.path).toBe('/tiktok/user/testuser?limit=5');
	});

	it('should classify RSS-Bridge URL by known instance host', () => {
		const instance = RSS_BRIDGE_INSTANCES[0];
		const result = parseCustomInput(`${instance}/some/path`);
		expect(result.type).toBe('rssbridge');
	});

	it('should classify RSS-Bridge URL by bridge= parameter', () => {
		const result = parseCustomInput('https://unknown.example.com/?bridge=InstagramBridge&action=display');
		expect(result.type).toBe('rssbridge');
		expect(result.path).toContain('bridge=InstagramBridge');
	});

	it('should classify generic external URL', () => {
		const result = parseCustomInput('https://news.ycombinator.com/rss');
		expect(result.type).toBe('generic');
		expect(result.path).toBe('https://news.ycombinator.com/rss');
	});

	it('should classify bare path as rsshub', () => {
		const result = parseCustomInput('/anthropic/news');
		expect(result.type).toBe('rsshub');
		expect(result.path).toBe('/anthropic/news');
	});

	it('should prepend / to path without leading slash', () => {
		const result = parseCustomInput('anthropic/news');
		expect(result.type).toBe('rsshub');
		expect(result.path).toBe('/anthropic/news');
	});

	it('should classify ?bridge=... as rssbridge', () => {
		const result = parseCustomInput('?bridge=InstagramBridge&format=Atom');
		expect(result.type).toBe('rssbridge');
		expect(result.path).toMatch(/^\//);
		expect(result.path).toContain('bridge=InstagramBridge');
	});

	it('should classify /? as rssbridge', () => {
		const result = parseCustomInput('/?action=display&bridge=TikTokBridge');
		expect(result.type).toBe('rssbridge');
		expect(result.path).toContain('action=display');
	});

	it('should handle path with query parameters', () => {
		const result = parseCustomInput('/tiktok/user/someone?limit=10');
		expect(result.type).toBe('rsshub');
		expect(result.path).toBe('/tiktok/user/someone?limit=10');
	});
});
