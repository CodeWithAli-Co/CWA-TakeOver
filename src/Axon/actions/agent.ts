// ───────────────────────────────────────────────────────────────────
// accomplish_goal — autonomous agent action.
//
// Operator says: "Axon, build a login page with social auth and route
// it under /auth" → brain calls `accomplish_goal({ goal: "...",
// projectName: "simplicity" })`. The agent then plans and executes
// without further prompting.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction, AxonSettings, CodegenProject } from "../types";
import { registerAction } from "./registry";
import { runAgent } from "../engine/agent";

// Bound by the provider so we can read the active project without prop
// drilling. Mirrors the projects module's pattern.
type SettingsReader = () => AxonSettings;
let _readSettings: SettingsReader | null = null;

export function _bindAgentAccessors(read: SettingsReader) {
  _readSettings = read;
}

function resolveProject(name: string | undefined): CodegenProject | null {
  const s = _readSettings?.();
  if (!s) return null;
  const projects = s.projects ?? [];
  if (name) {
    const norm = name.toLowerCase().trim();
    const hit = projects.find(
      (p) =>
        p.id === name ||
        p.name.toLowerCase() === norm ||
        p.name.toLowerCase().startsWith(norm) ||
        p.name.toLowerCase().includes(norm),
    );
    if (hit) return hit;
  }
  if (s.activeProjectId) {
    return projects.find((p) => p.id === s.activeProjectId) ?? null;
  }
  return projects[0] ?? null;
}

export const accomplishGoalAction: AxonAction<
  { goal: string; projectName?: string; maxIterations?: number; narrate?: boolean },
  { iterations: number; actions: number; stoppedAtCap: boolean; finalSummary: string }
> = {
  name: "accomplish_goal",
  description:
    "Autonomous engineer mode — operator describes an end result and AXON plans + executes the steps without further prompting. Examples: 'build a settings page with theme toggles', 'add a status component to the dashboard', 'refactor the auth flow into a hook'. Uses every tool you have (generate_file, modify_file, scaffold_feature, list_workspace, read_workspace_file, etc) inside the active project. Pass `projectName` to target a specific project, otherwise the active project is used.",
  input_schema: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description:
          "End result the operator wants. As specific as possible — 'add dark-mode toggle to the settings panel' beats 'make the app prettier'.",
      },
      projectName: {
        type: "string",
        description: "Optional project name to scope the work to. Default: the active project.",
      },
      maxIterations: {
        type: "number",
        description: "Optional cap on planning/execution turns. Default 14.",
      },
      narrate: {
        type: "boolean",
        description:
          "Speak progress aloud between steps. Default true. Set false when running a long job and the operator wants quiet.",
      },
    },
    required: ["goal"],
  },
  mutating: true,
  // Auto-approve relies on the operator's autoApprove setting; per-action
  // gate would block voice flow. Operator can stop with "stop" / interrupt
  // phrase mid-loop, or "undo that" after to revert file writes.
  requiresConfirmation: false,
  handler: async ({ goal, projectName, maxIterations, narrate = true }, ctx) => {
    const project = resolveProject(projectName);
    if (!project) {
      return {
        summary:
          "No project to work in. Say 'add a project' first, or pick one with switch_project.",
      };
    }
    ctx.note(`Agent goal: ${goal} (project: ${project.name})`);
    if (narrate) ctx.speak(`On it. Working on ${project.name} now.`);

    const result = await runAgent({
      goal,
      ctx,
      project,
      maxIters: maxIterations,
      narrate,
      onAction: (a) => {
        ctx.logActivity({
          actionName: `agent:${a.actionName}`,
          params: a.params,
          summary: a.summary,
          result: a.result,
          error: a.error,
          confirmed: a.confirmed,
        });
      },
      onProgress: (msg) => {
        // Surface concise progress in the system note channel — useful for
        // longer-running goals where the operator scrolls back to see what
        // happened.
        ctx.note(msg);
      },
    });

    ctx.logActivity({
      actionName: "accomplish_goal",
      params: { goal, projectName, project: project.name },
      summary: `Agent finished ${result.iterations} iterations, ${result.actions.length} actions${result.stoppedAtCap ? " (hit cap)" : ""}`,
    });

    return {
      summary: result.finalSummary,
      data: {
        iterations: result.iterations,
        actions: result.actions.length,
        stoppedAtCap: result.stoppedAtCap,
        finalSummary: result.finalSummary,
      },
      // The agent already narrated via ctx.speak per turn — don't
      // re-speak the final summary on top.
      silent: narrate,
    };
  },
};

export function registerAgentActions() {
  registerAction(accomplishGoalAction);
}
