# RSS-Bridge Bot (Cloudflare Worker)

A Cloudflare Worker that provides an RSS bridge for Instagram, a powerful Telegram bot for automated multi-platform feed distribution and media downloading, and a React admin dashboard.

## Critical Commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Run backend (Wrangler, port 8787) + frontend (Vite, port 5173) concurrently |
| `pnpm build` | Typecheck and build the React app into `app/dist` |
| `pnpm deploy` | Build frontend then deploy unified Worker + assets to Cloudflare |
| `pnpm run cf-typegen` | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc` |
| `pnpm test` | Run vitest suite |
| `pnpm lint` | Lint the `app/` frontend source |

## High-Signal Architecture Notes

### Project Layout
- **`workers/`** — Cloudflare Worker backend: Hono routes, queue handlers, D1/KV, Durable Objects, bot logic.
- **`app/`** — React + Tailwind v4 admin dashboard (Vite). Built into `app/dist` and served as static assets by the Worker.
- **`shared/`** — Shared TypeScript types used by both frontend and backend.
- **`migrations/`** — D1 SQL migration files applied manually.

### Entry Point
- `workers/index.ts` defines Hono routes, scheduled cron, and queue handler.
- Worker exports three handlers: `fetch`, `scheduled`, and `queue`.
- The `scheduled` handler runs `checkAllFeeds` **and** `refreshSavedFeeds` on each cron tick.

### Cloudflare Platform Features
- **KV** (`CACHE`): Caching (feed XML 15 min, user IDs 24 h, channel configs, Telegram state, sent-item deduplication sets with a 200-item sliding window, AI summaries for 30 days, and Folo webhook deduplication logs for 24 hours).
- **D1** (`DB`, database `rss-reader`): Persistent data — feeds, items, chats, notes, post_log, config, AI settings.
- **Durable Objects** (`RSSReaderMCP`): SQLite-backed MCP agent served at `/mcp`.
- **Queues**: Two-tier system — `FEED_FETCH_QUEUE` (batch 10) and `TELEGRAM_SEND_QUEUE` (batch 1).
- **Static Assets** (`ASSETS`): `app/dist` served via the `assets` binding in `wrangler.jsonc`.
- **Cron**: Every 5 minutes via `triggers.crons` in `wrangler.jsonc`.
- **Custom Domain**: `rss.feed.engdawood.com` mapped via `routes` in `wrangler.jsonc`.
- **Observability**: Logs and traces enabled with full head-sampling in `wrangler.jsonc`.

### Type Safety
- Types are generated from `wrangler.jsonc` into `worker-configuration.d.ts`.
- **Always run `pnpm run cf-typegen` after changing bindings, vars, or secrets in `wrangler.jsonc`**. The project will fail to build if types are stale.

### D1 Migrations
- Migrations are in `./migrations/` and applied manually:
  - `npx wrangler d1 migrations apply rss-reader --local`
  - `npx wrangler d1 migrations apply rss-reader --remote`
- There are **four** migrations (`0001_init.sql` through `0004_ai_model_prompt.sql`). Keep these in mind when debugging schema issues.

### Secrets vs. Vars
- `wrangler.jsonc` defines `vars` (non-sensitive, available at runtime):
  - `USER_ID_CACHE_TTL`, `FEED_CACHE_TTL`, `ADMIN_TELEGRAM_ID`, `WORKER_URL`, `DEFAULT_AI_MODEL`, `CHAT_AI_MODEL`.
- **Secrets are NOT in `wrangler.jsonc`**. Set them with:
  - `npx wrangler secret put IG_SESSION_ID`
  - `npx wrangler secret put IG_DS_USER_ID`
  - `npx wrangler secret put TELEGRAM_BOT_TOKEN`
  - `npx wrangler secret put TELEGRAM_WEBHOOK_SECRET`
  - `npx wrangler secret put FOLO_WEBHOOK_SECRET`
  - `npx wrangler secret put MCP_AUTH_TOKEN`
  - `npx wrangler secret put AI_GATEWAY_TOKEN`

## Developer Workflow

- Use `pnpm dev` for local development. The worker serves at `http://localhost:8787`; the Vite dev server with HMR runs at `http://localhost:5173`.
- There is a **`lint` script** (`eslint app`) but no explicit format or typecheck script — rely on editor TypeScript and the build step.
- `vitest.config.mts` is in the project root; test files live in `test/`.

## Testing

- Run `pnpm test` to invoke vitest.
- The `test/` directory has a `tsconfig.json`. Check there if adding new test files.

## Project-Specific Conventions

### Error Handling
- The bot and cron use a **double-fault protection** pattern: if an operation fails, an error handler tries to notify the admin, but that notification is also wrapped in a `try/catch`.
- Media sends have a **graceful fallback** flow: Full media → Thumbnail + Link → Text + Link.

### Data Fetching
- Feeds are fetched via RSS-Bridge/RSSHub instances (Atom XML) with automatic instance failover.
- Supported platforms: Instagram, TikTok, and any generic RSS/Atom URL.
- The bot uses Cheerio to parse Atom XML, targeting `<entry>` elements and `<link rel="enclosure" href="...">` attributes.
- Instagram-specific fallback chain: RSS-Bridge → GraphQL → Embed scraping.
- Items lacking both unique identifiers (`guid`/`id`) and `link` tags are assigned a deterministic content-hash fallback ID in `feed-fetcher.ts` to prevent SQLite constraint failures.
- When subscribing a Telegram channel to a new feed, the bot pre-seeds all current feed links into the KV cache so only the single latest post is sent, preventing flooding on subsequent cron runs.
- The queue fetch task (`processFetchTask`) queries the D1 `post_log` table to ensure manual posts sent via MCP or the dashboard UI are not re-sent by the bot's background cron. Detected duplicates are skipped and proactively added to the KV sent cache.
- The queue send task (`processSendTask`) logs successful, skipped, or failed message deliveries back to the D1 `post_log` table to ensure complete logging history for bot activity.

### AI Summarization (as of `0003_ai_summary.sql`)
- The `items` table has an `ai_summary` column.
- The `feeds` table has an `ai_summary` setting (default `'inherit'`).
- There is a `channel_ai_settings` table for per-channel and per-source overrides.
- Summaries generated for bot subscriptions are cached in KV (`ai_summary:{itemId}`) for 30 days to resolve the D1 zero-row update loophole (since bot items are not saved to the `items` table).

### MCP Server
- Serves at `/mcp` via a SQLite-backed Durable Object (`RSSReaderMCP`).
- Exposes tools backed by D1 for feed management, browsing, chat management, posting, and memory.
- The agent-friendly interface is in `workers/mcp/tools.ts`.

## AGENTS.md Maintenance

When adding new Cloudflare resources (KV, D1, Queues, Durable Objects, etc.), update `wrangler.jsonc` and run `pnpm run cf-typegen` before committing.

## Git Rules

- **Do NOT use `git add .`** under any circumstances.
- When staging changes, explicitly specify only the file paths that you have created or edited during the current session (e.g., `git add path/to/file1 path/to/file2`).