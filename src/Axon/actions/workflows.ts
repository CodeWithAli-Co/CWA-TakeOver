// ───────────────────────────────────────────────────────────────────
// Multi-step workflow actions.
//
// The single big idea here is `chain_commands`: instead of asking the
// operator to spell out each step, AXON accepts a list of natural-
// language commands and runs them sequentially. Each step goes through
// the full brain → executor pipeline so it gets the same context,
// confirmations, undo registration, and audit logging as a single
// utterance.
//
// Why this matters: "onboard a new intern" is one human request, but
// underneath it's create_task + send_chat_message + create_meeting +
// schedule_automation. With chain_commands AXON can plan that as a
// list and execute it without making the operator say each step.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { runBoundCommand } from "../engine/commandExecutor";
import { runWorkflow, summarizeWorkflowResult } from "../engine/workflow";

/** Hard cap to keep accidental loops from spiraling. 12 is plenty for
 *  realistic onboarding / cleanup / "do everything" flows. */
const MAX_STEPS = 12;

/** Floor delay between steps so we don't slam the model with 5 turns
 *  in 200ms — Anthropic prefers a brief pause between chained calls. */
const INTER_STEP_DELAY_MS = 350;

export const chainCommandsAction: AxonAction<
  {
    description: string;
    commands: string[];
    stopOnError?: boolean;
  },
  {
    completed: number;
    total: number;
    failedAt?: number;
  }
> = {
  name: "chain_commands",
  description:
    "Run a sequence of natural-language commands one after another. Each command goes through the full brain pipeline (so each step gets context, confirmations, undo). Use when the operator says something compound like 'onboard a new intern', 'wrap up that meeting', 'set up the morning briefing' — anything that's really 3-6 atomic actions wearing one hat. Cap is 12 steps per call.",
  input_schema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description:
          "One-line summary of what this chain accomplishes (used for activity log).",
      },
      commands: {
        type: "array",
        items: { type: "string" },
        description:
          "The ordered list of natural-language commands. Each one will be re-issued to the brain as if the operator typed it. Up to 12 steps.",
      },
      stopOnError: {
        type: "boolean",
        description:
          "Default true — if a step fails, halt the chain. Set false to keep going through remaining steps.",
      },
    },
    required: ["description", "commands"],
  },
  mutating: true,
  handler: async ({ description, commands, stopOnError }, ctx) => {
    if (!commands.length) {
      return { summary: "Nothing to chain — no commands provided." };
    }
    const limited = commands.slice(0, MAX_STEPS);
    const stop = stopOnError !== false; // default true

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would run ${limited.length}-step chain: ${description}`,
        data: { completed: 0, total: limited.length },
      };
    }

    ctx.note(
      `Starting ${limited.length}-step workflow: ${description}`,
    );

    let completed = 0;
    let failedAt: number | undefined;

    for (let i = 0; i < limited.length; i++) {
      const step = limited[i];
      try {
        ctx.note(`[${i + 1}/${limited.length}] ${step}`);
        await runBoundCommand(step, "text");
        completed += 1;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        ctx.note(`Step ${i + 1} failed: ${msg}`);
        failedAt = i + 1;
        if (stop) break;
      }
      // Pause before the next step. Skip the trailing pause after the
      // final step.
      if (i < limited.length - 1) {
        await new Promise((r) => setTimeout(r, INTER_STEP_DELAY_MS));
      }
    }

    ctx.logActivity({
      actionName: "chain_commands",
      params: {
        description,
        steps: limited.length,
        completed,
        failedAt,
      },
      summary:
        failedAt === undefined
          ? `Chain "${description}" — ${completed}/${limited.length} done`
          : `Chain "${description}" stopped at step ${failedAt}`,
    });

    return {
      summary:
        failedAt === undefined
          ? `Done — ran all ${completed} steps of "${description}".`
          : `Ran ${completed}/${limited.length} steps of "${description}" before step ${failedAt} failed.`,
      data: { completed, total: limited.length, failedAt },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════
// PRE-BAKED FLAGSHIP WORKFLOWS
//
// `chain_commands` (above) handles operator-described compounds by
// re-routing each step through the brain. Powerful but expensive --
// every step is a model round-trip.
//
// The workflows below are the complementary pattern: KNOWN compound
// operations with fixed primitive sequences and NO brain round-trip.
// Direct dispatch from the action handler through runWorkflow() to
// the existing primitive tools in the registry. One model call
// becomes N database operations + one summary.
//
// Use chain_commands when the operator describes a novel compound.
// Use these when the choreography is stable enough to bake in.
// ═══════════════════════════════════════════════════════════════════

// ── close_candidate ────────────────────────────────────────────────
//
// Operator says "close Cesar" / "drop X" / "remove Y from the
// pipeline". The brain calls this one tool, which internally:
//   1. update_candidate_status (status="rejected")
//   2. record_decision ("Closed {name} from the hiring pipeline")
// Both required -- if the status update can't find them, abort.
// If decision recording fails after status updated, warn but keep
// the partial completion.

export const closeCandidateAction: AxonAction<
  { name: string; reason?: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "close_candidate",
  description:
    "Close a candidate from the hiring pipeline. Compound: updates their status to rejected AND records the decision so we don't keep re-litigating it. Use when the operator says 'close X', 'drop Y', 'remove Z from pipeline', 'we're not moving forward with N'. Prefer this over calling update_candidate_status alone -- a closure that doesn't log a decision is one we'll revisit next week.",
  input_schema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The candidate's full name as it appears in the pipeline.",
      },
      reason: {
        type: "string",
        description:
          "Optional one-line reason -- 'wrong stage', 'culture fit', 'compensation gap', 'test candidate', etc. Folded into the recorded decision.",
      },
    },
    required: ["name"],
  },
  mutating: true,
  handler: async ({ name, reason }, ctx) => {
    const reasonClause = reason ? ` (${reason})` : "";
    const result = await runWorkflow(
      [
        {
          action: "update_candidate_status",
          input: { name, status: "rejected" },
          label: "Update status",
          onError: "abort",
        },
        {
          action: "record_decision",
          input: {
            text: `Closed ${name} from the hiring pipeline${reasonClause}.`,
          },
          label: "Record decision",
          onError: "warn",
        },
      ],
      ctx,
    );

    return {
      summary: summarizeWorkflowResult(
        result,
        `Closed ${name}${reasonClause}. Status updated, decision logged.`,
        `Couldn't fully close ${name}`,
      ),
      data: {
        ok: result.ok,
        steps_completed: result.steps.filter((s) => s.ok).length,
      },
    };
  },
};

// ── wrap_meeting ───────────────────────────────────────────────────
//
// Operator just finished a meeting (or is about to log one). One
// intent → record_decision + optional create_task. Captures both
// the memory side (so the convo surfaces later) and the planner
// side (so the action item doesn't slip).

export const wrapMeetingAction: AxonAction<
  { meeting_title: string; outcome: string; followup?: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "wrap_meeting",
  description:
    "Wrap up a meeting that just ended. Compound: records the outcome as a decision (so we don't re-debate it later) AND optionally creates a follow-up task. Use when the operator says 'log that we decided X in the meeting', 'wrap up that meeting with Y', 'we agreed to ship Friday, make me a task'. Prefer this over calling record_decision and create_task separately.",
  input_schema: {
    type: "object",
    properties: {
      meeting_title: {
        type: "string",
        description:
          "Name of the meeting being wrapped. Appears in both the decision and the task title.",
      },
      outcome: {
        type: "string",
        description: "What was decided. One sentence, no preamble.",
      },
      followup: {
        type: "string",
        description:
          "Optional follow-up task to create. If omitted, no task is created -- the decision is still recorded.",
      },
    },
    required: ["meeting_title", "outcome"],
  },
  mutating: true,
  handler: async ({ meeting_title, outcome, followup }, ctx) => {
    const steps: Parameters<typeof runWorkflow>[0] = [
      {
        action: "record_decision",
        input: { text: `${meeting_title}: ${outcome}` },
        label: "Record decision",
        onError: "abort",
      },
    ];
    if (followup) {
      steps.push({
        action: "create_task",
        input: { title: followup },
        label: "Create follow-up task",
        onError: "warn",
      });
    }
    const result = await runWorkflow(steps, ctx);

    return {
      summary: summarizeWorkflowResult(
        result,
        followup
          ? `Wrapped ${meeting_title}: outcome logged, follow-up task created.`
          : `Wrapped ${meeting_title}: outcome logged.`,
        `Couldn't fully wrap ${meeting_title}`,
      ),
      data: {
        ok: result.ok,
        steps_completed: result.steps.filter((s) => s.ok).length,
      },
    };
  },
};

// ── log_outreach ───────────────────────────────────────────────────
//
// Operator: "I just reached out to Acme about the Q4 thing." One
// intent → record_decision (relationship history) + create_task
// (follow-up if no reply in N days).

export const logOutreachAction: AxonAction<
  { contact: string; topic: string; followup_days?: number },
  { ok: boolean; steps_completed: number }
> = {
  name: "log_outreach",
  description:
    "Record that the operator just reached out to someone, and set a follow-up task for if they don't reply. Compound: writes the outreach to decisions (so it's part of the relationship history) and creates a 'check in if no reply' task. Use when the operator says 'just emailed Acme about Q4', 'pinged the Northwind CFO', 'reached out to Sarah about the design review'.",
  input_schema: {
    type: "object",
    properties: {
      contact: {
        type: "string",
        description:
          "Who was contacted -- person name, company, or both. Verbatim into both the decision and the follow-up task.",
      },
      topic: {
        type: "string",
        description: "What it was about, one short phrase.",
      },
      followup_days: {
        type: "number",
        description:
          "Days to wait before the check-in task surfaces. Defaults to 4 -- enough to give a reply, not so long the thread goes cold.",
      },
    },
    required: ["contact", "topic"],
  },
  mutating: true,
  handler: async ({ contact, topic, followup_days = 4 }, ctx) => {
    const result = await runWorkflow(
      [
        {
          action: "record_decision",
          input: { text: `Reached out to ${contact} about ${topic}.` },
          label: "Log outreach",
          onError: "abort",
        },
        {
          action: "create_task",
          input: {
            title: `Check in with ${contact} about ${topic} if no reply`,
            deadline: new Date(
              Date.now() + followup_days * 86_400_000,
            ).toISOString(),
          },
          label: "Create follow-up task",
          onError: "warn",
        },
      ],
      ctx,
    );

    return {
      summary: summarizeWorkflowResult(
        result,
        `Outreach to ${contact} logged. Follow-up task lands in ${followup_days} day${followup_days === 1 ? "" : "s"}.`,
        `Logged outreach but couldn't set the follow-up`,
      ),
      data: {
        ok: result.ok,
        steps_completed: result.steps.filter((s) => s.ok).length,
      },
    };
  },
};

export function registerWorkflowActions() {
  registerAction(chainCommandsAction);
  // Pre-baked flagship workflows (F.1).
  registerAction(closeCandidateAction);
  registerAction(wrapMeetingAction);
  registerAction(logOutreachAction);
}
