// ───────────────────────────────────────────────────────────────────
// The Claude brain — tool-use loop against Anthropic's API.
//
// Security note: this calls the Anthropic API directly from the
// renderer with `anthropic-dangerous-direct-browser-access`. That's
// acceptable for a Tauri desktop admin tool where the key lives in a
// local .env and never ships to a public web surface. If you ever
// publish this as a web app, proxy through a backend.
// ───────────────────────────────────────────────────────────────────

import type { ActionContext, ConversationTurn, ExecutedAction } from "../types";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
  SYSTEM_PROMPT,
} from "../config";
import { buildToolDefinitions } from "../actions/registry";
import { executeAction } from "./executor";

// Anthropic content block types (minimal shape we care about).
type TextBlock = { type: "text"; text: string };
type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface AnthropicResponse {
  id: string;
  role: "assistant";
  model: string;
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence";
  content: ContentBlock[];
}

export interface BrainRunResult {
  assistantText: string;
  actions: ExecutedAction[];
  /** True if we stopped early due to a missing API key or server error. */
  fallback: boolean;
  fallbackReason?: string;
}

function buildContextPreamble(ctx: ActionContext): string {
  const now = new Date();
  const companyDisplay =
    ctx.activeCompany === "simplicityFunds"
      ? "Simplicity"
      : ctx.activeCompany === "codeWithAli"
      ? "CodeWithAli"
      : "all companies";
  return [
    `Operator: ${ctx.operator.username} (role: ${ctx.operator.role})`,
    `Active company: ${companyDisplay}`,
    `Current path: ${ctx.currentPath}`,
    `Local time: ${now.toString()}`,
  ].join("\n");
}

/** Serialize conversation history into Anthropic messages. */
function serializeHistory(history: ConversationTurn[]): AnthropicMessage[] {
  // Exclude system-note turns from the API payload; keep user + axon alternation.
  const rel = history.filter((t) => t.role === "user" || t.role === "axon");
  // Coalesce to alternating roles the API requires.
  const out: AnthropicMessage[] = [];
  for (const t of rel) {
    const role: "user" | "assistant" = t.role === "user" ? "user" : "assistant";
    if (out.length > 0 && out[out.length - 1].role === role) {
      // Same role twice in a row — concatenate text to keep API happy.
      const prev = out[out.length - 1];
      const prevText =
        typeof prev.content === "string"
          ? prev.content
          : prev.content.map((c) => (c.type === "text" ? c.text : "")).join(" ");
      prev.content = `${prevText}\n${t.text}`;
    } else {
      out.push({ role, content: t.text });
    }
  }
  return out;
}

async function anthropicCall(messages: AnthropicMessage[]): Promise<AnthropicResponse> {
  const tools = buildToolDefinitions();
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages,
  };

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY ?? "",
      "anthropic-version": ANTHROPIC_API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }

  return (await res.json()) as AnthropicResponse;
}

export async function runTurn(
  userText: string,
  history: ConversationTurn[],
  ctx: ActionContext,
  opts: { confidence?: number } = {}
): Promise<BrainRunResult> {
  if (!ANTHROPIC_API_KEY) {
    return {
      assistantText:
        "My reasoning engine is offline. The Anthropic API key is not configured — add VITE_ANTHROPIC_API_KEY to the environment.",
      actions: [],
      fallback: true,
      fallbackReason: "missing-api-key",
    };
  }

  const preamble = buildContextPreamble(ctx);
  const confidenceNote =
    opts.confidence !== undefined && opts.confidence < 0.65
      ? `\n[voice transcript confidence: ${Math.round(opts.confidence * 100)}% — confirm destructive actions]`
      : "";

  const historyMsgs = serializeHistory(history);
  const primingMsg: AnthropicMessage = {
    role: "user",
    content: `${preamble}${confidenceNote}\n\nOperator command: ${userText}`,
  };

  // Replace the last user turn (which duplicates userText) with the primed one.
  if (historyMsgs.length > 0 && historyMsgs[historyMsgs.length - 1].role === "user") {
    historyMsgs[historyMsgs.length - 1] = primingMsg;
  } else {
    historyMsgs.push(primingMsg);
  }

  const actions: ExecutedAction[] = [];
  let messages: AnthropicMessage[] = [...historyMsgs];
  let finalText = "";
  const MAX_ITER = 4;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let response: AnthropicResponse;
    try {
      response = await anthropicCall(messages);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        assistantText: `I encountered a brain-layer error: ${message}`,
        actions,
        fallback: true,
        fallbackReason: "api-error",
      };
    }

    // Collect any text blocks into the running final text.
    const textParts = response.content
      .filter((c): c is TextBlock => c.type === "text")
      .map((c) => c.text);
    if (textParts.length > 0) finalText = textParts.join("\n").trim();

    // If no tool uses, we're done.
    const toolUses = response.content.filter(
      (c): c is ToolUseBlock => c.type === "tool_use"
    );
    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      return { assistantText: finalText, actions, fallback: false };
    }

    // Add the assistant turn to the conversation.
    messages.push({ role: "assistant", content: response.content });

    // Run each tool and build tool_result blocks.
    const toolResults: ToolResultBlock[] = [];
    for (const tu of toolUses) {
      const outcome = await executeAction(tu.name, tu.input, ctx);
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
    // Loop — Claude gets tool results and composes the final response.
  }

  return {
    assistantText:
      finalText ||
      "I completed the requested actions, but ran out of reasoning iterations. Check the activity feed.",
    actions,
    fallback: false,
  };
}
