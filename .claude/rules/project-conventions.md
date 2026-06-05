## Bot Command Consistency Rule

**Whenever you add or remove a Telegram bot command, you MUST update all three places in sync:**

1. `src/routes/setup.ts` — `BOT_COMMANDS` array (passed to `setMyCommands`): add/remove the `{ command, description }` entry.
2. `src/services/telegram-bot/commands/info-commands.ts` — `/start` handler: update the listed commands in both admin and guest reply text.
3. `src/services/telegram-bot/commands/info-commands.ts` — `/help` handler: update the admin commands list to match.

Failing to keep these in sync means the Telegram command menu shows stale commands, or `/start`/`/help` describe commands that no longer exist.

## Memory Bank System

This project uses a structured memory bank system with specialized context files. Always check these files for relevant information before starting work:

### Core Context Files

* **CLAUDE-activeContext.md** — Current session state, goals, and progress (if exists)
* **CLAUDE-patterns.md** — Established code patterns and conventions (if exists)
* **CLAUDE-decisions.md** — Architecture decisions and rationale (if exists)
* **CLAUDE-troubleshooting.md** — Common issues and proven solutions (if exists)
* **CLAUDE-config-variables.md** — Configuration variables reference (if exists)
* **CLAUDE-temp.md** — Temporary scratch pad (only read when referenced)

**Important:** Always reference the active context file first to understand what's currently being worked on and maintain session continuity.

### Memory Bank Backups

When asked to backup Memory Bank System files, copy the core context files above and the `.claude/` settings directory to the requested backup directory. Overwrite if files already exist there.
