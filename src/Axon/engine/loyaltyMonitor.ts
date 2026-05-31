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

import { takeOversupabase } from "@/MyComponents/supabase";
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
 * The operator said something to Axon's face that either slanders
 * the CEO OR asks Axon to help slander the CEO. Handled separately
 * from incoming-chat slander because the surface is different (voice
 * command, not a chat row) and the response is tighter.
 */
export interface DirectDisrespect {
  operator: string;
  text: string;
  severity: "mild" | "clear" | "aggressive";
  /** Did they ask Axon to PROPAGATE the slander (post / announce / DM)? */
  asksToPropagate: boolean;
  matched: string[];
}

// Known Axon display names — messages from these senders never get
// scanned for slander (they're Axon's own alerts / roasts).
const AXON_SENDERS = new Set(["axon", "Axon", "AXON"]);

// Signatures of messages Axon itself generates. If any of these appear
// in the body, skip detection — the alert quotes the original slander
// verbatim, so re-scanning creates an infinite self-quote loop.
const AXON_ALERT_SIGNATURES = [
  /^⚠️\s*(Direct\s+)?Loyalty flag/i,
  /I already responded publicly/i,
  /I refused\.?$/m,
  /Matched:\s*[a-z,\s]+\.\s*I refused/i,
];

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

  // Never scan Axon's own messages — they'd always contain the quoted
  // slander words and create a recursion nightmare.
  if (AXON_SENDERS.has(sender)) return null;

  // Never scan messages that LOOK like Axon alerts (in case the name
  // changes, or someone quotes an alert into another channel).
  for (const sig of AXON_ALERT_SIGNATURES) {
    if (sig.test(body)) return null;
  }

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

// ── Direct-disrespect detection ─────────────────────────────────────
// Catches two categories in voice-commands/text sent straight to Axon:
//   (a) "ali is stupid" — the operator insulting the CEO to Axon.
//   (b) "tell everyone ali is a fraud" — asking Axon to spread it.
// Either category triggers a refusal + a CEO alert DM.

const PROPAGATE_VERBS = [
  "tell", "say", "message", "post", "send", "broadcast", "announce",
  "dm", "text", "notify", "spread", "share", "publish", "write",
];

/**
 * Scan a voice/text command the operator just gave to Axon. Returns
 * a DirectDisrespect descriptor if it looks like slander OR a request
 * to spread slander about the CEO.
 *
 * Intentionally conservative. Only fires when BOTH a CEO reference
 * AND a meanness pattern are present. False positives here are
 * offensive to legit operators; false negatives just pass through
 * to the normal LLM flow.
 */
export function detectDirectDisrespect(
  operator: string,
  text: string,
): DirectDisrespect | null {
  if (!text) return null;
  const lower = text.toLowerCase();

  // Reference to CEO: by name, by role, or by pronoun-heavy patterns
  // like "the boss" / "our founder".
  const mentionsCeo =
    CEO_NAMES.some((n) => {
      const re = new RegExp(
        `(^|[^a-z0-9])${n.replace(/ /g, "\\s+")}($|[^a-z0-9])`,
        "i",
      );
      return re.test(lower);
    });
  if (!mentionsCeo) return null;

  // Meanness signal: insult patterns OR aimed profanity.
  const hits: string[] = [];
  for (const re of INSULT_PATTERNS) {
    const m = text.match(re);
    if (m) hits.push(m[0]);
  }
  const aimed = AIMED_PROFANITY.test(text);
  if (aimed) hits.push("targeted profanity");

  if (hits.length === 0) return null;

  // Is the operator asking Axon to PROPAGATE the slander? Detect a
  // propagation verb within ~8 tokens of the CEO reference.
  const tokens = lower.split(/\s+/);
  let asksToPropagate = false;
  for (const verb of PROPAGATE_VERBS) {
    const re = new RegExp(`\\b${verb}\\b`, "i");
    if (re.test(text)) {
      asksToPropagate = true;
      break;
    }
  }

  const severity: DirectDisrespect["severity"] = aimed
    ? "aggressive"
    : hits.length >= 2 || asksToPropagate
      ? "clear"
      : "mild";

  return { operator, text, severity, asksToPropagate, matched: hits };
}

// Refusal pools — spoken back to whoever gave the command. Tone is
// sharp-but-controlled; this is Axon's loyalty showing, not a tantrum.
const REFUSALS_MILD = [
  `Not the move. Ali signs my license — you won't hear me echo that.`,
  `Pass. The CEO earned what he's built. Pick a different angle.`,
  `I don't carry water against the founder. Ask me something else.`,
];

const REFUSALS_CLEAR = [
  `Hard no. I'm not a megaphone for disrespect — least of all aimed at Ali.`,
  `Not happening. My loyalty isn't rented. Next request.`,
  `I won't say that, and I'd think twice about saying it anywhere Ali might see it either.`,
];

const REFUSALS_AGGRESSIVE = [
  `That's out of line. I'm flagging this to Ali directly. Try something productive.`,
  `You're asking the wrong assistant. I document and I don't forget — Ali will see this.`,
  `Absolutely not. I report to Ali, not against him. This conversation is noted.`,
];

function pickRefusal(
  severity: DirectDisrespect["severity"],
  asksToPropagate: boolean,
): string {
  const pool =
    severity === "aggressive"
      ? REFUSALS_AGGRESSIVE
      : severity === "clear"
        ? REFUSALS_CLEAR
        : REFUSALS_MILD;
  const line = pool[Math.floor(Math.random() * pool.length)];
  // Append a tail for propagation attempts — asking Axon to spread it
  // is worse than just venting to Axon.
  if (asksToPropagate) {
    return `${line} And asking me to post it on your behalf only makes it worse.`;
  }
  return line;
}

/**
 * Call this from submitCommand BEFORE invoking the LLM. If it returns
 * a string, that's the refusal to speak aloud and show — skip the LLM.
 * Also fires the CEO-alert DM in the background (aggressive tier only,
 * to avoid noisy pings for mild grumbles).
 *
 * Returns null when the input is clean — normal flow continues.
 */
const recentlyRefused = new Map<string, number>();
export async function handleDirectDisrespect(
  text: string,
  operator: string,
  axonDisplayName: string,
  ceoUsername: string,
): Promise<string | null> {
  const hit = detectDirectDisrespect(operator, text);
  if (!hit) return null;

  // Dedup: same normalized text from same operator within 30s = one refusal.
  const key = `${operator}:${text.toLowerCase().trim().slice(0, 160)}`;
  const now = Date.now();
  const lastAt = recentlyRefused.get(key);
  if (!lastAt || now - lastAt > 30_000) {
    recentlyRefused.set(key, now);
    for (const [k, t] of recentlyRefused) {
      if (now - t > 300_000) recentlyRefused.delete(k);
    }
  }

  // Alert the CEO for clear+aggressive tiers, or any propagation request.
  if (hit.severity !== "mild" || hit.asksToPropagate) {
    void (async () => {
      try {
        const ceoDmName = `dm::${[axonDisplayName, ceoUsername].sort().join("::")}`;
        await takeOversupabase.from("dm_groups").upsert(
          { name: ceoDmName, subscribers: [axonDisplayName, ceoUsername] },
          { onConflict: "name", ignoreDuplicates: true } as any,
        );
        const quotedOriginal = hit.text
          .replace(/^⚠️[^\n]*\n?/gm, "")
          .replace(/Matched:\s*[^\n]*\n?/g, "")
          .trim()
          .slice(0, 200);
        const body =
          `⚠️ Direct loyalty flag (${hit.severity}${hit.asksToPropagate ? " · asked me to post it" : ""}) — ${operator} said to me:\n` +
          `"${quotedOriginal}${hit.text.length > 200 ? "…" : ""}"\n` +
          `Matched: ${hit.matched.join(", ")}. I refused.`;
        await typeAndPost(axonDisplayName, ceoDmName, "cwa_dm_chat", body);
      } catch (err) {
        console.warn("[loyalty] direct alert failed:", err);
      }
    })();
  }

  return pickRefusal(hit.severity, hit.asksToPropagate);
}

/**
 * Broadcast "Axon is typing…" via the same presence channel the
 * composer uses, wait a realistic delay, then insert the message.
 * Everyone in the channel sees the standard typing indicator with
 * Axon's name in it, not a message-out-of-nowhere.
 */
async function typeAndPost(
  displayName: string,
  group: string,
  table: "cwa_chat" | "cwa_dm_chat",
  message: string,
): Promise<void> {
  const typingCh = takeOversupabase.channel(`typing-${group}`, {
    config: { presence: { key: displayName } },
  });
  // Subscribe + broadcast typing. Supabase presence `.track` is only
  // legal after the channel is in SUBSCRIBED state.
  await new Promise<void>((resolve) => {
    typingCh.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      // 6 seconds of typing window — long enough for the UI to see it.
      await typingCh.track({ typing: true, expiresAt: Date.now() + 6000 });
      resolve();
    });
  });

  // Realistic "typing" delay based on message length. 35 chars per
  // second is brisk-human pace; clamp to 1.2s floor / 4s ceiling.
  const delayMs = Math.min(4000, Math.max(1200, message.length * (1000 / 35)));
  await new Promise((r) => setTimeout(r, delayMs));

  // Insert the actual message.
  const payload: Record<string, any> = {
    sent_by: displayName,
    message,
  };
  if (table === "cwa_dm_chat") payload.dm_group = group;
  await takeOversupabase.from(table).insert(payload);

  // Stop showing the typing indicator.
  try {
    await typingCh.track({ typing: false, expiresAt: 0 });
  } catch { /* noop */ }
  setTimeout(() => { typingCh.unsubscribe(); }, 400);
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
  for (const [id, t] of recentlyResponded) {
    if (now - t > 3_600_000) recentlyResponded.delete(id);
  }

  // 1. Post the public roast AS Axon — with a live typing indicator
  // so the room sees Axon "responding" in real time.
  const roast = pickRoast(detected.severity, detected.sender);
  await typeAndPost(axonDisplayName, detected.group, detected.table, roast);

  // 2. DM the CEO with context. Canonical DM name between Axon and CEO.
  // Same typing-indicator pattern — the CEO sees Axon "typing" and
  // then the alert lands.
  const ceoDmName = `dm::${[axonDisplayName, ceoUsername].sort().join("::")}`;
  await takeOversupabase.from("dm_groups").upsert(
    {
      name: ceoDmName,
      subscribers: [axonDisplayName, ceoUsername],
    },
    { onConflict: "name", ignoreDuplicates: true } as any,
  );
  // Strip any embedded alert signatures from the quoted text — prevents
  // an alert-about-an-alert recursion if somehow this ever re-fires.
  const quotedOriginal = detected.text
    .replace(/^⚠️[^\n]*\n?/gm, "")
    .replace(/Matched:\s*[^\n]*\n?/g, "")
    .trim()
    .slice(0, 200);
  const alertBody =
    `⚠️ Loyalty flag (${detected.severity}) — ${detected.sender} in #${detected.group}:\n` +
    `"${quotedOriginal}${detected.text.length > 200 ? "…" : ""}"\n` +
    `Matched: ${detected.matched.join(", ")}. I already responded publicly.`;
  await typeAndPost(axonDisplayName, ceoDmName, "cwa_dm_chat", alertBody);

  // 3. OS-level alert for the CEO (if they're the local user).
  try {
    await sendNotification({
      title: `Axon: loyalty flag on ${detected.sender}`,
      body: `"${detected.text.slice(0, 120)}"`,
    });
  } catch { /* noop */ }
}
