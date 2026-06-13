import { RSS_BRIDGE_INSTANCES, RSS_BRIDGE_TIKTOK_INSTANCES, RSSHUB_INSTANCES } from '../services/source-fetcher';

const BENCHMARK_TIMEOUT_MS = 5000; // 5 seconds timeout per instance
const BENCHMARK_INTERVAL_MS = 60 * 60 * 1000; // Run once per hour

interface BenchmarkResult {
	instance: string;
	success: boolean;
	durationMs: number;
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
 * Benchmark a single instance by fetching its root URL.
 */
async function benchmarkInstance(instance: string): Promise<BenchmarkResult> {
	const start = Date.now();
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), BENCHMARK_TIMEOUT_MS);

		// Use a lightweight HEAD or GET request to the root path of the instance
		const response = await fetch(instance, {
			method: 'GET',
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; RSSBot-HealthCheck/1.0)',
			},
		});

		clearTimeout(timeout);
		const durationMs = Date.now() - start;

		// We consider a status < 500 as reachable (even 4xx is a response from the server)
		return {
			instance,
			success: response.status < 500,
			durationMs,
		};
	} catch (err) {
		return {
			instance,
			success: false,
			durationMs: Date.now() - start,
		};
	}
}

/**
 * Runs a benchmark for all RSS-Bridge and RSSHub instances, sorting them by speed and caching in KV.
 */
export async function runInstanceBenchmark(env: Env): Promise<void> {
	if (!env.CACHE) return;

	try {
		console.log('[Benchmark] Benchmarking all instances...');

		// 1. Benchmark RSS-Bridge instances (full list)
		const bridgePromises = RSS_BRIDGE_INSTANCES.map(inst => benchmarkInstance(inst));
		const bridgeResults = await Promise.all(bridgePromises);

		// Sort: successful first, then sorted by duration ascending
		const sortedBridge = sortBenchmarkResults(bridgeResults);
		console.log(`[Benchmark] Sorted RSS-Bridge instances: ${sortedBridge.slice(0, 5).join(', ')}...`);
		await env.CACHE.put('instances:sorted:rssbridge', JSON.stringify(sortedBridge));

		// 2. Benchmark RSS-Bridge TikTok instances (specifically verified ones)
		const tiktokPromises = RSS_BRIDGE_TIKTOK_INSTANCES.map(inst => benchmarkInstance(inst));
		const tiktokResults = await Promise.all(tiktokPromises);
		const sortedTiktok = sortBenchmarkResults(tiktokResults);
		// Ensure that we preserve any custom prioritizing order or just standard speed sorting
		await env.CACHE.put('instances:sorted:tiktok', JSON.stringify(sortedTiktok));

		// 3. Benchmark RSSHub instances
		const rsshubPromises = RSSHUB_INSTANCES.map(inst => benchmarkInstance(inst));
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
 * Sorts benchmark results so successful instances are first (fastest first),
 * followed by failed instances.
 */
function sortBenchmarkResults(results: BenchmarkResult[]): string[] {
	return [...results]
		.sort((a, b) => {
			if (a.success && !b.success) return -1;
			if (!a.success && b.success) return 1;
			return a.durationMs - b.durationMs;
		})
		.map(r => r.instance);
}
