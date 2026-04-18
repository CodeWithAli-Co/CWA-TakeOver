// ───────────────────────────────────────────────────────────────────
// Action Executor — runs a named action with the current context.
// Clean separation: the brain picks the action, the executor runs it.
// ───────────────────────────────────────────────────────────────────

import type { ActionContext, AxonActionResult } from "../types";
import { getAction } from "../actions/registry";

export interface ExecuteOutcome {
  ok: boolean;
  result?: AxonActionResult;
  error?: string;
  actionName: string;
}

export async function executeAction(
  actionName: string,
  input: Record<string, unknown>,
  ctx: ActionContext
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

  try {
    const result = await action.handler(input as any, ctx);
    return { ok: true, result, actionName };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[AXON] Action ${actionName} threw:`, e);
    return { ok: false, error: message, actionName };
  }
}
