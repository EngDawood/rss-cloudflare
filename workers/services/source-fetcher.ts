import type { FeedItem, FetchResult } from '../types/feed';
import type { ChannelSource } from '../types/telegram';
import { fetchFeed } from './feed-fetcher';
import { RSS_ITEMS_LIMIT, FEED_CACHE_TTL } from '../constants';

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
			return await fetchRSSHubUrl(source.value, env);
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

			// Fetch sorted instances from KV
			const activeInstances = await getSortedInstances('rssbridge', env?.CACHE);

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
async function fetchRSSHubUrl(path: string, env?: Env): Promise<FetchResult> {
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

	// Fetch sorted instances from KV
	const activeInstances = await getSortedInstances(type, env?.CACHE);

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
