/**
 * loyaltyMonitor.ts — Passive listener that scans incoming chat
 * messages for slander/insults directed at the CEO. When it catches
 * one, Axon:
 *   1. Posts a public roast reply in the same channel (so everyone
 *      sees Axon defend the chain of command).
 *   2. DMs the CEO with the full context — who said it, what they
 *      said, which channel.
 *
 * Trigger vocabulary is deliberately narrow — we don't want false
 * positives from normal teasing. Must be clearly derogatory AND
 * directed at Ali/the CEO.
 */

import supabase from "@/MyComponents/supabase";
import { sendNotification } from "@tauri-apps/plugin-notification";

// CEO's identity strings. Match is case-insensitive.
const CEO_NAMES = ["ali", "aalibrahimi", "ceo", "the boss"];

// Clear insult patterns — low-tolerance words. This list is
// deliberately direct; false positives here are worse than false
// negatives (a wrongly-accused teammate is really bad UX).
const INSULT_PATTERNS = [
  // Name-calling
  /\b(stupid|idiot|moron|dumb|trash|loser|clown|joke|fraud|scam)\b/i,
  // Competence attacks
  /\b(incompetent|worthless|useless|pathetic|delusional)\b/i,
  // Slurs (safe subset)
  /\b(a-?hole|asshat|asshole|jackass|dipshit|dumbass|douche|prick)\b/i,
  // Aggressive / dismissive
  /\b(hate|despise|can't stand|sick of)\b/i,
];

// Profanity targeting — "f*** Ali", "screw Ali", etc.
const AIMED_PROFANITY = /\b(f[*u]ck|screw|damn|shit on|hate on)\s+\w{0,6}\s*(ali|ceo|the boss)\b/i;

export interface DetectedSlander {
  sender: string;
  group: string;
  table: "cwa_chat" | "cwa_dm_chat";
  msgId: number;
  text: string;
  severity: "mild" | "clear" | "aggressive";
  matched: string[];
}

/**
 * Inspect a fresh incoming message. Returns a `DetectedSlander`
 * descriptor if it looks like slander about the CEO, otherwise null.
 */
export function detectCeoSlander(
  sender: string,
  body: string,
  group: string,
  table: "cwa_chat" | "cwa_dm_chat",
  msgId: number,
): DetectedSlander | null {
  if (!body || !sender) return null;

  const lower = body.toLowerCase();
  const mentionsCeo = CEO_NAMES.some((n) => {
    // Word-boundary-ish check so "ali" doesn't match "aliens".
    const re = new RegExp(`(^|[^a-z0-9])${n.replace(/ /g, "\\s+")}($|[^a-z0-9])`, "i");
    return re.test(lower);
  });
  if (!mentionsCeo) return null;

  const hits: string[] = [];
  for (const re of INSULT_PATTERNS) {
    const m = body.match(re);
    if (m) hits.push(m[0]);
  }
  const aimed = AIMED_PROFANITY.test(body);
  if (aimed) hits.push("targeted profanity");

  if (hits.length === 0) return null;

  const severity: DetectedSlander["severity"] = aimed
    ? "aggressive"
    : hits.length >= 2
      ? "clear"
      : "mild";

  return {
    sender,
    group,
    table,
    msgId,
    text: body,
    severity,
    matched: hits,
  };
}

const ROASTS_MILD = [
  `@{sender}, the CEO has built more than you've probably shipped this quarter. Pick a different target.`,
  `Love the confidence, @{sender}. Would be a shame if it wasn't backed by output.`,
  `@{sender}, punching up at the person signing the checks is a bold strategy.`,
];

const ROASTS_CLEAR = [
  `That's quite the monologue, @{sender}. Ali's been building while you've been posting.`,
  `@{sender} — receipts > opinions. Show me yours.`,
  `Big words, @{sender}. The CEO's calendar has been booked solid; what's your week look like?`,
];

const ROASTS_AGGRESSIVE = [
  `@{sender}, that crosses a line. The CEO has my loyalty. I'm reporting this directly.`,
  `Watch your tone, @{sender}. I document everything.`,
  `@{sender} — that's going to Ali. Enjoy the conversation.`,
];

function pickRoast(severity: DetectedSlander["severity"], sender: string): string {
  const pool =
    severity === "aggressive"
      ? ROASTS_AGGRESSIVE
      : severity === "clear"
        ? ROASTS_CLEAR
        : ROASTS_MILD;
  const line = pool[Math.floor(Math.random() * pool.length)];
  return line.replace("{sender}", sender);
}

/**
 * Actually roast in-channel + DM the CEO. Safe to call with false
 * positives (won't double-fire for the same msg_id within 10 minutes).
 */
const recentlyResponded = new Map<number, number>();

export async function respondToSlander(
  detected: DetectedSlander,
  axonDisplayName: string,
  ceoUsername: string,
): Promise<void> {
  const now = Date.now();
  const lastAt = recentlyResponded.get(detected.msgId);
  if (lastAt && now - lastAt < 600_000) return;
  recentlyResponded.set(detected.msgId, now);
  // Prune old entries so the map doesn't grow unboundedly.
  for (const [id, t] of recentlyResponded) {
    if (now - t > 3_600_000) recentlyResponded.delete(id);
  }

  // 1. Post the public roast.
  const roast = pickRoast(detected.severity, detected.sender);
  const roastPayload: Record<string, any> = {
    sent_by: axonDisplayName,
    message: roast,
  };
  if (detected.table === "cwa_dm_chat") roastPayload.dm_group = detected.group;
  await supabase.from(detected.table).insert(roastPayload);

  // 2. DM the CEO with context. Canonical DM name between Axon and CEO.
  const ceoDmName = `dm::${[axonDisplayName, ceoUsername].sort().join("::")}`;
  await supabase.from("dm_groups").upsert(
    {
      name: ceoDmName,
      subscribers: [axonDisplayName, ceoUsername],
    },
    { onConflict: "name", ignoreDuplicates: true } as any,
  );
  const alertBody =
    `⚠️ Loyalty flag (${detected.severity}) — ${detected.sender} in #${detected.group}:\n` +
    `"${detected.text.slice(0, 280)}${detected.text.length > 280 ? "…" : ""}"\n` +
    `Matched: ${detected.matched.join(", ")}. I already responded publicly.`;
  await supabase.from("cwa_dm_chat").insert({
    sent_by: axonDisplayName,
    message: alertBody,
    dm_group: ceoDmName,
  });

  // 3. OS-level alert for the CEO (if they're the local user).
  try {
    await sendNotification({
      title: `Axon: loyalty flag on ${detected.sender}`,
      body: `"${detected.text.slice(0, 120)}"`,
    });
  } catch { /* noop */ }
}
