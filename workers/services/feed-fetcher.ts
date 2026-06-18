import * as cheerio from 'cheerio';
import type { FeedItem, FeedItemMedia, FeedItemMediaType, FetchResult } from '../types/feed';

import { CACHE_PREFIX_FEED } from '../constants';

const FETCH_TIMEOUT_MS = 10000;

/**
 * Fetch and parse any RSS/Atom feed URL into normalized FeedItem[].
 * Includes optional KV caching.
 */
export async function fetchFeed(
	url: string,
	overrideFeedTitle?: string,
	kv?: KVNamespace,
	cacheTtl?: number
): Promise<FetchResult> {
	const cacheKey = `${CACHE_PREFIX_FEED}${url}`;

	// 1. Try to get from cache first
	if (kv) {
		try {
			const cachedXml = await kv.get(cacheKey);
			if (cachedXml) {
				console.log(`[Cache] Hit: ${url}`);
				return parseXML(cachedXml, overrideFeedTitle);
			}
		} catch (err) {
			console.warn(`[Cache] Error reading from KV for ${url}:`, err);
		}
	}

	// 2. Cache miss: Perform HTTP fetch
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)',
				Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
			},
		});

		clearTimeout(timeout);

		if (!response.ok) {
			return {
				items: [],
				feedTitle: '',
				feedLink: '',
				errors: [{ tier: 'fetch', status: response.status, message: `HTTP ${response.status}` }],
			};
		}

		const xml = await response.text();

		// Detect RSS-Bridge error pages/feeds — cURL failures, PHP exceptions, "Bridge returned error N"
		if (
			xml.includes('HttpException') ||
			xml.includes('cURL error') ||
			xml.includes('Bridge returned error') ||
			xml.includes('returnServerError')
		) {
			const snippet = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
			return {
				items: [],
				feedTitle: '',
				feedLink: '',
				errors: [{ tier: 'fetch', message: `RSS-Bridge error: ${snippet}` }],
			};
		}

		if (!xml.includes('<rss') && !xml.includes('<feed')) {
			return {
				items: [],
				feedTitle: '',
				feedLink: '',
				errors: [{ tier: 'parse', message: 'Response is not RSS or Atom XML' }],
			};
		}

		// 3. Store successful result in cache if KV is provided
		if (kv && cacheTtl && cacheTtl > 0) {
			try {
				await kv.put(cacheKey, xml, { expirationTtl: cacheTtl });
				console.log(`[Cache] Stored: ${url} (TTL: ${cacheTtl}s)`);
			} catch (err) {
				console.warn(`[Cache] Error writing to KV for ${url}:`, err);
			}
		}

		return parseXML(xml, overrideFeedTitle);
	} catch (err: any) {
		const message = err.name === 'AbortError' ? 'Timeout' : err.message || 'Unknown error';
		return {
			items: [],
			feedTitle: '',
			feedLink: '',
			errors: [{ tier: 'fetch', message }],
		};
	}
}

/**
 * Parse raw RSS/Atom XML into FeedItem[].
 */
export function parseXML(xml: string, overrideFeedTitle?: string): FetchResult {
	const $ = cheerio.load(xml, { xmlMode: true });
	const isAtom = $('feed').length > 0;

	const feedTitle = overrideFeedTitle || $('feed > title, channel > title').first().text().trim() || 'Untitled Feed';
	const feedLink = isAtom
		? ($('feed > link[rel="alternate"]').attr('href') || $('feed > link').attr('href') || '')
		: ($('channel > link').text().trim() || '');

	const items: FeedItem[] = [];
	const entries = isAtom ? $('entry') : $('item');

	entries.each((_, el) => {
		const entry = $(el);
		const item = isAtom ? parseAtomEntry(entry, $, feedTitle, feedLink) : parseRSSItem(entry, $, feedTitle, feedLink);
		if (item) items.push(item);
	});

	return { items, feedTitle, feedLink, errors: [] };
}

function generateFallbackId(title: string, text: string): string {
	const content = (title + text).trim();
	if (!content) {
		return 'fallback-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
	}
	let hash = 0;
	for (let i = 0; i < content.length; i++) {
		const char = content.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return 'hash-' + Math.abs(hash).toString(36);
}

function parseAtomEntry(
	entry: cheerio.Cheerio<any>,
	$: cheerio.CheerioAPI,
	feedTitle: string,
	feedLink: string,
): FeedItem | null {
	const id = entry.find('id').text().replace(/\s+/g, '');
	const link = (entry.find('link[rel="alternate"]').attr('href')
		|| entry.find('link').attr('href')
		|| '').replace(/\s+/g, '');
	const title = entry.find('title').text().trim();
	const author = entry.find('author > name').text().trim();
	const published = entry.find('published').text() || entry.find('updated').text() || '';
	const timestamp = published ? Math.floor(new Date(published).getTime() / 1000) : 0;

	// Content extraction
	const contentHtml = entry.find('content').text() || entry.find('summary').text() || '';

	// Extract media
	const media = extractMedia(entry, $, contentHtml);

	// Extract text: try to get caption/body from content
	const text = extractTextFromHtml(contentHtml);

	const mediaType = deriveMediaType(media);

	// Extract topics from <category> elements (term attr or text content)
	const topics: string[] = [];
	entry.find('category').each((_, el) => {
		const term = $(el).attr('term') || $(el).text().trim();
		if (term) topics.push(term);
	});

	return {
		id: id || link || generateFallbackId(title, text),
		link,
		title,
		text,
		author,
		feedTitle,
		feedLink,
		timestamp,
		mediaType,
		media,
		topics: topics.length > 0 ? topics : undefined,
		contentHtml: contentHtml ? contentHtml : undefined,
	};
}

function parseRSSItem(
	entry: cheerio.Cheerio<any>,
	$: cheerio.CheerioAPI,
	feedTitle: string,
	feedLink: string,
): FeedItem | null {
	const guid = entry.find('guid').text().replace(/\s+/g, '');
	const link = entry.find('link').text().replace(/\s+/g, '');
	const title = entry.find('title').text().trim();
	const author = entry.find('author').text().trim()
		|| entry.find('dc\\:creator').text().trim()
		|| '';
	const pubDate = entry.find('pubDate').text() || '';
	const timestamp = pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : 0;

	const contentHtml = entry.find('content\\:encoded').text()
		|| entry.find('description').text()
		|| '';

	// Extract media from enclosures, media:content, and content HTML
	const media = extractMediaFromRSS(entry, $, contentHtml);

	const text = extractTextFromHtml(contentHtml);
	const mediaType = deriveMediaType(media);

	// Extract topics from <category> text content
	const topics: string[] = [];
	entry.find('category').each((_, el) => {
		const term = $(el).text().trim();
		if (term) topics.push(term);
	});

	return {
		id: guid || link || generateFallbackId(title, text),
		link,
		title,
		text,
		author,
		feedTitle,
		feedLink,
		timestamp,
		mediaType,
		media,
		topics: topics.length > 0 ? topics : undefined,
		contentHtml: contentHtml ? contentHtml : undefined,
	};
}

/**
 * Extract media from Atom entries: enclosures, content HTML (video/img).
 */
function extractMedia(
	entry: cheerio.Cheerio<any>,
	$: cheerio.CheerioAPI,
	contentHtml: string,
): FeedItemMedia[] {
	const media: FeedItemMedia[] = [];
	const seen = new Set<string>();

	// Atom enclosures: <link rel="enclosure">
	entry.find('link[rel="enclosure"]').each((_, el) => {
		const href = $(el).attr('href')?.replace(/\s+/g, '');
		const mimeType = $(el).attr('type') || '';
		if (href && !seen.has(href)) {
			seen.add(href);
			media.push({
				type: mimeType.startsWith('video/') ? 'video' : 'photo',
				url: href,
			});
		}
	});

	// Parse content HTML for <video><source> and <img>
	if (contentHtml) {
		const content$ = cheerio.load(contentHtml);

		// Video from <video><source src="...">
		content$('video source, source[type^="video"]').each((_, el) => {
			const src = content$(el).attr('src')?.replace(/\s+/g, '');
			if (src && !seen.has(src)) {
				seen.add(src);
				// Find poster/thumbnail
				const poster = content$(el).closest('video').attr('poster')?.replace(/\s+/g, '');
				media.push({ type: 'video', url: src, thumbnailUrl: poster });
			}
		});

		// Images from <img> (only if no enclosures found, to avoid duplicates)
		if (media.length === 0) {
			content$('img').each((_, el) => {
				const src = content$(el).attr('src')?.replace(/\s+/g, '');
				if (src && !seen.has(src)) {
					seen.add(src);
					media.push({ type: 'photo', url: src });
				}
			});
		}
	}

	return media;
}

/**
 * Extract media from RSS items: <enclosure>, <media:content>, content HTML.
 */
function extractMediaFromRSS(
	entry: cheerio.Cheerio<any>,
	$: cheerio.CheerioAPI,
	contentHtml: string,
): FeedItemMedia[] {
	const media: FeedItemMedia[] = [];
	const seen = new Set<string>();

	// RSS <enclosure>
	entry.find('enclosure').each((_, el) => {
		const url = $(el).attr('url')?.replace(/\s+/g, '');
		const mimeType = $(el).attr('type') || '';
		if (url && !seen.has(url)) {
			seen.add(url);
			media.push({
				type: mimeType.startsWith('video/') ? 'video' : 'photo',
				url,
			});
		}
	});

	// <media:content>
	entry.find('media\\:content').each((_, el) => {
		const url = $(el).attr('url')?.replace(/\s+/g, '');
		const medium = $(el).attr('medium') || '';
		const mimeType = $(el).attr('type') || '';
		if (url && !seen.has(url)) {
			seen.add(url);
			const thumbnail = entry.find('media\\:thumbnail').attr('url')?.replace(/\s+/g, '');
			media.push({
				type: medium === 'video' || mimeType.startsWith('video/') ? 'video' : 'photo',
				url,
				thumbnailUrl: thumbnail,
			});
		}
	});

	// Fallback: extract from content HTML
	if (media.length === 0 && contentHtml) {
		const content$ = cheerio.load(contentHtml);

		content$('video source, source[type^="video"]').each((_, el) => {
			const src = content$(el).attr('src')?.replace(/\s+/g, '');
			if (src && !seen.has(src)) {
				seen.add(src);
				media.push({ type: 'video', url: src });
			}
		});

		if (media.length === 0) {
			content$('img').each((_, el) => {
				const src = content$(el).attr('src')?.replace(/\s+/g, '');
				if (src && !seen.has(src)) {
					seen.add(src);
					media.push({ type: 'photo', url: src });
				}
			});
		}
	}

	return media;
}

/**
 * Strip HTML tags and extract plain text from content HTML.
 * For RSS-Bridge Instagram Atom, the caption is after the last <br><br>.
 */
function extractTextFromHtml(html: string): string {
	if (!html) return '';

	// Instagram RSS-Bridge pattern: caption is after the last <br><br>
	const brbrIdx = html.lastIndexOf('<br><br>');
	let textSource = html;
	if (brbrIdx !== -1) {
		const afterBrbr = html.substring(brbrIdx + 8);
		// Only use the after-brbr text if it has meaningful content
		const stripped = afterBrbr.replace(/<[^>]+>/g, '').trim();
		if (stripped.length > 0) {
			textSource = afterBrbr;
		}
	}

	const raw = textSource
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>|<\/div>|<\/section>|<\/article>|<\/li>|<\/h[1-6]>|<\/blockquote>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

	return decodeHtmlEntities(raw);
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&hellip;/gi, '…')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&mdash;/gi, '—')
		.replace(/&ndash;/gi, '–')
		.replace(/&ldquo;/gi, '“')
		.replace(/&rdquo;/gi, '”')
		.replace(/&lsquo;/gi, '‘')
		.replace(/&rsquo;/gi, '’')
		.replace(/&laquo;/gi, '«')
		.replace(/&raquo;/gi, '»')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
		.replace(/&amp;/g, '&'); // Must be last to avoid double-decoding
}

function deriveMediaType(media: FeedItemMedia[]): FeedItemMediaType {
	if (media.length === 0) return 'none';
	if (media.length > 1) return 'album';
	return media[0].type === 'video' ? 'video' : 'photo';
}
