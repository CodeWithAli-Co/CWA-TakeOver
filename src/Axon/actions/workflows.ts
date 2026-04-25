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

export function registerWorkflowActions() {
  registerAction(chainCommandsAction);
}
