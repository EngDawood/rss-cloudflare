import { Context } from 'hono';

type HonoEnv = { Bindings: Env };

const RSS_BRIDGE_INSTANCES = [
	'https://rssbridge.prenghy.org',
	'https://rss-bridge.sans-nuage.fr',
	'https://rss.bloat.cat',
];

const RSS_BRIDGE_TIKTOK_INSTANCES = [
	'https://rss-bridge.org/bridge01',
	...RSS_BRIDGE_INSTANCES
];

const timeoutMs = 15000; // 15 seconds

export async function handleTestRSSBridge(c: Context<HonoEnv>): Promise<Response> {
    const username = c.req.query('u') || 'claudeai';
    const type = c.req.query('type') || 'instagram'; // 'instagram' or 'tiktok'

    const instancesToTest = type === 'tiktok' ? RSS_BRIDGE_TIKTOK_INSTANCES : RSS_BRIDGE_INSTANCES;

    async function testInstance(instance: string) {
        let url = '';
        if (type === 'tiktok') {
            url = `${instance}/?action=display&bridge=TikTokBridge&context=By+user&username=${encodeURIComponent(username)}&format=Atom`;
        } else {
            url = `${instance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${encodeURIComponent(username)}&media_type=all`;
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
                // Check if it's atom
                const itemCount = (text.match(/<entry>/g) || []).length;
                return { instance, status: 'Success', durationMs: duration, items: itemCount };
            } else {
                return { instance, status: `HTTP ${response.status}`, durationMs: duration, items: 0 };
            }
        } catch (error: any) {
            const end = Date.now();
            const duration = end - start;
            return { instance, status: `Error: ${error.name === 'AbortError' ? 'Timeout' : error.message}`, durationMs: duration, items: 0 };
        }
    }

    const promises = instancesToTest.map(instance => testInstance(instance));
    const results = await Promise.all(promises);
    
    // Sort by status (Success first) then by duration
    results.sort((a, b) => {
        if (a.status === 'Success' && b.status !== 'Success') return -1;
        if (a.status !== 'Success' && b.status === 'Success') return 1;
        return a.durationMs - b.durationMs;
    });

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RSS-Bridge Benchmark</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; background: #f9f9f9; color: #333; }
            table { border-collapse: collapse; width: 100%; max-width: 1000px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-top: 20px; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f1f1f1; font-weight: bold; }
            tr:hover { background-color: #f5f5f5; }
            .success { color: green; font-weight: bold; }
            .error { color: red; }
            .fast { color: #008000; font-weight: bold; }
            .slow { color: #d35400; }
            .controls { margin-bottom: 20px; padding: 15px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); max-width: 1000px; }
        </style>
    </head>
    <body>
        <h2>RSS-Bridge Speed Test (From Cloudflare Edge)</h2>
        <p>Testing latency to RSS-Bridge instances for <strong>${type.toUpperCase()}</strong> user: <strong>@${username}</strong></p>
        
        <div class="controls">
            <form action="" method="get">
                <label for="u">Username:</label>
                <input type="text" id="u" name="u" value="${username}">
                <label for="type">Platform:</label>
                <select id="type" name="type">
                    <option value="instagram" ${type === 'instagram' ? 'selected' : ''}>Instagram (Posts/Reels)</option>
                    <option value="tiktok" ${type === 'tiktok' ? 'selected' : ''}>TikTok</option>
                </select>
                <button type="submit">Test</button>
            </form>
        </div>
        
        <table>
            <thead>
                <tr>
                    <th>Instance</th>
                    <th>Status</th>
                    <th>Response Time</th>
                    <th>Items Found</th>
                </tr>
            </thead>
            <tbody>
                ${results.map(r => `
                <tr>
                    <td><code>${r.instance}</code></td>
                    <td class="${r.status === 'Success' ? 'success' : 'error'}">${r.status}</td>
                    <td class="${r.durationMs < 3000 ? 'fast' : 'slow'}">${r.durationMs} ms</td>
                    <td>${r.items}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
        
        <p style="margin-top:20px; font-size:12px; color:#666;">Note: This test runs directly from the Cloudflare Worker server location.</p>
    </body>
    </html>
    `;

    return c.html(html);
}
