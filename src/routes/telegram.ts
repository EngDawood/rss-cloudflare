import type { Context } from 'hono';
import { createBot } from '../services/telegram-bot';

type HonoEnv = { Bindings: Env };

export async function handleTelegramWebhook(c: Context<HonoEnv>): Promise<Response> {
	// Verify webhook secret (TELEGRAM_WEBHOOK_SECRET set via wrangler secret put)
	const secret = c.req.header('X-Telegram-Bot-Api-Secret-Token');
	const expectedSecret = (c.env as unknown as Record<string, string>)['TELEGRAM_WEBHOOK_SECRET'];
	if (expectedSecret && secret !== expectedSecret) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	let update: unknown;
	try {
		update = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON' }, 400);
	}

	console.log('[Webhook] Received update:', JSON.stringify(update).substring(0, 200));

	// Process the update in the background so we return 200 OK to Telegram immediately.
	// Without this, long-running handlers (e.g. YouTube quality fetch) cause Telegram
	// to retry the same update indefinitely when the Worker times out.
	c.executionCtx.waitUntil(
		(async () => {
			try {
				const bot = createBot(c.env);
				await bot.init();
				await bot.handleUpdate(update as any);
				console.log('[Webhook] Update processed');
			} catch (error) {
				console.error('[Webhook] Error processing update:', error);
			}
		})()
	);

	return c.json({ ok: true });
}
