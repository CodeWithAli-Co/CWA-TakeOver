/**
 * stronghold.ts — encrypted on-disk vault wrapper for the
 * desktop app, backed by Tauri's tauri-plugin-stronghold.
 *
 * Used to remember which company this install is bound to
 * (so subsequent launches load the right per-tenant Supabase
 * credentials without asking the user again).
 *
 * Singleton, by design. Per Hanif's note: "The stronghold
 * should be initialized once and once alone." Stronghold's
 * vault file is locked while loaded, so multiple parallel
 * Stronghold.load(...) calls in the same process can race or
 * fight for the lock. We expose:
 *
 *   getStronghold() — returns the shared, already-init'd
 *     instance. Lazy-inits on first call, returns the cached
 *     instance every call after. Safe to call from anywhere.
 *
 *   TakeOverStronghold — the class itself, exported for typing
 *     and instanceof checks. Direct `new` is discouraged but
 *     allowed; callers who do it must `await instance.init()`.
 */

import { Client, Stronghold, Store } from "@tauri-apps/plugin-stronghold";
import { appDataDir } from "@tauri-apps/api/path";

const CLIENT_NAME = "TakeOver Systems";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export class TakeOverStronghold {
  // Both undefined until init() resolves. Methods other than
  // init() assume they're set — calling them before init() is
  // a programmer error.
  private stronghold: Stronghold | undefined;
  private store: Store | undefined;

  /** True once init() has succeeded. */
  public get ready(): boolean {
    return !!this.stronghold && !!this.store;
  }

  /**
   * Open the vault. Idempotent — calling twice is a no-op
   * after the first success.
   *
   * The vault password is fetched from the central TakeOver
   * site each call: ${VITE_TAKEOVER_SITE_URL}/api/takeover_creds
   * with header TakeOver-App: true. The endpoint also returns
   * the master Supabase anon key (used by supabase.ts).
   */
  public async init(): Promise<void> {
    if (this.ready) return;

    const vaultPath = `${await appDataDir()}/vault.hold`;
    const vaultPassword = await fetchVaultPassword();
    const stronghold = await Stronghold.load(vaultPath, vaultPassword);

    let client: Client;
    try {
      client = await stronghold.loadClient(CLIENT_NAME);
    } catch {
      client = await stronghold.createClient(CLIENT_NAME);
    }

    this.stronghold = stronghold;
    this.store = client.getStore();
    console.log("[stronghold] initialized");

    // 7-day cache invalidation. If the last_synced stamp is
    // older than a week, clear the bound-company record so the
    // user is forced through InitialOnboarding again and we
    // re-fetch fresh tenant credentials.
    await this.maybeInvalidateStale();
  }

  /** Read a string value by key. Returns undefined if missing. */
  public async getRecord(key: string): Promise<string | undefined> {
    this.assertReady();
    const raw = await this.store!.get(key);
    if (!raw || raw.length === 0) return undefined;
    return new TextDecoder().decode(new Uint8Array(raw));
  }

  /**
   * Insert / overwrite a string value, stamp last_synced,
   * and persist the vault to disk.
   */
  public async insertRecord(key: string, value: string): Promise<void> {
    this.assertReady();
    const valueBytes = Array.from(new TextEncoder().encode(value));
    await this.store!.insert(key, valueBytes);

    // last_synced is the canonical "this install was last
    // touched" timestamp. Stored as an encoded string so it
    // round-trips through the same TextDecoder path as other
    // records.
    const tsBytes = Array.from(new TextEncoder().encode(String(Date.now())));
    await this.store!.insert("last_synced", tsBytes);

    await this.stronghold!.save();
  }

  /** Delete a key + persist. */
  public async removeRecord(key: string): Promise<void> {
    this.assertReady();
    await this.store!.remove(key);
    await this.stronghold!.save();
  }

  // ── Internal ─────────────────────────────────────────────

  private assertReady(): void {
    if (!this.ready) {
      throw new Error(
        "[stronghold] called before init() — use getStronghold() to get the shared instance",
      );
    }
  }

  /**
   * If last_synced exists and is older than 7 days, clear the
   * bound company_name. Subsequent launches will fall through
   * InitialOnboarding again to re-bind.
   *
   * The OLD comparison (`last_synced_date >= expire_sync_date`
   * after `expire = last + 7d`) was inverted and never fired.
   * Correct check: now > last + 7d.
   */
  private async maybeInvalidateStale(): Promise<void> {
    try {
      const lastRaw = await this.store!.get("last_synced");
      if (!lastRaw || lastRaw.length === 0) return;

      const lastSynced = Number(
        new TextDecoder().decode(new Uint8Array(lastRaw)),
      );
      if (!Number.isFinite(lastSynced)) return;

      const expired = Date.now() > lastSynced + ONE_WEEK_MS;
      if (expired) {
        console.log("[stronghold] cached creds expired — clearing");
        await this.store!.remove("company_name");
        await this.stronghold!.save();
      }
    } catch (err) {
      console.error("[stronghold] stale-check failed:", err);
    }
  }
}

// ── Module-level singleton ─────────────────────────────────────
// Exposed via getStronghold() so callers can't accidentally make
// a fresh instance. First call kicks off init(); every call
// after that awaits the same promise.

let _instance: TakeOverStronghold | null = null;
let _initPromise: Promise<TakeOverStronghold> | null = null;

/**
 * Returns the shared, initialized stronghold instance. Safe to
 * call from anywhere — multiple concurrent callers share the
 * same in-flight init promise.
 */
export function getStronghold(): Promise<TakeOverStronghold> {
  if (_initPromise) return _initPromise;
  _instance = new TakeOverStronghold();
  _initPromise = _instance.init().then(() => _instance!);
  return _initPromise;
}

// ── Helpers ────────────────────────────────────────────────────

async function fetchVaultPassword(): Promise<string> {
  const res = await fetch(
    `${import.meta.env.VITE_TAKEOVER_SITE_URL}/api/takeover_creds`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "TakeOver-App": "true",
      },
    },
  );
  if (!res.ok) {
    throw new Error(
      `[stronghold] vault password fetch failed: ${res.status}`,
    );
  }
  const result = await res.json();
  if (!result?.vault_password) {
    throw new Error("[stronghold] response missing vault_password");
  }
  return result.vault_password;
}
