/**
 * connectorSchemas.ts — per-kind credential field definitions.
 *
 * Keeps the catalog (connectors.tsx) free of provider-specific
 * field shape. Each connector kind declares the inputs its
 * modal should render; the generic ConnectorCredentialDialog
 * walks the list, builds the form, and submits a strongly-keyed
 * `credentials` object to useUpsertConnector.
 *
 * The catalog page maps Connector.id → schema lookup via
 * `getConnectorSchema(kind)`. If a kind has no schema yet
 * (Plaid, GitHub OAuth flows etc.), it falls back to a stub that
 * just tells the user the connector is coming soon.
 */

export type ConnectorFieldType = "text" | "password" | "url";

export interface ConnectorField {
  /** Key used in the credentials JSONB blob. */
  key: string;
  /** Display label above the input. */
  label: string;
  /** Input type — `password` masks the value. */
  type: ConnectorFieldType;
  /** Inline helper text shown under the field. */
  hint?: string;
  /** Placeholder shown in the empty input. */
  placeholder?: string;
  /** Required to submit. Defaults to true. */
  required?: boolean;
  /** Optional regex the value must match before submit enables. */
  pattern?: RegExp;
}

export interface ConnectorSchema {
  /** Where the user goes to generate the credentials. Linked
   *  from the dialog footer so they can pop out, grab a key,
   *  and paste it back in. */
  docsUrl: string;
  /** One-paragraph intro shown at the top of the modal. */
  blurb: string;
  /** Inputs the dialog renders. Order matters. */
  fields: ConnectorField[];
  /** Optional disclaimer (e.g. browser-side limitations). */
  disclaimer?: string;
}

const SCHEMAS: Record<string, ConnectorSchema> = {
  openai: {
    docsUrl: "https://platform.openai.com/api-keys",
    blurb:
      "Bring your own OpenAI key. Axon will use it for chat completions and embeddings.",
    fields: [
      {
        key: "api_key",
        label: "API key",
        type: "password",
        placeholder: "sk-…",
        hint: "Starts with `sk-`. Stored encrypted; only your team can read it.",
        pattern: /^sk-/,
      },
    ],
  },

  sendgrid: {
    docsUrl: "https://app.sendgrid.com/settings/api_keys",
    blurb:
      "Send transactional email through SendGrid. Use a key with at least Mail Send scope.",
    fields: [
      {
        key: "api_key",
        label: "API key",
        type: "password",
        placeholder: "SG…",
        hint: "Generate a new restricted key with Mail Send → Full Access.",
      },
      {
        key: "from_email",
        label: "Default from-address",
        type: "text",
        placeholder: "noreply@yourcompany.com",
        hint: "Must be a verified sender in SendGrid.",
      },
    ],
    disclaimer:
      "Outbound email runs through a Supabase Edge Function (proxies your key). Wiring lands in the next release.",
  },

  resend: {
    docsUrl: "https://resend.com/api-keys",
    blurb:
      "Modern email API. Paste a key and Axon can send mail on your behalf.",
    fields: [
      {
        key: "api_key",
        label: "API key",
        type: "password",
        placeholder: "re_…",
        hint: "Starts with `re_`. Generate in Resend → API Keys.",
        pattern: /^re_/,
      },
      {
        key: "from_email",
        label: "Default from-address",
        type: "text",
        placeholder: "team@yourcompany.com",
      },
    ],
    disclaimer:
      "Outbound email runs through a Supabase Edge Function (proxies your key). Wiring lands in the next release.",
  },

  stripe: {
    docsUrl: "https://dashboard.stripe.com/apikeys",
    blurb:
      "Pull MRR, MTD revenue, and outstanding invoices into your financial dashboard. AXON gets verbs over your revenue.",
    fields: [
      {
        key: "secret_key",
        label: "Restricted API key",
        type: "password",
        placeholder: "rk_live_… or sk_live_…",
        hint:
          "Best practice: create a restricted key with read access to Customers, Subscriptions, Invoices, and Charges. We'll verify it before saving.",
        pattern: /^(rk|sk)_(live|test)_/,
      },
    ],
    disclaimer:
      "Your key is routed through the Takeover proxy so Stripe accepts the call (browser CORS is blocked by Stripe). The proxy forwards verbatim — never logged, never stored.",
  },

  airtable: {
    docsUrl: "https://airtable.com/create/tokens",
    blurb:
      "Read your Airtable bases. Axon can list tables, fetch records, and surface them in the dashboard.",
    fields: [
      {
        key: "pat",
        label: "Personal access token",
        type: "password",
        placeholder: "pat…",
        hint: "Create a PAT with `data.records:read` and `schema.bases:read` scopes for the base below.",
        pattern: /^pat/,
      },
      {
        key: "base_id",
        label: "Base ID",
        type: "text",
        placeholder: "appXXXXXXXXXXXXXX",
        hint: "Open your base, copy the id from the URL (it starts with `app`).",
        pattern: /^app/,
      },
    ],
  },

  github: {
    docsUrl: "https://github.com/settings/tokens",
    blurb:
      "Read repos, pull requests, and issues. Use a fine-grained personal access token with `repo` scope.",
    fields: [
      {
        key: "token",
        label: "Personal access token",
        type: "password",
        placeholder: "github_pat_… or ghp_…",
        hint: "Create a fine-grained PAT scoped to the repos you want Axon to see.",
        pattern: /^(github_pat_|ghp_)/,
      },
      {
        key: "default_owner",
        label: "Default owner (optional)",
        type: "text",
        placeholder: "your-username-or-org",
        hint: "Used as the default `owner` when Axon lists PRs / issues.",
        required: false,
      },
    ],
  },

  notion: {
    docsUrl: "https://www.notion.so/profile/integrations",
    blurb:
      "Read pages and databases. Create an internal integration in Notion, then share the pages you want Axon to see with that integration.",
    fields: [
      {
        key: "token",
        label: "Internal integration token",
        type: "password",
        placeholder: "ntn_… or secret_…",
        hint: "Found at notion.so/my-integrations under your integration's Capabilities tab.",
        pattern: /^(ntn_|secret_)/,
      },
    ],
    disclaimer:
      "Pages must be explicitly shared with the integration. In Notion, hit the ••• menu on a page → Connections → add your integration.",
  },

  // Stubs — same shape so the catalog renders the modal but the
  // actual wiring (OAuth callback URLs etc.) is a separate epic.
  slack: makeOAuthStub("Slack", "https://api.slack.com/apps"),
  linear: makeOAuthStub("Linear", "https://linear.app/settings/api"),
  asana: makeOAuthStub("Asana", "https://app.asana.com/0/my-apps"),

  hubspot: makeOAuthStub(
    "HubSpot",
    "https://app.hubspot.com/private-apps",
  ),
  calendly: makeOAuthStub(
    "Calendly",
    "https://calendly.com/integrations/api_webhooks",
  ),
  "google-docs": makeOAuthStub(
    "Google Docs",
    "https://console.cloud.google.com/apis/credentials",
  ),
  mailchimp: makeOAuthStub(
    "Mailchimp",
    "https://us1.admin.mailchimp.com/account/api/",
  ),
  plaid: makeOAuthStub("Plaid", "https://dashboard.plaid.com/developers/keys"),
};

function makeOAuthStub(name: string, docsUrl: string): ConnectorSchema {
  return {
    docsUrl,
    blurb: `${name} uses OAuth. Paste a personal access token to preview the connection; the full OAuth flow ships in a later release.`,
    fields: [
      {
        key: "token",
        label: "Personal access token",
        type: "password",
        placeholder: "Token from the linked page",
      },
    ],
    disclaimer:
      "Stored for inspection only — Axon does not yet read from this connector.",
  };
}

export function getConnectorSchema(kind: string): ConnectorSchema | null {
  return SCHEMAS[kind] ?? null;
}
