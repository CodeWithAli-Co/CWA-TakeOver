// ReconciliationRule store — categorization rules per entity.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ReconciliationRule } from "../types/source";

interface State {
  rules: ReconciliationRule[];
  upsert: (r: ReconciliationRule) => void;
  remove: (id: string) => void;
  bumpHit: (id: string) => void;
}

export const useReconciliationRules = create<State>()(
  persist(
    (set) => ({
      rules: [],
      upsert: (r) =>
        set((s) => {
          const idx = s.rules.findIndex((x) => x.id === r.id);
          const rules =
            idx >= 0
              ? [...s.rules.slice(0, idx), r, ...s.rules.slice(idx + 1)]
              : [...s.rules, r];
          return { rules };
        }),
      remove: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
      bumpHit: (id) =>
        set((s) => ({
          rules: s.rules.map((r) =>
            r.id === id ? { ...r, hitCount: r.hitCount + 1 } : r,
          ),
        })),
    }),
    { name: "bookkeeping.reconciliationRules" },
  ),
);

export function selectRulesForEntity(entityId: string): ReconciliationRule[] {
  return useReconciliationRules
    .getState()
    .rules.filter((r) => r.entityId === entityId)
    .sort((a, b) => a.priority - b.priority);
}
