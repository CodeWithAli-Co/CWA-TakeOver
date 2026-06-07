/**
 * connectorMetadata.ts — per-connector "what does this thing actually do"
 * catalog.
 *
 * The ConnectorDetailModal reads from this file to answer three operator
 * questions for any connected integration:
 *
 *   1. What can this connector do? (capabilities — static)
 *   2. What data has it pulled? (dataKinds — describes the shape; live
 *      counts are layered on top via useConnectorSummary).
 *   3. Where in the app does that data show up? (surfaces — clickable
 *      links to the routes that consume this connector).
 *
 * Keeping this in a flat file (vs DB) is deliberate. The product-side
 * mapping ("Stripe feeds /financialDashboard Overview") is engineering
 * intent, not user data. It moves with the codebase.
 *
 * When a new surface is wired to an existing connector (e.g. a new
 * dashboard widget reads Stripe), add an entry here. The modal will
 * pick it up automatically -- no need to change the modal itself.
 */

export interface ConnectorCapability {
  /** Short verb-led description: "Sync repositories", "List channels". */
  label: string;
  /** Optional one-line context for what this enables in the app. */
  context?: string;
}

export interface ConnectorDataKind {
  /** Human label: "Subscriptions", "Pull requests", "Channels". */
  label: string;
  /** Optional descriptor: "live count of active subs". */
  hint?: string;
}

export interface ConnectorSurface {
  /** Sentence-case label of the surface ("Financial dashboard · Overview"). */
  label: string;
  /** Route to navigate to when clicked. Use `null` if the surface
   *  isn't a single route (e.g. "Axon voice actions" — no nav). */
  route: string | null;
  /** Single-line explanation of what gets shown there. */
  description: string;
}

export interface ConnectorMetadata {
  capabilities: ConnectorCapability[];
  dataKinds: ConnectorDataKind[];
  surfaces: ConnectorSurface[];
  /** If true, the connector mostly powers Axon actions rather than
   *  visible UI -- the modal shows that hint near the bottom. */
  axonPowered?: boolean;
}

const META: Record<string, ConnectorMetadata> = {
  // ── Stripe ──────────────────────────────────────────────────
  stripe: {
    capabilities: [
      { label: "Sync customer roster", context: "Pulls every Stripe customer with LTV + MRR ranking." },
      { label: "Track subscription state", context: "Live active / past_due / canceled state per subscription." },
      { label: "Report monthly revenue", context: "MTD revenue, MRR, 12-month timeseries." },
      { label: "Surface dunning queue", context: "Failed payments + at-risk customers in one feed." },
      { label: "Push customers from CRM", context: "Create a Stripe customer from a CRM contact in one click." },
    ],
    dataKinds: [
      { label: "Customers", hint: "with LTV + MRR rank" },
      { label: "Active subscriptions" },
      { label: "Recent payments" },
      { label: "Payouts" },
      { label: "Failed payments" },
      { label: "Revenue timeseries", hint: "12 months" },
    ],
    surfaces: [
      {
        label: "Financial dashboard · Overview",
        route: "/financialDashboard",
        description: "Hero MRR + cash + runway. Sparklines, top customers, latest payout, failed-payment callout.",
      },
      {
        label: "Financial dashboard · Customers",
        route: "/financialDashboard",
        description: "Master-detail customer list with LTV / MRR / status filters + payout history.",
      },
      {
        label: "Financial dashboard · Subscriptions",
        route: "/financialDashboard",
        description: "All subscriptions with filtering by status, plan, and cadence.",
      },
      {
        label: "Financial dashboard · Reports",
        route: "/financialDashboard",
        description: "Failed payments + dunning list + CWA invoices.",
      },
      {
        label: "Sales · CRM",
        route: "/sales",
        description: "Stripe customers cross-referenced with crm_contacts — one source of truth from lead to renewal.",
      },
      {
        label: "Operations · Snapshot",
        route: "/operations",
        description: "Headline MRR + active subscription count in the at-a-glance row.",
      },
    ],
  },

  // ── GitHub ──────────────────────────────────────────────────
  github: {
    capabilities: [
      { label: "Sync repositories", context: "Public + private repos visible to the connected account." },
      { label: "Track pull requests", context: "Open / merged / closed with review state." },
      { label: "Surface issues", context: "By label, milestone, assignee." },
      { label: "Show commit activity", context: "Per-repo timeline of recent commits." },
      { label: "View file contents", context: "Browse repo files + syntax-highlighted diffs in PRs." },
    ],
    dataKinds: [
      { label: "Repositories", hint: "exact count + last commit" },
      { label: "Pull requests" },
      { label: "Issues" },
      { label: "Commits" },
      { label: "Workflow runs" },
    ],
    surfaces: [
      {
        label: "Code · Repo list",
        route: "/code",
        description: "All repos with PR / issue / commit counts.",
      },
      {
        label: "Code · Repo detail",
        route: "/code",
        description: "Per-repo PR conversation, commits, files, and the AI agent run log.",
      },
      {
        label: "Code · Insights",
        route: "/code",
        description: "Commit activity + agent autonomy stats per repo.",
      },
      {
        label: "Operations · Snapshot",
        route: "/operations",
        description: "Repo count + last commit timestamp in the connectors block.",
      },
    ],
  },

  // ── Cal.com ─────────────────────────────────────────────────
  "cal-com": {
    capabilities: [
      { label: "List upcoming meetings", context: "Today's calendar + the next 7 days of booked slots." },
      { label: "Sync event types", context: "Every event type the connected user owns." },
      { label: "Create bookings", context: "Schedule via Axon voice command — calcom_create_booking action." },
      { label: "Surface today's calendar", context: "Live next-meeting widget on the home dashboard." },
    ],
    dataKinds: [
      { label: "Bookings" },
      { label: "Event types" },
      { label: "Today's calendar" },
    ],
    surfaces: [
      {
        label: "Schedule",
        route: "/schedule",
        description: "Booked meetings appear as virtual shifts on the calendar grid.",
      },
      {
        label: "Home · Up next",
        route: "/",
        description: "Next 3 meetings render in the Up Next agenda strip.",
      },
      {
        label: "Operations · Meetings",
        route: "/operations",
        description: "Two-upcoming preview in the editorial snapshot.",
      },
      {
        label: "Axon voice actions",
        route: null,
        description: "calcom_create_booking — \"Axon, book a 30-min with…\".",
      },
    ],
    axonPowered: true,
  },

  // ── Slack ───────────────────────────────────────────────────
  slack: {
    capabilities: [
      { label: "List channels", context: "Public + private channels the bot is in." },
      { label: "Pull recent messages", context: "Last N messages per channel for the Team Pulse strip." },
      { label: "Track presence", context: "Online / offline / dnd indicators for team members." },
      { label: "Post on your behalf", context: "Quick compose + Axon /msg can DM or post to channels." },
    ],
    dataKinds: [
      { label: "Channels" },
      { label: "DMs" },
      { label: "Recent messages" },
      { label: "Presence" },
    ],
    surfaces: [
      {
        label: "Chat",
        route: "/chat",
        description: "Full Slack-style channel + DM surface with online/offline presence.",
      },
      {
        label: "Operations · Team pulse",
        route: "/operations",
        description: "Two channel previews with the latest messages.",
      },
      {
        label: "Axon voice actions",
        route: null,
        description: "/msg verb in Cmd+K + Cmd+Shift+M quick compose modal.",
      },
    ],
    axonPowered: true,
  },

  // ── Linear ──────────────────────────────────────────────────
  linear: {
    capabilities: [
      { label: "Sync issues", context: "Every issue you can see in Linear, with state + assignee." },
      { label: "Surface cycles", context: "Active cycle progress + remaining points." },
      { label: "Track projects", context: "Project rollups + target dates." },
      { label: "Custom view sync", context: "Saved Linear views readable in the app." },
    ],
    dataKinds: [
      { label: "Issues" },
      { label: "Cycles" },
      { label: "Projects" },
      { label: "Teams" },
    ],
    surfaces: [
      {
        label: "Operations · Snapshot",
        route: "/operations",
        description: "Connected indicator + sync timestamp in the connectors block.",
      },
    ],
  },

  // ── Vercel ──────────────────────────────────────────────────
  vercel: {
    capabilities: [
      { label: "List projects", context: "Every Vercel project owned by the connected account." },
      { label: "Track deployments", context: "Latest deploy status + commit per project." },
      { label: "Surface production status", context: "Production health indicators." },
    ],
    dataKinds: [
      { label: "Projects" },
      { label: "Deployments" },
      { label: "Build logs" },
    ],
    surfaces: [
      {
        label: "Operations · Snapshot",
        route: "/operations",
        description: "Connected indicator + deploy health in the connectors block.",
      },
    ],
  },

  // ── Notion ──────────────────────────────────────────────────
  notion: {
    capabilities: [
      { label: "Sync pages", context: "Pages the integration has been invited to." },
      { label: "Read databases", context: "Database rows for tasks, projects, or any custom schema." },
      { label: "Read blocks", context: "Recursive block content for full-text search." },
    ],
    dataKinds: [
      { label: "Pages" },
      { label: "Database rows" },
      { label: "Blocks" },
    ],
    surfaces: [
      {
        label: "Workspace · Search",
        route: "/workspace",
        description: "Notion pages indexed alongside internal docs.",
      },
    ],
  },

  // ── HubSpot ─────────────────────────────────────────────────
  hubspot: {
    capabilities: [
      { label: "Sync contacts", context: "Every HubSpot contact across portals." },
      { label: "Sync deals + pipelines", context: "Pipelines, stages, deal value." },
      { label: "Track activities", context: "Calls, emails, notes attached to contacts." },
    ],
    dataKinds: [
      { label: "Contacts" },
      { label: "Deals" },
      { label: "Pipelines" },
      { label: "Companies" },
    ],
    surfaces: [
      {
        label: "Sales · Pipeline",
        route: "/sales",
        description: "HubSpot deals fold into the unified pipeline view.",
      },
    ],
  },

  // ── Airtable ────────────────────────────────────────────────
  airtable: {
    capabilities: [
      { label: "Read bases", context: "Any base + table the token can access." },
      { label: "Write rows", context: "Append / update records via PAT scope." },
    ],
    dataKinds: [{ label: "Bases" }, { label: "Tables" }, { label: "Records" }],
    surfaces: [],
  },

  // ── OpenAI ──────────────────────────────────────────────────
  openai: {
    capabilities: [
      { label: "GPT model access", context: "Chat completions, embeddings, function calls." },
      { label: "Powers Axon planning", context: "Fallback inference for ops planner + utterance grading." },
    ],
    dataKinds: [{ label: "API calls" }, { label: "Token usage" }],
    surfaces: [
      {
        label: "Axon",
        route: null,
        description: "Anthropic-first; OpenAI powers the fallback path for ops planning.",
      },
    ],
    axonPowered: true,
  },

  // ── Resend / SendGrid ───────────────────────────────────────
  resend: {
    capabilities: [
      { label: "Send transactional email", context: "Onboarding invites, reset links, system notifications." },
    ],
    dataKinds: [{ label: "Send events" }, { label: "Delivery status" }],
    surfaces: [
      {
        label: "Onboarding",
        route: "/onboarding",
        description: "Powers founder + employee invite emails.",
      },
    ],
  },
  sendgrid: {
    capabilities: [
      { label: "Send transactional email", context: "Same envelope as Resend — alternate provider for higher volume." },
    ],
    dataKinds: [{ label: "Send events" }, { label: "Delivery status" }],
    surfaces: [],
  },

  // ── Asana ───────────────────────────────────────────────────
  asana: {
    capabilities: [
      { label: "Sync tasks", context: "Tasks across the selected workspace." },
      { label: "Sync projects", context: "Project rollups + portfolios." },
    ],
    dataKinds: [{ label: "Tasks" }, { label: "Projects" }, { label: "Portfolios" }],
    surfaces: [],
  },

  // ── Calendly ────────────────────────────────────────────────
  calendly: {
    capabilities: [
      { label: "Sync event types", context: "Bookable event types from the connected user." },
      { label: "Webhook on booking", context: "Auto-create a shift when a booking lands." },
    ],
    dataKinds: [{ label: "Event types" }, { label: "Scheduled events" }],
    surfaces: [
      {
        label: "Schedule",
        route: "/schedule",
        description: "Calendly bookings render as virtual shifts on the grid.",
      },
    ],
  },

  // ── Google Docs ─────────────────────────────────────────────
  "google-docs": {
    capabilities: [
      { label: "Sync Drive docs", context: "Docs the OAuth scopes permit." },
      { label: "Per-doc permissions", context: "Respects the source-of-truth permission model." },
    ],
    dataKinds: [{ label: "Documents" }, { label: "Folders" }],
    surfaces: [],
  },

  // ── Mailchimp ───────────────────────────────────────────────
  mailchimp: {
    capabilities: [
      { label: "Sync audiences", context: "Audience members, segments, tags." },
      { label: "Send campaigns", context: "From a connected audience." },
    ],
    dataKinds: [{ label: "Audiences" }, { label: "Subscribers" }, { label: "Campaigns" }],
    surfaces: [],
  },

  // ── Plaid ───────────────────────────────────────────────────
  plaid: {
    capabilities: [
      { label: "Link bank account", context: "Institution linking + access token exchange." },
      { label: "Read balances", context: "Live account balances after link." },
      { label: "Read transactions", context: "Historical + ongoing transactions." },
    ],
    dataKinds: [{ label: "Accounts" }, { label: "Balances" }, { label: "Transactions" }],
    surfaces: [
      {
        label: "Financial dashboard · Cash",
        route: "/financialDashboard",
        description: "Connected bank balances feed the cash + runway calculation.",
      },
    ],
  },
};

/** O(1) lookup. Returns undefined for connectors we haven't documented
 *  yet — the modal renders a friendly fallback in that case. */
export function getConnectorMetadata(
  kind: string,
): ConnectorMetadata | undefined {
  return META[kind];
}
