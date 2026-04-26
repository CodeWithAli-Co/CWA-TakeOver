// Period store — fiscal periods per entity, with lock state.
// Periods are month-aligned by default (one per calendar month).

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FiscalPeriod } from "../types/entity";

interface State {
  periods: FiscalPeriod[];
  upsert: (p: FiscalPeriod) => void;
  setStatus: (id: string, status: FiscalPeriod["status"], actor?: string) => void;
}

export const usePeriods = create<State>()(
  persist(
    (set) => ({
      periods: [],
      upsert: (p) =>
        set((s) => {
          const idx = s.periods.findIndex((x) => x.id === p.id);
          const periods =
            idx >= 0
              ? [...s.periods.slice(0, idx), p, ...s.periods.slice(idx + 1)]
              : [...s.periods, p];
          return { periods };
        }),
      setStatus: (id, status, actor) =>
        set((s) => ({
          periods: s.periods.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status,
                  closedBy: status === "locked" ? actor ?? p.closedBy : p.closedBy,
                  closedAt: status === "locked" ? new Date().toISOString() : p.closedAt,
                }
              : p,
          ),
        })),
    }),
    { name: "bookkeeping.periods" },
  ),
);

export function selectPeriods(entityId: string): FiscalPeriod[] {
  return usePeriods
    .getState()
    .periods.filter((p) => p.entityId === entityId)
    .sort((a, b) => b.start.localeCompare(a.start));
}
