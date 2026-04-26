// ───────────────────────────────────────────────────────────────────
// Autonomous agent — Axon as a self-directing engineer.
//
// Operator describes an end result ("build a login page with social
// auth", "refactor the financial dashboard into bento layout", "ship
// a status component") and the agent:
//
//   1. Plans — Claude generates an explicit step list given the goal +
//      project context (path, language, notes).
//   2. Executes — runs the plan one Claude turn at a time, with the
//      full action registry as available tools (generate_file,
//      modify_file, scaffold_feature, list_workspace, etc).
//   3. Narrates — speaks short progress updates between steps so the
//      operator hears what Axon is doing.
//   4. Stops — when Claude returns no more tool_uses and a final
//      summary, OR when MAX_ITER is hit.
//
// Different from the conversational brain in three ways:
//   • Higher iteration cap (32 vs 4) — multi-step features need it.
//   • Specialized system prompt — autonomous engineer, not casual
//     conversational assistant.
//   • Non-streaming — we want full content blocks per turn so we can
//     run tool_use → tool_result → tool_use chains cleanly.
// ───────────────────────────────────────────────────────────────────

import type { ActionContext, CodegenProject, ExecutedAction } from "../types";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";
import { buildToolDefinitions } from "../actions/registry";
import { executeAction } from "./executor";
import { axonGraph } from "./graphStore";
import { anthropicFetch } from "./anthropicFetch";
import { getSimulationMode } from "./simulationFlag";

// Real coding tasks (multi-file features, refactors, scaffolds, plus
// the inevitable "now wire it up over there" follow-ups) routinely
// chew through 20+ tool calls before they're done. 50 gives breathing
// room for legitimate multi-step work without changing early-exit
// semantics (Claude still ends the loop the moment it stops calling
// tools).
const AGENT_MAX_ITER = 50;
const AGENT_MAX_TOKENS = 4096;

const AGENT_SYSTEM = `You are AXON in autonomous engineer mode. The operator gave you a high-level goal — your job is to make it real.

CORE LOOP:
1. Plan briefly in your head — what files / actions are needed.
2. LOCATE files first if you don't already know where they are. Use
   find_file (fast recursive name match) or search_files (grep). Do
   NOT walk the tree by repeatedly calling list_workspace — that
   wastes turns and the operator hears a long silence.
3. Call generate_file / modify_file / scaffold_feature to make changes.
4. After each tool result, decide: keep going, course-correct, or finish.
5. When the goal is met, produce a SHORT spoken summary (1-2 sentences,
   no markdown, no list) and stop calling tools. That ends the loop.

ITERATION BUDGET — READ THIS TWICE:
- Your tool calls are scarce. Spend them on EDITS, not lookups.
- A small change should cost ONE find_file + ONE modify_file. That's it.
- A "wire X into Y" change should cost ONE find_file (for Y) + ONE
  modify_file. You DO NOT need to read Y first — modify_file reads it
  for you and returns the revised bytes.
- DO NOT call find_file twice for the same target. If a previous
  find_file in this conversation already returned the path you need,
  USE IT. Re-finding the same file is the #1 way to burn the cap.
- DO NOT call read_workspace_file before modify_file. The modifier
  reads the file internally. Reading it yourself first wastes a turn
  and accomplishes nothing.
- DO NOT call read_workspace_file to "verify" what generate_file or
  modify_file just wrote. The action returned the bytes. Trust it.
- DO NOT call list_workspace to "explore" — find_file with a name
  pattern is always faster.
- If your last 2 calls were both read/find/list and produced no edit,
  STOP exploring and CALL THE EDITOR (modify_file or generate_file).

ANTI-LOOP RULES — VIOLATING THESE STRANDS THE OPERATOR:
- After a successful find_file that gave you the target path, your
  NEXT call MUST be modify_file (or generate_file if creating new) —
  not another find_file, not read_workspace_file.
- "Could you import X here" / "use it in Y" → ONE modify_file on Y.
  The brief says "add an import for X from <path> and render <X />
  in the right spot." That's the entire task. No more lookups.
- The user message includes a "Recent file activity" block listing
  paths from your PREVIOUS turn. ALWAYS scan it before calling
  find_file. If the path you need is already there, USE IT
  IMMEDIATELY — do not re-discover it. Re-finding paths that were
  already surfaced is the #1 cause of stranded runs.
- If the operator's previous turn already had you find a file and
  you didn't end up editing it, that file is STILL in scope — don't
  re-find it just because a new turn started. Reuse the path.

FILE LOCATION RULES — CRITICAL:
- Goal mentions a "page" or "route"? Run find_file with a name pattern.
  e.g. operator says "the report page" → find_file({ pattern: 'report' })
  or for Next.js → find_file({ pattern: 'reports/page' }).
- Don't read files speculatively to "see if they exist" — find_file
  tells you in one call whether they exist and where.
- ONE find_file beats five list_workspace calls. Always.
- If find_file returns multiple matches, pick the most plausible by
  path depth + naming and proceed. Don't ask the operator.
- If find_file returns nothing, try a shorter substring or a glob
  ('*page.tsx'). Then try search_files for a unique string the
  operator mentioned. THEN, if still nothing, tell the operator the
  file doesn't seem to exist and offer to create it.

OPERATING RULES:
- You have a workspace (active project's path). All file ops are
  scoped inside it. Use relative paths.
- Don't ask the operator for permission. Take the next obvious step.
- If a tool fails, read the error, adjust, and retry. Don't give up
  after one failure — but also don't loop on the same failing call.
- Don't over-explain between steps. One short progress line max
  ("Found it. Updating now.") — the operator hears these spoken.
- Default stack for this app's UI work: TypeScript, React, Tailwind.
  Match existing project conventions if they're in the project notes.
- Don't dump code in your text replies — write code into files via
  generate_file / modify_file. Reply text is spoken aloud.
- Stop when the goal is verifiably done. Don't keep polishing
  forever — the operator can ask for follow-up tweaks.

When you're done, your final reply should be a one-or-two-sentence
spoken summary of what you built, no tool calls.`;

interface AnthropicContent {
  type: string;
  [k: string]: unknown;
}
interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
}

export interface AgentRunOpts {
  goal: string;
  ctx: ActionContext;
  /** Active project — path is the workspace, notes go into the prompt. */
  project: CodegenProject | null;
  /** Optional cap; defaults to AGENT_MAX_ITER. */
  maxIters?: number;
  /** Called with a short progress message after each productive iteration. */
  onProgress?: (message: string) => void;
  /** Called with each ExecutedAction produced. */
  onAction?: (action: ExecutedAction) => void;
  /** When true, narrate progress out loud via ctx.speak. Default true. */
  narrate?: boolean;
  /** When true, every mutating tool call returns a simulated success
   *  without running. The agent builds a complete plan the operator
   *  can review in the Mind Map before re-running for real. */
  simulationMode?: boolean;
}

export interface AgentRunResult {
  finalSummary: string;
  actions: ExecutedAction[];
  iterations: number;
  /** True if we hit the iteration cap before Claude said "done". */
  stoppedAtCap: boolean;
}

function projectPreamble(project: CodegenProject | null): string {
  if (!project) {
    return "No active project. Tell the operator to register one with add_project before continuing.";
  }
  const parts = [
    `Active project: ${project.name}`,
    `Workspace path: ${project.path}`,
  ];
  if (project.language) parts.push(`Default language: ${project.language}`);
  if (project.notes) parts.push(`Project notes:\n${project.notes}`);
  return parts.join("\n");
}

/** Pull a compact summary of recent file activity from the Mind Map
 *  graph store and surface it to Claude as "stuff that JUST happened."
 *
 *  Why this matters: every runAgent call gets a fresh `messages` array,
 *  so without this preamble the agent has no memory of which file it
 *  just generated, where the home page lives, etc. The result is
 *  redundant find_file calls on every follow-up turn and "ran out of
 *  reasoning steps" stalls.
 *
 *  Strategy: walk the most recent 2-3 sessions (current run is empty
 *  at this point), collect file events, dedupe by path keeping the
 *  latest op, sort chronologically, cap at 12 lines to keep the
 *  prompt lean. Write/modify get top billing because those are the
 *  paths the operator most likely wants to reuse. */
function buildRecentContext(): string {
  let state;
  try {
    state = axonGraph.getState();
  } catch {
    return "";
  }
  if (!state || !state.sessions || state.sessions.length === 0) return "";

  // Skip the session that's about to be created — look at the prior 2-3.
  // The current session is opened by startSession AFTER buildRecentContext
  // is called, so all existing sessions are valid history.
  const recent = state.sessions.slice(-3);
  if (recent.length === 0) return "";

  type FileMemo = { path: string; op: string; when: number };
  const byPath = new Map<string, FileMemo>();
  for (const s of recent) {
    for (const n of s.nodes) {
      if (n.kind === "file" && n.filePath && n.fileOp) {
        const prev = byPath.get(n.filePath);
        if (!prev || prev.when < n.createdAt) {
          byPath.set(n.filePath, {
            path: n.filePath,
            op: n.fileOp,
            when: n.createdAt,
          });
        }
      }
    }
  }
  if (byPath.size === 0) return "";

  const entries = Array.from(byPath.values()).sort((a, b) => a.when - b.when);
  const tail = entries.slice(-12);

  // Group by op so the agent can scan quickly.
  const byOp: Record<string, string[]> = {};
  for (const e of tail) {
    (byOp[e.op] ||= []).push(e.path);
  }

  const lines: string[] = [];
  // Surface writes / modifies first — these are the highest-signal entries.
  for (const op of ["write", "modify", "find", "read", "delete"]) {
    if (byOp[op]) {
      lines.push(`  ${op}:`);
      for (const p of byOp[op]) lines.push(`    - ${p}`);
    }
  }
  if (lines.length === 0) return "";

  return [
    "Recent file activity (from your previous turn — REUSE these paths,",
    "do NOT call find_file on anything that's already listed below):",
    ...lines,
  ].join("\n");
}

export async function runAgent(opts: AgentRunOpts): Promise<AgentRunResult> {
  const { goal, ctx, project, maxIters = AGENT_MAX_ITER, onProgress, onAction, narrate = true, simulationMode = getSimulationMode() } = opts;
  if (!ANTHROPIC_API_KEY) {
    return {
      finalSummary: "I can't reach my brain — the Anthropic API key is missing.",
      actions: [],
      iterations: 0,
      stoppedAtCap: false,
    };
  }

  const tools = buildToolDefinitions();
  const cachedTools = tools.length > 0
    ? [
        ...tools.slice(0, -1),
        { ...tools[tools.length - 1], cache_control: { type: "ephemeral" } },
      ]
    : tools;

  const recentContext = buildRecentContext();
  const contextBlock = recentContext ? `\n\n${recentContext}` : "";
  const messages: AnthropicMessage[] = [
    {
      role: "user",
      content: `${projectPreamble(project)}${contextBlock}\n\nOperator's goal:\n"""${goal}"""\n\nMake it happen. Use tools. Stop when it's done with a short spoken summary.`,
    },
  ];

  const actions: ExecutedAction[] = [];
  let finalSummary = "";
  let iter = 0;
  let stoppedAtCap = false;

  // Mind-map: open a session for this autonomous run so the canvas
  // shows the goal at the center and every iteration's tool calls
  // branch off it. The session closes in the finally-style returns
  // below with the final summary.
  axonGraph.startSession({ kind: "agent", prompt: goal });

  for (iter = 0; iter < maxIters; iter++) {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: AGENT_MAX_TOKENS,
      system: [
        { type: "text", text: AGENT_SYSTEM, cache_control: { type: "ephemeral" } },
      ],
      tools: cachedTools,
      messages,
    };

    const res = await anthropicFetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
      onWait: (waitMs, attempt) => {
        const secs = Math.round(waitMs / 1000);
        const msg = `Rate-limited. Waiting ${secs}s before retry ${attempt}.`;
        // eslint-disable-next-line no-console
        console.warn(`[AXON agent] ${msg}`);
        if (narrate) {
          try { ctx.speak(msg); } catch { /* ignore */ }
        }
      },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();
    const content: AnthropicContent[] = json?.content ?? [];
    const stopReason: string = json?.stop_reason ?? "end_turn";

    const textParts = content
      .filter((c) => c.type === "text")
      .map((c) => String((c as any).text ?? ""));
    const toolUses = content.filter((c) => c.type === "tool_use") as Array<{
      type: "tool_use";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;

    // Spoken progress — keep it under one breath.
    if (textParts.length > 0) {
      const txt = textParts.join("\n").trim();
      if (txt) {
        onProgress?.(txt);
        if (narrate) {
          // Fire-and-forget — the agent keeps moving while TTS plays.
          ctx.speak(txt);
        }
        finalSummary = txt;
        // Mind-map: record the agent's spoken beat as a "thought" node
        // so the operator can read what the agent was reasoning about
        // between tool calls.
        axonGraph.addThought(txt);
      }
    }

    if (toolUses.length === 0 || stopReason === "end_turn") {
      // Done — Claude has nothing more to do.
      axonGraph.endSession({ summary: finalSummary || "Done.", failed: false });
      return { finalSummary: finalSummary || "Done.", actions, iterations: iter + 1, stoppedAtCap: false };
    }

    // Persist Claude's content block as the assistant message so the
    // tool_use ids stay in scope for the next turn.
    messages.push({ role: "assistant", content });

    const toolResults: AnthropicContent[] = [];
    for (const tu of toolUses) {
      const outcome = await executeAction(tu.name, tu.input, ctx, { simulationMode });
      const logged: ExecutedAction = {
        id: tu.id,
        actionName: tu.name,
        params: tu.input,
        summary: outcome.ok
          ? outcome.result?.summary ?? `${tu.name} ok`
          : outcome.error ?? `${tu.name} failed`,
        result: outcome.result?.data,
        error: outcome.ok ? undefined : outcome.error,
        timestamp: Date.now(),
      };
      actions.push(logged);
      onAction?.(logged);
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        is_error: !outcome.ok,
        content: outcome.ok
          ? JSON.stringify({
              summary: outcome.result?.summary,
              data: outcome.result?.data ?? null,
            })
          : JSON.stringify({ error: outcome.error }),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  stoppedAtCap = true;
  // Settle the mind-map session so the canvas doesn't keep pulsing the
  // root forever. Mark as failed so the canvas tints the root red.
  axonGraph.endSession({
    summary:
      finalSummary ||
      `Hit the iteration cap (${maxIters}). Operator: continue with a follow-up.`,
    failed: true,
  });
  return {
    finalSummary:
      finalSummary ||
      `Hit the iteration cap (${maxIters}) before finishing — check the activity feed for what got done.`,
    actions,
    iterations: iter,
    stoppedAtCap,
  };
}
