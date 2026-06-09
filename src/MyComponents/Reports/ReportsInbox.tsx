/**
 * ReportsInbox.tsx — Jira-style table for team-submitted reports.
 *
 * Mirror of BugReportsInbox's structure:
 *   · Toolbar (search + filter chips + density toggle + count)
 *   · Sortable full-width table with bulk-select column
 *   · Bulk action bar appears once 1+ rows selected (mark
 *     reviewed / archive in bulk)
 *   · Slide-over panel for the full detail + leadership note
 *
 * Same visual language as BugReportsInbox — flipping tabs in
 * ReportsHub feels like the same surface, not two products.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2, AlertCircle, Check, Inbox, Clock, Archive,
  Eye, FileText, FolderKanban, ClipboardList, AlertTriangle,
  MessageSquare, Save, Building2, ArrowUp, ArrowDown,
} from "lucide-react";
import { companySupabase } from "@/MyComponents/supabase";
import { SlideOver } from "./shared/SlideOver";
import { InboxToolbar, type Density } from "./shared/InboxToolbar";

// ── Types ───────────────────────────────────────────────────────

type ReportType = "status" | "project_update" | "incident" | "feedback" | "other";
type ReportPriority = "low" | "normal" | "high" | "urgent";
type ReportStatus = "draft" | "submitted" | "reviewed" | "archived";

interface Report {
  id: string;
  title: string;
  body: string | null;
  type: ReportType;
  priority: ReportPriority;
  company: string | null;
  project_id: string | null;
  sender_user_id: string | null;
  status: ReportStatus;
  review_notes: string | null;
  reviewer_user_id: string | null;
  created_at: string;
  submitted_at: string | null;
  reviewed_at: string | null;

  _senderName?: string;
  _senderAvatar?: string | null;
  _senderRole?: string;
  _projectName?: string;
}

interface AppUserLite {
  supa_id: string;
  username: string;
  role: string;
  avatarURL: string | null;
}

interface ProjectLite {
  id: string;
  name: string;
}

const TYPE_META: Record<
  ReportType,
  { label: string; icon: typeof FileText; rail: string }
> = {
  status:         { label: "Status",    icon: ClipboardList,  rail: "#60a5fa" },
  project_update: { label: "Project",   icon: FolderKanban,   rail: "#a78bfa" },
  incident:       { label: "Incident",  icon: AlertTriangle,  rail: "#f87171" },
  feedback:       { label: "Feedback",  icon: MessageSquare,  rail: "#4ade80" },
  other:          { label: "Other",     icon: FileText,       rail: "#a1a1aa" },
};

const PRIORITY_RANK: Record<ReportPriority, number> = {
  low: 0, normal: 1, high: 2, urgent: 3,
};
const PRIORITY_LABEL: Record<ReportPriority, string> = {
  low: "Low", normal: "Normal", high: "High", urgent: "Urgent",
};
const PRIORITY_DOT: Record<ReportPriority, string> = {
  low: "bg-zinc-500", normal: "bg-zinc-400", high: "bg-amber-400", urgent: "bg-red-500",
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  draft: "text-muted-foreground",
  submitted: "text-primary",
  reviewed: "text-emerald-400",
  archived: "text-muted-foreground",
};
const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: "Draft", submitted: "New", reviewed: "Reviewed", archived: "Archived",
};

// Sort state
type SortKey = "created" | "priority" | "status" | "sender" | "type" | "title";
type SortDir = "asc" | "desc";

interface SortState { key: SortKey; dir: SortDir; }

interface Props {
  refreshToken?: number;
}

export function ReportsInbox({ refreshToken }: Props = {}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("submitted");
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<ReportPriority | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<"codewithali" | "simplicity" | "all">("all");
  const [search, setSearch] = useState("");

  const [sort, setSort] = useState<SortState>({ key: "created", dir: "desc" });
  const [density, setDensity] = useState<Density>(() => {
    try {
      const v = localStorage.getItem("cwa-reports-density");
      return v === "compact" ? "compact" : "comfortable";
    } catch { return "comfortable"; }
  });
  useEffect(() => {
    try { localStorage.setItem("cwa-reports-density", density); } catch { /* noop */ }
  }, [density]);

  const [openId, setOpenId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const reload = async () => {
    setLoading((cur) => (reports.length === 0 ? true : cur));
    setRefreshing(true);
    setError(null);

    const [r, u, p] = await Promise.all([
      companySupabase
        .from("reports")
        .select(
          "id, title, body, type, priority, company, project_id, sender_user_id, status, review_notes, reviewer_user_id, created_at, submitted_at, reviewed_at",
        )
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500),
      companySupabase
        .from("employee")
        .select("supa_id, username, role, avatarURL")
        .not("supa_id", "is", null),
      companySupabase.from("projects").select("id, name"),
    ]);

    if (r.error) {
      const msg = (r.error.message || "").toLowerCase();
      if (msg.includes("does not exist") || (r.error as any).code === "42P01") {
        setError("Reports table isn't set up. Run migrations/reports_init.sql.");
      } else {
        setError(r.error.message);
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const usersBySupaId = new Map(
      (u.data ?? []).map((x: any) => [x.supa_id, x as AppUserLite]),
    );
    const projectsById = new Map(
      (p.data ?? []).map((x: any) => [x.id, x as ProjectLite]),
    );

    const withMeta: Report[] = (r.data ?? []).map((row: any) => {
      const sender = row.sender_user_id ? usersBySupaId.get(row.sender_user_id) : undefined;
      const project = row.project_id ? projectsById.get(row.project_id) : undefined;
      return {
        ...row,
        _senderName: sender?.username ?? "Unknown",
        _senderAvatar: sender?.avatarURL ?? null,
        _senderRole: sender?.role ?? "",
        _projectName: project?.name,
      };
    });

    setReports(withMeta);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (companyFilter !== "all" && r.company !== companyFilter) return false;
      if (q) {
        const hay = `${r.title} ${r.body ?? ""} ${r._senderName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sign = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sort.key) {
        case "priority":
          return (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) * sign;
        case "status":
          return a.status.localeCompare(b.status) * sign;
        case "sender":
          return (a._senderName ?? "").localeCompare(b._senderName ?? "") * sign;
        case "type":
          return a.type.localeCompare(b.type) * sign;
        case "title":
          return a.title.localeCompare(b.title) * sign;
        case "created":
        default: {
          const aT = Date.parse(a.submitted_at ?? a.created_at);
          const bT = Date.parse(b.submitted_at ?? b.created_at);
          return (aT - bT) * sign;
        }
      }
    });
  }, [reports, statusFilter, typeFilter, priorityFilter, companyFilter, search, sort]);

  const opened = reports.find((r) => r.id === openId) ?? null;

  const hasAnyFilter =
    statusFilter !== "submitted" ||
    typeFilter !== "all" ||
    priorityFilter !== "all" ||
    companyFilter !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setStatusFilter("submitted");
    setTypeFilter("all");
    setPriorityFilter("all");
    setCompanyFilter("all");
    setSearch("");
  };

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  };

  const allSelected =
    visible.length > 0 && visible.every((r) => selectedIds.has(r.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(visible.map((r) => r.id)));
  };
  const toggleOne = (id: string) => {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bulkSetStatus = async (next: ReportStatus) => {
    if (selectedIds.size === 0) return;
    const ids = [...selectedIds];
    const { data: { user: authUser } } = await companySupabase.auth.getUser();
    const patch: any = { status: next };
    if (next === "reviewed") {
      patch.reviewer_user_id = authUser?.id ?? null;
      patch.reviewed_at = new Date().toISOString();
    }
    if (next === "submitted") {
      patch.reviewer_user_id = null;
      patch.reviewed_at = null;
    }
    const { error: err } = await companySupabase
.from("reports")
      .update(patch)
      .in("id", ids);
    if (err) { setError(err.message); return; }
    setSelectedIds(new Set());
    reload();
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col bg-background">
      <InboxToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search title, body, or sender…"
        countLabel={`${visible.length} ${visible.length === 1 ? "report" : "reports"}`}
        onClearFilters={hasAnyFilter ? clearFilters : undefined}
        density={density}
        onDensityChange={setDensity}
        filters={[
          {
            label: "Status",
            value: statusFilter,
            onChange: (v) => setStatusFilter(v as ReportStatus | "all"),
            options: [
              { value: "submitted", label: "New" },
              { value: "reviewed",  label: "Reviewed" },
              { value: "archived",  label: "Archived" },
              { value: "all",       label: "All statuses" },
            ],
          },
          {
            label: "Type",
            value: typeFilter,
            onChange: (v) => setTypeFilter(v as ReportType | "all"),
            options: [
              { value: "all",            label: "All types" },
              { value: "status",         label: "Status" },
              { value: "project_update", label: "Project" },
              { value: "incident",       label: "Incident" },
              { value: "feedback",       label: "Feedback" },
              { value: "other",          label: "Other" },
            ],
          },
          {
            label: "Priority",
            value: priorityFilter,
            onChange: (v) => setPriorityFilter(v as ReportPriority | "all"),
            options: [
              { value: "all",    label: "All priorities" },
              { value: "urgent", label: "Urgent" },
              { value: "high",   label: "High" },
              { value: "normal", label: "Normal" },
              { value: "low",    label: "Low" },
            ],
          },
          {
            label: "Company",
            value: companyFilter,
            onChange: (v) => setCompanyFilter(v as any),
            options: [
              { value: "all",          label: "All companies" },
              { value: "codewithali",  label: "CWA" },
              { value: "simplicity",   label: "Simplicity" },
            ],
          },
        ]}
      />

      {selectedIds.size > 0 && (
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

      <div className="flex-1 min-h-0 overflow-auto">
        {loading && reports.length === 0 ? (
          <div className="flex items-center gap-2 p-6 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading reports…
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            kind={statusFilter === "submitted" && !hasAnyFilter ? "zero" : "no-match"}
            onClear={hasAnyFilter ? clearFilters : undefined}
          />
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10 bg-card/80 backdrop-blur border-b border-border">
              <tr className="text-left">
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
                <Th width="w-10" />
                <Th width="w-24" label="ID" sortKey="created" sort={sort} onClick={toggleSort} />
                <Th label="Title" sortKey="title" sort={sort} onClick={toggleSort} />
                <Th width="w-32" label="Sender" sortKey="sender" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Type" sortKey="type" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Priority" sortKey="priority" sort={sort} onClick={toggleSort} />
                <Th width="w-24" label="Status" sortKey="status" sort={sort} onClick={toggleSort} />
                <Th width="w-28" label="Submitted" sortKey="created" sort={sort} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <ReportRow
                  key={r.id}
                  report={r}
                  density={density}
                  selected={selectedIds.has(r.id)}
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

      <SlideOver
        open={!!opened}
        onClose={() => setOpenId(null)}
        title={
          opened && (
            <div>
              <p className="flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
                <span style={{ color: TYPE_META[opened.type].rail }} className="inline-flex items-center gap-1">
                  {(() => {
                    const I = TYPE_META[opened.type].icon;
                    return <I className="h-3 w-3" />;
                  })()}
                  {TYPE_META[opened.type].label}
                </span>
                <span className="opacity-50">·</span>
                <span>{PRIORITY_LABEL[opened.priority]}</span>
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
          <ReportDetailBody
            report={opened}
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

function ReportRow({
  report, density, selected, active, onToggleSelect, onOpen,
}: {
  report: Report;
  density: Density;
  selected: boolean;
  active: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const meta = TYPE_META[report.type];
  const TypeIcon = meta.icon;
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

      <td className={`relative px-2 ${py}`}>
        <span
          aria-hidden="true"
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
          style={{ background: meta.rail }}
        />
        <TypeIcon className="h-3.5 w-3.5 text-muted-foreground/80" />
      </td>

      <td className={`px-2 ${py} font-mono text-[10.5px] text-muted-foreground tabular-nums`}>
        RPT-{report.id.slice(0, 6).toUpperCase()}
      </td>

      <td className={`px-2 ${py} min-w-0`}>
        <span className="text-[12.5px] font-medium text-foreground tracking-tight truncate block max-w-[640px]">
          {report.title}
        </span>
      </td>

      <td className={`px-2 ${py} text-foreground/90`}>
        <div className="truncate">
          {report._senderName}
          {report._senderRole && (
            <span className="text-muted-foreground/70 text-[10.5px]"> · {report._senderRole}</span>
          )}
        </div>
      </td>

      <td className={`px-2 ${py} text-foreground/80`}>
        <span className="inline-flex items-center gap-1.5">
          <TypeIcon className="h-3 w-3" style={{ color: meta.rail }} />
          {meta.label}
        </span>
      </td>

      <td className={`px-2 ${py}`}>
        <span className="inline-flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_DOT[report.priority]}`} />
          <span className="text-foreground/80">{PRIORITY_LABEL[report.priority]}</span>
        </span>
      </td>

      <td className={`px-2 ${py}`}>
        <span className={`uppercase font-semibold text-[10.5px] tracking-wider ${STATUS_COLOR[report.status]}`}>
          {STATUS_LABEL[report.status]}
        </span>
      </td>

      <td className={`px-2 ${py} font-mono text-[10.5px] text-muted-foreground/80 tabular-nums`}>
        {new Date(report.submitted_at ?? report.created_at).toLocaleDateString(undefined, {
          month: "short", day: "numeric",
        })}
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
            Inbox zero
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
            No new reports. Switch the status filter to dig through past ones.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center p-12 text-center">
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted/40">
          <Inbox className="h-6 w-6 text-muted-foreground/60" />
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
  onSetStatus: (s: ReportStatus) => void;
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
        {(["submitted", "reviewed", "archived"] as ReportStatus[]).map((s) => (
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

// ── Detail body ─────────────────────────────────────────────────

function ReportDetailBody({
  report, onReload, onClose,
}: {
  report: Report;
  onReload: () => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState(report.review_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const companyLabel =
    report.company === "simplicity" ? "Simplicity"
    : report.company === "codewithali" ? "CodeWithAli"
    : null;

  const markReviewed = async () => {
    setSaving(true); setErr(null);
    const { data: { user: authUser } } = await companySupabase.auth.getUser();
    const { error } = await companySupabase
.from("reports")
      .update({
        status: "reviewed",
        review_notes: notes.trim() || null,
        reviewer_user_id: authUser?.id ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
    onClose();
  };

  const saveNotesOnly = async () => {
    setSaving(true); setErr(null);
    const { error } = await companySupabase
.from("reports")
      .update({ review_notes: notes.trim() || null })
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
  };

  const archive = async () => {
    if (!confirm("Archive this report?")) return;
    setSaving(true); setErr(null);
    const { error } = await companySupabase
.from("reports")
      .update({ status: "archived" })
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
    onClose();
  };

  const unreview = async () => {
    setSaving(true); setErr(null);
    const { error } = await companySupabase
.from("reports")
      .update({
        status: "submitted",
        reviewed_at: null,
        reviewer_user_id: null,
      })
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
  };

  return (
    <div className="px-6 py-6 space-y-6">
      <p className="text-[11.5px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-mono uppercase tracking-wider text-muted-foreground/80">
          RPT-{report.id.slice(0, 6).toUpperCase()}
        </span>
        <span className="opacity-50">·</span>
        <span>From <span className="font-medium text-foreground/90">{report._senderName}</span></span>
        {report._senderRole && (<><span className="opacity-50">·</span><span>{report._senderRole}</span></>)}
        {companyLabel && (
          <>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3 opacity-60" />
              {companyLabel}
            </span>
          </>
        )}
        <span className="opacity-50">·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3 opacity-60" />
          {(report.submitted_at ?? report.created_at)
            ? new Date(report.submitted_at ?? report.created_at).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })
            : "—"}
        </span>
        {report._projectName && (
          <>
            <span className="opacity-50">·</span>
            <span className="inline-flex items-center gap-1">
              <FolderKanban className="h-3 w-3 opacity-60" />
              {report._projectName}
            </span>
          </>
        )}
      </p>

      <Section title="Report">
        {report.body
          ? <StructuredBody body={report.body} />
          : <p className="text-[12.5px] italic text-muted-foreground">No details — just the title.</p>}
      </Section>

      {report.reviewed_at && (
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Reviewed {new Date(report.reviewed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      )}

      <Section title="Leadership note">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Feedback, follow-ups, or acknowledgment for the sender."
          className="w-full resize-y rounded-md border border-border bg-muted/40 px-3 py-2.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/30 transition-colors leading-relaxed"
        />
        {err && (
          <p className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11.5px] text-red-300">
            {err}
          </p>
        )}
      </Section>

      <div className="sticky bottom-0 -mx-6 px-6 pt-3 pb-1 bg-background border-t border-border flex items-center justify-end gap-2">
        {report.status !== "archived" && (
          <button
            type="button"
            onClick={archive}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent hover:bg-muted/50 px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Archive className="h-3 w-3" />
            Archive
          </button>
        )}
        {report.status === "reviewed" && (
          <>
            <button
              type="button"
              onClick={unreview}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent hover:bg-muted/50 px-3 py-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <Eye className="h-3 w-3" />
              Un-review
            </button>
            <button
              type="button"
              onClick={saveNotesOnly}
              disabled={saving || notes === (report.review_notes ?? "")}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
              Save note
            </button>
          </>
        )}
        {report.status === "submitted" && (
          <button
            type="button"
            onClick={markReviewed}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-[12px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Mark reviewed
          </button>
        )}
      </div>
    </div>
  );
}

// ── Section + structured body ──────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function StructuredBody({ body }: { body: string }) {
  const sections = useMemo(() => parseStructuredBody(body), [body]);

  if (!sections) {
    return (
      <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
        {body}
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            {s.label}
          </p>
          <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
            {s.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function parseStructuredBody(
  body: string,
): Array<{ label: string; value: string }> | null {
  const lines = body.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (!/^[^:]{2,80}:\s*$/.test(first)) return null;

  const sections: Array<{ label: string; value: string }> = [];
  let currentLabel: string | null = null;
  let currentValue: string[] = [];

  const flush = () => {
    if (currentLabel !== null && currentValue.length > 0) {
      sections.push({
        label: currentLabel,
        value: currentValue.join("\n").trim(),
      });
    }
    currentLabel = null;
    currentValue = [];
  };

  for (const raw of lines) {
    const line = raw ?? "";
    const labelMatch = /^([^:\s][^:]{0,78}[^:\s]):\s*$/.exec(line);
    if (labelMatch) {
      flush();
      currentLabel = labelMatch[1]!.trim();
      continue;
    }
    if (currentLabel !== null) {
      currentValue.push(line);
    }
  }
  flush();

  return sections.length > 0 ? sections : null;
}
