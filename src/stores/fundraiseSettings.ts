/**
 * fundraiseSettings.ts — Supabase hooks for the Fundraise module's
 * per-operator settings (pitch text, signature, defaults).
 *
 * Architecturally simple: one row per operator (keyed by supa_id),
 * upsert-on-save semantics, RLS-gated so each operator only sees
 * their own row. The Axon draft action and the cadence engine read
 * from here so the operator only configures their pitch once.
 *
 * Schema lives in migrations/fundraise_settings.sql.
 */

import { useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";

const TABLE = "fundraise_settings";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface FundraiseSettings {
  supa_id: string;
  founder_name: string | null;
  founder_email_signature_md: string | null;
  pitch_md: string | null;
  one_pager_md: string | null;
  default_send_alias: string | null;
  default_call_link: string | null;
  followup_days_first: number;
  followup_days_second: number;
  followup_days_third: number;
  created_at: string;
  updated_at: string;
}

/** What the modal sends to upsert. Everything optional except the
 *  supa_id which we fill from the auth session, not the form. */
export type FundraiseSettingsPatch = Partial<
  Omit<FundraiseSettings, "supa_id" | "created_at" | "updated_at">
>;

// ─────────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────────
export const fundraiseSettingsKeys = {
  all: ["fundraiseSettings"] as const,
  mine: () => ["fundraiseSettings", "mine"] as const,
};

// ─────────────────────────────────────────────────────────────────
// Read: my settings (returns null if no row yet — first-time user)
// ─────────────────────────────────────────────────────────────────
export function useMyFundraiseSettings() {
  return useQuery({
    queryKey: fundraiseSettingsKeys.mine(),
    queryFn: async (): Promise<FundraiseSettings | null> => {
      // We don't need to filter by supa_id manually -- RLS does that
      // for us. `maybeSingle()` returns null for "no row" instead of
      // throwing, which is exactly what the first-time-open UX wants.
      const { data, error } = await companySupabase
        .from(TABLE)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return (data as FundraiseSettings | null) ?? null;
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Write: upsert
// ─────────────────────────────────────────────────────────────────
/** Upsert the current operator's settings row. If no row exists,
 *  insert; otherwise update. We grab supa_id from the auth session
 *  rather than trusting the caller -- prevents accidentally writing
 *  to another operator's row even with bad client code. */
export function useUpsertFundraiseSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      patch: FundraiseSettingsPatch,
    ): Promise<FundraiseSettings> => {
      const { data: sessionRes } = await companySupabase.auth.getSession();
      const supaId = sessionRes.session?.user.id;
      if (!supaId) {
        throw new Error(
          "No active Supabase session — can't save fundraise settings.",
        );
      }
      const { data, error } = await companySupabase
        .from(TABLE)
        .upsert({ supa_id: supaId, ...patch }, { onConflict: "supa_id" })
        .select("*")
        .single();
      if (error) throw error;
      return data as FundraiseSettings;
    },
    onSuccess: (row) => {
      qc.setQueryData(fundraiseSettingsKeys.mine(), row);
    },
  });
}

// ─────────────────────────────────────────────────────────────────
// Convenience: hard-block the draft action if settings aren't set
// ─────────────────────────────────────────────────────────────────
/** Returns true if the operator has at least pitch_md + founder_name
 *  populated. Axon can still draft without these, but the result is
 *  generic; the UI uses this signal to nudge "configure pitch first"
 *  before letting the operator hit Draft. */
export function isFundraiseSettingsUsable(
  s: FundraiseSettings | null | undefined,
): boolean {
  if (!s) return false;
  return !!(s.pitch_md?.trim() && s.founder_name?.trim());
}

// ─────────────────────────────────────────────────────────────────
// Realtime — nice but optional; keeps Settings modal in sync if the
// operator edits from another tab.
// ─────────────────────────────────────────────────────────────────
export function useFundraiseSettingsRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = companySupabase
      .channel("fundraise_settings_changes")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: TABLE },
        () => {
          qc.invalidateQueries({ queryKey: fundraiseSettingsKeys.all });
        },
      )
      .subscribe();
    return () => {
      companySupabase.removeChannel(channel);
    };
  }, [qc]);
}
