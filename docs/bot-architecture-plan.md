# RSS-Bridge Telegram Bot & Cloudflare Worker System Plan

## Overview

The **RSS-Bridge Telegram Bot** is a serverless application built on Cloudflare Workers. It aggregates content from multiple sources (Instagram, TikTok, custom RSS/Atom feeds, and Folo webhooks), enriches media and text using AI and Telegraph, and dispatches formatted posts to Telegram channels with configurable styling.

---

## 1. System Architecture

```
                                 ┌─────────────────────────────────┐
                                 │       Cloudflare Worker         │
┌───────────────────┐            │                                 │            ┌───────────────────┐
│                   │ ─────────► │  Hono Router & API Endpoints    │ ─────────► │  Telegram API     │
│  RSS-Bridge       │ (Atom XML) │  - /folo (Webhooks)             │            │  (grammY client)  │
│  RSSHub           │            │  - /api/action (Dashboard API)  │            └───────────────────┘
│                   │            │  - /mcp (MCP Durable Object)    │                      ▲
└───────────────────┘            │                                 │                      │
                                 └─────────────────────────────────┘                      │
                                        │                   │                             │
                                        ▼                   ▼                             │
                                ┌───────────────┐   ┌───────────────┐                     │
                                │  D1 Database  │   │   KV Cache    │                     │
                                │ (rss-reader)  │   │   (CACHE)     │                     │
                                └───────────────┘   └───────────────┘                     │
                                        │                   │                             │
                                        ▼                   ▼                             │
                                ┌───────────────────────────────────┐                     │
                                │       Cloudflare Queues           │                     │
                                │  - Tier 1: FEED_FETCH_QUEUE       │ ────────────────────┘
                                │  - Tier 2: TELEGRAM_SEND_QUEUE    │
                                └───────────────────────────────────┘
```

---

## 2. Item Source & Link Visibility Feature (Updated)

To ensure every item (whether from Folo, Instagram, TikTok, or generic RSS) clearly displays its original post/feed link in Telegram messages:

1. **Default Source Format (`DEFAULT_FORMAT_SETTINGS.sourceFormat`):**
   - Updated from `'disable'` to `'title_link'`.
   - All subscribed channels default to attaching `<a href="${postUrl}">View on ${sourceName}</a>` at the bottom of each Telegram post.

2. **Link Fallback Hierarchy (`buildFooter` & `sendFallbackMessage`):**
   - Link selection order: `item.link` ➔ `item.feedLink` ➔ `''`.
   - Null-safe rendering: If no valid URL is present, empty `<a href="">` tags are prevented.

3. **Folo Webhook Payload Mapping (`payloadToFeedItem`):**
   - Automatically maps entry URL, GUID links, site URL, and feed URL into `item.link` and `item.feedLink`.

---

## 3. Core Modules & Bot Features

### A. Bot Commands
| Command | Purpose |
|---------|---------|
| `/add @channel <source>` | Subscribe a channel to an Instagram, TikTok, or RSS source |
| `/remove @channel <source>` | Unsubscribe a channel from a source |
| `/list [@channel]` | List active channel subscriptions |
| `/set_default @channel` | Configure default formatting for a channel |
| `/set @channel <source>` | Override formatting settings for a specific source |
| `/ai` | Access interactive AI summarization settings & test suite |
| `/folo` | Manage Folo webhook integrations & channel routing |
| `/test [<source>]` | Test-fetch and preview source posts in Telegram DM |
| `/download <url>` | Direct media downloader (Instagram, TikTok, YouTube, etc.) |
| `/status` | View queue, database, and system health status |

### B. Two-Tier Queue Pipeline
1. **Fetch Queue (`FEED_FETCH_QUEUE`, batch 10):**
   - Triggered by cron (`*/5 * * * *`).
   - Fetches Atom XML feeds with automatic RSS-Bridge/RSSHub instance failover.
   - Deduplicates items against D1 `post_log` and KV sliding-window sent sets (200 items).
   - Pre-seeds existing posts when adding new subscriptions to prevent channel spam.
   - Applies media enrichment (TikTok direct CDN resolution, Telegraph page creation).
   - Generates AI summaries via Cloudflare AI Gateway.

2. **Send Queue (`TELEGRAM_SEND_QUEUE`, batch 1):**
   - Formats message captions with HTML parse mode.
   - Dispatches photos, videos, media groups, or text to Telegram channels.
   - Dynamically handles Telegram 429 rate-limiting with exponential backoff.
   - Graceful fallback: Full media ➔ Thumbnail + Link ➔ Text + Link.

### C. Folo Webhook Integration
- Endpoint: `POST /folo` (supports legacy `FOLO_WEBHOOK_SECRET` token and named webhooks `?id=<id>&token=<token>`).
- Persists feeds into D1 under categorised structures (`Folo` or `Folo: <name>`).
- Auto-delivers webhooks to all channels mapped to the webhook or feed.

### D. AI Summarization & Edge Gateway
- Integrates Cloudflare AI Gateway with support for Gemini 1.5/2.0 Flash, Nemotron, Groq, Mistral, and Kimi models.
- Per-channel and per-source prompt/model overrides (`channel_ai_settings` D1 table).
- AI summaries for bot subscription posts are cached in KV (`ai_summary:{itemId}`) for 30 days.

---

## 4. Developer & Operational Runbook

### Key Commands
- `pnpm dev`: Local Wrangler + Vite dev server concurrently.
- `pnpm build`: Typecheck and compile React app to `app/dist`.
- `pnpm deploy`: Deploy Worker + static assets to Cloudflare.
- `pnpm run cf-typegen`: Regenerate `worker-configuration.d.ts`.

### D1 Migrations
Applied via Wrangler:
- `npx wrangler d1 migrations apply rss-reader --remote`
