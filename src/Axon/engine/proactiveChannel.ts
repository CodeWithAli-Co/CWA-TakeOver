/**
 * engine/proactiveChannel.ts
 *
 * Single pipe every proactive utterance flows through. Monitors,
 * scheduled briefs (morning_brief, end_of_day), and any future
 * agent-initiated speech call `proactiveChannel.speakNow(...)`
 * instead of voiceOut.speak() directly, so we can:
 *
 *   - Enforce a per-day budget. proactiveMode caps the total
 *     count of proactive utterances Axon emits per local-day:
 *       "off"      -> 0
 *       "quiet"    -> 3
 *       "standard" -> 10
 *       "chatty"   -> 25
 *
 *   - Enforce per-source cooldowns. Each call passes a `sourceId`
 *     (e.g. "runway-alarm", "morning_brief") and a minimum
 *     interval before that source can fire again. Defaults to
 *     30 minutes -- monitors with their own intervalMs can pass
 *     shorter if appropriate, but most shouldn't need to.
 *
 *   - Apply urgency-aware dropping. Each utterance carries an
 *     urgency level: "high" / "normal" / "low". In modes where
 *     the budget is tight ("quiet"), only "high" utterances pass.
 *     "low" is reserved for nice-to-have chatter that should never
 *     burn budget in calmer modes.
 *
 *   - State gate. Even with budget remaining, we never speak
 *     while Axon is mid-turn -- the AxonProvider monitor effect
 *     does this check upstream too, but we re-check here so any
 *     future caller automatically inherits the guard.
 *
 * The channel is stateless across reloads -- budget + cooldown
 * are in-memory only. That's fine because a reload implies the
 * operator is back at the desk, and there's no "wasted budget"
 * we'd care to persist. If we ever want next-day budget reset
 * to outlive reloads, swap the cooldown/budget Maps for
 * localStorage-backed equivalents.
 */

export type ProactiveMode = "off" | "quiet" | "standard" | "chatty";

export type ProactiveUrgency = "high" | "normal" | "low";

interface SpeakRequest {
  /** Stable id for the source (monitor/brief/whatever). Used as the
   *  cooldown key. */
  sourceId: string;
  /** The line to speak. Plain text -- the channel does no formatting. */
  text: string;
  /** "high" always speaks if any budget remains. "normal" respects
   *  the mode's bar. "low" is dropped in "quiet" / "off" entirely. */
  urgency?: ProactiveUrgency;
  /** Minimum ms between fires for this sourceId. Defaults to 30min. */
  cooldownMs?: number;
}

interface SpeakResult {
  spoken: boolean;
  reason?:
    | "mode_off"
    | "low_in_quiet"
    | "cooldown"
    | "budget_exhausted"
    | "mid_turn";
}

const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000;

// Per-source last-fire timestamps (ms epoch).
const lastFire = new Map<string, number>();
// Per-local-day budget consumed.
let budgetDayKey = "";
let budgetUsed = 0;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function budgetFor(mode: ProactiveMode): number {
  switch (mode) {
    case "off":      return 0;
    case "quiet":    return 3;
    case "standard": return 10;
    case "chatty":   return 25;
  }
}

function tickBudget() {
  const today = todayKey();
  if (today !== budgetDayKey) {
    budgetDayKey = today;
    budgetUsed = 0;
  }
}

export interface ProactiveContext {
  /** Current operator-facing proactive mode. */
  mode: ProactiveMode;
  /** True when the operator has explicitly muted Axon (forceSleep).
   *  When true, the channel refuses everything regardless of urgency. */
  muted: boolean;
  /** Current Axon status -- "listening" / "speaking" / "processing"
   *  / "executing" / "coding" block speech; anything else is fine.
   *  Caller should pass the live status from statusRef. */
  busy: boolean;
  /** Sink that actually plays the line. Provider passes the voice
   *  output speak fn here -- the channel itself never imports it,
   *  to stay testable + decoupled. */
  speak: (line: string) => void;
  /** Sink that records the proactive line in the conversation log. */
  logTurn: (line: string) => void;
}

/**
 * Try to emit a proactive utterance. Returns whether it actually
 * landed (and why not, if not). Callers can use the reason for
 * telemetry / dev logging; nothing else hinges on it.
 */
export function speakNow(
  req: SpeakRequest,
  ctx: ProactiveContext,
): SpeakResult {
  if (ctx.muted || ctx.mode === "off") {
    return { spoken: false, reason: "mode_off" };
  }
  if (ctx.busy) {
    return { spoken: false, reason: "mid_turn" };
  }
  const urgency: ProactiveUrgency = req.urgency ?? "normal";

  // Mode-vs-urgency gate. "low" is filler chatter -- only "chatty"
  // mode lets it through. "normal" passes unless we're in "quiet"
  // (which only takes "high"). "high" always passes the urgency
  // check (budget + cooldown still apply).
  if (ctx.mode === "quiet" && urgency !== "high") {
    return { spoken: false, reason: "low_in_quiet" };
  }
  if (ctx.mode !== "chatty" && urgency === "low") {
    return { spoken: false, reason: "low_in_quiet" };
  }

  // Cooldown per source.
  const now = Date.now();
  const cooldown = req.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const last = lastFire.get(req.sourceId) ?? 0;
  if (now - last < cooldown) {
    return { spoken: false, reason: "cooldown" };
  }

  // Daily budget. "high" still respects the budget (otherwise a
  // misconfigured high-urgency monitor could swamp the day) but
  // gets the FULL budget pool -- standard + low don't get to spend
  // beyond their share.
  tickBudget();
  const cap = budgetFor(ctx.mode);
  if (budgetUsed >= cap) {
    return { spoken: false, reason: "budget_exhausted" };
  }

  // Cleared all gates -- actually speak.
  ctx.logTurn(req.text);
  ctx.speak(req.text);
  lastFire.set(req.sourceId, now);
  budgetUsed += 1;
  return { spoken: true };
}

/** Inspection helper -- handy for a future Settings UI badge showing
 *  "Proactive Axon: 3 of 10 today". */
export function getProactiveStats(): {
  budgetUsed: number;
  budgetDay: string;
} {
  return { budgetUsed, budgetDay: budgetDayKey };
}

/** Test / dev helper -- clear cooldowns + budget. Not called from
 *  production code paths but useful in the /dev/axon-playground. */
export function resetProactiveChannel(): void {
  lastFire.clear();
  budgetDayKey = "";
  budgetUsed = 0;
}
