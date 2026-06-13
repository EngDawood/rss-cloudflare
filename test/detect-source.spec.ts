import { describe, it, expect } from 'vitest';
import { detectAndPromoteSource } from '../workers/services/source-fetcher';

// KV is optional in detectAndPromoteSource -pass undefined to skip promotion side effects
const detect = (url: string) => detectAndPromoteSource(url, undefined);

describe('detectAndPromoteSource -RSS-Bridge URLs', () => {
	it('should detect a known RSS-Bridge instance and extract query string', async () => {
		const url = 'https://rss.bloat.cat/?action=display&bridge=InstagramBridge&format=Atom&context=Username&u=baharadawna&media_type=all';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_bridge');
		expect(result!.value).toBe('/?action=display&bridge=InstagramBridge&format=Atom&context=Username&u=baharadawna&media_type=all');
		expect(result!.promote).toBe('https://rss.bloat.cat');
	});

	it('should detect another known RSS-Bridge instance', async () => {
		const url = 'https://rssbridge.prenghy.org/?action=display&bridge=HackerNewsBridge&format=Atom';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_bridge');
		expect(result!.promote).toBe('https://rssbridge.prenghy.org');
		expect(result!.value).toContain('HackerNewsBridge');
	});

	it('should detect unknown RSS-Bridge-like hostname via "rss-bridge" in name', async () => {
		const url = 'https://my-custom-rss-bridge.example.com/?action=display&bridge=YoutubeBridge&format=Atom';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_bridge');
		expect(result!.promote).toBe('https://my-custom-rss-bridge.example.com');
		expect(result!.value).toContain('YoutubeBridge');
	});

	it('should detect unknown rssbridge hostname', async () => {
		const url = 'https://rssbridge.myserver.net/?action=display&bridge=TikTokBridge&format=Atom';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rss_bridge');
		expect(result!.promote).toBe('https://rssbridge.myserver.net');
	});
});

describe('detectAndPromoteSource -RSSHub URLs', () => {
	it('should detect a known RSSHub instance and extract path', async () => {
		const url = 'https://rsshub.cups.moe/thegradient/posts';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub');
		expect(result!.value).toBe('/thegradient/posts');
		expect(result!.promote).toBe('https://rsshub.cups.moe');
	});

	it('should detect another known RSSHub instance', async () => {
		const url = 'https://rsshub.rssforever.com/hackernews/best';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub');
		expect(result!.value).toBe('/hackernews/best');
		expect(result!.promote).toBe('https://rsshub.rssforever.com');
	});

	it('should detect unknown RSSHub-like hostname via "rsshub" in name', async () => {
		const url = 'https://rsshub.myserver.net/anthropic/news';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub');
		expect(result!.value).toBe('/anthropic/news');
		expect(result!.promote).toBe('https://rsshub.myserver.net');
	});

	it('should detect hostname starting with hub.', async () => {
		const url = 'https://hub.slarker.me/hackernews/new';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub');
		expect(result!.value).toBe('/hackernews/new');
		expect(result!.promote).toBe('https://hub.slarker.me');
	});

	it('should preserve query params in the path value', async () => {
		const url = 'https://rsshub.cups.moe/picnob.info/user/baharadawna/posts?limit=10';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub');
		expect(result!.value).toBe('/picnob.info/user/baharadawna/posts?limit=10');
	});
});

describe('detectAndPromoteSource -rsshub.app special case', () => {
	it('should recognise rsshub.app path but NOT promote the instance', async () => {
		const url = 'https://rsshub.app/thegradient/posts';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub');
		expect(result!.value).toBe('/thegradient/posts');
		expect(result!.promote).toBeNull();
	});

	it('should not promote rsshub.app even for picnob paths', async () => {
		const url = 'https://rsshub.app/picnob.info/user/baharadawna/posts?limit=10';
		const result = await detect(url);
		expect(result).not.toBeNull();
		expect(result!.type).toBe('rsshub');
		expect(result!.promote).toBeNull();
	});
});

describe('detectAndPromoteSource -non-matching URLs', () => {
	it('should return null for a plain RSS feed URL', async () => {
		expect(await detect('https://news.ycombinator.com/rss')).toBeNull();
	});

	it('should return null for an Instagram URL', async () => {
		expect(await detect('https://www.instagram.com/baharadawna')).toBeNull();
	});

	it('should return null for a TikTok URL', async () => {
		expect(await detect('https://www.tiktok.com/@khaby.lame')).toBeNull();
	});

	it('should return null for an invalid string', async () => {
		expect(await detect('not-a-url')).toBeNull();
		expect(await detect('')).toBeNull();
	});
});
