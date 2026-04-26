// ImportedTransaction store — raw events from Stripe + Plaid that
// haven't been turned into JEs yet. Lives in localStorage so a refresh
// preserves the inbox.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ImportedTransaction, ImportedTxStatus } from "../types/source";

interface State {
  imported: ImportedTransaction[];
  upsertMany: (txs: ImportedTransaction[]) => void;
  setStatus: (id: string, status: ImportedTxStatus, matchedEntryId?: string) => void;
  remove: (id: string) => void;
}

export const useImportedTx = create<State>()(
  persist(
    (set) => ({
      imported: [],
      upsertMany: (txs) =>
        set((s) => {
          const bySourceId = new Map(s.imported.map((t) => [`${t.source}:${t.sourceId}`, t]));
          for (const t of txs) bySourceId.set(`${t.source}:${t.sourceId}`, t);
          return { imported: Array.from(bySourceId.values()) };
        }),
      setStatus: (id, status, matchedEntryId) =>
        set((s) => ({
          imported: s.imported.map((t) =>
            t.id === id ? { ...t, status, matchedEntryId } : t,
          ),
        })),
      remove: (id) =>
        set((s) => ({ imported: s.imported.filter((t) => t.id !== id) })),
    }),
    { name: "bookkeeping.importedTx" },
  ),
);

export function selectPendingForEntity(entityId: string): ImportedTransaction[] {
  return useImportedTx
    .getState()
    .imported.filter((t) => t.entityId === entityId && t.status === "pending")
    .sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
