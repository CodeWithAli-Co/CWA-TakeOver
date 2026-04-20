/**
 * RegistryDashboard — three-pane layout:
 *   · Top bar: search, kind filter, company chip, "Publish" button
 *   · Gallery: card grid of registry items
 *   · Detail drawer: right-side panel with versions, code, install
 *
 * No role gating. The CEO and all authenticated users have full
 * access. Company chip is soft-scoped via the existing
 * useCompanyFilter store — "all" shows everything.
 */

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Package, Search, Plus, Layers, Component as CompIcon, Sparkles, Building2, Globe2, Key } from "lucide-react";
import { useCompanyFilter } from "@/stores/store";
import { ActiveUser } from "@/stores/query";
import { useRegistryItems } from "./queries";
import { RegistryItemCard } from "./RegistryItemCard";
import { RegistryDetailDrawer } from "./RegistryDetailDrawer";
import { RegistryPublishModal } from "./RegistryPublishModal";
import { CliTokensCard } from "./CliTokensCard";
import type { RegistryKind, RegistryCompany, RegistryItemWithLatest } from "./types";

const KIND_TABS: { key: "all" | RegistryKind; label: string; Icon: typeof Package }[] = [
  { key: "all", label: "All", Icon: Layers },
  { key: "component", label: "Components", Icon: CompIcon },
  { key: "template", label: "Templates", Icon: Package },
];

// Map the app-level CompanyFilter to registry_items.company enum.
// "all" + "codeWithAli" + "simplicityFunds" → "all" / "cwa" / "simplicity".
function mapCompany(c: ReturnType<typeof useCompanyFilter>["activeCompany"]): RegistryCompany | "all" {
  if (c === "codeWithAli") return "cwa";
  if (c === "simplicityFunds") return "simplicity";
  return "all";
}

export function RegistryDashboard() {
  const activeCompany = useCompanyFilter((s) => s.activeCompany);
  const { data: me } = ActiveUser();
  const username = me?.[0]?.username || "";

  const [kind, setKind] = useState<"all" | RegistryKind>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<RegistryItemWithLatest | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [view, setView] = useState<"registry" | "tokens">("registry");

  const companyScope = mapCompany(activeCompany);

  const { data: items = [], isLoading } = useRegistryItems({
    kind: kind === "all" ? undefined : kind,
    company: companyScope,
    search,
  });

  const counts = useMemo(() => {
    const c = { component: 0, template: 0 };
    for (const i of items) {
      if (i.kind === "component") c.component += 1;
      else c.template += 1;
    }
    return c;
  }, [items]);

  return (
    <div className="relative flex h-full w-full flex-col bg-background">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-border/60 bg-gradient-to-b from-background to-background/80 px-6 py-5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-300 ring-1 ring-inset ring-white/10">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[17px] font-semibold text-foreground tracking-tight">
                Component Registry
              </h1>
              <p className="text-[12px] text-muted-foreground leading-snug">
                Components + templates for CWA and Simplicity.
                {" · "}
                <span className="font-medium text-foreground/75">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
                {counts.component > 0 && (
                  <span className="text-muted-foreground">
                    {" — "}{counts.component} comp · {counts.template} tmpl
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
              <button
                type="button"
                onClick={() => setView("registry")}
                className={[
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  view === "registry"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Package className="h-3 w-3" />
                Registry
              </button>
              <button
                type="button"
                onClick={() => setView("tokens")}
                className={[
                  "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                  view === "tokens"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <Key className="h-3 w-3" />
                CLI Tokens
              </button>
            </div>
            <CompanyChip company={companyScope} />
            {view === "registry" && (
              <button
                type="button"
                onClick={() => setPublishOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-blue-500 to-blue-600 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-[0_4px_14px_-2px_hsl(210_90%_55%/0.4)] ring-1 ring-inset ring-white/15 hover:from-blue-400 hover:to-blue-500 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                Publish
              </button>
            )}
          </div>
        </div>

        {/* Filter row — hidden in tokens view */}
        {view === "registry" && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px] max-w-[420px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search components + templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-muted/40 pl-8 pr-3 text-[12.5px] outline-none ring-0 placeholder:text-muted-foreground/60 focus:border-primary/50 focus:bg-muted/60 transition-colors"
            />
          </div>

          {/* Kind tabs */}
          <div className="flex items-center gap-0.5 rounded-md border border-border bg-muted/30 p-0.5">
            {KIND_TABS.map(({ key, label, Icon }) => {
              const on = kind === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setKind(key)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                    on
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        )}
      </header>

      {/* Body */}
      <main className="relative flex-1 overflow-y-auto px-6 py-6">
        {view === "tokens" ? (
          <div className="mx-auto max-w-3xl">
            <CliTokensCard />
          </div>
        ) : isLoading ? (
          <GallerySkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            search={search}
            kind={kind}
            onPublish={() => setPublishOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
              <RegistryItemCard
                key={item.id}
                item={item}
                onClick={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <RegistryDetailDrawer
            key={selected.id}
            item={selected}
            onClose={() => setSelected(null)}
            username={username}
          />
        )}
      </AnimatePresence>

      {/* Publish modal */}
      <RegistryPublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        defaultCompany={companyScope === "all" ? "shared" : companyScope}
        username={username}
      />
    </div>
  );
}

// ── Company chip ──────────────────────────────────────────────
function CompanyChip({ company }: { company: RegistryCompany | "all" }) {
  const spec = company === "cwa"
    ? { label: "CWA", Icon: Building2, className: "text-red-300 bg-red-500/10 border-red-500/30" }
    : company === "simplicity"
    ? { label: "Simplicity", Icon: Building2, className: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" }
    : { label: "All companies", Icon: Globe2, className: "text-blue-300 bg-blue-500/10 border-blue-500/30" };
  const Icon = spec.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${spec.className}`}
      title="Scope driven by the active-company switcher in the sidebar"
    >
      <Icon className="h-3 w-3" />
      {spec.label}
    </span>
  );
}

// ── Empty state ──────────────────────────────────────────────
function EmptyState({
  search,
  kind,
  onPublish,
}: {
  search: string;
  kind: "all" | RegistryKind;
  onPublish: () => void;
}) {
  const filtered = search.length > 0 || kind !== "all";
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-muted/10 py-12">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/15 to-purple-500/15 ring-1 ring-inset ring-white/10">
        <Sparkles className="h-6 w-6 text-blue-300/80" />
      </div>
      <div className="text-center">
        <h3 className="text-[14px] font-semibold text-foreground">
          {filtered ? "No matches" : "Nothing here yet"}
        </h3>
        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground leading-snug">
          {filtered
            ? "Try clearing the search or the kind filter."
            : "Publish your first component or template to populate the registry. The CLI will pick it up automatically."}
        </p>
      </div>
      {!filtered && (
        <button
          type="button"
          onClick={onPublish}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-blue-500 to-blue-600 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm ring-1 ring-inset ring-white/15 hover:from-blue-400 hover:to-blue-500 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          Publish first item
        </button>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────
function GallerySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="h-[200px] rounded-xl border border-border/50 bg-muted/20"
        />
      ))}
    </div>
  );
}
