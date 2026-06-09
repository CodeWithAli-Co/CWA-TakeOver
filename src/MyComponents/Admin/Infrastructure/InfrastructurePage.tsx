/**
 * InfrastructurePage.tsx — TakeOver's internal super-admin console.
 *
 * Accessible only to CodeWithAli's CEO + COO. Renders live state of
 * the entire TakeOver system: connectors, AXON registry, tenants,
 * monitors, and the per-tenant versioning surface.
 *
 * Distinct from per-tenant admin pages (Capital Plan, Vercel, Linear).
 * Those are tenant-facing dashboards. This one is *our* dashboard —
 * for managing TakeOver itself across every tenant we sell to.
 *
 * Layout: single-page scroll with collapsible sections so leadership
 * can see everything at a glance and dive into whatever needs
 * attention. No tabs — screenshots of this page should fit in one
 * frame for context-sharing.
 */

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Box,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  Flame,
  GitBranch,
  Globe,
  Layers,
  Loader2,
  Network,
  Plug,
  RotateCw,
  Server,
  ServerCog,
  Shield,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { companySupabase } from "@/MyComponents/supabase";
import { useConnectors } from "@/stores/connectors";
import { listActions } from "@/Axon/actions/registry";
import { MONITORS } from "@/Axon/engine/monitors";
import { CONNECTORS as CATALOG } from "@/MyComponents/SettingNavComponents/connectorCatalog";
import { DATA_SOURCES } from "@/lib/unified/types";
import { SourceBadge } from "@/lib/unified/SourceBadge";
import { takeOverSupabase } from "@/MyComponents/supabase";

// ────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────

interface TenantRow {
  company_name: string;
  display_name: string | null;
  companydb_url: string | null;
  _companydb_secret_key: string | null;
  companydb_key: string | null;
  created_at?: string;
}

// ────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────

export function InfrastructurePage() {
  // Live tenant registry from the central project. Service-role
  // would be needed for cross-tenant inspection on production —
  // for the admin's own row, anon key with RLS allowance suffices.
  const tenantsQ = useQuery<TenantRow[]>({
    queryKey: ["infra", "tenants"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await takeOverSupabase
        .from("takeover_companies")
        .select(
          "company_name, display_name, companydb_url, companydb_key, _companydb_secret_key, created_at",
        )
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TenantRow[];
    },
  });

  // Connector rows from the central connectors table — the actual
  // wired state, not just what's in the catalog.
  const { data: connectorRows = [] } = useConnectors();

  // AXON action registry — computed at page mount. Stable for the
  // session since the registry is set once on AxonProvider init.
  const axonActions = useMemo(() => listActions(), []);

  // Group actions by category (file prefix in the name — slack_*,
  // linear_*, etc.). Falls back to "core" for native verbs.
  const actionsByCategory = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of axonActions) {
      const prefix = a.name.split("_")[0] ?? "core";
      const category = CATEGORY_LABEL[prefix] ?? capitalize(prefix);
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(a.name);
    }
    // Sort categories alphabetically; sort actions within each.
    return Array.from(map.entries())
      .map(
        ([cat, names]) =>
          [cat, names.sort((a, b) => a.localeCompare(b))] as const,
      )
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [axonActions]);

  // Connector status matrix: catalog entry + live connector row +
  // whether it's in our unified registry. Drives the matrix table.
  const connectorMatrix = useMemo(() => {
    return CATALOG.map((entry) => {
      const row = connectorRows.find((c) => c.kind === entry.id);
      const inUnified = !!DATA_SOURCES[entry.id];
      return {
        ...entry,
        row,
        inUnified,
      };
    });
  }, [connectorRows]);

  // Unified-registry providers that DON'T have a catalog entry yet
  // (the 🔵 row in the matrix from the doc). These are ready to plug
  // in but no schema exists yet.
  const unifiedOnly = useMemo(() => {
    const inCatalog = new Set(CATALOG.map((c) => c.id));
    return Object.values(DATA_SOURCES).filter(
      (s) => !inCatalog.has(s.id) && s.id !== "takeover",
    );
  }, []);

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <PageHeader
          tenantCount={tenantsQ.data?.length ?? 0}
          actionCount={axonActions.length}
          monitorCount={MONITORS.length}
          connectorCount={connectorMatrix.filter((c) => c.row).length}
        />

        <Section
          icon={Layers}
          title="Architecture"
          subtitle="Three-tier system at a glance"
          defaultOpen
        >
          <ArchitectureDiagram />
        </Section>

        <Section
          icon={Plug}
          title="Connectors"
          subtitle={`${connectorMatrix.filter((c) => c.row).length} of ${CATALOG.length} catalog entries are connected · ${unifiedOnly.length} registered in unified pattern but no schema yet`}
          defaultOpen
        >
          <ConnectorsMatrix
            matrix={connectorMatrix}
            unifiedOnly={unifiedOnly}
          />
        </Section>

        <Section
          icon={Cpu}
          title="AXON Registry"
          subtitle={`${axonActions.length} actions across ${actionsByCategory.length} categories · ${MONITORS.length} background monitors`}
        >
          <AxonRegistryView
            categories={actionsByCategory}
            monitors={MONITORS.map((m) => ({
              id: m.id,
              label: m.label,
              intervalMs: m.intervalMs,
              description: m.description,
            }))}
          />
        </Section>

        <Section
          icon={Users}
          title="Tenants"
          subtitle={`${tenantsQ.data?.length ?? 0} companies on TakeOver`}
        >
          <TenantsList
            tenants={tenantsQ.data ?? []}
            isLoading={tenantsQ.isLoading}
            isError={!!tenantsQ.error}
            onRefresh={() => tenantsQ.refetch()}
          />
        </Section>

        <Section
          icon={GitBranch}
          title="Releases & Per-Tenant Versioning"
          subtitle="Proposal — not yet shipped"
        >
          <ReleasesProposal />
        </Section>

        <Section
          icon={Shield}
          title="Health & Outstanding"
          subtitle="Known issues, pending work, recent monitor fires"
        >
          <HealthSection />
        </Section>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────

function PageHeader({
  tenantCount,
  actionCount,
  monitorCount,
  connectorCount,
}: {
  tenantCount: number;
  actionCount: number;
  monitorCount: number;
  connectorCount: number;
}) {
  return (
    <header className="mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary mb-1.5">
            CodeWithAli · Internal Admin
          </p>
          <h1 className="text-[26px] font-bold text-foreground leading-tight">
            TakeOver Infrastructure
          </h1>
          <p className="text-[13px] text-text-secondary mt-1">
            Live state of the system across every tenant we sell to. Architecture, connectors, AXON, releases.
          </p>
        </div>
      </div>
      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Tenants" value={tenantCount.toString()} />
        <StatCard icon={Plug} label="Connectors live" value={connectorCount.toString()} />
        <StatCard icon={Zap} label="AXON actions" value={actionCount.toString()} />
        <StatCard icon={Eye} label="Monitors" value={monitorCount.toString()} />
      </div>
    </header>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.03] px-4 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-foreground/70" />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          {label}
        </span>
      </div>
      <p className="text-[20px] font-semibold tabular-nums text-foreground leading-tight">
        {value}
      </p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-3 rounded-2xl border-xs border-border-soft bg-foreground/[0.02]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-foreground/[0.03] transition-colors rounded-2xl"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
        )}
        <Icon size={14} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
          <p className="text-[11.5px] text-text-tertiary truncate">{subtitle}</p>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

// ────────────────────────────────────────────────
// Architecture diagram — three-tier visual
// ────────────────────────────────────────────────

function ArchitectureDiagram() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <TierCard
          tier="Tier 1 · Desktop"
          icon={Cpu}
          name="CWA-TakeOver"
          tech="Tauri 2 · React 19 · Vite · TanStack Router"
          notes="The product. 58 routes, 310 components, lazy-loaded."
        />
        <TierCard
          tier="Tier 2 · Proxy"
          icon={ServerCog}
          name="Takeover_B2B"
          tech="Next.js 15 · Vercel · TS · Tailwind"
          notes="Marketing site + server proxy for connectors where the desktop can't call directly (Gmail, Slack, Stripe)."
        />
        <TierCard
          tier="Tier 3 · Data"
          icon={Database}
          name="Supabase × N+1"
          tech="One central project + one per-tenant project per company"
          notes="Central holds identity + connectors + Capital Plan; per-tenant holds chat, tasks, meetings, Gmail tokens."
        />
      </div>
      <FlowDiagram />
    </div>
  );
}

function TierCard({
  tier,
  icon: Icon,
  name,
  tech,
  notes,
}: {
  tier: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  name: string;
  tech: string;
  notes: string;
}) {
  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.03] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className="text-primary" />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
          {tier}
        </span>
      </div>
      <p className="text-[14px] font-bold text-foreground leading-tight mb-0.5">
        {name}
      </p>
      <p className="text-[10.5px] font-mono text-text-tertiary mb-2">{tech}</p>
      <p className="text-[11.5px] text-text-secondary leading-relaxed">
        {notes}
      </p>
    </div>
  );
}

function FlowDiagram() {
  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-tertiary mb-3">
        Data flow
      </p>
      <pre className="text-[10.5px] font-mono text-foreground/85 leading-relaxed overflow-x-auto whitespace-pre">
{`Operator's keystroke / voice
        │
        ▼
┌─────────────────────┐    direct HTTPS for some           ┌─────────────────┐
│  Tauri webview      │ ───── (Airtable, Linear,  ─────►  │  Provider API   │
│  · lib/<provider>.ts│        Vercel, GitHub,             │  (CORS-friendly)│
│  · stores/* hooks   │        Cal.com, Notion)            └─────────────────┘
│  · AXON registry    │
└─────┬───────────────┘
      │ proxy hop for some
      │ (Gmail, Slack, Stripe)
      ▼
┌─────────────────────┐    server-side fetch              ┌─────────────────┐
│  takeover-B2B       │ ─────────────────────────────►   │  Provider API   │
│  · /api/<x>/proxy   │                                   │  (token-bearing)│
│  · supabaseAdmin    │                                   └─────────────────┘
└─────┬───────────────┘
      │ tenant resolution
      │ via _companydb_secret_key
      ▼
┌─────────────────────┐
│  Per-tenant DB      │  ← gmail_connections, cwa_chat,
│  (one per company)  │    cwa_todos, cwa_meetings, ...
└─────────────────────┘

┌─────────────────────┐
│  Central DB         │  ← takeover_companies (registry),
│                     │    connectors, app_users, capital_*
└─────────────────────┘`}
      </pre>
    </div>
  );
}

// ────────────────────────────────────────────────
// Connectors matrix — live status
// ────────────────────────────────────────────────

function ConnectorsMatrix({
  matrix,
  unifiedOnly,
}: {
  matrix: Array<
    (typeof CATALOG)[number] & {
      row?: { id: number; kind: string; status: string; last_synced_at: string | null; company: string | null };
      inUnified: boolean;
    }
  >;
  unifiedOnly: Array<(typeof DATA_SOURCES)[string]>;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[11.5px] text-text-secondary leading-relaxed">
        Live state of every connector in the catalog. Rows with a colored source badge are wired in our unified domain registry; rows without it have credentials saved but no provider-neutral aggregation yet.
      </p>
      <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary/80 border-b border-xs border-border/10">
          <div className="col-span-3">Connector</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Tier</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Last synced</div>
        </div>
        <div className="divide-y divide-border/10">
          {matrix.map((c) => (
            <ConnectorRow key={c.id} c={c} />
          ))}
        </div>
      </div>

      {unifiedOnly.length > 0 && (
        <div className="rounded-xl border-xs border-dashed border-border-soft bg-foreground/[0.02] p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary mb-2">
            Pre-registered in unified pattern · no catalog schema yet
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unifiedOnly.map((s) => (
              <SourceBadge key={s.id} source={s.id} size="sm" />
            ))}
          </div>
          <p className="text-[11px] text-text-tertiary mt-2 leading-relaxed">
            Each of these has a slot reserved in `lib/unified/types.ts` and ready stub adapters in the relevant domain file. Add a catalog schema + verify and they light up immediately.
          </p>
        </div>
      )}
    </div>
  );
}

function ConnectorRow({
  c,
}: {
  c: (typeof CATALOG)[number] & {
    row?: { id: number; kind: string; status: string; last_synced_at: string | null; company: string | null };
    inUnified: boolean;
  };
}) {
  const isConnected = c.row?.status === "connected";
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-foreground/[0.03] transition-colors">
      <div className="col-span-12 md:col-span-3 flex items-center gap-2 min-w-0">
        {c.inUnified ? (
          <SourceBadge source={c.id} size="sm" variant="dot" />
        ) : (
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground/[0.12] border border-border-soft shrink-0" />
        )}
        <span className="text-[12.5px] font-semibold text-foreground truncate">
          {c.name}
        </span>
      </div>
      <div className="col-span-6 md:col-span-2 text-[11px] text-text-secondary truncate">
        {c.category}
      </div>
      <div className="col-span-6 md:col-span-2">
        <TierBadge tier={c.tier} />
      </div>
      <div className="col-span-6 md:col-span-2">
        {isConnected ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-success/30 bg-success/12 text-[9.5px] font-bold uppercase tracking-[0.12em] text-success">
            <CheckCircle2 className="h-2.5 w-2.5" /> Connected
          </span>
        ) : c.row ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-warning/30 bg-warning/12 text-[9.5px] font-bold uppercase tracking-[0.12em] text-warning">
            <AlertCircle className="h-2.5 w-2.5" /> {c.row.status}
          </span>
        ) : (
          <span className="text-[10.5px] text-text-tertiary">—</span>
        )}
      </div>
      <div className="col-span-6 md:col-span-3 text-[10.5px] tabular-nums text-text-tertiary">
        {c.row?.last_synced_at
          ? new Date(c.row.last_synced_at).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "—"}
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: "Easy" | "Medium" | "Hard" }) {
  const cls =
    tier === "Easy"
      ? "text-success bg-success/12 border-success/30"
      : tier === "Medium"
      ? "text-warning bg-warning/12 border-warning/30"
      : "text-destructive bg-destructive/12 border-destructive/30";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[9.5px] font-bold uppercase tracking-[0.12em] ${cls}`}
    >
      {tier}
    </span>
  );
}

// ────────────────────────────────────────────────
// AXON registry view
// ────────────────────────────────────────────────

function AxonRegistryView({
  categories,
  monitors,
}: {
  categories: ReadonlyArray<readonly [string, string[]]>;
  monitors: Array<{ id: string; label: string; intervalMs: number; description: string }>;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary mb-2 flex items-center gap-2">
          <Zap className="h-3 w-3" />
          Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {categories.map(([cat, names]) => (
            <ActionCategory key={cat} category={cat} names={names} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary mb-2 flex items-center gap-2">
          <Eye className="h-3 w-3" />
          Monitors ({monitors.length})
        </h3>
        <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] divide-y divide-border/10">
          {monitors.map((m) => (
            <div key={m.id} className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[12.5px] font-semibold text-foreground truncate">
                    {m.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-text-tertiary shrink-0">
                  every {formatInterval(m.intervalMs)}
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary pl-5 leading-relaxed">
                {m.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionCategory({
  category,
  names,
}: {
  category: string;
  names: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border-xs border-border-soft bg-foreground/[0.03] p-2.5">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <span className="text-[12px] font-semibold text-foreground">
          {category}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-text-tertiary">
          {names.length}
        </span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden mt-1.5 space-y-0.5"
          >
            {names.map((n) => (
              <li key={n} className="text-[10.5px] font-mono text-text-tertiary leading-tight">
                · {n}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────
// Tenants list
// ────────────────────────────────────────────────

function TenantsList({
  tenants,
  isLoading,
  isError,
  onRefresh,
}: {
  tenants: TenantRow[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11.5px] text-text-secondary">
          Every company on TakeOver. Click any row for full config + management.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] text-[10.5px] font-semibold text-foreground/85 transition-colors disabled:opacity-50"
        >
          <RotateCw className={`h-2.5 w-2.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      {isError && (
        <div className="rounded-xl border-xs border-warning/30 bg-warning/[0.05] px-3 py-2 flex items-start gap-2">
          <AlertCircle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
          <span className="text-[11.5px] text-warning">
            Couldn't read takeover_companies — likely an RLS gate. Use service-role via the proxy for cross-tenant ops.
          </span>
        </div>
      )}
      <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] divide-y divide-border/10">
        {isLoading && tenants.length === 0 ? (
          <div className="px-4 py-4 flex items-center gap-2 text-[12px] text-text-tertiary">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading tenants…
          </div>
        ) : tenants.length === 0 ? (
          <div className="px-4 py-4 text-[12px] text-text-tertiary italic">
            No tenants visible. Either none provisioned yet or RLS is hiding them from this session.
          </div>
        ) : (
          tenants.map((t) => <TenantRowCmp key={t.company_name} tenant={t} />)
        )}
      </div>
    </div>
  );
}

function TenantRowCmp({ tenant }: { tenant: TenantRow }) {
  const hasServiceRole = !!tenant._companydb_secret_key?.length;
  const hasUrl = !!tenant.companydb_url?.length;
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 items-center">
      <div className="col-span-12 md:col-span-3 min-w-0">
        <p className="text-[12.5px] font-bold text-foreground truncate">
          {tenant.display_name || tenant.company_name}
        </p>
        <p className="text-[10.5px] font-mono text-text-tertiary truncate">
          {tenant.company_name}
        </p>
      </div>
      <div className="col-span-6 md:col-span-3 text-[11px] text-text-secondary truncate">
        {tenant.companydb_url ? (
          <span className="inline-flex items-center gap-1">
            <Server className="h-2.5 w-2.5" />
            {new URL(tenant.companydb_url).host.replace(".supabase.co", "")}
          </span>
        ) : (
          <span className="text-text-tertiary italic">no project URL</span>
        )}
      </div>
      <div className="col-span-6 md:col-span-2">
        {hasServiceRole ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-success/30 bg-success/12 text-[9.5px] font-bold uppercase tracking-[0.12em] text-success">
            <Shield className="h-2.5 w-2.5" /> Service-role
          </span>
        ) : hasUrl ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-warning/30 bg-warning/12 text-[9.5px] font-bold uppercase tracking-[0.12em] text-warning">
            <AlertTriangle className="h-2.5 w-2.5" /> Pub-key only
          </span>
        ) : (
          <span className="text-[10.5px] text-text-tertiary">—</span>
        )}
      </div>
      <div className="col-span-6 md:col-span-2 text-[10.5px] tabular-nums text-text-tertiary">
        {tenant.created_at
          ? new Date(tenant.created_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "—"}
      </div>
      <div className="col-span-12 md:col-span-2 flex md:justify-end">
        <span className="text-[10px] font-mono text-text-tertiary italic">
          (management UI coming)
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Releases proposal
// ────────────────────────────────────────────────

function ReleasesProposal() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border-xs border-primary/25 bg-primary/[0.05] px-4 py-3 flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-[12px] font-semibold text-primary">
            Proposed: per-tenant variant versioning
          </p>
          <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
            Every customer company runs their own TakeOver variant — own feature flag set, own theme/branding, own update channel. Like git branches with their own release cadence. Needed before tenant #3 onboards.
          </p>
        </div>
      </div>

      <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary mb-3">
          New tables (sketch)
        </p>
        <pre className="text-[10px] font-mono text-foreground/85 leading-relaxed overflow-x-auto whitespace-pre">
{`takeover_releases
  · version           ('v1.5.0')
  · channel           ('stable' | 'beta' | 'alpha')
  · changelog_md
  · required_flags    text[]
  · removed_flags     text[]
  · migration_up      script reference
  · migration_down    script reference

takeover_companies (extended)
  · current_release    → releases.version
  · target_release     → releases.version
  · update_channel     ('stable' | 'beta' | 'pinned')
  · feature_flags      jsonb
  · disabled_modules   text[]
  · theme_overrides    jsonb
  · branding           jsonb

takeover_tenant_release_history
  · from_version → to_version
  · applied_at + applied_by
  · rollback_of    (chain rollbacks together)`}
        </pre>
      </div>

      <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-tertiary mb-2">
          Demo-day relevance
        </p>
        <p className="text-[11.5px] text-text-secondary leading-relaxed">
          Not blocking demo. Becomes blocking the day after we sign a paying customer who wants something different from CodeWithAli or Simplicity. Plan to ship in the first sprint post-demo.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Health section
// ────────────────────────────────────────────────

function HealthSection() {
  const items: Array<{
    title: string;
    severity: "low" | "med" | "high";
    note: string;
  }> = [
    {
      title: "Voice STT: service-not-allowed on macOS",
      severity: "high",
      note: "task #67 · blocks voice demo, web-speech API needs OS permission grant",
    },
    {
      title: "Personality composer at 4631 chars (target <2400)",
      severity: "low",
      note: "task #70 · works but bloated, eats tokens on every call",
    },
    {
      title: "capital_advise still rule-based, not model-backed",
      severity: "med",
      note: "task #64 · works for runway/stale-investor cases, lacks reasoning over novel queries",
    },
    {
      title: "Per-user Slack OAuth (xoxp) for 'post as me'",
      severity: "low",
      note: "task #87 · post-demo, current bot model is fine",
    },
    {
      title: "Gmail RLS bug fix awaiting Hanif deploy",
      severity: "med",
      note: "tenantResolver.ts now selects _companydb_secret_key — needs to land on prod",
    },
  ];

  return (
    <div className="rounded-xl border-xs border-border-soft bg-foreground/[0.02] divide-y divide-border/10">
      {items.map((it) => (
        <HealthRow key={it.title} {...it} />
      ))}
    </div>
  );
}

function HealthRow({
  title,
  severity,
  note,
}: {
  title: string;
  severity: "low" | "med" | "high";
  note: string;
}) {
  const sev =
    severity === "high"
      ? { Icon: Flame, cls: "text-destructive" }
      : severity === "med"
      ? { Icon: AlertTriangle, cls: "text-warning" }
      : { Icon: Network, cls: "text-text-tertiary" };
  const Icon = sev.Icon;
  return (
    <div className="px-4 py-2.5 flex items-start gap-2.5">
      <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${sev.cls}`} />
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-text-tertiary mt-0.5 leading-relaxed">
          {note}
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  navigation: "Navigation",
  company: "Company switching",
  tasks: "Tasks",
  data: "Data ops",
  briefing: "Briefings",
  announcements: "Announcements",
  automations: "Automations",
  meetings: "Meetings (native)",
  meetings_today: "Unified meetings",
  meetings_upcoming: "Unified meetings",
  dom: "DOM control",
  routines: "Routines",
  memory: "Memory",
  trust: "Trust + permissions",
  chat: "Chat",
  undo: "Undo",
  ceo: "CEO powers",
  cwa: "CWA registry",
  help: "Help",
  call: "Calls",
  credentials: "Credentials",
  outbound: "Outbound",
  ingest: "Ingest",
  workflow: "Workflows",
  journal: "Journal",
  voice: "Voice",
  voiceauth: "Voice auth",
  code: "Code module",
  projects: "Projects",
  agent: "Agent meta",
  ensemble: "Ensemble",
  recruiting: "Recruiting",
  onboarding: "Onboarding",
  sleep: "Sleep",
  theme: "Theme",
  shifts: "Shifts",
  workspace: "Workspace docs",
  capital: "Capital plan",
  list: "Connectors meta",
  airtable: "Airtable",
  github: "GitHub",
  notion: "Notion",
  slack: "Slack",
  linear: "Linear",
  vercel: "Vercel",
  calcom: "Cal.com",
  finance: "Unified finance",
  stripe: "Stripe (legacy verbs)",
  crm: "CRM",
  log: "CRM log",
  find: "CRM find",
  create: "CRM create",
  move: "CRM move",
  summarize: "CRM summarize",
  force: "Sleep / wake",
  wake: "Sleep / wake",
  set: "Theme set",
  toggle: "Theme toggle",
  clock: "Shifts",
  request: "Shifts",
  claim: "Shifts",
  suggest: "Routines",
  apply: "Routines",
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatInterval(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.round(ms / 3_600_000)}h`;
}

// Decorative imports silencer
void Globe;
void Box;

export default InfrastructurePage;
