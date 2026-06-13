import { RSS_BRIDGE_INSTANCES, RSS_BRIDGE_TIKTOK_INSTANCES, RSSHUB_INSTANCES } from '../services/source-fetcher';

const BENCHMARK_TIMEOUT_MS = 12000; // 12 seconds timeout per instance (feed fetch is slower than ping)
const BENCHMARK_INTERVAL_MS = 60 * 60 * 1000; // Run once per hour

// Probe paths that return actual feed items to verify content delivery, not just reachability
const RSS_BRIDGE_PROBE = '/?action=display&bridge=HackerNewsBridge&format=Atom';
const RSSHUB_PROBE = '/hackernews/best';

interface BenchmarkResult {
	instance: string;
	success: boolean;
	durationMs: number;
	itemCount: number; // Number of feed items returned; 0 means reachable but no content
}

/**
 * Checks if a benchmark is needed, and if so, runs it in the background.
 */
export async function maybeRunInstanceBenchmark(env: Env): Promise<void> {
	if (!env.CACHE) {
		console.warn('[Benchmark] KV CACHE binding is not available. Skipping benchmark.');
		return;
	}

	try {
		const lastBenchmarkStr = await env.CACHE.get('instances:last_benchmark');
		const lastBenchmark = lastBenchmarkStr ? parseInt(lastBenchmarkStr, 10) : 0;
		const now = Date.now();

		if (now - lastBenchmark >= BENCHMARK_INTERVAL_MS) {
			console.log('[Benchmark] Triggering background instance benchmark...');
			// Set the last benchmark timestamp immediately to prevent concurrent duplicate runs
			await env.CACHE.put('instances:last_benchmark', now.toString());
			await runInstanceBenchmark(env);
		}
	} catch (err) {
		console.error('[Benchmark] Error checking benchmark interval:', err);
	}
}

/**
 * Counts RSS/Atom feed items in a response body.
 */
function countFeedItems(xml: string): number {
	return (xml.match(/<(item|entry)[\s>]/g) ?? []).length;
}

/**
 * Benchmark a single instance by fetching a real probe feed path.
 * Scores by items returned, not just HTTP reachability.
 */
async function benchmarkInstance(instance: string, probePath: string): Promise<BenchmarkResult> {
	const url = `${instance}${probePath}`;
	const start = Date.now();
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), BENCHMARK_TIMEOUT_MS);

		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; RSSBot-HealthCheck/1.0)',
				Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
			},
		});

		clearTimeout(timeout);
		const durationMs = Date.now() - start;

		if (!response.ok) {
			return { instance, success: false, durationMs, itemCount: 0 };
		}

		const xml = await response.text();
		const itemCount = countFeedItems(xml);

		return { instance, success: true, durationMs, itemCount };
	} catch {
		return { instance, success: false, durationMs: Date.now() - start, itemCount: 0 };
	}
}

/**
 * Runs a benchmark for all RSS-Bridge and RSSHub instances, sorting them by speed and caching in KV.
 */
export async function runInstanceBenchmark(env: Env): Promise<void> {
	if (!env.CACHE) return;

	try {
		console.log('[Benchmark] Benchmarking all instances...');

		// 1. Benchmark RSS-Bridge instances using a real feed probe
		const bridgePromises = RSS_BRIDGE_INSTANCES.map(inst => benchmarkInstance(inst, RSS_BRIDGE_PROBE));
		const bridgeResults = await Promise.all(bridgePromises);

		const sortedBridge = sortBenchmarkResults(bridgeResults);
		console.log(`[Benchmark] Sorted RSS-Bridge instances: ${sortedBridge.slice(0, 5).join(', ')}...`);
		await env.CACHE.put('instances:sorted:rssbridge', JSON.stringify(sortedBridge));

		// 2. Benchmark RSS-Bridge TikTok instances (same probe — reachability still matters)
		const tiktokPromises = RSS_BRIDGE_TIKTOK_INSTANCES.map(inst => benchmarkInstance(inst, RSS_BRIDGE_PROBE));
		const tiktokResults = await Promise.all(tiktokPromises);
		const sortedTiktok = sortBenchmarkResults(tiktokResults);
		await env.CACHE.put('instances:sorted:tiktok', JSON.stringify(sortedTiktok));

		// 3. Benchmark RSSHub instances using a real feed probe
		const rsshubPromises = RSSHUB_INSTANCES.map(inst => benchmarkInstance(inst, RSSHUB_PROBE));
		const rsshubResults = await Promise.all(rsshubPromises);
		const sortedRsshub = sortBenchmarkResults(rsshubResults);
		console.log(`[Benchmark] Sorted RSSHub instances: ${sortedRsshub.slice(0, 5).join(', ')}...`);
		await env.CACHE.put('instances:sorted:rsshub', JSON.stringify(sortedRsshub));

		console.log('[Benchmark] Instance speed test benchmark completed and saved to KV.');
	} catch (err) {
		console.error('[Benchmark] Error running instance benchmark:', err);
	}
}

/**
 * Sorts benchmark results by content quality first, then speed.
 * Priority: instances with items > instances reachable but empty > failed instances.
 * Within each tier, faster is better.
 */
function sortBenchmarkResults(results: BenchmarkResult[]): string[] {
	return [...results]
		.sort((a, b) => {
			const aHasItems = a.itemCount > 0;
			const bHasItems = b.itemCount > 0;
			if (aHasItems !== bHasItems) return aHasItems ? -1 : 1;
			if (a.success !== b.success) return a.success ? -1 : 1;
			return a.durationMs - b.durationMs;
		})
		.map(r => r.instance);
}
