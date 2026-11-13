import { describe, it, expect, vi, afterEach } from 'vitest';
import {
	downloadMedia,
	fetchTikTokInfo,
	fetchFacebookInfo,
	fetchYouTubeQualities,
	formatFileSize,
} from '../workers/services/media-downloader';

/**
 * The media downloader is a client of the download-media Worker's public API
 * (POST /api/download + the get_media_info MCP tool) — it must never talk to
 * the btch backends directly. These tests stub global fetch and assert the
 * exact requests the client makes and how responses are mapped back to the
 * DownloaderResult shape the bot handlers already consume.
 */

const ENV = { DOWNLOAD_MEDIA_API_KEY: 'test-key' };

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<Response> | Response) {
	const fn = vi.fn(handler);
	vi.stubGlobal('fetch', fn);
	return fn;
}

function mcpToolResponse(structuredContent: unknown, isError = false): Response {
	return jsonResponse({
		jsonrpc: '2.0',
		id: 1,
		result: {
			content: [{ type: 'text', text: isError ? String(structuredContent) : JSON.stringify(structuredContent) }],
			...(isError ? { isError: true } : { structuredContent }),
		},
	});
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('downloadMedia (download-media API client)', () => {
	it('POSTs to /api/download with the API key and maps the success response', async () => {
		const fetchFn = stubFetch(async () =>
			jsonResponse({
				status: 'success',
				platform: 'TikTok',
				media: [{ type: 'video', url: 'https://cdn.example/v.mp4', quality: '720p', filesize: 2048 }],
				caption: 'hello',
				thumbnail: 'https://cdn.example/t.jpg',
			}),
		);

		const result = await downloadMedia('https://www.tiktok.com/@u/video/1', 'auto', ENV);

		expect(result.status).toBe('success');
		expect(result.media).toEqual([{ type: 'video', url: 'https://cdn.example/v.mp4', quality: '720p', filesize: 2048 }]);
		expect(result.caption).toBe('hello');
		expect(result.thumbnail).toBe('https://cdn.example/t.jpg');
		expect(result.platform).toBe('TikTok');

		expect(fetchFn).toHaveBeenCalledTimes(1);
		const [calledUrl, init] = fetchFn.mock.calls[0];
		expect(calledUrl).toBe('https://dl.engdawood.com/api/download');
		expect(init?.method).toBe('POST');
		expect((init?.headers as Record<string, string>)['X-API-Key']).toBe('test-key');
		expect(JSON.parse(String(init?.body))).toEqual({ url: 'https://www.tiktok.com/@u/video/1', mode: 'auto' });
	});

	it('honours a custom DOWNLOAD_MEDIA_API_URL (trailing slash trimmed) and forwards mode + platform', async () => {
		const fetchFn = stubFetch(async () => jsonResponse({ status: 'success', platform: 'Facebook', media: [] }));

		await downloadMedia('https://www.facebook.com/watch/?v=1', 'hd', { DOWNLOAD_MEDIA_API_KEY: 'k', DOWNLOAD_MEDIA_API_URL: 'https://example.workers.dev/' }, 'Facebook');

		const [calledUrl, init] = fetchFn.mock.calls[0];
		expect(calledUrl).toBe('https://example.workers.dev/api/download');
		expect(JSON.parse(String(init?.body))).toEqual({ url: 'https://www.facebook.com/watch/?v=1', mode: 'hd', platform: 'Facebook' });
	});

	it('fails closed without calling fetch when the API key is not configured', async () => {
		const fetchFn = stubFetch(async () => jsonResponse({ status: 'success', media: [] }));

		const result = await downloadMedia('https://youtu.be/abc', 'auto', {});

		expect(result.status).toBe('error');
		expect(result.error).toContain('DOWNLOAD_MEDIA_API_KEY');
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('maps API error responses (incl. retryable) to an error result', async () => {
		stubFetch(async () => jsonResponse({ status: 'error', error: 'Download service temporarily unavailable', retryable: true }, 502));

		const result = await downloadMedia('https://youtu.be/abc', 'auto', ENV);

		expect(result.status).toBe('error');
		expect(result.error).toBe('Download service temporarily unavailable');
		expect(result.retryable).toBe(true);
	});

	it('drops media items without a usable URL instead of passing them through', async () => {
		stubFetch(async () =>
			jsonResponse({
				status: 'success',
				platform: 'Instagram',
				media: [
					{ type: 'photo', url: 'https://cdn.example/p.jpg' },
					{ type: 'video', url: '' },
					{ type: 'video' },
				],
			}),
		);

		const result = await downloadMedia('https://www.instagram.com/p/xyz/', 'auto', ENV);

		expect(result.media).toEqual([{ type: 'photo', url: 'https://cdn.example/p.jpg' }]);
	});

	it('returns an error result (does not throw) when the API is unreachable', async () => {
		stubFetch(async () => {
			throw new Error('fetch failed');
		});

		const result = await downloadMedia('https://youtu.be/abc', 'auto', ENV);

		expect(result.status).toBe('error');
		expect(result.error).toContain('fetch failed');
	});
});

describe('picker info via the download-media MCP get_media_info tool', () => {
	it('fetchTikTokInfo maps caption / isImagePost / availableModes', async () => {
		const fetchFn = stubFetch(async () =>
			mcpToolResponse({ platform: 'TikTok', caption: 'cap', isImagePost: false, availableModes: ['auto', 'audio'] }),
		);

		const info = await fetchTikTokInfo('https://www.tiktok.com/@u/video/1', ENV);

		expect(info).toEqual({ caption: 'cap', isImagePost: false, audioAvailable: true });
		const [calledUrl, init] = fetchFn.mock.calls[0];
		expect(calledUrl).toBe('https://dl.engdawood.com/mcp');
		const rpc = JSON.parse(String(init?.body));
		expect(rpc.method).toBe('tools/call');
		expect(rpc.params.name).toBe('get_media_info');
		expect(rpc.params.arguments).toEqual({ url: 'https://www.tiktok.com/@u/video/1' });
	});

	it('fetchTikTokInfo returns null on a tool error', async () => {
		stubFetch(async () => mcpToolResponse('Could not fetch TikTok info for this URL.', true));

		expect(await fetchTikTokInfo('https://www.tiktok.com/@u/video/1', ENV)).toBeNull();
	});

	it('fetchFacebookInfo maps the hd/sd quality labels', async () => {
		stubFetch(async () =>
			mcpToolResponse({ platform: 'Facebook', availableModes: ['auto', 'hd', 'sd'], qualities: { hd: '720p (12.0MB)', sd: '360p (3.1MB)' } }),
		);

		const info = await fetchFacebookInfo('https://www.facebook.com/watch/?v=1', ENV);

		expect(info).toEqual({ hdLabel: '720p (12.0MB)', sdLabel: '360p (3.1MB)' });
	});

	it('fetchFacebookInfo returns null when the API reports no preview', async () => {
		stubFetch(async () => mcpToolResponse({ platform: 'Facebook', preview: null, note: 'No preview is available for Facebook.' }));

		expect(await fetchFacebookInfo('https://www.facebook.com/watch/?v=1', ENV)).toBeNull();
	});

	it('info helpers return null without an API key and never call fetch', async () => {
		const fetchFn = stubFetch(async () => mcpToolResponse({}));

		expect(await fetchTikTokInfo('https://www.tiktok.com/@u/video/1', {})).toBeNull();
		expect(await fetchFacebookInfo('https://www.facebook.com/watch/?v=1', {})).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it('fetchYouTubeQualities returns null — the API exposes no YouTube quality ladder', async () => {
		const fetchFn = stubFetch(async () => jsonResponse({}));

		expect(await fetchYouTubeQualities('https://youtu.be/abc', ENV)).toBeNull();
		expect(fetchFn).not.toHaveBeenCalled();
	});
});

describe('formatFileSize', () => {
	it('formats bytes the way the bot messages always have', () => {
		expect(formatFileSize(undefined)).toBe('');
		expect(formatFileSize(0)).toBe('');
		expect(formatFileSize(2048)).toBe('2KB');
		expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0MB');
	});
});
