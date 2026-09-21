import type { Bot, Context } from 'grammy';
import { setAdminState } from '../storage/admin-state';
import { getChannelConfigFromD1 } from '../../../db/d1';
import { escapeHtml } from '../../../utils/text';

/** Runs a command with its argument string (from the command line or collected interactively). */
export type ArgCommandRunner = (ctx: Context, args: string) => Promise<void>;

const runners = new Map<string, ArgCommandRunner>();

/**
 * Register a command whose runner may ask for missing arguments via askForArg().
 * The admin's reply is appended to the collected args and the runner is called again.
 */
export function registerArgCommand(bot: Bot, name: string, run: ArgCommandRunner): void {
	runners.set(name, run);
	bot.command(name, (ctx) => run(ctx, ctx.match?.trim() ?? ''));
}

/** Resume a command waiting on input (called from the text-input handler). */
export async function resumeArgCommand(ctx: Context, command: string, collectedArgs: string, text: string): Promise<void> {
	const run = runners.get(command);
	if (!run) return;
	await run(ctx, `${collectedArgs} ${text}`.trim());
}

/**
 * Prompt for the next missing argument instead of replying with usage text.
 * `collected` holds the args already given; the next plain-text reply is appended to it.
 */
export async function askForArg(
	ctx: Context,
	kv: KVNamespace,
	adminId: number,
	command: string,
	collected: string,
	prompt: string,
): Promise<void> {
	await setAdminState(kv, adminId, {
		action: 'awaiting_command_args',
		context: { command, collectedArgs: collected },
	});
	await ctx.reply(`${prompt}\n\nUse /cancel to abort.`, { parse_mode: 'HTML' });
}

/** Standard channel prompt shared by channel-scoped commands. */
export function channelPrompt(purpose: string): string {
	return (
		`Send me the channel <b>@username</b> or <b>ID</b> ${purpose}\n\n` +
		'Example: <code>@mychannel</code> or <code>-1001234567890</code>'
	);
}

/** "Current sources" list appended to source prompts so the admin can copy one. */
export async function channelSourcesHint(db: D1Database, channelId: string): Promise<string> {
	const config = await getChannelConfigFromD1(db, channelId);
	if (!config || config.sources.length === 0) return '';
	return '\n\nCurrent sources:\n' + config.sources.map((s) => `<code>${escapeHtml(s.value)}</code>`).join('\n');
}
