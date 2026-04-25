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
} from "../engine/codegen";

// Workspace accessors — bound by AxonProvider on mount so we can
// read and write the codegenWorkspace setting without a React cycle.
type WorkspaceGetter = () => string | null;
type WorkspaceSetter = (path: string | null) => void;
let _getWorkspace: WorkspaceGetter | null = null;
let _setWorkspace: WorkspaceSetter | null = null;

export function _bindCodegenAccessors(get: WorkspaceGetter, set: WorkspaceSetter) {
  _getWorkspace = get;
  _setWorkspace = set;
}

function workspaceOrNull(): string | null {
  return _getWorkspace?.() ?? null;
}

function workspaceLabel(ws: string): string {
  // Trim long absolute paths in spoken output.
  const norm = ws.replace(/\\/g, "/");
  const parts = norm.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || norm;
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
    "Choose or set the folder where AXON writes generated code. If `path` is given, sets it directly. Otherwise opens a folder picker. Required before any code-generation action runs.",
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
    if (!chosen) {
      chosen = await pickWorkspaceDirectory();
      if (!chosen) {
        return {
          summary: "No folder selected.",
          data: { workspace: workspaceOrNull() },
        };
      }
    }
    if (!(await ensureWorkspaceExists(chosen))) {
      return {
        summary: `That path doesn't exist: ${chosen}.`,
        data: { workspace: workspaceOrNull() },
      };
    }
    _setWorkspace(chosen);
    ctx.logActivity({
      actionName: "set_workspace",
      params: { path: chosen },
      summary: `Workspace set to ${workspaceLabel(chosen)}`,
    });
    return {
      summary: `Workspace set to ${workspaceLabel(chosen)}.`,
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
  { path?: string },
  { entries: Array<{ name: string; isDir: boolean; path: string }> }
> = {
  name: "list_workspace",
  description:
    "List files and folders inside the workspace. Pass `path` to scope to a subfolder.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Subfolder path relative to workspace root." },
    },
  },
  handler: async ({ path = "" }, _ctx) => {
    const ws = workspaceOrNull();
    if (!ws) {
      return {
        summary: "No workspace set. Say 'set workspace' first.",
        data: { entries: [] },
      };
    }
    try {
      const entries = await listWorkspace(ws, path);
      const summary =
        entries.length === 0
          ? "Folder is empty."
          : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}: ${entries
              .slice(0, 8)
              .map((e) => e.name)
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
    const { code } = await generateFile({ brief, filename, language: lang, context });
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
    const { code } = await modifyFile({ brief, filename, current, language: lang });
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
      scaffold = await scaffoldFeature({ brief, basePath: base, context });
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

export function registerCodeActions() {
  registerAction(setWorkspaceAction);
  registerAction(currentWorkspaceAction);
  registerAction(listWorkspaceAction);
  registerAction(readWorkspaceFileAction);
  registerAction(generateFileAction);
  registerAction(modifyFileAction);
  registerAction(scaffoldFeatureAction);
  registerAction(deleteWorkspaceFileAction);
}
