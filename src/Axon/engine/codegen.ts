// ───────────────────────────────────────────────────────────────────
// Code-generation engine — Claude as a code writer for the operator.
//
// Architecture:
//   • Workspace root is a Tauri filesystem path the operator picks via
//     dialog (or sets explicitly with set_workspace).
//   • All file I/O is constrained to that root — no escapes via "..".
//   • Code generation calls Anthropic directly (separate from the
//     conversation brain) so it can produce raw code blocks without
//     the spoken-prose system prompt clouding output.
//
// The actions in actions/code.ts wire these helpers up as voice tools.
// ───────────────────────────────────────────────────────────────────

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";

// Tauri plugins are dynamic-imported so this module can also be parsed
// in non-Tauri contexts (tests, storybook). At runtime in the desktop
// app, they resolve normally.
async function fs() {
  return await import("@tauri-apps/plugin-fs");
}
async function dialogPlugin() {
  return await import("@tauri-apps/plugin-dialog");
}
async function pathPlugin() {
  return await import("@tauri-apps/api/path");
}

// ── workspace path safety ─────────────────────────────────────────────

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/g, "");
}

/** Detect the separator the workspace path uses. On Windows, paths from
 *  Tauri's dialog come back with `\\` and the readDir backend on
 *  Windows is fussy about which separator you pass in.
 *  We KEEP whatever separator the workspace used and append children
 *  with the same one. */
function pathSeparator(workspace: string): "/" | "\\" {
  return workspace.includes("\\") ? "\\" : "/";
}

/** Reject any path that escapes its workspace root or contains traversal.
 *  Returns a path using the workspace's native separator. */
export function safeJoin(workspace: string, relative: string): string {
  const wsTrimmed = workspace.replace(/[\\/]+$/g, "");
  const sep = pathSeparator(workspace);
  // Validate using forward-slash form so traversal check is uniform.
  const relForCheck = normalizeSlashes(relative).replace(/^\/+/, "");
  if (relForCheck.includes("..")) {
    throw new Error("Path traversal not allowed.");
  }
  if (relForCheck.length === 0) return wsTrimmed;
  // Convert forward-slash relative back to native separator for the OS.
  const relNative = relForCheck.split("/").join(sep);
  return `${wsTrimmed}${sep}${relNative}`;
}

/** Pop a folder picker; returns the chosen absolute path or null.
 *  CRITICAL: pass `recursive: true` so Tauri auto-adds the picked
 *  folder AND all its subdirectories to the runtime fs scope. Without
 *  this, readDir on subdirectories fails with "forbidden path" because
 *  the static fs:scope in capabilities/default.json only covers
 *  $HOME / $DOCUMENT / $DESKTOP / $DOWNLOAD — and many devs keep code
 *  on other drives (C:\Dev, D:\Projects, etc). */
export async function pickWorkspaceDirectory(): Promise<string | null> {
  const { open } = await dialogPlugin();
  const result = await open({
    directory: true,
    multiple: false,
    recursive: true,
    title: "Select AXON code-generation workspace",
  });
  if (!result || Array.isArray(result)) return null;
  return result;
}

export async function ensureWorkspaceExists(workspace: string): Promise<boolean> {
  const { exists } = await fs();
  try {
    return await exists(workspace);
  } catch {
    return false;
  }
}

// Directories we never recurse into. Walking them murders performance
// (node_modules can have hundreds of thousands of files) and they're
// almost never what the operator wants anyway.
const DEFAULT_IGNORE_DIRS = new Set<string>([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".vercel",
  ".cache",
  "out",
  ".svelte-kit",
  "target",       // rust
  "venv",         // python
  ".venv",
  "__pycache__",
  ".pytest_cache",
  ".idea",
  ".vscode",
  ".DS_Store",
  "coverage",
]);

export async function listWorkspace(
  workspace: string,
  rel: string = "",
  opts: { recursive?: boolean; maxDepth?: number; maxEntries?: number } = {},
): Promise<Array<{ name: string; isDir: boolean; path: string }>> {
  const { readDir } = await fs();
  const recursive = opts.recursive ?? false;
  const maxDepth = opts.maxDepth ?? (recursive ? 4 : 1);
  const maxEntries = opts.maxEntries ?? 400;

  const out: Array<{ name: string; isDir: boolean; path: string }> = [];
  // BFS so the closest entries to the requested path come first.
  const queue: Array<{ rel: string; depth: number }> = [{ rel, depth: 0 }];
  while (queue.length > 0 && out.length < maxEntries) {
    const cur = queue.shift()!;
    const target = safeJoin(workspace, cur.rel);
    let entries: any[];
    try {
      entries = await readDir(target);
    } catch {
      continue;
    }
    for (const e of entries) {
      const isDir = e.isDirectory ?? false;
      const childRel = cur.rel ? `${cur.rel}/${e.name}` : e.name;
      out.push({ name: e.name, isDir, path: childRel });
      if (out.length >= maxEntries) break;
      if (
        recursive &&
        isDir &&
        cur.depth + 1 < maxDepth &&
        !DEFAULT_IGNORE_DIRS.has(e.name)
      ) {
        queue.push({ rel: childRel, depth: cur.depth + 1 });
      }
    }
  }
  out.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.path.localeCompare(b.path);
  });
  return out;
}

export interface FindFilesResult {
  matches: Array<{ path: string; isDir: boolean }>;
  /** Number of directories successfully scanned. */
  dirsScanned: number;
  /** First few readDir errors encountered — surfaced so callers can
   *  show a useful failure message instead of "no match". */
  errors: string[];
  /** Top-level dirs that exist in the workspace — useful when find
   *  returns nothing so the caller can suggest where to look. */
  topLevelDirs: string[];
}

/** Fast recursive find. Walks the workspace tree skipping ignored dirs,
 *  returning relative paths whose filename or full path matches the
 *  pattern (case-insensitive substring; supports `*` as a single
 *  wildcard). Caps depth + results so it stays bounded on huge repos.
 *
 *  Reports errors instead of swallowing them — silently catching every
 *  readDir failure was the bug that caused "no match" results when the
 *  file existed but Tauri couldn't enter the subdirectories. */
export async function findFiles(
  workspace: string,
  args: {
    pattern: string;
    /** Optional starting subfolder. */
    base?: string;
    maxResults?: number;
    maxDepth?: number;
  },
): Promise<FindFilesResult> {
  const { readDir } = await fs();
  const maxResults = args.maxResults ?? 40;
  const maxDepth = args.maxDepth ?? 10;
  const startRel = (args.base ?? "").replace(/^\/+|\/+$/g, "");

  // Compile pattern. If it contains a wildcard, build a regex; else
  // case-insensitive substring match against the full relative path.
  const usesGlob = args.pattern.includes("*") || args.pattern.includes("?");
  const matcher: (rel: string, name: string) => boolean = (() => {
    if (usesGlob) {
      const escape = args.pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, "::DOUBLESTAR::")
        .replace(/\*/g, "[^/]*")
        .replace(/::DOUBLESTAR::/g, ".*")
        .replace(/\?/g, ".");
      const re = new RegExp(`^${escape}$|/${escape}$|^${escape}|${escape}$`, "i");
      return (rel: string, name: string) => re.test(rel) || re.test(name);
    }
    const needle = args.pattern.toLowerCase();
    return (rel: string, name: string) =>
      rel.toLowerCase().includes(needle) || name.toLowerCase().includes(needle);
  })();

  const out: Array<{ path: string; isDir: boolean }> = [];
  const errors: string[] = [];
  const topLevelDirs: string[] = [];
  let dirsScanned = 0;
  const stack: Array<{ rel: string; depth: number }> = [
    { rel: startRel, depth: 0 },
  ];

  while (stack.length > 0 && out.length < maxResults) {
    const cur = stack.pop()!;
    const target = safeJoin(workspace, cur.rel);
    let entries: any[];
    try {
      entries = await readDir(target);
      dirsScanned++;
    } catch (e) {
      const msg = `${cur.rel || "(root)"}: ${(e as Error).message ?? e}`;
      console.warn("[AXON] findFiles readDir failed:", msg);
      // Surface the first 5 errors for the action's summary.
      if (errors.length < 5) errors.push(msg);
      continue;
    }
    for (const e of entries) {
      const isDir: boolean = e.isDirectory ?? false;
      const childRel = cur.rel ? `${cur.rel}/${e.name}` : e.name;
      if (cur.depth === 0 && isDir) topLevelDirs.push(e.name);
      if (isDir && DEFAULT_IGNORE_DIRS.has(e.name)) continue;

      if (matcher(childRel, e.name)) {
        out.push({ path: childRel, isDir });
        if (out.length >= maxResults) break;
      }
      if (isDir && cur.depth + 1 < maxDepth) {
        stack.push({ rel: childRel, depth: cur.depth + 1 });
      }
    }
  }
  // Sort: shorter paths first (closer matches), then alphabetical.
  out.sort((a, b) => {
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.path.localeCompare(b.path);
  });
  return { matches: out, dirsScanned, errors, topLevelDirs };
}

/** Grep-style search across workspace files. Reads matching files
 *  (capped size) and returns hits with surrounding context lines. */
export async function searchFiles(
  workspace: string,
  args: {
    query: string;
    /** Optional substring filter on file path (e.g. ".tsx"). */
    pathFilter?: string;
    maxFileSize?: number;
    maxFiles?: number;
    maxHits?: number;
    contextLines?: number;
  },
): Promise<Array<{ path: string; line: number; preview: string }>> {
  const { readTextFile } = await fs();
  const maxFileSize = args.maxFileSize ?? 240_000;   // 240 KB
  const maxFiles = args.maxFiles ?? 200;
  const maxHits = args.maxHits ?? 30;
  const contextLines = args.contextLines ?? 1;
  const pathFilter = (args.pathFilter ?? "").toLowerCase();
  const queryRe = new RegExp(
    args.query.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
    "i",
  );

  // Gather candidate text files via the recursive walker, capped.
  const candidates = await listWorkspace(workspace, "", {
    recursive: true,
    maxDepth: 12,
    maxEntries: maxFiles * 4,
  });
  const files = candidates
    .filter((c) => !c.isDir)
    .filter((c) => /\.(ts|tsx|js|jsx|css|scss|html|md|json|yml|yaml|toml|rs|py|go|java|kt|swift|sh|env|sql)$/i.test(c.name))
    .filter((c) => (pathFilter ? c.path.toLowerCase().includes(pathFilter) : true))
    .slice(0, maxFiles);

  const hits: Array<{ path: string; line: number; preview: string }> = [];
  for (const f of files) {
    if (hits.length >= maxHits) break;
    let text: string;
    try {
      text = await readTextFile(safeJoin(workspace, f.path));
    } catch {
      continue;
    }
    if (text.length > maxFileSize) continue;
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (queryRe.test(lines[i])) {
        const lo = Math.max(0, i - contextLines);
        const hi = Math.min(lines.length, i + contextLines + 1);
        const preview = lines
          .slice(lo, hi)
          .map((l, idx) => `${lo + idx + 1}: ${l}`)
          .join("\n");
        hits.push({ path: f.path, line: i + 1, preview });
        if (hits.length >= maxHits) break;
      }
    }
  }
  return hits;
}

export async function readWorkspaceFile(
  workspace: string,
  rel: string,
): Promise<string> {
  const { readTextFile } = await fs();
  return await readTextFile(safeJoin(workspace, rel));
}

export async function writeWorkspaceFile(
  workspace: string,
  rel: string,
  content: string,
): Promise<void> {
  const { writeTextFile, mkdir, exists } = await fs();
  const { dirname } = await pathPlugin();
  const fullPath = safeJoin(workspace, rel);
  const parent = await dirname(fullPath);
  // Make sure parent dirs exist.
  if (!(await exists(parent))) {
    await mkdir(parent, { recursive: true });
  }
  await writeTextFile(fullPath, content);
}

export async function deleteWorkspaceFile(
  workspace: string,
  rel: string,
): Promise<void> {
  const { remove } = await fs();
  await remove(safeJoin(workspace, rel));
}

// ── claude code-writer ────────────────────────────────────────────────

const CODE_WRITER_SYSTEM = `You are a senior code-writer agent embedded in AXON. The operator dictates a feature or fix by voice; you produce code.

OUTPUT FORMAT — STRICT:
- Reply with EXACTLY one fenced code block. No prose before or after the block.
- The fence opens with three backticks plus the file's language identifier (e.g. \`\`\`tsx, \`\`\`ts, \`\`\`py, \`\`\`rs, \`\`\`html, \`\`\`css, \`\`\`json).
- Inside the block, output only the file's contents. No explanation comments unless they are useful in the source itself.

GUIDELINES:
- Match the project's existing style if context is given.
- Prefer clean, idiomatic, production-grade code over clever one-liners.
- Always include necessary imports and exports.
- Keep files self-contained unless the operator explicitly mentions splitting.
- Default to TypeScript + React for unspecified UI work in this app.`;

const CODE_MODIFIER_SYSTEM = `You are a senior code-modifier agent embedded in AXON. The operator describes a change; you receive the current file and return the FULL revised file.

OUTPUT FORMAT — STRICT:
- Reply with EXACTLY one fenced code block. No prose before or after the block.
- The fence opens with three backticks plus the file's language identifier.
- Inside the block, output the COMPLETE new file contents — not a diff, not a partial snippet.

GUIDELINES:
- Preserve unchanged code byte-for-byte when possible.
- Don't drop comments, imports, or sections you weren't asked to touch.
- If the change is impossible without more info, return the original file unchanged.`;

interface ClaudeCodeResponse {
  /** Extracted code (fence stripped). */
  code: string;
  /** Detected language tag (e.g. "tsx"). */
  language: string;
  /** Raw text returned by Claude (for debugging). */
  raw: string;
}

function extractCodeBlock(raw: string): { code: string; language: string } {
  // Greedy: find first fenced block.
  const match = raw.match(/```([\w+\-.]*)\n([\s\S]*?)```/);
  if (match) {
    return { language: (match[1] || "").trim(), code: match[2].trim() + "\n" };
  }
  // No fence — return whole reply (fallback).
  return { language: "", code: raw.trim() + "\n" };
}

async function callClaude(
  system: string,
  user: string,
  maxTokens = 8000,
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing — set VITE_ANTHROPIC_API_KEY.");
  }
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 240)}`);
  }
  const json = await res.json();
  const block = (json?.content ?? []).find((p: any) => p.type === "text");
  return block?.text ?? "";
}

/** Generate a full file from a brief. */
export async function generateFile(args: {
  brief: string;
  filename: string;
  language?: string;
  context?: string;
}): Promise<ClaudeCodeResponse> {
  const langHint = args.language ? `Target language: ${args.language}.\n` : "";
  const ctx = args.context ? `\nProject context:\n${args.context}\n` : "";
  const user = `Filename: ${args.filename}
${langHint}${ctx}
Operator's request:
"""${args.brief}"""

Produce the full file contents.`;
  const raw = await callClaude(CODE_WRITER_SYSTEM, user, 8000);
  const { code, language } = extractCodeBlock(raw);
  return { code, language, raw };
}

/** Modify an existing file based on a brief. */
export async function modifyFile(args: {
  brief: string;
  filename: string;
  current: string;
  language?: string;
}): Promise<ClaudeCodeResponse> {
  const langHint = args.language ? `Language: ${args.language}.` : "";
  const user = `Filename: ${args.filename}
${langHint}

Operator's change request:
"""${args.brief}"""

Current file contents:
\`\`\`
${args.current}
\`\`\`

Return the complete revised file.`;
  const raw = await callClaude(CODE_MODIFIER_SYSTEM, user, 12000);
  const { code, language } = extractCodeBlock(raw);
  return { code, language, raw };
}

/** Generate a multi-file scaffold for a feature.
 *  Returns a JSON list of files to write — relies on Claude returning
 *  a single fenced ```json block. */
export async function scaffoldFeature(args: {
  brief: string;
  basePath: string;
  context?: string;
}): Promise<{ files: Array<{ path: string; content: string }>; raw: string }> {
  const SCAFFOLD_SYSTEM = `You are a feature scaffolder. Given a brief, return ONE fenced \`\`\`json block whose payload is:

{ "files": [ { "path": "relative/path.ext", "content": "..." } ] }

GUIDELINES:
- Paths are relative to the scaffold base path provided by the operator.
- Each "content" is the FULL file body. Escape newlines as \\n in JSON strings — do NOT inline raw newlines.
- Keep total scaffold to 5 files or fewer unless the request demands more.
- Don't include any prose outside the JSON block.`;

  const ctx = args.context ? `\nContext:\n${args.context}\n` : "";
  const user = `Base path (relative to workspace): ${args.basePath}
${ctx}
Brief: """${args.brief}"""

Return the JSON scaffold.`;
  const raw = await callClaude(SCAFFOLD_SYSTEM, user, 12000);
  const { code: jsonText } = extractCodeBlock(raw);
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(
      `Scaffold response wasn't valid JSON: ${(e as Error).message}. Raw start: ${jsonText.slice(0, 120)}`,
    );
  }
  if (!parsed?.files || !Array.isArray(parsed.files)) {
    throw new Error("Scaffold response missing `files` array.");
  }
  const files: Array<{ path: string; content: string }> = parsed.files.map((f: any) => ({
    path: String(f.path),
    content: String(f.content),
  }));
  return { files, raw };
}
