# RSS-Bridge Bot

A high-performance Cloudflare Worker that bridges social media platforms to RSS, drives a powerful Telegram bot for automated multi-platform feed distribution and media downloading, and includes a React admin dashboard.

## 🚀 Features

### 1. RSS Endpoint

Converts Instagram content into clean RSS 2.0 XML. Supports multiple content types:
- **User Feeds**: `@username`
- **Hashtags**: `#hashtag`
- **Locations**: Location ID based feeds
- **Filtering**: Filter by media type (photo, video, album)
- **Direct Links**: Option to use direct CDN URLs for media

### 2. Telegram Admin Bot

A feature-rich bot to manage your feeds and subscriptions:
- **Subscription Management**: Subscribe/unsubscribe Telegram channels to Instagram profiles, TikTok users, or any RSS/Atom feed URL.
- **Automated Posting**: Periodic checking of feeds (every 5 min via Cron) and automatic posting to configured channels.
- **Multi-Platform Media**: Downloads and sends media from 9+ platforms — Instagram, TikTok, Twitter/X, YouTube, Facebook, Threads, SoundCloud, Spotify, Pinterest.
- **Customizable Formatting**: Per-channel and per-source formatting settings (author display, media toggles, source links, notification muting, hashtags, custom headers/footers).
- **Telegraph Publishing**: Long posts automatically published to Telegraph and linked in Telegram.
- **AI Summarization**: Concise Arabic summaries generated via Cloudflare AI Gateway, configurable per channel and per source.
- **Fallback Logic**: Smart handling of large media files with automatic fallback to "Thumbnail + Link" or "Skip" modes.
- **Failed Posts Log**: Admin interface to view and manage posts that failed to send due to Telegram limits.

### 3. React Admin Dashboard

A Tailwind v4-powered dashboard served directly from the Worker as static assets:
- Browse and manage feeds, subscriptions, and channel configs.
- View AI settings and post logs.
- Served at the Worker URL (or custom domain `rss.feed.engdawood.com`).

### 4. MCP Server

An AI-accessible MCP server at `/mcp` backed by a Durable Object with SQLite — exposes tools for feed management, browsing, posting, and memory.

---

## 🛠️ Prerequisites

- A **Cloudflare account** with Workers, KV, D1, and Queues enabled.
- A **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather)).
- **Instagram Session Cookies** (`sessionid` and `ds_user_id`) for authenticated fetching.
- `pnpm` installed globally (`npm install -g pnpm`).

---

## ⚙️ Installation & Setup

### 1. Clone and Install

```bash
git clone https://github.com/EngDawood/RSS-Bridge.git
cd rss-bridge
pnpm install
```

### 2. Configure Cloudflare Resources

Create required resources and note their IDs for `wrangler.jsonc`:

```bash
# KV namespace
npx wrangler kv namespace create CACHE

# D1 database
npx wrangler d1 create rss-reader

# Queues
npx wrangler queues create rss-bot-fetch-queue
npx wrangler queues create rss-bot-send-queue
```

Update the `kv_namespaces`, `d1_databases`, and `queues` IDs in `wrangler.jsonc` with the values from the commands above.

### 3. Apply D1 Migrations

```bash
# Local development
npx wrangler d1 migrations apply rss-reader --local

# Production
npx wrangler d1 migrations apply rss-reader --remote
```

There are four migrations (`0001_init.sql` through `0004_ai_model_prompt.sql`).

### 4. Set Secrets

Use Wrangler to securely set your sensitive credentials:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put IG_SESSION_ID
npx wrangler secret put IG_DS_USER_ID
npx wrangler secret put MCP_AUTH_TOKEN
npx wrangler secret put AI_GATEWAY_TOKEN
npx wrangler secret put FOLO_WEBHOOK_SECRET   # optional
```

### 5. Deploy

```bash
pnpm deploy
```

---

## 📖 Usage & Commands

### Development

```bash
pnpm dev          # Backend (port 8787) + Frontend (port 5173) concurrently
pnpm build        # Typecheck and build the React app
pnpm run cf-typegen  # Regenerate TypeScript types from wrangler.jsonc
pnpm lint         # Lint the frontend source
pnpm test         # Run vitest
```

### RSS API Endpoints

- `GET /instagram?u=<username>` — Fetch user feed.
- `GET /instagram?h=<hashtag>` — Fetch hashtag feed.
- `GET /instagram?u=<username>&media_type=video` — Filter by `all|video|picture|multiple`.
- `GET /instagram?u=<username>&direct_links=true` — Use direct CDN URLs.
- `GET /health` — Health check.
- `GET /test-bridges[/:u]` — Test RSS-Bridge / RSSHub instances.

### Telegram Bot Commands

- `/start` / `/help` — Show usage information.
- `/add @channel` — Register a new Telegram channel for management.
- `/channels` — List all registered channels.
- `/sub @channel <source>` — Subscribe a channel to a source (IG username, TikTok ID, or RSS URL).
- `/unsub @channel <source>` — Unsubscribe from a source.
- `/status` — Show current subscriptions and their status.
- `/format` — Open the interactive formatting settings menu.
- `/ai` — Configure AI summarization (toggle, set model, edit prompt, test).
- `/test [source] [count]` — Manually test a feed source (supports ForceReply interactive flow).
- `/cancel` — Cancel the current interactive flow.

---

## 🏗️ Architecture

```
workers/               # Cloudflare Worker (entry: workers/index.ts)
├── index.ts           # Hono app, fetch/scheduled/queue handlers
├── constants.ts       # Instagram API endpoints, KV key prefixes, format defaults
├── queue-handler.ts   # processFetchTask + processSendTask
├── cron/
│   ├── check-feeds.ts     # Enqueues FEED_FETCH_QUEUE tasks per subscription
│   └── refresh-feeds.ts   # Refreshes feed metadata in D1
├── db/
│   └── d1.ts          # All D1 helpers (feeds, items, chats, notes, post_log, config, AI)
├── mcp/
│   ├── index.ts       # RSSReaderMCP (McpAgent DO) — served at /mcp
│   └── tools.ts       # MCP tool registrations backed by D1
├── routes/
│   ├── action-api.ts  # POST /api/action and POST /api/chat
│   ├── folo.ts        # POST /folo webhook
│   ├── instagram.ts   # GET /instagram RSS endpoint
│   ├── setup.ts       # GET /telegram/setup
│   ├── telegram.ts    # POST /telegram/webhook
│   └── test-bridges.ts # GET /test-bridges, /test-rssbridge, /test-rsshub
├── services/
│   ├── ai-summarizer.ts      # Cloudflare AI Gateway summarization
│   ├── chat-agent.ts         # OpenAI-compatible chat agent
│   ├── feed-fetcher.ts       # Generic RSS/Atom parser (Cheerio)
│   ├── instagram-client.ts   # Instagram RSS-Bridge fetching
│   ├── media-downloader.ts   # Multi-platform media downloader (btch API)
│   ├── rss-builder.ts        # RSS 2.0 XML builder
│   ├── source-fetcher.ts     # Multi-platform source routing
│   ├── user-resolver.ts      # Instagram username→ID resolution + KV cache
│   └── telegram-bot/         # grammY bot (commands, callbacks, handlers, views)
└── utils/
    ├── cache.ts               # KV cache helpers
    ├── headers.ts             # HTTP header utilities
    ├── media-enrichment.ts    # enrichFeedItems orchestration
    ├── media.ts               # Media type detection and processing
    ├── telegram-format.ts     # Caption/message formatting
    ├── telegraph.ts           # Telegraph publishing integration
    ├── text.ts                # Text utilities
    └── url-detector.ts        # Platform URL detection

app/                   # React admin dashboard (Vite + Tailwind v4)
├── src/App.tsx        # Entire dashboard UI (~115 KB single file)
└── dist/              # Built assets served by the Worker

shared/
└── types.ts           # Shared TypeScript types

migrations/            # D1 migrations (applied manually)
├── 0001_init.sql
├── 0002_chats_notes.sql
├── 0003_ai_summary.sql
└── 0004_ai_model_prompt.sql
```

### Key Platform Features

| Feature | Binding | Purpose |
|---|---|---|
| KV (`CACHE`) | `CACHE` | Feed XML cache, user ID cache, channel configs, sent-item dedup |
| D1 (`rss-reader`) | `DB` | Feeds, items, chats, notes, post_log, config, AI settings |
| Durable Object | `RSSReaderMCP` | SQLite-backed MCP agent |
| Queue | `FEED_FETCH_QUEUE` | Feed fetching + dedup + AI summary (batch 10) |
| Queue | `TELEGRAM_SEND_QUEUE` | Telegram dispatch with retry (batch 1) |
| Static Assets | `ASSETS` | Serves `app/dist` |

---

## 🔧 Configuration (`wrangler.jsonc`)

The `vars` section allows you to customize runtime behavior:

| Var | Default | Purpose |
|---|---|---|
| `USER_ID_CACHE_TTL` | `86400` | Instagram user ID cache duration (seconds) |
| `FEED_CACHE_TTL` | `900` | Feed XML cache TTL (seconds) |
| `ADMIN_TELEGRAM_ID` | — | Your Telegram user ID (restricts bot access) |
| `WORKER_URL` | — | Public URL of your deployed Worker |
| `DEFAULT_AI_MODEL` | `nvidia/llama-3.1-nemotron-70b-instruct` | AI model for feed summarization |
| `CHAT_AI_MODEL` | `google/gemini-2.0-flash` | AI model for the chat agent |

---

## 📜 License

Private Project. All rights reserved.
