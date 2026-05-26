/**
 * draftFollowUp.ts — Template-based follow-up email generator.
 *
 * Stand-in for the real AXON `capital_advise` action wired in
 * Phase 4. Today this is pure local logic: given an investor +
 * round + last touchpoint, produce a plausible follow-up.
 *
 * When Phase 4 lands, this file's `draftFollowUp` becomes one of
 * the prompts AXON sees, and the actual email body comes back
 * model-generated. Until then it's a useful starting draft the
 * user can edit-then-copy.
 *
 * Tone targets:
 *   - "intro" / "meeting"   →  warm, brief, propose next step
 *   - "diligence"           →  send-the-thing, attach Y, schedule X
 *   - "verbal" / "term-sheet" →  close-out, ask for wire/signed docs
 *   - "passed" / "ghosted"  →  graceful re-engagement (only if explicit)
 */

import type {
  CapitalCheck,
  CapitalCheckTouchpoint,
  CapitalRound,
} from "../CapitalPlan.queries";

export interface DraftedEmail {
  subject: string;
  body: string;
  /** Why AXON chose this approach — surfaced in the UI as a tooltip. */
  rationale: string;
}

interface DraftContext {
  investor: CapitalCheck;
  round: CapitalRound | null;
  lastTouchpoint: CapitalCheckTouchpoint | null;
  founderName?: string;
  companyName?: string;
}

const FOUNDER_DEFAULT = "Ali";
const COMPANY_DEFAULT = "Takeover";

export function draftFollowUp(ctx: DraftContext): DraftedEmail {
  const { investor, round, lastTouchpoint } = ctx;
  const founder = ctx.founderName ?? FOUNDER_DEFAULT;
  const company = ctx.companyName ?? COMPANY_DEFAULT;
  const firstName = (investor.investor_name.split(" ")[0] || "").trim();
  const greeting = firstName ? `Hey ${firstName},` : "Hi,";

  const roundLabel = round
    ? `${prettyRoundTypeName(round.round_type)} (${formatRaise(round.target_amount)}${
        round.valuation_cap ? ` @ ${formatRaise(round.valuation_cap)} cap` : ""
      })`
    : "our current round";

  const daysSinceTouch = lastTouchpoint
    ? Math.floor((Date.now() - new Date(lastTouchpoint.occurred_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const stale = daysSinceTouch !== null && daysSinceTouch > 14;

  switch (investor.status) {
    case "lead":
      return {
        subject: `${company} — quick intro?`,
        body: cleanup(`
${greeting}

I'm ${founder}, building ${company} — an audited AI operator for company operations. We're raising ${roundLabel} and I'd love 20 minutes to walk you through what we're seeing with our early design partners.

${investor.intro_source ? `${investor.intro_source} thought you'd be a strong fit given your work in agentic AI.` : "Happy to share more context on what we're building if useful."}

Open to a call in the next two weeks?

— ${founder}
        `),
        rationale: "Cold/lead status. Keeps it short, leads with the wedge, names the intro source if present.",
      };

    case "intro":
      return {
        subject: `${company} — following up`,
        body: cleanup(`
${greeting}

Thanks again for the intro${stale ? " a couple weeks back" : ""}. Wanted to circle back and see if you'd have time for a quick demo — I can show how ${company} is closing the gap between "AI assistant" and "AI operator" with three of our design partners' actual workflows.

We're targeting close on ${roundLabel} in the next ${daysUntil(round?.target_close_date) ?? "month or so"}, and I'd really value your read before then.

Does next ${suggestNextDay()} or the week after work?

— ${founder}
        `),
        rationale: "Intro made, now nudging into a meeting. References the round timeline to create gentle urgency.",
      };

    case "meeting":
      return {
        subject: `${company} — next steps`,
        body: cleanup(`
${greeting}

Really enjoyed our conversation${lastTouchpoint?.summary ? ` — your point about ${snippet(lastTouchpoint.summary)} is something I've been chewing on since` : ""}.

Two quick things to move us forward:

1. I'll send over the data room (security architecture, design-partner traction, financial model) — anything specific you want to see beyond that?

2. ${roundLabel} closes in ${daysUntil(round?.target_close_date) ?? "the coming weeks"}. If you're in, I'd love to lock in a check size so we can size the rest of the round around it.

Let me know what you're thinking.

— ${founder}
        `),
        rationale: "Post-meeting follow-up. References a meeting takeaway if available, then explicit asks for diligence direction + check size.",
      };

    case "diligence":
      return {
        subject: `${company} — diligence package + check ask`,
        body: cleanup(`
${greeting}

Following up with the materials from our last call. The data room link is below${investor.contact_email ? "" : " — let me know what email to send the access invite to"}.

A few things I'd love from you before ${roundLabel} closes:

- A verbal check-size commitment (we're sizing the rest of the round around early commits)
- Any final questions before you'd be ready to sign

Happy to jump on another call if it helps move things along.

— ${founder}
        `),
        rationale: "Active diligence — be useful, ask explicitly for the verbal and outstanding questions.",
      };

    case "verbal":
      return {
        subject: `${company} — papering it up`,
        body: cleanup(`
${greeting}

Great talking with you — really excited to have you in ${roundLabel}.

We're using the standard YC post-money SAFE${round?.valuation_cap ? ` at a ${formatRaise(round.valuation_cap)} cap` : ""}. Sending docs over via [DocuSign / SAFE link] today — should take less than 5 minutes to sign once it's in front of you.

Wire instructions will come with the signed doc. Targeting close on ${formatDate(round?.target_close_date) ?? "the round close date"}.

Anything you need from me to make this easy?

— ${founder}
        `),
        rationale: "Verbal commit — move them to signed fast, no friction, explicit instrument terms.",
      };

    case "term-sheet":
      return {
        subject: `${company} — term sheet sent`,
        body: cleanup(`
${greeting}

Term sheet's in your inbox — should be the standard post-money SAFE we discussed. Let me know if any of the terms need adjustment or if you'd like to hop on a call to walk through.

Looking forward to having you on board.

— ${founder}
        `),
        rationale: "Document sent — short and clean, invites pushback if any, signals you're ready to negotiate quickly.",
      };

    case "signed":
      return {
        subject: `${company} — wire instructions`,
        body: cleanup(`
${greeting}

Thanks for getting the SAFE signed so quickly — really appreciate the speed.

Wire details:

  Bank: [Mercury]
  Account name: ${company}, Inc.
  Routing: [routing #]
  Account: [account #]
  Reference: ${investor.investor_name} — ${roundLabel.split(" (")[0]}

Once it lands I'll send a confirmation and add you to the investor update list.

— ${founder}
        `),
        rationale: "Signed — operationally tight wire instructions, no fluff, sets expectations for what comes next.",
      };

    case "wired":
      return {
        subject: `${company} — wire received, welcome aboard`,
        body: cleanup(`
${greeting}

Wire landed. Thank you for backing ${company}.

You're now on the investor update list — first update goes out at the end of the month and they're monthly after that. If there's anything specific you'd like to be looped in on (hiring, GTM milestones, board-level decisions), just let me know.

More soon.

— ${founder}
        `),
        rationale: "Closeout / relationship-build. Confirms receipt, sets cadence on updates, opens door for specific asks.",
      };

    case "passed":
      return {
        subject: `${company} — appreciate the time`,
        body: cleanup(`
${greeting}

Totally understand — thanks for being direct${lastTouchpoint?.summary ? ` about ${snippet(lastTouchpoint.summary)}` : ""}. If anything changes or if you'd be open to a check at the seed, I'd love to stay in touch.

I'll keep you on the quarterly update list (let me know if you'd rather opt out).

— ${founder}
        `),
        rationale: "Graceful close on a pass. Keeps the door open for seed without being needy.",
      };

    case "ghosted":
      return {
        subject: `${company} — last nudge`,
        body: cleanup(`
${greeting}

Last note — wanted to give you one more shot before ${roundLabel} closes${
          round?.target_close_date ? ` on ${formatDate(round.target_close_date)}` : ""
        }. If now's not the right time or it's a pass, totally fine, just want to free up the headspace on both ends.

Either way, I'll stop emailing after this.

— ${founder}
        `),
        rationale: "Ghosted. One final low-pressure nudge with an explicit out — better than perpetual follow-up.",
      };

    default:
      return {
        subject: `${company} — checking in`,
        body: cleanup(`
${greeting}

Quick check-in on where things stand with ${roundLabel}. Happy to hop on a call or answer anything via email — whatever works for you.

— ${founder}
        `),
        rationale: "Generic fallback when status is ambiguous.",
      };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function prettyRoundTypeName(t: string): string {
  return ({
    "angel": "our angel round",
    "pre-seed": "our pre-seed",
    "seed": "our seed",
    "series-a": "Series A",
    "series-b": "Series B",
    "series-c": "Series C",
    "bridge": "our bridge round",
    "extension": "our seed extension",
  } as Record<string, string>)[t] ?? "our round";
}

function formatRaise(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
}

function daysUntil(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 30) return `${Math.ceil(days / 7)} weeks`;
  return `${Math.ceil(days / 30)} month${Math.ceil(days / 30) === 1 ? "" : "s"}`;
}

function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

function suggestNextDay(): string {
  // Suggest 7 days out from today, rounded to a weekday.
  const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const day = target.getDay();
  if (day === 0) target.setDate(target.getDate() + 1); // Sunday → Monday
  if (day === 6) target.setDate(target.getDate() + 2); // Saturday → Monday
  return target.toLocaleDateString(undefined, { weekday: "long" });
}

function snippet(text: string, max = 50): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trim() + "…";
}

function cleanup(body: string): string {
  // Trim leading/trailing whitespace and collapse runs of 3+ blank lines.
  return body
    .split("\n")
    .map((line) => line.replace(/^\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
