-- ============================================================
-- Migration: Chat webhooks
-- ============================================================
-- Each row maps a token → channel. External services POST to your
-- webhook-server.ts with that token + a message body, the server
-- looks up the row and inserts a chat message into the mapped channel.
--
-- RLS is set up so:
--   · admins (CEO/COO/CFO/Admin) can create + view + delete tokens
--   · the service role can SELECT (for the webhook server to look up)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_webhooks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token        text UNIQUE NOT NULL,
  group_name   text NOT NULL,
  table_name   text NOT NULL CHECK (table_name IN ('cwa_chat','cwa_dm_chat')),
  label        text,
  bot_name     text DEFAULT 'Bot',
  bot_avatar   text,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  active       boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS chat_webhooks_token_idx
  ON public.chat_webhooks (token) WHERE active;
CREATE INDEX IF NOT EXISTS chat_webhooks_group_idx
  ON public.chat_webhooks (group_name);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.chat_webhooks ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage. Tied to app_users.role like the roadmap policies.
CREATE OR REPLACE FUNCTION public.is_chat_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users
    WHERE supa_id = auth.uid()
      AND role IN ('CEO','COO','CFO','Admin')
  );
$$;

DROP POLICY IF EXISTS "chat_webhooks_admin_all" ON public.chat_webhooks;
CREATE POLICY "chat_webhooks_admin_all" ON public.chat_webhooks
  FOR ALL TO authenticated
  USING (public.is_chat_admin())
  WITH CHECK (public.is_chat_admin());

-- ============================================================
-- Server-side note (NOT executed by SQL):
--
-- Add this Express handler to webhook-server.ts:
--
--   app.post("/webhooks/chat/:token", async (req, res) => {
--     const { token } = req.params;
--     const { sender, message, image_urls } = req.body || {};
--     if (!message && !image_urls?.length) {
--       return res.status(400).send({ error: "message required" });
--     }
--     const { data: hook } = await supabase
--       .from("chat_webhooks").select("*").eq("token", token).eq("active", true).single();
--     if (!hook) return res.status(404).send({ error: "invalid token" });
--     const payload = {
--       sent_by: sender || hook.bot_name || "Bot",
--       message: String(message || ""),
--       userAvatar: hook.bot_avatar || null,
--       reactions: {},
--       read_by: [],
--       image_urls: image_urls || null,
--       company: "CodeWithAli",
--       ...(hook.table_name === "cwa_dm_chat" ? { dm_group: hook.group_name } : {}),
--     };
--     const { error } = await supabase.from(hook.table_name).insert(payload);
--     if (error) return res.status(500).send({ error: error.message });
--     await supabase.from("chat_webhooks").update({ last_used_at: new Date().toISOString() })
--       .eq("id", hook.id);
--     res.send({ ok: true });
--   });
-- ============================================================

-- Rollback:
-- DROP TABLE IF EXISTS public.chat_webhooks CASCADE;
-- DROP FUNCTION IF EXISTS public.is_chat_admin();
