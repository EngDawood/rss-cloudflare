import { Context } from 'hono';

type HonoEnv = { Bindings: Env };

const RSSHUB_INSTANCES = [
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

const timeoutMs = 15000; // 15 seconds

export async function handleTestRSSHub(c: Context<HonoEnv>): Promise<Response> {
    const username = c.req.query('u') || 'claudeai';

    async function testInstance(instance: string) {
        const url = `${instance}/picnob.info/user/${encodeURIComponent(username)}/stories`;
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
                const itemCount = (text.match(/<item>/g) || []).length;
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

    const promises = RSSHUB_INSTANCES.map(instance => testInstance(instance));
    const results = await Promise.all(promises);
    
    // Sort by status (Success first) then by duration
    results.sort((a, b) => {
        if (a.status === 'Success' && b.status !== 'Success') return -1;
        if (a.status !== 'Success' && b.status === 'Success') return 1;
        return a.durationMs - b.durationMs;
    });

    // Build HTML table response
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>RSSHub Benchmark for @${username}</title>
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
        </style>
    </head>
    <body>
        <h2>RSSHub Speed Test (From Cloudflare Edge)</h2>
        <p>Testing latency to RSSHub instances for Instagram user: <strong>@${username}</strong></p>
        <p><a href="?u=${username}">Refresh</a> | <form action="" method="get" style="display:inline"><input type="text" name="u" placeholder="Try another username" value="${username}"><button type="submit">Test</button></form></p>
        
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
