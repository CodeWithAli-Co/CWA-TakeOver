/**
 * agents.ts — Static registry of every Axon in the swarm.
 *
 * Each agent has its own visual identity (color, glyph, animation
 * profile), capability list, and signal sources. The page reads from
 * this registry; nothing else needs to know an agent exists until
 * it's added here.
 *
 * Long-term arc: today these agents live inside Takeover. Q3 2026
 * the OS Axon will hook into Windows/macOS at the system level so
 * the swarm can act across the operating system, not just the app.
 * Each agent's `osHooks` field is the placeholder for that future
 * binding — when an OS hook is wired, set its `status` to "live".
 */

import {
  DollarSign,
  HeartPulse,
  Code2,
  Calendar,
  MessagesSquare,
  Sprout,
  FolderTree,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type AgentId =
  | "finance"
  | "customer"
  | "engineering"
  | "calendar"
  | "communications"
  | "recruitment"
  | "filesystem"
  | "os";

export type AgentStatus =
  /** No signals in the last 5min; orb dim. */
  | "dormant"
  /** Receiving signals, not currently reasoning. Default healthy state. */
  | "watching"
  /** Running inference / making a decision. Pulses faster. */
  | "thinking"
  /** Just emitted an action. Bright flash. */
  | "acting"
  /** Surfaced a tier-1 alert. Color-shifted to red. */
  | "alerting"
  /** Connector down or last reasoning step errored. */
  | "error"
  /** User has muted this agent's interrupts (still watching). */
  | "muted";

export interface AxonCapability {
  id: string;
  label: string;
  /** What the capability actually does in plain language. */
  description: string;
}

export interface AxonSignalSource {
  id: string;
  label: string;
  /** Whether this connector is hooked up to a real backend yet. */
  status: "live" | "stub" | "planned";
}

export interface AxonOsHook {
  id: string;
  label: string;
  status: "live" | "stub" | "planned";
}

export interface AxonAgent {
  id: AgentId;
  name: string;
  /** Short subtitle shown beneath the name. */
  role: string;
  /** Single-sentence description shown in the detail panel. */
  description: string;
  /** Tailwind colour family — used to build the orb tint, the
   *  selection ring, the event-bus chip, etc. We keep a small map
   *  here rather than reaching for arbitrary hex so every accent
   *  comes from the same palette tokens. */
  color: AgentColor;
  Icon: LucideIcon;
  /** Animation profile — different cadence per agent so the swarm
   *  feels like a group of individuals rather than 8 copies. */
  pulseSeconds: number;
  /** Default status when there are no signals. Some agents
   *  (like OS) start dormant; most start "watching". */
  defaultStatus: AgentStatus;
  capabilities: AxonCapability[];
  signalSources: AxonSignalSource[];
  osHooks: AxonOsHook[];
}

export interface AgentColor {
  /** Tailwind class fragment (e.g. "emerald") so we can build
   *  `bg-emerald-500/20`, `text-emerald-300`, etc. */
  family: string;
  /** Raw RGB triplet used for SVG/box-shadow glow. Keep in sync
   *  with the Tailwind family above. */
  rgb: string;
}

const COLOR = {
  emerald: { family: "emerald", rgb: "16, 185, 129" },
  sky:     { family: "sky",     rgb: "14, 165, 233" },
  violet:  { family: "violet",  rgb: "139, 92, 246" },
  amber:   { family: "amber",   rgb: "245, 158, 11" },
  pink:    { family: "pink",    rgb: "236, 72, 153" },
  cyan:    { family: "cyan",    rgb: "6, 182, 212" },
  slate:   { family: "slate",   rgb: "100, 116, 139" },
  red:     { family: "red",     rgb: "220, 38, 38" },
} as const satisfies Record<string, AgentColor>;

export const AGENTS: AxonAgent[] = [
  {
    id: "finance",
    name: "Finance",
    role: "Money flow · invoices · runway",
    description:
      "Watches every dollar moving through the company. Reconciles bank "
      + "feeds against Stripe events, flags late invoices, projects "
      + "runway from real burn rate, and surfaces anomalies in cashflow.",
    color: COLOR.emerald,
    Icon: DollarSign,
    pulseSeconds: 4.2,
    defaultStatus: "watching",
    capabilities: [
      { id: "invoice.late",       label: "Late-invoice detection",       description: "Flags invoices past their due date by ≥ 3 business days." },
      { id: "runway.project",     label: "Runway projection",            description: "Extrapolates burn from the trailing 30 days and surfaces inflection points." },
      { id: "tx.classify",        label: "Transaction classification",   description: "Auto-categorizes Stripe + bank transactions into chart of accounts." },
      { id: "anomaly.spend",      label: "Spend anomaly alerts",         description: "Tier-1 alert when a category exceeds 3σ over its trailing mean." },
      { id: "tax.flag",           label: "Tax obligation flagging",      description: "Surfaces upcoming sales-tax / 1099 / estimated-tax deadlines." },
      { id: "captable.delta",     label: "Cap-table delta watch",        description: "Notifies when SAFEs convert or option grants vest near deadlines." },
    ],
    signalSources: [
      { id: "stripe",   label: "Stripe webhook",       status: "live" },
      { id: "plaid",    label: "Plaid bank feed",      status: "live" },
      { id: "qbo",      label: "QuickBooks Online",    status: "stub" },
      { id: "ramp",     label: "Ramp card events",     status: "planned" },
    ],
    osHooks: [
      { id: "wallet.export", label: "Native wallet export to Keychain", status: "planned" },
      { id: "1pwd.sync",     label: "1Password Connect bridge",         status: "planned" },
    ],
  },

  {
    id: "customer",
    name: "Customer",
    role: "Health · churn · expansion",
    description:
      "Reads the temperature of every customer relationship. Cross-"
      + "references support tickets, Slack-Connect chatter, contract "
      + "renewal dates, and product usage to flag churn risk and "
      + "expansion windows.",
    color: COLOR.sky,
    Icon: HeartPulse,
    pulseSeconds: 3.7,
    defaultStatus: "watching",
    capabilities: [
      { id: "ticket.intake",      label: "Support ticket triage",        description: "Routes incoming tickets by topic, severity, and customer tier." },
      { id: "sentiment.scan",     label: "Sentiment scan",               description: "NLP pass over Slack/email; flags negative-leaning threads." },
      { id: "churn.signal",       label: "Churn signal aggregation",     description: "Combines usage drop + ticket count + sentiment into a single risk score." },
      { id: "expansion.flag",     label: "Expansion opportunity flag",   description: "Identifies customers exceeding plan limits 3+ months running." },
      { id: "renewal.calendar",   label: "Renewal calendar",             description: "Surfaces contract renewals 60/30/14 days out." },
      { id: "nps.synthesize",     label: "NPS synthesis",                description: "Aggregates NPS verbatims into themes the team can act on." },
    ],
    signalSources: [
      { id: "intercom",      label: "Intercom",            status: "stub" },
      { id: "slack-connect", label: "Slack Connect",       status: "live" },
      { id: "linear",        label: "Linear (support)",    status: "stub" },
      { id: "hubspot",       label: "HubSpot CRM",         status: "planned" },
    ],
    osHooks: [
      { id: "contact.card", label: "macOS Contacts integration", status: "planned" },
    ],
  },

  {
    id: "engineering",
    name: "Engineering",
    role: "Code · CI · uptime",
    description:
      "Owns the engineering plane. Watches PRs waiting on review, CI "
      + "failures, uptime alerts, and deploy windows. Coordinates with "
      + "Finance Axon when infra cost spikes correlate with deploys.",
    color: COLOR.violet,
    Icon: Code2,
    pulseSeconds: 2.8,
    defaultStatus: "watching",
    capabilities: [
      { id: "pr.wait",            label: "PR wait-time alerts",          description: "Tier-2 nudge when a PR has been awaiting review > 4 hours." },
      { id: "ci.failure",         label: "CI failure correlation",       description: "Groups flaky test failures by suite to surface true regressions." },
      { id: "uptime.alert",       label: "Uptime alerts",                description: "Forwarded Pingdom / BetterStack events with deploy correlation." },
      { id: "deploy.window",      label: "Deploy window enforcement",    description: "Soft-blocks deploys outside team-defined safe windows." },
      { id: "cost.deploy",        label: "Cost-deploy correlation",      description: "Cross-checks infra spend against recent deploys; pings Finance Axon if delta > 15%." },
      { id: "secret.scan",        label: "Secret-scan integration",      description: "Surfaces leaked credentials in commits via GH advanced security." },
    ],
    signalSources: [
      { id: "github",       label: "GitHub webhooks",       status: "live" },
      { id: "ci",           label: "GitHub Actions",        status: "live" },
      { id: "linear",       label: "Linear (eng)",          status: "stub" },
      { id: "vercel",       label: "Vercel deploys",        status: "stub" },
      { id: "sentry",       label: "Sentry",                status: "planned" },
    ],
    osHooks: [
      { id: "shell.deploy", label: "Native shell run for deploy hooks", status: "planned" },
      { id: "ide.bridge",   label: "VS Code / Cursor bridge",           status: "planned" },
    ],
  },

  {
    id: "calendar",
    name: "Calendar",
    role: "Time · meetings · conflicts",
    description:
      "Owns the clock. Watches every calendar across the team, detects "
      + "scheduling conflicts, drafts agendas, and prepares one-line "
      + "context blurbs for each upcoming meeting.",
    color: COLOR.amber,
    Icon: Calendar,
    pulseSeconds: 5.0,
    defaultStatus: "watching",
    capabilities: [
      { id: "conflict.detect",    label: "Conflict detection",           description: "Cross-team booking overlaps surfaced before the calendar invite goes out." },
      { id: "prep.brief",         label: "Pre-meeting brief",            description: "30 min before each meeting: who, why, last touchpoint, suggested talking points." },
      { id: "recap.draft",        label: "Recap draft",                  description: "After every meeting Axon hosts: action items + owners + due dates." },
      { id: "buffer.protect",     label: "Buffer-time protection",       description: "Auto-declines back-to-back invites that violate user-set buffer rules." },
      { id: "tz.normalize",       label: "Time-zone normalisation",      description: "Surfaces every event in the recipient's TZ regardless of organiser." },
      { id: "agenda.sync",        label: "Agenda sync to Notion",        description: "Each recurring meeting auto-creates its agenda doc and shares the link." },
    ],
    signalSources: [
      { id: "gcal",         label: "Google Calendar",       status: "live" },
      { id: "outlook",      label: "Outlook 365",           status: "stub" },
      { id: "zoom",         label: "Zoom meeting state",    status: "stub" },
    ],
    osHooks: [
      { id: "macos.cal",    label: "macOS Calendar app sync",   status: "planned" },
      { id: "win.toast",    label: "Windows toast notifications", status: "planned" },
    ],
  },

  {
    id: "communications",
    name: "Comms",
    role: "Email · DMs · mentions",
    description:
      "Reads every channel where words show up — email, DMs, mentions, "
      + "broadcasts. Drafts replies for review, surfaces threads the "
      + "team is forgetting, and bridges decisions across tools.",
    color: COLOR.pink,
    Icon: MessagesSquare,
    pulseSeconds: 3.2,
    defaultStatus: "watching",
    capabilities: [
      { id: "draft.reply",        label: "Draft reply suggestions",      description: "Drafts a reply in your voice for any thread mentioning you; you review and send." },
      { id: "open.loop",          label: "Open-loop tracking",           description: "Detects threads where you said 'I'll get back to you' but didn't." },
      { id: "tone.read",          label: "Tone read on drafts",          description: "Flags drafts that read harsher than intended (especially before-coffee sends)." },
      { id: "mention.dedupe",     label: "Mention de-duplication",       description: "Bundles the four Slack pings about the same thing into one notification." },
      { id: "newsletter.summary", label: "Newsletter summary",           description: "Compresses 12 industry newsletters into a 90-second daily brief." },
    ],
    signalSources: [
      { id: "gmail",        label: "Gmail",                 status: "stub" },
      { id: "outlook-mail", label: "Outlook mail",          status: "planned" },
      { id: "slack",        label: "Slack",                 status: "live" },
      { id: "internal",     label: "Internal chat (this app)", status: "live" },
    ],
    osHooks: [
      { id: "mail.app",     label: "macOS Mail.app integration", status: "planned" },
    ],
  },

  {
    id: "recruitment",
    name: "Recruitment",
    role: "Pipeline · candidates · hires",
    description:
      "Owns the hiring funnel. Tracks every candidate across the "
      + "pipeline, nudges interviewers waiting on feedback, drafts "
      + "candidate updates, and surfaces candidates going cold.",
    color: COLOR.cyan,
    Icon: Sprout,
    pulseSeconds: 6.0,
    defaultStatus: "dormant",
    capabilities: [
      { id: "stage.advance",      label: "Stage-advance suggestions",    description: "Recommends next-stage moves for candidates whose interviewers all rated 'advance'." },
      { id: "feedback.nudge",     label: "Interviewer feedback nudge",   description: "Tier-2 nudge to interviewers who haven't submitted feedback within 24h." },
      { id: "cold.flag",          label: "Cold-candidate flag",          description: "Surfaces candidates idle in pipeline > 7 days and drafts a re-engagement note." },
      { id: "offer.draft",        label: "Offer draft",                  description: "Drafts offer letters from the role template + comp band." },
    ],
    signalSources: [
      { id: "ashby",        label: "Ashby ATS",             status: "stub" },
      { id: "lever",        label: "Lever",                 status: "planned" },
      { id: "calendar",     label: "Calendar (interviews)", status: "live" },
    ],
    osHooks: [],
  },

  {
    id: "filesystem",
    name: "Filesystem",
    role: "Docs · contracts · assets",
    description:
      "Watches every document the team touches. Detects when a doc "
      + "is stale, when a contract has an upcoming expiry, when an "
      + "asset is referenced but not version-controlled. The pivot-"
      + "point for the OS Axon to read & write actual files.",
    color: COLOR.slate,
    Icon: FolderTree,
    pulseSeconds: 4.6,
    defaultStatus: "watching",
    capabilities: [
      { id: "doc.stale",          label: "Stale-doc detection",          description: "Surfaces docs not edited in 90+ days that are still being referenced." },
      { id: "contract.expiry",    label: "Contract expiry watch",        description: "30/14/7 day windows on every contract with a renewal clause." },
      { id: "asset.orphan",       label: "Orphan asset detection",       description: "Files no doc references in the last 6 months — candidate for archive." },
      { id: "dup.scan",           label: "Duplicate scan",               description: "Identifies near-duplicate docs (Levenshtein < threshold) and proposes a merge." },
    ],
    signalSources: [
      { id: "gdrive",       label: "Google Drive",          status: "stub" },
      { id: "notion",       label: "Notion",                status: "live" },
      { id: "local-fs",     label: "Local filesystem watch", status: "stub" },
      { id: "supabase-stor",label: "Supabase Storage",      status: "live" },
    ],
    osHooks: [
      { id: "fs.watcher",   label: "Native filesystem watcher",      status: "stub" },
      { id: "spotlight",    label: "macOS Spotlight metadata",       status: "planned" },
      { id: "indexer",      label: "Windows Search index",           status: "planned" },
    ],
  },

  {
    id: "os",
    name: "OS",
    role: "System-wide control · the override",
    description:
      "The future. Q3 2026 Axon hooks into Windows + macOS at the "
      + "system level — global hotkey activation, system tray, "
      + "shell execution, clipboard read/write, app focus switching. "
      + "The OS Axon is how Takeover becomes the operator's runtime "
      + "instead of a window on their desktop.",
    color: COLOR.red,
    Icon: ShieldCheck,
    pulseSeconds: 7.5,
    defaultStatus: "dormant",
    capabilities: [
      { id: "global.hotkey",      label: "Global voice hotkey",          description: "Press-and-hold from any app to talk to Axon." },
      { id: "shell.run",          label: "Sandboxed shell execution",    description: "Run commands with user-confirmation, scoped to a working dir." },
      { id: "clipboard.bridge",   label: "Clipboard bridge",             description: "Read/write the OS clipboard so Axon can paste into any app." },
      { id: "app.focus",          label: "App focus switching",          description: "Bring any window to front by name; tile windows by command." },
      { id: "tray.icon",          label: "System tray indicator",        description: "Tray icon mirrors swarm status: green/amber/red." },
      { id: "screenshot",         label: "Selective screenshot",         description: "Capture-rectangle → Axon → OCR → context for next reply." },
    ],
    signalSources: [
      { id: "tauri-bridge", label: "Tauri OS bridge",        status: "stub" },
      { id: "tray",         label: "Tray icon events",       status: "planned" },
    ],
    osHooks: [
      { id: "macos.systemwide",  label: "macOS system-wide accessibility", status: "planned" },
      { id: "win.systemwide",    label: "Windows global hotkeys",          status: "planned" },
      { id: "linux.systemwide",  label: "Linux DBus integration",          status: "planned" },
    ],
  },
];

export const AGENTS_BY_ID: Record<AgentId, AxonAgent> = AGENTS.reduce(
  (acc, a) => {
    acc[a.id] = a;
    return acc;
  },
  {} as Record<AgentId, AxonAgent>,
);
