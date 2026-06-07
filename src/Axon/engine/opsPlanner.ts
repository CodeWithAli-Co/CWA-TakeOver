// ───────────────────────────────────────────────────────────────────
// Autonomous ops planner.
//
// The F.1 pre-baked workflows (close_candidate, archive_deal, etc.)
// cover known compound intents -- the brain matches the operator's
// utterance against a tool description and dispatches the right one.
// Cheap and fast, but the operator has to phrase things in a way that
// maps to a known compound. Anything novel falls back to one-tool-
// at-a-time, which is the slow + brittle path.
//
// This module closes that gap. Given a fuzzy operator goal -- "I'm
// done with Cesar", "let's wrap the Acme deal cleanly", "we're
// shutting down the migration project" -- it calls Claude ONCE with
// the registry's tool descriptions and asks for a sequenced plan as
// structured JSON. That plan is then dispatched directly through
// runWorkflow with no further LLM round-trips.
//
// Cost shape:
//   - One planning call (~500 input tokens for the tool catalog, ~200
//     output tokens for the plan -- about $0.005 at current rates).
//   - N database operations after that, ~250ms each.
//
// Compare to letting the agent loop figure it out organically:
//   - N+1 LLM calls (one per step plus the wrap-up), 1.5s each on
//     average. The naive path is 3-5x slower and 5x more expensive.
//
// Compare to pre-baked workflows:
//   - Pre-baked is free (no planning call) but limited to known
//     intents. The planner is the fallback when no pre-baked
//     workflow matches.
//
// The right architecture is both: brain tries pre-baked first,
// falls back to accomplish_ops_goal for novel compounds. That's
// what the action description in workflows.ts encodes.
// ───────────────────────────────────────────────────────────────────

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";
import { listActions } from "../actions/registry";
import type { WorkflowStep } from "./workflow";

export interface OpsPlan {
  /** One-sentence summary of what the plan will accomplish. Spoken to
   *  the operator before execution starts so they know what's about
   *  to happen. */
  intent_summary: string;
  /** The dispatch sequence. Names must reference real registered
   *  actions; the planner is instructed not to invent. */
  steps: WorkflowStep[];
}

const PLANNER_SYSTEM_PROMPT = [
  "You are Axon's ops planner. The operator just gave you a fuzzy goal -- something like 'I'm done with Cesar' or 'shut down the migration project cleanly'. Your job is to pick the sequence of primitive actions from the available tool catalog that accomplishes that goal.",
  "",
  "RULES:",
  "1. Only use action names that appear in the AVAILABLE ACTIONS list. Do not invent tool names. If you can't accomplish the goal with the available actions, return a single-step plan that calls record_decision with a note about what was attempted.",
  "2. Prefer pre-baked compound workflows (close_candidate, archive_deal, escalate_blocker, handoff_meeting, kill_project, promote_intern, vendor_decision, wrap_meeting, log_outreach) when they fit -- they already chain the right primitives correctly. If a pre-baked workflow fits, your plan should be ONE step calling that workflow.",
  "3. For novel intents, chain primitives: typically a state-change action (update_X / move_Y / delete_Z) + record_decision so the action has a paper trail + an optional slack_post_message when team awareness matters.",
  "4. Be FRUGAL. 2-4 steps is the sweet spot. More than 5 means you're inventing work.",
  "5. Pass real values into each step's `input`. Use the operator's words verbatim when possible; don't paraphrase names or numbers.",
  "6. Each step has: { action: string, input: object, onError: 'abort'|'warn'|'skip', label: string }. 'abort' for critical steps (the state change), 'warn' for important-but-recoverable (logging, notifications). Never use 'skip' unless the step is truly optional.",
  "",
  "Return ONLY valid JSON. No prose, no markdown fences. Exactly this shape:",
  '{ "intent_summary": "one sentence in the operator\'s voice -- \\"closing Cesar and notifying the team\\"", "steps": [ { "action": "...", "input": { ... }, "onError": "abort"|"warn"|"skip", "label": "..." } ] }',
].join("\n");

function buildToolCatalog(): string {
  const actions = listActions();
  // Compact catalog -- name + description only. The planner doesn't
  // need full JSON schemas to make a plan; the action handlers will
  // validate at dispatch time.
  return actions
    .map((a) => `- ${a.name}: ${a.description.slice(0, 220)}`)
    .join("\n");
}

/**
 * Ask Claude to plan a workflow for the given goal. Returns the parsed
 * plan, or throws if the response doesn't parse to the expected shape.
 *
 * Failure modes the caller should handle:
 *   - Network / API errors: thrown.
 *   - Malformed JSON in response: thrown with a recovery message.
 *   - Empty steps array: returned as-is. The caller decides what to
 *     do (probably speak "I couldn't figure out a plan for that" and
 *     fall through to a normal one-shot reply).
 */
export async function planOpsGoal(goal: string): Promise<OpsPlan> {
  const catalog = buildToolCatalog();
  const userPrompt = [
    "AVAILABLE ACTIONS:",
    catalog,
    "",
    "OPERATOR GOAL:",
    goal,
    "",
    "Return the JSON plan now.",
  ].join("\n");

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 800,
    // Lower temp than the brief drafter -- we want consistent
    // structure, not creative variation. Plans should be boring and
    // reliable.
    temperature: 0.2,
    system: PLANNER_SYSTEM_PROMPT,
    messages: [{ role: "user" as const, content: userPrompt }],
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Planner API error ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const text =
    data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

  if (!text) {
    throw new Error("Planner returned empty response");
  }

  // Strip any ```json fences the model might add despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error(
      `Planner returned malformed JSON: ${(e as Error).message}. Got: ${cleaned.slice(0, 200)}`,
    );
  }

  // Validate shape. We accept loose typing for `steps[].input` because
  // each action has its own schema -- the registry handlers will
  // reject bad input at dispatch time.
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("intent_summary" in parsed) ||
    !("steps" in parsed) ||
    !Array.isArray((parsed as { steps: unknown }).steps)
  ) {
    throw new Error(
      `Planner JSON missing required fields. Got keys: ${Object.keys(parsed as object).join(", ")}`,
    );
  }

  const plan = parsed as OpsPlan;

  // Drop any step whose action isn't registered -- belt-and-suspenders
  // for the "don't invent tools" rule.
  const validNames = new Set(listActions().map((a) => a.name));
  plan.steps = plan.steps.filter((s) => {
    if (!s || typeof s.action !== "string") return false;
    if (!validNames.has(s.action)) {
      console.warn(`[AXON] Planner invented action "${s.action}" -- dropping.`);
      return false;
    }
    return true;
  });

  return plan;
}
