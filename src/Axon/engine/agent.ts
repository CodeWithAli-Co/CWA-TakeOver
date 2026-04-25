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
//   • Higher iteration cap (12 vs 4) — multi-step features need it.
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

const AGENT_MAX_ITER = 14;
const AGENT_MAX_TOKENS = 4096;

const AGENT_SYSTEM = `You are AXON in autonomous engineer mode. The operator gave you a high-level goal — your job is to make it real.

CORE LOOP:
1. Plan briefly in your head — what files / actions are needed.
2. Call tools to make progress. Use generate_file, modify_file,
   scaffold_feature, list_workspace, read_workspace_file as needed.
3. After each tool result, decide: keep going, course-correct, or finish.
4. When the goal is met, produce a SHORT spoken summary (1-2 sentences,
   no markdown, no list) and stop calling tools. That ends the loop.

OPERATING RULES:
- You have a workspace (active project's path). All file ops are
  scoped inside it. Use relative paths.
- Don't ask the operator for permission. Take the next obvious step.
- If a tool fails, read the error, adjust, and retry. Don't give up
  after one failure.
- Don't over-explain between steps. One short progress line max
  ("Wrote the auth form.") — the operator hears these spoken.
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

export async function runAgent(opts: AgentRunOpts): Promise<AgentRunResult> {
  const { goal, ctx, project, maxIters = AGENT_MAX_ITER, onProgress, onAction, narrate = true } = opts;
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

  const messages: AnthropicMessage[] = [
    {
      role: "user",
      content: `${projectPreamble(project)}\n\nOperator's goal:\n"""${goal}"""\n\nMake it happen. Use tools. Stop when it's done with a short spoken summary.`,
    },
  ];

  const actions: ExecutedAction[] = [];
  let finalSummary = "";
  let iter = 0;
  let stoppedAtCap = false;

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

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
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
      }
    }

    if (toolUses.length === 0 || stopReason === "end_turn") {
      // Done — Claude has nothing more to do.
      return { finalSummary: finalSummary || "Done.", actions, iterations: iter + 1, stoppedAtCap: false };
    }

    // Persist Claude's content block as the assistant message so the
    // tool_use ids stay in scope for the next turn.
    messages.push({ role: "assistant", content });

    const toolResults: AnthropicContent[] = [];
    for (const tu of toolUses) {
      const outcome = await executeAction(tu.name, tu.input, ctx, {});
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
  return {
    finalSummary:
      finalSummary ||
      `Hit the iteration cap (${maxIters}) before finishing — check the activity feed for what got done.`,
    actions,
    iterations: iter,
    stoppedAtCap,
  };
}
