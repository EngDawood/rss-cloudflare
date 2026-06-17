import { Hono } from 'hono';
import { handleInstagramFeed } from './routes/instagram';
import { handleTelegramWebhook } from './routes/telegram';
import { handleSetup } from './routes/setup';
import { handleTestBridges } from './routes/test-bridges';
import { checkAllFeeds } from './cron/check-feeds';
import { refreshSavedFeeds } from './cron/refresh-feeds';
import { cleanupOldData } from './cron/cleanup';
import { handleQueue } from './queue-handler';
import { RSSReaderMCP } from './mcp/index';
import { QueueTask } from './types/queue';
import { handleActionApi, handleChatApi, handleMigrateChannels } from './routes/action-api';
import { checkCronWorkflows } from './workflows/trigger';
import { AgentWorkflow } from './workflows/agent-workflow';
import { mcpAuthRejected } from './utils/auth';

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/instagram', handleInstagramFeed);
app.get('/test-bridges', handleTestBridges);
app.get('/test-bridges/:u', handleTestBridges);
app.get('/test-rssbridge', handleTestBridges);
app.get('/test-rssbridge/:u', handleTestBridges);
app.get('/test-rsshub', handleTestBridges);
app.get('/test-rsshub/:u', handleTestBridges);

app.post('/telegram/webhook', handleTelegramWebhook);
app.get('/telegram/setup', handleSetup);

// Administrative Action and Chat Agent APIs
app.post('/api/action', handleActionApi);
app.post('/api/chat', handleChatApi);
app.post('/api/migrate-channels', handleMigrateChannels);

// MCP server
app.on(['GET', 'POST', 'DELETE'], ['/mcp', '/mcp/*'], async (c) => {
	// Auth gate — enforced only when MCP_AUTH_TOKEN is configured (header or ?token=).
	if (mcpAuthRejected(c)) return c.json({ error: 'Unauthorized' }, 401);
	return RSSReaderMCP.serve('/mcp', { binding: 'RSSReaderMCP' }).fetch(c.req.raw, c.env, c.executionCtx as any);
});

app.notFound(async (c) => {
	if (c.env.ASSETS) {
		try {
			// 1. Try exact path first
			const res = await c.env.ASSETS.fetch(c.req.raw);
			if (res.status !== 404) return res;

			// 2. SPA fallback — serve index.html for browser navigation paths
			const path = new URL(c.req.url).pathname;
			const isApiPath = path.startsWith('/api') || path.startsWith('/instagram') ||
				path.startsWith('/telegram') || path.startsWith('/mcp') ||
				path.startsWith('/health') || path.startsWith('/test-bridge');
			if (!isApiPath) {
				const spaUrl = new URL(c.req.url);
				spaUrl.pathname = '/';
				const spaRes = await c.env.ASSETS.fetch(new Request(spaUrl.toString(), c.req.raw));
				if (spaRes.status !== 404) return spaRes;
			}
		} catch (e) {
			console.error('Error serving from ASSETS:', e);
		}
	}

	// 3. Fallback to API 404 JSON response
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
export { AgentWorkflow };

export default {
	fetch: app.fetch,
	scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
		// Daily 03:00 UTC trigger runs the cleanup sweep only.
		if (event.cron === '0 3 * * *') {
			ctx.waitUntil(cleanupOldData(env));
			return;
		}
		ctx.waitUntil(checkAllFeeds(env));
		ctx.waitUntil(refreshSavedFeeds(env));
		ctx.waitUntil(checkCronWorkflows(env));
	},
	queue: async (batch: MessageBatch<QueueTask>, env: Env): Promise<void> => {
		await handleQueue(batch, env);
	},
};
