CREATE TABLE IF NOT EXISTS feed_categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS feed_category_members (
  category_id TEXT NOT NULL REFERENCES feed_categories(id) ON DELETE CASCADE,
  feed_id     TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, feed_id)
);

-- Seed a 'Default' category and assign all existing feeds to it
INSERT OR IGNORE INTO feed_categories (id, name, created_at) VALUES ('default0000000001', 'Default', unixepoch());
INSERT OR IGNORE INTO feed_category_members (category_id, feed_id) SELECT 'default0000000001', id FROM feeds;
