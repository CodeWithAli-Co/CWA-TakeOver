// ───────────────────────────────────────────────────────────────────
// Action Executor — runs a named action with the current context.
// Clean separation: the brain picks the action, the executor runs it.
// ───────────────────────────────────────────────────────────────────

import type { ActionContext, AxonActionResult } from "../types";
import { getAction } from "../actions/registry";
import { appendAudit } from "./auditLog";
import { verifyVoice } from "./voicePrint";
import { axonGraph } from "./graphStore";
import { getSimulationMode } from "./simulationFlag";

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
  /** When true, every mutating action returns a simulated success
   *  without running the handler. Lets the agent build a full plan
   *  the operator can review before re-running for real. */
  simulationMode?: boolean;
  /** When set, mutating actions run a voice-print check first.
   *  `vector` is the enrolled print, `threshold` the cosine cutoff. */
  voicePrintGate?: {
    vector: number[];
    threshold: number;
  };
}

/** Actions that bypass voice-print gating regardless of mutating flag.
 *  These are the ways the operator turns the gate on/off — gating
 *  them would lock the operator out of their own controls. */
const VOICE_GATE_BYPASS = new Set<string>([
  "enroll_voice_print",
  "enable_voice_gate",
  "disable_voice_gate",
  "test_voice_print",
]);

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

  // Voice-print gate: if enabled and the operator has enrolled a
  // print, snapshot the speaker before any mutating action and refuse
  // when the cosine similarity falls below the configured threshold.
  // The gate-management actions themselves (enroll / enable / disable
  // / test) bypass this check so the operator can't lock themselves
  // out of their own controls.
  if (
    action.mutating &&
    opts.voicePrintGate &&
    !VOICE_GATE_BYPASS.has(actionName)
  ) {
    try {
      const result = await verifyVoice(
        opts.voicePrintGate.vector,
        opts.voicePrintGate.threshold,
      );
      if (result && !result.pass) {
        const msg =
          `Voice didn't match (similarity ${result.score.toFixed(2)} ` +
          `vs threshold ${opts.voicePrintGate.threshold.toFixed(2)}). ` +
          `Action blocked.`;
        appendAudit({
          actionName,
          params: input,
          summary: msg,
          success: false,
          error: "voice-print-mismatch",
          operator: ctx.operator.username,
          activeCompany: ctx.activeCompany,
          dryRun: ctx.dryRun,
        });
        return { ok: false, error: msg, actionName };
      }
      // If verifyVoice returned null (mic unavailable, etc.) we fail
      // closed — don't run the action when we can't verify.
      if (!result) {
        return {
          ok: false,
          error: "Voice gate is on but the microphone wasn't reachable.",
          actionName,
        };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `Voice gate failed: ${msg}`, actionName };
    }
  }

  // Simulation short-circuit — when on, mutating actions return a
  // synthetic "simulated" result without running the handler.
  const isSimulated = (opts.simulationMode ?? getSimulationMode()) && action.mutating;

  // Mind-map event: tool start.
  const t0 = performance.now();
  const graphNode = axonGraph.startTool({
    toolName: actionName,
    input,
    simulated: isSimulated,
  });

  if (isSimulated) {
    const summary = `(simulated) ${actionName.replace(/_/g, " ")}`;
    if (graphNode) {
      axonGraph.endTool({
        nodeId: graphNode.id,
        ok: true,
        summary,
        durationMs: 0,
      });
    }
    return {
      ok: true,
      result: {
        summary,
        data: {
          simulated: true,
          actionName,
          input,
          note:
            "Operator is in simulation mode. Continue planning as if " +
            "this action had succeeded; the operator will approve before " +
            "anything is actually executed.",
        },
      },
      actionName,
    };
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
    // Mind-map event: tool ok.
    if (graphNode) {
      axonGraph.endTool({
        nodeId: graphNode.id,
        ok: true,
        summary: result.summary,
        durationMs: Math.round(performance.now() - t0),
        result: result.data,
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
    // Mind-map event: tool error.
    if (graphNode) {
      axonGraph.endTool({
        nodeId: graphNode.id,
        ok: false,
        error: message,
        durationMs: Math.round(performance.now() - t0),
      });
    }
    return { ok: false, error: message, actionName };
  }
}
