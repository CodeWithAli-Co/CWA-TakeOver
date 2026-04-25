/**
 * ReportsInbox.tsx — CEO / COO / CFO / Admin inbox for all reports
 * submitted by team members across both companies.
 *
 * Redesign v2 (April 2026):
 *   · Bento-card aesthetic — list + detail panes are floating, rounded
 *     glass cards on a textured background, not a flat 2-pane mail
 *     client. Matches the design language of the financial dashboard.
 *   · Hero strip blends title + queue-health indicator + 4 stat tiles
 *     into a single coherent row. Queue health = age of oldest
 *     unreviewed report so the operator instantly sees if something is
 *     rotting in the pile.
 *   · Detail pane reframed as a "letter": sender HERO block (big
 *     avatar, name, role, company), spec-sheet metadata grid, body in
 *     a cream document panel, review bar pinned to the bottom.
 *   · List rows get a colored accent rail (left edge) tied to the
 *     report type, urgency dot for priority, and a subtle hover lift.
 *   · Re-introduces the missing TinySelect helper (was referenced but
 *     never defined in v1 — source of a runtime crash on settings).
 *
 * RLS + role gating unchanged — UserView wrapper at the route level,
 * Supabase policies server-side.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Inbox, Search, Loader2, AlertCircle, Clock, Archive,
  Eye, Check, FileText, FolderKanban, ClipboardList, AlertTriangle,
  MessageSquare, Flag, X, Save, SlidersHorizontal,
  TrendingUp, CalendarClock, ChevronDown, Activity, Zap, Building2,
  RefreshCw,
} from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import supabase from "@/MyComponents/supabase";

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
  { label: string; icon: typeof FileText; accent: string }
> = {
  status:         { label: "Status",    icon: ClipboardList,  accent: "#3b82f6" },
  project_update: { label: "Project",   icon: FolderKanban,   accent: "#8b5cf6" },
  incident:       { label: "Incident",  icon: AlertTriangle,  accent: "#ef4444" },
  feedback:       { label: "Feedback",  icon: MessageSquare,  accent: "#10b981" },
  other:          { label: "Other",     icon: FileText,       accent: "#64748b" },
};

const PRIORITY_META: Record<
  ReportPriority,
  { label: string; cls: string; dot: string }
> = {
  low:    { label: "Low",    cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",
            dot: "bg-zinc-500" },
  normal: { label: "Normal", cls: "border-blue-500/40 bg-blue-500/10 text-blue-300",
            dot: "bg-blue-400" },
  high:   { label: "High",   cls: "border-amber-500/40 bg-amber-500/10 text-amber-300",
            dot: "bg-amber-400" },
  urgent: { label: "Urgent", cls: "border-red-500/40 bg-red-500/10 text-red-300",
            dot: "bg-red-500 ring-2 ring-red-500/30" },
};

// ── Main component ──────────────────────────────────────────────

export function ReportsInbox() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("submitted");
  const [typeFilter, setTypeFilter] = useState<ReportType | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<ReportPriority | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<"codewithali" | "simplicity" | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = async () => {
    setLoading((cur) => (reports.length === 0 ? true : cur));
    setRefreshing(true);
    setError(null);

    const [r, u, p] = await Promise.all([
      supabase
        .from("reports")
        .select(
          "id, title, body, type, priority, company, project_id, sender_user_id, status, review_notes, reviewer_user_id, created_at, submitted_at, reviewed_at",
        )
        .order("submitted_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("app_users")
        .select("supa_id, username, role, avatarURL")
        .not("supa_id", "is", null),
      supabase.from("projects").select("id, name"),
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

    if (!selectedId && withMeta.length > 0) {
      const firstSubmitted = withMeta.find((x) => x.status === "submitted");
      setSelectedId((firstSubmitted ?? withMeta[0]).id);
    }
  };

  useEffect(() => { reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  // ── Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Oldest unreviewed report → queue health indicator.
    const submittedReports = reports.filter((r) => r.status === "submitted");
    let oldestSubmittedMs: number | null = null;
    for (const r of submittedReports) {
      const t = Date.parse(r.submitted_at ?? r.created_at);
      if (!isFinite(t)) continue;
      if (oldestSubmittedMs === null || t < oldestSubmittedMs) oldestSubmittedMs = t;
    }
    const oldestAgeHours = oldestSubmittedMs
      ? Math.max(0, (now - oldestSubmittedMs) / (1000 * 60 * 60))
      : null;

    return {
      submitted: submittedReports.length,
      urgent: submittedReports.filter(
        (r) => r.priority === "urgent" || r.priority === "high",
      ).length,
      reviewedThisWeek: reports.filter(
        (r) => r.reviewed_at && Date.parse(r.reviewed_at) > weekAgo,
      ).length,
      totalThisMonth: reports.filter(
        (r) => Date.parse(r.submitted_at ?? r.created_at) > monthAgo,
      ).length,
      oldestAgeHours,
    };
  }, [reports]);

  // ── Filter ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
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
  }, [reports, statusFilter, typeFilter, priorityFilter, companyFilter, search]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (selected && !filtered.some((r) => r.id === selected.id)) {
      setSelectedId(filtered[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length]);

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

  return (
    <div
      // h-svh forces the inbox to fill the small-viewport height
      // regardless of parent container — the SidebarProvider's
      // wrapper is min-h-svh, not h-svh, so without this the page
      // would only fill its content height.
      className="flex h-svh min-h-0 flex-col bg-background relative overflow-hidden"
    >
      {/* Subtle ambient wash — felt, not seen */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(80% 60% at 50% -10%, rgba(99,102,241,0.08), transparent 70%)",
        }}
      />

      {/* ── Compact integrated header — title + stats + queue health on
          ONE line, no gaps. Reads as one unit, not three stacked
          sections. Stats render as inline pill chips with a colored
          dot, count, and label. */}
      <header className="relative z-10 shrink-0 border-b border-border/50 bg-card/30 backdrop-blur-sm">
        <div className="px-6 md:px-8 py-3.5 flex items-center gap-5">
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-primary shadow-[0_0_30px_-8px] shadow-primary/40">
              <Inbox className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-foreground leading-tight tracking-tight">
                Reports inbox
              </h1>
              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                Review, annotate, archive when handled.
              </p>
            </div>
          </div>

          {/* Vertical divider */}
          <div className="h-9 w-px bg-border/60 shrink-0" aria-hidden="true" />

          {/* Inline stat chips — compact, no card backgrounds */}
          <div className="flex flex-1 items-center gap-1 min-w-0 overflow-hidden">
            <StatChip
              icon={Inbox}
              label="New"
              value={stats.submitted}
              tone={stats.submitted > 0 ? "primary" : "muted"}
            />
            <StatChipDivider />
            <StatChip
              icon={Flag}
              label="Urgent"
              value={stats.urgent}
              tone={stats.urgent > 0 ? "danger" : "muted"}
            />
            <StatChipDivider />
            <StatChip
              icon={Eye}
              label="Reviewed (wk)"
              value={stats.reviewedThisWeek}
              tone="success"
            />
            <StatChipDivider />
            <StatChip
              icon={TrendingUp}
              label="30-day"
              value={stats.totalThisMonth}
              tone="neutral"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <QueueHealthChip
              hours={stats.oldestAgeHours}
              count={stats.submitted}
            />
            <button
              type="button"
              onClick={reload}
              disabled={refreshing || loading}
              title="Refresh"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="relative z-10 shrink-0 border-b border-amber-500/20 bg-amber-500/10 px-6 md:px-8 py-2 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
          <p className="text-[11.5px] text-amber-200">{error}</p>
        </div>
      )}

      {/* ── Body: full-height single integrated surface, no gaps,
          no floating cards. Inbox is wider (560px) so titles + sender
          + meta have breathing room. List and detail share borders for
          a cohesive look. */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* List pane */}
        <aside className="flex w-[560px] shrink-0 flex-col border-r border-border/60 bg-card/15">
          {/* Filters */}
          <div className="space-y-3 border-b border-border/40 px-5 py-4 bg-card/30 backdrop-blur-sm">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, body, or sender…"
                className="w-full rounded-lg border border-border/70 bg-background/60 pl-8 pr-8 py-2 text-[12px] placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Status tabs — segmented control */}
            <div className="flex rounded-lg border border-border/60 bg-background/40 p-0.5">
              {([
                ["submitted", "New", stats.submitted],
                ["reviewed", "Reviewed", null],
                ["archived", "Archived", null],
                ["all", "All", null],
              ] as const).map(([v, label, badge]) => {
                const active = statusFilter === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStatusFilter(v as any)}
                    className={[
                      "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    ].join(" ")}
                  >
                    {label}
                    {badge != null && badge > 0 && (
                      <span
                        className={[
                          "inline-flex items-center justify-center rounded-full px-1.5 text-[9px] font-bold min-w-[16px]",
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary text-primary-foreground",
                        ].join(" ")}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Secondary filters */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <SlidersHorizontal className="h-3 w-3 shrink-0" />
              <TinySelect
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as any)}
                options={[
                  ["all", "All types"],
                  ["status", "Status"],
                  ["project_update", "Project"],
                  ["incident", "Incident"],
                  ["feedback", "Feedback"],
                  ["other", "Other"],
                ]}
              />
              <TinySelect
                value={priorityFilter}
                onChange={(v) => setPriorityFilter(v as any)}
                options={[
                  ["all", "All priorities"],
                  ["urgent", "Urgent"],
                  ["high", "High"],
                  ["normal", "Normal"],
                  ["low", "Low"],
                ]}
              />
              <TinySelect
                value={companyFilter}
                onChange={(v) => setCompanyFilter(v as any)}
                options={[
                  ["all", "Both co's"],
                  ["codewithali", "CWA"],
                  ["simplicity", "Simplicity"],
                ]}
              />
            </div>

            {/* Result count + clear filters */}
            <div className="flex items-center justify-between text-[10.5px]">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                {filtered.length === 1 ? "report" : "reports"}
                {hasAnyFilter && " matching"}
              </span>
              {hasAnyFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-primary hover:text-primary/80 font-semibold transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-[11.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading reports…
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                kind={statusFilter === "submitted" && !hasAnyFilter ? "zero" : "no-match"}
                onClear={hasAnyFilter ? clearFilters : undefined}
              />
            ) : (
              <Virtuoso
                className="h-full"
                style={{ height: "100%" }}
                data={filtered}
                computeItemKey={(_, r) => r.id}
                components={{
                  List: React.forwardRef(function VList(props, ref) {
                    return <div {...props} ref={ref} className="p-2 space-y-1" />;
                  }),
                }}
                itemContent={(_index, r) => (
                  <ReportRow
                    report={r}
                    active={r.id === selectedId}
                    onClick={() => setSelectedId(r.id)}
                  />
                )}
              />
            )}
          </div>
        </aside>

        {/* Detail pane */}
        <main className="flex flex-1 min-h-0 flex-col bg-background">
          {selected ? (
            <ReportDetail report={selected} onReload={reload} key={selected.id} />
          ) : (
            <div className="flex h-full items-center justify-center text-center p-10">
              <div className="max-w-[320px]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
                  <Inbox className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <p className="mt-4 text-[14px] font-semibold text-foreground">
                  Pick a report to read
                </p>
                <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
                  The left pane lists everything waiting for review. Click any one to read the full body and add leadership notes.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Queue health chip ───────────────────────────────────────────

function QueueHealthChip({
  hours, count,
}: {
  hours: number | null;
  count: number;
}) {
  if (count === 0 || hours === null) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10.5px] font-semibold text-emerald-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        Inbox zero
      </span>
    );
  }
  // Tone by oldest age:
  //   < 24h = green (healthy)
  //   < 72h = amber (aging)
  //   ≥ 72h = red   (stale)
  const tone =
    hours < 24
      ? { border: "border-emerald-500/30", bg: "bg-emerald-500/10", fg: "text-emerald-300", dot: "bg-emerald-400" }
      : hours < 72
        ? { border: "border-amber-500/30", bg: "bg-amber-500/10", fg: "text-amber-300", dot: "bg-amber-400" }
        : { border: "border-red-500/30", bg: "bg-red-500/10", fg: "text-red-300", dot: "bg-red-400" };
  const ageLabel =
    hours < 1
      ? "< 1h"
      : hours < 48
        ? `${Math.round(hours)}h`
        : `${Math.round(hours / 24)}d`;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${tone.border} ${tone.bg} px-2.5 py-1 text-[10.5px] font-semibold ${tone.fg}`}
      title={`Oldest unreviewed report is ${ageLabel} old`}
    >
      <Activity className="h-3 w-3" />
      Oldest: {ageLabel}
    </span>
  );
}

// ── Inline stat chip (header strip) ─────────────────────────────

function StatChip({
  icon: Icon, label, value, tone,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  tone: "primary" | "danger" | "success" | "neutral" | "muted";
}) {
  const tones = {
    primary: { fg: "text-primary", dot: "bg-primary" },
    danger:  { fg: "text-red-300", dot: "bg-red-500" },
    success: { fg: "text-emerald-300", dot: "bg-emerald-400" },
    neutral: { fg: "text-blue-300", dot: "bg-blue-400" },
    muted:   { fg: "text-muted-foreground/70", dot: "bg-muted-foreground/30" },
  }[tone];
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 rounded-md hover:bg-muted/40 transition-colors min-w-0">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${tones.fg}`} />
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className={`text-[18px] font-bold tabular-nums leading-none ${tones.fg}`}>
          {value}
        </span>
        <span className="text-[10.5px] font-medium text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <span className={`hidden xl:inline-block h-1.5 w-1.5 rounded-full ${tones.dot} shrink-0`} aria-hidden="true" />
    </div>
  );
}

function StatChipDivider() {
  return <span className="h-5 w-px bg-border/40 shrink-0" aria-hidden="true" />;
}

// ── Empty state ─────────────────────────────────────────────────

function EmptyState({
  kind, onClear,
}: {
  kind: "zero" | "no-match";
  onClear?: () => void;
}) {
  // Vertically centered so we don't leave a sad blank lower half.
  if (kind === "zero") {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
            <Check className="h-7 w-7 text-emerald-300" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
          </div>
          <p className="mt-4 text-[14px] font-bold text-foreground tracking-tight">
            Inbox zero
          </p>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
            No new reports. Check back later, or flip to Reviewed / Archived to dig through past ones.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center justify-center p-8 text-center">
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/40">
          <Search className="h-6 w-6 text-muted-foreground/60" />
        </div>
        <p className="mt-4 text-[13px] font-semibold text-foreground">
          No matches
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
          Try changing the filters, or clear them to see everything.
        </p>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="mt-4 inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/60 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}

// ── TinySelect (re-introduced — was missing) ────────────────────

function TinySelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (next: string) => void;
  options: Array<readonly [string, string]>;
}) {
  return (
    <div className="relative inline-flex">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-md border border-border/70 bg-background/40 pl-2 pr-6 py-1 text-[10.5px] font-semibold text-foreground/90 outline-none cursor-pointer hover:bg-muted/40 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
      >
        {options.map(([v, label]) => (
          <option key={v} value={v} className="bg-background text-foreground">
            {label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

// ── List row ────────────────────────────────────────────────────

function ReportRow({
  report, active, onClick,
}: {
  report: Report;
  active: boolean;
  onClick: () => void;
}) {
  const meta = TYPE_META[report.type];
  const TypeIcon = meta.icon;
  const isNew = report.status === "submitted";
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group relative w-full overflow-hidden rounded-xl border px-3 py-3 text-left transition-all",
        active
          ? "border-primary/50 bg-primary/[0.07] shadow-[inset_0_0_0_1px] shadow-primary/30"
          : "border-transparent hover:border-border/60 hover:bg-muted/40 hover:translate-x-0.5",
      ].join(" ")}
    >
      {/* Type accent rail on the left */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-opacity"
        style={{
          background: meta.accent,
          opacity: active ? 1 : 0.4,
        }}
      />

      <div className="flex items-start gap-2.5 pl-1.5">
        <div
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all",
            active
              ? ""
              : "bg-muted/60 text-muted-foreground group-hover:scale-105",
          ].join(" ")}
          style={
            active
              ? { background: `${meta.accent}22`, color: meta.accent }
              : undefined
          }
        >
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={[
                "text-[12.5px] truncate",
                isNew
                  ? "font-bold text-foreground"
                  : "font-medium text-foreground/90",
              ].join(" ")}
            >
              {report.title}
            </p>
            {/* Priority dot for high/urgent — quieter than a pill */}
            {(report.priority === "high" || report.priority === "urgent") && (
              <span
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${PRIORITY_META[report.priority].dot}`}
                title={PRIORITY_META[report.priority].label}
              />
            )}
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground truncate">
            {report._senderName}
            {report._senderRole && <span className="opacity-70"> · {report._senderRole}</span>}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[9.5px] text-muted-foreground/80">
            <span>
              {report.submitted_at
                ? new Date(report.submitted_at).toLocaleDateString()
                : new Date(report.created_at).toLocaleDateString()}
            </span>
            <span className="opacity-40">·</span>
            <span style={{ color: meta.accent, opacity: 0.85 }}>
              {meta.label}
            </span>
            {report.status === "reviewed" && (
              <>
                <span className="opacity-40">·</span>
                <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold">
                  <Eye className="h-2.5 w-2.5" />
                  reviewed
                </span>
              </>
            )}
            {report.status === "archived" && (
              <>
                <span className="opacity-40">·</span>
                <span className="text-zinc-500 font-semibold">archived</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Detail pane ─────────────────────────────────────────────────

function ReportDetail({
  report, onReload,
}: {
  report: Report;
  onReload: () => void;
}) {
  const [notes, setNotes] = useState(report.review_notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meta = TYPE_META[report.type];
  const TypeIcon = meta.icon;

  const markReviewed = async () => {
    setSaving(true); setErr(null);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase
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
  };

  const saveNotesOnly = async () => {
    setSaving(true); setErr(null);
    const { error } = await supabase
      .from("reports")
      .update({ review_notes: notes.trim() || null })
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
  };

  const archive = async () => {
    if (!confirm("Archive this report? It'll move out of the active list. You can still find it under the Archived filter.")) return;
    setSaving(true); setErr(null);
    const { error } = await supabase
      .from("reports")
      .update({ status: "archived" })
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
  };

  const unreview = async () => {
    setSaving(true); setErr(null);
    const { error } = await supabase
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

  const senderInitials = (report._senderName ?? "??").slice(0, 2).toUpperCase();
  const companyLabel =
    report.company === "simplicity"
      ? "Simplicity"
      : report.company === "codewithali"
        ? "CodeWithAli"
        : null;

  // Type accent rail at the very top of the card.
  return (
    <div className="flex h-full flex-col">
      <div
        className="w-full shrink-0"
        style={{
          height: "3px",
          background: `linear-gradient(90deg, ${meta.accent}, ${meta.accent}33)`,
        }}
      />

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[820px] mx-auto w-full px-7 py-7 space-y-6">
          {/* Sender hero block */}
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-200 text-[16px] font-black overflow-hidden border border-indigo-500/25"
            >
              {report._senderAvatar ? (
                <img src={report._senderAvatar} alt="" className="h-14 w-14 rounded-2xl object-cover" />
              ) : (
                senderInitials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                From
              </p>
              <p className="text-[15px] font-bold text-foreground tracking-tight truncate">
                {report._senderName}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-muted-foreground">
                {report._senderRole && <span>{report._senderRole}</span>}
                {report._senderRole && companyLabel && <span className="opacity-50">·</span>}
                {companyLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3 opacity-60" />
                    {companyLabel}
                  </span>
                )}
              </div>
            </div>
            {/* Status pill on the far right */}
            {report.status === "reviewed" && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1 text-[11px] font-bold">
                <Eye className="h-3 w-3" />
                Reviewed
              </span>
            )}
            {report.status === "archived" && (
              <span className="rounded-full bg-zinc-700/40 text-zinc-400 px-3 py-1 text-[11px] font-bold">
                Archived
              </span>
            )}
            {report.status === "submitted" && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full text-[11px] font-bold px-3 py-1"
                style={{
                  background: `${meta.accent}1f`,
                  color: meta.accent,
                  border: `1px solid ${meta.accent}40`,
                }}
              >
                <Zap className="h-3 w-3" />
                New
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-[1.85rem] font-black tracking-tight text-foreground leading-[1.15]">
            {report.title}
          </h1>

          {/* Spec-sheet metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-border/60 bg-card/40 backdrop-blur-sm p-3">
            <SpecCell
              label="Type"
              value={
                <span
                  className="inline-flex items-center gap-1 font-bold"
                  style={{ color: meta.accent }}
                >
                  <TypeIcon className="h-3 w-3" />
                  {meta.label}
                </span>
              }
            />
            <SpecCell
              label="Priority"
              value={
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-bold ${PRIORITY_META[report.priority].cls}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${PRIORITY_META[report.priority].dot}`} />
                  {PRIORITY_META[report.priority].label}
                </span>
              }
            />
            <SpecCell
              label="Submitted"
              value={
                <span className="inline-flex items-center gap-1 text-foreground/90">
                  <Clock className="h-3 w-3 opacity-60" />
                  {report.submitted_at
                    ? new Date(report.submitted_at).toLocaleString(undefined, {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })
                    : "—"}
                </span>
              }
            />
            <SpecCell
              label="Project"
              value={
                report._projectName ? (
                  <span className="inline-flex items-center gap-1 text-foreground/90">
                    <FolderKanban className="h-3 w-3 opacity-60" />
                    {report._projectName}
                  </span>
                ) : (
                  <span className="text-muted-foreground/70 italic">none</span>
                )
              }
            />
          </div>

          {/* Body — letter style */}
          {report.body ? (
            <div className="rounded-2xl border border-border/60 bg-zinc-950/40 backdrop-blur-sm p-7 shadow-inner">
              <StructuredBody body={report.body} />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-7 text-center">
              <p className="text-[13px] text-muted-foreground italic">
                No details provided — just the title.
              </p>
            </div>
          )}

          {/* Reviewed-at footer */}
          {report.reviewed_at && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pl-1">
              <CalendarClock className="h-3.5 w-3.5" />
              <span>
                Reviewed on{" "}
                <span className="text-foreground/80 font-medium">
                  {new Date(report.reviewed_at).toLocaleString()}
                </span>
              </span>
            </div>
          )}

          {/* Leadership note */}
          <div
            className="rounded-2xl border border-indigo-500/20 bg-card/50 backdrop-blur-sm overflow-hidden"
            style={{ boxShadow: "0 0 0 1px rgba(99,102,241,0.10), 0 8px 32px -16px rgba(99,102,241,0.25)" }}
          >
            <div className="px-6 pt-6 pb-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 border border-indigo-500/20">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-[13px] font-black text-foreground tracking-wide">
                    Leadership Note
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Feedback, follow-ups, or acknowledgment for the sender.
                  </p>
                </div>
              </div>

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={6}
                placeholder="Acknowledged. Let's pick this up in our 1-on-1."
                className="w-full resize-y rounded-xl border border-border/70 bg-background/60 px-4 py-3.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/15 transition-all"
              />

              {err && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[11.5px] text-red-300">
                  {err}
                </p>
              )}
            </div>
          </div>

          {/* Spacer so the sticky bar doesn't cover content */}
          <div className="h-4" />
        </div>
      </div>

      {/* Sticky review bar pinned to the bottom of the detail card */}
      <div className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur px-6 py-3">
        <div className="max-w-[820px] mx-auto flex items-center gap-2.5">
          {report.status === "submitted" && (
            <button
              type="button"
              onClick={markReviewed}
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 text-[13px] font-black text-white disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Mark Reviewed
            </button>
          )}
          {report.status === "reviewed" && (
            <>
              <button
                type="button"
                onClick={saveNotesOnly}
                disabled={saving || notes === (report.review_notes ?? "")}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 text-[13px] font-black text-white disabled:opacity-50 transition-all shadow-lg shadow-indigo-500/20"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Note
              </button>
              <button
                type="button"
                onClick={unreview}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/70 bg-transparent hover:bg-muted/50 px-5 py-2.5 text-[12.5px] font-semibold text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Un-review
              </button>
            </>
          )}
          {report.status !== "archived" && (
            <button
              type="button"
              onClick={archive}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-transparent hover:bg-muted/40 px-5 py-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Spec cell (metadata grid) ───────────────────────────────────

function SpecCell({
  label, value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground/80">
        {label}
      </p>
      <div className="mt-1 text-[12px] text-foreground truncate">
        {value}
      </div>
    </div>
  );
}

// ── Structured body renderer ───────────────────────────────────

function StructuredBody({ body }: { body: string }) {
  const sections = useMemo(() => parseStructuredBody(body), [body]);

  if (!sections) {
    return (
      <p className="text-[13.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {body}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((s, i) => (
        <div key={i}>
          <p className="text-[10.5px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            {s.label}
          </p>
          <p className="text-[13.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
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
