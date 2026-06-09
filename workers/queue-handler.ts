import type { MessageBatch } from '@cloudflare/workers-types';
import type { QueueTask, FetchTask, SendTask } from './types/queue';
import { Bot, GrammyError } from 'grammy';
import { getChannelConfig, sendMediaToChannel, addFailedPost } from './services/telegram-bot';
import { getAdminConfig } from './services/telegram-bot/storage/kv-operations';
import { fetchForSource } from './services/source-fetcher';
import { getCached, setCached } from './utils/cache';
import {
	CACHE_PREFIX_TELEGRAM_SENT,
	TELEGRAM_CONFIG_TTL,
} from './constants';
import { enrichFeedItems } from './utils/media-enrichment';
import { formatFeedItem, resolveFormatSettings } from './utils/telegram-format';
import { resolveAiSummaryEnabled, insertPostLog } from './db/d1';
import { maybeEnrichSummary } from './services/ai-summarizer';
import { sendFallbackMessage } from './services/telegram-bot/helpers/fallback-sender';
import { FileTooLargeError } from './services/telegram-bot/handlers/send-media';

/**
 * Main entry point for Cloudflare Queue events.
 */
export async function handleQueue(batch: MessageBatch<QueueTask>, env: Env): Promise<void> {
	const bot = new Bot(env.TELEGRAM_BOT_TOKEN);
	
	for (const message of batch.messages) {
		const task = message.body;
		try {
			if (task.type === 'fetch') {
				await processFetchTask(task, env);
			} else if (task.type === 'send') {
				await processSendTask(task, bot, env);
			}
			message.ack();
		} catch (err) {
			console.error(`[Queue] Failed to process ${task.type} task:`, err);
			// Do NOT ack if we want a retry (Cloudflare automatically retries un-acked messages)
		}
	}
}

/**
 * Tier 1: Fetch the feed, identify new items, and queue them for sending.
 */
async function processFetchTask(task: FetchTask, env: Env): Promise<void> {
	const { channelId, sourceId } = task;
	const config = await getChannelConfig(env.CACHE, channelId);
	if (!config || !config.enabled) return;

	const source = config.sources.find(s => s.id === sourceId);
	if (!source || !source.enabled) return;

	const result = await fetchForSource(source, env);
	if (result.items.length === 0) return;

	// Determine new items (not in sent set)
	const sentKey = `${CACHE_PREFIX_TELEGRAM_SENT}${channelId}:${sourceId}`;
	const sentRaw = await getCached(env.CACHE, sentKey);
	let sentLinks: string[] = [];
	try {
		const parsed = sentRaw ? JSON.parse(sentRaw) : [];
		if (Array.isArray(parsed)) sentLinks = parsed;
	} catch {}
	const sentSet = new Set(sentLinks);

	// Filter and find new items
	const newItems = result.items.filter(item => !sentSet.has(item.link));
	if (newItems.length === 0) return;

	// Send oldest first
	newItems.reverse();
	const candidatePosts = newItems.slice(0, 5);
	const postsToQueue: typeof result.items = [];

	// Check D1 post_log to skip items already posted manually (e.g. via MCP/Dashboard) to the same channel
	for (const item of candidatePosts) {
		try {
			const alreadySent = await env.DB.prepare(
				"SELECT 1 FROM post_log WHERE chat_id = ? AND item_id = ? AND status = 'ok' LIMIT 1"
			).bind(channelId, item.id).first();

			if (alreadySent) {
				console.log(`[Queue] Item ${item.id} was already posted to ${channelId} (found in post_log). Skipping.`);
				// Proactively add to KV cache so we don't query D1 for this item again
				sentSet.add(item.link);
				continue;
			}
			postsToQueue.push(item);
		} catch (dbErr) {
			console.error(`[Queue] Failed to query post_log for item ${item.id}:`, dbErr);
			postsToQueue.push(item); // Fallback to sending to prevent stuck items
		}
	}

	if (postsToQueue.length === 0) {
		// Save the updated KV sent set (including the skipped links) so subsequent runs filter them in KV
		const updated = [...sentLinks, ...candidatePosts.map(i => i.link)].slice(-200);
		await setCached(env.CACHE, sentKey, JSON.stringify(updated), TELEGRAM_CONFIG_TTL);
		return;
	}

	// Resolve format settings
	const settings = resolveFormatSettings(config.defaultFormat, source.format);

	// Enrich metadata (TikTok, Telegraph, etc.) before queuing to Send tier
	const adminConfig = await getAdminConfig(env.CACHE);
	await enrichFeedItems(postsToQueue, {
		token: adminConfig.telegraph.token || env.TELEGRAPH_ACCESS_TOKEN,
		enabled: adminConfig.telegraph.enabled,
		threshold: adminConfig.telegraph.threshold,
	});

	// AI summarization: resolve effective setting for this channel+source, then summarize
	const aiEnabled = await resolveAiSummaryEnabled(env.DB, channelId, sourceId);
	if (aiEnabled) {
		// Use source.value as a stable feed proxy key (no D1 feed ID available for bot sources)
		const feedProxy = source.id;
		await Promise.all(
			postsToQueue.map(item => maybeEnrichSummary(item, feedProxy, env.DB, env, channelId, sourceId)),
		);
	}

	// Push each item to the Send Queue
	for (const item of postsToQueue) {
		await env.TELEGRAM_SEND_QUEUE.send({
			type: 'send',
			channelId,
			item,
			settings
		});
	}

	// Update KV immediately to prevent duplicate queuing if fetcher retries (include all candidates)
	const updated = [...sentLinks, ...candidatePosts.map(i => i.link)].slice(-200);
	await setCached(env.CACHE, sentKey, JSON.stringify(updated), TELEGRAM_CONFIG_TTL);
}

/**
 * Tier 2: Format the post and send it to Telegram.
 */
async function processSendTask(task: SendTask, bot: Bot, env: Env): Promise<void> {
	const { channelId, item, settings } = task;
	const chatId = parseInt(channelId, 10);
	let messageType = 'text';
	let captionPreview = '';

	try {
		const message = formatFeedItem(item, settings);
		messageType = message.type;
		captionPreview = message.caption.slice(0, 200);

		await sendMediaToChannel(bot, chatId, message, settings);

		// Log success to D1 post_log
		try {
			await insertPostLog(env.DB, {
				itemId: item.id,
				chatId: channelId,
				messageType,
				captionPreview,
				status: 'ok',
			});
		} catch (logErr) {
			console.error('[Queue Log] Failed to insert success log:', logErr);
		}
	} catch (err) {
		// Handle 429 Rate Limiting specifically
		if (err instanceof GrammyError && err.error_code === 429) {
			console.error(`[Queue] Rate limited sending to ${channelId}. Rethrowing for retry.`);
			throw err; 
		}

		console.error(`[Queue] Failed to send item ${item.id} to ${channelId}:`, err);

		// Handle fallback logic
		if (settings.fallbackMode === 'skip') {
			await addFailedPost(env.CACHE, channelId, item);
			
			// Log skip/error to D1 post_log
			try {
				await insertPostLog(env.DB, {
					itemId: item.id,
					chatId: channelId,
					messageType,
					captionPreview: item.title.slice(0, 200),
					status: 'error',
					error: err instanceof Error ? err.message : String(err),
				});
			} catch (logErr) {
				console.error('[Queue Log] Failed to insert error log (skipped):', logErr);
			}
			return; // Ack since we chose to skip
		}

		try {
			await sendFallbackMessage(bot, chatId, item, settings.fallbackMode as 'thumbnail_link' | 'thumbnail', err);
			
			// Log successful fallback
			try {
				await insertPostLog(env.DB, {
					itemId: item.id,
					chatId: channelId,
					messageType: 'photo', // fallback message is a photo (thumbnail)
					captionPreview: `[Fallback] ${item.title.slice(0, 180)}`,
					status: 'ok',
				});
			} catch (logErr) {
				console.error('[Queue Log] Failed to insert fallback success log:', logErr);
			}
		} catch (fallbackErr) {
			console.error(`[Queue] Fallback also failed for ${item.id}:`, fallbackErr);
			await addFailedPost(env.CACHE, channelId, item);
			
			// If it's a 429, retry later
			if (fallbackErr instanceof GrammyError && fallbackErr.error_code === 429) {
				throw fallbackErr;
			}
			
			// Log permanent failure to D1 post_log
			try {
				await insertPostLog(env.DB, {
					itemId: item.id,
					chatId: channelId,
					messageType,
					captionPreview,
					status: 'error',
					error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
				});
			} catch (logErr) {
				console.error('[Queue Log] Failed to insert permanent failure log:', logErr);
			}
			
			// For other errors (bot blocked, etc.), we ack to stop retrying but log the permanent failure
			console.error(`[Queue] Permanent delivery failure for ${item.id} in channel ${channelId}`);
		}
	}
}
