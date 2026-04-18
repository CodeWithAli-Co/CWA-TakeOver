-- ============================================================
-- Migration: Chat schema baseline
-- ============================================================
-- Ensures cwa_chat + cwa_dm_chat have every column the client
-- assumes exists. Idempotent — all ALTERs use IF NOT EXISTS.
--
-- The client has text-embedded fallbacks for every missing column
-- (replies, reactions, images, files), so chat still works without
-- this migration — but applying it gives you:
--
--   · Native reply_to / reactions / read_by columns → cleaner
--     DB queries + ability to aggregate reactions in Supabase.
--   · image_urls column → thumbnails render from structured data
--     instead of a regex on the message body.
--   · company column → filter General-channel messages by active
--     company the same way CWA / Simplicity are scoped.
--
-- Run in your Supabase SQL editor. Safe on existing rows.
-- ============================================================

-- ── cwa_chat (General) ──────────────────────────────────────
ALTER TABLE public.cwa_chat
  ADD COLUMN IF NOT EXISTS reply_to       bigint,
  ADD COLUMN IF NOT EXISTS reactions      jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_by        text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_urls     text[],
  ADD COLUMN IF NOT EXISTS thread_root_id bigint,
  ADD COLUMN IF NOT EXISTS pinned_at      timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by      text,
  ADD COLUMN IF NOT EXISTS company        text;

CREATE INDEX IF NOT EXISTS cwa_chat_thread_idx
  ON public.cwa_chat (thread_root_id)
  WHERE thread_root_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cwa_chat_pinned_idx
  ON public.cwa_chat (pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS cwa_chat_reply_to_idx
  ON public.cwa_chat (reply_to)
  WHERE reply_to IS NOT NULL;

-- ── cwa_dm_chat (DMs) ───────────────────────────────────────
ALTER TABLE public.cwa_dm_chat
  ADD COLUMN IF NOT EXISTS reply_to       bigint,
  ADD COLUMN IF NOT EXISTS reactions      jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read_by        text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS image_urls     text[],
  ADD COLUMN IF NOT EXISTS thread_root_id bigint,
  ADD COLUMN IF NOT EXISTS pinned_at      timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by      text;

CREATE INDEX IF NOT EXISTS cwa_dm_chat_thread_idx
  ON public.cwa_dm_chat (thread_root_id)
  WHERE thread_root_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cwa_dm_chat_pinned_idx
  ON public.cwa_dm_chat (dm_group, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS cwa_dm_chat_reply_to_idx
  ON public.cwa_dm_chat (reply_to)
  WHERE reply_to IS NOT NULL;

-- ============================================================
-- Verify
-- ============================================================
-- SELECT column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name IN ('cwa_chat','cwa_dm_chat')
-- ORDER BY table_name, ordinal_position;

-- ============================================================
-- Rollback (only if you really want to undo)
-- ============================================================
-- ALTER TABLE public.cwa_chat
--   DROP COLUMN IF EXISTS reply_to,
--   DROP COLUMN IF EXISTS reactions,
--   DROP COLUMN IF EXISTS read_by,
--   DROP COLUMN IF EXISTS image_urls,
--   DROP COLUMN IF EXISTS thread_root_id,
--   DROP COLUMN IF EXISTS pinned_at,
--   DROP COLUMN IF EXISTS pinned_by,
--   DROP COLUMN IF EXISTS company;
-- ALTER TABLE public.cwa_dm_chat
--   DROP COLUMN IF EXISTS reply_to,
--   DROP COLUMN IF EXISTS reactions,
--   DROP COLUMN IF EXISTS read_by,
--   DROP COLUMN IF EXISTS image_urls,
--   DROP COLUMN IF EXISTS thread_root_id,
--   DROP COLUMN IF EXISTS pinned_at,
--   DROP COLUMN IF EXISTS pinned_by;
