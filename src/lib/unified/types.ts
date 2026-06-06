/**
 * lib/unified/types.ts — Cross-cutting "data source" registry +
 * primitives shared by every provider-neutral surface.
 *
 * The core product principle: TakeOver doesn't have a "Cal.com
 * page" or a "Stripe page" or a "Linear page." It has a Meetings
 * page, a Finance page, a Tasks page — each rendering data from
 * whichever providers the operator connected. A small badge per
 * row shows the source. AXON's commands work across all providers
 * because they read from the unified layer, not the raw connector.
 *
 * This file defines the connector → display metadata registry. Every
 * unified domain module (lib/unified/meetings.ts, lib/unified/finance.ts,
 * etc.) imports from here so the source attribution is consistent
 * across surfaces — a Stripe row in Finance has the same purple badge
 * as a Stripe row would in any other surface that surfaces Stripe.
 *
 * Adding a new connector to the unified system is one line: register
 * it in DATA_SOURCES below with a category and color. Then write a
 * single adapter inside the relevant domain module that maps that
 * provider's raw API response to the domain's Unified type. The UI
 * picks it up automatically.
 */

import { hexToRgba } from "@/MyComponents/SettingNavComponents/connectorCatalog";

// ────────────────────────────────────────────────
// Domain categories
// ────────────────────────────────────────────────

/** The cross-cutting product categories TakeOver surfaces. Every
 *  connector belongs to one or more of these. Adding a category
 *  here means a new top-level "domain" page like /meetings or
 *  /finance — make sure you're ready to ship the UI before adding. */
export type UnifiedDomain =
  | "meetings"   // Cal.com · Google Calendar · Calendly · TakeOver
  | "finance"    // Stripe · Mercury · Plaid · Brex · Ramp · Toast · QBO
  | "tasks"      // Linear · Asana · Jira · TakeOver
  | "docs"       // Notion · Google Docs · Confluence · TakeOver
  | "crm"        // HubSpot · Salesforce · Pipedrive · TakeOver
  | "chat"       // Slack · Discord · Teams · TakeOver
  | "email"      // Gmail · Outlook · TakeOver
  | "code"       // GitHub · GitLab · Bitbucket
  | "deploy"     // Vercel · Netlify · Fly · Render
  | "analytics"; // PostHog · Mixpanel · Amplitude · Segment

// ────────────────────────────────────────────────
// Data source registry
// ────────────────────────────────────────────────

export interface DataSourceMeta {
  /** Matches `connectors.kind` in the DB. Also the key passed around
   *  in `UnifiedX.source` fields. */
  id: string;
  /** Display name for UI badges + AXON output. */
  name: string;
  /** Brand hex color — drives the badge tint via hexToRgba(). */
  color: string;
  /** Which TakeOver surfaces this provider can populate. Most
   *  providers belong to one domain, a few cross domains (e.g.
   *  Google has Calendar + Docs + Gmail). */
  domains: UnifiedDomain[];
  /** Optional public logo URL (for future richer badges). */
  logo_url?: string;
}

/** The single source of truth. Every connector across the catalog +
 *  TakeOver's own native surfaces lands here. Adding a row makes
 *  the badge / filter / aggregation everywhere just work. */
export const DATA_SOURCES: Record<string, DataSourceMeta> = {
  // TakeOver's own native surfaces. Treated as a "source" so the
  // unified view can show a native row alongside connector rows
  // with consistent attribution.
  takeover: {
    id: "takeover",
    name: "TakeOver",
    color: "#FF4D00",
    domains: ["meetings", "tasks", "docs", "crm", "chat", "email"],
  },

  // ── Meetings / scheduling ────────────────────────────────────
  "cal-com": {
    id: "cal-com",
    name: "Cal.com",
    color: "#0EA5E9",
    domains: ["meetings"],
  },
  "google-calendar": {
    id: "google-calendar",
    name: "Google Calendar",
    color: "#4285F4",
    domains: ["meetings"],
  },
  calendly: {
    id: "calendly",
    name: "Calendly",
    color: "#006BFF",
    domains: ["meetings"],
  },

  // ── Finance / banking / payments ─────────────────────────────
  stripe: {
    id: "stripe",
    name: "Stripe",
    color: "#635BFF",
    domains: ["finance"],
  },
  mercury: {
    id: "mercury",
    name: "Mercury",
    color: "#1A1F36",
    domains: ["finance"],
  },
  brex: {
    id: "brex",
    name: "Brex",
    color: "#FF7300",
    domains: ["finance"],
  },
  ramp: {
    id: "ramp",
    name: "Ramp",
    color: "#FFCC00",
    domains: ["finance"],
  },
  plaid: {
    id: "plaid",
    name: "Plaid",
    color: "#000000",
    domains: ["finance"],
  },
  toast: {
    id: "toast",
    name: "Toast",
    color: "#FF4422",
    domains: ["finance"],
  },
  qbo: {
    id: "qbo",
    name: "QuickBooks",
    color: "#2CA01C",
    domains: ["finance"],
  },

  // ── Tasks / PM ───────────────────────────────────────────────
  linear: {
    id: "linear",
    name: "Linear",
    color: "#5E6AD2",
    domains: ["tasks"],
  },
  asana: {
    id: "asana",
    name: "Asana",
    color: "#F06A6A",
    domains: ["tasks"],
  },
  jira: {
    id: "jira",
    name: "Jira",
    color: "#0052CC",
    domains: ["tasks"],
  },

  // ── Docs ─────────────────────────────────────────────────────
  notion: {
    id: "notion",
    name: "Notion",
    color: "#000000",
    domains: ["docs"],
  },
  "google-docs": {
    id: "google-docs",
    name: "Google Docs",
    color: "#4285F4",
    domains: ["docs"],
  },

  // ── CRM ──────────────────────────────────────────────────────
  hubspot: {
    id: "hubspot",
    name: "HubSpot",
    color: "#FF7A59",
    domains: ["crm"],
  },

  // ── Chat / messaging ─────────────────────────────────────────
  slack: {
    id: "slack",
    name: "Slack",
    color: "#4A154B",
    domains: ["chat"],
  },
  discord: {
    id: "discord",
    name: "Discord",
    color: "#5865F2",
    domains: ["chat"],
  },

  // ── Email ────────────────────────────────────────────────────
  gmail: {
    id: "gmail",
    name: "Gmail",
    color: "#EA4335",
    domains: ["email"],
  },
  sendgrid: {
    id: "sendgrid",
    name: "SendGrid",
    color: "#1A82E2",
    domains: ["email"],
  },
  resend: {
    id: "resend",
    name: "Resend",
    color: "#000000",
    domains: ["email"],
  },

  // ── Code ─────────────────────────────────────────────────────
  github: {
    id: "github",
    name: "GitHub",
    color: "#24292F",
    domains: ["code"],
  },

  // ── Deploy ───────────────────────────────────────────────────
  vercel: {
    id: "vercel",
    name: "Vercel",
    color: "#000000",
    domains: ["deploy"],
  },
};

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

/** O(1) lookup. Returns undefined for unknown sources (e.g. a
 *  connector kind that hasn't been registered yet); UI should
 *  fall back to a neutral "Unknown" badge rather than crashing. */
export function getSourceMeta(sourceId: string): DataSourceMeta | undefined {
  return DATA_SOURCES[sourceId];
}

/** All providers registered for a given domain — drives the filter
 *  chips at the top of unified pages and the AXON action's
 *  knowledge of "which providers should I query for this command". */
export function sourcesForDomain(domain: UnifiedDomain): DataSourceMeta[] {
  return Object.values(DATA_SOURCES).filter((s) => s.domains.includes(domain));
}

/** Stable tint pair for inline badges. Returns { bg, fg, border }
 *  ready to spread into a style attribute. Centralizing means a
 *  Stripe badge in Finance looks identical to a Stripe row badge in
 *  any other surface that might mention it. */
export function sourceBadgeTones(sourceId: string): {
  bg: string;
  fg: string;
  border: string;
} {
  const meta = getSourceMeta(sourceId);
  const color = meta?.color ?? "#6B7280"; // neutral gray fallback
  return {
    bg: hexToRgba(color, 0.12),
    fg: color,
    border: hexToRgba(color, 0.28),
  };
}
