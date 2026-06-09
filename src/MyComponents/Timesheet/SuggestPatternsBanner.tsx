/**
 * SuggestPatternsBanner.tsx — Detects a stable weekly pattern for the
 * current scope and offers to apply it to the visible week.
 *
 * Trigger conditions (all must hold):
 *   - The visible week has fewer than 3 concrete shifts for the
 *     in-scope user(s). (Don't pester operators with a half-filled week.)
 *   - History from the last 4 weeks reveals at least one stable
 *     pattern per the detector's threshold.
 *   - The operator hasn't already dismissed this week's suggestion.
 *
 * Apply → bulk-inserts the patterns as `status: scheduled` shifts via a
 * single Supabase batch. Dismiss → persists per-week-per-scope to
 * localStorage so the banner doesn't nag.
 *
 * Pure derivation of state from props — the parent (TimesheetPage)
 * passes the already-visible shifts and the previous-window query is
 * mounted here under a separate TanStack key so we don't pollute the
 * grid cache.
 */

import { useMemo, useState } from "react";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";
import {
  detectPatterns,
  groupPatternsByUser,
  patternsToShifts,
  describePatternSet,
} from "@/stores/shiftPatterns";
import { useCompanyFilter } from "@/stores/store";
import { shiftKeys } from "@/stores/shifts";
import type { Shift } from "@/stores/shiftTypes";

interface Props {
  weekStart: Date;
  /** Shifts currently rendered in the grid (used to gate the trigger). */
  visibleShifts: Shift[];
  /** Single user to detect for; null = team-wide. */
  scopeUserId: string | null;
  /** For the localStorage dismiss key. */
  scopeLabel: string;
}

const LOOKBACK_WEEKS = 4;
const HISTORY_QUERY_LIMIT = 200;
const MIN_VISIBLE_SHIFTS_TO_SKIP = 3;

export function SuggestPatternsBanner({ weekStart, visibleShifts, scopeUserId, scopeLabel }: Props) {
  const qc = useQueryClient();
  const { activeCompany } = useCompanyFilter();
  const dismissKey = `cwa:patterns:dismissed:${scopeLabel}:${weekStart.toISOString().split("T")[0]}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "1"; } catch { return false; }
  });

  // Gate: skip the suggestion if the week already has a meaningful
  // number of concrete shifts (anything not virtual + not cancelled).
  const concreteCount = useMemo(
    () => visibleShifts.filter((s) => !s.recurrence_parent_id && s.status !== "cancelled").length,
    [visibleShifts],
  );

  const shouldFetchHistory = !dismissed && concreteCount < MIN_VISIBLE_SHIFTS_TO_SKIP;

  // Pull last N weeks of history for the scope.
  const historyFrom = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - LOOKBACK_WEEKS * 7);
    return d;
  }, [weekStart]);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["shifts", "pattern-history", scopeUserId ?? "all", activeCompany, historyFrom.toISOString(), weekStart.toISOString()],
    enabled: shouldFetchHistory,
    queryFn: async (): Promise<Shift[]> => {
      let q = companySupabase
        .from("shifts")
        .select("*")
        .gte("starts_at", historyFrom.toISOString())
        .lt("starts_at", weekStart.toISOString())
        .is("recurrence", null)
        .neq("status", "cancelled")
        .limit(HISTORY_QUERY_LIMIT);
      if (scopeUserId) q = q.eq("user_supa_id", scopeUserId);
      if (activeCompany !== "all") {
        q = q.eq("company", activeCompany === "simplicityFunds" ? "simplicity" : "CodeWithAli");
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Shift[];
    },
  });

  const patterns = useMemo(
    () => detectPatterns(history, { lookbackWeeks: LOOKBACK_WEEKS, userSupaId: scopeUserId ?? undefined }),
    [history, scopeUserId],
  );

  const grouped = useMemo(() => groupPatternsByUser(patterns), [patterns]);

  const applyMut = useMutation({
    mutationFn: async (): Promise<number> => {
      const company = activeCompany === "simplicityFunds" ? "simplicity" : "CodeWithAli";
      const { data: auth } = await companySupabase.auth.getUser();
      const rows = patternsToShifts(patterns, weekStart, visibleShifts, { company });
      if (rows.length === 0) return 0;
      const payload = rows.map((r) => ({
        ...r,
        company,
        is_billable: true,
        created_by: auth.user?.id ?? null,
      }));
      const { error, data } = await companySupabase.from("shifts").insert(payload).select("id");
      if (error) throw error;
      return data?.length ?? rows.length;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
      handleDismiss();
    },
  });

  const handleDismiss = () => {
    try { localStorage.setItem(dismissKey, "1"); } catch { /* no-op */ }
    setDismissed(true);
  };

  if (!shouldFetchHistory || isLoading || patterns.length === 0) return null;

  // Render one row per user when team-wide; one card when scoped to a person.
  const userIds = Array.from(grouped.keys());
  const renderSingleUser = userIds.length === 1;

  return (
    <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="shrink-0 rounded-md bg-sky-500/15 p-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-sky-200">
            Stable pattern detected
          </p>
          {renderSingleUser ? (
            <p className="text-[13px] text-foreground/90 leading-tight mt-0.5">
              <span className="font-semibold">{grouped.get(userIds[0]!)![0]!.username}</span>{" "}
              usually works{" "}
              <span className="font-mono tabular-nums text-sky-200">
                {describePatternSet(grouped.get(userIds[0]!)!)}
              </span>{" "}
              <span className="text-muted-foreground">
                ({grouped.get(userIds[0]!)![0]!.occurrences}/{LOOKBACK_WEEKS} of the last weeks)
              </span>
            </p>
          ) : (
            <p className="text-[13px] text-foreground/90 leading-tight mt-0.5">
              Found stable patterns for{" "}
              <span className="font-semibold">{userIds.length} teammates</span>{" "}
              <span className="text-muted-foreground">over the last {LOOKBACK_WEEKS} weeks</span>
            </p>
          )}
          {!renderSingleUser && (
            <ul className="mt-1 space-y-0.5">
              {userIds.slice(0, 4).map((uid) => {
                const ps = grouped.get(uid)!;
                return (
                  <li key={uid} className="text-[11.5px] text-muted-foreground truncate">
                    · <span className="text-foreground/80 font-semibold">{ps[0]!.username}</span>{" "}
                    <span className="font-mono tabular-nums">{describePatternSet(ps)}</span>
                  </li>
                );
              })}
              {userIds.length > 4 && (
                <li className="text-[11px] text-muted-foreground/70">…and {userIds.length - 4} more</li>
              )}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => applyMut.mutate()}
            disabled={applyMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 text-white px-3 h-7 text-[11px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ boxShadow: "0 4px 12px -2px rgba(14,165,233,0.45)" }}
          >
            {applyMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            Apply to this week
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="inline-flex items-center justify-center rounded-md border border-border-strong px-2 h-7 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
      {applyMut.isError && (
        <p className="text-[11px] text-amber-300 px-4 pb-2">
          Couldn't apply: {(applyMut.error as Error).message}
        </p>
      )}
    </div>
  );
}
