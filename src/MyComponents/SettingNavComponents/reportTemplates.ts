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
    blurb: "Periodic recap of work completed, planned, and blocked.",
    defaultTitle: "Weekly check-in",
    fields: [
      {
        key: "done",
        label: "Completed this period",
        kind: "block",
        rows: 4,
      },
      {
        key: "next",
        label: "Planned for next period",
        kind: "block",
        rows: 3,
      },
      {
        key: "blockers",
        label: "Blockers",
        kind: "block",
        rows: 3,
        optional: true,
      },
      {
        key: "heads_up",
        label: "Notes for leadership",
        kind: "block",
        rows: 2,
        optional: true,
      },
    ],
  },
  {
    id: "end-of-sprint",
    name: "Sprint wrap",
    blurb: "End-of-sprint summary of delivered, carried, and learnings.",
    defaultTitle: "Sprint wrap",
    fields: [
      { key: "shipped", label: "Delivered", kind: "block", rows: 3 },
      { key: "carried_over", label: "Carried over", kind: "block", rows: 3 },
      { key: "learned", label: "Learnings", kind: "block", rows: 2 },
      { key: "next_focus", label: "Next priorities", kind: "block", rows: 2 },
    ],
  },
  {
    id: "quick-pulse",
    name: "Pulse",
    blurb: "Brief status indicator with minimal commentary.",
    defaultTitle: "Pulse",
    fields: [
      {
        key: "status",
        label: "Status indicator",
        hint: "green / yellow / red",
        kind: "line",
      },
      { key: "on", label: "Current focus", kind: "block", rows: 2 },
      { key: "ask", label: "Requests", kind: "block", rows: 2, optional: true },
    ],
  },
];

// ── Project updates ─────────────────────────────────────────────

const PROJECT_TEMPLATES: ReportTemplate[] = [
  {
    id: "progress-check",
    name: "Progress check",
    blurb: "Status against plan: timeline, budget, risks.",
    defaultTitle: "Progress check",
    fields: [
      { key: "where", label: "Current state", kind: "block", rows: 3 },
      { key: "timeline", label: "Timeline", kind: "line" },
      { key: "budget", label: "Budget", kind: "line", optional: true },
      { key: "risks", label: "Risks and blockers", kind: "block", rows: 3 },
      { key: "help", label: "Requests", kind: "block", rows: 2, optional: true },
    ],
  },
  {
    id: "milestone-hit",
    name: "Milestone reached",
    blurb: "Notable delivery or checkpoint.",
    defaultTitle: "Milestone",
    fields: [
      { key: "shipped", label: "Delivered", kind: "block", rows: 3 },
      { key: "why", label: "Impact", kind: "block", rows: 2 },
      { key: "next", label: "Next milestone", kind: "block", rows: 2 },
      { key: "thanks", label: "Acknowledgements", kind: "block", rows: 2, optional: true },
    ],
  },
  {
    id: "scope-change",
    name: "Scope change",
    blurb: "Request to modify scope, timeline, or budget.",
    defaultTitle: "Scope change",
    fields: [
      { key: "proposal", label: "Proposed change", kind: "block", rows: 3 },
      { key: "why", label: "Rationale", kind: "block", rows: 3 },
      { key: "impact", label: "Impact", kind: "block", rows: 3 },
      { key: "decision", label: "Decision requested", kind: "line" },
    ],
  },
];

// ── Incident reports ────────────────────────────────────────────

const INCIDENT_TEMPLATES: ReportTemplate[] = [
  {
    id: "outage",
    name: "Live incident",
    blurb: "Ongoing incident with current status and next steps.",
    defaultTitle: "Incident",
    fields: [
      { key: "symptom", label: "Observed symptom", kind: "block", rows: 2 },
      { key: "started", label: "Time started", kind: "line" },
      { key: "scope", label: "Affected scope", kind: "block", rows: 2 },
      { key: "current", label: "Current status", kind: "line" },
      { key: "tried", label: "Actions taken", kind: "block", rows: 3 },
      { key: "help", label: "Support needed", kind: "block", rows: 2 },
    ],
  },
  {
    id: "post-mortem",
    name: "Post-mortem",
    blurb: "Retrospective analysis after incident resolution.",
    defaultTitle: "Post-mortem",
    fields: [
      { key: "timeline", label: "Timeline", kind: "block", rows: 4 },
      { key: "root_cause", label: "Root cause", kind: "block", rows: 3 },
      { key: "impact", label: "Impact", kind: "block", rows: 2 },
      { key: "fix", label: "Resolution", kind: "block", rows: 2 },
      { key: "prevention", label: "Preventive actions", kind: "block", rows: 4 },
    ],
  },
  {
    id: "near-miss",
    name: "Near-miss",
    blurb: "Potential incident that did not materialize.",
    defaultTitle: "Near-miss",
    fields: [
      { key: "almost", label: "Scenario", kind: "block", rows: 3 },
      { key: "caught", label: "Mitigation path", kind: "block", rows: 2 },
      { key: "change", label: "Recommended changes", kind: "block", rows: 3 },
    ],
  },
];

// ── Feedback ────────────────────────────────────────────────────

const FEEDBACK_TEMPLATES: ReportTemplate[] = [
  {
    id: "product-feedback",
    name: "Product",
    blurb: "Feedback on internal or customer-facing products.",
    defaultTitle: "Product feedback",
    fields: [
      { key: "using", label: "Subject", kind: "line" },
      { key: "working", label: "Working well", kind: "block", rows: 3 },
      { key: "not", label: "Issues", kind: "block", rows: 3 },
      { key: "change", label: "Recommendations", kind: "block", rows: 3 },
    ],
  },
  {
    id: "process-feedback",
    name: "Process",
    blurb: "Observations about team or operational processes.",
    defaultTitle: "Process feedback",
    fields: [
      { key: "context", label: "Context", kind: "block", rows: 2 },
      { key: "observed", label: "Observations", kind: "block", rows: 3 },
      { key: "why", label: "Significance", kind: "block", rows: 2 },
      { key: "suggestion", label: "Recommendation", kind: "block", rows: 3 },
    ],
  },
  {
    id: "client-feedback",
    name: "Client",
    blurb: "Relayed feedback from a client or customer.",
    defaultTitle: "Client feedback",
    fields: [
      { key: "who", label: "Source", kind: "line" },
      { key: "said", label: "Verbatim or summary", kind: "block", rows: 3 },
      { key: "context", label: "Context", kind: "block", rows: 2 },
      { key: "proposal", label: "Recommendation", kind: "block", rows: 2 },
    ],
  },
];

// ── Other / freeform ────────────────────────────────────────────

const OTHER_TEMPLATES: ReportTemplate[] = [
  {
    id: "freeform",
    name: "Freeform",
    blurb: "Single open text field.",
    defaultTitle: "",
    fields: [],
  },
  {
    id: "quick-note",
    name: "Note",
    blurb: "Context, core message, and optional action.",
    defaultTitle: "",
    fields: [
      { key: "context", label: "Context", kind: "block", rows: 2 },
      { key: "know", label: "Key message", kind: "block", rows: 3 },
      { key: "do", label: "Action requested", kind: "block", rows: 2, optional: true },
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

// ── Role-recommended templates ─────────────────────────────────
// Maps a user role → the templates we surface FIRST on the
// writer page's "Recommended for you" rail. The full library is
// still browsable from the picker; this just removes the
// "what do I even pick?" friction for someone opening the page
// for the first time.

export interface RoleRecommendation {
  /** Type key + template id, in display order. */
  type: ReportTypeKey;
  templateId: string;
  /** One-line "why this for you" hint. */
  reason: string;
  /** Suggested cadence label, surfaced as a subtitle. */
  cadence: string;
}

export const ROLE_RECOMMENDATIONS: Record<string, RoleRecommendation[]> = {
  CEO: [
    { type: "status",         templateId: "weekly-checkin", reason: "Frame the week for the team — what shipped, what's next.", cadence: "Weekly" },
    { type: "feedback",       templateId: "process-feedback", reason: "Quarterly retro on how the company operates.",           cadence: "Quarterly" },
    { type: "project_update", templateId: "milestone-hit",  reason: "Mark a major win publicly so the team feels it.",          cadence: "Per milestone" },
  ],
  COO: [
    { type: "status",         templateId: "weekly-checkin", reason: "Ops cadence — what's running smoothly, what's blocked.",   cadence: "Weekly" },
    { type: "project_update", templateId: "progress-check", reason: "Per-initiative pulse on timeline + budget + risks.",       cadence: "Biweekly" },
    { type: "incident",       templateId: "post-mortem",    reason: "Anything that broke this period and what's preventing recurrence.", cadence: "As needed" },
  ],
  CFO: [
    { type: "status",         templateId: "quick-pulse",    reason: "Quick green/yellow/red on financial health.",              cadence: "Weekly" },
    { type: "project_update", templateId: "progress-check", reason: "Budget-bearing initiatives — actuals vs. plan.",           cadence: "Monthly" },
  ],
  CTO: [
    { type: "status",         templateId: "end-of-sprint",  reason: "Sprint outcomes for the leadership read-out.",             cadence: "Per sprint" },
    { type: "incident",       templateId: "post-mortem",    reason: "Engineering post-mortems for production incidents.",       cadence: "As needed" },
    { type: "project_update", templateId: "milestone-hit",  reason: "Ship announcements — features, releases, infra moves.",   cadence: "Per release" },
  ],
  Engineer: [
    { type: "status",         templateId: "weekly-checkin", reason: "What you worked on, what's next, what's blocking you.",    cadence: "Weekly" },
    { type: "project_update", templateId: "progress-check", reason: "On a multi-week project? Use this for the timeline view.", cadence: "Biweekly" },
    { type: "incident",       templateId: "outage",         reason: "Mid-incident updates — fast structured comms while it's live.", cadence: "As needed" },
  ],
  Designer: [
    { type: "status",         templateId: "weekly-checkin", reason: "Design WIP, what shipped, what's queued.",                 cadence: "Weekly" },
    { type: "feedback",       templateId: "product-feedback", reason: "UX feedback you spotted while shipping.",                cadence: "Ad hoc" },
  ],
  Sales: [
    { type: "status",         templateId: "weekly-checkin", reason: "Pipeline movement — deals advanced, deals stuck.",         cadence: "Weekly" },
    { type: "feedback",       templateId: "client-feedback", reason: "Voice-of-customer from calls this week.",                 cadence: "Weekly" },
  ],
  Marketing: [
    { type: "status",         templateId: "weekly-checkin", reason: "Campaigns shipped, channels learnt, next experiments.",    cadence: "Weekly" },
    { type: "feedback",       templateId: "product-feedback", reason: "What's working in messaging, what's not landing.",       cadence: "Monthly" },
  ],
  Admin: [
    { type: "status",         templateId: "weekly-checkin", reason: "Operational summary for the leadership team.",             cadence: "Weekly" },
    { type: "other",          templateId: "quick-note",     reason: "Quick one-off heads-up without ceremony.",                 cadence: "Ad hoc" },
  ],
};

/** Pick the recommendations to surface for a given role. Falls
 *  back to a sensible default if the role isn't in the map. */
export function recommendationsForRole(role: string | null | undefined): RoleRecommendation[] {
  if (!role) return ROLE_RECOMMENDATIONS.Admin;
  const exact = ROLE_RECOMMENDATIONS[role];
  if (exact) return exact;
  // Loose match — "Senior Engineer" → Engineer
  const lower = role.toLowerCase();
  if (/(eng|developer|dev$|backend|frontend|fullstack)/i.test(lower)) return ROLE_RECOMMENDATIONS.Engineer;
  if (/design/i.test(lower)) return ROLE_RECOMMENDATIONS.Designer;
  if (/sales|ae|sdr|account exec/i.test(lower)) return ROLE_RECOMMENDATIONS.Sales;
  if (/marketing|growth|brand/i.test(lower)) return ROLE_RECOMMENDATIONS.Marketing;
  if (/ceo/i.test(lower)) return ROLE_RECOMMENDATIONS.CEO;
  if (/coo/i.test(lower)) return ROLE_RECOMMENDATIONS.COO;
  if (/cfo/i.test(lower)) return ROLE_RECOMMENDATIONS.CFO;
  if (/cto|vp eng/i.test(lower)) return ROLE_RECOMMENDATIONS.CTO;
  return ROLE_RECOMMENDATIONS.Admin;
}

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

/**
 * Render a template's sections as a single prose-style body
 * scaffold — what the user sees pre-loaded into the big textarea
 * when they pick this template. Each section is "Label:" on a
 * line, followed by a blank line for the user to write into,
 * followed by a blank line separating the next section.
 *
 *   Current state:
 *
 *
 *   Timeline:
 *
 *
 *   ...
 *
 * Optional fields get an "(optional)" marker after the label so
 * the user knows they can delete the whole block without guilt.
 */
export function renderTemplateScaffold(template: ReportTemplate): string {
  if (template.fields.length === 0) return "";
  const parts: string[] = [];
  for (const f of template.fields) {
    parts.push(
      f.optional ? `${f.label} (optional):` : `${f.label}:`,
    );
    parts.push("");
    parts.push("");
  }
  // Drop the trailing blank line so focus lands on the first
  // empty line after the first heading, not way down the doc.
  return parts.join("\n").replace(/\n{3,}$/, "\n").trimEnd() + "\n";
}
