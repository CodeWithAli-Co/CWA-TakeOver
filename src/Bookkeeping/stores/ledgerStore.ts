// Zustand-backed implementation of LedgerStore. Holds accounts,
// journal entries, journal lines, audit log all in client memory.
// Persists to localStorage so a refresh doesn't lose work in
// progress. When Supabase backing comes online, swap the storage
// layer here without touching the engine or UI.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GLAccount } from "../types/coa";
import type { JournalEntry, JournalLine } from "../types/journal";
import type { LedgerStore } from "../engine/ledger";
import { SEED_ENTITIES, seedEntityChartOfAccounts } from "../data/seedEntities";

export interface AuditEntry {
  id: string;
  entityId: string;
  actor: string;
  action: string;
  targetTable: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
  at: string;
}

interface LedgerData {
  /** All postable + non-postable accounts across every entity. */
  accounts: GLAccount[];
  entries: JournalEntry[];
  lines: JournalLine[];
  audit: AuditEntry[];
}

interface LedgerActions {
  upsertEntry: (entry: JournalEntry) => void;
  insertLines: (lines: JournalLine[]) => void;
  appendAudit: (audit: AuditEntry) => void;
  resetAccountsForSeed: () => void;
  /** Reset everything back to seeded CoA + no entries. Useful in dev. */
  hardReset: () => void;
}

const SEED_ACCOUNTS = (() =>
  SEED_ENTITIES.flatMap((e) => seedEntityChartOfAccounts(e)))();

export const useLedgerData = create<LedgerData & LedgerActions>()(
  persist(
    (set) => ({
      accounts: SEED_ACCOUNTS,
      entries: [],
      lines: [],
      audit: [],

      upsertEntry: (entry) =>
        set((s) => {
          const idx = s.entries.findIndex((e) => e.id === entry.id);
          const entries =
            idx >= 0
              ? [...s.entries.slice(0, idx), entry, ...s.entries.slice(idx + 1)]
              : [...s.entries, entry];
          return { entries };
        }),

      insertLines: (newLines) =>
        set((s) => ({ lines: [...s.lines, ...newLines] })),

      appendAudit: (audit) =>
        set((s) => ({ audit: [...s.audit, audit] })),

      resetAccountsForSeed: () =>
        set(() => ({ accounts: SEED_ACCOUNTS })),

      hardReset: () =>
        set(() => ({
          accounts: SEED_ACCOUNTS,
          entries: [],
          lines: [],
          audit: [],
        })),
    }),
    { name: "bookkeeping.ledger" },
  ),
);

/** LedgerStore adapter that fronts the Zustand store — what
 *  engine/ledger.ts depends on. Async signatures match the
 *  eventual Supabase RPC shape so swapping layers is trivial. */
export const memoryLedgerStore: LedgerStore = {
  async insertEntry(entry) {
    useLedgerData.getState().upsertEntry(entry);
  },
  async insertLines(lines) {
    useLedgerData.getState().insertLines(lines);
  },
  async getEntry(entryId) {
    return useLedgerData.getState().entries.find((e) => e.id === entryId) ?? null;
  },
  async getLines(entryId) {
    return useLedgerData.getState().lines.filter((l) => l.entryId === entryId);
  },
  async recordAudit(args) {
    useLedgerData.getState().appendAudit({
      id: `audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      entityId: args.entityId,
      actor: args.actor,
      action: args.action,
      targetTable: args.targetTable,
      targetId: args.targetId,
      before: args.before,
      after: args.after,
      at: new Date().toISOString(),
    });
  },
};

/** ID generator used when posting from the UI. Replaceable for tests. */
export function newId(prefix: string = ""): string {
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Convenience selectors used by views — keep consumers tiny.

/** Accounts for a single entity, sorted by code. */
export function selectAccountsForEntity(entityId: string): GLAccount[] {
  const all = useLedgerData.getState().accounts;
  return all
    .filter((a) => a.entityId === entityId)
    .sort((a, b) => a.code.localeCompare(b.code));
}

/** Most-recent entries first, optionally filtered by entity. */
export function selectEntries(entityId?: string): JournalEntry[] {
  const all = useLedgerData.getState().entries;
  const filtered = entityId
    ? all.filter((e) => e.entityId === entityId)
    : all;
  return filtered
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

export function selectLinesForEntry(entryId: string): JournalLine[] {
  return useLedgerData.getState().lines.filter((l) => l.entryId === entryId);
}
