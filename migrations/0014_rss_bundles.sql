CREATE TABLE IF NOT EXISTS rss_bundles (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  enabled     INTEGER NOT NULL DEFAULT 1,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS rss_bundle_feeds (
  bundle_id  TEXT NOT NULL REFERENCES rss_bundles(id) ON DELETE CASCADE,
  feed_id    TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, feed_id)
);
