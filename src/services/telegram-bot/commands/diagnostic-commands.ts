import { type Bot, InlineKeyboard } from 'grammy';
import type { ChannelSource } from '../../../types/telegram';
import { parseSourceRef } from '../helpers/source-parser';
import { fetchForSource } from '../../source-fetcher';
import { formatFeedItem } from '../../../utils/telegram-format';
import { sendMediaToChannel } from '../handlers/send-media';
import { escapeHtml as escapeHtmlBot } from '../../../utils/text';
import { buildHeaders } from '../../../utils/headers';
import { IG_WEB_PROFILE, IG_TOP_SEARCH } from '../../../constants';
import { enrichFeedItems } from '../../../utils/media-enrichment';
import { sendFallbackMessage } from '../helpers/fallback-sender';
import { fetchAndSendLatest } from '../handlers/fetch-and-send';

const BOT_COMMANDS = [
	{ command: 'start', description: 'Show all commands' },
	{ command: 'help', description: 'How to use the bot' },
	{ command: 'add', description: 'Register a channel: /add @channel' },
	{ command: 'sub', description: 'Subscribe to a source: /sub @channel @iguser' },
	{ command: 'unsub', description: 'Unsubscribe from a source' },
	{ command: 'list', description: 'List all subscriptions' },
	{ command: 'channels', description: 'List & manage channels' },
	{ command: 'status', description: 'Status overview' },
	{ command: 'seed', description: 'Mark source(s) as read' },
	{ command: 'delay', description: 'Set check interval in minutes' },
	{ command: 'set', description: 'Source format settings' },
	{ command: 'set_default', description: 'Channel default format' },
	{ command: 'enable', description: 'Enable a channel' },
	{ command: 'disable', description: 'Disable a channel' },
	{ command: 'test', description: 'Fetch & send latest post' },
	{ command: 'debug', description: 'Test Instagram connectivity' },
	{ command: 'setup', description: 'Sync bot commands & menu' },
	{ command: 'telegraph', description: 'Configure Telegraph Instant View' },
	{ command: 'cancel', description: 'Cancel current action' },
];

/**
 * Register diagnostic and testing commands.
 */
export function registerDiagnosticCommands(bot: Bot, env: Env, kv: KVNamespace): void {
	// /setup — Sync commands and menu button
	bot.command('setup', async (ctx) => {
		try {
			await bot.api.setMyCommands(BOT_COMMANDS);
			await bot.api.setChatMenuButton({ menu_button: { type: 'commands' } });
			await ctx.reply('✅ Bot commands and menu button have been synchronized.');
		} catch (err: any) {
			await ctx.reply(`❌ Failed to sync commands: ${err.message}`);
		}
	});

	// /test [count] <source> — Fetch and send the latest post(s) from any source
	bot.command('test', async (ctx) => {
		const arg = ctx.match?.trim() || '';
		if (!arg) {
			await ctx.reply(
				'Usage:\n' +
				'<code>/test [count] @username</code> (Instagram)\n' +
				'<code>/test [count] -i username</code> (Instagram)\n' +
				'<code>/test [count] -t username</code> (TikTok)\n' +
				'<code>/test [count] -rss https://...</code> (RSS)\n' +
				'<code>/test [count] https://...</code> (Profile or RSS link)\n\n' +
				'Example: <code>/test 5 -t walidfitaihi6</code>',
				{ parse_mode: 'HTML' }
			);
			return;
		}

		let count = 1;
		let sourceRef = arg;
		
		// If the command starts with a number, parse it and remove it from the sourceRef string
		const match = arg.match(/^(\d+)\s+(.+)$/);
		if (match) {
			count = parseInt(match[1], 10);
			sourceRef = match[2];
			
			// Put a reasonable upper limit to avoid API bans/flooding
			if (count > 10) count = 10;
			if (count < 1) count = 1;
		}

		const parsed = parseSourceRef(sourceRef);
		if (!parsed) {
			await ctx.reply('Invalid source. Use @username, -t username, -rss url, or a profile/feed URL.');
			return;
		}

		let useQueue = false;
		if (sourceRef.includes('-q')) {
			useQueue = true;
			sourceRef = sourceRef.replace('-q', '').trim();
		}

		await ctx.reply(`Fetching latest ${count} from <b>${escapeHtmlBot(parsed.value)}</b>${useQueue ? ' via Queue' : ''}...`, { parse_mode: 'HTML' });

		const source: ChannelSource = {
			id: parsed.id,
			type: parsed.type,
			value: parsed.value,
			mediaFilter: 'all',
			enabled: true,
		};

		await fetchAndSendLatest(bot, env, ctx.chat!.id, source, count, useQueue);
	});

	// /debug [@username] — Quick Instagram connectivity test
	bot.command('debug', async (ctx) => {
		const arg = ctx.match?.trim().replace(/^@/, '') || '';
		const testUsername = arg || 'instagram';

		const lines: string[] = [];
		lines.push(`<b>Diagnostics: ${testUsername}</b>\n`);

		// Check session cookies
		const hasCookies = !!env.IG_SESSION_ID && !!env.IG_DS_USER_ID;
		lines.push(`Session cookies: ${hasCookies ? 'Present' : 'MISSING'}`);

		// Single quick REST API test with 8s timeout
		const headers = buildHeaders(env);
		try {
			const testUrl = `${IG_WEB_PROFILE}?username=${testUsername}`;
			const res = await fetch(testUrl, { headers, signal: AbortSignal.timeout(8000) });
			const contentType = res.headers.get('content-type') || '';
			if (!res.ok) {
				lines.push(`REST API: HTTP ${res.status} FAILED`);
			} else if (!contentType.includes('json')) {
				lines.push(`REST API: HTTP ${res.status} but returned HTML (login redirect — cookies expired)`);
			} else {
				const data = await res.json() as { data?: { user?: { edge_owner_to_timeline_media?: { count?: number } } } };
				const count = data?.data?.user?.edge_owner_to_timeline_media?.count;
				lines.push(`REST API: OK (${count ?? '?'} posts)`);
			}
		} catch (err) {
			lines.push(`REST API: ${String(err).substring(0, 100)}`);
		}

		// Quick user ID resolution with 5s timeout
		try {
			const searchUrl = `${IG_TOP_SEARCH}?query=${encodeURIComponent(testUsername)}`;
			const res = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(5000) });
			if (!res.ok) {
				lines.push(`User search: HTTP ${res.status}`);
			} else {
				const contentType = res.headers.get('content-type') || '';
				if (!contentType.includes('json')) {
					lines.push(`User search: returned HTML (cookies expired)`);
				} else {
					const data = await res.json() as { users?: Array<{ user: { pk: string; username: string } }> };
					const match = data?.users?.find((u) => u.user.username.toLowerCase() === testUsername.toLowerCase());
					lines.push(`User search: ${match ? `found (ID: ${match.user.pk})` : `not found in ${data?.users?.length ?? 0} results`}`);
				}
			}
		} catch (err) {
			lines.push(`User search: ${String(err).substring(0, 100)}`);
		}

		await ctx.reply(lines.join('\n'), {
			parse_mode: 'HTML',
			reply_markup: new InlineKeyboard().text('Test Callback (Ping)', 'ping_test')
		});
	});

	// Simple ping test handler
	bot.callbackQuery('ping_test', async (ctx) => {
		await ctx.answerCallbackQuery({ text: 'Pong! Callback system is working.', show_alert: true });
	});
}
