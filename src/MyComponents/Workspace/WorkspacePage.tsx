/**
 * WorkspacePage.tsx — Landing page for /workspace.
 *
 * Three-zone layout:
 *   · Header — title, "New doc" / "New sheet" buttons, search.
 *   · Tabs   — All / Docs / Sheets (filters the resource list).
 *   · Grid   — Cards for each resource, click → detail route.
 *
 * Editorial dark aesthetic to match the rest of Takeover. The whole
 * page lives inside a max-w container so wide screens don't sprawl.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  FileText, Sheet, Plus, Search, Lock, Globe, Loader2, Archive,
} from "lucide-react";
import {
  useWorkspaceResources,
  useCreateDocument,
  useCreateSpreadsheet,
  useWorkspaceRealtime,
} from "@/stores/workspace";
import type { WorkspaceResource } from "@/stores/workspaceTypes";
import { ActiveUser } from "@/stores/query";

type TabId = "all" | "documents" | "spreadsheets";

export function WorkspacePage() {
  const navigate = useNavigate();
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const username: string = me?.username ?? "";

  // Single realtime subscription for the workspace tables.
  useWorkspaceRealtime();

  const { data: resources = [], isLoading } = useWorkspaceResources();
  const createDoc = useCreateDocument();
  const createSheet = useCreateSpreadsheet();

  const [tab, setTab] = useState<TabId>("all");
  const [filter, setFilter] = useState("");

  const filtered = useMemo<WorkspaceResource[]>(() => {
    const byTab = resources.filter((r) => {
      if (tab === "documents") return r.kind === "document";
      if (tab === "spreadsheets") return r.kind === "spreadsheet";
      return true;
    });
    const q = filter.trim().toLowerCase();
    if (!q) return byTab;
    return byTab.filter((r) => r.title.toLowerCase().includes(q));
  }, [resources, tab, filter]);

  const counts = useMemo(() => {
    return {
      all: resources.length,
      documents: resources.filter((r) => r.kind === "document").length,
      spreadsheets: resources.filter((r) => r.kind === "spreadsheet").length,
    };
  }, [resources]);

  const handleNewDoc = async () => {
    if (!username) return;
    const created = await createDoc.mutateAsync({ owner: username });
    navigate({ to: "/workspace/docs/$id", params: { id: created.id } });
  };

  const handleNewSheet = async () => {
    if (!username) return;
    const created = await createSheet.mutateAsync({ owner: username });
    navigate({ to: "/workspace/sheets/$id", params: { id: created.id } });
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-[1200px] px-8 py-10">
        {/* ── Header ───────────────────────────────────────────── */}
        <header className="mb-8">
          <div className="text-[10px] tracking-[0.16em] uppercase text-foreground/40 mb-2">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
            Workspace
          </div>
          <h1 className="text-[28px] font-bold leading-tight text-foreground">
            Docs &amp; Sheets
          </h1>
          <p className="text-[13.5px] text-foreground/55 mt-1.5 max-w-[60ch]">
            Write documents, build spreadsheets, share with teammates. Everything
            here is real-time and lives next to your other Takeover surfaces.
          </p>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={handleNewDoc}
              disabled={createDoc.isPending || !username}
              className="inline-flex items-center gap-2 px-3.5 h-9 rounded-sm bg-primary text-primary-foreground text-[12px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {createDoc.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <FileText size={13} />
              )}
              New document
            </button>
            <button
              type="button"
              onClick={handleNewSheet}
              disabled={createSheet.isPending || !username}
              className="inline-flex items-center gap-2 px-3.5 h-9 rounded-sm border border-border bg-secondary text-foreground text-[12px] font-bold uppercase tracking-wider hover:bg-muted transition-colors disabled:opacity-40"
            >
              {createSheet.isPending ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Sheet size={13} />
              )}
              New spreadsheet
            </button>

            <div className="relative ml-auto w-full sm:w-[280px]">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/35"
              />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by title…"
                className="w-full h-9 pl-8 pr-2 rounded-sm bg-muted/30 border border-border/60 text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/30 transition-colors"
              />
            </div>
          </div>
        </header>

        {/* ── Tab strip ───────────────────────────────────────── */}
        <div className="flex items-center gap-1 border-b border-border/60 mb-6">
          <Tab
            label="All"
            count={counts.all}
            active={tab === "all"}
            onClick={() => setTab("all")}
          />
          <Tab
            label="Documents"
            count={counts.documents}
            active={tab === "documents"}
            onClick={() => setTab("documents")}
          />
          <Tab
            label="Spreadsheets"
            count={counts.spreadsheets}
            active={tab === "spreadsheets"}
            onClick={() => setTab("spreadsheets")}
          />
        </div>

        {/* ── Grid ────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-foreground/40 text-[13px]">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading workspace…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            filtered={!!filter}
            onNewDoc={handleNewDoc}
            onNewSheet={handleNewSheet}
          />
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((r) => (
              <ResourceCard
                key={`${r.kind}-${r.id}`}
                resource={r}
                onOpen={() => {
                  if (r.kind === "document") {
                    navigate({ to: "/workspace/docs/$id", params: { id: r.id } });
                  } else {
                    navigate({ to: "/workspace/sheets/$id", params: { id: r.id } });
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Tab — editorial pill with count badge.
// ──────────────────────────────────────────────────────────────────
function Tab({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative px-4 h-9 text-[12px] font-bold uppercase tracking-wider transition-colors inline-flex items-center gap-2 " +
        (active
          ? "text-foreground"
          : "text-foreground/45 hover:text-foreground/70")
      }
    >
      {label}
      <span
        className={
          "font-mono tabular-nums text-[10.5px] " +
          (active ? "text-foreground/55" : "text-foreground/30")
        }
      >
        {count}
      </span>
      {active && (
        <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-primary" />
      )}
    </button>
  );
}

// ──────────────────────────────────────────────────────────────────
// ResourceCard — one entry in the grid.
// ──────────────────────────────────────────────────────────────────
function ResourceCard({
  resource,
  onOpen,
}: {
  resource: WorkspaceResource;
  onOpen: () => void;
}) {
  const isDoc = resource.kind === "document";
  const Icon = isDoc ? FileText : Sheet;
  const accent = isDoc ? "text-sky-400" : "text-emerald-400";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group w-full text-left rounded-sm border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-colors p-4 h-[124px] flex flex-col justify-between"
      >
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Icon size={13} className={accent + " flex-shrink-0"} />
              <span className="text-[10px] tracking-[0.12em] uppercase text-foreground/40">
                {isDoc ? "Document" : "Spreadsheet"}
              </span>
            </div>
            {resource.visibility === "shared" ? (
              <Globe size={11} className="text-emerald-400/80 flex-shrink-0" />
            ) : (
              <Lock size={11} className="text-foreground/30 flex-shrink-0" />
            )}
          </div>
          <div className="mt-2 text-[14px] font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {resource.title || "Untitled"}
          </div>
        </div>
        <div className="text-[10.5px] text-foreground/45 flex items-center justify-between">
          <span>
            {resource.updated_by ?? resource.owner}
          </span>
          <span className="font-mono tabular-nums text-foreground/35">
            {formatRelative(resource.updated_at)}
          </span>
        </div>
      </button>
    </li>
  );
}

// ──────────────────────────────────────────────────────────────────
// EmptyState — "you have nothing yet" CTA.
// ──────────────────────────────────────────────────────────────────
function EmptyState({
  filtered,
  onNewDoc,
  onNewSheet,
}: {
  filtered: boolean;
  onNewDoc: () => void;
  onNewSheet: () => void;
}) {
  if (filtered) {
    return (
      <div className="py-16 text-center text-[13px] text-foreground/55">
        <Archive size={20} className="mx-auto mb-3 text-foreground/35" />
        Nothing matches that filter.
      </div>
    );
  }
  return (
    <div className="rounded-sm border border-dashed border-border bg-card/40 px-8 py-12 text-center max-w-md mx-auto">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="h-12 w-12 rounded-sm bg-sky-500/10 border border-sky-500/25 flex items-center justify-center">
          <FileText className="h-5 w-5 text-sky-300" />
        </div>
        <div className="h-12 w-12 rounded-sm bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center">
          <Sheet className="h-5 w-5 text-emerald-300" />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-foreground mb-1">
        Start your first workspace
      </p>
      <p className="text-[12.5px] text-foreground/55 mb-5">
        Documents are for prose and structured notes. Spreadsheets are for
        tables, formulas, and any tabular data you'd otherwise paste into Excel.
      </p>
      <div className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={onNewDoc}
          className="px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90"
        >
          New document
        </button>
        <button
          type="button"
          onClick={onNewSheet}
          className="px-3 h-8 rounded-sm border border-border bg-secondary text-foreground text-[11.5px] font-bold uppercase tracking-wider hover:bg-muted"
        >
          New spreadsheet
        </button>
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
