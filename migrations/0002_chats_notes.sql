-- RSS Reader MCP: chats + notes
-- 0002 — multiple named Telegram chats, and freeform agent notes/recaps.

-- ── Named Telegram chats ──────────────────────────────────────────────────────
-- Replaces the single config.telegram_chat_id with multiple targets, each with a
-- human alias and a type. post_to_telegram / custom posts target a chat by name
-- (or fall back to the row with is_default = 1).
CREATE TABLE IF NOT EXISTS chats (
  name       TEXT PRIMARY KEY,                 -- unique alias, e.g. "news"
  chat_id    TEXT NOT NULL,                    -- numeric id, e.g. -1001234567890
  type       TEXT NOT NULL DEFAULT 'channel',  -- channel | group | private | bot
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- At most one default chat.
CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_default ON chats (is_default) WHERE is_default = 1;

-- Carry over the existing single chat id (if any) as the default named "default".
INSERT OR IGNORE INTO chats (name, chat_id, type, is_default, created_at)
SELECT 'default', value, 'channel', 1, unixepoch()
FROM config WHERE key = 'telegram_chat_id';

-- ── Agent notes / recaps ──────────────────────────────────────────────────────
-- Freeform context written in real time by the agent or an external model.
-- Optionally linked to a stored item (ref_item_id) and/or a chat (ref_chat).
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  content     TEXT NOT NULL,
  tags        TEXT NOT NULL DEFAULT '[]',  -- JSON string[]
  ref_item_id TEXT,                        -- optional items.id this note is about
  ref_chat    TEXT,                        -- optional chat name/id this note is about
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_notes_created ON notes (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_item    ON notes (ref_item_id);

-- ── Post log ──────────────────────────────────────────────────────────────────
-- Auto-written every time something is sent to Telegram (stored item or custom
-- message). Gives an "I posted X to Y at T" history, separate from manual notes.
CREATE TABLE IF NOT EXISTS post_log (
  id              TEXT PRIMARY KEY,
  item_id         TEXT,                        -- stored items.id, NULL for custom posts
  chat_name       TEXT,                        -- resolved chat alias, if any
  chat_id         TEXT NOT NULL,
  message_type    TEXT NOT NULL DEFAULT 'text',-- text | photo | video | audio | mediagroup
  caption_preview TEXT NOT NULL DEFAULT '',    -- first ~200 chars of the caption
  status          TEXT NOT NULL DEFAULT 'ok',  -- ok | error
  error           TEXT,                        -- failure message when status = 'error'
  posted_at       INTEGER NOT NULL DEFAULT (unixepoch())  -- when it was sent to Telegram
);

CREATE INDEX IF NOT EXISTS idx_postlog_posted ON post_log (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_postlog_item    ON post_log (item_id);
CREATE INDEX IF NOT EXISTS idx_postlog_chat    ON post_log (chat_id);
