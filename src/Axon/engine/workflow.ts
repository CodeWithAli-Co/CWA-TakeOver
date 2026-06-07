// ───────────────────────────────────────────────────────────────────
// Workflow engine -- composed multi-action sequences.
//
// Today's Axon brain can already call multiple tools per turn (the
// agent loop iterates), but each tool runs in isolation and Claude
// has to re-discover the choreography every single time the operator
// asks for a compound thing ("close Cesar's pipeline", "wrap up that
// meeting", "do the morning routine"). That re-discovery wastes
// tokens and is brittle -- one bad tool pick mid-chain and the whole
// intent breaks.
//
// A workflow is a NAMED sequence of action invocations the brain can
// invoke as a single tool. Each step's result is available to the
// next step via a shared scratchpad, error behavior is declared per-
// step, and the aggregate result is one summary the brain can pass
// back to the operator.
//
// Crucially: workflows are NOT a replacement for action composition
// at the brain level. The brain still picks tools freely. Workflows
// are for STABLE, REPEATED compound operations where the choreography
// has already been worked out -- closing a candidate, wrapping a
// meeting, ending the day. Anything novel: brain composes ad-hoc.
//
// Each workflow registers itself as a regular AxonAction in the
// registry, so to the brain it looks like any other tool. The
// internal sequencing is hidden behind the action interface, which
// keeps the system prompt + tool definitions clean.
// ───────────────────────────────────────────────────────────────────

import type { ActionContext, AxonActionResult } from "../types";
import { getAction } from "../actions/registry";

/** What happens when a step fails. Defaults to "abort". */
export type StepErrorBehavior =
  /** Stop the workflow, surface the failure in the aggregate. Default. */
  | "abort"
  /** Skip this step's failure, keep going. Useful for optional steps. */
  | "skip"
  /** Log a warning but continue. Like skip, but the aggregate still says ok=false. */
  | "warn";

export interface WorkflowStep {
  /** Action name from the registry. */
  action: string;
  /**
   * Input for the action. Either a static object or a function that
   * receives the shared scratchpad (results from previous outputAs
   * steps) and returns the input dynamically.
   *
   * Example -- close_candidate looks up the id from a previous step:
   *   { action: "find_candidate", input: { name }, outputAs: "found" },
   *   { action: "update_status",
   *     input: (shared) => ({ id: shared.found.id, status: "archived" }) },
   */
  input: Record<string, unknown> | ((shared: Record<string, unknown>) => Record<string, unknown>);
  /** What to do if the action throws or returns undefined. Default "abort". */
  onError?: StepErrorBehavior;
  /**
   * If set, store this step's `data` payload in the shared scratchpad
   * under this key for downstream steps to read.
   */
  outputAs?: string;
  /**
   * Optional human-readable label for this step in the aggregate
   * summary. If absent, the action name is used.
   */
  label?: string;
}

export interface WorkflowStepResult {
  action: string;
  label: string;
  ok: boolean;
  summary: string;
  /** Stack trace / error string when the step failed. */
  error?: string;
}

export interface WorkflowResult {
  ok: boolean;
  steps: WorkflowStepResult[];
}

/**
 * Run a workflow against the supplied ActionContext.
 *
 * Pure orchestration -- delegates to whatever action handlers are in
 * the registry. No side effects of its own. Errors thrown by an
 * action are caught and surfaced per-step; the workflow itself never
 * throws.
 */
export async function runWorkflow(
  steps: WorkflowStep[],
  ctx: ActionContext,
): Promise<WorkflowResult> {
  const shared: Record<string, unknown> = {};
  const results: WorkflowStepResult[] = [];

  for (const step of steps) {
    const label = step.label ?? step.action;
    const action = getAction(step.action);

    if (!action) {
      results.push({
        action: step.action,
        label,
        ok: false,
        summary: `Action "${step.action}" is not registered`,
        error: "ACTION_NOT_FOUND",
      });
      const behavior = step.onError ?? "abort";
      if (behavior === "abort") return { ok: false, steps: results };
      continue;
    }

    try {
      const input =
        typeof step.input === "function" ? step.input(shared) : step.input;
      const out = await action.handler(input as never, ctx);
      results.push({
        action: step.action,
        label,
        ok: true,
        summary: out.summary,
      });
      if (step.outputAs && out.data !== undefined) {
        shared[step.outputAs] = out.data;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      results.push({
        action: step.action,
        label,
        ok: false,
        summary: `${label} failed: ${errMsg}`,
        error: errMsg,
      });
      const behavior = step.onError ?? "abort";
      if (behavior === "abort") return { ok: false, steps: results };
    }
  }

  // ok: every step is ok OR was a "skip" failure. "warn" failures
  // still count against ok so the operator hears about them.
  const ok = results.every(
    (r, i) => r.ok || steps[i].onError === "skip",
  );
  return { ok, steps: results };
}

/**
 * Compose a workflow result into a single spoken summary. Prefers
 * concise success over enumerated detail -- the activity feed has
 * the full step-by-step. Falls back to "X out of Y" when there are
 * partial failures.
 */
export function summarizeWorkflowResult(
  result: WorkflowResult,
  ok_message: string,
  failure_message?: string,
): string {
  if (result.ok) return ok_message;

  const failed = result.steps.filter((s) => !s.ok);
  const failedLabels = failed.map((s) => s.label).join(", ");
  const total = result.steps.length;
  const passed = result.steps.length - failed.length;

  if (failure_message) {
    return `${failure_message} (${passed}/${total} steps -- ${failedLabels} failed)`;
  }
  return `Partial: ${passed} of ${total} steps completed. Failed: ${failedLabels}.`;
}
