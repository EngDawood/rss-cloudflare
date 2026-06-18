import { FULL_RSS_BRIDGE_INSTANCES } from '../workers/routes/test-bridges';

const HARDCODED_FEEDS = [
  { "source_type": "rss_url", "source_value": "https://rss.owo.nz/anthropic/news" },
  { "source_type": "rss_url", "source_value": "https://rsshub.rssforever.com/claude/blog" },
  { "source_type": "rss_url", "source_value": "https://rsshub.rssforever.com/claude/code/changelog" },
  { "source_type": "rss_url", "source_value": "https://rss.owo.nz/anthropic/engineering" },
  { "source_type": "rss_url", "source_value": "https://rss.owo.nz/openai/research" },
  { "source_type": "rss_url", "source_value": "https://rss.owo.nz/openai/news" },
  { "source_type": "rss_url", "source_value": "https://thegradient.pub/rss/" },
  { "source_type": "rss_url", "source_value": "https://deepmind.google/blog/rss.xml" },
  { "source_type": "rss_url", "source_value": "https://rssbridge.prenghy.org/?action=display&bridge=CssSelectorFeedExpanderBridge&feed=https%3A%2F%2Frssbridge.prenghy.org%2F%3Faction%3Ddisplay%26bridge%3DFilterBridge%26url%3Dhttps%253A%252F%252Fwww.aljazeera.net%252Faljazeerarss%252Fa7c186be-1baa-4bd4-9d80-a84db769f779%252F73d0e1b4-532f-45ef-b135-bfdff8b8cab9%26name%3Daljazeera-tech%26filter%3Daljazeera%255C.net%252Ftech%26filter_type%3Dpermit%26target_uri%3Don%26length_limit%3D-1%26format%3DAtom&content_selector=%23main-content-area&content_cleanup=div.rich-share%2C+div.breadcrumbs%2C+section.more-on%2C+div.article-info%2C+div.container--ads%2C+div.article-source%2C+figure.article-featured-image%2C+div.listen-to-article%2C+div.update-reading-list%2C+div.featured-media__image-wrap%2C+span.heading-anchor-button%2C+div.jetpack-video-wrapper%2C+div.aj-third-party-embed-wrapper&limit=&format=atom" },
  { "source_type": "rss_url", "source_value": "https://rsshub.umzzz.com/anthropic/research" },
  { "source_type": "instagram_user", "source_value": "edraakorg" },
  { "source_type": "instagram_user", "source_value": "dawo5d" },
  { "source_type": "tiktok_user", "source_value": "daw5d" },
  { "source_type": "tiktok_user", "source_value": "sabrina_ramonov" },
  { "source_type": "rss_url", "source_value": "https://rss-bridge.org/bridge01/?action=display&bridge=CssSelectorBridge&home_page=https%3A%2F%2Fwww.rwaq.org%2Fcourses%3Fcategory_ids%3D%26type%3Dcurrent&url_selector=p.font-weight-bold&url_pattern=%2Fcourses%2F&content_selector=div.media-body&content_cleanup=div.ads%2C+div.comments&title_cleanup=&limit=20&format=atom" },
  { "source_type": "instagram_story", "source_value": "claudeai" },
  { "source_type": "rss_url", "source_value": "https://rsshub.isrss.com/anthropic/news?tgiv=bd3c42818a7f7e" },
  { "source_type": "tiktok_user", "source_value": "walidfitaihi6" },
  { "source_type": "instagram_user", "source_value": "rwaq_" },
  { "source_type": "instagram_user", "source_value": "claudeai" },
  { "source_type": "rss_url", "source_value": "https://rsshub.cups.moe/thegradient/posts" }
];

async function main() {
	console.log('Extracting RSS-Bridge routes from hardcoded feeds list...');
	const bridgeRoutes = new Set<string>();

	for (const feed of HARDCODED_FEEDS) {
		const type = feed.source_type;
		const value = feed.source_value;

		if (type === 'instagram') {
			bridgeRoutes.add(`/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${encodeURIComponent(value)}&media_type=all`);
		} else if (type === 'tiktok') {
			bridgeRoutes.add(`/?action=display&bridge=TikTokBridge&context=By+user&username=${encodeURIComponent(value)}&format=Atom`);
		} else if (type === 'rss_url') {
			try {
				const url = new URL(value);
				if (url.searchParams.has('action') && url.searchParams.has('bridge')) {
					bridgeRoutes.add('/' + url.search);
				}
			} catch (e) {
				// Ignore invalid URLs
			}
		}
	}

	// Add the requested extra routes
	bridgeRoutes.add('/?action=display&bridge=XPathBridge&url=https://thmanyah.com/@socrates&item=//article&title=.//h3&content=.//div%5Bcontains(@class,+%22PostCard_description%22)%5D&uri=.//a%5B@class%3D%22ArticleLink+ArticleLink%22%5D/@href&author=&timestamp=.//time%5B@class%3D%22ArticleListItem-footerTimestamp%22%5D/@timestamp&enclosures=.//div%5B@class%3D%22ArticleListItem-image%22%5D/@style&categories=.//div%5B@class%3D%22ArticleListItem-label%22%5D&format=Atom');
	bridgeRoutes.add('/?action=display&bridge=XPathBridge&url=https://thmanyah.com/@aha&item=//article&title=.//h3&uri=.//a/@href&content=.//h3/following-sibling::div%5B1%5D&author=.//div%5Bcontains(@class,%27PostCard_authors%27)%5D//a&timestamp=.//time/parent::div&format=Atom');

	const routes = Array.from(bridgeRoutes);
	console.log(`Extracted ${routes.length} unique RSS-Bridge routes to test.`);

	if (routes.length === 0) {
		console.log('No routes found to test.');
		return;
	}

	console.log(`\nTesting against ${FULL_RSS_BRIDGE_INSTANCES.length} instances...`);

	for (const route of routes) {
		console.log(`\n======================================================`);
		console.log(`Testing Route: ${route}`);
		console.log(`======================================================`);

		for (const instance of FULL_RSS_BRIDGE_INSTANCES) {
			const url = `${instance.replace(/\/$/, '')}${route}`;
			process.stdout.write(`- ${instance} ... `);
			
			const start = Date.now();
			try {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), 15000);

				const response = await fetch(url, {
					signal: controller.signal,
					headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSSBot/1.0)' }
				});

				clearTimeout(timeout);
				const duration = Date.now() - start;

				if (!response.ok) {
					console.log(`❌ HTTP ${response.status} (${duration}ms)`);
					continue;
				}

				const contentType = response.headers.get('content-type') || '';
				if (!contentType.includes('xml')) {
					console.log(`❌ Invalid Content-Type: ${contentType} (${duration}ms)`);
					continue;
				}

				const text = await response.text();

				if (text.includes('RSS-Bridge Error') || text.includes('rss-bridge-error')) {
					console.log(`❌ RSS-Bridge Error in XML (${duration}ms)`);
					continue;
				}

				const isAtom = text.includes('<entry>');
				const isRss = text.includes('<item>');
				
				if (!isAtom && !isRss) {
					console.log(`❌ No <entry> or <item> found (Empty or Invalid XML) (${duration}ms)`);
					continue;
				}

				const itemCount = (text.match(isAtom ? /<entry>/g : /<item>/g) || []).length;
				if (itemCount === 0) {
					console.log(`⚠️  0 Items Found (${duration}ms)`);
				} else {
					console.log(`✅ Success: ${itemCount} items (${duration}ms)`);
				}

			} catch (error: any) {
				const duration = Date.now() - start;
				if (error.name === 'AbortError') {
					console.log(`⏳ Timeout (${duration}ms)`);
				} else {
					console.log(`❌ Error: ${error.message} (${duration}ms)`);
				}
			}
		}
	}
}

main().catch(console.error);
