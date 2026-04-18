// ───────────────────────────────────────────────────────────────────
// Conversation summarizer.
// When the transcript grows past SUMMARY_TRIGGER_TURNS, fold the
// oldest turns (except the last SUMMARY_KEEP_RECENT) into a single
// "summary" system turn that the brain still sees in its preamble.
//
// The summarization call is silent — it does NOT speak.
// ───────────────────────────────────────────────────────────────────

import type { ConversationTurn } from "../types";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";

export interface SummaryBlock {
  text: string;
  coveredThrough: number; // timestamp of the last turn this summary covers
  createdAt: number;
}

const SUMMARY_SYSTEM = `You are summarizing a conversation between an operator and AXON, an ops-platform assistant. Produce a compact third-person summary in 2-5 sentences. Focus on: what the operator asked, what AXON did, unresolved items, and topical threads that might continue. Plain prose. No markdown.`;

export async function summarizeTurns(turns: ConversationTurn[]): Promise<string | null> {
  if (!ANTHROPIC_API_KEY || turns.length === 0) return null;

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 400,
    system: SUMMARY_SYSTEM,
    messages: [
      {
        role: "user",
        content:
          "Summarize this conversation:\n\n" +
          turns
            .map((t) => {
              const who = t.role === "user" ? "OPERATOR" : t.role === "axon" ? "AXON" : "SYSTEM";
              return `${who}: ${t.text}`;
            })
            .join("\n"),
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
    if (!res.ok) return null;
    const json = await res.json();
    const text = (json.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
      .trim();
    return text || null;
  } catch (e) {
    console.warn("[AXON] summarize failed:", e);
    return null;
  }
}
