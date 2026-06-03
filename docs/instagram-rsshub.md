# Instagram Fallback Documentation (RSSHub)

This document describes the fallback mechanism for downloading Instagram Stories and posts when primary API providers (like BTCH or SnapSave) fail.

## Overview
Instagram employs aggressive bot detection, which often leads to "No media found" or rate-limiting errors for automated downloaders. To provide a robust experience, this bot uses public **RSSHub** instances as a fallback bridge through the `picnob.info` service.

## Fallback Route
For any given Instagram username, the bot can fetch stories using the following RSSHub route:
`{rsshub_instance}/picnob.info/user/{username}/stories`

## Configured RSSHub Servers
The following public instances are rotated to ensure high availability and bypass per-IP rate limits:

1.  `https://rsshub.rssforever.com`
2.  `https://hub.slarker.me`
3.  `https://rsshub.pseudoyu.com`
4.  `https://rsshub.ktachibana.party`
5.  `https://rss.owo.nz`
6.  `https://rsshub.umzzz.com`
7.  `https://rsshub.isrss.com`
8.  `https://rsshub-balancer.virworks.moe`
9.  `https://rss.spriple.org`
10. `https://rsshub.cups.moe`
11. `https://rss.4040940.xyz`

## How it works
1.  **Detection**: When an Instagram Story URL is detected (e.g., `instagram.com/stories/username/`).
2.  **Primary Attempt**: The bot first tries the standard high-speed downloaders.
3.  **Fallback Trigger**: If the primary attempt fails, the bot extracts the `username` from the URL.
4.  **RSSHub Request**: The bot iterates through the configured RSSHub servers and requests the `picnob.info` bridge.
5.  **Parsing**: The resulting RSS XML is parsed for `<item>` entries, extracting the direct media URLs (CDN links) for photos and videos.
6.  **Delivery**: The media is sent to the user as a fallback result.

## Advantages
- **No Login Required**: Unlike direct Instagram scraping, this bridge doesn't require authenticated sessions.
- **High Availability**: Multiple servers ensure that if one goes down, others can take over.
- **Improved Story Support**: Stories are notoriously difficult to fetch reliably; this method provides a consistent secondary path.
