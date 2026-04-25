// ───────────────────────────────────────────────────────────────────
// Multi-project actions — operator can register multiple workspaces
// and switch between them by voice ("switch to simplicity",
// "work on cwa-manager", "what projects do I have?").
//
// Active project's path becomes the workspace for ALL code-gen actions
// (generate_file, modify_file, scaffold_feature, agent loop, etc).
// ───────────────────────────────────────────────────────────────────

import type { AxonAction, CodegenProject, AxonSettings } from "../types";
import { registerAction } from "./registry";
import { pickWorkspaceDirectory, ensureWorkspaceExists } from "../engine/codegen";

// Bound by AxonProvider on mount so we can read/write the projects
// list and active id without a React cycle.
type SettingsReader = () => AxonSettings;
type SettingsWriter = (patch: Partial<AxonSettings>) => void;
let _readSettings: SettingsReader | null = null;
let _writeSettings: SettingsWriter | null = null;

export function _bindProjectAccessors(read: SettingsReader, write: SettingsWriter) {
  _readSettings = read;
  _writeSettings = write;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getProjects(): CodegenProject[] {
  return _readSettings?.()?.projects ?? [];
}

function findProject(query: string): CodegenProject | null {
  if (!query) return null;
  const projects = getProjects();
  const norm = query.toLowerCase().trim();
  // Exact id wins.
  const idHit = projects.find((p) => p.id === query);
  if (idHit) return idHit;
  // Exact name match.
  const nameHit = projects.find((p) => p.name.toLowerCase() === norm);
  if (nameHit) return nameHit;
  // Prefix / substring match.
  const subHit = projects.find(
    (p) =>
      p.name.toLowerCase().startsWith(norm) ||
      p.name.toLowerCase().includes(norm),
  );
  return subHit ?? null;
}

// ─── add / list ────────────────────────────────────────────────────────

export const addProjectAction: AxonAction<
  { name: string; path?: string; language?: string; notes?: string; activate?: boolean },
  { project: CodegenProject }
> = {
  name: "add_project",
  description:
    "Register a code-gen project with a friendly name and a folder path. If `path` is omitted, opens a folder picker. Set `activate: true` to make it the current project. Examples: 'add the simplicity project', 'register cwa-manager'.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Friendly name to use in voice ('simplicity', 'cwa-manager')." },
      path: { type: "string", description: "Optional explicit absolute path. If omitted, a folder picker opens." },
      language: { type: "string", description: "Default language for the project (typescript, python, etc)." },
      notes: { type: "string", description: "Optional context — conventions, stack, what to avoid." },
      activate: { type: "boolean", description: "Make this the active project after adding. Default true." },
    },
    required: ["name"],
  },
  handler: async ({ name, path, language, notes, activate = true }, ctx) => {
    if (!_writeSettings || !_readSettings) {
      return { summary: "Project mutator not bound." };
    }
    let chosen = path?.trim() || null;
    if (!chosen) {
      chosen = await pickWorkspaceDirectory();
      if (!chosen) {
        return { summary: "No folder selected." };
      }
    }
    if (!(await ensureWorkspaceExists(chosen))) {
      return { summary: `That path doesn't exist: ${chosen}.` };
    }
    const projects = getProjects();
    // Reject duplicate names — keeps voice resolution unambiguous.
    if (projects.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      return { summary: `A project named "${name}" already exists.` };
    }
    const project: CodegenProject = {
      id: newId("proj"),
      name,
      path: chosen,
      language,
      notes,
      createdAt: Date.now(),
    };
    const next = [...projects, project];
    const patch: Partial<AxonSettings> = { projects: next };
    if (activate) patch.activeProjectId = project.id;
    _writeSettings(patch);
    ctx.logActivity({
      actionName: "add_project",
      params: { name, path: chosen },
      summary: `Added project ${name}`,
    });
    return {
      summary: activate
        ? `Added ${name} and switched to it.`
        : `Added ${name}.`,
      data: { project },
    };
  },
};

export const listProjectsAction: AxonAction<
  Record<string, never>,
  { projects: CodegenProject[]; activeId: string | null }
> = {
  name: "list_projects",
  description: "List every code-gen project the operator has registered.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const projects = getProjects();
    const activeId = _readSettings?.()?.activeProjectId ?? null;
    if (projects.length === 0) {
      return {
        summary: "No projects yet. Say 'add a project' to register one.",
        data: { projects: [], activeId },
      };
    }
    const names = projects
      .map((p) => (p.id === activeId ? `${p.name} (active)` : p.name))
      .join(", ");
    return {
      summary: `${projects.length} project${projects.length === 1 ? "" : "s"}: ${names}.`,
      data: { projects, activeId },
    };
  },
};

export const currentProjectAction: AxonAction<
  Record<string, never>,
  { project: CodegenProject | null }
> = {
  name: "current_project",
  description: "Returns the currently active code-gen project.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const s = _readSettings?.();
    const activeId = s?.activeProjectId ?? null;
    const proj = activeId ? (s?.projects ?? []).find((p) => p.id === activeId) ?? null : null;
    return {
      summary: proj
        ? `Active project: ${proj.name} at ${proj.path}.`
        : "No active project.",
      data: { project: proj },
    };
  },
};

export const switchProjectAction: AxonAction<
  { name?: string; id?: string },
  { project: CodegenProject | null }
> = {
  name: "switch_project",
  description:
    "Switch the active project. Pass `name` (preferred — fuzzy-matched) or `id`. Examples: 'switch to simplicity', 'work on cwa-manager'.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Project name (fuzzy-matched)." },
      id: { type: "string", description: "Exact project id." },
    },
  },
  handler: async ({ name, id }, ctx) => {
    if (!_writeSettings) return { summary: "Mutator not bound." };
    const proj = findProject(id ?? name ?? "");
    if (!proj) {
      const list = getProjects()
        .map((p) => p.name)
        .join(", ");
      return {
        summary: `Couldn't find that project. Available: ${list || "none"}.`,
        data: { project: null },
      };
    }
    _writeSettings({ activeProjectId: proj.id });
    ctx.logActivity({
      actionName: "switch_project",
      params: { name: proj.name },
      summary: `Switched to ${proj.name}`,
    });
    return {
      summary: `Switched to ${proj.name}.`,
      data: { project: proj },
    };
  },
};

export const removeProjectAction: AxonAction<
  { name?: string; id?: string },
  { removed: boolean }
> = {
  name: "remove_project",
  description:
    "Forget a project (does NOT delete files on disk). Pass `name` or `id`.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      id: { type: "string" },
    },
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ name, id }, ctx) => {
    if (!_writeSettings || !_readSettings) {
      return { summary: "Mutator not bound." };
    }
    const proj = findProject(id ?? name ?? "");
    if (!proj) {
      return { summary: `No project matching "${name ?? id}".`, data: { removed: false } };
    }
    const cur = _readSettings();
    const remaining = (cur.projects ?? []).filter((p) => p.id !== proj.id);
    const patch: Partial<AxonSettings> = { projects: remaining };
    if (cur.activeProjectId === proj.id) {
      patch.activeProjectId = remaining[0]?.id ?? null;
    }
    _writeSettings(patch);
    ctx.logActivity({
      actionName: "remove_project",
      params: { name: proj.name },
      summary: `Removed project ${proj.name}`,
      confirmed: true,
    });
    return { summary: `Removed ${proj.name}.`, data: { removed: true } };
  },
};

export function registerProjectActions() {
  registerAction(addProjectAction);
  registerAction(listProjectsAction);
  registerAction(currentProjectAction);
  registerAction(switchProjectAction);
  registerAction(removeProjectAction);
}
