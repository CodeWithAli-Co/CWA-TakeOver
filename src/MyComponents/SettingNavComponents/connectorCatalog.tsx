/**
 * connectorCatalog.tsx — shared catalog data + display primitives.
 *
 * Used by both the Settings → Connectors page and the
 * Operations → Connectors strip. Keeping the catalog data in
 * one place means new connectors only have to be added once,
 * and every surface that shows connector tiles renders them the
 * same way (same monogram color, same name spelling).
 *
 * The 15 entries are ordered easiest → hardest to set up,
 * matching the order shown in Settings. Brand colors are
 * approximations — we don't ship real SVG logos, just colored
 * monograms.
 */

export type ConnectorTier = "Easy" | "Medium" | "Hard";

export interface CatalogEntry {
  /** Matches `connectors.kind` in Supabase. */
  id: string;
  /** Display name. */
  name: string;
  /** Single-letter monogram for the avatar tile. */
  monogram: string;
  /** Rough brand color, hex. Drives the monogram tint. */
  brand: string;
  /** Short pitch — what this connector unlocks. */
  tagline: string;
  /** Category label shown in the corner of the Settings card. */
  category: string;
  /** Setup difficulty — orders the catalog + tints the badge. */
  tier: ConnectorTier;
}

export const CONNECTORS: CatalogEntry[] = [
  // ── Easy: single API key ───────────────────────────────────
  {
    id: "openai",
    name: "OpenAI",
    monogram: "O",
    brand: "#10A37F",
    tagline: "Drop in a key — GPT models, embeddings, function calls.",
    category: "AI",
    tier: "Easy",
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    monogram: "S",
    brand: "#1A82E2",
    tagline: "Transactional email via a single SMTP / API key.",
    category: "Email",
    tier: "Easy",
  },
  {
    id: "resend",
    name: "Resend",
    monogram: "R",
    brand: "#000000",
    tagline: "Modern email API — drop a key, send a message.",
    category: "Email",
    tier: "Easy",
  },
  {
    id: "stripe",
    name: "Stripe",
    monogram: "S",
    brand: "#635BFF",
    tagline: "Payments, subscriptions, invoices — publishable + secret key.",
    category: "Payments",
    tier: "Easy",
  },
  {
    id: "airtable",
    name: "Airtable",
    monogram: "A",
    brand: "#FCB400",
    tagline: "Personal access token + base id, read / write bases.",
    category: "Database",
    tier: "Easy",
  },

  // ── Medium: standard OAuth 2.0 ─────────────────────────────
  {
    id: "github",
    name: "GitHub",
    monogram: "G",
    brand: "#24292F",
    tagline: "OAuth — repos, PRs, issues, commit activity.",
    category: "Code",
    tier: "Medium",
  },
  {
    id: "slack",
    name: "Slack",
    monogram: "S",
    brand: "#4A154B",
    tagline: "OAuth + workspace pick — channels, messages, presence.",
    category: "Messaging",
    tier: "Medium",
  },
  {
    id: "linear",
    name: "Linear",
    monogram: "L",
    brand: "#5E6AD2",
    tagline: "OAuth — issues, cycles, projects, custom views.",
    category: "Project mgmt",
    tier: "Medium",
  },
  {
    id: "notion",
    name: "Notion",
    monogram: "N",
    brand: "#000000",
    tagline: "OAuth — pages, databases, blocks. Bot must be invited.",
    category: "Docs",
    tier: "Medium",
  },
  {
    id: "asana",
    name: "Asana",
    monogram: "A",
    brand: "#F06A6A",
    tagline: "OAuth + workspace selector — tasks, projects, portfolios.",
    category: "Project mgmt",
    tier: "Medium",
  },

  // ── Hard: OAuth + scopes / webhooks / portal selection ─────
  {
    id: "hubspot",
    name: "HubSpot",
    monogram: "H",
    brand: "#FF7A59",
    tagline: "OAuth + portal id + granular scopes. Contacts, deals, pipelines.",
    category: "CRM",
    tier: "Hard",
  },
  {
    id: "calendly",
    name: "Calendly",
    monogram: "C",
    brand: "#006BFF",
    tagline: "OAuth + event types + webhook signing keys for scheduling.",
    category: "Scheduling",
    tier: "Hard",
  },
  {
    id: "google-docs",
    name: "Google Docs",
    monogram: "G",
    brand: "#4285F4",
    tagline: "OAuth2 — Drive scopes, refresh tokens, per-doc permissions.",
    category: "Docs",
    tier: "Hard",
  },
  {
    id: "mailchimp",
    name: "Mailchimp",
    monogram: "M",
    brand: "#FFE01B",
    tagline: "OAuth + audience selection + double-opt-in considerations.",
    category: "Marketing",
    tier: "Hard",
  },

  // ── Hardest: regulated multi-step flow ─────────────────────
  {
    id: "plaid",
    name: "Plaid",
    monogram: "P",
    brand: "#000000",
    tagline: "Institution linking, public→access token exchange, KYC.",
    category: "Banking",
    tier: "Hard",
  },
];

/** O(1) lookup by `kind`. */
export function getCatalogEntry(kind: string): CatalogEntry | undefined {
  return CONNECTORS.find((c) => c.id === kind);
}

/** Tone classes for the difficulty badge. */
export function tierStyle(tier: ConnectorTier): {
  text: string;
  bg: string;
  border: string;
} {
  if (tier === "Easy")
    return {
      text: "text-success",
      bg: "bg-success/12",
      border: "border-success/30",
    };
  if (tier === "Medium")
    return {
      text: "text-warning",
      bg: "bg-warning/12",
      border: "border-warning/30",
    };
  return {
    text: "text-destructive",
    bg: "bg-destructive/12",
    border: "border-destructive/30",
  };
}

/** Convert `#RRGGBB` or `#RGB` to `rgba()` with the given alpha.
 *  Used to tint the monogram badge background with the brand
 *  color at low opacity. */
export function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Colored monogram badge used as the connector "logo" stand-in.
 *  `size` controls the tile dimensions in pixels (and font size
 *  scales with it). Used in both the Settings catalog and the
 *  Operations strip. */
export function Monogram({
  letter,
  color,
  size = 36,
}: {
  letter: string;
  color: string;
  size?: number;
}) {
  const bg = hexToRgba(color, 0.16);
  const ring = hexToRgba(color, 0.35);
  return (
    <div
      className="rounded-xl flex items-center justify-center shrink-0 border"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        borderColor: ring,
        color,
      }}
    >
      <span
        className="font-bold leading-none"
        style={{
          fontSize: Math.round(size * 0.4),
          fontFamily: "var(--ed-font-display, Inter), system-ui, sans-serif",
        }}
      >
        {letter}
      </span>
    </div>
  );
}
