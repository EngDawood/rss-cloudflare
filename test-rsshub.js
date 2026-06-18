import { performance } from 'perf_hooks';

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

const username = 'claudeai';
const timeoutMs = 15000; // 15 seconds

async function testInstance(instance) {
    const url = `${instance}/picnob.info/user/${encodeURIComponent(username)}/stories`;
    const start = performance.now();
    
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
        const end = performance.now();
        const duration = (end - start).toFixed(2);
        
        if (response.ok) {
            const text = await response.text();
            // Basic check if it looks like an RSS feed with items
            const itemCount = (text.match(/<item>/g) || []).length;
            return { instance, status: 'Success', duration: `${duration}ms`, items: itemCount };
        } else {
            return { instance, status: `HTTP ${response.status}`, duration: `${duration}ms`, items: 0 };
        }
    } catch (error) {
        const end = performance.now();
        const duration = (end - start).toFixed(2);
        return { instance, status: `Error: ${error.name === 'AbortError' ? 'Timeout' : error.message}`, duration: `${duration}ms`, items: 0 };
    }
}

async function runTests() {
    console.log(`Testing RSSHub instances for user: ${username}\n`);
    
    const promises = RSSHUB_INSTANCES.map(instance => testInstance(instance));
    const results = await Promise.all(promises);
    
    // Sort by status (Success first) then by duration
    results.sort((a, b) => {
        if (a.status === 'Success' && b.status !== 'Success') return -1;
        if (a.status !== 'Success' && b.status === 'Success') return 1;
        return parseFloat(a.duration) - parseFloat(b.duration);
    });
    
    console.table(results);
}

runTests();
