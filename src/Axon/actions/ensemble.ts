// accomplish_with_ensemble — voice-triggerable three-agent pipeline.

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { runEnsemble } from "../engine/ensemble";

let _getActiveProject: (() => import("../types").CodegenProject | null) | null = null;
export function _bindEnsembleAccessors(get: () => import("../types").CodegenProject | null) {
  _getActiveProject = get;
}

export const accomplishWithEnsembleAction: AxonAction<
  { goal: string; narrate?: boolean; maxRevisions?: number },
  { summary: string; revisions: number; verdict?: string }
> = {
  name: "accomplish_with_ensemble",
  description:
    "Run a goal through Axon\'s ensemble (Architect → Engineer → Critic) instead of the single-agent loop. Architect produces a plan, Engineer executes it, Critic reviews and either ships or sends back for revision. Best for non-trivial multi-file features. Use this whenever the operator says \"ensemble\", \"with the team\", \"plan first\", \"have the critic review\", or for goals that warrant double-checking.",
  input_schema: {
    type: "object",
    properties: {
      goal: { type: "string", description: "The end result the operator wants." },
      narrate: { type: "boolean", description: "Speak phase progress aloud. Default true." },
      maxRevisions: { type: "number", description: "Max Engineer revision rounds after Critic feedback. Default 2." },
    },
    required: ["goal"],
  },
  silent: true, // we narrate phase headers ourselves
  handler: async ({ goal, narrate, maxRevisions }, ctx) => {
    const project = _getActiveProject?.() ?? null;
    if (!project) {
      return {
        summary:
          "No active project. Pick one with switch_project before running an ensemble.",
      };
    }
    ctx.note(`Ensemble goal: ${goal} (project: ${project.name})`);
    ctx.setStatus?.("coding");
    const result = await runEnsemble({
      goal,
      ctx,
      project,
      narrate,
      maxRevisions,
      onAction: (a) =>
        ctx.logActivity({
          actionName: `ensemble:${a.actionName}`,
          params: a.params,
          summary: a.summary,
          result: a.result,
          error: a.error,
          confirmed: a.confirmed,
        }),
    });
    return {
      summary: result.finalSummary,
      data: {
        summary: result.finalSummary,
        revisions: result.revisions,
        verdict: result.verdict?.verdict,
      },
    };
  },
};

export function registerEnsembleActions() {
  registerAction(accomplishWithEnsembleAction);
}
