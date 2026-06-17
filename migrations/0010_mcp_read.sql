-- 0010_mcp_read.sql
-- Per-consumer read cursor for the MCP workspace (issue #32).
--
-- Previously `items.read` was a single global boolean: when an MCP agent marked
-- an item read, the Telegram cron and every other consumer saw it read too.
-- This table gives the MCP workspace its own read state, decoupled from the
-- Telegram consumer's `items.read` cursor. An item is "read for MCP" iff it has
-- a row here.
CREATE TABLE IF NOT EXISTS mcp_read (
	item_id TEXT PRIMARY KEY,
	read_at INTEGER NOT NULL
);
