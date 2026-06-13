import { Hono } from 'hono';
import { handleInstagramFeed } from './routes/instagram';
import { handleTelegramWebhook } from './routes/telegram';
import { handleSetup } from './routes/setup';
import { handleFoloWebhook } from './routes/folo';
import { checkAllFeeds } from './cron/check-feeds';
import { refreshSavedFeeds } from './cron/refresh-feeds';
import { maybeRunInstanceBenchmark } from './cron/benchmark-instances';
import { handleQueue } from './queue-handler';
import { RSSReaderMCP } from './mcp/index';
import { QueueTask } from './types/queue';
import { MessageBatch } from '@cloudflare/workers-types';
import { handleActionApi, handleChatApi } from './routes/action-api';
import { handleTest } from '../test/test';

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/instagram', handleInstagramFeed);
app.get('/test', handleTest);
app.get('/test/:u', handleTest);
app.get('/test-bridges', handleTest);
app.get('/test-bridges/:u', handleTest);

app.post('/telegram/webhook', handleTelegramWebhook);
app.post('/folo', handleFoloWebhook);
app.get('/telegram/setup', handleSetup);

// Administrative Action and Chat Agent APIs
app.post('/api/action', handleActionApi);
app.post('/api/chat', handleChatApi);

// MCP server
app.on(['GET', 'POST', 'DELETE'], ['/mcp', '/mcp/*'], async (c) => {
	return RSSReaderMCP.serve('/mcp', { binding: 'RSSReaderMCP' }).fetch(c.req.raw, c.env, c.executionCtx as any);
});

app.notFound(async (c) => {
	// 1. Try to serve from static assets
	if (c.env.ASSETS) {
		try {
			const res = await c.env.ASSETS.fetch(c.req.raw);
			if (res.status !== 404) {
				return res;
			}
		} catch (e) {
			console.error('Error serving from ASSETS:', e);
		}
	}

	// 2. Fallback to API 404 JSON response
	return c.json(
		{
			error: 'Not found',
			usage: {
				username: '/instagram?u=username',
				hashtag: '/instagram?h=hashtag',
				location: '/instagram?l=location_id',
				params: 'media_type=all|video|picture|multiple, direct_links=true|false',
				mcp: '/mcp',
			},
		},
		404
	);
});

app.onError((err, c) => {
	console.error('Unhandled error:', err);
	return c.json({ error: 'Internal Server Error' }, 500);
});

export { RSSReaderMCP };

export default {
	fetch: app.fetch,
	scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
		ctx.waitUntil(checkAllFeeds(env));
		ctx.waitUntil(refreshSavedFeeds(env));
		ctx.waitUntil(maybeRunInstanceBenchmark(env));
	},
	queue: async (batch: MessageBatch<QueueTask>, env: Env): Promise<void> => {
		await handleQueue(batch, env);
	},
};
