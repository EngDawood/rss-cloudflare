---
name: worker-dev
description: Use when building or debugging Cloudflare Worker features, D1 schema changes, KV caching, Queue handlers, or MCP server tools in this project.
---

## Project Context
This is a Cloudflare Worker providing an RSS bridge for Instagram and a Telegram bot. It uses Hono, D1, KV, Queues, Durable Objects, and an local MCP server.

## D1 Development
- Migrations are in `./migrations/` numbered sequentially
- Always test locally first: `npx wrangler d1 migrations apply rss-reader --local`
- There are four migrations (`0001_init.sql` through `0004_ai_model_prompt.sql`)

## Type Safety
- After ANY `wrangler.jsonc` edit, run: `npm run cf-typegen`
- Types live in `worker-configuration.d.ts` (auto-generated, do not edit)

## Testing
- Run `npm test` for vitest suite
- Test files are in `test/`

## Key Files
- `src/index.ts` — Hono routes, cron, queue handlers
- `src/mcp/tools.ts` — MCP tool definitions (26 tools)
- `wrangler.jsonc` — Worker bindings and secrets references

## Platform Features
- **KV**: Caching (feed XML 15min, user IDs 24h, channel configs)
- **D1**: Persistent data. Binding `DB`, database name `rss-reader`
- **Durable Objects**: MCP server (`RSSReaderMCP`)
- **Queues**: Two-tier system (`FEED_FETCH_QUEUE`, `TELEGRAM_SEND_QUEUE`)
- **Cron**: Every 5 minutes via `triggers.crontab` in `wrangler.jsonc`

## Error Handling
- Use double-fault protection (error handler also wrapped in try/catch)
- Media sends have graceful fallback: Full media -> Thumbnail + Link -> Text + Link
