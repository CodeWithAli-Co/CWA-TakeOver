/**
 * BugReportsInbox.tsx — Jira-style triage view for bug reports.
 *
 * Layout: full-width sortable table → click a row → editorial
 * detail panel slides in from the right. Stays out of the way
 * for triage-at-scale, gives full context on a single click.
 *
 * Features beyond a plain list:
 *   · Sortable columns (created_at default, severity, status,
 *     reporter, area)
 *   · Bulk actions — checkbox column + an action bar that
 *     appears once 1+ rows are selected, lets admins move many
 *     bugs to a status in one shot.
 *   · Density toggle — comfortable vs compact row height.
 *   · Filter dropdowns for status, severity, area in the
 *     toolbar (chip-style, coloured when narrowed).
 *   · Slide-over detail panel reuses all the editorial sections
 *     from the previous detail pane (diagnostics, screenshot,
 *     repro, triage controls).
 */

import { useEffect, useMemo, useState } from "react";
import {
  Bug, Loader2, AlertCircle, Check,
  Clock, Image as ImageIcon, ChevronDown, Globe, Wifi, Terminal,
  Save, ArrowUp, ArrowDown,
} from "lucide-react";
import { takeOversupabase } from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { SlideOver } from "./shared/SlideOver";
import { InboxToolbar, type Density } from "./shared/InboxToolbar";

// ── Types ───────────────────────────────────────────────────────

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "in_progress" | "resolved" | "wontfix";
type Area =
  | "chat" | "huddle" | "onboarding" | "hiring"
  | "reports" | "tasks" | "axon" | "other";

interface BugReport {
  id: string;
  created_at: string;
  updated_at: string;
  reporter_username: string;
  reporter_role: string | null;
  reporter_email: string | null;
  title: string;
  description: string;
  severity: Severity;
  area: Area;
  status: Status;
  triaged_by: string | null;
  triaged_at: string | null;
  resolution_notes: string | null;
  page_url: string | null;
  browser_info: Record<string, unknown> | null;
  console_logs: ConsoleEntry[] | null;
  network_logs: NetworkEntry[] | null;
  screenshot_url: string | null;
  repro_steps: string | null;
  company: string | null;
}

interface ConsoleEntry {
  level: "log" | "warn" | "error" | "info" | "debug";
  ts: number;
  message: string;
}
interface NetworkEntry {
  ts: number;
  method: string;
  url: string;
  status?: number;
  ok?: boolean;
  durationMs?: number;
  error?: string;
}

// Visual encoding — single coloured rail/dot per severity, no
// fight with the rest of the table chrome.
const SEVERITY_META: Record<
  Severity,
  { label: string; rail: string; dot: string; eyebrow: string }
> = {
  low:      { label: "Low",      rail: "#71717a", dot: "bg-zinc-400",  eyebrow: "text-muted-foreground" },
  medium:   { label: "Medium",   rail: "#60a5fa", dot: "bg-blue-400",  eyebrow: "text-blue-400" },
  high:     { label: "High",     rail: "#f59e0b", dot: "bg-amber-400", eyebrow: "text-amber-400" },
  critical: { label: "Critical", rail: "#ef4444", dot: "bg-red-500",   eyebrow: "text-red-400" },
};

// Sort rank for severity → so DESC means critical first, ASC
// means low first.
const SEVERITY_RANK: Record<Severity, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

const STATUS_LABEL: Record<Status, string> = {
  open: "Open", in_progress: "Working", resolved: "Resolved", wontfix: "Won't fix",
};
const STATUS_COLOR: Record<Status, string> = {
  open: "text-primary",
  in_progress: "text-amber-400",
  resolved: "text-emerald-400",
  wontfix: "text-muted-foreground",
};

const AREA_LABEL: Record<Area, string> = {
  chat: "Chat", huddle: "Huddle", onboarding: "Onboarding",
  hiring: "Hiring", reports: "Reports", tasks: "Tasks",
  axon: "Axon", other: "Other",
};

const ADMIN_ROLES = new Set(["CEO", "COO", "CFO", "Admin", "admin"]);

// ── Sort state ──────────────────────────────────────────────────

type SortKey = "created" | "severity" | "status" | "reporter" | "area" | "title";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

interface Props {
  refreshToken?: number;
}

// ── Main component ──────────────────────────────────────────────

export function BugReportsInbox({ refreshToken }: Props = {}) {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<Status | "all">("open");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [areaFilter, setAreaFilter] = useState<Area | "all">("all");
  const [search, setSearch] = useState("");

  const [sort, setSort] = useState<SortState>({ key: "created", dir: "desc" });
  const [density, setDensity] = useState<Density>(() => {
    try {
      const v = localStorage.getItem("cwa-bug-density");
      return v === "compact" ? "compact" : "comfortable";
    } catch { return "comfortable"; }
  });
  useEffect(() => {
    try { localStorage.setItem("cwa-bug-density", density); } catch { /* noop */ }
  }, [density]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: me } = ActiveUser();
  const username = (me?.[0] as any)?.username ?? "";
  const myRole = (me?.[0] as any)?.role ?? "";
  const isAdmin = ADMIN_ROLES.has(myRole);

  const reload = async () => {
    setLoading((cur) => (reports.length === 0 ? true : cur));
    setRefreshing(true);
    setError(null);

    const { data, error: err } = await takeOversupabase
.from("bug_reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (err) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("does not exist") || (err as any).code === "42P01") {
        setError("bug_reports table isn't set up. Run migrations/bug_reports_init.sql.");
      } else {
        setError(err.message);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = (data ?? []) as BugReport[];
    const visible = isAdmin
      ? rows
      : rows.filter((r) => r.reporter_username === username);

    setReports(visible);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, isAdmin, refreshToken]);

  // Filtered + sorted view.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && r.severity !== severityFilter) return false;
      if (areaFilter !== "all" && r.area !== areaFilter) return false;
      if (q) {
        const hay = `${r.title} ${r.description} ${r.reporter_username}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "severity":
          return (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]) * sign;
        case "status":
          return a.status.localeCompare(b.status) * sign;
        case "reporter":
          return a.reporter_username.localeCompare(b.reporter_username) * sign;
        case "area":
          return a.area.localeCompare(b.area) * sign;
        case "title":
          return a.title.localeCompare(b.title) * sign;
        case "created":
        default:
          return (Date.parse(a.created_at) - Date.parse(b.created_at)) * sign;
      }
    });
  }, [reports, statusFilter, severityFilter, areaFilter, search, sort]);

  const opened = reports.find((r) => r.id === openId) ?? null;

  const hasAnyFilter =
    statusFilter !== "open" ||
    severityFilter !== "all" ||
    areaFilter !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("open");
    setSeverityFilter("all");
    setAreaFilter("all");
    setSearch("");
  };

  // Sort toggling — clicking the same key flips dir, clicking a
  // new key starts at desc (most useful default for dates +
  // severity).
  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" }
    );
  };

  // Selection helpers.
  const allSelected =
    visible.length > 0 && visible.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.map((r) => r.id)));
    }
  };
  const toggleOne = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetStatus = async (next: Status) => {
    if (!isAdmin || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const patch = {
      status: next,
      triaged_by: username || null,
      triaged_at: new Date().toISOString(),
    };
    const { error: err } = await takeOversupabase
.from("bug_reports")
      .update(patch)
      .in("id", ids);
    if (err) {
      setError(err.message);
      return;
    }
    setSelectedIds(new Set());
    reload();
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      <InboxToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, description, or reporter…"
        countLabel={`${visible.length} ${visible.length === 1 ? "bug" : "bugs"}`}
        onClearFilters={hasAnyFilter ? clearFilters : undefined}
        density={density}
        onDensityChange={setDensity}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as Status | "all"),
            options: [
              { value: "open",        label: "Open" },
              { value: "in_progress", label: "Working" },
              { value: "resolved",    label: "Resolved" },
              { value: "wontfix",     label: "Won't fix" },
              { value: "all",         label: "All statuses" },
            ],
          },
          {
            label: "Severity",
            value: severityFilter,
            onChange: (v) => setSeverityFilter(v as Severity | "all"),
            options: [
              { value: "all",      label: "All severities" },
              { value: "critical", label: "Critical" },
              { value: "high",     label: "High" },
              { value: "medium",   label: "Medium" },
              { value: "low",      label: "Low" },
            ],
          },
          {
            label: "Area",
            value: areaFilter,
            onChange: (v) => setAreaFilter(v as Area | "all"),
            options: [
              { value: "all",        label: "All areas" },
              ...((Object.keys(AREA_LABEL) as Area[]).map((a) => ({
                value: a,
                label: AREA_LABEL[a],
              }))),
            ],
          },
        ]}
      />

      {/* Bulk action bar — slides in when any rows are selected */}
      {isAdmin && selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
          onSetStatus={bulkSetStatus}
        />
      )}

      {error && (
        <div className="shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
          <p className="text-[11.5px] text-amber-200">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading && reports.length === 0 ? (
          <div className="flex items-center gap-2 p-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading bug reports…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            kind={statusFilter === "open" && !hasAnyFilter ? "zero" : "no-match"}
            onClear={hasAnyFilter ? clearFilters : undefined}
          />
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur border-b border-border">
              <tr className="text-left">
                {isAdmin && (
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 cursor-pointer accent-primary"
                      aria-label="Select all"
                    />
                  </th>
                )}
                <Th width="w-10" />
                <Th width="w-24" label="ID" sortKey="created" sort={sort} onClick={toggleSort} />
                <Th label="Title" sortKey="title" sort={sort} onClick={toggleSort} />
                <Th width="w-32" label="Reporter" sortKey="reporter" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Area" sortKey="area" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Severity" sortKey="severity" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Status" sortKey="status" sort={sort} onClick={toggleSort} />
                <Th width="w-28" label="Created" sortKey="created" sort={sort} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <BugRow
                  key={r.id}
                  report={r}
                  density={density}
                  selected={selectedIds.has(r.id)}
                  showCheckbox={isAdmin}
                  active={r.id === openId}
                  onToggleSelect={() => toggleOne(r.id)}
                  onOpen={() => setOpenId(r.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {refreshing && (
        <div className="shrink-0 border-t border-border px-5 py-1.5 text-[10.5px] text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          Refreshing…
        </div>
      )}

      {/* Slide-over detail */}
      <SlideOver
        open={!!opened}
        onClose={() => setOpenId(null)}
        title={
          opened && (
            <div>
              <p className={`flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] ${SEVERITY_META[opened.severity].eyebrow}`}>
                <Bug className="h-3 w-3" />
                {SEVERITY_META[opened.severity].label}
                <span className="opacity-50">·</span>
                <span className="text-muted-foreground/80">{AREA_LABEL[opened.area]}</span>
                <span className="opacity-50">·</span>
                <span className={`uppercase font-bold tracking-wider ${STATUS_COLOR[opened.status]}`}>
                  {STATUS_LABEL[opened.status]}
                </span>
              </p>
              <p className="mt-1 text-[14px] font-semibold tracking-tight text-foreground leading-tight truncate">
                {opened.title}
              </p>
            </div>
          )
        }
      >
        {opened && (
          <BugDetailBody
            report={opened}
            isAdmin={isAdmin}
            currentUsername={username}
            onReload={reload}
            onClose={() => setOpenId(null)}
          />
        )}
      </SlideOver>
    </div>
  );
}

// ── Table header cell ───────────────────────────────────────────

function Th({
  label, width, sortKey, sort, onClick,
}: {
  label?: string;
  width?: string;
  sortKey?: SortKey;
  sort?: SortState;
  onClick?: (k: SortKey) => void;
}) {
  if (!label) return <th className={`${width ?? ""} px-2 py-2`} />;
  const sortable = !!sortKey && !!onClick;
  const isActive = sort?.key === sortKey;
  return (
    <th className={`${width ?? ""} px-2 py-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/80`}>
      {sortable ? (
        <button
          type="button"
          onClick={() => onClick!(sortKey!)}
          className={[
            "inline-flex items-center gap-1 transition-colors",
            isActive ? "text-foreground" : "hover:text-foreground",
          ].join(" ")}
        >
          {label}
          {isActive && (sort!.dir === "asc"
            ? <ArrowUp className="h-2.5 w-2.5" />
            : <ArrowDown className="h-2.5 w-2.5" />)}
        </button>
      ) : (
        label
      )}
    </th>
  );
}

// ── Row ─────────────────────────────────────────────────────────

function BugRow({
  report, density, selected, showCheckbox, active, onToggleSelect, onOpen,
}: {
  report: BugReport;
  density: Density;
  selected: boolean;
  showCheckbox: boolean;
  active: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const sev = SEVERITY_META[report.severity];
  const py = density === "compact" ? "py-1.5" : "py-2.5";
  return (
    <tr
      onClick={onOpen}
      className={[
        "border-b border-border/40 cursor-pointer transition-colors",
        active
          ? "bg-muted/60"
          : selected
            ? "bg-primary/[0.06] hover:bg-primary/[0.10]"
            : "hover:bg-muted/30",
      ].join(" ")}
    >
      {showCheckbox && (
        <td
          className={`px-3 ${py}`}
          onClick={(e) => { e.stopPropagation(); }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-3.5 w-3.5 cursor-pointer accent-primary"
            aria-label={`Select ${report.title}`}
          />
        </td>
      )}

      {/* Severity rail cell — narrow strip + bug icon */}
      <td className={`relative px-2 ${py}`}>
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
          style={{ background: sev.rail }}
        />
        <Bug className="h-3.5 w-3.5 text-muted-foreground/80" />
      </td>

      {/* ID — short hash of UUID, monospace, like Jira's NUC-206 */}
      <td className={`px-2 ${py} font-mono text-[10.5px] text-muted-foreground tabular-nums`}>
        BUG-{report.id.slice(0, 6).toUpperCase()}
      </td>

      {/* Title */}
      <td className={`px-2 ${py} min-w-0`}>
        <span className="text-[12.5px] font-medium text-foreground tracking-tight truncate block max-w-[640px]">
          {report.title}
        </span>
      </td>

      {/* Reporter */}
      <td className={`px-2 ${py} text-foreground/90`}>
        <div className="truncate">
          {report.reporter_username}
          {report.reporter_role && (
            <span className="text-muted-foreground/70 text-[10.5px]"> · {report.reporter_role}</span>
          )}
        </div>
      </td>

      {/* Area */}
      <td className={`px-2 ${py} text-foreground/80`}>{AREA_LABEL[report.area]}</td>

      {/* Severity */}
      <td className={`px-2 ${py}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
          <span className="text-foreground/80">{sev.label}</span>
        </span>
      </td>

      {/* Status */}
      <td className={`px-2 ${py}`}>
        <span className={`uppercase font-semibold text-[10.5px] tracking-wider ${STATUS_COLOR[report.status]}`}>
          {STATUS_LABEL[report.status]}
        </span>
      </td>

      {/* Created */}
      <td className={`px-2 ${py} font-mono text-[10.5px] text-muted-foreground/80 tabular-nums`}>
        {new Date(report.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
      </td>
    </tr>
  );
}

// ── Empty state ─────────────────────────────────────────────────

function EmptyState({
  kind, onClear,
}: {
  kind: "zero" | "no-match";
  onClear?: () => void;
}) {
  if (kind === "zero") {
    return (
      <div className="flex h-full items-center justify-center p-12 text-center">
        <div>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10">
            <Check className="h-6 w-6 text-emerald-300" />
          </div>
          <p className="mt-4 text-[13px] font-semibold text-foreground tracking-tight">
            No open bugs
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
            Either nothing has been reported or the team has shipped through the open queue.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center p-12 text-center">
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/40">
          <Bug className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-foreground">No matches</p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          Adjust the filters to widen the search.
        </p>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="mt-4 inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/60 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ── Bulk action bar ─────────────────────────────────────────────

function BulkActionBar({
  count, onClear, onSetStatus,
}: {
  count: number;
  onClear: () => void;
  onSetStatus: (s: Status) => void;
}) {
  return (
    <div className="shrink-0 border-b border-border bg-primary/10 px-5 py-2 flex items-center gap-3">
      <p className="text-[11.5px] font-semibold text-foreground">
        {count} selected
      </p>
      <button
        type="button"
        onClick={onClear}
        className="text-[10.5px] font-semibold text-primary hover:text-primary/80"
      >
        Clear
      </button>
      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
          Move to
        </span>
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSetStatus(s)}
            className={[
              "rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold transition-colors hover:bg-muted/60",
              STATUS_COLOR[s],
            ].join(" ")}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Detail body (slide-over content) ────────────────────────────

function BugDetailBody({
  report, isAdmin, currentUsername, onReload, onClose,
}: {
  report: BugReport;
  isAdmin: boolean;
  currentUsername: string;
  onReload: () => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>(report.status);
  const [resolutionNotes, setResolutionNotes] = useState(report.resolution_notes ?? "");
  const [logsTab, setLogsTab] = useState<"console" | "network" | "browser">("console");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const saveTriage = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setErr(null);
    const patch: Partial<BugReport> = {
      status,
      resolution_notes: resolutionNotes.trim() || null,
      triaged_by: currentUsername || null,
      triaged_at: new Date().toISOString(),
    };
    const { error } = await takeOversupabase
.from("bug_reports")
      .update(patch)
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
    onClose();
  };

  const dirty =
    status !== report.status ||
    resolutionNotes !== (report.resolution_notes ?? "");

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Meta line */}
      <p className="text-[11.5px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-mono uppercase tracking-wider text-muted-foreground/80">
          BUG-{report.id.slice(0, 6).toUpperCase()}
        </span>
        <span className="opacity-50">·</span>
        <span>Reported by <span className="font-medium text-foreground/90">{report.reporter_username}</span></span>
        {report.reporter_role && (<><span className="opacity-50">·</span><span>{report.reporter_role}</span></>)}
        {report.reporter_email && (<><span className="opacity-50">·</span><span>{report.reporter_email}</span></>)}
        <span className="opacity-50">·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3 opacity-60" />
          {new Date(report.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </span>
      </p>

      <Section title="What happened">
        <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
          {report.description}
        </p>
      </Section>

      {report.repro_steps && (
        <Section title="Steps to reproduce">
          <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {report.repro_steps}
          </p>
        </Section>
      )}

      {report.screenshot_url && (
        <Section title="Screenshot" icon={ImageIcon}>
          <a
            href={report.screenshot_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md border border-border overflow-hidden bg-background/30 hover:border-foreground/30 transition-colors"
          >
            <img
              src={report.screenshot_url}
              alt="Reporter screenshot"
              className="w-full max-h-[420px] object-contain"
            />
          </a>
        </Section>
      )}

      {report.page_url && (
        <Section title="Page" icon={Globe}>
          <code className="block rounded-md border border-border bg-muted/40 px-3 py-2 text-[11.5px] text-foreground/85 break-all">
            {report.page_url}
          </code>
        </Section>
      )}

      <Section title="Diagnostics" icon={Terminal}>
        <div className="rounded-md border border-border bg-muted/40 overflow-hidden">
          <div className="flex border-b border-border">
            <DiagTab active={logsTab === "console"} onClick={() => setLogsTab("console")} icon={Terminal}>
              Console ({report.console_logs?.length ?? 0})
            </DiagTab>
            <DiagTab active={logsTab === "network"} onClick={() => setLogsTab("network")} icon={Wifi}>
              Network ({report.network_logs?.length ?? 0})
            </DiagTab>
            <DiagTab active={logsTab === "browser"} onClick={() => setLogsTab("browser")} icon={Globe}>
              Browser
            </DiagTab>
          </div>
          <div className="max-h-[320px] overflow-y-auto p-3 text-[11px] font-mono leading-relaxed">
            {logsTab === "console" && <ConsoleLogs entries={report.console_logs ?? []} />}
            {logsTab === "network" && <NetworkLogs entries={report.network_logs ?? []} />}
            {logsTab === "browser" && <BrowserInfo info={report.browser_info ?? {}} />}
          </div>
        </div>
      </Section>

      {report.triaged_by && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Last triaged by {report.triaged_by}
          {report.triaged_at && (
            <> · {new Date(report.triaged_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
          )}
        </p>
      )}

      {isAdmin && (
        <>
          <Section title="Resolution notes">
            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={4}
              placeholder="What was the fix, what was the workaround…"
              className="w-full resize-y rounded-md border border-border bg-muted/40 px-3 py-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/30 transition-colors leading-relaxed"
            />
            {err && (
              <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11.5px] text-red-300">
                {err}
              </p>
            )}
          </Section>

          <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-1 bg-background border-t border-border flex items-center justify-end gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">Status</span>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="appearance-none rounded-md border border-border bg-background pl-3 pr-7 py-1.5 text-[12px] font-semibold text-foreground/90 outline-none cursor-pointer hover:bg-muted/40 focus:border-foreground/30"
                >
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
            <button
              type="button"
              onClick={saveTriage}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save triage
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Subcomponents (sections, log views) ─────────────────────────

function Section({
  title, icon: Icon, children,
}: {
  title: string;
  icon?: typeof Bug;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />}
        {title}
      </p>
      {children}
    </div>
  );
}

function DiagTab({
  active, onClick, icon: Icon, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Terminal;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "relative flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {children}
      <span
        aria-hidden="true"
        className={[
          "absolute left-2 right-2 -bottom-px h-[2px] rounded-full transition-all",
          active ? "bg-primary opacity-100" : "bg-transparent opacity-0",
        ].join(" ")}
      />
    </button>
  );
}

function ConsoleLogs({ entries }: { entries: ConsoleEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground/70 italic">No console activity captured.</p>;
  }
  const tone: Record<ConsoleEntry["level"], string> = {
    log: "text-foreground/80",
    info: "text-blue-300",
    warn: "text-amber-300",
    error: "text-red-300",
    debug: "text-muted-foreground",
  };
  return (
    <div className="space-y-1">
      {entries.map((e, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="shrink-0 text-muted-foreground/50">
            {new Date(e.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <span className={`shrink-0 uppercase font-bold ${tone[e.level]}`}>
            {e.level}
          </span>
          <span className="text-foreground/90 whitespace-pre-wrap [overflow-wrap:anywhere]">
            {e.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function NetworkLogs({ entries }: { entries: NetworkEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground/70 italic">No network activity captured.</p>;
  }
  return (
    <div className="space-y-1">
      {entries.map((e, i) => {
        const ok = e.ok;
        const fail = e.error || (typeof e.status === "number" && e.status >= 400);
        const tone = fail ? "text-red-300" : ok ? "text-emerald-300" : "text-muted-foreground";
        return (
          <div key={i} className="flex items-start gap-2">
            <span className="shrink-0 text-muted-foreground/50">
              {new Date(e.ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <span className={`shrink-0 font-bold ${tone}`}>{e.method}</span>
            {typeof e.status === "number" && (
              <span className={`shrink-0 ${tone}`}>{e.status}</span>
            )}
            {typeof e.durationMs === "number" && (
              <span className="shrink-0 text-muted-foreground/60">{e.durationMs}ms</span>
            )}
            <span className="text-foreground/90 [overflow-wrap:anywhere] break-all">
              {e.url}
              {e.error && <span className="text-red-300"> · {e.error}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BrowserInfo({ info }: { info: Record<string, unknown> }) {
  const entries = Object.entries(info);
  if (entries.length === 0) {
    return <p className="text-muted-foreground/70 italic">No browser info captured.</p>;
  }
  return (
    <table className="w-full text-[11px]">
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-border/40 last:border-0">
            <td className="py-1 pr-3 font-mono text-muted-foreground align-top whitespace-nowrap">{k}</td>
            <td className="py-1 text-foreground/90 [overflow-wrap:anywhere] break-all">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
