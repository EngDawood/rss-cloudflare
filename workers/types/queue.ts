import type { FeedItem } from './feed';
import type { FormatSettings } from './telegram';

/**
 * Task for fetching a core feed by its D1 feed id.
 * One task is emitted per due feed (deduped across all subscribing channels).
 */
export interface FetchTask {
	type: 'fetch';
	feedId: string;
}

/**
 * Task for sending a single feed item to a channel.
 */
export interface SendTask {
	type: 'send';
	channelId: string;
	item: FeedItem;
	settings: FormatSettings;
}

/**
 * Combined type for all queue tasks.
 */
export type QueueTask = FetchTask | SendTask;
