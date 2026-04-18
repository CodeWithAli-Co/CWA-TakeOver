/**
 * chatDraft.ts — Axon-authored chat reply helper.
 *
 * A lean, single-turn wrapper around the Anthropic API used by the chat
 * composer's /axon slash command. No tools, no streaming, no action
 * execution — just "given this prompt, draft a reply I can edit."
 *
 * Keeps the full brain.ts untouched. This is intentional: /axon is a
 * drafting helper, not a command execution path.
 */

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";

const DRAFT_SYSTEM_PROMPT = [
  "You are drafting a chat reply on behalf of the operator inside a team chat.",
  "Respond as if you are the operator, in first person, concise, professional.",
  "Match typical Slack/Discord tone: brief, readable, no headings or markdown decoration.",
  "Do not add preambles like 'Sure, here is...' — output the reply text only.",
  "If the request is ambiguous, produce the best single draft and stop.",
  "Target length: 1–5 sentences unless the prompt asks for more.",
].join(" ");

export interface DraftContext {
  /** The channel / DM name, e.g. "General" or "ali-and-hanif". */
  groupName: string;
  /** Last few messages in the channel, oldest first. Used for tone + context. */
  recentMessages?: { sender: string; text: string }[];
  /** Who's drafting. */
  operator: string;
}

export interface DraftResult {
  text: string;
  error?: string;
}

/**
 * Ask Axon to draft a chat reply for the given prompt. Returns plain text
 * the user can edit in the composer before sending.
 */
export async function draftChatReply(
  userPrompt: string,
  ctx: DraftContext,
): Promise<DraftResult> {
  if (!ANTHROPIC_API_KEY) {
    return {
      text: "",
      error:
        "Axon is not configured. Set VITE_ANTHROPIC_API_KEY in .env and restart.",
    };
  }

  const contextLines: string[] = [];
  contextLines.push(`Channel: #${ctx.groupName}`);
  contextLines.push(`Operator: ${ctx.operator}`);
  if (ctx.recentMessages && ctx.recentMessages.length > 0) {
    contextLines.push("", "Recent messages:");
    for (const m of ctx.recentMessages.slice(-6)) {
      contextLines.push(`  ${m.sender}: ${m.text}`);
    }
  }

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 512,
    system: DRAFT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: contextLines.join("\n") },
          {
            type: "text",
            text: `\nDraft instruction: ${userPrompt}`,
          },
        ],
      },
    ],
  };

  try {
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
      const err = await res.text().catch(() => res.statusText);
      return { text: "", error: `Axon API error: ${err.slice(0, 180)}` };
    }
    const json = (await res.json()) as {
      content: { type: string; text?: string }[];
    };
    const text = json.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    return { text };
  } catch (err) {
    return {
      text: "",
      error:
        err instanceof Error ? err.message : "Network error reaching Axon.",
    };
  }
}
