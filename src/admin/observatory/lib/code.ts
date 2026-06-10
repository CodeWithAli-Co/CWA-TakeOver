/**
 * code.ts — read the real source behind a finding/node, right inside the modal.
 * Files are read through the Vite dev server (/__obs/file), which runs on your
 * machine with correct repo access — no Tauri FS scope/path guesswork. Works in
 * `tauri dev`; in a packaged build (no dev server) it degrades gracefully.
 */
export interface CodeRef { raw: string; file: string; line?: number; repo: "cwa" | "b2b" }

/** Parse one manifest path token ("src/x.ts:55 (note)") into a usable ref. */
export function parseRef(raw: string): CodeRef | null {
  if (!raw) return null;
  let t = raw.trim().split(/\s|\(/)[0];
  if (!t || t.includes("*") || t.startsWith("(")) return null;  // skip globs
  let line: number | undefined;
  const m = t.match(/:(\d+)/);
  if (m) { line = parseInt(m[1], 10); t = t.slice(0, m.index); }
  if (!/\.[a-z0-9]+$/i.test(t)) return null;
  let repo: "cwa" | "b2b" = "cwa";
  if (t.startsWith("takeover_b2b/")) { repo = "b2b"; t = t.replace(/^takeover_b2b\//, ""); }
  return { raw, file: t, line, repo };
}

/** Pull file references out of a prose evidence string. */
export function extractRefs(text: string): CodeRef[] {
  const out: CodeRef[] = [];
  const seen = new Set<string>();
  const re = /(?:takeover_b2b\/)?(?:src(?:-tauri)?|app|lib|migrations)\/[\w./-]+\.[a-z0-9]+(?::\d+)?/gi;
  for (const m of text.matchAll(re)) {
    const r = parseRef(m[0]);
    if (r && !seen.has(r.repo + r.file)) { seen.add(r.repo + r.file); out.push(r); }
  }
  return out;
}

export function refsFromPaths(paths: string[]): CodeRef[] {
  const out: CodeRef[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const r = parseRef(p);
    if (r && !seen.has(r.repo + r.file)) { seen.add(r.repo + r.file); out.push(r); }
  }
  return out;
}

/** Read a source file via the dev server. */
export async function readCode(ref: CodeRef): Promise<string> {
  const url = `/__obs/file?repo=${ref.repo}&path=${encodeURIComponent(ref.file)}`;
  let res: Response;
  try { res = await fetch(url); }
  catch { throw new Error("Dev server not reachable — run the app with `bun tauri dev` (or `bun dev`)."); }
  if (res.status === 404) throw new Error("File not found in the repo: " + ref.file);
  if (!res.ok) throw new Error(`Couldn't read the file (${res.status}). ${(await res.text()).slice(0, 160)}`);
  // The dev endpoint stamps this header. If it's missing we got the SPA
  // fallback (index.html) -> the endpoints aren't loaded yet.
  if (!res.headers.get("x-obs-file")) throw new Error("Restart the dev server (bun tauri dev) so the file viewer loads.");
  return res.text();
}

/** Open the file in your editor (server-side, best effort). */
export async function openInEditor(ref: CodeRef): Promise<void> {
  try {
    await fetch(`/__obs/open?repo=${ref.repo}&path=${encodeURIComponent(ref.file)}&line=${ref.line ?? 1}`, { method: "POST" });
  } catch { /* best effort */ }
}

export const canResolveCode = true;

// ── line-level review annotations ────────────────────────────────────────────
export interface LineAnnotation {
  repo: "cwa" | "b2b";
  file: string;
  line: number;
  kind: "problem" | "change" | "context";
  order?: number;   // for ordered change steps
  note?: string;
}

/** Pull "problem" line markers out of a finding's evidence string, supporting
 *  "file.ts:19,38,50" and "file.ts:55-63" forms. */
export function extractAnnotations(text: string, note = "flagged here"): LineAnnotation[] {
  const out: LineAnnotation[] = [];
  const re = /((?:takeover_b2b\/)?(?:src(?:-tauri)?|app|lib|migrations)\/[\w./-]+\.[a-z0-9]+):(\d+(?:[-,]\d+)*)/gi;
  for (const m of text.matchAll(re)) {
    const base = parseRef(m[1] + ":1");
    if (!base) continue;
    const nums = new Set<number>();
    for (const part of m[2].split(",")) {
      const rg = part.match(/^(\d+)-(\d+)$/);
      if (rg) { const a = +rg[1], b = +rg[2]; for (let n = a; n <= b && n - a < 50; n++) nums.add(n); }
      else if (/^\d+$/.test(part)) nums.add(+part);
    }
    for (const line of nums) out.push({ repo: base.repo, file: base.file, line, kind: "problem", note });
  }
  return out;
}

/** Derive searchable identifiers from a finding's text so we can highlight the
 *  lines that contain them, even when the evidence has no explicit line numbers. */
export function deriveLocators(text: string): string[] {
  const set = new Set<string>();
  for (const m of text.matchAll(/`([^`]{3,40})`/g)) set.add(m[1]);                 // `backticked`
  for (const m of text.matchAll(/\b[A-Z][A-Z0-9_]{4,}\b/g)) set.add(m[0]);          // ENV_VARS
  for (const m of text.matchAll(/\b[a-z][a-z0-9]*_[a-z0-9_]{2,}\b/g)) set.add(m[0]); // snake_case
  for (const m of text.matchAll(/\b[a-z_]\w+\.[a-z_]\w+\b/gi)) set.add(m[0]);        // dotted.access
  for (const m of text.matchAll(/\b([a-zA-Z_]\w{4,})\(/g)) set.add(m[1]);            // funcName(
  const stop = new Set(["using","client","server","value","string","number","object","tables","routes","because","should","every","which","their","encrypted","credentials","without"]);
  let terms = [...set].filter((t) => t.length >= 4 && !t.endsWith("_") && !stop.has(t.toLowerCase()));
  terms = terms.filter((t) => !terms.some((o) => o !== t && o.startsWith(t)));  // drop prefixes
  return terms.slice(0, 16);
}
