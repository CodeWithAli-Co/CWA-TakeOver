/**
 * scan.ts — the live repo scan, produced by scripts/observatory-audit.mjs and
 * refreshed on every app launch by the Vite plugin (see vite.config.ts). The
 * manifest is the curated narrative; this is the raw, always-current truth.
 */
import scanJson from "../data/scan.json";

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
}

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
