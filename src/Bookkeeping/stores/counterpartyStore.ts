// Counterparty store — customers + vendors per entity.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Counterparty } from "../types/counterparty";

interface State {
  counterparties: Counterparty[];
  upsert: (c: Counterparty) => void;
  archive: (id: string) => void;
}

export const useCounterparties = create<State>()(
  persist(
    (set) => ({
      counterparties: [],
      upsert: (c) =>
        set((s) => {
          const idx = s.counterparties.findIndex((x) => x.id === c.id);
          const counterparties =
            idx >= 0
              ? [...s.counterparties.slice(0, idx), c, ...s.counterparties.slice(idx + 1)]
              : [...s.counterparties, c];
          return { counterparties };
        }),
      archive: (id) =>
        set((s) => ({
          counterparties: s.counterparties.map((c) =>
            c.id === id ? { ...c, archivedAt: new Date().toISOString() } : c,
          ),
        })),
    }),
    { name: "bookkeeping.counterparties" },
  ),
);

export function selectCounterparties(entityId: string): Counterparty[] {
  return useCounterparties
    .getState()
    .counterparties.filter((c) => c.entityId === entityId && !c.archivedAt)
    .sort((a, b) => a.name.localeCompare(b.name));
}
