// ───────────────────────────────────────────────────────────────────
// Help action — conversational capability tour.
//
// Triggered when the operator asks "what can you do", "help",
// "capabilities", "show me around", etc. The previous version of
// this action enumerated only 11 of 47 action categories, output
// markdown bullets (which the TTS reads as the literal character
// "dot"), and offered no example phrases.
//
// This rewrite:
//   - Maps all 47 action files into 8 operator-facing DOMAINS so the
//     tour is grounded in what's actually shipped.
//   - Picks 3 domains per call (rotated by call count so repeat asks
//     surface different parts of Axon) and pairs each with one example
//     phrase chosen at random from a curated bank.
//   - Outputs plain prose, no bullets, no markdown, under 60 words.
//     Reads cleanly through TTS.
//   - Closes with a single concrete try-this prompt so the operator
//     has somewhere obvious to start.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { registerAction } from "./registry";

// 8 operator-facing domains. Each ties to a cluster of action files
// in src/Axon/actions/. The brief description is what gets spoken;
// keep it scannable, no jargon.
interface Domain {
  key: string;
  brief: string;     // one-line spoken description
  examples: string[]; // example phrases the operator could say
}

const DOMAINS: Domain[] = [
  {
    key: "ops",
    brief: "run your day -- tasks, meetings, the schedule, projects",
    examples: [
      "Move my one-on-one to Thursday at 3",
      "What's on my plate today",
      "Mark the API migration done",
      "Create a task to follow up with Blaze about hiring",
    ],
  },
  {
    key: "finance",
    brief: "watch the money -- runway, Stripe revenue, invoices, capital plan",
    examples: [
      "How's runway looking",
      "Pull MRR for the last 90 days",
      "Show me failed Stripe payments",
      "What's the burn rate this month",
    ],
  },
  {
    key: "comms",
    brief: "send messages, draft emails, post to Slack, write announcements",
    examples: [
      "Draft a sharp reply to the latest investor email",
      "Post a status update in #general",
      "DM Hanif: standup got pushed to 10",
      "Write an announcement about the new hiring round",
    ],
  },
  {
    key: "people",
    brief: "hiring, candidates, onboarding, growth tracks",
    examples: [
      "Rate the top three candidates for the engineering role",
      "Generate an onboarding plan for the new hire",
      "Show me the candidate inbox",
      "Schedule a 30-min screen with Sarah",
    ],
  },
  {
    key: "sales",
    brief: "CRM -- deals, contacts, companies, pipeline activity",
    examples: [
      "What's stuck in the deal pipeline",
      "Add a contact for Acme Corp's CTO",
      "Draft a follow-up email to the Acme deal",
      "Summarize the Northwind opportunity",
    ],
  },
  {
    key: "code",
    brief: "write code, scaffold features, edit files, run tasks",
    examples: [
      "Scaffold a Settings page with theme toggles",
      "Fix the bug in TaskCard where overdue tasks render wrong",
      "Find the file where we handle Stripe webhooks",
      "Add a delete button to the contact drawer",
    ],
  },
  {
    key: "control",
    brief: "navigate the app, switch companies, change voice, set themes",
    examples: [
      "Take me to the schedule",
      "Switch to Simplicity",
      "Use the warmer voice",
      "Set the theme to light mode",
    ],
  },
  {
    key: "memory",
    brief: "remember things across sessions, log decisions, set reminders",
    examples: [
      "Remember that Blaze prefers async over meetings",
      "Remind me tomorrow morning to send the cap table",
      "Log the decision: we're not moving forward with Cesar",
      "What do you remember about my hiring preferences",
    ],
  },
];

// Per-mount call counter so successive asks surface different domains.
// Lives in module scope (resets on reload, which is fine -- a fresh
// reload is a reasonable boundary to start the rotation over).
let callCount = 0;

function pickThreeDomains(): Domain[] {
  // Rotation: shift the start position by the call count so each ask
  // surfaces a new set of three domains. The wraparound is implicit
  // via modular indexing.
  const start = callCount % DOMAINS.length;
  callCount += 1;
  return [
    DOMAINS[start],
    DOMAINS[(start + 3) % DOMAINS.length],
    DOMAINS[(start + 5) % DOMAINS.length],
  ];
}

function pickExample(d: Domain): string {
  // Random example per domain per call. No memory of which example was
  // last shown for that domain -- across a session of repeated asks the
  // operator gets natural variation.
  const i = Math.floor(Math.random() * d.examples.length);
  return d.examples[i];
}

export const helpAction: AxonAction<
  Record<string, never>,
  { domains: string[]; tryThis: string }
> = {
  name: "help",
  description:
    "Explain what you can do. Trigger when the operator asks 'what can you do', 'help', 'what are your capabilities', 'show me around', 'what should I try', or any discovery-style prompt. Returns a short conversational tour of 3 domains plus a concrete try-this example -- not a raw action list.",
  input_schema: {
    type: "object",
    properties: {},
  },
  handler: async (_input, _ctx) => {
    const picks = pickThreeDomains();
    const tryThis = pickExample(picks[0]);

    // Plain prose, no bullets, no markdown. Reads cleanly through TTS.
    // Format: opener -> 3 domain sentences -> closer with a try-this.
    const opener =
      "I run ops, code, comms, and the money side. Right now you could ";
    const middle = picks
      .map((d) => d.brief)
      .join("; you could also ");
    const closer = ` Try saying something like, "${tryThis}."`;

    const summary = `${opener}${middle}.${closer}`;

    return {
      summary,
      data: {
        domains: picks.map((d) => d.key),
        tryThis,
      },
    };
  },
};

// Used by the Axon panel empty state to show a few "Try saying..."
// hints without having to invoke the action. Same example bank, same
// rotation, but consumed at render time by AxonPanel.
export function sampleStarterPrompts(n = 3): string[] {
  // Pull n distinct examples from across all domains so the empty
  // state hints span the surface, not just one bucket.
  const all = DOMAINS.flatMap((d) => d.examples);
  const picked: string[] = [];
  const seen = new Set<number>();
  while (picked.length < n && seen.size < all.length) {
    const i = Math.floor(Math.random() * all.length);
    if (seen.has(i)) continue;
    seen.add(i);
    picked.push(all[i]);
  }
  return picked;
}

/** Register the help action. Called from the central index. */
export function registerHelpActions() {
  registerAction(helpAction);
}
