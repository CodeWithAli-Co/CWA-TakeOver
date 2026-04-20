// ────────────────────────────────────────────────────────────────
// CWA Registry — TypeScript types mirroring registry_init.sql.
//
// The registry replaces the old standalone cwa-registry Vercel
// project. One unified store for components + templates, scoped
// softly by company (cwa / simplicity / shared).
// ────────────────────────────────────────────────────────────────

export type RegistryKind = "component" | "template";

export type RegistryCompany = "cwa" | "simplicity" | "shared";

export interface RegistryItem {
  id: string;
  name: string;
  kind: RegistryKind;
  company: RegistryCompany;
  description: string | null;
  tags: string[];
  latestVersion: string | null;
  coverUrl: string | null;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  installCount: number;
}

/** Row shape from the `registry_items_with_latest` view — the
 *  gallery reads from this so we get latest-version data in one
 *  round trip. */
export interface RegistryItemWithLatest extends RegistryItem {
  latestVersionStr: string | null;
  latestStoragePath: string | null;
  latestSizeBytes: number | null;
  latestPublishedAt: string | null;
  latestPublishedBy: string | null;
}

export interface RegistryVersion {
  id: string;
  itemId: string;
  version: string;
  storagePath: string;
  sizeBytes: number | null;
  changelog: string | null;
  dependencies: Record<string, string>;
  publishedBy: string;
  publishedAt: string;
  yanked: boolean;
}

export interface RegistryInstall {
  id: string;
  itemId: string;
  version: string;
  installedBy: string;
  projectName: string | null;
  machineId: string | null;
  installedAt: string;
}

export interface RegistryToken {
  id: string;
  label: string;
  owner: string;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  scope: string;
}

/** What `cwa login` gets back once — raw token string, then gone. */
export interface RegistryTokenCreateResult {
  token: RegistryToken;
  /** Raw token string, shown exactly once. Format: `cwa_<hex>`. */
  rawToken: string;
}

// ── DB → TS row mappers ────────────────────────────────────────
// Supabase returns snake_case columns; normalize once here so the
// rest of the app lives in camelCase.

export function rowToItem(r: any): RegistryItem {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    company: r.company,
    description: r.description ?? null,
    tags: r.tags ?? [],
    latestVersion: r.latest_version ?? null,
    coverUrl: r.cover_url ?? null,
    metadata: r.metadata ?? {},
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    installCount: r.install_count ?? 0,
  };
}

export function rowToItemWithLatest(r: any): RegistryItemWithLatest {
  return {
    ...rowToItem(r),
    latestVersionStr: r.latest_version_str ?? null,
    latestStoragePath: r.latest_storage_path ?? null,
    latestSizeBytes: r.latest_size_bytes ?? null,
    latestPublishedAt: r.latest_published_at ?? null,
    latestPublishedBy: r.latest_published_by ?? null,
  };
}

export function rowToVersion(r: any): RegistryVersion {
  return {
    id: r.id,
    itemId: r.item_id,
    version: r.version,
    storagePath: r.storage_path,
    sizeBytes: r.size_bytes ?? null,
    changelog: r.changelog ?? null,
    dependencies: r.dependencies ?? {},
    publishedBy: r.published_by,
    publishedAt: r.published_at,
    yanked: r.yanked ?? false,
  };
}

export function rowToToken(r: any): RegistryToken {
  return {
    id: r.id,
    label: r.label,
    owner: r.owner,
    lastUsedAt: r.last_used_at ?? null,
    createdAt: r.created_at,
    expiresAt: r.expires_at ?? null,
    scope: r.scope ?? "full",
  };
}

// ── Semver helpers (minimal; no external dep) ──────────────────
// We accept any dotted-number version but provide a tiny comparator
// for "next bump" logic. Pre-release tags (1.0.0-rc.1) aren't
// supported yet — keep it simple.

export type Bump = "major" | "minor" | "patch";

export function parseVersion(v: string): [number, number, number] {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (!m) return [0, 0, 0];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function formatVersion([a, b, c]: [number, number, number]): string {
  return `${a}.${b}.${c}`;
}

export function bumpVersion(v: string, kind: Bump): string {
  const [a, b, c] = parseVersion(v);
  if (kind === "major") return formatVersion([a + 1, 0, 0]);
  if (kind === "minor") return formatVersion([a, b + 1, 0]);
  return formatVersion([a, b, c + 1]);
}

export function compareVersions(a: string, b: string): number {
  const [aa, ab, ac] = parseVersion(a);
  const [ba, bb, bc] = parseVersion(b);
  if (aa !== ba) return aa - ba;
  if (ab !== bb) return ab - bb;
  return ac - bc;
}
