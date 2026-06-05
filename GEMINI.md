# Gemini CLI Project Notes: RSS-Bridge Bot

This document outlines the core architecture and workflow of the RSS-Bridge Telegram Bot, specifically detailing how it fetches, enriches, and sends media (like TikToks) to Telegram.

## Bot Architecture & Data Flow

The bot operates on a two-step "Fetch & Enrich" model to handle social media feeds. This architecture is identical for both background channel updates (`/sub` cron jobs) and manual user tests (`/test` command).

### 1. Step 1: Getting the Text (The Feed)
The bot does not communicate directly with the target platform (e.g., TikTok, Instagram). Instead, it uses public **RSS-Bridge** instances as a middleman.

1. **Routing:** Based on the source type (e.g., `tiktok_user`), the bot routes the request to the appropriate fetcher (e.g., `fetchTikTokUser` in `src/services/source-fetcher.ts`).
2. **Failover System:** It requests an **Atom format** XML feed from an array of known RSS-Bridge instances. If the first instance fails, it automatically cycles to the next one in the array (e.g., `RSS_BRIDGE_TIKTOK_INSTANCES` or `RSS_BRIDGE_INSTANCES`).
3. **Parsing:** The bot downloads the XML feed and parses it using Cheerio (`src/services/feed-fetcher.ts`).
4. **Data Extraction:** At this stage, the bot extracts the caption text, timestamp, and the link to the original post.
   - **HTML Entity Decoding:** A dedicated `decodeHtmlEntities` function ensures characters like `&quot;`, `&amp;`, and `&#39;` render cleanly in Telegram.

### 2. Step 2: "Enrichment" (Getting the Video)
Because the RSS-Bridge feed lacks high-quality media files, the bot runs an enrichment process (`enrichFeedItems` in `src/utils/media-enrichment.ts`).

1. **Trigger:** If the post links to a supported platform (like TikTok) and lacks native video media, the enrichment process starts.
2. **Media Downloader:** The bot uses the `btchFetch` client in `src/services/media-downloader.ts`.
3. **TikTok Optimization:** 
   - The bot tries multiple services (prioritizing AIO) to find the best media link.
   - It aggressively filters out "proxy" URLs (like `tiktokio.com/api/...`) which cause `530 Origin DNS Error` on Cloudflare Workers.
   - It uses `decodeTiktokDirectUrl` to extract direct CDN links.

### 3. Step 3: Sending to Telegram
With the text and high-quality media, the bot dispatches the content.

1. **Formatting:** Captions are built in `src/utils/telegram-format.ts` based on `FormatSettings`.
   - **Extended Customization:** Support for enabling/disabling hashtags, removing TikTok view counts, and adding custom headers, footers, and hashtags.
   - **Interactive Setup:** Admin users can set custom text via a dedicated UI flow (`setting_format_custom`).
2. **Dispatch & Resilience:**
   - The bot first attempts to send via URL.
   - **Download Fallback:** If Telegram fails to fetch the URL, the bot automatically downloads the file and uploads it as an `InputFile`.
   - **Error Handling:** Distinguishes between terminal errors (e.g., bot blocked) and transient fetch errors.
3. **Fallback Mechanisms:**
   - If the file exceeds the 50MB limit, or if all downloads fail, it sends a fallback message with the thumbnail and original link.

## Key Sub-Systems

* **Source Parsing (`parseSourceRef`):** Improved to support explicit prefixes (`-i`, `-t`, `-rss`) and smart URL detection for Instagram and TikTok profiles.
* **Format Settings:** Managed via `src/services/telegram-bot/helpers/format-settings.ts`, allowing per-channel customization of appearance.
* **Cron Jobs (`src/cron/check-feeds.ts`):** Periodically checks for new posts, using KV storage to track sent items and avoid duplicates.
* **Media Enrichment:** Centralized logic for bypassing platform restrictions and retrieving high-quality assets.