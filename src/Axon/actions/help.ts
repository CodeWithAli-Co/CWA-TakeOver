// ───────────────────────────────────────────────────────────────────
// Help action — conversational capability readout.
// Triggered when the operator asks "what can you do", "help",
// "capabilities", "what do you know how to do", etc. The brain picks
// this when it sees discovery-style prompts and doesn't need vision or
// data — it's cheaper than asking the model to enumerate its own tools.
// ───────────────────────────────────────────────────────────────────

import type { AxonAction } from "../types";
import { listActions } from "./registry";
import { registerAction } from "./registry";

/**
 * Group action names by prefix or topic so the readout feels like a
 * human explaining "here's what I can do" instead of reciting a list.
 * Unknown actions fall into "other".
 */
function groupActions(names: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    navigation: [],
    companies: [],
    tasks: [],
    meetings: [],
    chat: [],
    memory: [],
    registry: [],
    automations: [],
    briefings: [],
    admin: [],
    trust: [],
    other: [],
  };

  for (const n of names) {
    if (n.startsWith("navigate") || n === "go_back") groups.navigation.push(n);
    else if (n.includes("company")) groups.companies.push(n);
    else if (n.includes("task")) groups.tasks.push(n);
    else if (n.includes("meeting")) groups.meetings.push(n);
    else if (
      n.includes("chat") ||
      n.includes("message") ||
      n.includes("dm") ||
      n.includes("channel")
    )
      groups.chat.push(n);
    else if (
      n.includes("memory") ||
      n.includes("remember") ||
      n.includes("preference") ||
      n.includes("forget")
    )
      groups.memory.push(n);
    else if (n.includes("registry")) groups.registry.push(n);
    else if (n.includes("automation")) groups.automations.push(n);
    else if (n === "brief_me" || n.includes("signup")) groups.briefings.push(n);
    else if (n.includes("undo")) groups.trust.push(n);
    else if (
      n.includes("announcement") ||
      n.includes("routine") ||
      n.includes("command")
    )
      groups.admin.push(n);
    else groups.other.push(n);
  }
  return groups;
}

const HUMAN_LABELS: Record<string, string> = {
  navigation: "Jump around the app (home, tasks, finance, etc.)",
  companies: "Switch between CodeWithAli and Simplicity",
  tasks: "Create, list, update, and delete tasks",
  meetings: "Schedule and manage meetings",
  chat: "Send messages and manage chat channels / DMs",
  memory: "Remember notes and preferences across sessions",
  registry: "Inspect and manage the CWA component registry",
  automations: "Schedule recurring or one-off reminders",
  briefings: "Morning briefs and activity summaries",
  admin: "Draft announcements and run registered routines",
  trust: "Undo the last reversible action",
};

export const helpAction: AxonAction<
  Record<string, never>,
  { groups: Record<string, string[]> }
> = {
  name: "help",
  description:
    "Explain what you can do. Trigger when the operator asks 'what can you do', 'help', 'what are your capabilities', 'show me what you know', or similar discovery prompts. Returns a grouped, human-friendly summary — not a raw list.",
  input_schema: {
    type: "object",
    properties: {},
  },
  handler: async (_input, _ctx) => {
    const names = listActions().map((a) => a.name);
    const groups = groupActions(names);

    // Build a spoken-friendly summary: only include non-empty groups,
    // phrase them naturally, and cap each line so it reads well aloud.
    const lines: string[] = [];
    for (const [key, actions] of Object.entries(groups)) {
      if (!actions.length) continue;
      if (key === "other") continue; // not useful to enumerate
      const label = HUMAN_LABELS[key];
      if (label) lines.push(`· ${label}`);
    }

    const summary =
      `Here's the shape of what I can do right now:\n` +
      lines.join("\n") +
      `\n\nAsk for any of these in plain language — I'll figure out which action to run. ` +
      `You can also say "undo that" any time to reverse my last move.`;

    return {
      summary,
      data: { groups },
    };
  },
};

/** Register the help action. Called from the central index. */
export function registerHelpActions() {
  registerAction(helpAction);
}
