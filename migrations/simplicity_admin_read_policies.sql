-- ============================================================
-- Migration: Admin-read RLS policies for Simplicity database
-- ============================================================
-- Run this in the SIMPLICITY Supabase project's SQL editor
-- (NOT the CWA Supabase project).
--
-- Why: CWA-Manager connects to Simplicity using the anon key.
-- Existing policies only allow `authenticated` role, so the
-- desktop admin tool sees empty arrays from every table.
--
-- These policies grant SELECT to the `anon` role so the admin
-- dashboard can read all rows. INSERT/UPDATE/DELETE are NOT
-- granted — admin tool is read-only against Simplicity data.
--
-- If you'd rather use the service_role key instead, skip this
-- file and just set VITE_SIMPLICITY_SUPABASE_KEY to the
-- service_role key from Simplicity project settings.
-- ============================================================

-- ── users ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.users;
CREATE POLICY "Admin anon read"
  ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- ── expenses ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.expenses;
CREATE POLICY "Admin anon read"
  ON public.expenses
  FOR SELECT
  TO anon
  USING (true);

-- ── income_source ────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.income_source;
CREATE POLICY "Admin anon read"
  ON public.income_source
  FOR SELECT
  TO anon
  USING (true);

-- ── bank_accs ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.bank_accs;
CREATE POLICY "Admin anon read"
  ON public.bank_accs
  FOR SELECT
  TO anon
  USING (true);

-- ── cashflow ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.cashflow;
CREATE POLICY "Admin anon read"
  ON public.cashflow
  FOR SELECT
  TO anon
  USING (true);

-- ── financial_details ────────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.financial_details;
CREATE POLICY "Admin anon read"
  ON public.financial_details
  FOR SELECT
  TO anon
  USING (true);

-- ── stripe_subscriptions ─────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.stripe_subscriptions;
CREATE POLICY "Admin anon read"
  ON public.stripe_subscriptions
  FOR SELECT
  TO anon
  USING (true);

-- ── user_feedbacks ───────────────────────────────────────────
DROP POLICY IF EXISTS "Admin anon read" ON public.user_feedbacks;
CREATE POLICY "Admin anon read"
  ON public.user_feedbacks
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- Verify after running:
--   SELECT tablename, policyname, roles, cmd
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND policyname = 'Admin anon read'
--   ORDER BY tablename;
--
-- You should see 8 rows, all with roles = {anon} and cmd = SELECT.
-- ============================================================

-- ============================================================
-- ROLLBACK (if you ever need to undo):
-- ============================================================
-- DROP POLICY IF EXISTS "Admin anon read" ON public.users;
-- DROP POLICY IF EXISTS "Admin anon read" ON public.expenses;
-- DROP POLICY IF EXISTS "Admin anon read" ON public.income_source;
-- DROP POLICY IF EXISTS "Admin anon read" ON public.bank_accs;
-- DROP POLICY IF EXISTS "Admin anon read" ON public.cashflow;
-- DROP POLICY IF EXISTS "Admin anon read" ON public.financial_details;
-- DROP POLICY IF EXISTS "Admin anon read" ON public.stripe_subscriptions;
-- DROP POLICY IF EXISTS "Admin anon read" ON public.user_feedbacks;
