/**
 * reportTemplates.ts — structured form-field templates per report type.
 *
 * Each template is a list of real, labeled fields. The submission
 * form renders them as proper inputs / textareas with their own
 * placeholders, hints, and row heights. When the user submits, the
 * values are serialized to a single readable body string of the
 * form:
 *
 *   Timeline:
 *   Everything went down at 2:14 PM PT. Restored at 2:37 PM.
 *
 *   Root cause:
 *   A bad migration on the primary Postgres.
 *
 *   ...
 *
 * This replaces the older approach of pre-filling a monospace
 * textarea with `## Section` headers — which was scratchpad-y and
 * looked like a code editor. Now templates generate actual forms.
 *
 * The `other / Freeform` case has zero fields, falls back to a
 * single `details` textarea in the UI.
 */

export type ReportTypeKey =
  | "status" | "project_update" | "incident" | "feedback" | "other";

export interface TemplateField {
  key: string;
  label: string;
  /** Short helper line shown under the label (optional). */
  hint?: string;
  placeholder?: string;
  /** `line` = single-line text input; `block` = multi-line textarea. */
  kind: "line" | "block";
  /** Block rows — defaults to 3 for block. Ignored for line. */
  rows?: number;
  /** Mark the label as "(optional)" in the UI. Field still accepts
   *  empty values either way; this is just a UI cue. */
  optional?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  /** One-liner describing when to use this template. */
  blurb: string;
  /** Pre-filled title the user can overwrite. */
  defaultTitle: string;
  /** Zero or more structured fields. Empty = freeform body. */
  fields: TemplateField[];
}

// ── Status updates ──────────────────────────────────────────────

const STATUS_TEMPLATES: ReportTemplate[] = [
  {
    id: "weekly-checkin",
    name: "Weekly check-in",
    blurb: "Friday / Monday recap — what you did, what's next, what's in the way.",
    defaultTitle: "Weekly check-in",
    fields: [
      {
        key: "done",
        label: "What I got done this week",
        placeholder: "Main accomplishments — wins, shipped work, hard problems solved.",
        kind: "block",
        rows: 4,
      },
      {
        key: "next",
        label: "What I'm working on next week",
        placeholder: "Planned focus for the upcoming week.",
        kind: "block",
        rows: 3,
      },
      {
        key: "blockers",
        label: "Blockers / things I need",
        hint: "What's in the way, or what you need from leadership.",
        placeholder: "Anything slowing you down. Leave blank if nothing blocking.",
        kind: "block",
        rows: 3,
        optional: true,
      },
      {
        key: "heads_up",
        label: "Heads-up for leadership",
        hint: "Context or concerns worth flagging early.",
        placeholder: "Political dynamics, client risks, burnout signals, whatever.",
        kind: "block",
        rows: 2,
        optional: true,
      },
    ],
  },
  {
    id: "end-of-sprint",
    name: "End of sprint",
    blurb: "Sprint wrap-up — what shipped, what carried, what you learned.",
    defaultTitle: "Sprint wrap",
    fields: [
      {
        key: "shipped",
        label: "Shipped",
        placeholder: "What went live / was delivered.",
        kind: "block",
        rows: 3,
      },
      {
        key: "carried_over",
        label: "Carried over",
        hint: "What didn't finish, and why.",
        placeholder: "Items slipping into next sprint — root cause, not just the list.",
        kind: "block",
        rows: 3,
      },
      {
        key: "learned",
        label: "What I learned",
        placeholder: "New insight, process change, tool you picked up.",
        kind: "block",
        rows: 2,
      },
      {
        key: "next_focus",
        label: "Next sprint focus",
        placeholder: "Top 1–3 priorities for the next cycle.",
        kind: "block",
        rows: 2,
      },
    ],
  },
  {
    id: "quick-pulse",
    name: "Quick pulse",
    blurb: "Short update — I'm good / busy / stuck. Two minutes, done.",
    defaultTitle: "Pulse",
    fields: [
      {
        key: "status",
        label: "Overall status",
        hint: "One word: green (good), yellow (caution), red (needs help).",
        placeholder: "green",
        kind: "line",
      },
      {
        key: "on",
        label: "What I'm on",
        placeholder: "1–2 lines.",
        kind: "block",
        rows: 2,
      },
      {
        key: "ask",
        label: "Anything from you?",
        placeholder: "What would unblock you, or what you want me to know.",
        kind: "block",
        rows: 2,
        optional: true,
      },
    ],
  },
];

// ── Project updates ─────────────────────────────────────────────

const PROJECT_TEMPLATES: ReportTemplate[] = [
  {
    id: "progress-check",
    name: "Progress check",
    blurb: "Where the project stands — timeline, budget, risks.",
    defaultTitle: "Progress check",
    fields: [
      {
        key: "where",
        label: "Where we are",
        placeholder: "Current state in 2–3 sentences.",
        kind: "block",
        rows: 3,
      },
      {
        key: "timeline",
        label: "Timeline",
        hint: "On track, behind, or ahead — and by how much.",
        placeholder: "On track / 1 week behind / 3 days ahead",
        kind: "line",
      },
      {
        key: "budget",
        label: "Budget",
        hint: "Optional — skip if not relevant to this project.",
        placeholder: "On track / 12% over / under by $4k",
        kind: "line",
        optional: true,
      },
      {
        key: "risks",
        label: "Risks / blockers",
        placeholder: "What could derail this, or what's actively in the way.",
        kind: "block",
        rows: 3,
      },
      {
        key: "help",
        label: "Help I need from you",
        placeholder: "Specific ask for leadership. Leave blank if none.",
        kind: "block",
        rows: 2,
        optional: true,
      },
    ],
  },
  {
    id: "milestone-hit",
    name: "Milestone hit",
    blurb: "We shipped something worth celebrating.",
    defaultTitle: "Milestone",
    fields: [
      {
        key: "shipped",
        label: "What shipped",
        placeholder: "The deliverable, concretely.",
        kind: "block",
        rows: 3,
      },
      {
        key: "why",
        label: "Why it matters",
        hint: "Business / customer impact, not just the technical change.",
        placeholder: "What this unlocks or fixes for the company.",
        kind: "block",
        rows: 2,
      },
      {
        key: "next",
        label: "What's next",
        placeholder: "Next milestone on the roadmap.",
        kind: "block",
        rows: 2,
      },
      {
        key: "thanks",
        label: "Acknowledgements",
        hint: "Who went above and beyond — worth leadership knowing.",
        placeholder: "Teammates / contractors / external partners.",
        kind: "block",
        rows: 2,
        optional: true,
      },
    ],
  },
  {
    id: "scope-change",
    name: "Scope change request",
    blurb: "Proposing a change to scope, timeline, or budget.",
    defaultTitle: "Scope change",
    fields: [
      {
        key: "proposal",
        label: "What I'm proposing to change",
        placeholder: "Concrete change — add X, remove Y, push launch to Z.",
        kind: "block",
        rows: 3,
      },
      {
        key: "why",
        label: "Why",
        hint: "Root cause — tech reality, new info, shifted priorities.",
        placeholder: "The underlying reason this needs to change.",
        kind: "block",
        rows: 3,
      },
      {
        key: "impact",
        label: "Impact",
        hint: "Effect on scope / timeline / budget / team.",
        placeholder: "Specific, quantified where possible.",
        kind: "block",
        rows: 3,
      },
      {
        key: "decision",
        label: "Decision needed from you",
        placeholder: "Approve / discuss / reject. What do you want me to do?",
        kind: "line",
      },
    ],
  },
];

// ── Incident reports ────────────────────────────────────────────

const INCIDENT_TEMPLATES: ReportTemplate[] = [
  {
    id: "outage",
    name: "Outage / live incident",
    blurb: "Something is broken right now. Includes current status.",
    defaultTitle: "Incident",
    fields: [
      {
        key: "symptom",
        label: "What's broken",
        placeholder: "Observable symptom, not root cause yet.",
        kind: "block",
        rows: 2,
      },
      {
        key: "started",
        label: "When it started",
        placeholder: "Best estimate of the start time (+ timezone).",
        kind: "line",
      },
      {
        key: "scope",
        label: "Who's affected",
        hint: "Customers / internal / both — and the rough scope.",
        placeholder: "e.g. ~40% of customers on Plan A; internal dashboards offline.",
        kind: "block",
        rows: 2,
      },
      {
        key: "current",
        label: "Current status",
        hint: "Short: investigating / mitigating / fixed / monitoring.",
        placeholder: "Investigating",
        kind: "line",
      },
      {
        key: "tried",
        label: "What I've tried",
        placeholder: "Steps already taken — so no one duplicates effort.",
        kind: "block",
        rows: 3,
      },
      {
        key: "help",
        label: "Help I need",
        placeholder: "Who / what would help fix this faster.",
        kind: "block",
        rows: 2,
      },
    ],
  },
  {
    id: "post-mortem",
    name: "Post-mortem",
    blurb: "Incident is resolved — what happened, why, what we're changing.",
    defaultTitle: "Post-mortem",
    fields: [
      {
        key: "timeline",
        label: "Timeline",
        hint: "Key moments with times — detection, mitigation, resolution.",
        placeholder: "2:14 PM: alert fired. 2:17 PM: paged on-call. 2:31 PM: mitigated. 2:45 PM: resolved.",
        kind: "block",
        rows: 4,
      },
      {
        key: "root_cause",
        label: "Root cause",
        placeholder: "Actual underlying cause — be honest, avoid blame.",
        kind: "block",
        rows: 3,
      },
      {
        key: "impact",
        label: "Impact",
        hint: "Customers / revenue / internal disruption.",
        placeholder: "Quantified if possible.",
        kind: "block",
        rows: 2,
      },
      {
        key: "fix",
        label: "What fixed it",
        placeholder: "Short- and medium-term actions taken.",
        kind: "block",
        rows: 2,
      },
      {
        key: "prevention",
        label: "Changes to prevent recurrence",
        hint: "Monitoring, process, testing, architecture — concrete next steps.",
        placeholder: "Action items + owners if you have them.",
        kind: "block",
        rows: 4,
      },
    ],
  },
  {
    id: "near-miss",
    name: "Near-miss",
    blurb: "Could have been bad, wasn't. Worth flagging so we don't rely on luck twice.",
    defaultTitle: "Near-miss",
    fields: [
      {
        key: "almost",
        label: "What almost happened",
        placeholder: "The incident that was averted.",
        kind: "block",
        rows: 3,
      },
      {
        key: "caught",
        label: "How it was caught",
        placeholder: "What stopped it from becoming a real incident.",
        kind: "block",
        rows: 2,
      },
      {
        key: "change",
        label: "What should change",
        placeholder: "So we don't rely on the same luck next time.",
        kind: "block",
        rows: 3,
      },
    ],
  },
];

// ── Feedback ────────────────────────────────────────────────────

const FEEDBACK_TEMPLATES: ReportTemplate[] = [
  {
    id: "product-feedback",
    name: "Product feedback",
    blurb: "Something about our product or tools — working, not working, what to change.",
    defaultTitle: "Product feedback",
    fields: [
      {
        key: "using",
        label: "What I'm using",
        placeholder: "The product, tool, or feature — be specific.",
        kind: "line",
      },
      {
        key: "working",
        label: "What's working well",
        placeholder: "Keep this honest, not just praise.",
        kind: "block",
        rows: 3,
      },
      {
        key: "not",
        label: "What's not working",
        placeholder: "Friction, bugs, confusing behavior — specifics.",
        kind: "block",
        rows: 3,
      },
      {
        key: "change",
        label: "What I'd change",
        placeholder: "Concrete suggestions, not vague wishes.",
        kind: "block",
        rows: 3,
      },
    ],
  },
  {
    id: "process-feedback",
    name: "Process / team feedback",
    blurb: "How we work together — communication, meetings, decision-making.",
    defaultTitle: "Process feedback",
    fields: [
      {
        key: "context",
        label: "Context",
        hint: "What situation is this feedback about?",
        placeholder: "Specific meeting, recurring pattern, team dynamic.",
        kind: "block",
        rows: 2,
      },
      {
        key: "observed",
        label: "What I observed",
        placeholder: "Concrete behaviors, not labels.",
        kind: "block",
        rows: 3,
      },
      {
        key: "why",
        label: "Why it matters",
        placeholder: "Impact on work, morale, results.",
        kind: "block",
        rows: 2,
      },
      {
        key: "suggestion",
        label: "Suggestion",
        placeholder: "Actionable — what could be tried differently.",
        kind: "block",
        rows: 3,
      },
    ],
  },
  {
    id: "client-feedback",
    name: "Client / customer feedback",
    blurb: "Something a client said — worth leadership knowing.",
    defaultTitle: "Client feedback",
    fields: [
      {
        key: "who",
        label: "Who",
        hint: "Client, company, point of contact if known.",
        placeholder: "Jane Smith — VP Ops, Acme Corp",
        kind: "line",
      },
      {
        key: "said",
        label: "What they said",
        hint: "Direct quote when possible.",
        placeholder: "\"We love how fast it is, but we wish we could X.\"",
        kind: "block",
        rows: 3,
      },
      {
        key: "context",
        label: "Context",
        hint: "When and how — call, email, in-person.",
        placeholder: "Said during yesterday's QBR.",
        kind: "block",
        rows: 2,
      },
      {
        key: "proposal",
        label: "What I think we should do",
        placeholder: "Your read — should we act, note, or wait.",
        kind: "block",
        rows: 2,
      },
    ],
  },
];

// ── Other / freeform ────────────────────────────────────────────

const OTHER_TEMPLATES: ReportTemplate[] = [
  {
    id: "freeform",
    name: "Blank",
    blurb: "Just write what you've got.",
    defaultTitle: "",
    fields: [],
  },
  {
    id: "quick-note",
    name: "Quick note",
    blurb: "A heads-up for leadership — context + what you want them to do (if anything).",
    defaultTitle: "",
    fields: [
      {
        key: "context",
        label: "Context",
        placeholder: "The situation in 2–3 sentences.",
        kind: "block",
        rows: 2,
      },
      {
        key: "know",
        label: "What I want you to know",
        placeholder: "The core point you want surfaced.",
        kind: "block",
        rows: 3,
      },
      {
        key: "do",
        label: "What you can do",
        hint: "Optional — skip if you just wanted to flag it.",
        placeholder: "Specific ask, or leave blank.",
        kind: "block",
        rows: 2,
        optional: true,
      },
    ],
  },
];

// ── Export ──────────────────────────────────────────────────────

export const REPORT_TEMPLATES: Record<ReportTypeKey, ReportTemplate[]> = {
  status:         STATUS_TEMPLATES,
  project_update: PROJECT_TEMPLATES,
  incident:       INCIDENT_TEMPLATES,
  feedback:       FEEDBACK_TEMPLATES,
  other:          OTHER_TEMPLATES,
};

// ── Serialization ──────────────────────────────────────────────

/**
 * Serialize a template + field values into a single readable body
 * string. Empty fields are skipped. The result goes into the
 * reports.body column and renders in the inbox as clean
 * "Label:\n<value>" sections (no markdown needed).
 */
export function serializeTemplate(
  template: ReportTemplate,
  values: Record<string, string>,
): string {
  const lines: string[] = [];
  for (const field of template.fields) {
    const value = (values[field.key] ?? "").trim();
    if (!value) continue;
    lines.push(`${field.label}:`);
    lines.push(value);
    lines.push("");
  }
  return lines.join("\n").trim();
}
