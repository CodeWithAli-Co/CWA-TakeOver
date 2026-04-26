// ───────────────────────────────────────────────────────────────────
// Code generation actions — let AXON build code by voice.
//
// Operator says: "Axon, generate a React component called UserCard
// that takes name and avatar as props" → brain calls
// `generate_file({ filename: 'src/components/UserCard.tsx',
//                  brief: '...', language: 'tsx' })`.
//
// All file ops are scoped to the operator's chosen workspace folder.
// File creation/modification is mutating + uses confirmation when
// the operator hasn't enabled autoApprove.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  pickWorkspaceDirectory,
  ensureWorkspaceExists,
  listWorkspace,
  readWorkspaceFile,
  writeWorkspaceFile,
  deleteWorkspaceFile,
  generateFile,
  modifyFile,
  scaffoldFeature,
  safeJoin,
  findFiles,
  searchFiles,
} from "../engine/codegen";

// Workspace accessors — bound by AxonProvider on mount so we can
// read and write the codegen settings without a React cycle.
type WorkspaceGetter = () => string | null;
type WorkspaceSetter = (path: string | null) => void;
let _getWorkspace: WorkspaceGetter | null = null;
let _setWorkspace: WorkspaceSetter | null = null;

export function _bindCodegenAccessors(get: WorkspaceGetter, set: WorkspaceSetter) {
  _getWorkspace = get;
  _setWorkspace = set;
}

/** Resolve the active workspace path. Active project (if any) wins;
 *  otherwise falls back to the legacy single-workspace setting. */
export function workspaceOrNull(): string | null {
  return _getWorkspace?.() ?? null;
}

function workspaceLabel(ws: string): string {
  // Trim long absolute paths in spoken output.
  const norm = ws.replace(/\\/g, "/");
  const parts = norm.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || norm;
}

/** Run a thunk in the "coding" status state. The orb shifts to its
 *  green coding visual while the closure runs; reverts to "processing"
 *  on completion (the brain will re-set status as the loop continues). */
async function withCodingStatus<T>(
  ctx: { setStatus?: (s: any) => void },
  fn: () => Promise<T>,
): Promise<T> {
  ctx.setStatus?.("coding");
  try {
    return await fn();
  } finally {
    // Brain's next turn will overwrite this; falling back to processing
    // is the right default while we wait for the next iteration.
    ctx.setStatus?.("processing");
  }
}

/** Detect a sensible language tag from a filename. */
function languageFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rs: "rust",
    go: "go",
    rb: "ruby",
    java: "java",
    c: "c",
    cpp: "c++",
    cs: "c#",
    swift: "swift",
    kt: "kotlin",
    sh: "bash",
    yml: "yaml",
    yaml: "yaml",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    sql: "sql",
    toml: "toml",
  };
  return map[ext] ?? ext;
}

// ── workspace management ────────────────────────────────────────────────

export const setWorkspaceAction: AxonAction<
  { path?: string },
  { workspace: string | null }
> = {
  name: "set_workspace",
  description:
    "Choose or set the folder where AXON writes generated code. If `path` is given, tries to set it directly; if the path can't be reached (doesn't exist or is outside the app fs scope) a folder-picker dialog pops automatically — the operator clicks the real folder and you're set. If `path` is omitted, the picker opens straight away. Required before any code-generation action runs. DO NOT call set_workspace repeatedly with the same path that just failed — wait for the picker to resolve.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Optional explicit absolute path. If omitted, opens a folder picker.",
      },
    },
  },
  handler: async ({ path }, ctx) => {
    if (!_setWorkspace) {
      return { summary: "Workspace mutator not bound." };
    }
    let chosen = path?.trim() || null;
    let pickerFallbackUsed = false;

    // No path given → straight to picker.
    if (!chosen) {
      chosen = await pickWorkspaceDirectory();
      if (!chosen) {
        return {
          summary: "No folder selected.",
          data: { workspace: workspaceOrNull() },
        };
      }
    } else if (!(await ensureWorkspaceExists(chosen))) {
      // Path was given but couldn't be reached. Two common reasons:
      //   1. The path actually doesn't exist (typo / wrong drive).
      //   2. The path exists but is outside Tauri's static fs:scope —
      //      capabilities/default.json only lists $HOME / $DOCUMENT /
      //      $DESKTOP / $DOWNLOAD by default; anything under C:\\Dev\\
      //      etc gets rejected as "forbidden path".
      // Either way the right move is to pop the picker. The picker's
      // recursive:true flag adds the chosen folder to the runtime
      // fs:scope, fixing case (2), and is the operator's chance to
      // correct case (1) in one click.
      const fallback = await pickWorkspaceDirectory();
      if (!fallback) {
        return {
          summary: `Couldn't reach ${chosen}, and no folder picked. Workspace unchanged.`,
          data: { workspace: workspaceOrNull() },
        };
      }
      chosen = fallback;
      pickerFallbackUsed = true;
    }

    if (!(await ensureWorkspaceExists(chosen))) {
      return {
        summary: `Couldn't access that folder either: ${chosen}.`,
        data: { workspace: workspaceOrNull() },
      };
    }

    _setWorkspace(chosen);
    ctx.logActivity({
      actionName: "set_workspace",
      params: { path: chosen, pickerFallbackUsed },
      summary: `Workspace set to ${workspaceLabel(chosen)}`,
    });
    return {
      summary: pickerFallbackUsed
        ? `Couldn't reach the path you said — picked ${workspaceLabel(chosen)} via folder dialog.`
        : `Workspace set to ${workspaceLabel(chosen)}.`,
      data: { workspace: chosen },
    };
  },
};

export const currentWorkspaceAction: AxonAction<
  Record<string, never>,
  { workspace: string | null }
> = {
  name: "current_workspace",
  description: "Returns the current code-generation workspace path.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const ws = workspaceOrNull();
    return {
      summary: ws ? `Workspace is ${workspaceLabel(ws)}.` : "No workspace set yet.",
      data: { workspace: ws },
    };
  },
};

// ── reads (non-mutating, no confirm) ────────────────────────────────────

export const listWorkspaceAction: AxonAction<
  { path?: string; recursive?: boolean; maxDepth?: number },
  { entries: Array<{ name: string; isDir: boolean; path: string }> }
> = {
  name: "list_workspace",
  description:
    "List files and folders inside the workspace. Pass `path` to scope to a subfolder. Set `recursive: true` to walk subdirectories (skips node_modules / .git / dist / .next / build / etc, and is depth + entry capped). Prefer `find_file` when you're hunting for a specific filename — it's faster.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Subfolder path relative to workspace root." },
      recursive: { type: "boolean", description: "Walk into subdirectories. Default false." },
      maxDepth: { type: "number", description: "Max recursion depth when recursive is true. Default 4." },
    },
  },
  handler: async ({ path = "", recursive, maxDepth }, _ctx) => {
    const ws = workspaceOrNull();
    if (!ws) {
      return {
        summary: "No workspace set. Say 'set workspace' first.",
        data: { entries: [] },
      };
    }
    try {
      const entries = await listWorkspace(ws, path, { recursive, maxDepth });
      const summary =
        entries.length === 0
          ? "Folder is empty."
          : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}: ${entries
              .slice(0, 8)
              .map((e) => (e.isDir ? `${e.path}/` : e.path))
              .join(", ")}${entries.length > 8 ? "…" : ""}.`;
      return { summary, data: { entries } };
    } catch (e) {
      return {
        summary: `Couldn't list: ${(e as Error).message}`,
        data: { entries: [] },
      };
    }
  },
};

export const findFileAction: AxonAction<
  { pattern: string; base?: string; maxResults?: number; maxDepth?: number },
  {
    matches: Array<{ path: string; isDir: boolean }>;
    dirsScanned: number;
    errors: string[];
    topLevelDirs: string[];
  }
> = {
  name: "find_file",
  description:
    "FAST recursive file search. Returns paths whose name or full path matches `pattern` (case-insensitive substring; `*` and `?` wildcards work). Skips node_modules / .git / dist / .next / build automatically. Use this FIRST when looking for a specific file — never walk the tree manually with list_workspace. Examples: pattern='reports' finds anything with 'reports' in the path; pattern='*.tsx' finds all React files.",
  input_schema: {
    type: "object",
    properties: {
      pattern: { type: "string", description: "Substring or glob (`*`, `?`) to match against the relative path." },
      base: { type: "string", description: "Optional starting subfolder. Defaults to workspace root." },
      maxResults: { type: "number", description: "Cap on results. Default 40." },
      maxDepth: { type: "number", description: "Max recursion depth. Default 10." },
    },
    required: ["pattern"],
  },
  handler: async ({ pattern, base, maxResults, maxDepth }, _ctx) => {
    const ws = workspaceOrNull();
    if (!ws) return { summary: "No workspace set." };
    try {
      const result = await findFiles(ws, { pattern, base, maxResults, maxDepth });
      if (result.matches.length === 0) {
        // Be honest about why nothing matched. Surface scan stats and any
        // permission errors so the brain knows whether it's a missing
        // file vs. a broken scan.
        const parts: string[] = [`No match for "${pattern}".`];
        parts.push(`Scanned ${result.dirsScanned} ${result.dirsScanned === 1 ? "dir" : "dirs"}.`);
        if (result.topLevelDirs.length > 0) {
          parts.push(
            `Top-level dirs: ${result.topLevelDirs.slice(0, 12).join(", ")}${result.topLevelDirs.length > 12 ? "…" : ""}.`,
          );
        }
        if (result.errors.length > 0) {
          // If the errors are scope/permission, the workspace was
          // probably saved before the dialog gained recursive: true.
          // The fix is one round-trip: re-open the picker.
          const isScopeError = result.errors.some((m) => /forbidden path|allow-read-dir|capability/i.test(m));
          if (isScopeError) {
            parts.push(
              `STOP — this is a Tauri scope problem, not a missing file. The agent cannot read subdirectories of this workspace. Tell the operator to say "set workspace" again so the folder picker re-registers the path with recursive scope. Do NOT keep retrying find_file. First scope error: ${result.errors[0]}`,
            );
          } else {
            parts.push(
              `${result.errors.length} readDir error${result.errors.length === 1 ? "" : "s"}: ${result.errors[0]}`,
            );
          }
        }
        return {
          summary: parts.join(" "),
          data: {
            matches: [],
            dirsScanned: result.dirsScanned,
            errors: result.errors,
            topLevelDirs: result.topLevelDirs,
          },
        };
      }
      const top = result.matches
        .slice(0, 6)
        .map((m) => (m.isDir ? `${m.path}/` : m.path))
        .join(", ");
      return {
        summary: `${result.matches.length} match${result.matches.length === 1 ? "" : "es"}: ${top}${result.matches.length > 6 ? "…" : ""}.`,
        data: {
          matches: result.matches,
          dirsScanned: result.dirsScanned,
          errors: result.errors,
          topLevelDirs: result.topLevelDirs,
        },
      };
    } catch (e) {
      return {
        summary: `Find failed: ${(e as Error).message}`,
        data: { matches: [], dirsScanned: 0, errors: [(e as Error).message], topLevelDirs: [] },
      };
    }
  },
};

export const searchFilesAction: AxonAction<
  { query: string; pathFilter?: string; maxHits?: number; contextLines?: number },
  { hits: Array<{ path: string; line: number; preview: string }> }
> = {
  name: "search_files",
  description:
    "Grep-style content search across workspace files. Returns lines that match `query` (case-insensitive) with surrounding context. Use to locate where a function, prop, or string is defined or used. Pass `pathFilter` to scope (e.g. '.tsx', 'reports'). Caps file size at 240KB and total hits at 30.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "String to search for (case-insensitive)." },
      pathFilter: { type: "string", description: "Optional substring filter on file path." },
      maxHits: { type: "number", description: "Cap on hits. Default 30." },
      contextLines: { type: "number", description: "Lines of context around each hit. Default 1." },
    },
    required: ["query"],
  },
  handler: async ({ query, pathFilter, maxHits, contextLines }, _ctx) => {
    const ws = workspaceOrNull();
    if (!ws) return { summary: "No workspace set." };
    try {
      const hits = await searchFiles(ws, { query, pathFilter, maxHits, contextLines });
      if (hits.length === 0) {
        return { summary: `No matches for "${query}".`, data: { hits: [] } };
      }
      const filesWithHits = new Set(hits.map((h) => h.path));
      return {
        summary: `${hits.length} hit${hits.length === 1 ? "" : "s"} in ${filesWithHits.size} file${filesWithHits.size === 1 ? "" : "s"}.`,
        data: { hits },
      };
    } catch (e) {
      return { summary: `Search failed: ${(e as Error).message}`, data: { hits: [] } };
    }
  },
};

export const readWorkspaceFileAction: AxonAction<
  { path: string },
  { path: string; content: string; bytes: number }
> = {
  name: "read_workspace_file",
  description:
    "Read a text file inside the workspace. Returns the contents so the brain can reference them in subsequent reasoning.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relative to workspace root." },
    },
    required: ["path"],
  },
  handler: async ({ path }, _ctx) => {
    const ws = workspaceOrNull();
    if (!ws) {
      return { summary: "No workspace set." };
    }
    try {
      const content = await readWorkspaceFile(ws, path);
      return {
        summary: `Read ${path} (${content.length} chars).`,
        data: { path, content, bytes: content.length },
      };
    } catch (e) {
      return { summary: `Couldn't read ${path}: ${(e as Error).message}` };
    }
  },
};

// ── writes (mutating, confirm-gated) ────────────────────────────────────

export const generateFileAction: AxonAction<
  { filename: string; brief: string; context?: string; language?: string; overwrite?: boolean },
  { path: string; bytes: number; preview: string }
> = {
  name: "generate_file",
  description:
    "Generate a brand-new file inside the workspace using Claude. Use this when the operator describes a feature, component, script, or module to create. The `brief` is the operator's natural-language description. `filename` is relative to the workspace root. Set `overwrite: true` if it's OK to clobber an existing file.",
  input_schema: {
    type: "object",
    properties: {
      filename: { type: "string", description: "Relative path inside workspace, e.g. 'src/components/UserCard.tsx'." },
      brief: { type: "string", description: "What the file should contain." },
      context: { type: "string", description: "Optional extra context (project conventions, related files, etc)." },
      language: { type: "string", description: "Override language hint (defaults to filename extension)." },
      overwrite: { type: "boolean", description: "Allow replacing an existing file. Default false." },
    },
    required: ["filename", "brief"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ filename, brief, context, language, overwrite }, ctx) => {
    const ws = workspaceOrNull();
    if (!ws) {
      return { summary: "No workspace set. Say 'set workspace' first." };
    }
    // Pre-check existence to avoid clobbering by accident.
    let alreadyExists = false;
    try {
      await readWorkspaceFile(ws, filename);
      alreadyExists = true;
    } catch {
      alreadyExists = false;
    }
    if (alreadyExists && !overwrite) {
      const ok = await ctx.requestConfirmation(
        `${filename} already exists. Overwrite it?`,
      );
      if (!ok) {
        return { summary: `Cancelled — ${filename} kept as is.` };
      }
    }
    const lang = language ?? languageFromFilename(filename);
    const { code } = await withCodingStatus(ctx, () =>
      generateFile({ brief, filename, language: lang, context }),
    );
    await writeWorkspaceFile(ws, filename, code);

    const undoLabel = `restore ${filename}`;
    if (alreadyExists) {
      // Save previous bytes so we can roll back.
      const prior = await (async () => {
        try {
          return await readWorkspaceFile(ws, `${filename}.axon-bak`);
        } catch {
          return null;
        }
      })();
      const previousBody = prior ?? null;
      ctx.pushUndo({
        actionName: "generate_file",
        label: undoLabel,
        undo: async () => {
          if (previousBody !== null) {
            await writeWorkspaceFile(ws, filename, previousBody);
            return `Restored ${filename}.`;
          }
          await deleteWorkspaceFile(ws, filename);
          return `Removed ${filename}.`;
        },
      });
    } else {
      ctx.pushUndo({
        actionName: "generate_file",
        label: `delete ${filename}`,
        undo: async () => {
          try {
            await deleteWorkspaceFile(ws, filename);
            return `Removed ${filename}.`;
          } catch (e) {
            return `Couldn't delete ${filename}: ${(e as Error).message}`;
          }
        },
      });
    }

    ctx.logActivity({
      actionName: "generate_file",
      params: { filename, brief: brief.slice(0, 60), language: lang },
      summary: `Wrote ${filename} (${code.length} chars)`,
      confirmed: true,
    });
    return {
      summary: alreadyExists
        ? `Rewrote ${filename}.`
        : `Created ${filename}.`,
      data: {
        path: safeJoin(ws, filename),
        bytes: code.length,
        preview: code.slice(0, 240),
      },
    };
  },
};

export const modifyFileAction: AxonAction<
  { filename: string; brief: string; language?: string },
  { path: string; bytes: number; preview: string }
> = {
  name: "modify_file",
  description:
    "Apply a change to an existing workspace file using Claude. The `brief` describes the change in natural language ('add a loading state', 'rename foo to bar', 'extract the click handler into a hook'). The full revised file is written back.",
  input_schema: {
    type: "object",
    properties: {
      filename: { type: "string", description: "Path relative to workspace root." },
      brief: { type: "string", description: "Description of the change to make." },
      language: { type: "string", description: "Optional language override." },
    },
    required: ["filename", "brief"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ filename, brief, language }, ctx) => {
    const ws = workspaceOrNull();
    if (!ws) {
      return { summary: "No workspace set." };
    }
    let current: string;
    try {
      current = await readWorkspaceFile(ws, filename);
    } catch (e) {
      return { summary: `Can't open ${filename}: ${(e as Error).message}` };
    }
    const lang = language ?? languageFromFilename(filename);
    const { code } = await withCodingStatus(ctx, () =>
      modifyFile({ brief, filename, current, language: lang }),
    );
    if (code.trim() === current.trim()) {
      return { summary: `No changes needed for ${filename}.` };
    }
    await writeWorkspaceFile(ws, filename, code);

    const previousBody = current;
    ctx.pushUndo({
      actionName: "modify_file",
      label: `revert ${filename}`,
      undo: async () => {
        await writeWorkspaceFile(ws, filename, previousBody);
        return `Reverted ${filename}.`;
      },
    });

    ctx.logActivity({
      actionName: "modify_file",
      params: { filename, brief: brief.slice(0, 60) },
      summary: `Modified ${filename} (${code.length} chars)`,
      confirmed: true,
    });
    return {
      summary: `Modified ${filename}.`,
      data: { path: safeJoin(ws, filename), bytes: code.length, preview: code.slice(0, 240) },
    };
  },
};

export const scaffoldFeatureAction: AxonAction<
  { name: string; brief: string; basePath?: string; context?: string },
  { written: string[]; failed: string[] }
> = {
  name: "scaffold_feature",
  description:
    "Generate a multi-file feature scaffold — Claude designs a small set of files (≤ 5) and writes them all. Use for 'set up an auth flow', 'scaffold a settings page', etc. `basePath` defaults to 'src/features/<name>/'.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short feature name (kebab-case preferred)." },
      brief: { type: "string", description: "What the feature does and what files it should include." },
      basePath: { type: "string", description: "Optional base path inside the workspace." },
      context: { type: "string", description: "Optional project context/conventions." },
    },
    required: ["name", "brief"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ name, brief, basePath, context }, ctx) => {
    const ws = workspaceOrNull();
    if (!ws) {
      return { summary: "No workspace set." };
    }
    const base = (basePath ?? `src/features/${name}`).replace(/^\/+/, "").replace(/\/+$/g, "");
    let scaffold: Awaited<ReturnType<typeof scaffoldFeature>>;
    try {
      scaffold = await withCodingStatus(ctx, () =>
        scaffoldFeature({ brief, basePath: base, context }),
      );
    } catch (e) {
      return { summary: `Scaffold failed: ${(e as Error).message}` };
    }
    const written: string[] = [];
    const failed: string[] = [];
    for (const f of scaffold.files) {
      const target = `${base}/${f.path.replace(/^\/+/, "")}`;
      try {
        await writeWorkspaceFile(ws, target, f.content);
        written.push(target);
      } catch (e) {
        failed.push(`${target}: ${(e as Error).message}`);
      }
    }
    if (written.length > 0) {
      const writtenCopy = [...written];
      ctx.pushUndo({
        actionName: "scaffold_feature",
        label: `delete ${name} scaffold (${written.length} files)`,
        undo: async () => {
          let removed = 0;
          for (const p of writtenCopy) {
            try {
              await deleteWorkspaceFile(ws, p);
              removed++;
            } catch {
              /* swallow */
            }
          }
          return `Removed ${removed} scaffold files.`;
        },
      });
    }
    ctx.logActivity({
      actionName: "scaffold_feature",
      params: { name, brief: brief.slice(0, 60), basePath: base },
      summary: `Scaffold ${name}: ${written.length} written, ${failed.length} failed`,
      confirmed: true,
    });
    return {
      summary:
        failed.length === 0
          ? `Scaffolded ${name} with ${written.length} ${written.length === 1 ? "file" : "files"}.`
          : `Scaffolded ${name}: ${written.length} written, ${failed.length} failed.`,
      data: { written, failed },
    };
  },
};

export const deleteWorkspaceFileAction: AxonAction<
  { path: string },
  { deleted: boolean }
> = {
  name: "delete_workspace_file",
  description:
    "Delete a file inside the workspace. Destructive — always confirms first. Undo restores from a snapshot.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path relative to workspace root." },
    },
    required: ["path"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ path }, ctx) => {
    const ws = workspaceOrNull();
    if (!ws) return { summary: "No workspace set." };
    let snapshot: string | null = null;
    try {
      snapshot = await readWorkspaceFile(ws, path);
    } catch {
      // If the file doesn't exist, fall through — delete will just throw cleanly.
    }
    try {
      await deleteWorkspaceFile(ws, path);
    } catch (e) {
      return { summary: `Couldn't delete ${path}: ${(e as Error).message}` };
    }
    if (snapshot !== null) {
      const body = snapshot;
      ctx.pushUndo({
        actionName: "delete_workspace_file",
        label: `restore ${path}`,
        undo: async () => {
          await writeWorkspaceFile(ws, path, body);
          return `Restored ${path}.`;
        },
      });
    }
    ctx.logActivity({
      actionName: "delete_workspace_file",
      params: { path },
      summary: `Deleted ${path}`,
      confirmed: true,
    });
    return { summary: `Deleted ${path}.`, data: { deleted: true } };
  },
};

// ── add_page — one-shot page creation ───────────────────────────────────
//
// "Create a billing page" → one tool call. Detects the project's
// router (TanStack Router file-based, Next.js App Router, Next.js
// Pages, or generic fallback), generates the route file at the
// correct path with a sensible component scaffold, and reports
// back what (if anything) the operator still needs to do
// (typically just "wire it into your sidebar" since sidebar
// configs vary too much across projects to safely auto-edit).

type RouterKind = "tanstack-file" | "next-app" | "next-pages" | "vite-only";

interface RouterDetection {
  kind: RouterKind;
  /** Where new route files should land. Relative to workspace root. */
  routesDir: string;
  /** Optional notes for the operator. */
  note?: string;
}

async function detectRouter(ws: string): Promise<RouterDetection> {
  // Probe in order of specificity. Use ensureWorkspaceExists for each
  // candidate to avoid raising on missing dirs.
  const exists = async (rel: string) => {
    try {
      await readWorkspaceFile(ws, rel);
      return true;
    } catch {
      return false;
    }
  };
  // TanStack Router file-based — distinguishing marker is the
  // generated route tree OR the root route file pattern.
  if (
    (await exists("src/routeTree.gen.ts")) ||
    (await exists("src/routes/__root.tsx")) ||
    (await exists("routes/__root.tsx"))
  ) {
    const root = (await exists("src/routes/__root.tsx"))
      ? "src/routes"
      : "routes";
    return { kind: "tanstack-file", routesDir: root };
  }
  // Next.js App Router — `app/` or `src/app/` with a layout.tsx.
  if (await exists("src/app/layout.tsx")) {
    return { kind: "next-app", routesDir: "src/app" };
  }
  if (await exists("app/layout.tsx")) {
    return { kind: "next-app", routesDir: "app" };
  }
  // Next.js Pages Router — `pages/` or `src/pages/`.
  if (await exists("src/pages/_app.tsx") || await exists("src/pages/index.tsx")) {
    return { kind: "next-pages", routesDir: "src/pages" };
  }
  if (await exists("pages/_app.tsx") || await exists("pages/index.tsx")) {
    return { kind: "next-pages", routesDir: "pages" };
  }
  // Fallback — vanilla Vite/CRA. Drop a component into src/pages.
  return {
    kind: "vite-only",
    routesDir: "src/pages",
    note: "No router detected — generated a standalone component. You'll need to register the route in your router yourself.",
  };
}

function toKebab(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function toPascal(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

function normalizeRoutePath(input: string | undefined, kebab: string): string {
  if (!input) return `/${kebab}`;
  const cleaned = input.trim().replace(/^\/+/, "").replace(/\/+$/, "");
  return `/${cleaned || kebab}`;
}

function tanstackRouteTemplate(componentName: string, routePath: string): string {
  return `import { createLazyFileRoute } from "@tanstack/react-router";

function ${componentName}Route() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">${componentName}</h1>
      <p className="text-muted-foreground mt-2">
        TODO: replace this placeholder with the real ${componentName} content.
      </p>
    </div>
  );
}

export const Route = createLazyFileRoute("${routePath}")({
  component: ${componentName}Route,
});

export default ${componentName}Route;
`;
}

function nextAppRouteTemplate(componentName: string): string {
  return `export default function ${componentName}Page() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">${componentName}</h1>
      <p className="text-muted-foreground mt-2">
        TODO: replace this placeholder with the real ${componentName} content.
      </p>
    </div>
  );
}
`;
}

function nextPagesRouteTemplate(componentName: string): string {
  return `export default function ${componentName}Page() {
  return (
    <div style={{ padding: 24 }}>
      <h1>${componentName}</h1>
      <p>TODO: replace this placeholder with the real ${componentName} content.</p>
    </div>
  );
}
`;
}

export const addPageAction: AxonAction<
  { name: string; brief?: string; routePath?: string },
  { path: string; routerKind: RouterKind; routePath: string }
> = {
  name: "add_page",
  description:
    "Create a new page in one shot. Detects the project router (TanStack file-based, Next.js App or Pages router, or vanilla) and generates the route file at the correct location with a working scaffold — no need to ask the operator to create the file first. `name` is the page name (e.g. \"Billing\", \"User Settings\"); `routePath` overrides the URL (defaults to /<kebab-name>); `brief` lets you customize what the page should render. Use this whenever the operator says \"page\" or \"route\" — it beats two separate generate_file + manual-route-edit calls.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "Page display name. e.g. 'Billing', 'User Settings'.",
      },
      brief: {
        type: "string",
        description: "Optional description of what the page should contain (used to customize the scaffold via Claude).",
      },
      routePath: {
        type: "string",
        description: "Optional URL path, e.g. '/billing' or '/admin/users'. Defaults to /<kebab-cased-name>.",
      },
    },
    required: ["name"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ name, brief, routePath }, ctx) => {
    const ws = workspaceOrNull();
    if (!ws) return { summary: "No workspace set. Say 'set workspace' first." };

    const kebab = toKebab(name);
    const pascal = toPascal(name);
    const finalPath = normalizeRoutePath(routePath, kebab);
    const detection = await detectRouter(ws);

    // Pick destination + template based on detected router.
    let destFile: string;
    let scaffold: string;
    switch (detection.kind) {
      case "tanstack-file":
        destFile = `${detection.routesDir}/${kebab}.lazy.tsx`;
        scaffold = tanstackRouteTemplate(pascal, finalPath);
        break;
      case "next-app":
        destFile = `${detection.routesDir}${finalPath}/page.tsx`;
        scaffold = nextAppRouteTemplate(pascal);
        break;
      case "next-pages":
        destFile = `${detection.routesDir}${finalPath}.tsx`;
        scaffold = nextPagesRouteTemplate(pascal);
        break;
      case "vite-only":
        destFile = `${detection.routesDir}/${pascal}.tsx`;
        scaffold = tanstackRouteTemplate(pascal, finalPath).replace(
          /import \{ createLazyFileRoute[^;]*;\n\n/,
          ""
        ).replace(/export const Route[\s\S]*$/, "");
        break;
    }

    // If a brief is provided, hand the scaffold off to Claude so the
    // body matches what the operator asked for. Otherwise ship the
    // template as-is.
    let body = scaffold;
    if (brief && brief.trim().length > 0) {
      try {
        const { code } = await withCodingStatus(ctx, () =>
          generateFile({
            brief: `Build the ${name} page. ${brief.trim()}\n\nIMPORTANT: keep the route registration and exports EXACTLY as in the scaffold below. Only customize the inner JSX.\n\nScaffold:\n${scaffold}`,
            filename: destFile,
            language: "tsx",
          })
        );
        if (code && code.trim().length > 0) body = code;
      } catch {
        // Fall back to the plain scaffold if Claude generation fails.
      }
    }

    // Refuse to clobber unless the operator confirms.
    let alreadyExists = false;
    try {
      await readWorkspaceFile(ws, destFile);
      alreadyExists = true;
    } catch {
      alreadyExists = false;
    }
    if (alreadyExists) {
      const ok = await ctx.requestConfirmation(
        `${destFile} already exists. Overwrite it?`,
      );
      if (!ok) {
        return { summary: `Cancelled — ${destFile} kept as is.` };
      }
    }

    await writeWorkspaceFile(ws, destFile, body);

    ctx.pushUndo({
      actionName: "add_page",
      label: `remove ${destFile}`,
      undo: async () => {
        try {
          await deleteWorkspaceFile(ws, destFile);
          return `Removed ${destFile}.`;
        } catch (e) {
          return `Couldn't remove ${destFile}: ${(e as Error).message}`;
        }
      },
    });

    ctx.logActivity({
      actionName: "add_page",
      params: { name, routePath: finalPath, routerKind: detection.kind },
      summary: `Added ${name} page at ${finalPath} (${detection.kind})`,
      confirmed: true,
    });

    const sidebarHint =
      detection.kind === "tanstack-file"
        ? " Route tree auto-regenerates via the TanStack Vite plugin — page is live at " + finalPath + " once Vite reloads. Add a sidebar entry yourself if you want it in the nav."
        : detection.kind === "vite-only"
        ? " " + (detection.note ?? "")
        : "";

    return {
      summary: `Created ${name} at ${destFile}.${sidebarHint}`,
      data: { path: safeJoin(ws, destFile), routerKind: detection.kind, routePath: finalPath },
    };
  },
};

export function registerCodeActions() {
  registerAction(setWorkspaceAction);
  registerAction(currentWorkspaceAction);
  registerAction(listWorkspaceAction);
  registerAction(findFileAction);
  registerAction(searchFilesAction);
  registerAction(readWorkspaceFileAction);
  registerAction(generateFileAction);
  registerAction(modifyFileAction);
  registerAction(scaffoldFeatureAction);
  registerAction(addPageAction);
  registerAction(deleteWorkspaceFileAction);
}
