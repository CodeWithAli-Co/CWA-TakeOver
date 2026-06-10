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
  if (!t || t.includes("**") || t.startsWith("(")) return null;
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
  return res.text();
}

/** Open the file in your editor (server-side, best effort). */
export async function openInEditor(ref: CodeRef): Promise<void> {
  try {
    await fetch(`/__obs/open?repo=${ref.repo}&path=${encodeURIComponent(ref.file)}&line=${ref.line ?? 1}`, { method: "POST" });
  } catch { /* best effort */ }
}

export const canResolveCode = true;
