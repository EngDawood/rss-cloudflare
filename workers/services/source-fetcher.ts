import type { FeedItem, FetchResult } from '../types/feed';
import type { ChannelSource } from '../types/telegram';
import { fetchFeed } from './feed-fetcher';
import { RSS_ITEMS_LIMIT, FEED_CACHE_TTL } from '../constants';

// How many instances to try before giving up (top-ranked via KV benchmark)
const INSTANCE_RETRY_LIMIT = 3;

// The official RSSHub domain — extract paths from it but never add it to the instance pool (often down/blocked)
const RSSHUB_APP = 'https://rsshub.app';

export type DetectedFeedSource = {
	type: 'rsshub' | 'rss_bridge';
	value: string;        // path for rsshub (e.g. '/thegradient/posts'), query for rss_bridge
	promote: string | null; // instance URL to promote in KV, null = don't promote
};

/**
 * Parse a full RSSHub or RSS-Bridge URL into its canonical path/query and detected instance.
 * Returns null if the URL doesn't match any known pattern.
 *
 * rsshub.app URLs are recognised but the instance is NOT promoted (it is unreliable).
 * All other RSSHub/RSS-Bridge instances ARE promoted to top of the KV sorted list.
 */
export async function detectAndPromoteSource(
	url: string,
	cache?: KVNamespace
): Promise<DetectedFeedSource | null> {
	let parsed: URL;
	try { parsed = new URL(url); } catch { return null; }

	const origin = parsed.origin;

	// ── RSS-Bridge ───────────────────────────────────────────────────────────
	const bridgeMatch = RSS_BRIDGE_INSTANCES.find(inst => url.startsWith(inst));
	if (bridgeMatch) {
		const value = url.substring(bridgeMatch.length) || '/';
		if (cache) await promoteInstanceInKV(cache, 'rssbridge', bridgeMatch);
		return { type: 'rss_bridge', value, promote: bridgeMatch };
	}

	// Unknown RSS-Bridge-like host (hostname contains 'rss-bridge' or 'rssbridge')
	if (parsed.hostname.includes('rss-bridge') || parsed.hostname.includes('rssbridge')) {
		const value = url.substring(origin.length) || '/';
		if (cache) await promoteInstanceInKV(cache, 'rssbridge', origin, true);
		return { type: 'rss_bridge', value, promote: origin };
	}

	// ── RSSHub — rsshub.app special case ────────────────────────────────────
	if (origin === RSSHUB_APP || url.startsWith(RSSHUB_APP + '/')) {
		const value = parsed.pathname + parsed.search;
		return { type: 'rsshub', value, promote: null }; // don't promote rsshub.app
	}

	// Known RSSHub instance
	const rsshubMatch = RSSHUB_INSTANCES.find(inst => url.startsWith(inst));
	if (rsshubMatch) {
		const value = parsed.pathname + parsed.search;
		if (cache) await promoteInstanceInKV(cache, 'rsshub', rsshubMatch);
		return { type: 'rsshub', value, promote: rsshubMatch };
	}

	// Unknown RSSHub-like host (hostname contains 'rsshub' or starts with 'hub.')
	if (parsed.hostname.includes('rsshub') || parsed.hostname.startsWith('hub.')) {
		const value = parsed.pathname + parsed.search;
		if (cache) await promoteInstanceInKV(cache, 'rsshub', origin, true);
		return { type: 'rsshub', value, promote: origin };
	}

	return null;
}

async function promoteInstanceInKV(
	cache: KVNamespace,
	type: 'rssbridge' | 'rsshub',
	instance: string,
	addIfMissing = false
): Promise<void> {
	const key = `instances:sorted:${type}`;
	const defaultList = type === 'rssbridge' ? RSS_BRIDGE_INSTANCES : RSSHUB_INSTANCES;
	try {
		const raw = await cache.get(key);
		let list: string[] = raw ? (JSON.parse(raw) as string[]) : [...defaultList];
		if (!list.includes(instance)) {
			if (!addIfMissing) return;
			list = [instance, ...list];
		} else {
			list = [instance, ...list.filter(i => i !== instance)];
		}
		await cache.put(key, JSON.stringify(list));
	} catch {
		// best-effort
	}
}

// --- RSS-Bridge Public Instances (failover list) ---
export const RSS_BRIDGE_INSTANCES = [
	'https://rssbridge.prenghy.org',
	'https://rss-bridge.sans-nuage.fr',
	'https://rss.bloat.cat',
	'https://rss-bridge.org/bridge01',
	'https://rssbridge.flossboxin.org.in',
	'https://rss-bridge.cheredeprince.net',
	'https://rss-bridge.lewd.tech',
	'https://wtf.roflcopter.fr/rss-bridge',
	'https://rss.nixnet.services',
	'https://rss-bridge.ggc-project.de',
	'https://rssbridge.boldair.dev',
	'https://rss-bridge.bb8.fun',
	'https://ololbu.ru/rss-bridge',
	'https://tools.bheil.net/rss-bridge',
	'https://bridge.suumitsu.eu',
	'https://feed.eugenemolotov.ru',
	'https://rss-bridge.mediani.de',
	'https://rb.ash.fail',
	'https://rss.noleron.com',
	'https://rssbridge.projectsegfau.lt',
	'https://rb.vern.cc'
];

// RSS-Bridge instances known to have TikTokBridge enabled
export const RSS_BRIDGE_TIKTOK_INSTANCES = [
	'https://rss-bridge.org/bridge01',
	...RSS_BRIDGE_INSTANCES.filter(inst => inst !== 'https://rss-bridge.org/bridge01')
];

// RSSHub public instances for Instagram Stories fallback
export const RSSHUB_INSTANCES = [
	'https://rsshub.rssforever.com',
	'https://hub.slarker.me',
	'https://rsshub.pseudoyu.com',
	'https://rsshub.ktachibana.party',
	'https://rss.owo.nz',
	'https://rsshub.umzzz.com',
	'https://rsshub.isrss.com',
	'https://rsshub-balancer.virworks.moe',
	'https://rss.spriple.org',
	'https://rsshub.cups.moe',
	'https://rss.4040940.xyz'
];

/**
 * Retrieve sorted instances list from KV CACHE or fall back to default hardcoded lists.
 */
export async function getSortedInstances(
	type: 'rssbridge' | 'tiktok' | 'rsshub',
	cache?: KVNamespace
): Promise<string[]> {
	const defaultList = 
		type === 'rssbridge' ? RSS_BRIDGE_INSTANCES :
		type === 'tiktok' ? RSS_BRIDGE_TIKTOK_INSTANCES :
		RSSHUB_INSTANCES;

	if (!cache) {
		return defaultList;
	}

	try {
		const cached = await cache.get(`instances:sorted:${type}`);
		if (cached) {
			const parsed = JSON.parse(cached) as string[];
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		}
	} catch (err) {
		console.error(`[SourceFetcher] Error fetching sorted instances for ${type}:`, err);
	}

	return defaultList;
}

/**
 * Route to correct fetcher based on source type.
 */
export async function fetchForSource(source: ChannelSource, env?: Env): Promise<FetchResult> {
	const type = source.type as string;

	switch (type) {
		case 'instagram_user':
		case 'username': // legacy
			return await fetchInstagramUser(source.value, env);
		case 'instagram_tag':
		case 'hashtag': // legacy
			return await fetchInstagramTag(source.value, env);
		case 'instagram_story':
			return await fetchInstagramStory(source.value, env);
		case 'rss_url':
			return await fetchRssUrl(source.value, env);
		case 'rsshub_url':
		case 'rsshub':
			return await fetchRSSHubUrl(source.value, env);
		case 'rss_bridge':
			return await fetchRssBridgeGeneric(source.value, env);
		case 'tiktok_user':
			return await fetchTikTokUser(source.value, env);
		default:
			return {
				items: [],
				feedTitle: '',
				feedLink: '',
				errors: [{ tier: 'config', message: `Unknown source type: ${source.type}` }],
			};
	}
}

/**
 * Fetch an RSS URL, with RSS-Bridge instance failover for known bridge URLs.
 * If the URL is from a known RSS-Bridge instance and fails, try other instances.
 */
async function fetchRssUrl(url: string, env?: Env): Promise<FetchResult> {
	// Try the original URL first
	const result = await fetchFeed(url, undefined, env?.CACHE, FEED_CACHE_TTL);
	if (result.items.length > 0) return result;

	// Check if this is a known RSS-Bridge URL that can failover
	try {
		const parsed = new URL(url);
		const origin = parsed.origin;
		const matchedInstance = RSS_BRIDGE_INSTANCES.find((inst) => origin === inst || url.startsWith(inst));

		if (matchedInstance) {
			// It's an RSS-Bridge URL — try other instances with the same query
			const queryPath = url.substring(matchedInstance.length); // e.g., "/?action=display&bridge=..."
			console.log(`[RSSBridge] URL ${matchedInstance} failed, trying other instances...`);

			// Fetch sorted instances from KV, limit to top N
			const activeInstances = (await getSortedInstances('rssbridge', env?.CACHE)).slice(0, INSTANCE_RETRY_LIMIT);

			for (const instance of activeInstances) {
				if (instance === matchedInstance) continue;
				const altUrl = instance + queryPath;
				console.log(`[RSSBridge] Failover trying ${instance}...`);
				const altResult = await fetchFeed(altUrl, undefined, env?.CACHE, FEED_CACHE_TTL);
				if (altResult.items.length > 0) {
					console.log(`[RSSBridge] Failover success with ${instance}`);
					return altResult;
				}
			}
		}
	} catch {
		// URL parsing failed, just return original result
	}

	return result;
}

/**
 * Fetch a RSSHub path via all known RSSHub instances, with failover.
 * The value stored is the path+query (e.g. "/anthropic/news"), not a full URL.
 */
export async function fetchRSSHubUrl(path: string, env?: Env): Promise<FetchResult> {
	return fetchFromRSSBridgeInstances(
		(instance) => `${instance}${path}`,
		`rsshub:${path}`,
		RSSHUB_INSTANCES,
		env
	);
}

/**
 * Build the RSS-Bridge URL for a TikTok username.
 */
function buildTikTokUserUrl(instance: string, username: string): string {
	return `${instance}/?action=display&bridge=TikTokBridge&context=By+user&username=${encodeURIComponent(username)}&format=Atom`;
}

/**
 * Fetch TikTok user feed via RSS-Bridge instances, with failover.
 */
export async function fetchTikTokUser(username: string, env?: Env): Promise<FetchResult> {
	return fetchFromRSSBridgeInstances(
		(instance) => buildTikTokUserUrl(instance, username),
		`tiktok @${username}`,
		RSS_BRIDGE_TIKTOK_INSTANCES,
		env
	);
}

/**
 * Build the RSSHub URL for an Instagram Story feed.
 */
export function buildRSSHubStoryUrl(instance: string, username: string): string {
	return `${instance}/picnob.info/user/${encodeURIComponent(username)}/stories?limit=10`;
}

/**
 * Build the RSSHub URL for an Instagram Post feed.
 */
export function buildRSSHubPostUrl(instance: string, username: string): string {
	return `${instance}/picnob.info/user/${encodeURIComponent(username)}/posts?limit=10`;
}

/**
 * Fetch Instagram Story feed via RSSHub instances, with failover.
 */
export async function fetchInstagramStory(username: string, env?: Env): Promise<FetchResult> {
	return fetchFromRSSBridgeInstances(
		(instance) => buildRSSHubStoryUrl(instance, username),
		`${username} (Stories)`,
		RSSHUB_INSTANCES,
		env
	);
}

/**
 * Build the RSS-Bridge URL for an Instagram username.
 */
function buildRSSBridgeUserUrl(instance: string, username: string): string {
	return `${instance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${encodeURIComponent(username)}&media_type=all`;
}

/**
 * Build the RSS-Bridge URL for an Instagram hashtag.
 */
function buildRSSBridgeTagUrl(instance: string, hashtag: string): string {
	return `${instance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Hashtag&h=${encodeURIComponent(hashtag)}&media_type=all`;
}

/**
 * Fetch Instagram user feed via RSS-Bridge instances, with failover.
 */
export async function fetchInstagramUser(username: string, env?: Env): Promise<FetchResult> {
	return fetchFromRSSBridgeInstances(
		(instance) => buildRSSBridgeUserUrl(instance, username),
		username,
		RSS_BRIDGE_INSTANCES,
		env
	);
}

/**
 * Fetch Instagram hashtag feed via RSS-Bridge instances, with failover.
 */
export async function fetchInstagramTag(hashtag: string, env?: Env): Promise<FetchResult> {
	return fetchFromRSSBridgeInstances(
		(instance) => buildRSSBridgeTagUrl(instance, hashtag),
		`#${hashtag}`,
		RSS_BRIDGE_INSTANCES,
		env
	);
}

/**
 * Fetch an RSS-Bridge query string (without instance prefix) via top ranked instances.
 * The value stored is the query string (e.g. "/?action=display&bridge=..."), not a full URL.
 */
export async function fetchRssBridgeGeneric(queryString: string, env?: Env): Promise<FetchResult> {
	return fetchFromRSSBridgeInstances(
		(instance) => `${instance}${queryString}`,
		`rss_bridge:${queryString.substring(0, 60)}`,
		RSS_BRIDGE_INSTANCES,
		env
	);
}

/**
 * Try each RSS-Bridge instance in order, return first successful result.
 */
async function fetchFromRSSBridgeInstances(
	buildUrl: (instance: string) => string,
	label: string,
	instances: string[] = RSS_BRIDGE_INSTANCES,
	env?: Env
): Promise<FetchResult> {
	const allErrors: FetchResult['errors'] = [];

	// Determine type based on the input list
	let type: 'rssbridge' | 'tiktok' | 'rsshub' = 'rssbridge';
	if (instances === RSSHUB_INSTANCES) {
		type = 'rsshub';
	} else if (instances === RSS_BRIDGE_TIKTOK_INSTANCES) {
		type = 'tiktok';
	}

	// Fetch sorted instances from KV, limit to top N to avoid exhausting timeouts
	const activeInstances = (await getSortedInstances(type, env?.CACHE)).slice(0, INSTANCE_RETRY_LIMIT);

	for (const instance of activeInstances) {
		const url = buildUrl(instance);
		console.log(`[RSSBridge] Trying ${instance} for ${label}...`);

		const result = await fetchFeed(url, undefined, env?.CACHE, FEED_CACHE_TTL);

		if (result.items.length > 0) {
			console.log(`[RSSBridge] Success with ${instance}`);
			return {
				...result,
				items: result.items.slice(0, RSS_ITEMS_LIMIT),
			};
		}

		allErrors.push(
			...result.errors.map((e) => ({ ...e, tier: `rss-bridge:${instance}` })),
		);
	}

	console.warn(`[RSSBridge] All instances failed for ${label}`);
	return {
		items: [],
		feedTitle: '',
		feedLink: '',
		errors: allErrors.length > 0
			? allErrors
			: [{ tier: 'rss-bridge', message: 'All instances returned empty results' }],
	};
}
