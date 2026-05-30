/**
 * draftOperationsBrief.ts — Axon-authored operations briefing.
 *
 * One-shot, non-streaming wrapper around the Anthropic API. Takes a
 * snapshot of the operator's current ops state and returns a punchy
 * 15-25 word briefing string. Used by the AxonBrief widget on the
 * /operations dashboard.
 *
 * Three things keep the output genuinely varied across calls:
 *   1. `temperature: 1.0` — max LLM variance.
 *   2. A random "angle" hint picked from a pool of framings — pushes
 *      the model toward different rhetorical shapes each time
 *      (urgency-first / momentum-first / risk-first / etc.).
 *   3. Time-of-day signal — morning vs afternoon vs evening tone
 *      shifts naturally.
 *
 * Combined, the same snapshot will not produce the same sentence
 * twice in a row.
 */

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";

const BRIEF_SYSTEM_PROMPT = [
  "You are Axon, an operations briefing assistant for an early-stage startup team.",
  "Given a snapshot of the operator's current tasks, quotas, and projects, write a SHORT briefing.",
  "Tone: punchy, conversational, like a chief of staff giving a verbal heads-up at the door.",
  "Vary your phrasing and framing significantly every call — never feel like a template.",
  "Pick the one or two most pressing facts. Emphasize action over enumeration.",
  "If things are calm, say so lightly — do not manufacture urgency.",
  "No headings, no bullets, no markdown, no emojis. Plain prose only.",
  "Hard cap: 30 words. Aim for 15-25.",
  "Do NOT add preambles like 'Here is your brief' or 'Status:' — start with the substance.",
].join(" ");

export interface OperationsSnapshot {
  /** Display name of the person being briefed (for second-person voice). */
  operator: string;
  /** Local hour 0-23, used for time-of-day tone signal. */
  hour: number;
  dueToday: number;
  overdue: number;
  inProgress: number;
  doneThisWeek: number;
  activeProjects: number;
  pendingQuotas: number;
  /** Items (any kind) untouched for >7 days. */
  stuckCount: number;
  /** Tasks/quotas/projects flagged "high" priority. */
  highPriorityCount: number;
  /** 1-3 titles of the most pressing items, for color. */
  topTitles: string[];
}

export interface BriefResult {
  text: string;
  error?: string;
}

/** Random angle hints — picked at random each call so the brief
 *  shifts rhetorical shape, not just word choice. */
const ANGLES = [
  "Lead with the single most urgent thing.",
  "Open with momentum — what's working — before any risk.",
  "Be a coach: encourage if there's progress, direct if there's drift.",
  "Note one win and one watch-item, that's it.",
  "Treat it like a verbal handoff between teammates.",
  "Skip the small stuff — only call out items that matter today.",
  "Be analytical: surface the underlying pattern, not just the number.",
  "Tone: a chief of staff doing a quick door-pop.",
  "Frame the next concrete action the operator should take.",
  "If there's a tradeoff to make, name it.",
];

export async function draftOperationsBrief(
  snap: OperationsSnapshot,
): Promise<BriefResult> {
  if (!ANTHROPIC_API_KEY) {
    return {
      text: "",
      error: "Axon is not configured. Set VITE_ANTHROPIC_API_KEY in .env.",
    };
  }

  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)]!;
  const timeOfDay =
    snap.hour < 5
      ? "late night"
      : snap.hour < 12
        ? "morning"
        : snap.hour < 17
          ? "afternoon"
          : snap.hour < 21
            ? "evening"
            : "night";

  const lines: string[] = [];
  lines.push(`Operator: ${snap.operator}`);
  lines.push(`Time of day: ${timeOfDay} (hour ${snap.hour})`);
  lines.push("");
  lines.push("Operations snapshot:");
  lines.push(`- Tasks due today: ${snap.dueToday}`);
  lines.push(`- Tasks overdue: ${snap.overdue}`);
  lines.push(`- Tasks in progress: ${snap.inProgress}`);
  lines.push(`- Tasks completed this week: ${snap.doneThisWeek}`);
  lines.push(`- Active projects: ${snap.activeProjects}`);
  lines.push(`- Pending weekly quotas: ${snap.pendingQuotas}`);
  lines.push(`- Stuck items (no movement >7d): ${snap.stuckCount}`);
  lines.push(`- High-priority items overall: ${snap.highPriorityCount}`);
  if (snap.topTitles.length > 0) {
    lines.push(
      `- Most pressing item titles: ${snap.topTitles.slice(0, 3).join(" | ")}`,
    );
  }
  lines.push("");
  lines.push(`Framing angle for this brief: ${angle}`);
  lines.push("");
  lines.push("Write the brief now in 15-25 words, second person, no preamble:");

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 200,
    temperature: 1.0,
    system: BRIEF_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: lines.join("\n") }],
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
