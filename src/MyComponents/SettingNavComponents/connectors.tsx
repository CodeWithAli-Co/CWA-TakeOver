/**
 * connectors.tsx — Settings → Connectors page.
 *
 * Replaces the previous "Integrations" page. Under the new
 * Takeover model (a single UI that aggregates every SaaS the team
 * already uses), this is the catalog where the operator wires up
 * each external account. The catalog is ordered easiest →
 * hardest to set up so the operator can start small and ratchet
 * up.
 *
 * Difficulty tiers:
 *   · Easy   — single API key paste, no OAuth dance.
 *   · Medium — standard OAuth 2.0 flow.
 *   · Hard   — multi-step (linking + token exchange + webhooks
 *              and/or regulatory/compliance considerations).
 *
 * Connection state is not persisted yet — there is no
 * `connectors` table. Every card renders "Not connected" and the
 * Connect button shows a placeholder. Backend wiring is a
 * separate phase.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plug, Search, X, CheckCircle2, Loader2 } from "lucide-react";
import {
  useConnectors,
  useDeleteConnector,
  type Connector as PersistedConnector,
} from "@/stores/connectors";
import { ConnectorCredentialDialog } from "./ConnectorCredentialDialog";

type Tier = "Easy" | "Medium" | "Hard";

interface Connector {
  /** Stable id for state + future persistence. */
  id: string;
  /** Display name. */
  name: string;
  /** Single-letter monogram shown in the card avatar. */
  monogram: string;
  /** Rough brand-tinted background for the monogram badge. Hex
   *  so we don't depend on Tailwind arbitrary value support. */
  brand: string;
  /** Short tagline — what the connector unlocks. */
  tagline: string;
  /** Category label shown in the corner of each card. */
  category: string;
  /** Setup difficulty — orders the catalog and tints the badge. */
  tier: Tier;
}

/**
 * The 15 catalog entries, in the exact order they should appear.
 * Sorted from "paste an API key" at the top down to "regulated
 * multi-step flow" at the bottom. Stripe (#4), Google Docs (#13),
 * and Plaid (#15) are present per spec.
 */
const CONNECTORS: Connector[] = [
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

// Difficulty tone for the badge.
function tierStyle(tier: Tier): {
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

// ─────────────────────────────────────────────────────────────────
// Page export
// ─────────────────────────────────────────────────────────────────

export const ConnectorsSettings = () => {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<Tier | "All">("All");

  // Real persistence — read from the `connectors` table.
  const { data: persisted = [], isLoading } = useConnectors();
  const deleteMut = useDeleteConnector();

  // Map kind → persisted row for O(1) lookups in the catalog.
  const connectedByKind = useMemo(() => {
    const m = new Map<string, PersistedConnector>();
    for (const row of persisted) m.set(row.kind, row);
    return m;
  }, [persisted]);

  // Which connector's credential modal is open. `null` = closed.
  const [openKind, setOpenKind] = useState<string | null>(null);

  const handleDisconnect = (kind: string) => {
    const row = connectedByKind.get(kind);
    if (row) deleteMut.mutate(row.id);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CONNECTORS.filter((c) => {
      if (tierFilter !== "All" && c.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.tagline.toLowerCase().includes(q)
      );
    });
  }, [query, tierFilter]);

  const tierCounts = useMemo(() => {
    const counts = { Easy: 0, Medium: 0, Hard: 0 } as Record<Tier, number>;
    for (const c of CONNECTORS) counts[c.tier]++;
    return counts;
  }, []);

  return (
    <div className="space-y-5">
      {/* Hero */}
      <header>
        <div className="flex items-center gap-2 mb-1.5">
          <Plug className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
          <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
            Catalog
          </span>
        </div>
        <h2 className="text-[20px] font-bold text-foreground leading-tight tracking-[-0.02em]">
          Connectors<span className="text-primary">.</span>
        </h2>
        <p className="text-[12.5px] text-text-tertiary mt-1.5 max-w-xl leading-relaxed">
          Wire up the tools your team already uses. Each connector pulls data
          and exposes actions across the dashboard. Ordered easiest to set up
          first.
        </p>
      </header>

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search connectors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 bg-foreground/[0.04] border border-border-soft rounded-md text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Tier segmented control */}
        <div className="inline-flex items-center bg-foreground/[0.05] border border-border-soft rounded-full p-0.5">
          {(["All", "Easy", "Medium", "Hard"] as const).map((t) => (
            <TierChip
              key={t}
              label={t}
              count={t === "All" ? CONNECTORS.length : tierCounts[t]}
              active={tierFilter === t}
              onClick={() => setTierFilter(t)}
            />
          ))}
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-tertiary">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          <span className="text-[12px]">Loading catalog…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border-soft rounded-2xl">
          <p className="text-[12px] text-text-tertiary italic">
            No connectors match that filter.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => {
            const row = connectedByKind.get(c.id) ?? null;
            return (
              <ConnectorCard
                key={c.id}
                connector={c}
                connected={!!row}
                onConnect={() => setOpenKind(c.id)}
                onDisconnect={() => handleDisconnect(c.id)}
                lastSyncedAt={row?.last_synced_at ?? null}
                delay={Math.min(i, 8) * 0.03}
              />
            );
          })}
        </div>
      )}

      {/* Footnote */}
      <p className="text-[11px] text-text-tertiary/80 italic text-center pt-2">
        Credentials are stored in Supabase with row-level security. Axon reads
        from the same table — connect a service here and it appears in Axon's
        toolbox.
      </p>

      {/* Credential modal — opens for whichever kind was clicked. */}
      {openKind && (
        <ConnectorCredentialDialog
          kind={openKind}
          name={
            CONNECTORS.find((c) => c.id === openKind)?.name ?? openKind
          }
          existing={connectedByKind.get(openKind) ?? null}
          onClose={() => setOpenKind(null)}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Tier filter chip
// ─────────────────────────────────────────────────────────────────

function TierChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full text-[10.5px] font-bold uppercase tracking-[0.14em] transition-colors ${
        active
          ? "text-background"
          : "text-text-tertiary hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="connectorTierIndicator"
          className="absolute inset-0 bg-foreground rounded-full"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span className="relative">{label}</span>
      <span
        className={`relative tabular-nums ${active ? "text-background/70" : "text-text-tertiary/70"}`}
      >
        {count}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// ConnectorCard
// ─────────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  connected,
  onConnect,
  onDisconnect,
  lastSyncedAt,
  delay,
}: {
  connector: Connector;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  lastSyncedAt: string | null;
  delay: number;
}) {
  const t = tierStyle(connector.tier);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-border/30 transition-colors overflow-hidden flex flex-col"
    >
      {/* Card body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Top row — monogram + name + tier */}
        <div className="flex items-start gap-3">
          <Monogram
            letter={connector.monogram}
            color={connector.brand}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[13.5px] font-bold text-foreground leading-tight truncate">
                {connector.name}
              </h3>
              {connected && (
                <CheckCircle2
                  className="h-3 w-3 text-success shrink-0"
                  strokeWidth={2.4}
                />
              )}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-text-tertiary/80 mt-0.5">
              {connector.category}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[9.5px] font-bold uppercase tracking-[0.12em] shrink-0 ${t.bg} ${t.text} ${t.border}`}
          >
            {connector.tier}
          </span>
        </div>

        {/* Tagline */}
        <p className="text-[11.5px] text-text-secondary leading-relaxed line-clamp-2">
          {connector.tagline}
        </p>

        {/* Last-sync timestamp when connected */}
        {connected && lastSyncedAt && (
          <p className="text-[10px] text-text-tertiary tabular-nums">
            Last synced {new Date(lastSyncedAt).toLocaleString()}
          </p>
        )}
      </div>

      {/* Footer — connect / manage buttons */}
      <div className="px-4 pb-4 pt-1 flex items-center gap-2">
        {connected ? (
          <>
            <button
              type="button"
              onClick={onConnect}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold bg-success/[0.08] text-success border border-success/30 hover:bg-success/[0.12] transition-colors"
            >
              <CheckCircle2 size={11} strokeWidth={2.4} />
              Manage
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="inline-flex items-center justify-center h-8 px-3 rounded-full text-[10.5px] font-semibold text-text-tertiary border border-border-soft hover:border-destructive/40 hover:text-destructive hover:bg-destructive/[0.05] transition-colors"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="w-full inline-flex items-center justify-center gap-1.5 h-8 px-4 rounded-full text-[11.5px] font-semibold bg-foreground/[0.04] text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.06] transition-colors"
          >
            <Plug size={11} strokeWidth={2.4} />
            Connect
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Monogram — colored badge with the brand's first letter
// ─────────────────────────────────────────────────────────────────

function Monogram({ letter, color }: { letter: string; color: string }) {
  // Convert the hex brand color into rgba with low alpha for the
  // tile background, full alpha for the letter color. That way
  // every monogram looks "branded" without us having to ship 15
  // SVG logos.
  const bg = hexToRgba(color, 0.16);
  const ring = hexToRgba(color, 0.35);

  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
      style={{
        backgroundColor: bg,
        borderColor: ring,
        color: color,
      }}
    >
      <span
        className="text-[14px] font-bold leading-none"
        style={{
          fontFamily: "var(--ed-font-display, Inter), system-ui, sans-serif",
        }}
      >
        {letter}
      </span>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
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
