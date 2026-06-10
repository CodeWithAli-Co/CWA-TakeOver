/**
 * triage.ts — the actionable layer over the (read-only) manifest.
 *
 * The manifest is ground truth from the last repo audit and shouldn't be hand
 * edited. But you and your backender need to WORK the findings: mark one
 * mitigated, accept a risk, assign an owner, set a target date. That live state
 * lives here, persisted locally, and is applied back onto the manifest at
 * runtime so every score/meter/filter reflects it instantly.
 *
 * Storage note: this is triage metadata (status/owner/date) — not secrets — so
 * localStorage is fine here. The findings ABOUT localStorage still stand.
 */
import { useSyncExternalStore } from "react";
import { manifest } from "../data/manifest";

export type FindingStatus = "open" | "mitigated" | "accepted";
export interface Triage { status?: FindingStatus; owner?: string; target?: string }

const LS_KEY = "obs:triage:v1";

// Remember each finding's audited baseline so overrides can be reverted.
const baseline: Record<string, FindingStatus> = {};
manifest.findings.forEach((f) => (baseline[f.id] = f.status));

function load(): Record<string, Triage> {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, Triage>) : {};
  } catch {
    return {};
  }
}

let store: Record<string, Triage> = load();

function persist() {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota/availability */
  }
}

/** Push triage status back onto the live manifest so scoring picks it up. */
function apply() {
  manifest.findings.forEach((f) => {
    f.status = store[f.id]?.status ?? baseline[f.id];
  });
}
apply();

// ── tiny external store so every tab + the masthead re-render on change ──
let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version += 1;
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const snapshot = () => version;

/** Subscribe a component to triage changes; returns a version that bumps on edit. */
export function useTriageVersion(): number {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export const triageOf = (id: string): Triage => store[id] ?? {};
export const baselineStatus = (id: string): FindingStatus => baseline[id];
export const effectiveStatus = (id: string): FindingStatus => store[id]?.status ?? baseline[id];
export const isTriaged = (id: string): boolean => {
  const t = store[id];
  if (!t) return false;
  const movedStatus = t.status !== undefined && t.status !== baseline[id];
  return !!(movedStatus || (t.owner && t.owner.trim()) || (t.target && t.target.trim()));
};

export function setTriage(id: string, patch: Triage) {
  const next: Triage = { ...store[id], ...patch };
  // prune empties so isTriaged stays honest
  if (next.owner !== undefined && !next.owner.trim()) delete next.owner;
  if (next.target !== undefined && !next.target.trim()) delete next.target;
  store[id] = next;
  apply();
  persist();
  emit();
}

export function resetTriage(id: string) {
  delete store[id];
  apply();
  persist();
  emit();
}

/** Count of findings whose status differs from the audited baseline. */
export function triagedCount(): number {
  return manifest.findings.filter((f) => effectiveStatus(f.id) !== baseline[f.id]).length;
}
