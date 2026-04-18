// ───────────────────────────────────────────────────────────────────
// Action Executor — runs a named action with the current context.
// Clean separation: the brain picks the action, the executor runs it.
// ───────────────────────────────────────────────────────────────────

import type { ActionContext, AxonActionResult } from "../types";
import { getAction } from "../actions/registry";
import { appendAudit } from "./auditLog";

export interface ExecuteOutcome {
  ok: boolean;
  result?: AxonActionResult;
  error?: string;
  actionName: string;
}

export interface ExecuteOpts {
  /** Voice confidence 0..1 for the utterance that triggered this action. */
  confidence?: number;
  /** Threshold below which mutating actions gate on explicit confirmation. */
  confidenceThreshold?: number;
}

export async function executeAction(
  actionName: string,
  input: Record<string, unknown>,
  ctx: ActionContext,
  opts: ExecuteOpts = {}
): Promise<ExecuteOutcome> {
  const action = getAction(actionName);
  if (!action) {
    return { ok: false, error: `Unknown action: ${actionName}`, actionName };
  }

  // Role gate.
  if (action.allowedRoles && !action.allowedRoles.includes(ctx.operator.role)) {
    return {
      ok: false,
      error: `Operator role ${ctx.operator.role} not permitted for ${actionName}`,
      actionName,
    };
  }

  // Confidence-weighted confirmation: mutating action + low-confidence voice
  // transcript → force the operator to confirm verbally, even if the action
  // wouldn't normally require it.
  const threshold = opts.confidenceThreshold ?? 0.55;
  const lowConfidence =
    opts.confidence !== undefined && opts.confidence < threshold;
  if (action.mutating && lowConfidence && !action.requiresConfirmation) {
    const ok = await ctx.requestConfirmation(
      `Low-confidence voice input — confirm: ${actionName.replace(/_/g, " ")}?`
    );
    if (!ok) {
      return {
        ok: true,
        result: { summary: "Cancelled — unclear transcript." },
        actionName,
      };
    }
  }

  try {
    const result = await action.handler(input as any, ctx);
    // Audit mutating actions (both real runs and dry-runs).
    if (action.mutating) {
      appendAudit({
        actionName,
        params: input,
        summary: result.summary,
        success: true,
        operator: ctx.operator.username,
        activeCompany: ctx.activeCompany,
        dryRun: ctx.dryRun,
      });
    }
    return { ok: true, result, actionName };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[AXON] Action ${actionName} threw:`, e);
    if (action.mutating) {
      appendAudit({
        actionName,
        params: input,
        summary: "failed",
        success: false,
        error: message,
        operator: ctx.operator.username,
        activeCompany: ctx.activeCompany,
        dryRun: ctx.dryRun,
      });
    }
    return { ok: false, error: message, actionName };
  }
}
