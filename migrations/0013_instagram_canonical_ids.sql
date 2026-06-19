-- 0013_instagram_canonical_ids.sql
-- Cross-bridge dedup fix for Instagram feeds.
--
-- InstagramBridge (primary) and the ImgsedBridge fallback both emit Atom <id> values of
-- the form urn:sha1:<hash>, but the hash is computed over each bridge's OWN content, so the
-- SAME post gets a DIFFERENT id depending on which bridge served it. Telegram dedup keys on
-- post_log.item_id, so when the fallback kicks in every already-sent post looks new and gets
-- re-sent. The feed parser now stores items.id as the canonical post URL
-- (https://www.instagram.com/p/<shortcode>/), which is identical across both bridges.
--
-- This rewrites already-logged Instagram sends to that same canonical id so switching to
-- canonical ids does NOT trigger a one-time re-send of posts still in the live feed. The
-- canonical id equals the stored items.link for the (overwhelmingly common) /p/ posts.

UPDATE post_log
SET item_id = (
  SELECT i.link
  FROM items i
  JOIN feeds f ON f.id = i.feed_id
  WHERE i.id = post_log.item_id
    AND f.source_type IN ('instagram_user', 'instagram_tag')
    AND i.link LIKE 'https://www.instagram.com/p/%'
  LIMIT 1
)
WHERE item_id LIKE 'urn:sha1:%'
  AND EXISTS (
    SELECT 1
    FROM items i
    JOIN feeds f ON f.id = i.feed_id
    WHERE i.id = post_log.item_id
      AND f.source_type IN ('instagram_user', 'instagram_tag')
      AND i.link LIKE 'https://www.instagram.com/p/%'
  );
