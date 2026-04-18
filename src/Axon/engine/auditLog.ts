// ───────────────────────────────────────────────────────────────────
// Persistent audit log — every mutating action AXON runs is recorded
// to localStorage with timestamp, params, and result. Survives reload.
// Capped to AUDIT_MAX_ENTRIES (oldest rolled off).
// ───────────────────────────────────────────────────────────────────

import { AUDIT_MAX_ENTRIES, AXON_AUDIT_KEY } from "../config";

export interface AuditEntry {
  id: string;
  actionName: string;
  params: Record<string, unknown>;
  summary: string;
  success: boolean;
  error?: string;
  operator: string;
  activeCompany: string;
  timestamp: number;
  /** True if this was a dry-run (no actual mutation). */
  dryRun?: boolean;
  /** True if undoable and was undone. */
  undone?: boolean;
}

function load(): AuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(AXON_AUDIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AuditEntry[];
  } catch {
    return [];
  }
}

function save(entries: AuditEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AXON_AUDIT_KEY, JSON.stringify(entries));
  } catch {
    /* quota exceeded etc. — drop silently */
  }
}

export function appendAudit(entry: Omit<AuditEntry, "id" | "timestamp">): AuditEntry {
  const all = load();
  const full: AuditEntry = {
    ...entry,
    id: `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    timestamp: Date.now(),
  };
  all.push(full);
  while (all.length > AUDIT_MAX_ENTRIES) all.shift();
  save(all);
  return full;
}

export function listAudit(opts?: { limit?: number }): AuditEntry[] {
  const all = load();
  const limit = opts?.limit ?? 100;
  return all.slice(-limit).reverse();
}

export function markAuditUndone(id: string) {
  const all = load();
  const found = all.find((e) => e.id === id);
  if (found) {
    found.undone = true;
    save(all);
  }
}

export function clearAudit() {
  save([]);
}
