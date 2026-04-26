// ───────────────────────────────────────────────────────────────────
// Filesystem watcher.
//
// Subscribes to the active project's src/ tree via @tauri-apps/plugin
// -fs's `watch` API. When the operator edits a file outside Axon
// (saving in VS Code, pulling a branch, etc.), we:
//   1. Filter out junk paths (node_modules, .git, dist, build, etc.)
//   2. Filter to source files we care about (ts/tsx/js/jsx/rs/py/css
//      /md/json — anything an engineer would actually read).
//   3. Debounce per-path (editors typically fire 2-5 rapid events
//      per save) — wait 250ms of quiet before reporting.
//   4. Emit a Mind Map "thought" beat + a window CustomEvent
//      "axon:file-modified" that the UI / agent loop can react to.
//   5. Cap the rolling history at MAX_RECENT so the agent's context
//      window doesn't balloon when there's a heavy refactor.
//
// Runs in its own module — start/stop via configureFsWatcher +
// startFsWatcher / stopFsWatcher. AxonProvider wires this to the
// active project + the new `fsWatcher: boolean` setting. Same shape
// as visionLoop.
// ───────────────────────────────────────────────────────────────────

import { axonGraph } from "./graphStore";

// ── Tunables ──────────────────────────────────────────────────────

/** Path segments that mean "stop, don't care." */
const IGNORE_SEGMENTS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "target",      // Rust build output
  "src-tauri/target",
  "coverage",
  ".DS_Store",
];

/** File extensions we DO care about — extend as needed. */
const WATCHED_EXTS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "rs",
  "py",
  "go",
  "css", "scss", "sass", "less",
  "md", "mdx",
  "json", "toml", "yaml", "yml",
  "html",
  "svg",
  "sql",
]);

/** Per-path debounce window — longer than VS Code's burst. */
const DEBOUNCE_MS = 280;

/** Cap on the rolling list of recent edits surfaced to the agent. */
const MAX_RECENT = 24;

// ── Types ─────────────────────────────────────────────────────────

export type FsChangeKind = "modify" | "create" | "delete" | "rename";

export interface FsChange {
  /** Absolute path of the changed file. */
  path: string;
  /** Project-relative path when we can compute it. */
  relPath?: string;
  kind: FsChangeKind;
  /** ms-since-epoch when the debounced event fired. */
  at: number;
}

// ── Module state ──────────────────────────────────────────────────

let _watchHandle: (() => void) | null = null;
let _watchedRoot: string | null = null;
let _activeRootProvider: () => string | null = () => null;
const _pendingTimers = new Map<string, number>();
const _recent: FsChange[] = [];

// ── Public API ────────────────────────────────────────────────────

export interface ConfigureFsWatcherOpts {
  /** Returns the active project path (e.g. "C:/Dev/CWA-Manager") so
   *  the watcher can rebuild its subscription whenever it changes. */
  activeRoot?: () => string | null;
}

export function configureFsWatcher(opts: ConfigureFsWatcherOpts): void {
  if (opts.activeRoot) _activeRootProvider = opts.activeRoot;
}

/** Start watching the active project. Idempotent — calling start twice
 *  won't duplicate the watcher. Calling start after a project switch
 *  tears down the old watch and rebuilds against the new path. */
export async function startFsWatcher(): Promise<void> {
  const root = _activeRootProvider();
  if (!root) return; // no project — nothing to watch
  if (_watchHandle && _watchedRoot === root) return; // already watching this root
  if (_watchHandle) {
    try { _watchHandle(); } catch { /* ignore */ }
    _watchHandle = null;
  }

  // Dynamic import — same pattern as visionCapture's html2canvas dance.
  // Fails quietly if the fs plugin isn't installed (web build, sandbox).
  let watch: any;
  try {
    const mod = await import(/* @vite-ignore */ "@tauri-apps/plugin-fs");
    watch = (mod as any).watch ?? (mod as any).watchImmediate;
  } catch {
    // eslint-disable-next-line no-console
    console.warn("[AXON fsWatcher] @tauri-apps/plugin-fs not available — watcher disabled.");
    return;
  }
  if (typeof watch !== "function") return;

  try {
    const handle = await watch(
      root,
      (event: unknown) => {
        try {
          handleRawEvent(event, root);
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("[AXON fsWatcher] event handler threw:", e);
        }
      },
      { recursive: true, delayMs: 80 },
    );
    _watchHandle = typeof handle === "function" ? handle : (handle as any).unwatch ?? null;
    _watchedRoot = root;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[AXON fsWatcher] failed to start watcher:", e);
  }
}

export function stopFsWatcher(): void {
  // Flush any pending debounce timers.
  for (const id of _pendingTimers.values()) {
    window.clearTimeout(id);
  }
  _pendingTimers.clear();
  if (_watchHandle) {
    try { _watchHandle(); } catch { /* ignore */ }
    _watchHandle = null;
    _watchedRoot = null;
  }
}

export function getRecentFsChanges(): readonly FsChange[] {
  return _recent;
}

export function isFsWatcherRunning(): boolean {
  return _watchHandle !== null;
}

// ── Internals ─────────────────────────────────────────────────────

function handleRawEvent(event: unknown, root: string): void {
  // Tauri v2's plugin-fs emits events shaped like:
  //   { paths: string[], type: { ... } }   ← rough
  // Different versions use slightly different wire formats. We
  // defensively pluck the path and a kind-ish string.
  const e = event as any;
  const paths: string[] = Array.isArray(e?.paths)
    ? e.paths
    : Array.isArray(e?.path)
      ? e.path
      : typeof e?.path === "string"
        ? [e.path]
        : [];
  if (paths.length === 0) return;

  // Best-effort kind detection — most builds expose either
  // type.modify / type.create / type.remove or a simple "kind" string.
  const t = e?.type ?? e?.kind ?? "modify";
  const kind: FsChangeKind = (() => {
    if (typeof t === "string") {
      const s = t.toLowerCase();
      if (s.includes("create")) return "create";
      if (s.includes("remove") || s.includes("delete")) return "delete";
      if (s.includes("rename")) return "rename";
      return "modify";
    }
    if (t && typeof t === "object") {
      if ("create" in t) return "create";
      if ("remove" in t) return "delete";
      if ("rename" in t) return "rename";
      return "modify";
    }
    return "modify";
  })();

  for (const p of paths) {
    if (typeof p !== "string") continue;
    if (shouldIgnore(p)) continue;
    if (!hasWatchedExt(p)) continue;
    debouncePath(p, kind, root);
  }
}

function shouldIgnore(absPath: string): boolean {
  const norm = absPath.replace(/\\/g, "/");
  for (const seg of IGNORE_SEGMENTS) {
    if (norm.includes(`/${seg}/`) || norm.endsWith(`/${seg}`)) return true;
  }
  return false;
}

function hasWatchedExt(absPath: string): boolean {
  const dot = absPath.lastIndexOf(".");
  if (dot < 0) return false;
  return WATCHED_EXTS.has(absPath.slice(dot + 1).toLowerCase());
}

function debouncePath(path: string, kind: FsChangeKind, root: string): void {
  // Clear any pending timer for this path so we restart the debounce.
  const existing = _pendingTimers.get(path);
  if (existing !== undefined) window.clearTimeout(existing);

  const id = window.setTimeout(() => {
    _pendingTimers.delete(path);
    emitChange({
      path,
      relPath: tryRelPath(path, root),
      kind,
      at: Date.now(),
    });
  }, DEBOUNCE_MS);
  _pendingTimers.set(path, id);
}

function tryRelPath(abs: string, root: string): string | undefined {
  const a = abs.replace(/\\/g, "/");
  const r = root.replace(/\\/g, "/").replace(/\/$/, "");
  if (a.startsWith(r + "/")) return a.slice(r.length + 1);
  return undefined;
}

function emitChange(change: FsChange): void {
  // Drop the oldest if we're at capacity.
  _recent.push(change);
  if (_recent.length > MAX_RECENT) _recent.shift();

  // Mind Map note — light, hangs off the session root via addThought
  // shape but with a clear "external" prefix so the agent loop can
  // tell these apart from its own beats. Future T9.x will give them
  // their own kind + visual treatment if it gets noisy.
  const label = change.relPath ?? change.path;
  const verb =
    change.kind === "create"
      ? "Created externally"
      : change.kind === "delete"
        ? "Deleted externally"
        : change.kind === "rename"
          ? "Renamed externally"
          : "Edited externally";
  axonGraph.addThought(`📝 ${verb}: ${label}`);

  // Window event so the UI (toasts, banners, future "want me to update
  // related types?" prompt) can react without coupling to this module.
  try {
    window.dispatchEvent(
      new CustomEvent("axon:file-modified", { detail: change }),
    );
  } catch {
    /* noop */
  }
}
