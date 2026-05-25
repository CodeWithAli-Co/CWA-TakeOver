/**
 * shifts.ts — Supabase query + mutation hooks for the unified shifts table.
 *
 * Used by both the calendar and the timesheet. The two surfaces filter the
 * same underlying rows differently: calendar shows starts_at/ends_at
 * (planned), timesheet shows clock_in/clock_out (actual).
 *
 * All range queries cover any shift whose [starts_at, ends_at] OVERLAPS
 * the requested window — not just shifts that *start* inside it — so
 * overnight shifts straddling Sunday→Monday show up in both weeks.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import supabase from "@/MyComponents/supabase";
import { useCompanyFilter } from "./store";
import type { Shift, ShiftCreate, ShiftUpdate } from "./shiftTypes";

const SHIFTS_TABLE = "shifts";

// ============================================================
// Query keys — centralized so mutations can invalidate cleanly.
// ============================================================
export const shiftKeys = {
  all:    ["shifts"] as const,
  range:  (from: string, to: string, scope: string) =>
            ["shifts", "range", from, to, scope] as const,
  user:   (userId: string, from: string, to: string) =>
            ["shifts", "user", userId, from, to] as const,
  active: (userId: string) =>
            ["shifts", "active", userId] as const,
};

function activeCompanyLabel(): "CodeWithAli" | "simplicity" {
  const raw = useCompanyFilter.getState().activeCompany;
  return raw === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

// ============================================================
// Reads
// ============================================================

/**
 * All shifts whose [starts_at, ends_at] overlaps [from, to].
 * Optionally filter to one user.
 */
export function useShiftsInRange(
  from: Date,
  to: Date,
  opts: { userSupaId?: string | null; enabled?: boolean } = {},
) {
  const { activeCompany } = useCompanyFilter();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const scope = `${activeCompany}::${opts.userSupaId ?? "all"}`;

  return useQuery({
    queryKey: shiftKeys.range(fromIso, toIso, scope),
    enabled: opts.enabled !== false,
    queryFn: async (): Promise<Shift[]> => {
      // Overlap predicate: starts_at <= to AND ends_at >= from
      let q = supabase
        .from(SHIFTS_TABLE)
        .select("*")
        .lte("starts_at", toIso)
        .gte("ends_at", fromIso)
        .order("starts_at", { ascending: true });

      if (opts.userSupaId) {
        q = q.eq("user_supa_id", opts.userSupaId);
      }
      if (activeCompany !== "all") {
        q = q.eq("company", activeCompanyLabel());
      }

      const { data, error } = await q;
      if (error) {
        // Surface the error code; the UI banner key-matches on this.
        const code = (error as any).code;
        const msg = code === "42P01"
          ? `Table does not exist (code 42P01): ${error.message}`
          : error.message;
        throw new Error(msg);
      }
      return (data ?? []) as Shift[];
    },
  });
}

/** The currently-active shift for a user (status = in_progress), or null. */
export function useActiveShift(userSupaId: string | null | undefined) {
  return useQuery({
    queryKey: shiftKeys.active(userSupaId ?? "none"),
    enabled: !!userSupaId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<Shift | null> => {
      const { data, error } = await supabase
        .from(SHIFTS_TABLE)
        .select("*")
        .eq("user_supa_id", userSupaId!)
        .eq("status", "in_progress")
        .order("clock_in", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as Shift) ?? null;
    },
  });
}

/**
 * The next upcoming scheduled shift for a user — used by the ClockBar
 * to show "Next: Tomorrow 9 AM" even when no shift is in progress.
 */
export function useNextShift(userSupaId: string | null | undefined) {
  return useQuery({
    queryKey: ["shifts", "next", userSupaId ?? "none"],
    enabled: !!userSupaId,
    refetchInterval: 60_000,
    queryFn: async (): Promise<Shift | null> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from(SHIFTS_TABLE)
        .select("*")
        .eq("user_supa_id", userSupaId!)
        .eq("status", "scheduled")
        .gte("ends_at", nowIso)
        .order("starts_at", { ascending: true })
        .limit(1);
      if (error) throw error;
      return (data?.[0] as Shift) ?? null;
    },
  });
}

// ============================================================
// Writes
// ============================================================

export function useCreateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ShiftCreate): Promise<Shift> => {
      const company = payload.company ?? activeCompanyLabel();
      const { data: auth } = await supabase.auth.getUser();
      const insert = {
        ...payload,
        company,
        status: payload.status ?? "scheduled",
        is_billable: payload.is_billable ?? true,
        created_by: auth.user?.id ?? null,
      };
      const { data, error } = await supabase
        .from(SHIFTS_TABLE)
        .insert(insert)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

export function useUpdateShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: ShiftUpdate): Promise<Shift> => {
      const { data, error } = await supabase
        .from(SHIFTS_TABLE)
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

export function useDeleteShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from(SHIFTS_TABLE)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/**
 * Clock in to a shift. DB trigger flips status → in_progress.
 * If no `shiftId` is provided, creates a fresh ad-hoc shift starting now.
 */
export function useClockIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      shiftId?: string;
      userSupaId: string;
      username: string;
    }): Promise<Shift> => {
      const now = new Date().toISOString();

      if (args.shiftId) {
        const { data, error } = await supabase
          .from(SHIFTS_TABLE)
          .update({ clock_in: now })
          .eq("id", args.shiftId)
          .select()
          .single();
        if (error) throw error;
        return data as Shift;
      }

      // No scheduled shift → create an ad-hoc one (4-hour default window).
      const plannedEnd = new Date(Date.now() + 4 * 3600_000).toISOString();
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from(SHIFTS_TABLE)
        .insert({
          user_supa_id: args.userSupaId,
          username: args.username,
          starts_at: now,
          ends_at: plannedEnd,
          clock_in: now,
          status: "in_progress",
          type: "shift",
          company: activeCompanyLabel(),
          created_by: auth.user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}

/** Clock out of an in-progress shift. DB trigger flips status → completed. */
export function useClockOut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (shiftId: string): Promise<Shift> => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from(SHIFTS_TABLE)
        .update({ clock_out: now, ends_at: now })
        .eq("id", shiftId)
        .select()
        .single();
      if (error) throw error;
      return data as Shift;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: shiftKeys.all });
    },
  });
}
