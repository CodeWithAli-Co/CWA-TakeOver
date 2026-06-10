/**
 * scan.ts — the live repo scan, produced by scripts/observatory-audit.mjs and
 * refreshed on every app launch by the Vite plugin (see vite.config.ts). The
 * manifest is the curated narrative; this is the raw, always-current truth.
 */
import scanJson from "../data/scan.json";
import historyJson from "../data/scan-history.json";

export interface ScanSummary {
  bundledSecrets: number;
  localStorageKeys: number;
  localStorageSecretKeys: number;
  routes: number;
  routesNoRealAuth: number;
  serviceRoleRoutes: number;
  migrationsTables: number;
  anonReadableTables: number;
  customStorageAdapter: boolean;
  hardcodedSecrets?: number;
  envCommitted?: boolean;
  dangerousTauriCaps?: number;
  webhookGaps?: number;
  corsWildcards?: number;
}
export interface ScanRoute { path: string; methods: string[]; auth: string; realAuth: boolean; serviceRole: boolean; file: string }
export interface Scan {
  generatedAt: string;
  repos: { cwa: string; b2b: string | null };
  summary: ScanSummary;
  bundledSecrets: { name: string; file: string; line: number; bundled: boolean; secret: boolean }[];
  localStorage: { key: string; file: string; line: number; secret: boolean }[];
  supabaseStorage: { found: boolean; file?: string; customStorageAdapter?: boolean; persistSession?: boolean };
  routes: ScanRoute[];
  migrations: { table: string; file: string; rls: string; anonReadable: boolean }[];
  drift?: ScanDrift | null;
}

export interface ScanDrift {
  since: string;
  routes: { added: string[]; removed: string[] };
  newUnauthRoutes: string[];
  bundledSecrets: { added: string[]; removed: string[] };
  localStorage: { added: string[]; removed: string[] };
  anonReadable: { added: string[]; removed: string[] };
}
export interface ScanSnapshot { generatedAt: string; summary: ScanSummary }

export const scan = scanJson as unknown as Scan;

export function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (isNaN(ms)) return "unknown";
  const s = Math.floor(ms / 1000);
  if (s < 45) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const scanHistory = historyJson as unknown as ScanSnapshot[];

/** Letter grade for a 0-100 posture score. */
export function grade(score: number): string {
  return score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
}

/** A single "exposure" index (lower = safer) for trend tracking. */
export function exposureIndex(s: ScanSummary): number {
  return s.bundledSecrets * 2 + s.routesNoRealAuth + s.anonReadableTables * 2 + (s.customStorageAdapter ? 0 : 2) + (s.localStorageSecretKeys || 0) + (s.hardcodedSecrets || 0) * 3 + (s.envCommitted ? 4 : 0) + (s.dangerousTauriCaps || 0) + (s.webhookGaps || 0) + (s.corsWildcards || 0);
}

export function exposureSeries(): number[] {
  const pts = scanHistory.map((h) => exposureIndex(h.summary));
  return pts.length ? pts : [exposureIndex(scan.summary)];
}
