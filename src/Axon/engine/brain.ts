// ───────────────────────────────────────────────────────────────────
// The Claude brain — streaming tool-use loop against Anthropic's API.
//
// Streams responses via SSE so speech can start as the first sentence
// arrives, not when the whole reply completes.
//
// Security note: this calls the Anthropic API directly from the
// renderer with `anthropic-dangerous-direct-browser-access`. Acceptable
// for a Tauri desktop admin tool. For a public web build, proxy.
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
import { captureScreenContext } from "./screenContext";
import { loadMemory, memoryPreamble, sinceLastSeen } from "./memory";
import {
  captureScreenshot,
  dataUrlToBase64,
  suggestsVision,
} from "./visionCapture";

// ── types ─────────────────────────────────────────────────────
type TextBlock = { type: "text"; text: string };
type ImageBlock = {
  type: "image";
  source: { type: "base64"; media_type: string; data: string };
};
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
type ContentBlock = TextBlock | ImageBlock | ToolUseBlock | ToolResultBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface StreamTurnResult {
  content: ContentBlock[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | "stop_sequence" | string;
}

export interface BrainRunOpts {
  confidence?: number;
  /** Optional prior-conversation summary injected into the preamble. */
  summary?: string | null;
  /** Vision: never / auto (on keywords) / always. */
  visionMode?: "off" | "auto" | "always";
  /** Fires with incremental text as the FINAL assistant text streams in. */
  onTextDelta?: (chunk: string) => void;
  /** Fires once per completed sentence — handy for sentence-by-sentence TTS. */
  onSentence?: (sentence: string) => void;
}

export interface BrainRunResult {
  assistantText: string;
  detail?: string;
  actions: ExecutedAction[];
  fallback: boolean;
  fallbackReason?: string;
}

// ── helpers ───────────────────────────────────────────────────
function humanizeApiError(raw: string): string {
  const m = raw.match(/Anthropic\s+(\d{3})/i);
  const code = m ? m[1] : "";
  if (code === "401") return "I can't reach my brain — the API key is invalid.";
  if (code === "403") return "I'm blocked from my reasoning service right now.";
  if (code === "404") return "The model I'm configured to use isn't available.";
  if (code === "429") return "I'm hitting rate limits — give me a moment.";
  if (code.startsWith("5")) return "My brain is having trouble. Try again in a sec.";
  if (/network|fetch|timeout/i.test(raw)) return "I lost the connection. Try again.";
  return "Something went wrong on my end.";
}

function buildContextPreamble(ctx: ActionContext, summary?: string | null): string {
  const now = new Date();
  const companyDisplay =
    ctx.activeCompany === "simplicityFunds"
      ? "Simplicity"
      : ctx.activeCompany === "codeWithAli"
      ? "CodeWithAli"
      : "all companies";
  const screen = captureScreenContext();
  const mem = loadMemory();
  const memBlock = memoryPreamble(mem);
  const since = sinceLastSeen(mem);

  const parts = [
    `Operator: ${ctx.operator.username} (role: ${ctx.operator.role})`,
    `Active company: ${companyDisplay}`,
    `Current path: ${ctx.currentPath}`,
    `Local time: ${now.toString()}`,
  ];
  if (since) parts.push(`Time since last session: ${since}`);
  if (memBlock) parts.push("\n" + memBlock);
  if (summary) {
    parts.push(
      `\n<prior_conversation_summary>\n${summary}\n</prior_conversation_summary>\n(These are earlier turns in the same session, compressed. Use for continuity.)`
    );
  }
  if (screen) {
    parts.push(
      `\n<visible_screen>\n${screen}\n</visible_screen>\n(Use this to resolve pronouns like "that", "this", "the first one". Do NOT quote it verbatim.)`
    );
  }
  return parts.join("\n");
}

function serializeHistory(history: ConversationTurn[]): AnthropicMessage[] {
  const rel = history.filter((t) => t.role === "user" || t.role === "axon");
  const out: AnthropicMessage[] = [];
  for (const t of rel) {
    const role: "user" | "assistant" = t.role === "user" ? "user" : "assistant";
    if (out.length > 0 && out[out.length - 1].role === role) {
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

/** Split emitted text into sentences on the fly. Returns completed sentences
 *  and the tail-buffer of incomplete text. */
export function drainSentences(buf: string): { sentences: string[]; rest: string } {
  const out: string[] = [];
  let remaining = buf;
  // Common sentence terminators. Keep the punctuation with the sentence.
  const re = /([.!?])(\s+|$)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(remaining)) !== null) {
    const end = match.index + match[1].length;
    const sentence = remaining.slice(lastIndex, end).trim();
    if (sentence.length >= 3) out.push(sentence);
    lastIndex = end + (match[2]?.length ?? 0);
  }
  return { sentences: out, rest: remaining.slice(lastIndex) };
}

// ── streaming turn ────────────────────────────────────────────
async function anthropicStreamCall(
  messages: AnthropicMessage[],
  opts: { isFinal: boolean; onTextDelta?: (chunk: string) => void }
): Promise<StreamTurnResult> {
  const tools = buildToolDefinitions();
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools,
    messages,
    stream: true,
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

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic ${res.status}: ${text.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  // Per-block accumulators — keyed by content block index.
  const blocks: Record<number, { type: "text" | "tool_use"; text?: string; id?: string; name?: string; json?: string }> = {};
  let stopReason = "";
  let buf = "";

  /* eslint-disable no-constant-condition */
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE frames separated by blank line; events use lines `event: X` and `data: JSON`.
    const frames = buf.split(/\r?\n\r?\n/);
    buf = frames.pop() ?? "";

    for (const frame of frames) {
      const lines = frame.split(/\r?\n/);
      const dataLine = lines.find((l) => l.startsWith("data: "));
      if (!dataLine) continue;
      const payload = dataLine.slice("data: ".length);
      if (payload === "[DONE]") continue;
      let evt: any;
      try { evt = JSON.parse(payload); } catch { continue; }

      switch (evt.type) {
        case "content_block_start": {
          const idx = evt.index;
          const cb = evt.content_block;
          if (cb.type === "text") {
            blocks[idx] = { type: "text", text: "" };
          } else if (cb.type === "tool_use") {
            blocks[idx] = { type: "tool_use", id: cb.id, name: cb.name, json: "" };
          }
          break;
        }
        case "content_block_delta": {
          const idx = evt.index;
          const d = evt.delta;
          const blk = blocks[idx];
          if (!blk) break;
          if (d.type === "text_delta" && blk.type === "text") {
            blk.text = (blk.text ?? "") + d.text;
            if (opts.isFinal) opts.onTextDelta?.(d.text);
          } else if (d.type === "input_json_delta" && blk.type === "tool_use") {
            blk.json = (blk.json ?? "") + (d.partial_json ?? "");
          }
          break;
        }
        case "content_block_stop":
          // nothing to do — keep accumulated
          break;
        case "message_delta":
          if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
          break;
        case "message_stop":
          // final event
          break;
        case "error":
          throw new Error(`stream error: ${evt.error?.message ?? "unknown"}`);
      }
    }
  }

  // Reconstruct content blocks array.
  const content: ContentBlock[] = Object.keys(blocks)
    .map((k) => Number(k))
    .sort((a, b) => a - b)
    .map((i) => {
      const b = blocks[i];
      if (b.type === "text") return { type: "text", text: b.text ?? "" };
      // tool_use — parse json
      let input: Record<string, unknown> = {};
      try {
        input = b.json ? JSON.parse(b.json) : {};
      } catch {
        input = {};
      }
      return { type: "tool_use", id: b.id!, name: b.name!, input };
    });

  return { content, stop_reason: stopReason || "end_turn" };
}

// ── public entry ───────────────────────────────────────────────
export async function runTurn(
  userText: string,
  history: ConversationTurn[],
  ctx: ActionContext,
  opts: BrainRunOpts = {}
): Promise<BrainRunResult> {
  if (!ANTHROPIC_API_KEY) {
    return {
      assistantText: "I'm not hooked up to my brain yet.",
      detail:
        "The Anthropic API key is missing. Add VITE_ANTHROPIC_API_KEY to your .env and restart the dev server.",
      actions: [],
      fallback: true,
      fallbackReason: "missing-api-key",
    };
  }

  const preamble = buildContextPreamble(ctx, opts.summary);
  // No confidence-based confirm injection. Low confidence → still act;
  // the operator will say "undo that" or correct if wrong. This is
  // faster than a back-and-forth confirmation loop — especially on
  // mobile/noisy-room conditions where confidence is usually < 0.65.
  const confidenceNote = "";

  // ── Vision — capture screenshot when the question implies visual perception.
  const visionMode = opts.visionMode ?? "auto";
  const wantVision =
    visionMode === "always" || (visionMode === "auto" && suggestsVision(userText));

  let screenshot: { dataUrl: string; mediaType: "image/png" } | null = null;
  if (wantVision) {
    screenshot = await captureScreenshot({ maxWidth: 1400 });
  }

  const historyMsgs = serializeHistory(history);

  // Build the priming content. Include an image block if we captured one.
  const textPart = `${preamble}${confidenceNote}\n\nOperator command: ${userText}`;
  const primingContent: ContentBlock[] = [];
  if (screenshot) {
    primingContent.push({
      type: "image",
      source: {
        type: "base64",
        media_type: screenshot.mediaType,
        data: dataUrlToBase64(screenshot.dataUrl),
      },
    });
  }
  primingContent.push({ type: "text", text: textPart });

  const primingMsg: AnthropicMessage = {
    role: "user",
    content: screenshot ? primingContent : textPart,
  };

  if (historyMsgs.length > 0 && historyMsgs[historyMsgs.length - 1].role === "user") {
    historyMsgs[historyMsgs.length - 1] = primingMsg;
  } else {
    historyMsgs.push(primingMsg);
  }

  const actions: ExecutedAction[] = [];
  const messages: AnthropicMessage[] = [...historyMsgs];
  let finalText = "";
  const MAX_ITER = 4;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let response: StreamTurnResult;

    // Sentence chunker — only when we're on what should be the final iteration
    // AND onSentence is provided. We don't know yet if this iter is final, so
    // we buffer text deltas and commit sentences only if the turn ends without
    // further tool_use.
    let liveBuf = "";
    const pendingSentences: string[] = [];
    const textDelta = (chunk: string) => {
      liveBuf += chunk;
      const { sentences, rest } = drainSentences(liveBuf);
      liveBuf = rest;
      for (const s of sentences) pendingSentences.push(s);
      opts.onTextDelta?.(chunk);
    };

    try {
      response = await anthropicStreamCall(messages, {
        isFinal: true, // always stream text deltas; we commit sentences conditionally
        onTextDelta: textDelta,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[AXON] Brain stream error:", message);
      return {
        assistantText: humanizeApiError(message),
        detail: message,
        actions,
        fallback: true,
        fallbackReason: "api-error",
      };
    }

    const textParts = response.content
      .filter((c): c is TextBlock => c.type === "text")
      .map((c) => c.text);
    if (textParts.length > 0) finalText = textParts.join("\n").trim();

    const toolUses = response.content.filter(
      (c): c is ToolUseBlock => c.type === "tool_use"
    );

    // If no tool uses, this is the final turn — commit any remaining buffered
    // text as the last sentence.
    if (toolUses.length === 0 || response.stop_reason === "end_turn") {
      if (opts.onSentence) {
        for (const s of pendingSentences) opts.onSentence(s);
        const tail = liveBuf.trim();
        if (tail.length > 0) opts.onSentence(tail);
      }
      return { assistantText: finalText, actions, fallback: false };
    }

    // Tool-use turn — don't emit buffered sentences; Claude is about to
    // replace them after getting tool results.
    messages.push({ role: "assistant", content: response.content });

    const toolResults: ToolResultBlock[] = [];
    for (const tu of toolUses) {
      const outcome = await executeAction(tu.name, tu.input, ctx, {
        confidence: opts.confidence,
      });
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
  }

  return {
    assistantText:
      finalText ||
      "I got everything done but ran out of reasoning steps. Check the activity feed.",
    actions,
    fallback: false,
  };
}
