
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## AI Guidance

* Ignore GEMINI.md and GEMINI-*.md files
* To save main context space, for code searches, inspections, troubleshooting or analysis, use code-searcher subagent where appropriate - giving the subagent full context background for the task(s) you assign it.
* ALWAYS read and understand relevant files before proposing code edits. Do not speculate about code you have not inspected. If the user references a specific file/path, you MUST open and inspect it before explaining or proposing fixes. Be rigorous and persistent in searching code for key facts. Thoroughly review the style, conventions, and abstractions of the codebase before implementing new features or abstractions.
* After receiving tool results, carefully reflect on their quality and determine optimal next steps before proceeding. Use your thinking to plan and iterate based on this new information, and then take the best next action.
* After completing a task that involves tool use, provide a quick summary of what you've done.
* For maximum efficiency, whenever you need to perform multiple independent operations, invoke all relevant tools simultaneously rather than sequentially.
* Before you finish, please verify your solution
* Do what has been asked; nothing more, nothing less.
* NEVER create files unless they're absolutely necessary for achieving your goal.
* ALWAYS prefer editing an existing file to creating a new one.
* NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
* If you create any temporary new files, scripts, or helper files for iteration, clean up these files by removing them at the end of the task.
* When you update or modify core context files, also update markdown documentation and memory bank
* When asked to commit changes, exclude CLAUDE.md and CLAUDE-*.md referenced memory bank system files from any commits. Never delete these files.

<investigate_before_answering>
Never speculate about code you have not opened. If the user references a specific file, you MUST read the file before answering. Make sure to investigate and read relevant files BEFORE answering questions about the codebase. Never make any claims about code before investigating unless you are certain of the correct answer - give grounded and hallucination-free answers.
</investigate_before_answering>

<do_not_act_before_instructions>
Do not jump into implementatation or changes files unless clearly instructed to make changes. When the user's intent is ambiguous, default to providing information, doing research, and providing recommendations rather than taking action. Only proceed with edits, modifications, or implementations when the user explicitly requests them.
</do_not_act_before_instructions>

<use_parallel_tool_calls>
If you intend to call multiple tools and there are no dependencies between the tool calls, make all of the independent tool calls in parallel. Prioritize calling tools simultaneously whenever the actions can be done in parallel rather than sequentially. For example, when reading 3 files, run 3 tool calls in parallel to read all 3 files into context at the same time. Maximize use of parallel tool calls where possible to increase speed and efficiency. However, if some tool calls depend on previous calls to inform dependent values like the parameters, do NOT call these tools in parallel and instead call them sequentially. Never use placeholders or guess missing parameters in tool calls.
</use_parallel_tool_calls>

## Project Overview

RSS Bridge is a Cloudflare Worker with two main features:
1. **RSS Endpoint** — Converts Instagram profiles, hashtags, and RSS feeds to RSS 2.0 XML
2. **Telegram Bot** — Admin bot for managing channel subscriptions and auto-posting from feeds via cron

## Commands

- `npm run dev` — Start local dev server (port 8787)
- `npm run deploy` — Deploy to Cloudflare
- `npm run cf-typegen` — Regenerate worker-configuration.d.ts from wrangler.jsonc
- `npx wrangler secret put IG_SESSION_ID` — Set Instagram session cookie
- `npx wrangler secret put IG_DS_USER_ID` — Set Instagram user ID cookie
- `npx wrangler kv namespace create CACHE` — Create KV namespace
- `npx wrangler d1 migrations apply rss-reader --local` — Apply D1 migrations locally
- `npx wrangler d1 migrations apply rss-reader --remote` — Apply D1 migrations to production

## Architecture

```
migrations/
├── 0001_init.sql             # feeds, items, config tables
├── 0002_chats_notes.sql      # chats, notes, post_log tables
├── 0003_ai_summary.sql       # channel_ai_settings, feeds.ai_summary, items.summary
├── 0004_ai_model_prompt.sql  # ai_model, ai_prompt columns on channel_ai_settings
└── 0005_core_feeds.sql       # Reshapes feeds (source_type/source_value); adds channels,
                              #   telegram_subscriptions, mcp_subscriptions, idx_postlog_chat_item

archive/
├── folo-commands.ts          # Archived (Folo broken; unwired from bot)
└── folo.ts                   # Archived

workers/
├── index.ts                  # Hono app entry point, routes (incl. /mcp)
├── constants.ts              # Instagram API endpoints, Telegram defaults, KV key constants
├── queue-handler.ts          # Cloudflare Queue handler (FetchTask + SendTask)
├── types/                    # TypeScript interfaces
│   ├── instagram.ts          # Instagram API response types
│   ├── rss.ts                # RSS feed/item types
│   ├── telegram.ts           # Telegram bot types (ChannelConfig, FormatSettings, etc.)
│   ├── feed.ts               # Universal feed item types
│   └── queue.ts              # FetchTask { feedId } + SendTask { channelId, item, settings }
├── db/
│   └── d1.ts                 # D1 helpers: feeds, items, config, chats, notes, post_log,
│                             #   channels, telegram_subscriptions, mcp_subscriptions,
│                             #   wasPostedToChannel, D1 ChannelConfig facade functions
├── mcp/
│   ├── index.ts              # RSSReaderMCP extends McpAgent — served at /mcp
│   └── tools.ts              # 26 MCP tool registrations
├── routes/
│   ├── instagram.ts          # /instagram route handler (RSS endpoint)
│   ├── telegram.ts           # /telegram webhook route (bot updates)
│   └── action-api.ts         # Admin Action API + POST /api/migrate-channels (Phase 2 backfill)
├── services/
│   ├── post-service.ts       # Canonical resolveTarget + logAndSend (shared by MCP + action-api)
│   ├── instagram-client.ts   # RSS-Bridge fetching (primary)
│   ├── media-downloader.ts   # Multi-platform media downloader (btch API, 9 platforms)
│   ├── feed-fetcher.ts       # Generic RSS/Atom feed parser
│   ├── source-fetcher.ts     # Routes by SourceType → correct fetcher
│   ├── user-resolver.ts      # Username → ID resolution + KV cache
│   ├── rss-builder.ts        # RSS 2.0 XML generation
│   ├── ai-summarizer.ts      # AI Gateway summarization (Arabic, 3-level config)
│   └── telegram-bot/         # Modular Telegram bot
│       ├── index.ts          # Re-exports createBot, getChannelConfigFromD1, etc.
│       ├── bot-factory.ts    # Bot instance creation, middleware, error handling
│       ├── commands/         # /start, /add, /sub, /channels, /format, /ai, /debug
│       ├── callbacks/        # Inline keyboard callback handlers (incl. download-callbacks)
│       ├── handlers/         # Multi-step flows (add source, fetch & send, download-and-send)
│       ├── helpers/          # channel-resolver (D1-backed), fallback-sender, etc.
│       ├── storage/          # kv-operations (admin state, failed posts); admin-state
│       └── views/            # Keyboard builders, message formatters
├── cron/
│   ├── check-feeds.ts        # Cron: reads D1 channels+subs, deduplicates by feed_id,
│   │                         #   pushes one FetchTask per due feed; also exports filterItems
│   └── refresh-feeds.ts      # Cron: refreshes MCP-subscribed feeds on schedule
└── utils/
    ├── headers.ts            # Instagram request header builder
    ├── media.ts              # MediaNode → RSS item conversion
    ├── text.ts               # HTML escaping, caption processing
    ├── cache.ts              # KV cache helpers
    ├── url-detector.ts       # Platform URL detection (9 platforms)
    ├── telegram-format.ts    # FeedItem → Telegram message formatting
    └── media-enrichment.ts   # Telegraph IV + TikTok enrichment
```

## MCP Server

The MCP server is served at `/mcp` via `RSSReaderMCP extends McpAgent<Env>` (Cloudflare Agents SDK). It exposes **26 tools** backed by D1:

**Feed tools:** `add_feed`, `list_feeds`, `remove_feed`, `set_feed_enabled`, `refresh_feed`, `refresh_all`, `fetch_rss_feed`

**Browse tools:** `list_new_items` (unread; filter by feedId/query/since), `search_items` (all items incl. read; filter by query/feedId/since/unreadOnly), `get_item` (full item; `markRead?: boolean` default false), `mark_read`, `mark_unread`

**Chat management:** `add_chat`, `list_chats`, `remove_chat`, `set_default_chat`, `set_telegram_chat` (legacy alias)

**Post tools:** `post_to_telegram` (stored item → named chat or default), `post_message` (custom or item-override; type=text/photo/video/audio/album)

**Memory tools:** `save_note`, `list_notes`, `search_notes`, `delete_note`, `recall` (unified notes+posts timeline), `list_post_log`

**Config:** `get_config`

### D1 Tables (binding: `DB`, database: `rss-reader`)
- `feeds` — Core feeds keyed by `(source_type, source_value)`; `source_type` ∈ SourceType (`rss_url`, `instagram_user`, `instagram_tag`, `instagram_story`, `rsshub_url`, `tiktok_user`)
- `items` — parsed feed entries; `media` = `JSON FeedItemMedia[]`; `read` = MCP workspace cursor (global)
- `channels` — Telegram consumer: one row per auto-post channel (numeric id as text)
- `telegram_subscriptions` — Telegram consumer: `(channel_id, feed_id)` + `media_filter`, `format` (JSON)
- `mcp_subscriptions` — MCP consumer: `feed_id`; MCP browse tools scope through this
- `config` — flat key→value config store
- `chats` — named Telegram chat targets for manual/MCP posts; partial unique index → at most one default
- `notes` — freeform agent-written notes/recaps with optional item/chat refs
- `post_log` — written on every Telegram send (ok + error); indexed on `(chat_id, item_id)` for dedup
- `channel_ai_settings` — per-channel/per-source AI model/prompt/enabled overrides

### Internal helpers (in `workers/services/post-service.ts`)
- `resolveTarget(db, target?)` — resolves chat name / raw numeric id / default chat → `{chatId, chatName?}`
- `logAndSend(db, bot, chatId, chatName, message, itemId?)` — wraps `sendMediaToChannel`, writes `post_log` row on success and failure

## Conventions

- TypeScript strict mode
- Hono framework for routing
- KV for caching (feed XML cached 15min, user IDs cached 24h)
- No heavy dependencies — RSS XML built manually, no HTML parser
- Env type comes from worker-configuration.d.ts (generated from wrangler.jsonc)
- Run `npm run cf-typegen` after changing wrangler.jsonc bindings

## Data flow

1. Request hits `/instagram?u=username`
2. Check KV cache for rendered RSS XML → return on hit
3. Fetch Instagram data via multi-tier fallback (REST → GraphQL GET → GraphQL POST → embed scraping)
4. Filter by media_type, convert MediaNode[] to RSSItem[]
5. Build RSS 2.0 XML, cache in KV, return

## API

### RSS Endpoint
```
GET /instagram?u=<username>                    # User feed
GET /instagram?h=<hashtag>                     # Hashtag feed
GET /instagram?l=<location_id>                 # Location feed
GET /instagram?u=<username>&media_type=video   # Filter: all|video|picture|multiple
GET /instagram?u=<username>&direct_links=true  # Use direct CDN URLs
GET /health                                    # Health check
```

### Telegram Bot
```
POST /telegram                                 # Webhook endpoint for bot updates
```

**Bot commands:**
- `/start`, `/help` — Info and usage
- `/add @channel` — Register a Telegram channel
- `/sub @channel @iguser` — Subscribe to Instagram user (no initial fetch)
- `/sub @channel @iguser 5` — Subscribe + fetch 5 latest posts
- `/unsub @channel source` — Unsubscribe from source
- `/channels` — List registered channels
- `/status` — Show all subscriptions
- `/format` — Configure message formatting (author, media, source link, etc.)
- `/debug`, `/test` — Diagnostic commands

**Media download:** Send a supported URL (TikTok, Instagram, Twitter/X, YouTube, Facebook, Threads, SoundCloud, Spotify, Pinterest) to the bot to download and receive media. YouTube offers quality picker. Facebook offers HD/SD picker. TikTok offers Video/Audio picker (image slideshows auto-download). Threads supports both `threads.net` and `threads.com` domains.

**Media send strategy (URL-first):** `send-media.ts` always tries Telegram URL pass-through first (no host whitelist). If Telegram can't fetch the URL, interactive mode shows `[📥 Download] [❌ Cancel] [📤 Send to @urluploadxbot]` buttons with the direct URL in monospace. Cron/channel posting auto-falls back to download+upload silently. Files >50MB show the URL + @urluploadxbot button. `TelegramUrlFetchError` is thrown on URL rejection in interactive mode; `downloadAndSendMedia` catches it and stores `directMediaUrl` in KV for the `dl:confirm` callback. Twitter/Threads/Pinterest deduplicate AIO quality variants to single best video.

**Cron job:** `check-feeds.ts` runs every N minutes (configurable per channel), fetches new posts, sends to Telegram channels.

## Queue Architecture (Phase 3 complete — D1 core feeds path)

The cron → send path uses a **two-tier Cloudflare Queue** system backed by D1 (no KV sent-set):

- **Cron (`check-feeds.ts`):** Reads `channels` + `telegram_subscriptions` from D1. Applies bucket-based schedule (deterministic per channel hash). Collects unique `feed_id`s from all due subscriptions. Emits **one `FetchTask{feedId}`** per unique due feed — dedup happens at cron time.
- **Tier 1 (`FEED_FETCH_QUEUE`):** `processFetchTask()` in `queue-handler.ts` — looks up feed, calls `fetchForSource`, `upsertItems` to D1, then loops over all `telegram_subscriptions` for this `feed_id`. For each channel subscription, filters items by `media_filter`, deduplicates via `wasPostedToChannel(db, chatId, itemId)` (post_log indexed on `(chat_id, item_id)`), enriches once (Telegraph/TikTok), AI-summarizes per subscription, queues `SendTask` for each new item (max 5 per cycle).
- **Tier 2 (`TELEGRAM_SEND_QUEUE`):** `processSendTask()` — formats `FeedItem` → `TelegramMediaMessage`, sends via `sendMediaToChannel()`, writes `post_log`. Handles 429 by re-throwing for Cloudflare retry.
- Task types in `workers/types/queue.ts`: `FetchTask { type, feedId }` and `SendTask { type, channelId, item, settings }`.

**KV sent-set eliminated.** Dedup is now solely `post_log WHERE status='ok'`. The old `queue-handler.ts:74-92` post_log cross-check hack is gone.

**What stays on KV:** admin state (`storage/admin-state.ts`), failed posts log, admin/Telegraph config, download callback state. Channel config, subscriptions, and cron scheduling are D1.

## Core Feeds Architecture (PRD phases 0–3 complete as of 2026-06-12)

One core `feeds` table keyed by `(source_type, source_value)` with two typed consumers:
- **Telegram consumer** — `channels` + `telegram_subscriptions`; cron fetches, dedup via `post_log`.
- **MCP consumer** — `mcp_subscriptions`; on-demand fetch when agent routine runs; dedup via `items.read`.

**D1 ChannelConfig facade** (`workers/db/d1.ts`): `getChannelConfigFromD1(db, channelId)` and `saveChannelConfigToD1(db, channelId, config)` reconstruct/persist the legacy `ChannelConfig` shape via D1 joins. All bot command/callback/handler files use these instead of KV.

**Phase status:** 0 ✓ PostService + Folo archive | 1 ✓ migration 0005 + D1 helpers | 2 ✓ backfill endpoint | **3 ✓ cron+queue+bot files switched to D1** | 4 pending MCP scoping | 5 pending action-api UI split.

**Migration 0005 must be applied** before deploying Phase 3 code:
```
npx wrangler d1 migrations apply rss-reader --local   # local dev
npx wrangler d1 migrations apply rss-reader --remote  # production
```

## Multi-Platform Publishing (planned, not yet implemented)

Design doc: `C:\Users\LEGION\.claude\plans\hi-claude-can-u-atomic-sutton.md`

**Goal:** publish feeds to other platforms (Facebook Page, X, LinkedIn, etc.) alongside Telegram via **Composio** as a managed OAuth relay.

**Architecture planned:**
- `Publisher` interface + registry (`src/services/publishers/`)
- `TelegramPublisher` — adapter over existing grammY send path (no behavior change)
- `ComposioPublisher` — REST call to `POST https://backend.composio.dev/api/v3/tools/execute/{SLUG}` with `x-api-key: COMPOSIO_API_KEY`
- New D1 migration `0003_destinations.sql` — `destinations` table (platform + external_id) + `source_destinations` M2M + `platform` col on `post_log`
- Queue `SendTask` generalized to carry `PublishTarget` instead of `channelId`
- New secret: `COMPOSIO_API_KEY` (via `wrangler secret put COMPOSIO_API_KEY`)

**Composio status (2026-06-03):**
- MCP live via claude.ai connector (`mcp__claude_ai_composio__*`, 7 meta-tools)
- Facebook toolkit recognized; **no Page account connected yet** — next: OAuth flow via `COMPOSIO_MANAGE_CONNECTIONS`
- FB personal profile posting: **impossible** (Meta API restriction since 2018, applies to all relays)
- Plugin `.mcp.json` bug: missing `"type": "http"` — workaround: `claude mcp add --transport http composio https://connect.composio.dev/mcp --scope user`
