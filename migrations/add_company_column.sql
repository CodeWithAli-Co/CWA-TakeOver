-- ============================================================
-- Migration: Add `company` column to all company-scoped tables
-- ============================================================
-- Run this in your Supabase SQL editor before using the new
-- company-scoped data isolation features.
--
-- Each table gets a TEXT column with default 'CodeWithAli'
-- so all existing rows are auto-tagged as CWA data.
-- New inserts from the app set this field automatically based
-- on the active company toggle.
--
-- Allowed values: 'CodeWithAli' | 'simplicity'
-- ============================================================

-- Todos
ALTER TABLE cwa_todos
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Meetings
ALTER TABLE cwa_meetings
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Credentials
ALTER TABLE cwa_creds
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Chat (group)
ALTER TABLE cwa_chat
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Chat (DM)
ALTER TABLE cwa_dm_chat
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- DM groups
ALTER TABLE dm_groups
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Weekly Quotas
ALTER TABLE weekly_quotas
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- Time tracking
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

ALTER TABLE time_entry_templates
  ADD COLUMN IF NOT EXISTS company TEXT DEFAULT 'CodeWithAli';

-- ============================================================
-- Optional: indexes for fast company filtering
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_cwa_todos_company       ON cwa_todos(company);
CREATE INDEX IF NOT EXISTS idx_cwa_meetings_company    ON cwa_meetings(company);
CREATE INDEX IF NOT EXISTS idx_cwa_creds_company       ON cwa_creds(company);
CREATE INDEX IF NOT EXISTS idx_cwa_chat_company        ON cwa_chat(company);
CREATE INDEX IF NOT EXISTS idx_cwa_dm_chat_company     ON cwa_dm_chat(company);
CREATE INDEX IF NOT EXISTS idx_dm_groups_company       ON dm_groups(company);
CREATE INDEX IF NOT EXISTS idx_clients_company         ON clients(company);
CREATE INDEX IF NOT EXISTS idx_invoices_company        ON invoices(company);
CREATE INDEX IF NOT EXISTS idx_weekly_quotas_company   ON weekly_quotas(company);
CREATE INDEX IF NOT EXISTS idx_time_entries_company    ON time_entries(company);
CREATE INDEX IF NOT EXISTS idx_time_templates_company  ON time_entry_templates(company);

-- ============================================================
-- Optional: enforce only valid values via CHECK constraints
-- ============================================================
-- Uncomment if you want strict enforcement at the DB layer:
--
-- ALTER TABLE cwa_todos      ADD CONSTRAINT cwa_todos_company_check      CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE cwa_meetings   ADD CONSTRAINT cwa_meetings_company_check   CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE cwa_creds      ADD CONSTRAINT cwa_creds_company_check      CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE cwa_chat       ADD CONSTRAINT cwa_chat_company_check       CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE cwa_dm_chat    ADD CONSTRAINT cwa_dm_chat_company_check    CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE dm_groups      ADD CONSTRAINT dm_groups_company_check      CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE clients        ADD CONSTRAINT clients_company_check        CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE invoices       ADD CONSTRAINT invoices_company_check       CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE weekly_quotas  ADD CONSTRAINT weekly_quotas_company_check  CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE time_entries   ADD CONSTRAINT time_entries_company_check   CHECK (company IN ('CodeWithAli','simplicity'));
-- ALTER TABLE time_entry_templates ADD CONSTRAINT time_templates_company_check CHECK (company IN ('CodeWithAli','simplicity'));
