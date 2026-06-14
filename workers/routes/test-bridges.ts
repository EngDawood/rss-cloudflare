import { Context } from 'hono';
import { CACHE_PREFIX_FEED } from '../constants';

type HonoEnv = { Bindings: Env };

export const FULL_RSS_BRIDGE_INSTANCES = [
	'https://rss-bridge.org/bridge01',
	'https://rssbridge.flossboxin.org.in',
	'https://rss-bridge.cheredeprince.net',
	'https://rss-bridge.sans-nuage.fr',
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
	'https://rb.vern.cc',
	'https://rss.bloat.cat',
	'https://rssbridge.prenghy.org'
];

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

export const RSS_BRIDGE_TIKTOK_INSTANCES = [
	'https://rss-bridge.org/bridge01',
	...FULL_RSS_BRIDGE_INSTANCES
];

const timeoutMs = 15000; // 15 seconds

export interface BridgeBenchmarkParams {
	username: string;
	platform: string; // 'instagram' | 'tiktok' | 'instagram_story' | 'custom_rsshub' | 'custom_rssbridge'
	instancesType: string; // 'all' | 'rssbridge' | 'rsshub'
	useCache: boolean;
	customRoute?: string; // path/action suffix for custom_rsshub / custom_rssbridge platforms
	overrideInstances?: string[]; // when provided, skip instance-set resolution and use this list directly
}

export interface BridgeBenchmarkResult {
	instance: string;
	url: string;
	status: string;
	durationMs: number;
	items: number;
	cacheStatus: string;
}

export async function runBridgeBenchmark(
	env: Env,
	params: BridgeBenchmarkParams
): Promise<{ results: BridgeBenchmarkResult[]; engine: string }> {
	const { username, platform, instancesType, useCache, customRoute, overrideInstances } = params;
	let instancesToTest: string[] = [];
	let engine = '';

	if (overrideInstances) {
		instancesToTest = overrideInstances;
		if (platform === 'custom_rsshub') engine = 'RSSHub (custom route)';
		else if (platform === 'custom_rssbridge') engine = 'RSS-Bridge (custom action)';
		else if (instancesType === 'rsshub') engine = 'RSSHub';
		else if (instancesType === 'rssbridge') engine = 'RSS-Bridge';
		else engine = 'RSS-Bridge vs RSSHub';
	} else if (platform === 'custom_rsshub') {
		instancesToTest = RSSHUB_INSTANCES;
		engine = 'RSSHub (custom route)';
	} else if (platform === 'custom_rssbridge') {
		instancesToTest = FULL_RSS_BRIDGE_INSTANCES;
		engine = 'RSS-Bridge (custom action)';
	} else {
		const bridgeList = platform === 'tiktok' ? RSS_BRIDGE_TIKTOK_INSTANCES : FULL_RSS_BRIDGE_INSTANCES;
		if (instancesType === 'rsshub') {
			instancesToTest = RSSHUB_INSTANCES;
			engine = 'RSSHub';
		} else if (instancesType === 'rssbridge') {
			instancesToTest = bridgeList;
			engine = 'RSS-Bridge';
		} else {
			instancesToTest = [...bridgeList, ...RSSHUB_INSTANCES];
			engine = 'RSS-Bridge vs RSSHub';
		}
	}

	async function testInstance(instance: string): Promise<BridgeBenchmarkResult> {
		let url = '';
		const isRSSHub = RSSHUB_INSTANCES.includes(instance);

		if (platform === 'custom_rsshub' || platform === 'custom_rssbridge') {
			const suffix = (customRoute || '').trim();
			const sep = suffix.startsWith('/') || suffix.startsWith('?') ? '' : '/';
			url = `${instance}${sep}${suffix}`;
		} else if (platform === 'tiktok') {
			if (isRSSHub) {
				url = `${instance}/tiktok/user/${encodeURIComponent(username)}?limit=10`;
			} else {
				url = `${instance}/?action=display&bridge=TikTokBridge&context=By+user&username=${encodeURIComponent(username)}&format=Atom`;
			}
		} else if (platform === 'instagram') {
			if (isRSSHub) {
				url = `${instance}/picnob.info/user/${encodeURIComponent(username)}/posts?limit=10`;
			} else {
				url = `${instance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${encodeURIComponent(username)}&media_type=all`;
			}
		} else if (platform === 'instagram_story') {
			if (isRSSHub) {
				url = `${instance}/picnob.info/user/${encodeURIComponent(username)}/stories?limit=10`;
			} else {
				url = `${instance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${encodeURIComponent(username)}&media_type=all`;
			}
		}

		let cacheStatus = 'Bypassed';
		if (useCache && env.CACHE) {
			try {
				const cached = await env.CACHE.get(`${CACHE_PREFIX_FEED}${url}`);
				if (cached) {
					return {
						instance,
						url,
						status: 'Success',
						durationMs: 0,
						items: (cached.match(/<entry>|<item>/g) || []).length,
						cacheStatus: 'Hit'
					};
				}
				cacheStatus = 'Miss';
			} catch (e) {
				cacheStatus = 'Error';
			}
		}

		const start = Date.now();

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), timeoutMs);

			const response = await fetch(url, {
				signal: controller.signal,
				headers: {
					'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)',
					Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
				},
			});

			clearTimeout(timeout);
			const end = Date.now();
			const duration = end - start;

			if (response.ok) {
				const text = await response.text();
				const isAtom = text.includes('<entry>');
				const itemCount = (text.match(isAtom ? /<entry>/g : /<item>/g) || []).length;
				return { instance, url, status: 'Success', durationMs: duration, items: itemCount, cacheStatus };
			} else {
				return { instance, url, status: `HTTP ${response.status}`, durationMs: duration, items: 0, cacheStatus };
			}
		} catch (error: any) {
			const end = Date.now();
			const duration = end - start;
			return {
				instance,
				url,
				status: `Error: ${error.name === 'AbortError' ? 'Timeout' : error.message}`,
				durationMs: duration,
				items: 0,
				cacheStatus
			};
		}
	}

	const promises = instancesToTest.map(instance => testInstance(instance));
	const results = await Promise.all(promises);

	results.sort((a, b) => {
		if (a.status === 'Success' && b.status !== 'Success') return -1;
		if (a.status !== 'Success' && b.status === 'Success') return 1;
		return a.durationMs - b.durationMs;
	});

	return { results, engine };
}

export async function handleTestBridges(c: Context<HonoEnv>): Promise<Response> {
	const username = c.req.param('u') || c.req.query('u') || 'baharadawna';
	const path = c.req.path;

	let defaultPlatform = 'instagram';
	let defaultInstances = 'rssbridge';

	if (path.includes('rsshub')) {
		defaultPlatform = 'instagram_story';
		defaultInstances = 'rsshub';
	} else if (path.includes('tiktok')) {
		defaultPlatform = 'tiktok';
	}

	const platform = c.req.query('platform') || defaultPlatform; // 'instagram', 'tiktok', or 'instagram_story'
	const instancesType = c.req.query('instances') || defaultInstances; // 'all', 'rssbridge', 'rsshub'
	const shouldRun = c.req.query('run') === 'true';
	const useCache = c.req.query('cache') === 'true';

	let results: BridgeBenchmarkResult[] = [];
	let engine = '';

	if (shouldRun) {
		const benchmark = await runBridgeBenchmark(c.env, {
			username,
			platform,
			instancesType,
			useCache
		});
		results = benchmark.results;
		engine = benchmark.engine;
	} else {
		const bridgeList = platform === 'tiktok' ? RSS_BRIDGE_TIKTOK_INSTANCES : FULL_RSS_BRIDGE_INSTANCES;
		if (instancesType === 'rsshub') {
			engine = 'RSSHub';
		} else if (instancesType === 'rssbridge') {
			engine = 'RSS-Bridge';
		} else {
			engine = 'RSS-Bridge vs RSSHub';
		}
	}

	const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bridge Benchmark Tool</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; background: #f9f9f9; color: #333; }
            table { border-collapse: collapse; width: 100%; max-width: 1300px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 20px; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f1f1f1; font-weight: bold; }
            tr:hover { background-color: #f5f5f5; }
            .success { color: green; font-weight: bold; }
            .error { color: red; }
            .fast { color: #008000; font-weight: bold; }
            .slow { color: #d35400; }
            .controls { margin-bottom: 20px; padding: 15px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 1300px; display: flex; flex-wrap: wrap; gap: 15px; align-items: center; }
            button { padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; height: 32px; }
            button:hover { background: #0056b3; }
            select, input { padding: 6px; border: 1px solid #ccc; border-radius: 4px; height: 32px; box-sizing: border-box; }
            .input-group { display: flex; flex-direction: column; gap: 5px; }
            .input-group label { font-size: 12px; font-weight: bold; color: #555; }
            .input-group-row { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: bold; color: #555; }
            .feed-url { font-size: 11px; word-break: break-all; max-width: 300px; }
            .feed-url a { color: #0066cc; text-decoration: none; }
            .feed-url a:hover { text-decoration: underline; }
            .empty-state { padding: 40px; text-align: center; color: #666; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 1300px; border-radius: 4px; }
            .cache-hit { color: #2980b9; font-weight: bold; }
            .cache-miss { color: #7f8c8d; }
        </style>
    </head>
    <body>
        <h2>Bridge Speed Test (From Cloudflare Edge)</h2>
        <p>Testing latency to <strong>${engine}</strong> instances for <strong>${platform.toUpperCase().replace('_', ' ')}</strong> user: <strong>@${username}</strong></p>
        
        <form action="" method="get" class="controls" id="benchmarkForm">
            <input type="hidden" name="run" value="true">
            <div class="input-group">
                <label for="u">Username:</label>
                <input type="text" id="u" name="u" value="${username}">
            </div>

            <div class="input-group">
                <label for="instances">Instances:</label>
                <select id="instances" name="instances" onchange="updateFormState()">
                    <option value="all" ${instancesType === 'all' ? 'selected' : ''}>Both (Compare RSSHub & RSS-Bridge)</option>
                    <option value="rssbridge" ${instancesType === 'rssbridge' ? 'selected' : ''}>Only RSS-Bridge</option>
                    <option value="rsshub" ${instancesType === 'rsshub' ? 'selected' : ''}>Only RSSHub</option>
                </select>
            </div>
            
            <div class="input-group">
                <label for="platform">Platform:</label>
                <select id="platform" name="platform">
                    <option value="instagram" ${platform === 'instagram' ? 'selected' : ''}>Instagram Posts</option>
                    <option id="opt-story" value="instagram_story" ${platform === 'instagram_story' ? 'selected' : ''} ${instancesType !== 'rsshub' ? 'disabled' : ''}>Instagram Stories</option>
                    <option value="tiktok" ${platform === 'tiktok' ? 'selected' : ''}>TikTok</option>
                </select>
            </div>

            <div class="input-group">
                <label>Options:</label>
                <div class="input-group-row">
                    <input type="checkbox" id="cache" name="cache" value="true" ${useCache ? 'checked' : ''}>
                    <label for="cache" style="font-weight: normal;">Use Edge Cache</label>
                </div>
            </div>
            
            <div class="input-group" style="justify-content: flex-end;">
                <button type="submit">Run Benchmark</button>
            </div>
        </form>
        
        <script>
            function updateFormState() {
                const instances = document.getElementById('instances').value;
                const platform = document.getElementById('platform');
                const optStory = document.getElementById('opt-story');
                
                if (instances === 'rssbridge' || instances === 'all') {
                    optStory.disabled = true;
                    if (platform.value === 'instagram_story') {
                        platform.value = 'instagram'; // Fallback to posts
                    }
                } else {
                    optStory.disabled = false;
                }
            }
            document.addEventListener('DOMContentLoaded', updateFormState);
        </script>
        
        ${shouldRun ? `
        <table>
            <thead>
                <tr>
                    <th>Instance</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>Items Found</th>
                    <th>Cache Status</th>
                    <th>Feed URL</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => `
                <tr>
                    <td><code>${r.instance}</code></td>
                    <td class="${r.status === 'Success' ? 'success' : 'error'}">${r.status}</td>
                    <td class="${r.durationMs < 3000 ? 'fast' : 'slow'}">${r.durationMs} ms</td>
                    <td>${r.items}</td>
                    <td class="${r.cacheStatus === 'Hit' ? 'cache-hit' : 'cache-miss'}">${r.cacheStatus}</td>
                    <td class="feed-url"><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.url}</a></td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        ` : `
        <div class="empty-state">
            <p>Click "Run Benchmark" to start testing latency across instances.</p>
            <p><small>Checking "Use Edge Cache" will show you results already stored in your Cloudflare KV (0ms latency).</small></p>
        </div>
        `}
        
        <p style="margin-top:20px; font-size:12px; color:#666;">Note: This test runs directly from the Cloudflare Worker server location.</p>
    </body>
    </html>
    `;

	return c.html(html);
}
