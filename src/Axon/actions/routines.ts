// ───────────────────────────────────────────────────────────────────
// Routines — named multi-step command chains.
// Runs a sequence of natural-language sub-commands back-to-back through
// the executor so the operator can say "AXON, run morning routine"
// and get a pre-baked sequence.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { executeAction } from "../engine/executor";

/** A routine = a named, ordered list of action invocations. */
export interface Routine {
  id: string;
  label: string;
  description: string;
  steps: Array<{
    action: string;
    input: Record<string, unknown>;
    /** Optional human line spoken before the step. */
    say?: string;
  }>;
}

const ROUTINES: Routine[] = [
  {
    id: "morning",
    label: "Morning routine",
    description:
      "Greets the operator with a briefing, then opens the tasks page.",
    steps: [
      { action: "brief_me", input: {} },
      { action: "navigate", input: { destination: "tasks" }, say: "Opening tasks." },
    ],
  },
  {
    id: "focus",
    label: "Focus mode",
    description:
      "Lists what's overdue and opens the task list so the operator can work down the stack.",
    steps: [
      {
        action: "list_tasks",
        input: { status: "overdue", limit: 10 },
      },
      { action: "navigate", input: { destination: "tasks" } },
    ],
  },
  {
    id: "eod",
    label: "End-of-day",
    description:
      "Summarizes what changed today: completed tasks, new signups, and meetings scheduled.",
    steps: [
      { action: "list_tasks", input: { status: "done", limit: 20 } },
      { action: "recent_signups", input: { days: 1, limit: 10 } },
      { action: "upcoming_meetings", input: { withinDays: 1 } },
    ],
  },
];

export const runRoutineAction: AxonAction<
  { id: string },
  { steps: number }
> = {
  name: "run_routine",
  description:
    "Run a named routine — a pre-baked sequence of actions. Known routines: 'morning' (briefing + open tasks), 'focus' (list overdue and open task list), 'eod' (summary of what changed today). Use this when the operator says 'morning routine', 'focus mode', 'end of day', etc.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string", enum: ["morning", "focus", "eod"] },
    },
    required: ["id"],
  },
  handler: async ({ id }, ctx) => {
    const r = ROUTINES.find((x) => x.id === id);
    if (!r) return { summary: `No routine called "${id}".` };
    let completed = 0;
    for (const step of r.steps) {
      if (step.say) ctx.speak(step.say);
      const outcome = await executeAction(step.action, step.input, ctx);
      if (!outcome.ok) {
        return {
          summary: `Routine "${r.label}" stopped at step ${completed + 1}: ${outcome.error}`,
          data: { steps: completed },
        };
      }
      completed++;
    }
    ctx.logActivity({
      actionName: "run_routine",
      params: { id },
      summary: `Ran routine "${r.label}" (${completed} steps)`,
    });
    return {
      summary: `Ran ${r.label.toLowerCase()} — ${completed} steps.`,
      data: { steps: completed },
    };
  },
};

export const listRoutinesAction: AxonAction<
  Record<string, never>,
  { routines: Array<Omit<Routine, "steps">> }
> = {
  name: "list_routines",
  description: "List available named routines.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const rs = ROUTINES.map(({ id, label, description }) => ({ id, label, description }));
    return {
      summary: `${rs.length} routines available: ${rs.map((r) => r.label).join(", ")}.`,
      data: { routines: rs },
    };
  },
};

export function registerRoutineActions() {
  registerAction(runRoutineAction);
  registerAction(listRoutinesAction);
}
