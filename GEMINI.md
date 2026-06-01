# Gemini CLI Project Notes: RSS-Bridge Bot

This document outlines the core architecture and workflow of the RSS-Bridge Telegram Bot, specifically detailing how it fetches, enriches, and sends media (like TikToks) to Telegram.

## Bot Architecture & Data Flow

The bot operates on a two-step "Fetch & Enrich" model to handle social media feeds. This architecture is identical for both background channel updates (`/sub` cron jobs) and manual user tests (`/test` command).

### 1. Step 1: Getting the Text (The Feed)
The bot does not communicate directly with the target platform (e.g., TikTok, Instagram). Instead, it uses public **RSS-Bridge** instances as a middleman.

1. **Routing:** Based on the source type (e.g., `tiktok_user`), the bot routes the request to the appropriate fetcher (e.g., `fetchTikTokUser` in `src/services/source-fetcher.ts`).
2. **Failover System:** It requests an **Atom format** XML feed from an array of known RSS-Bridge instances. If the first instance fails, it automatically cycles to the next one in the array (e.g., `RSS_BRIDGE_TIKTOK_INSTANCES` or `RSS_BRIDGE_INSTANCES`).
3. **Parsing:** The bot downloads the XML feed and parses it using Cheerio (`src/services/feed-fetcher.ts`).
4. **Data Extraction:** At this stage, the bot extracts:
   - The caption text (which has HTML entities decoded).
   - The timestamp.
   - The link to the original post on the web (e.g., `https://www.tiktok.com/@user/video/123`).
   - *Note: RSS-Bridge usually only provides a low-quality thumbnail image, not the actual video file.*

### 2. Step 2: "Enrichment" (Getting the Video)
Because the RSS-Bridge feed lacks the raw, high-quality media file (especially for video platforms like TikTok), the bot runs an enrichment process (`enrichFeedItems` in `src/utils/media-enrichment.ts`).

1. **Trigger:** If the post links to a supported platform (like TikTok) and lacks native video media, the enrichment process starts.
2. **Media Downloader:** The bot passes the original web link to a third-party download server API (specifically, the `btchFetch` client in `src/services/media-downloader.ts`).
3. **Proxy Evasion:** The download API (like the `AIO` or `tiktok` endpoints) will return a link to the media.
   - *Crucial Security Note:* The bot must aggressively avoid "proxy" URLs returned by the API (like `https://tiktokio.com/api/...`). Because the bot is hosted on Cloudflare Workers, attempting to download from these proxies results in a `530 Origin DNS Error` block.
   - The bot attempts to extract the direct, unprotected CDN link using functions like `decodeTiktokDirectUrl` or falls back to safer endpoints like `AIO` to bypass this block.
4. **Replacement:** Once the high-quality `.mp4` or `.jpg` link is successfully resolved, it replaces the low-quality RSS thumbnail in the bot's memory.

### 3. Step 3: Sending to Telegram
With the text from Step 1 and the high-quality media from Step 2, the bot is ready to dispatch.

1. **Formatting:** The caption is formatted according to the channel or source's specific layout settings (`src/utils/telegram-format.ts`).
2. **Dispatch:** The bot attempts to send the media and caption to Telegram (`sendMediaToChannel` in `src/services/telegram-bot/handlers/send-media.ts`).
3. **Fallback Mechanisms:**
   - If Telegram rejects sending the media via URL, the bot will fall back, download the file into its own memory (`downloadAsInputFile`), and upload it directly as an `InputFile`.
   - If the file exceeds Telegram's 50MB bot upload limit, or if all downloads fail, the bot resorts to its ultimate fallback: sending just the text, thumbnail, and a link to the original post.

## Key Sub-Systems

* **Text Parsing (`parseSourceRef`):** Handles user input (from `/sub`, `/test`, etc.). It uses regex to strip away extra spaces, numbers, and flags (like `-t` or `-rss`) to accurately extract usernames and feed URLs.
* **Cron Jobs (`src/cron/check-feeds.ts`):** Runs periodically in the background. It uses the exact same fetch/enrich flow as the `/test` command but tracks sent posts in a KV store to prevent duplicates.
* **HTML Entity Decoding:** Raw text from RSS feeds is aggressively decoded (`decodeHtmlEntities`) to ensure characters like ellipses (`&hellip;`), dashes, and quotes render cleanly in Telegram messages rather than as literal HTML code.