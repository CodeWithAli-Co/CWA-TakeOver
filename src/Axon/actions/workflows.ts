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
import { planOpsGoal } from "../engine/opsPlanner";

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

// ── archive_deal ───────────────────────────────────────────────────
//
// Operator: "we lost the Acme deal" / "Northwind is dead" / "kill
// the Q4 SaaS deal." One intent → move the deal to closed-lost +
// record the decision + ping the account owner so the team
// finds out from us, not the dashboard.

export const archiveDealAction: AxonAction<
  { deal_name: string; reason?: string; ping_channel?: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "archive_deal",
  description:
    "Mark a CRM deal as closed-lost and let the team know. Compound: moves the deal to closed-lost AND records the decision (so it's part of the relationship history) AND pings the configured Slack channel. Use when the operator says 'we lost X', 'kill the Y deal', 'Z is dead', 'archive the Acme opportunity'. Prefer this over move_deal alone -- a quiet close in the CRM that the team finds out about later is the bug pattern.",
  input_schema: {
    type: "object",
    properties: {
      deal_name: { type: "string", description: "The deal name as it appears in the CRM." },
      reason: { type: "string", description: "One-line reason -- 'budget', 'competitor', 'timing', etc. Folded into the decision." },
      ping_channel: { type: "string", description: "Slack channel to post to. Defaults to #sales." },
    },
    required: ["deal_name"],
  },
  mutating: true,
  handler: async ({ deal_name, reason, ping_channel }, ctx) => {
    const reasonClause = reason ? ` (${reason})` : "";
    const channel = ping_channel ?? "#sales";
    const result = await runWorkflow(
      [
        {
          action: "move_deal",
          input: { name: deal_name, stage: "closed-lost" },
          label: "Move to closed-lost",
          onError: "abort",
        },
        {
          action: "record_decision",
          input: { text: `Lost deal ${deal_name}${reasonClause}.` },
          label: "Record decision",
          onError: "warn",
        },
        {
          action: "slack_post_message",
          input: {
            channel,
            text: `Heads up team -- we closed-lost ${deal_name}${reasonClause}.`,
          },
          label: "Notify Slack",
          onError: "warn",
        },
      ],
      ctx,
    );
    return {
      summary: summarizeWorkflowResult(
        result,
        `${deal_name} archived${reasonClause}. CRM updated, decision logged, ${channel} notified.`,
        `Couldn't fully archive ${deal_name}`,
      ),
      data: { ok: result.ok, steps_completed: result.steps.filter((s) => s.ok).length },
    };
  },
};

// ── escalate_blocker ───────────────────────────────────────────────
//
// Operator: "this is blocking us" / "escalate the build issue" /
// "we're stuck on X." One intent → high-pri task + Slack ping +
// decision so the escalation is auditable.

export const escalateBlockerAction: AxonAction<
  { issue: string; owner?: string; channel?: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "escalate_blocker",
  description:
    "Escalate a blocker. Compound: creates a high-priority task + posts to a Slack channel + records the decision so the escalation has a paper trail. Use when the operator says 'escalate X', 'this is blocking us', 'flag this as urgent', 'we're stuck on Y'. The decision part matters because escalations that aren't logged turn into 'why didn't anyone tell me' arguments later.",
  input_schema: {
    type: "object",
    properties: {
      issue: { type: "string", description: "What's blocking. One sentence." },
      owner: { type: "string", description: "Who owns the blocker, if known. Goes into the task title." },
      channel: { type: "string", description: "Slack channel to escalate in. Defaults to #urgent." },
    },
    required: ["issue"],
  },
  mutating: true,
  handler: async ({ issue, owner, channel }, ctx) => {
    const ownerSuffix = owner ? ` (owner: ${owner})` : "";
    const ch = channel ?? "#urgent";
    const result = await runWorkflow(
      [
        {
          action: "create_task",
          input: {
            title: `BLOCKED: ${issue}${ownerSuffix}`,
            priority: "high",
          },
          label: "Create high-pri task",
          onError: "abort",
        },
        {
          action: "slack_post_message",
          input: {
            channel: ch,
            text: `:rotating_light: Escalating: ${issue}${ownerSuffix}.`,
          },
          label: "Notify Slack",
          onError: "warn",
        },
        {
          action: "record_decision",
          input: { text: `Escalated blocker: ${issue}${ownerSuffix}.` },
          label: "Record escalation",
          onError: "warn",
        },
      ],
      ctx,
    );
    return {
      summary: summarizeWorkflowResult(
        result,
        `Escalated. High-priority task created, ${ch} notified, escalation logged.`,
        `Couldn't fully escalate "${issue}"`,
      ),
      data: { ok: result.ok, steps_completed: result.steps.filter((s) => s.ok).length },
    };
  },
};

// ── handoff_meeting ────────────────────────────────────────────────
//
// Operator: "I can't make the standup, hand it off to Hanif."
// Originally proposed as cancel_meeting_proper, but there's no
// cancel_meeting primitive yet. Handoff covers the realistic case:
// notify attendees, log that this got punted on you, and create
// a follow-up to debrief whoever covered. When a cancel_meeting
// primitive lands, we can add a cancel_meeting_proper variant.

export const handoffMeetingAction: AxonAction<
  { meeting_title: string; cover?: string; channel?: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "handoff_meeting",
  description:
    "Hand off a meeting you can't attend. Compound: pings attendees on Slack with the handoff, records that the meeting got punted on you (so we don't lose track of what was supposed to happen there), and creates a follow-up task to debrief whoever covered. Use when the operator says 'I can't make X, hand it off', 'have Y cover for me', 'I won't be at the Z meeting'.",
  input_schema: {
    type: "object",
    properties: {
      meeting_title: { type: "string", description: "Which meeting." },
      cover: { type: "string", description: "Who's covering, if known." },
      channel: { type: "string", description: "Slack channel for the heads-up. Defaults to #general." },
    },
    required: ["meeting_title"],
  },
  mutating: true,
  handler: async ({ meeting_title, cover, channel }, ctx) => {
    const ch = channel ?? "#general";
    const coverSuffix = cover ? `; ${cover} is covering` : "";
    const result = await runWorkflow(
      [
        {
          action: "slack_post_message",
          input: {
            channel: ch,
            text: `Heads up -- I can't make ${meeting_title}${coverSuffix}.`,
          },
          label: "Notify attendees",
          onError: "warn",
        },
        {
          action: "record_defer",
          input: {
            text: `Handed off ${meeting_title}${coverSuffix}. Need a debrief.`,
          },
          label: "Log defer",
          onError: "abort",
        },
        {
          action: "create_task",
          input: {
            title: cover
              ? `Debrief ${cover} on ${meeting_title}`
              : `Find out what happened at ${meeting_title}`,
          },
          label: "Create debrief task",
          onError: "warn",
        },
      ],
      ctx,
    );
    return {
      summary: summarizeWorkflowResult(
        result,
        cover
          ? `Handed off ${meeting_title} to ${cover}. ${ch} notified, debrief task created.`
          : `Stepped out of ${meeting_title}. ${ch} notified, debrief task created.`,
        `Couldn't fully hand off ${meeting_title}`,
      ),
      data: { ok: result.ok, steps_completed: result.steps.filter((s) => s.ok).length },
    };
  },
};

// ── kill_project ───────────────────────────────────────────────────
//
// Operator: "shut down the migration project" / "kill the new
// landing page." One intent → record the decision + remove the
// project + thank-you ping to the team. We deliberately do NOT
// bulk-close every task under the project; bulk-task ops have
// failure modes that need their own confirmation flow, so the
// thank-you ping is the team signal to wrap any orphan tasks.

export const killProjectAction: AxonAction<
  { project_name: string; reason?: string; thank_channel?: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "kill_project",
  description:
    "Shut down a project. Compound: records the decision, removes the project from the active list, and posts a thank-you ping so the team finds out from us instead of noticing the project disappeared. Use when the operator says 'kill X', 'shut down Y', 'we're stopping work on Z', 'wind down the W project'. Does NOT auto-close every task under the project -- the thank-you ping is the team's signal to wrap or repoint orphan tasks.",
  input_schema: {
    type: "object",
    properties: {
      project_name: { type: "string", description: "Name of the project to shut down." },
      reason: { type: "string", description: "Why -- 'budget', 'priorities', 'shipped', etc." },
      thank_channel: { type: "string", description: "Slack channel for the thank-you. Defaults to #general." },
    },
    required: ["project_name"],
  },
  mutating: true,
  handler: async ({ project_name, reason, thank_channel }, ctx) => {
    const reasonClause = reason ? ` -- ${reason}` : "";
    const ch = thank_channel ?? "#general";
    const result = await runWorkflow(
      [
        {
          action: "record_decision",
          input: { text: `Shut down project: ${project_name}${reasonClause}.` },
          label: "Record decision",
          onError: "abort",
        },
        {
          action: "remove_project",
          input: { name: project_name },
          label: "Remove project",
          onError: "warn",
        },
        {
          action: "slack_post_message",
          input: {
            channel: ch,
            text: `:wave: Wrapping ${project_name}${reasonClause}. Thanks to everyone who pushed this forward.`,
          },
          label: "Thank the team",
          onError: "warn",
        },
      ],
      ctx,
    );
    return {
      summary: summarizeWorkflowResult(
        result,
        `${project_name} shut down${reasonClause}. Decision logged, project removed, ${ch} thanked.`,
        `Couldn't fully shut down ${project_name}`,
      ),
      data: { ok: result.ok, steps_completed: result.steps.filter((s) => s.ok).length },
    };
  },
};

// ── promote_intern ─────────────────────────────────────────────────
//
// Operator: "promote Sarah to full-time" / "convert Mike to
// permanent." One intent → record decision + send the new-role
// welcome + create a 30-day check-in so the transition has a
// follow-up beat.

export const promoteInternAction: AxonAction<
  { name: string; new_role: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "promote_intern",
  description:
    "Promote an intern or contractor to a new role. Compound: records the decision, fires the role-change welcome message, and creates a 30-day check-in task so the transition gets a deliberate review. Use when the operator says 'promote X', 'convert Y to full-time', 'move Z to permanent', 'X is moving from intern to engineer'.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Person being promoted." },
      new_role: { type: "string", description: "Their new title." },
    },
    required: ["name", "new_role"],
  },
  mutating: true,
  handler: async ({ name, new_role }, ctx) => {
    const result = await runWorkflow(
      [
        {
          action: "record_decision",
          input: { text: `Promoted ${name} to ${new_role}.` },
          label: "Record decision",
          onError: "abort",
        },
        {
          action: "send_welcome_message",
          input: { name, role: new_role },
          label: "Send welcome",
          onError: "warn",
        },
        {
          action: "create_task",
          input: {
            title: `30-day check-in with ${name} on ${new_role} transition`,
            deadline: new Date(Date.now() + 30 * 86_400_000).toISOString(),
          },
          label: "Schedule 30-day check-in",
          onError: "warn",
        },
      ],
      ctx,
    );
    return {
      summary: summarizeWorkflowResult(
        result,
        `${name} promoted to ${new_role}. Decision logged, welcome sent, 30-day check-in scheduled.`,
        `Couldn't fully promote ${name}`,
      ),
      data: { ok: result.ok, steps_completed: result.steps.filter((s) => s.ok).length },
    };
  },
};

// ── vendor_decision ────────────────────────────────────────────────
//
// Operator: "we're going with Stripe over Lemon Squeezy" / "picked
// Datadog for monitoring." One intent → record the choice + draft
// contract task + finance ping + a renewal-watch task one year
// out so the contract doesn't auto-renew unnoticed.

export const vendorDecisionAction: AxonAction<
  { vendor: string; for_what: string; finance_channel?: string },
  { ok: boolean; steps_completed: number }
> = {
  name: "vendor_decision",
  description:
    "Lock in a vendor choice. Compound: records the decision, creates a 'draft contract' task, pings the finance channel so they know money is about to move, and creates a renewal-watch task one year out so the contract doesn't auto-renew without anyone noticing. Use when the operator says 'going with X', 'we picked Y for Z', 'choosing N as our vendor'.",
  input_schema: {
    type: "object",
    properties: {
      vendor: { type: "string", description: "The vendor chosen." },
      for_what: { type: "string", description: "What service or product." },
      finance_channel: { type: "string", description: "Finance Slack channel. Defaults to #finance." },
    },
    required: ["vendor", "for_what"],
  },
  mutating: true,
  handler: async ({ vendor, for_what, finance_channel }, ctx) => {
    const ch = finance_channel ?? "#finance";
    const result = await runWorkflow(
      [
        {
          action: "record_decision",
          input: { text: `Chose ${vendor} for ${for_what}.` },
          label: "Record decision",
          onError: "abort",
        },
        {
          action: "create_task",
          input: { title: `Draft contract with ${vendor} for ${for_what}` },
          label: "Draft contract task",
          onError: "warn",
        },
        {
          action: "slack_post_message",
          input: {
            channel: ch,
            text: `Heads up -- locking in ${vendor} for ${for_what}. Contract drafting now.`,
          },
          label: "Notify finance",
          onError: "warn",
        },
        {
          action: "create_task",
          input: {
            title: `Review ${vendor} contract before renewal (for ${for_what})`,
            deadline: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          },
          label: "Schedule renewal watch",
          onError: "warn",
        },
      ],
      ctx,
    );
    return {
      summary: summarizeWorkflowResult(
        result,
        `${vendor} locked in for ${for_what}. Decision logged, contract task created, finance pinged, renewal watch set for 1 year out.`,
        `Couldn't fully lock in ${vendor}`,
      ),
      data: { ok: result.ok, steps_completed: result.steps.filter((s) => s.ok).length },
    };
  },
};

// ═══════════════════════════════════════════════════════════════════
// AUTONOMOUS OPS PLANNER (F.2)
//
// The brain falls back to this when no pre-baked workflow fits the
// operator's intent. accomplish_ops_goal takes a fuzzy natural-
// language goal, asks Claude (in a SINGLE planning call) to architect
// a sequence of primitive tool calls, speaks the plan in one sentence,
// and dispatches the whole thing through runWorkflow without any
// per-step LLM round-trips.
//
// Cost shape vs the alternatives:
//   - Pre-baked workflow: $0 planning, ~250ms total. Best when fits.
//   - accomplish_ops_goal: ~$0.005 planning, then N x 250ms. Use when
//     pre-baked doesn't fit but the goal is still a clear compound.
//   - Naive agent loop (one tool per turn): N+1 LLM calls, 1.5s each.
//     What we're replacing.
// ═══════════════════════════════════════════════════════════════════

export const accomplishOpsGoalAction: AxonAction<
  { goal: string },
  { ok: boolean; steps_planned: number; steps_completed: number }
> = {
  name: "accomplish_ops_goal",
  description:
    "Autonomously plan and execute a multi-step ops sequence from a fuzzy operator intent. Use this when the operator describes a COMPOUND result that no pre-baked workflow covers -- 'wrap up the Acme situation cleanly', 'I'm done with that whole onboarding mess', 'shut down the migration and tell everyone'. Internally calls Claude ONCE to plan the steps, then dispatches them in sequence. Prefer pre-baked workflows (close_candidate, archive_deal, escalate_blocker, handoff_meeting, kill_project, promote_intern, vendor_decision, wrap_meeting, log_outreach) when one fits -- those are free. This action is the fallback for novel compounds.",
  input_schema: {
    type: "object",
    properties: {
      goal: {
        type: "string",
        description:
          "The operator's intent in plain language. Pass it through as faithfully as possible -- the planner uses the operator's words verbatim.",
      },
    },
    required: ["goal"],
  },
  mutating: true,
  handler: async ({ goal }, ctx) => {
    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would plan and execute: "${goal}"`,
        data: { ok: true, steps_planned: 0, steps_completed: 0 },
      };
    }

    // ── Step 1: ask the planner for a sequence ─────────────────
    let plan;
    try {
      plan = await planOpsGoal(goal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        summary: `Couldn't put a plan together for "${goal}". ${msg.slice(0, 120)}`,
        data: { ok: false, steps_planned: 0, steps_completed: 0 },
      };
    }

    if (plan.steps.length === 0) {
      return {
        summary: `Thought about "${goal}" but couldn't find a sequence of actions that fits. Want to break it into smaller pieces?`,
        data: { ok: false, steps_planned: 0, steps_completed: 0 },
      };
    }

    // ── Step 2: announce the plan to the operator ──────────────
    //
    // The "I'm going to do A, B, C, D" line. ctx.note appends to the
    // conversation as a system message (visible, not spoken). The
    // brain will speak its own wrap-up after the action returns.
    const labels = plan.steps.map((s) => s.label || s.action).join(", then ");
    ctx.note(`Plan: ${plan.intent_summary}. Steps: ${labels}.`);

    // ── Step 3: dispatch the sequence ──────────────────────────
    //
    // runWorkflow handles per-step error behavior + the shared
    // scratchpad + result aggregation. From here on it's the same
    // pipeline as the pre-baked workflows.
    const result = await runWorkflow(plan.steps, ctx);

    const completed = result.steps.filter((s) => s.ok).length;
    return {
      summary: summarizeWorkflowResult(
        result,
        `${plan.intent_summary} -- done.`,
        `Got most of the way on "${goal}"`,
      ),
      data: {
        ok: result.ok,
        steps_planned: plan.steps.length,
        steps_completed: completed,
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
  // Six more pre-baked workflows (F.1 expanded).
  registerAction(archiveDealAction);
  registerAction(escalateBlockerAction);
  registerAction(handoffMeetingAction);
  registerAction(killProjectAction);
  registerAction(promoteInternAction);
  registerAction(vendorDecisionAction);
  // Autonomous ops planner (F.2) -- the fallback for novel compounds.
  registerAction(accomplishOpsGoalAction);
}
