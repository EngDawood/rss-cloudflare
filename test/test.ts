import { Context } from 'hono';
import { CACHE_PREFIX_FEED } from '../workers/constants';
import { RSS_BRIDGE_INSTANCES, RSS_BRIDGE_TIKTOK_INSTANCES, RSSHUB_INSTANCES } from '../workers/services/source-fetcher';

type HonoEnv = { Bindings: any };

const timeoutMs = 15000; // 15 seconds

/**
 * Parses custom user input (route/query or full URL) into target type and cleaned path.
 */
export function parseCustomInput(input: string): { type: 'rsshub' | 'rssbridge' | 'generic'; path: string } {
	const cleaned = input.trim();
	
	// If it's a full URL
	if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
		try {
			const url = new URL(cleaned);
			const params = url.searchParams;
			
			// 1. Check if it has RSS-Bridge parameters OR is a known RSS-Bridge domain
			const isBridgeHost = RSS_BRIDGE_INSTANCES.some(inst => {
				try {
					return new URL(inst).host === url.host;
				} catch {
					return false;
				}
			});
			
			if (params.get('bridge') || params.get('action') || isBridgeHost) {
				// It's RSS-Bridge. Preserve the query
				return {
					type: 'rssbridge',
					path: `/?${params.toString()}`
				};
			}
			
			// 2. Check if it's a known RSSHub domain or has rsshub in host
			const isHubHost = url.host.includes('rsshub') || RSSHUB_INSTANCES.some(inst => {
				try {
					return new URL(inst).host === url.host;
				} catch {
					return false;
				}
			});
			
			if (isHubHost) {
				return {
					type: 'rsshub',
					path: url.pathname + (url.search || '')
				};
			}
			
			// 3. Otherwise, it's a generic external RSS URL
			return {
				type: 'generic',
				path: cleaned
			};
		} catch {
			// Fallback if URL parsing fails
		}
	}
	
	// If it starts with /? or contains bridge=
	if (cleaned.startsWith('/?') || cleaned.includes('bridge=') || cleaned.startsWith('?')) {
		let path = cleaned;
		if (path.startsWith('?')) path = '/' + path;
		return { type: 'rssbridge', path };
	}
	
	// Otherwise treat it as RSSHub path
	let path = cleaned;
	if (!path.startsWith('/')) path = '/' + path;
	return { type: 'rsshub', path };
}

export async function testInstance(
	instance: string, 
	platform = 'instagram', 
	username = 'baharadawna', 
	useCache = false, 
	cache?: any,
	customInput = ''
) {
	const isRSSHub = RSSHUB_INSTANCES.includes(instance);
	let url = '';
	let displayInstance = instance;
	let typeLabel = isRSSHub ? 'RSSHub' : 'RSS-Bridge';
	
	if (customInput) {
		const parsedInput = parseCustomInput(customInput);
		if (parsedInput.type === 'generic') {
			url = parsedInput.path;
			typeLabel = 'External';
			try {
				displayInstance = `Direct Fetch (${new URL(url).host})`;
			} catch {
				displayInstance = 'Direct Fetch';
			}
		} else {
			if (parsedInput.type === 'rsshub' && !isRSSHub) {
				return null; // Skip RSS-Bridge for RSSHub custom routes
			}
			if (parsedInput.type === 'rssbridge' && isRSSHub) {
				return null; // Skip RSSHub for RSS-Bridge custom queries
			}
			url = `${instance}${parsedInput.path}`;
		}
	} else if (platform === 'rss_url') {
		let targetUrl = username.trim();
		if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
			targetUrl = 'https://' + targetUrl;
		}
		url = targetUrl;
		typeLabel = 'External';
		try {
			displayInstance = `Direct Fetch (${new URL(url).host})`;
		} catch {
			displayInstance = 'Direct Fetch';
		}
	} else {
		if (platform === 'tiktok') {
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
	}

	let cacheStatus = 'Bypassed';
	if (useCache && cache) {
		try {
			const cached = await cache.get(`${CACHE_PREFIX_FEED}${url}`);
			if (cached) {
				return { instance: displayInstance, type: typeLabel, url, status: 'Success', durationMs: 0, items: (cached.match(/<entry>|<item>/g) || []).length, cacheStatus: 'Hit' };
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
			return { instance: displayInstance, type: typeLabel, url, status: 'Success', durationMs: duration, items: itemCount, cacheStatus };
		} else {
			return { instance: displayInstance, type: typeLabel, url, status: `HTTP ${response.status}`, durationMs: duration, items: 0, cacheStatus };
		}
	} catch (error: any) {
		const end = Date.now();
		const duration = end - start;
		return { instance: displayInstance, type: typeLabel, url, status: `Error: ${error.name === 'AbortError' ? 'Timeout' : error.message}`, durationMs: duration, items: 0, cacheStatus };
	}
}

export async function handleTest(c: Context<HonoEnv>): Promise<Response> {
	let rawUsername = c.req.param('u') || c.req.query('u') || '';
	let customInput = c.req.query('customInput') || '';

	// Shift parameter if it's a URL or custom route
	if (
		rawUsername.startsWith('http://') ||
		rawUsername.startsWith('https://') ||
		rawUsername.startsWith('/') ||
		rawUsername.includes('bridge=') ||
		rawUsername.includes('?')
	) {
		customInput = rawUsername;
		rawUsername = '';
	}

	const username = rawUsername || 'baharadawna';
	const path = c.req.path;
	
	let defaultPlatform = 'instagram';
	let defaultInstances = 'all'; // Default to "all" (Both) in the unified page

	if (path.includes('rsshub')) {
		defaultPlatform = 'instagram_story';
		defaultInstances = 'rsshub';
	} else if (path.includes('tiktok')) {
		defaultPlatform = 'tiktok';
	}

	const platform = c.req.query('platform') || (customInput ? 'custom' : defaultPlatform); // 'instagram', 'tiktok', 'instagram_story', 'rss_url', or 'custom'
	const instancesType = c.req.query('instances') || defaultInstances; // 'all', 'rssbridge', 'rsshub'
	const shouldRun = c.req.query('run') === 'true';
	const useCache = c.req.query('cache') === 'true';

	let instancesToTest: string[] = [];
	let engine = '';

	const bridgeList = platform === 'tiktok' ? RSS_BRIDGE_TIKTOK_INSTANCES : RSS_BRIDGE_INSTANCES;

	if (customInput) {
		const parsed = parseCustomInput(customInput);
		if (parsed.type === 'generic') {
			instancesToTest = ['Direct Fetch'];
			engine = `Generic RSS Feed`;
		} else if (parsed.type === 'rsshub') {
			instancesToTest = RSSHUB_INSTANCES;
			engine = `RSSHub Custom (${parsed.path})`;
		} else {
			instancesToTest = bridgeList;
			engine = `RSS-Bridge Custom (${parsed.path})`;
		}
	} else if (platform === 'rss_url') {
		instancesToTest = ['Direct Fetch'];
		engine = `Generic RSS Feed`;
	} else {
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

	let results: any[] = [];
	if (shouldRun) {
		const promises = instancesToTest.map(instance => testInstance(instance, platform, username, useCache, c.env.CACHE, customInput));
		const rawResults = await Promise.all(promises);
		results = rawResults.filter(r => r !== null);
		
		results.sort((a, b) => {
			if (a.status === 'Success' && b.status !== 'Success') return -1;
			if (a.status !== 'Success' && b.status === 'Success') return 1;
			return a.durationMs - b.durationMs;
		});
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
            
            /* Loading Overlay */
            .loading-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(255, 255, 255, 0.9);
                display: none;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 1000;
                backdrop-filter: blur(4px);
            }
            .loading-overlay.active {
                display: flex;
            }
            .spinner {
                width: 45px;
                height: 45px;
                border: 3px solid rgba(0, 123, 255, 0.1);
                border-top-color: #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 15px;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            .loading-overlay h3 {
                margin: 0 0 5px 0;
                color: #333;
                font-family: inherit;
            }
            .loading-overlay p {
                margin: 0;
                color: #666;
                font-size: 0.9rem;
            }
        </style>
    </head>
    <body>
        <h2>Bridge Speed Test (From Cloudflare Edge)</h2>
        <p>Testing latency to <strong>${engine}</strong> instances${customInput ? '' : ` for <strong>${platform.toUpperCase().replace('_', ' ')}</strong>: <strong>${platform === 'rss_url' ? username : '@' + username}</strong>`}</p>
        
        <form action="" method="get" class="controls" id="benchmarkForm" onsubmit="showLoading()">
            <input type="hidden" name="run" value="true">
            <div class="input-group" id="grp-platform">
                <label for="platform">Platform:</label>
                <select id="platform" name="platform" onchange="updateFormState()">
                    <option value="instagram" ${platform === 'instagram' ? 'selected' : ''}>Instagram Posts</option>
                    <option id="opt-story" value="instagram_story" ${platform === 'instagram_story' ? 'selected' : ''} ${instancesType !== 'rsshub' ? 'disabled' : ''}>Instagram Stories</option>
                    <option value="tiktok" ${platform === 'tiktok' ? 'selected' : ''}>TikTok</option>
                    <option value="rss_url" ${platform === 'rss_url' ? 'selected' : ''}>Generic RSS URL</option>
                    <option value="custom" ${platform === 'custom' ? 'selected' : ''}>Custom Route / URL</option>
                </select>
            </div>

            <div class="input-group" id="grp-username">
                <label for="u" id="lbl-username">Username:</label>
                <input type="text" id="u" name="u" value="${username}">
            </div>

            <div class="input-group" id="grp-instances">
                <label for="instances">Instances:</label>
                <select id="instances" name="instances" onchange="updateFormState()">
                    <option value="all" ${instancesType === 'all' ? 'selected' : ''}>Both (Compare RSSHub & RSS-Bridge)</option>
                    <option value="rssbridge" ${instancesType === 'rssbridge' ? 'selected' : ''}>Only RSS-Bridge</option>
                    <option value="rsshub" ${instancesType === 'rsshub' ? 'selected' : ''}>Only RSSHub</option>
                </select>
            </div>

            <div class="input-group" id="grp-custom-input" style="flex-grow: 1; min-width: 250px;">
                <label for="customInput">Custom Route / URL:</label>
                <input type="text" id="customInput" name="customInput" value="${customInput}" placeholder="e.g. /anthropic/news or full link" style="width: 100%;">
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
                const platform = document.getElementById('platform').value;
                const instances = document.getElementById('instances').value;
                const optStory = document.getElementById('opt-story');
                const lblUsername = document.getElementById('lbl-username');
                
                const grpUsername = document.getElementById('grp-username');
                const grpInstances = document.getElementById('grp-instances');
                const grpCustomInput = document.getElementById('grp-custom-input');
                const txtCustomInput = document.getElementById('customInput');

                const txtUsername = document.getElementById('u');

                if (platform === 'rss_url') {
                    if (grpUsername) grpUsername.style.display = 'flex';
                    if (txtUsername) txtUsername.disabled = false;
                    if (grpInstances) grpInstances.style.display = 'none';
                    if (grpCustomInput) grpCustomInput.style.display = 'none';
                    if (txtCustomInput) txtCustomInput.disabled = true;
                    if (lblUsername) lblUsername.textContent = 'Feed URL:';
                } else if (platform === 'custom') {
                    if (grpUsername) grpUsername.style.display = 'none';
                    if (txtUsername) txtUsername.disabled = true;
                    if (grpInstances) grpInstances.style.display = 'flex';
                    if (grpCustomInput) grpCustomInput.style.display = 'flex';
                    if (txtCustomInput) {
                        txtCustomInput.disabled = false;
                        txtCustomInput.placeholder = "e.g., /anthropic/news or full feed URL";
                    }
                } else {
                    if (grpUsername) grpUsername.style.display = 'flex';
                    if (txtUsername) txtUsername.disabled = false;
                    if (grpInstances) grpInstances.style.display = 'flex';
                    if (grpCustomInput) grpCustomInput.style.display = 'none';
                    if (txtCustomInput) txtCustomInput.disabled = true;
                    if (lblUsername) lblUsername.textContent = 'Username:';

                    if (instances === 'rssbridge' || instances === 'all') {
                        optStory.disabled = true;
                        if (document.getElementById('platform').value === 'instagram_story') {
                            document.getElementById('platform').value = 'instagram'; // Fallback to posts
                        }
                    } else {
                        optStory.disabled = false;
                    }
                }
            }
            
            function showLoading() {
                document.getElementById('loadingOverlay').classList.add('active');
            }
            
            document.addEventListener('DOMContentLoaded', updateFormState);
        </script>

        <div id="loadingOverlay" class="loading-overlay">
            <div class="spinner"></div>
            <h3>Benchmarking Instances...</h3>
            <p>Querying selected endpoints from Cloudflare Edge node...</p>
        </div>
        
        ${shouldRun ? `
        <table>
            <thead>
                <tr>
                    <th>Instance</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>Items Found</th>
                    <th>Cache Status</th>
                    <th>Feed URL</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => {
                    const isSuccess = r.status === 'Success';
                    return `
                    <tr>
                        <td><code>${r.instance}</code></td>
                        <td>${r.type}</td>
                        <td class="${isSuccess ? 'success' : 'error'}">${r.status}</td>
                        <td class="${isSuccess && r.durationMs < 3000 ? 'fast' : 'slow'}">${isSuccess ? `${r.durationMs} ms` : '—'}</td>
                        <td>${isSuccess ? r.items : '—'}</td>
                        <td class="${r.cacheStatus === 'Hit' ? 'cache-hit' : 'cache-miss'}">${r.cacheStatus}</td>
                        <td class="feed-url"><a href="${r.url}" target="_blank" rel="noopener noreferrer">${r.url}</a></td>
                    </tr>
                    `;
                }).join('')}
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

export async function runBenchmark(platform = 'instagram', username = 'baharadawna', instancesType = 'all', customInput = '') {
	if (customInput) {
		const parsed = parseCustomInput(customInput);
		console.log(`Running custom benchmark for path: ${parsed.path} (type: ${parsed.type})...\n`);
	} else {
		console.log(`Comparing instances for platform: ${platform.toUpperCase()}, username: ${username}...\n`);
	}
	
	const bridgeList = platform === 'tiktok' ? RSS_BRIDGE_TIKTOK_INSTANCES : RSS_BRIDGE_INSTANCES;
	let instancesToTest: string[] = [];
	
	if (customInput) {
		const parsed = parseCustomInput(customInput);
		if (parsed.type === 'rsshub') {
			instancesToTest = RSSHUB_INSTANCES;
		} else if (parsed.type === 'generic') {
			instancesToTest = ['Direct Fetch'];
		} else {
			instancesToTest = bridgeList;
		}
	} else if (platform === 'rss_url') {
		instancesToTest = ['Direct Fetch'];
	} else {
		if (instancesType === 'rsshub') {
			instancesToTest = RSSHUB_INSTANCES;
		} else if (instancesType === 'rssbridge') {
			instancesToTest = bridgeList;
		} else {
			instancesToTest = [...bridgeList, ...RSSHUB_INSTANCES];
		}
	}
	
	const promises = instancesToTest.map(instance => testInstance(instance, platform, username, false, undefined, customInput));
	const rawResults = await Promise.all(promises);
	const results = rawResults.filter(r => r !== null);
	
	results.sort((a, b) => {
		if (a.status === 'Success' && b.status !== 'Success') return -1;
		if (a.status !== 'Success' && b.status === 'Success') return 1;
		return a.durationMs - b.durationMs;
	});
	
	console.table(results);
	return results;
}

// CLI entry point
if (typeof process !== 'undefined' && process.argv && (process.argv[1]?.endsWith('test.ts') || process.argv[1]?.endsWith('test.js'))) {
	const firstArg = process.argv[2];
	if (!firstArg) {
		runBenchmark('instagram', 'baharadawna', 'all').catch(console.error);
	} else if (firstArg.startsWith('http://') || firstArg.startsWith('https://') || firstArg.startsWith('/') || firstArg.includes('bridge=') || firstArg.includes('?')) {
		// Single custom input argument, e.g. pnpm ts-node test/test.ts /anthropic/news or pnpm ts-node test/test.ts https://news.ycombinator.com/rss
		runBenchmark('instagram', 'baharadawna', 'all', firstArg).catch(console.error);
	} else if (firstArg === 'custom') {
		const customRoute = process.argv[3] || '/anthropic/news';
		const targetType = process.argv[4] || 'all';
		runBenchmark('instagram', 'baharadawna', targetType, customRoute).catch(console.error);
	} else {
		const platform = process.argv[2] || 'instagram';
		const user = process.argv[3] || 'baharadawna';
		const targetType = process.argv[4] || 'all';
		runBenchmark(platform, user, targetType).catch(console.error);
	}
}
