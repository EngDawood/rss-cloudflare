/**
 * Media downloader — a thin client of the download-media Worker's public API.
 *
 * All extraction lives in the download-media Worker (EngDawood/download-media);
 * this module used to carry its own copy of the btch downloaders and the two
 * implementations kept drifting apart. Now every download is delegated:
 *
 *   POST {DOWNLOAD_MEDIA_API_URL}/api/download   { url, mode, platform? }
 *   Header: X-API-Key: <DOWNLOAD_MEDIA_API_KEY>
 *
 * Picker info (TikTok / Facebook) comes from the same Worker's MCP server —
 * the `get_media_info` tool at POST {DOWNLOAD_MEDIA_API_URL}/mcp — because the
 * REST API has no info endpoint.
 *
 * Config:
 * - `DOWNLOAD_MEDIA_API_URL` (var, optional) — defaults to https://dl.engdawood.com
 * - `DOWNLOAD_MEDIA_API_KEY` (secret, required) — must equal download-media's
 *   PUBLIC_API_KEY. Set it with:
 *     npx wrangler secret put DOWNLOAD_MEDIA_API_KEY
 *   Without it, downloads fail closed with an explanatory error and the picker
 *   helpers return null (callers already fall back to simpler pickers).
 *
 * Behaviour notes:
 * - YouTube quality picker: the API returns a single best result per mode and
 *   exposes no quality ladder (download-media dropped its own ladder too), so
 *   fetchYouTubeQualities always returns null and the bot shows its existing
 *   fallback Video/Audio picker.
 */

export interface MediaItem {
	type: 'video' | 'photo' | 'audio' | 'document';
	url: string;
	quality?: string;
	filesize?: number;
}

export interface DownloaderResult {
	status: 'success' | 'error' | 'picker';
	media?: MediaItem[];
	caption?: string;
	thumbnail?: string;
	mp3Url?: string;
	platform?: string;
	retryable?: boolean;
	error?: string;
}

export type DownloadMode = 'auto' | 'audio' | 'hd' | 'sd';

/** The slice of the Worker env this client needs (a structural subset of Env). */
export interface DownloadMediaConfig {
	DOWNLOAD_MEDIA_API_URL?: string;
	DOWNLOAD_MEDIA_API_KEY?: string;
}

const DEFAULT_API_URL = 'https://dl.engdawood.com';

/**
 * Downloads can run long on the API side (Facebook's fallback chain exceeds
 * 60s there), so give the request more headroom than a normal fetch.
 */
const API_TIMEOUT_MS = 90_000;

function apiBase(config?: DownloadMediaConfig): string {
	return (config?.DOWNLOAD_MEDIA_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
}

function notConfiguredResult(): DownloaderResult {
	return {
		status: 'error',
		error: 'Download media API is not configured: set the DOWNLOAD_MEDIA_API_KEY secret on this Worker (same value as download-media\'s PUBLIC_API_KEY).',
	};
}

/** Raw shape of a POST /api/download response (see download-media's CLAUDE-API.md). */
interface ApiDownloadResponse {
	status?: string;
	platform?: string;
	media?: Array<{ type?: string; url?: string; quality?: string; filesize?: number }>;
	caption?: string;
	thumbnail?: string;
	mp3Url?: string;
	error?: string;
	retryable?: boolean;
}

const MEDIA_TYPES: ReadonlyArray<MediaItem['type']> = ['video', 'photo', 'audio', 'document'];

function toMediaItems(raw: ApiDownloadResponse['media']): MediaItem[] {
	if (!Array.isArray(raw)) return [];
	const items: MediaItem[] = [];
	for (const item of raw) {
		if (!item || typeof item.url !== 'string' || !item.url.startsWith('http')) continue;
		items.push({
			type: MEDIA_TYPES.includes(item.type as MediaItem['type']) ? (item.type as MediaItem['type']) : 'video',
			url: item.url,
			...(item.quality ? { quality: item.quality } : {}),
			...(typeof item.filesize === 'number' ? { filesize: item.filesize } : {}),
		});
	}
	return items;
}

/**
 * Download media from a post URL via the download-media API.
 * Never throws — failures come back as `{ status: 'error', error }`, matching
 * the contract the bot handlers were built against.
 *
 * @param platform Optional platform hint ('YouTube', 'TikTok', …) — the API
 *                 re-detects from the URL when omitted, so this is only a hint.
 */
export async function downloadMedia(
	url: string,
	mode: DownloadMode = 'auto',
	config?: DownloadMediaConfig,
	platform?: string,
): Promise<DownloaderResult> {
	const apiKey = config?.DOWNLOAD_MEDIA_API_KEY;
	if (!apiKey) return notConfiguredResult();

	try {
		const res = await fetch(`${apiBase(config)}/api/download`, {
			method: 'POST',
			headers: {
				'X-API-Key': apiKey,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ url, mode, ...(platform ? { platform } : {}) }),
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
		});

		const data = (await res.json().catch(() => null)) as ApiDownloadResponse | null;
		if (!data) {
			return { status: 'error', error: `Download media API returned ${res.status} with no JSON body` };
		}
		if (!res.ok || data.status !== 'success') {
			return {
				status: 'error',
				error: data.error || `Download media API returned ${res.status}`,
				...(data.retryable ? { retryable: true } : {}),
			};
		}

		return {
			status: 'success',
			media: toMediaItems(data.media),
			...(data.caption ? { caption: data.caption } : {}),
			...(data.thumbnail ? { thumbnail: data.thumbnail } : {}),
			...(data.mp3Url ? { mp3Url: data.mp3Url } : {}),
			...(data.platform ? { platform: data.platform } : {}),
		};
	} catch (err: any) {
		console.error('[downloader] Download media API error:', err);
		return { status: 'error', error: err?.message || 'Unknown error' };
	}
}

/**
 * Call the download-media MCP `get_media_info` tool (JSON-RPC over POST /mcp).
 * Returns the tool's structured content, or null on any failure — tool error,
 * HTTP error, malformed response, or a missing API key.
 */
async function getMediaInfo(url: string, config?: DownloadMediaConfig): Promise<Record<string, unknown> | null> {
	const apiKey = config?.DOWNLOAD_MEDIA_API_KEY;
	if (!apiKey) return null;

	try {
		const res = await fetch(`${apiBase(config)}/mcp`, {
			method: 'POST',
			headers: {
				'X-API-Key': apiKey,
				'Content-Type': 'application/json',
				Accept: 'application/json, text/event-stream',
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'tools/call',
				params: { name: 'get_media_info', arguments: { url } },
			}),
			signal: AbortSignal.timeout(API_TIMEOUT_MS),
		});
		if (!res.ok) return null;

		const rpc = (await res.json().catch(() => null)) as any;
		const result = rpc?.result;
		if (!result || result.isError) return null;
		if (result.structuredContent && typeof result.structuredContent === 'object') {
			return result.structuredContent as Record<string, unknown>;
		}
		// Fallback: the tool result also carries the payload as JSON text.
		const text = result.content?.find((c: any) => c?.type === 'text')?.text;
		if (typeof text === 'string') {
			try {
				return JSON.parse(text) as Record<string, unknown>;
			} catch { /* fall through to null */ }
		}
		return null;
	} catch (err) {
		console.warn('[downloader] get_media_info failed:', (err as Error).message);
		return null;
	}
}

/**
 * Fetch TikTok post info for the picker UI (caption, image-post flag, audio
 * availability) via the download-media API. Null when no preview is available.
 */
export async function fetchTikTokInfo(
	url: string,
	config?: DownloadMediaConfig,
): Promise<{ caption: string; isImagePost: boolean; audioAvailable: boolean } | null> {
	const info = await getMediaInfo(url, config);
	if (!info || typeof info.isImagePost !== 'boolean') return null;
	const modes = Array.isArray(info.availableModes) ? (info.availableModes as string[]) : [];
	return {
		caption: typeof info.caption === 'string' ? info.caption : '',
		isImagePost: info.isImagePost,
		audioAvailable: modes.includes('audio'),
	};
}

/**
 * Fetch Facebook video info for the quality picker (HD/SD labels) via the
 * download-media API. Null when the video has a single quality / no preview.
 */
export async function fetchFacebookInfo(
	url: string,
	config?: DownloadMediaConfig,
): Promise<{ hdLabel: string; sdLabel: string } | null> {
	const info = await getMediaInfo(url, config);
	const qualities = info?.qualities as { hd?: unknown; sd?: unknown } | undefined;
	if (!qualities || typeof qualities.hd !== 'string' || typeof qualities.sd !== 'string') return null;
	return { hdLabel: qualities.hd, sdLabel: qualities.sd };
}

/**
 * YouTube quality ladder — the download-media API exposes none (it resolves a
 * single best result per mode), so this always returns null. The caller
 * (text-input-handler) already falls back to a simple Video/Audio picker on
 * null, which is also what download-media's own bot does now.
 */
export async function fetchYouTubeQualities(
	url: string,
	config?: DownloadMediaConfig,
): Promise<{ caption: string; thumbnail?: string; qualities: Array<{ quality: string; url: string; size?: string }> } | null> {
	void url;
	void config;
	return null;
}

/** Format bytes to human-readable string */
export function formatFileSize(bytes: number | undefined | null): string {
	if (!bytes || bytes <= 0) return '';
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
