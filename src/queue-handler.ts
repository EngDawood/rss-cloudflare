import type { MessageBatch } from '@cloudflare/workers-types';
import type { QueueTask, FetchTask, SendTask } from './types/queue';
import { Bot, GrammyError } from 'grammy';
import { getChannelConfig, sendMediaToChannel, addFailedPost } from './services/telegram-bot';
import { fetchForSource } from './services/source-fetcher';
import { getCached, setCached } from './utils/cache';
import {
	CACHE_PREFIX_TELEGRAM_SENT,
	TELEGRAM_CONFIG_TTL,
} from './constants';
import { enrichFeedItems } from './utils/media-enrichment';
import { formatFeedItem, resolveFormatSettings } from './utils/telegram-format';
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
	const postsToQueue = newItems.slice(0, 5);

	// Resolve format settings
	const settings = resolveFormatSettings(config.defaultFormat, source.format);

	// Enrich metadata (TikTok, Telegraph, etc.) before queuing to Send tier
	await enrichFeedItems(postsToQueue, settings.telegraphToken || env.TELEGRAPH_ACCESS_TOKEN);

	// Push each item to the Send Queue
	for (const item of postsToQueue) {
		await env.TELEGRAM_SEND_QUEUE.send({
			type: 'send',
			channelId,
			item,
			settings
		});
	}

	// Update KV immediately to prevent duplicate queuing if fetcher retries
	const updated = [...sentLinks, ...postsToQueue.map(i => i.link)].slice(-50);
	await setCached(env.CACHE, sentKey, JSON.stringify(updated), TELEGRAM_CONFIG_TTL);
}

/**
 * Tier 2: Format the post and send it to Telegram.
 */
async function processSendTask(task: SendTask, bot: Bot, env: Env): Promise<void> {
	const { channelId, item, settings } = task;
	const chatId = parseInt(channelId, 10);

	try {
		const message = formatFeedItem(item, settings);
		await sendMediaToChannel(bot, chatId, message, settings);
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
			return; // Ack since we chose to skip
		}

		try {
			await sendFallbackMessage(bot, chatId, item, settings.fallbackMode as 'thumbnail_link' | 'thumbnail', err);
		} catch (fallbackErr) {
			console.error(`[Queue] Fallback also failed for ${item.id}:`, fallbackErr);
			await addFailedPost(env.CACHE, channelId, item);
			
			// If it's a 429, retry later
			if (fallbackErr instanceof GrammyError && fallbackErr.error_code === 429) {
				throw fallbackErr;
			}
			
			// For other errors (bot blocked, etc.), we ack to stop retrying but log the permanent failure
			console.error(`[Queue] Permanent delivery failure for ${item.id} in channel ${channelId}`);
		}
	}
}
