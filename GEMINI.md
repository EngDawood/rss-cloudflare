# Gemini CLI Project Notes: RSS-Bridge Bot

This document outlines the core architecture, data flows, queue system, AI features, and APIs of the RSS-Bridge Telegram Bot.

## Project Structure & Deployment

The project is consolidated under a single root package using `pnpm` and is deployed to a single Cloudflare Worker using **Cloudflare Workers Static Assets**:
*   **[workers/](file:///c:/Users/LEGION/codebase/rss-bridge/workers/)**: Cloudflare Worker backend and Telegram bot code (Hono API routes, queue handlers, D1/KV configurations, and Durable Objects).
*   **[app/](file:///c:/Users/LEGION/codebase/rss-bridge/app/)**: React dashboard frontend built with Vite. The compiled assets in `app/dist` are hosted and served directly from the Worker (configured via the `assets` block in `wrangler.jsonc`).
*   **[shared/](file:///c:/Users/LEGION/codebase/rss-bridge/shared/)**: Shared code and types accessible by both frontend and backend.

### Developer Commands
*   `pnpm dev`: Runs both the Wrangler backend dev server (port 8787) and Vite frontend dev server (port 5173 with HMR) concurrently.
*   `pnpm build`: Runs compiler typechecks and builds the React app into `app/dist`.
*   `pnpm deploy`: Compiles the frontend and deploys the unified Worker + assets package to Cloudflare.
*   `pnpm run cf-typegen`: Regenerates TypeScript bindings in `worker-configuration.d.ts` from `wrangler.jsonc`.

---

## Core Architecture & Data Flow

The bot operates on a two-step "Fetch & Enrich" model to handle social media feeds. This architecture is identical for both background channel updates (`/sub` cron jobs) and manual user tests (`/test` command).

### 1. Step 1: Getting the Text (The Feed)
The bot does not communicate directly with the target platform (e.g., TikTok, Instagram). Instead, it uses public **RSS-Bridge** instances as a middleman.

1.  **Routing:** Based on the source type (e.g., `tiktok_user`), the bot routes the request to the appropriate fetcher (e.g., `fetchTikTokUser` in [workers/services/source-fetcher.ts](file:///c:/Users/LEGION/codebase/rss-bridge/workers/services/source-fetcher.ts)).
2.  **Failover System:** It requests an **Atom format** XML feed from an array of known RSS-Bridge instances. If the first instance fails, it automatically cycles to the next one in the array (e.g., `RSS_BRIDGE_TIKTOK_INSTANCES` or `RSS_BRIDGE_INSTANCES`).
3.  **Parsing:** The bot downloads the XML feed and parses it using Cheerio ([workers/services/feed-fetcher.ts](file:///c:/Users/LEGION/codebase/rss-bridge/workers/services/feed-fetcher.ts)).
4.  **Data Extraction:** At this stage, the bot extracts the caption text, timestamp, and the link to the original post.
    *   **HTML Entity Decoding:** A dedicated `decodeHtmlEntities` function ensures characters like `&quot;`, `&amp;`, and `&#39;` render cleanly in Telegram.

### 2. Step 2: "Enrichment" (Getting the Video / Media)
Because the RSS-Bridge feed lacks high-quality media files, the bot runs an enrichment process (`enrichFeedItems` in [workers/utils/media-enrichment.ts](file:///c:/Users/LEGION/codebase/rss-bridge/workers/utils/media-enrichment.ts)).

1.  **Trigger:** If the post links to a supported platform (like TikTok) and lacks native video media, the enrichment process starts.
2.  **Media Downloader:** The bot uses the `btchFetch` client in [workers/services/media-downloader.ts](file:///c:/Users/LEGION/codebase/rss-bridge/workers/services/media-downloader.ts).
3.  **TikTok Optimization:** 
    *   The bot tries multiple services (prioritizing AIO) to find the best media link.
    *   It aggressively filters out "proxy" URLs (like `tiktokio.com/api/...`) which cause `530 Origin DNS Error` on Cloudflare Workers.
    *   It uses `decodeTiktokDirectUrl` to extract direct CDN links.

### 3. Step 3: Queue & Delivery
With the text and high-quality media, the bot schedules and dispatches the content.

1.  **Formatting:** Captions are built in [workers/utils/telegram-format.ts](file:///c:/Users/LEGION/codebase/rss-bridge/workers/utils/telegram-format.ts) based on `FormatSettings`.
    *   **Extended Customization:** Support for enabling/disabling hashtags, removing TikTok view counts, and adding custom headers, footers, and hashtags.
    *   **Interactive Setup:** Admin users can set custom text via a dedicated UI flow (`setting_format_custom`).
2.  **Dispatch & Resilience:**
    *   The bot first attempts to send via URL.
    *   **Download Fallback:** If Telegram fails to fetch the URL, the bot automatically downloads the file and uploads it as an `InputFile`.
    *   **Error Handling:** Distinguishes between terminal errors (e.g., bot blocked) and transient fetch errors.
3.  **Fallback Mechanisms:**
    *   If the file exceeds the 50MB limit, or if all downloads fail, it sends a fallback message with the thumbnail and original link.

---

## High-Signal Sub-Systems

### 1. Two-Tier Cloudflare Queue System
To decouple cron triggers from actual Telegram dispatching, the bot utilizes a two-tier Cloudflare Queue configuration:
*   **Tier 1 (FEED_FETCH_QUEUE):** `processFetchTask` in [workers/queue-handler.ts](file:///c:/Users/LEGION/codebase/rss-bridge/workers/queue-handler.ts) fetches and deduplicates feeds via the KV sent set (`telegram:sent:{channelId}:{sourceId}`), runs media enrichment (TikTok, Telegraph), generates AI summaries, and queues tasks to Tier 2 (up to 5 items).
*   **Tier 2 (TELEGRAM_SEND_QUEUE):** `processSendTask` formats the `FeedItem`, dispatches it via grammY, handles 429 rate-limiting dynamically (re-throwing for Cloudflare Queue retry), and performs fallback/skipped post handling.

### 2. AI Summarization & Edge Gateway
The bot leverages Cloudflare AI Gateway to generate concise Arabic summaries for posts:
*   **Configuration Levels:** Global default (in D1 config table), channel overrides, and source-level overrides (in D1 `channel_ai_settings` table).
*   **Dynamic Model Routing:** Selects the appropriate model based on context, supporting presets (Gemini 1.5/2.0 Flash, NVIDIA Llama 3.1 70B Nemotron, Groq Llama, Mistral Large, Kimi K2.6) and custom model strings.
*   **Interactive AI Setup & Testing:** Under `/ai`, admins can view status, toggle options, edit prompts/models, and click `🧪 Test AI` to fetch any RSS feed and preview summaries in DM.
*   **Output Format:** For Telegraph items, the summary replaces the body entirely; for standard items, the summary is italicized and prepended to the post body.

### 3. Action API & Chat Agent
Programmatic endpoints and chat agent capabilities are available for local or external dashboards:
*   **Administrative Action API (`POST /api/action`):** Handles feed registration/removal, browsing, setting configs, manual postings, note management, and logs. Secured with `MCP_AUTH_TOKEN`.
*   **Chat Agent (`POST /api/chat`):** Invokes `runChatAgent` in [workers/services/chat-agent.ts](file:///c:/Users/LEGION/codebase/rss-bridge/workers/services/chat-agent.ts) which acts as an OpenAI-compatible agent equipped with read-only database tools to answer admin queries and save memory notes to D1.

### 4. Folo Webhook Publisher
*   Receives payloads on `POST /folo` (authenticated via `FOLO_WEBHOOK_SECRET` token check).
*   Maps incoming webhook feed articles to standardized `FeedItem` objects.
*   Dispatches formatted articles to all channels registered in the `folo:channels` KV store.

### 5. Interactive Bot Commands & Testing Flow
*   **Interactive ForceReply `/test` Flow:** When `/test` is run without arguments, the bot sets the admin state to `testing_source` and prompts for inputs (source type/URL and optional count) via `ForceReply`. The input is verified and executed, allowing cancellation via `/cancel`.
*   **Source Parsing (`parseSourceRef`):** Standardizes parsing of Instagram handles, TikTok IDs, and RSS URLs, resolving prefixes and platform detection.