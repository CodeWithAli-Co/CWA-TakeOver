// ───────────────────────────────────────────────────────────────────
// Profile-aware preamble.
//
// Composes a tasteful, context-aware subset of OperatorProfile facts
// to inject into the brain's system context. The whole point of the
// profile system is the SURFACING POLICY -- shoving every known fact
// into every turn would be both wasteful (tokens) and creepy ("hi
// Ali, your wife Sarah and I have been thinking about your overdue
// tasks"). So this module decides:
//
//   1. WHICH facts are RELEVANT to the current moment.
//   2. HOW to phrase them as natural-language context lines.
//
// Inputs are passed in explicitly so the function stays pure +
// testable. No globals, no localStorage reads, no clock calls --
// the caller provides the current time and the profile.
//
// The output is a compact string (<= ~200 tokens) appended to the
// brain's preamble. Empty string when there's nothing relevant.
// ───────────────────────────────────────────────────────────────────

import type { OperatorProfile } from "./memory";

export interface PreambleContext {
  /** Local hour 0-23. */
  hour: number;
  /** 0=Sun, 1=Mon, ... 6=Sat. */
  dayOfWeek: number;
  /** Last user-turn text (lowercased). Lets us match "personal context"
   *  phrases like "wife", "kid", "home", etc. so partner_name and
   *  family facts only surface when the conversation is actually
   *  about that side of life. */
  recentUtterance?: string;
}

/**
 * Compose the profile preamble for the current moment. Returns
 * empty string when no field is relevant -- the brain prompt should
 * NOT have a "Operator profile:" heading dangling with nothing
 * under it.
 */
export function composeProfilePreamble(
  profile: OperatorProfile,
  ctx: PreambleContext,
): string {
  const lines: string[] = [];

  // ── Style hint -- always included if set ─────────────────────
  // Comm style is tone-shaping context that the brain should know
  // every turn ("terse", "verbose ok", "no follow-up questions").
  if (profile.comm_style) {
    lines.push(`Operator prefers: ${profile.comm_style}.`);
  }

  // ── Topics to avoid -- always included if set ────────────────
  // Pre-empts the operator having to say "don't bring up X again."
  if (profile.avoid_topics && profile.avoid_topics.length > 0) {
    lines.push(
      `Don't bring up: ${profile.avoid_topics.join(", ")}.`,
    );
  }

  // ── Current focus -- always included if set ──────────────────
  // What the operator is heads-down on this week/month. Helps the
  // brain prioritize what to surface and what to suppress.
  if (profile.current_focus) {
    lines.push(`Operator's current focus: ${profile.current_focus}.`);
  }

  // ── Time-of-day fields ───────────────────────────────────────
  //
  // Lunch -- surface in the 11:30-13:30 window. The brain can say
  // "you usually eat around 1, want me to hold off?" without the
  // operator having to remind it.
  if (profile.lunch_time && ctx.hour >= 11 && ctx.hour <= 14) {
    lines.push(`Operator's usual lunch: ${profile.lunch_time}.`);
  }

  // Workday start -- surface in the early morning window. Lets the
  // brain greet appropriately ("you're earlier than your usual 9").
  if (profile.workday_start && ctx.hour >= 5 && ctx.hour <= 10) {
    lines.push(`Operator's usual workday start: ${profile.workday_start}.`);
  }

  // Workday end -- surface in the late afternoon / evening window.
  if (profile.workday_end && ctx.hour >= 16 && ctx.hour <= 22) {
    lines.push(`Operator's usual workday end: ${profile.workday_end}.`);
  }

  // Focus block -- surface during plausible focus hours (typically
  // morning-ish). The brain should know to defer interruptions then.
  if (profile.focus_block && ctx.hour >= 8 && ctx.hour <= 13) {
    lines.push(`Operator's focus block: ${profile.focus_block}.`);
  }

  // Exercise -- only on weekdays, only around plausible times. Keeps
  // it from feeling stalker-ish on Saturday afternoons.
  if (
    profile.exercise &&
    ctx.dayOfWeek >= 1 &&
    ctx.dayOfWeek <= 5 &&
    ((ctx.hour >= 5 && ctx.hour <= 9) || (ctx.hour >= 17 && ctx.hour <= 20))
  ) {
    lines.push(`Operator's exercise: ${profile.exercise}.`);
  }

  // ── Personal-context fields ──────────────────────────────────
  //
  // partner_name + family only surface when the recent utterance
  // actually has personal-life signal. Otherwise they'd feel out of
  // place in a work context ("hey Axon, what's MRR?" -- the brain
  // doesn't need to know about Sarah for that).
  const utterance = (ctx.recentUtterance ?? "").toLowerCase();
  const PERSONAL_TRIGGERS = [
    "wife",
    "husband",
    "partner",
    "spouse",
    "kid",
    "kids",
    "son",
    "daughter",
    "family",
    "home",
    "weekend",
    "vacation",
    "anniversary",
    "birthday",
  ];
  const hasPersonalContext = PERSONAL_TRIGGERS.some((t) => utterance.includes(t));

  if (hasPersonalContext) {
    if (profile.partner_name) {
      lines.push(`Operator's partner: ${profile.partner_name}.`);
    }
    if (profile.family) {
      lines.push(`Operator's family: ${profile.family}.`);
    }
  }

  // ── Stressors -- surface in coaching contexts ────────────────
  //
  // Words like "stuck", "stressed", "overwhelmed", "frustrated" --
  // gives the brain the context to acknowledge what's hard for this
  // specific person, not generic encouragement.
  const COACHING_TRIGGERS = [
    "stuck",
    "stressed",
    "overwhelmed",
    "frustrated",
    "tired",
    "burned out",
    "anxious",
    "worried",
  ];
  const hasCoachingContext = COACHING_TRIGGERS.some((t) =>
    utterance.includes(t),
  );
  if (
    hasCoachingContext &&
    profile.stressors &&
    profile.stressors.length > 0
  ) {
    lines.push(
      `Recurring stressors for this operator: ${profile.stressors.join("; ")}.`,
    );
  }

  // ── Wins -- surface in coaching contexts OR after-work hours ──
  //
  // Counterweight to stressors. When the operator is reflecting (end
  // of day, end of week, or in a coaching moment), recent wins give
  // the brain something genuine to anchor on instead of empty
  // affirmation.
  const isReflectionTime = ctx.hour >= 17 || (ctx.dayOfWeek === 5 && ctx.hour >= 14);
  if (
    (hasCoachingContext || isReflectionTime) &&
    profile.wins &&
    profile.wins.length > 0
  ) {
    // Most recent 3 wins only -- a wall of accomplishments reads as
    // self-congratulatory rather than grounded.
    const recent = profile.wins.slice(-3);
    lines.push(`Recent wins: ${recent.join("; ")}.`);
  }

  if (lines.length === 0) return "";
  return `What you know about the operator (use only when relevant; don't volunteer unless it fits):\n${lines.join("\n")}`;
}

/**
 * Convenience wrapper that derives the PreambleContext from the
 * current local time. Pass the most recent user-turn text in too if
 * you want personal/coaching context detection.
 */
export function composeProfilePreambleNow(
  profile: OperatorProfile,
  recentUtterance?: string,
): string {
  const now = new Date();
  return composeProfilePreamble(profile, {
    hour: now.getHours(),
    dayOfWeek: now.getDay(),
    recentUtterance,
  });
}
