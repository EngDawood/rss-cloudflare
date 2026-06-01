import { describe, it, expect } from 'vitest';
import { formatFeedItem, resolveFormatSettings } from '../src/utils/telegram-format';
import type { FeedItem } from '../src/types/feed';

describe('telegram-format', () => {
	const mockItem: FeedItem = {
		id: '123',
		link: 'https://example.com/post/1',
		title: 'Post Title',
		text: 'Hello world, this is a test post with some ads. Click here for more!',
		author: 'John Doe',
		feedTitle: 'Example Feed',
		feedLink: 'https://example.com',
		timestamp: Date.now(),
		mediaType: 'none',
		media: [],
	};

	it('should clean up text based on settings', () => {
		const settings = resolveFormatSettings(undefined, {
			cleanupText: 'ads\nClick here for more!',
		});
		const result = formatFeedItem(mockItem, settings);
		// 'ads' is removed, 'Click here for more!' is removed.
		// Extra spaces are collapsed and trimmed.
		expect(result.caption).toContain('Hello world, this is a test post with some .');
		expect(result.caption).not.toContain('ads');
		expect(result.caption).not.toContain('Click here for more!');
	});

	it('should perform case-insensitive cleanup', () => {
		const settings = resolveFormatSettings(undefined, {
			cleanupText: 'HELLO\nTEST',
		});
		const result = formatFeedItem(mockItem, settings);
		expect(result.caption).toContain('world, this is a post with some ads.');
		expect(result.caption).not.toContain('Hello');
		expect(result.caption).not.toContain('test');
	});

	it('should handle special characters in cleanup text', () => {
		const itemWithSpecialChars: FeedItem = {
			...mockItem,
			text: 'Buy now for $19.99! (Limited offer)',
		};
		const settings = resolveFormatSettings(undefined, {
			cleanupText: '$19.99\n(Limited offer)',
		});
		const result = formatFeedItem(itemWithSpecialChars, settings);
		expect(result.caption).toContain('Buy now for !');
		expect(result.caption).not.toContain('$19.99');
		expect(result.caption).not.toContain('(Limited offer)');
	});
});
