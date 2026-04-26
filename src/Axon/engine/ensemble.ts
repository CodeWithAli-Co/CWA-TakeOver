// ───────────────────────────────────────────────────────────────────
// Ensemble — Architect / Engineer / Critic.
//
// Three Claude calls in sequence, each with a focused system prompt:
//
//   1. ARCHITECT — given a goal, returns a structured JSON plan
//      (approach, steps, files expected). NO tools, just a
//      thinking pass. Output becomes a `plan` node in the Mind Map.
//
//   2. ENGINEER  — runs the existing runAgent loop with the plan
//      injected as additional context. Has full tool access.
//      Executes the plan; produces files, modifies code, etc.
//
//   3. CRITIC    — given the Engineer's final summary + the list
//      of files that were touched, returns a JSON verdict. Critic
//      sanity-checks what the Engineer produced from the summary +
//      file list (no live tool access — kept simple for v1).
//
// If the critic returns "revise", we loop back to the Engineer with
// the critique appended to its goal context. Hard cap of 2 revision
// rounds — beyond that, ship as-is to avoid infinite loops.
//
// All Anthropic calls use anthropicFetch which handles 429 backoff.
// ───────────────────────────────────────────────────────────────────

import type { ActionContext, CodegenProject, ExecutedAction } from "../types";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";
import { runAgent } from "./agent";
import { axonGraph } from "./graphStore";
import { anthropicFetch } from "./anthropicFetch";
import { setEnsemblePhase } from "./ensemblePhase";

const ARCHITECT_SYSTEM = [
  "You are the ARCHITECT in an Axon ensemble. Your job is to read the operator's goal and produce a structured plan that the Engineer will execute.",
  "",
  "OUTPUT FORMAT - STRICT:",
  "Reply with EXACTLY one fenced JSON block (triple-backtick fence with the json language tag). No prose before or after. The payload shape:",
  "",
  "{",
  '  "approach": "1-2 sentence summary of how this will be done",',
  '  "steps": [',
  '    { "id": "1", "description": "what to do", "deliverable": "what should exist after" }',
  "  ],",
  '  "filesExpected": ["src/foo/bar.tsx", "..."],',
  '  "risks": ["any non-obvious caveat the Engineer should know"]',
  "}",
  "",
  "GUIDELINES:",
  "- Don't write code. You're planning, not implementing.",
  "- 3-7 steps usually. Bigger goals can have more.",
  "- Each step has ONE clear deliverable.",
  "- filesExpected lists the file paths you expect the Engineer to touch.",
  "- risks: keep it terse, only call out real ones.",
].join("\n");

const CRITIC_SYSTEM = [
  "You are the CRITIC in an Axon ensemble. The Engineer just executed a plan. Your job is to review what was done and decide whether to ship it, ask for revision, or abort.",
  "",
  "You're reviewing AFTER THE FACT. The user message gives you the goal, the architect's plan, the engineer's final summary, and a list of files the engineer touched. Decide based on that.",
  "",
  "OUTPUT FORMAT - STRICT:",
  "Reply with EXACTLY one fenced JSON block (triple-backtick fence with the json language tag). No prose before or after.",
  "",
  "{",
  '  "verdict": "ship" | "revise" | "abort",',
  '  "issues": [',
  '    { "severity": "major" | "minor", "description": "...", "suggestion": "..." }',
  "  ],",
  '  "summary": "1-2 sentence justification of the verdict"',
  "}",
  "",
  "VERDICT GUIDE:",
  "- ship: the goal is achieved. Files are correctly written, imports resolve, the obvious cases work. Minor cosmetic stuff is fine to ship; mention it in issues.",
  "- revise: there's a real problem the Engineer should fix. Be specific in description + suggestion. The Engineer will get your critique and run again.",
  "- abort: the plan was wrong, the goal can't be done, or the Engineer made the workspace worse. Rare; only when revising won't help.",
  "",
  "Be terse. The operator hears your verdict + summary spoken aloud.",
].join("\n");

interface AnthropicContent {
  type: string;
  [k: string]: unknown;
}

interface ArchitectPlan {
  approach: string;
  steps: Array<{ id: string; description: string; deliverable: string }>;
  filesExpected: string[];
  risks: string[];
}

interface CriticVerdict {
  verdict: "ship" | "revise" | "abort";
  issues: Array<{ severity: "major" | "minor"; description: string; suggestion: string }>;
  summary: string;
}

export interface EnsembleOpts {
  goal: string;
  ctx: ActionContext;
  project: CodegenProject | null;
  /** Max revision rounds after the first Engineer pass. Default 2. */
  maxRevisions?: number;
  /** Speak progress aloud between phases. Default true. */
  narrate?: boolean;
  onAction?: (action: ExecutedAction) => void;
}

export interface EnsembleResult {
  finalSummary: string;
  plan: ArchitectPlan | null;
  verdict: CriticVerdict | null;
  revisions: number;
  actions: ExecutedAction[];
}

const MAX_TOKENS = 2048;

async function callClaude(
  system: string,
  userText: string,
  maxTokens: number,
  ctx: ActionContext | undefined,
  phase: "Architect" | "Critic",
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY missing - set VITE_ANTHROPIC_API_KEY.");
  }
  const res = await anthropicFetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userText }],
    }),
    onWait: (waitMs, attempt) => {
      const secs = Math.round(waitMs / 1000);
      const msg = phase + ": rate-limited. Waiting " + secs + "s before retry " + attempt + ".";
      // eslint-disable-next-line no-console
      console.warn("[AXON ensemble] " + msg);
      try { ctx?.speak(msg); } catch { /* ignore */ }
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error("Anthropic " + res.status + ": " + text.slice(0, 200));
  }
  const json = await res.json();
  const content = (json?.content ?? []) as AnthropicContent[];
  const block = content.find((c) => c.type === "text");
  return String((block as { text?: string } | undefined)?.text ?? "");
}

function extractJsonBlock(raw: string): string {
  const m = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (m) return m[1].trim();
  return raw.trim();
}

function safeParse<T>(jsonText: string): T | null {
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}

function planToMessage(plan: ArchitectPlan): string {
  const stepLines = plan.steps
    .map((s, i) => "  " + (i + 1) + ". " + s.description + " -> " + s.deliverable)
    .join("\n");
  const files = plan.filesExpected.length
    ? plan.filesExpected.map((f) => "    - " + f).join("\n")
    : "    (none specified)";
  const risks = plan.risks.length
    ? plan.risks.map((r) => "    - " + r).join("\n")
    : "    (none flagged)";
  return [
    "ARCHITECT'S PLAN:",
    "  Approach: " + plan.approach,
    "  Steps:",
    stepLines,
    "  Files expected:",
    files,
    "  Risks to watch:",
    risks,
    "",
    "Execute this plan. Stay close to it but adjust when reality forces it.",
  ].join("\n");
}

function critiqueToMessage(verdict: CriticVerdict): string {
  const issueLines = verdict.issues.length
    ? verdict.issues
        .map((i) => "  - [" + i.severity + "] " + i.description + "\n    Suggestion: " + i.suggestion)
        .join("\n")
    : "  (no specific issues listed)";
  return [
    "CRITIC SAYS: REVISE",
    "Summary: " + verdict.summary,
    "Issues:",
    issueLines,
    "",
    "Address these and produce a final state. Don't restart from scratch - adjust what's there.",
  ].join("\n");
}

/** Run the three-agent ensemble. */
export async function runEnsemble(opts: EnsembleOpts): Promise<EnsembleResult> {
  const { goal, ctx, project, maxRevisions = 2, narrate = true, onAction } = opts;
  const allActions: ExecutedAction[] = [];

  axonGraph.startSession({ kind: "agent", prompt: "[ensemble] " + goal });

  // ── PHASE 1: Architect ──────────────────────────────────────────
  setEnsemblePhase("architect");
  if (narrate) ctx.speak("Architect is planning.");
  let plan: ArchitectPlan | null = null;
  try {
    const projectLine = project
      ? "Active project: " + project.name + " at " + project.path + "." +
        (project.language ? " Default language: " + project.language + "." : "")
      : "No active project.";
    const userText = projectLine + "\n\nGoal:\n\"\"\"" + goal + "\"\"\"\n\nProduce the JSON plan now.";
    const raw = await callClaude(ARCHITECT_SYSTEM, userText, MAX_TOKENS, ctx, "Architect");
    plan = safeParse<ArchitectPlan>(extractJsonBlock(raw));
    if (plan && plan.approach) {
      const planLabel =
        plan.approach.length > 56 ? plan.approach.slice(0, 54) + "..." : plan.approach;
      axonGraph.addPlan(
        planLabel,
        [plan.approach, ...plan.steps.map((s, i) => (i + 1) + ". " + s.description)].join("\n"),
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    axonGraph.addThought("Architect failed: " + msg);
  }

  if (!plan) {
    if (narrate) ctx.speak("Plan didn't parse. Going direct.");
    setEnsemblePhase("engineer");
    const direct = await runAgent({ goal, ctx, project, narrate, onAction });
    setEnsemblePhase(null);
    return {
      finalSummary: direct.finalSummary,
      plan: null,
      verdict: null,
      revisions: 0,
      actions: direct.actions,
    };
  }

  // ── PHASE 2 + 3: Engineer + Critic loop ─────────────────────────
  let revisions = 0;
  let lastVerdict: CriticVerdict | null = null;
  let lastSummary = "";

  while (true) {
    setEnsemblePhase("engineer");
    if (narrate) {
      if (revisions === 0) ctx.speak("Engineer is on it.");
      else ctx.speak("Engineer is revising.");
    }

    const augmentedGoal =
      revisions === 0
        ? goal + "\n\n" + planToMessage(plan)
        : goal + "\n\n" + planToMessage(plan) + "\n\n" + critiqueToMessage(lastVerdict!);

    const result = await runAgent({
      goal: augmentedGoal,
      ctx,
      project,
      narrate: false,
      onAction: (a) => {
        allActions.push(a);
        onAction?.(a);
      },
    });
    lastSummary = result.finalSummary;

    setEnsemblePhase("critic");
    if (narrate) ctx.speak("Critic is reviewing.");
    let verdict: CriticVerdict | null = null;
    try {
      const recentFiles = allActions
        .filter((a) =>
          [
            "generate_file",
            "modify_file",
            "scaffold_feature",
            "delete_workspace_file",
            "add_page",
          ].includes(a.actionName),
        )
        .slice(-15)
        .map((a) => "  - " + a.actionName + ": " + a.summary)
        .join("\n");
      const userText =
        "Goal:\n\"\"\"" + goal + "\"\"\"\n\n" +
        "Architect's plan approach: " + plan.approach + "\n\n" +
        "Engineer's final summary:\n" + lastSummary + "\n\n" +
        "Files the Engineer touched:\n" + (recentFiles || "  (none reported)") + "\n\n" +
        "Return your JSON verdict.";
      const raw = await callClaude(CRITIC_SYSTEM, userText, MAX_TOKENS, ctx, "Critic");
      verdict = safeParse<CriticVerdict>(extractJsonBlock(raw));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      axonGraph.addThought("Critic failed: " + msg);
    }

    if (!verdict) {
      if (narrate) ctx.speak("Critic no-op. Shipping as-is.");
      axonGraph.endSession({ summary: lastSummary || "Done.", failed: false });
      setEnsemblePhase(null);
      return {
        finalSummary: lastSummary || "Done.",
        plan,
        verdict: null,
        revisions,
        actions: allActions,
      };
    }

    axonGraph.addCritique(
      verdict.summary + "\n" + verdict.issues.map((i) => "  [" + i.severity + "] " + i.description).join("\n"),
      verdict.verdict,
    );
    lastVerdict = verdict;

    if (verdict.verdict === "ship") {
      if (narrate) ctx.speak(verdict.summary || "Shipped.");
      axonGraph.endSession({
        summary: verdict.summary || lastSummary || "Done.",
        failed: false,
      });
      setEnsemblePhase(null);
      return {
        finalSummary: verdict.summary || lastSummary || "Done.",
        plan,
        verdict,
        revisions,
        actions: allActions,
      };
    }

    if (verdict.verdict === "abort" || revisions >= maxRevisions) {
      const finalMsg =
        verdict.verdict === "abort"
          ? "Aborted by Critic: " + verdict.summary
          : "Shipping after " + revisions + " revisions: " + verdict.summary;
      if (narrate) ctx.speak(finalMsg);
      axonGraph.endSession({
        summary: finalMsg,
        failed: verdict.verdict === "abort",
      });
      setEnsemblePhase(null);
      return {
        finalSummary: finalMsg,
        plan,
        verdict,
        revisions,
        actions: allActions,
      };
    }

    // verdict.verdict === "revise" — loop back to Engineer.
    revisions += 1;
  }
}
