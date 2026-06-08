import type { FeedItem } from './feed';
import type { FormatSettings } from './telegram';

/**
 * Task for fetching a specific source for a channel.
 */
export interface FetchTask {
	type: 'fetch';
	channelId: string;
	sourceId: string;
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
