import { performance } from 'perf_hooks';

// RSS-Bridge Public Instances
const RSS_BRIDGE_INSTANCES = [
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

// RSSHub Public Instances
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

const username = process.argv[2] || 'claudeai';
const timeoutMs = 15000; // 15 seconds

async function testInstance(instance, type) {
	const isRSSHub = type === 'rsshub';
	const url = isRSSHub
		? `${instance}/picnob.info/user/${encodeURIComponent(username)}/posts?limit=10`
		: `${instance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${encodeURIComponent(username)}&media_type=all`;

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

			// Detect RSS-Bridge/scrapers error feeds which are valid XML but contain error details
			if (
				text.includes('HttpException') ||
				text.includes('cURL error') ||
				text.includes('Bridge returned error') ||
				text.includes('returnServerError') ||
				text.includes('instagram.com/favicon.ico')
			) {
				return {
					Type: isRSSHub ? 'RSSHub' : 'RSS-Bridge',
					Instance: instance,
					Status: 'Bridge Error',
					Duration: `${duration}ms`,
					Items: 0
				};
			}

			// Check if it looks like an RSS/Atom feed with entries/items
			const itemCount = (text.match(/<entry>|<item>/g) || []).length;
			return {
				Type: isRSSHub ? 'RSSHub' : 'RSS-Bridge',
				Instance: instance,
				Status: itemCount > 0 ? 'Success' : 'Empty Feed',
				Duration: `${duration}ms`,
				Items: itemCount
			};
		} else {
			return {
				Type: isRSSHub ? 'RSSHub' : 'RSS-Bridge',
				Instance: instance,
				Status: `HTTP ${response.status}`,
				Duration: `${duration}ms`,
				Items: 0
			};
		}
	} catch (error) {
		const end = performance.now();
		const duration = (end - start).toFixed(2);
		const statusText = error.name === 'AbortError' ? 'Timeout' : error.message;
		return {
			Type: isRSSHub ? 'RSSHub' : 'RSS-Bridge',
			Instance: instance,
			Status: `Error: ${statusText}`,
			Duration: `${duration}ms`,
			Items: 0
		};
	}
}

async function runTests() {
	console.log(`Testing Instagram instances for user: ${username}\n`);

	const bridgePromises = RSS_BRIDGE_INSTANCES.map(instance => testInstance(instance, 'rssbridge'));
	const rsshubPromises = RSSHUB_INSTANCES.map(instance => testInstance(instance, 'rsshub'));

	console.log(`Running concurrent requests to ${RSS_BRIDGE_INSTANCES.length} RSS-Bridge and ${RSSHUB_INSTANCES.length} RSSHub instances...\n`);

	const results = await Promise.all([...bridgePromises, ...rsshubPromises]);

	// Sort by status (Success first) then by duration
	results.sort((a, b) => {
		if (a.Status === 'Success' && b.Status !== 'Success') return -1;
		if (a.Status !== 'Success' && b.Status === 'Success') return 1;
		return parseFloat(a.Duration) - parseFloat(b.Duration);
	});

	console.table(results);
}

runTests();
