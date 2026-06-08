import { fetchFeed } from '../workers/services/feed-fetcher';
import { enrichFeedItems } from '../workers/utils/media-enrichment';

async function runTest() {
	const telegraphToken = '73892895643335b70d94379a48b3973d690deeb20d510d69bd5ad5646dd3';
	// Let's use a feed that is known to have full HTML content
	const feedUrl = 'https://daringfireball.net/feeds/main';

	console.log(`Fetching feed: ${feedUrl}...`);
	const result = await fetchFeed(feedUrl);

	if (result.errors.length > 0) {
		console.error('Failed to fetch feed:', result.errors);
		return;
	}

	console.log(`Successfully fetched ${result.items.length} items.\n`);

	// Take the first 3 items that have some content
	const itemsToTest = result.items.filter(item => item.contentHtml).slice(0, 3);

	if (itemsToTest.length === 0) {
		console.log('No items with HTML content found to test.');
		return;
	}

	for (const item of itemsToTest) {
		console.log(`[Before] Title: ${item.title}`);
		console.log(`         Text length: ${item.text.length} chars`);
		console.log(`         HTML length: ${item.contentHtml?.length} chars`);
		console.log(`         Telegraph URL: ${item.telegraphUrl || 'None'}`);
	}

	console.log('\nRunning enrichFeedItems...');
	await enrichFeedItems(itemsToTest, telegraphToken);

	console.log('\n=== RESULTS ===');
	for (const item of itemsToTest) {
		console.log(`[After]  Title: ${item.title}`);
		if (item.telegraphUrl) {
			console.log(`         ✅ Telegraph URL generated: ${item.telegraphUrl}`);
		} else {
			console.log(`         ❌ No Telegraph URL generated.`);
			if (item.text.length <= 500) {
				console.log(`            (Text length ${item.text.length} <= 500 threshold)`);
			}
		}
	}
}

runTest().catch(console.error);
