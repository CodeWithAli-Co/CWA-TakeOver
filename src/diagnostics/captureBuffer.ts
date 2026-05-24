/**
 * captureBuffer.ts — Rolling diagnostic buffer for bug reports.
 *
 * Wraps console.log / warn / error / info / debug AND patches
 * window.fetch + XMLHttpRequest so we keep a tail of the most
 * recent ~50 console lines and ~20 network requests.
 *
 * When the user opens the bug report dialog, the dialog calls
 * snapshotDiagnostics() and stashes the result into the
 * bug_reports row. Operator can then read the logs / network
 * activity from the inbox without asking the reporter to
 * paste-from-console.
 *
 * Design constraints:
 *   · Must be cheap when not viewing logs — we only allocate when
 *     a new entry comes in, and trim to a fixed-size ring.
 *   · Must never throw — wrapping console can't introduce new
 *     errors; the original behaviour always runs.
 *   · Must be mountable once. install() is idempotent.
 *   · Sensitive headers (Authorization, cookies) are stripped
 *     before storage so reports don't leak credentials.
 */

const MAX_CONSOLE_ENTRIES = 50;
const MAX_NETWORK_ENTRIES = 20;
const MAX_VALUE_CHARS = 800;          // per-entry argument cap

export interface ConsoleEntry {
  level: "log" | "warn" | "error" | "info" | "debug";
  ts: number;                          // epoch ms
  message: string;                     // joined arguments, truncated
}

export interface NetworkEntry {
  ts: number;
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  error?: string;                      // populated only on failure
}

export interface DiagnosticsSnapshot {
  console: ConsoleEntry[];
  network: NetworkEntry[];
  capturedAt: number;
}

const consoleRing: ConsoleEntry[] = [];
const networkRing: NetworkEntry[] = [];
let installed = false;

/** Trim args into a single string. Caps each formatted value so
 *  one giant object doesn't blow the row. Never throws. */
function formatArg(a: unknown): string {
  try {
    if (a === null) return "null";
    if (a === undefined) return "undefined";
    if (typeof a === "string") return a;
    if (typeof a === "number" || typeof a === "boolean") return String(a);
    if (a instanceof Error) {
      return `Error: ${a.message}\n${(a.stack || "").slice(0, 400)}`;
    }
    return JSON.stringify(a);
  } catch {
    return "[unserializable]";
  }
}

function pushConsole(level: ConsoleEntry["level"], args: unknown[]) {
  try {
    const message = args.map(formatArg).join(" ").slice(0, MAX_VALUE_CHARS);
    consoleRing.push({ level, ts: Date.now(), message });
    while (consoleRing.length > MAX_CONSOLE_ENTRIES) consoleRing.shift();
  } catch { /* never let capture break the app */ }
}

function pushNetwork(entry: NetworkEntry) {
  try {
    networkRing.push(entry);
    while (networkRing.length > MAX_NETWORK_ENTRIES) networkRing.shift();
  } catch { /* noop */ }
}

/** Mount the capture once at app boot. Safe to call multiple times. */
export function installDiagnostics(): void {
  if (installed) return;
  installed = true;

  // ── console wraps ────────────────────────────────────────────
  const levels: ConsoleEntry["level"][] = ["log", "warn", "error", "info", "debug"];
  for (const lvl of levels) {
    const original = (console[lvl] as (...a: unknown[]) => void).bind(console);
    (console[lvl] as (...a: unknown[]) => void) = (...args: unknown[]) => {
      pushConsole(lvl, args);
      original(...args);
    };
  }

  // ── fetch wrap ───────────────────────────────────────────────
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const started = Date.now();
      const method = (init?.method || "GET").toUpperCase();
      const url = typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
      try {
        const res = await originalFetch(input as any, init);
        pushNetwork({
          ts: started,
          method,
          url: sanitiseUrl(url),
          status: res.status,
          ok: res.ok,
          durationMs: Date.now() - started,
        });
        return res;
      } catch (err) {
        pushNetwork({
          ts: started,
          method,
          url: sanitiseUrl(url),
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - started,
        });
        throw err;
      }
    };
  }

  // ── XHR wrap — covers libs that don't use fetch ──────────────
  if (typeof XMLHttpRequest !== "undefined") {
    const OriginalXHR = XMLHttpRequest;
    const openOrig = OriginalXHR.prototype.open;
    const sendOrig = OriginalXHR.prototype.send;

    OriginalXHR.prototype.open = function (
      this: XMLHttpRequest & { __diag?: { method: string; url: string; started: number } },
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      this.__diag = {
        method: method.toUpperCase(),
        url: typeof url === "string" ? url : url.toString(),
        started: 0,
      };
      // @ts-expect-error rest is the residual original signature
      return openOrig.call(this, method, url, ...rest);
    };

    OriginalXHR.prototype.send = function (
      this: XMLHttpRequest & { __diag?: { method: string; url: string; started: number } },
      ...args: unknown[]
    ) {
      const diag = this.__diag;
      if (diag) {
        diag.started = Date.now();
        this.addEventListener("loadend", () => {
          pushNetwork({
            ts: diag.started,
            method: diag.method,
            url: sanitiseUrl(diag.url),
            status: this.status || undefined,
            ok: this.status >= 200 && this.status < 400,
            durationMs: Date.now() - diag.started,
          });
        });
      }
      // @ts-expect-error proxy through the original signature
      return sendOrig.call(this, ...args);
    };
  }
}

/** Pull the current snapshot. Returns COPIES so a later push can't
 *  mutate what the caller already serialised. */
export function snapshotDiagnostics(): DiagnosticsSnapshot {
  return {
    console: consoleRing.map((e) => ({ ...e })),
    network: networkRing.map((e) => ({ ...e })),
    capturedAt: Date.now(),
  };
}

/** Capture basic browser/environment info to attach to a report.
 *  Cheap; no PII beyond what the user's UA already broadcasts. */
export function browserInfo(): Record<string, unknown> {
  if (typeof window === "undefined") return {};
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    onlineStatus: navigator.onLine,
  };
}

/** Strip query-string credentials (?token=..., ?access_token=...)
 *  before logging URLs. Doesn't affect the actual request, only
 *  what gets persisted to the bug report. */
function sanitiseUrl(url: string): string {
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : undefined);
    const SECRETS = ["token", "access_token", "refresh_token", "apikey", "key", "secret", "password"];
    for (const k of SECRETS) {
      if (u.searchParams.has(k)) u.searchParams.set(k, "[REDACTED]");
    }
    return u.toString();
  } catch {
    return url;
  }
}
