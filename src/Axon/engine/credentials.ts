// ───────────────────────────────────────────────────────────────────
// Credentials store — keyed secrets for AXON's outbound integrations.
//
// Lives in localStorage under `axon:credentials:v1`. Acceptable for a
// Tauri desktop app where the renderer's storage is local-only and
// admin-gated; if this code ever ships as a public web build the store
// should be moved server-side behind a proxy.
//
// Examples of what's stored:
//   · webhook URLs (Discord, Slack, generic POST endpoints)
//   · API tokens (GitHub PAT, custom service keys)
//   · simple per-key flags / config blobs
//
// API surface is intentionally minimal: get, set, forget, list.
// All keys are namespaced lowercase strings the operator names — e.g.
// "discord:announcements", "github:pat", "webhook:zapier-tasks".
// ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "axon:credentials:v1";

export interface Credential {
  /** Operator-chosen identifier. Conventionally `<kind>:<label>`. */
  key: string;
  /** The actual secret/URL/token. */
  value: string;
  /** Optional human note ("My personal Discord", "CWA Github bot"). */
  note?: string;
  /** Created/updated timestamps for housekeeping. */
  createdAt: number;
  updatedAt: number;
}

type Store = Record<string, Credential>;

function load(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function save(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    if (typeof console !== "undefined") {
      console.warn("[AXON] credentials persist failed:", err);
    }
  }
}

/** Look up a credential value by key. Returns null if not set. */
export function getCredential(key: string): Credential | null {
  const store = load();
  return store[key] ?? null;
}

/** Save / update a credential. Updates `updatedAt` on every set. */
export function setCredential(
  key: string,
  value: string,
  note?: string,
): Credential {
  const store = load();
  const now = Date.now();
  const existing = store[key];
  const cred: Credential = {
    key,
    value,
    note: note ?? existing?.note,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  store[key] = cred;
  save(store);
  return cred;
}

/** Remove a credential. Returns true if something was removed. */
export function forgetCredential(key: string): boolean {
  const store = load();
  if (!(key in store)) return false;
  delete store[key];
  save(store);
  return true;
}

/** List all credential keys. Optionally filter by prefix (e.g. "discord:"). */
export function listCredentials(prefix?: string): Credential[] {
  const store = load();
  const all = Object.values(store);
  if (!prefix) return all;
  return all.filter((c) => c.key.startsWith(prefix));
}

/** Convenience getter that returns just the value, or null. */
export function getCredentialValue(key: string): string | null {
  return getCredential(key)?.value ?? null;
}
