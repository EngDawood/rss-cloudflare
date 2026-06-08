# Instagram RSS Bridge (Cloudflare Worker)

A Cloudflare Worker that provides an RSS bridge for Instagram and a Telegram bot for automated feed distribution and media downloading.

## Critical Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development (port 8787) |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `npm test` | Run vitest suite |

## High-Signal Architecture Notes

### Entry Point
- `src/index.ts` defines Hono routes, scheduled cron, and queue handlers.
- Worker has three handlers: `fetch`, `scheduled`, and `queue`.

### Cloudflare Platform Features
- **KV**: Caching (feed XML 15min, user IDs 24h, channel configs).
- **D1**: Persistent data. Binding `DB`, database name `rss-reader`.
- **Durable Objects**: MCP server (`RSSReaderMCP`).
- **Queues**: Two-tier system (`FEED_FETCH_QUEUE`, `TELEGRAM_SEND_QUEUE`).
- **Cron**: Every 5 minutes via `triggers.crontab` in `wrangler.jsonc`.

### Type Safety
- Types are generated from `wrangler.jsonc` into `worker-configuration.d.ts`.
- **Always run `npm run cf-typegen` after changing bindings, vars, or secrets in `wrangler.jsonc`**. The project will fail to build if types are stale.

### D1 Migrations
- Migrations are in `./migrations/` and applied manually:
  - `npx wrangler d1 migrations apply rss-reader --local`
  - `npx wrangler d1 migrations apply rss-reader --remote`
- There are four migrations (`0001_init.sql` through `0004_ai_model_prompt.sql`). Keep these in mind when debugging schema issues.

### Secrets vs. Vars
- `wrangler.jsonc` defines `vars` (non-sensitive, available at runtime).
- **Secrets are NOT in `wrangler.jsonc`**. Set them with:
  - `npx wrangler secret put IG_SESSION_ID`
  - `npx wrangler secret put IG_DS_USER_ID`
  - `npx wrangler secret put TELEGRAM_BOT_TOKEN`
  - `npx wrangler secret put TELEGRAM_WEBHOOK_SECRET`
  - `npx wrangler secret put AI_GATEWAY_TOKEN`
  - ...and others listed in comments in `wrangler.jsonc`.

## Developer Workflow

- There is **no lint, format, or typecheck script** in `package.json`. The project relies on manual discipline and TypeScript via the editor.
- Use `npm run dev` for local development. The worker serves at `http://localhost:8787`.
- The `test/` directory contains a `vitest` config. There is no explicit `vitest.config.ts` in the root; it may be auto-configured by `@cloudflare/vitest-pool-workers` or discovered in `test/tsconfig.json`.

## Testing

- Run `npm test` to invoke vitest.
- The `test/` directory has a `tsconfig.json`. Check there if adding new test files.

## Project-Specific Conventions

### Error Handling
- The bot and cron use a **double-fault protection** pattern: if an operation fails, an error handler tries to notify the admin, but that notification is also wrapped in a `try/catch`.
- Media sends have a **graceful fallback** flow: Full media -> Thumbnail + Link -> Text + Link.

### Data Fetching
- Instagram data is fetched via multi-tier fallback (RSS-Bridge -> GraphQL -> Embed scraping).
- The project uses cheerio to parse RSS-Bridge's Atom XML (not RSS), targeting `<entry>` elements and `<link rel="enclosure" href="...">` attributes.

### AI Summarization (New as of `0003_ai_summary.sql`)
- The `items` table has an `ai_summary` column.
- The `feeds` table has a `ai_summary` setting (default `'inherit'`).
- There is a `channel_ai_settings` table for per-channel and per-source overrides.

### MCP Server
- Serves at `/mcp`.
- Exposes 26 tools backed by D1 for feed management, browsing, chat management, posting, and memory.
- The agent-friendly interface is in `src/mcp/tools.ts`.

## AGENTS.md Maintenance

When adding new Cloudflare resources (KV, D1, Queues, etc.), update `wrangler.jsonc` and run `npm run cf-typegen` before committing.