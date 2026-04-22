/**
 * ReportsInbox.tsx — CEO / COO / CFO / Admin inbox for all reports
 * submitted by team members across both companies.
 *
 * Redesign goals:
 *   · Generous breathing room on both panes so it doesn't feel
 *     cramped when the list is short.
 *   · A stats strip along the top with at-a-glance counts: new,
 *     urgent, reviewed-this-week, total-this-month. Turns a sparse
 *     inbox into a dashboard.
 *   · Wider filter bar with cleaner grouping: search on its own
 *     row, status tabs below it, narrow dropdowns for type / priority
 *     / company on a third row.
 *   · Richer detail pane with sender avatar + pretty metadata grid,
 *     body rendered with proper typography, review surface kept to
 *     a sticky footer.
 *   · Empty states upgraded from "list is empty" text to a real
 *     no-results illustration panel.
 *
 * RLS + role gating unchanged — UserView wrapper at the route level,
 * Supabase policies server-side.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Inbox, Search, Loader2, AlertCircle, Clock, Archive,
  Eye, Check, FileText, FolderKanban, ClipboardList, AlertTriangle,
  MessageSquare, Building2, User, Flag, X, Save, SlidersHorizontal,
  TrendingUp, CalendarClock,
} from "lucide-react";
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

const PRIORITY_META: Record<ReportPriority, { label: string; cls: string }> = {
  low:    { label: "Low",    cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" },
  normal: { label: "Normal", cls: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  high:   { label: "High",   cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  urgent: { label: "Urgent", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
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

  const reload = async () => {
    setLoading(true);
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
    return {
      submitted: reports.filter((r) => r.status === "submitted").length,
      urgent: reports.filter(
        (r) => r.status === "submitted" && (r.priority === "urgent" || r.priority === "high"),
      ).length,
      reviewedThisWeek: reports.filter(
        (r) => r.reviewed_at && Date.parse(r.reviewed_at) > weekAgo,
      ).length,
      totalThisMonth: reports.filter(
        (r) => Date.parse(r.submitted_at ?? r.created_at) > monthAgo,
      ).length,
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* ── Header + stats strip ────────────────────── */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="px-6 md:px-8 py-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <Inbox className="h-3.5 w-3.5" />
                </div>
                <div>
                  <h1 className="text-[17px] font-bold text-foreground leading-tight">
                    Reports inbox
                  </h1>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Every report submitted by the team lands here. Review, add
                    notes, archive when handled.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Inbox}
              label="New"
              value={stats.submitted}
              tone={stats.submitted > 0 ? "primary" : "muted"}
              sublabel="awaiting review"
            />
            <StatCard
              icon={Flag}
              label="Urgent / High"
              value={stats.urgent}
              tone={stats.urgent > 0 ? "danger" : "muted"}
              sublabel="in the new pile"
            />
            <StatCard
              icon={Eye}
              label="Reviewed"
              value={stats.reviewedThisWeek}
              tone="success"
              sublabel="this week"
            />
            <StatCard
              icon={TrendingUp}
              label="Total volume"
              value={stats.totalThisMonth}
              tone="neutral"
              sublabel="last 30 days"
            />
          </div>
        </div>
      </header>

      {error && (
        <div className="mx-6 md:mx-8 mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 text-amber-400 shrink-0" />
          <p className="text-[11.5px] text-amber-200">{error}</p>
        </div>
      )}

      {/* ── Body: list + detail ───────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* List pane */}
        <aside className="flex w-[440px] flex-col border-r border-border/60 bg-card/20">
          {/* Filters */}
          <div className="space-y-3 border-b border-border/40 p-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, body, or sender…"
                className="w-full rounded-md border border-border bg-background/50 pl-8 pr-8 py-2 text-[12px] placeholder:text-muted-foreground/60 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
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

            {/* Status tabs (prominent) */}
            <div className="flex rounded-md border border-border bg-background/40 p-0.5">
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
                      "flex-1 inline-flex items-center justify-center gap-1.5 rounded-sm px-2 py-1.5 text-[11px] font-semibold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow"
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
            <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <SlidersHorizontal className="h-3 w-3" />
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
                {filtered.length} {filtered.length === 1 ? "report" : "reports"}
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
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-[11.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading reports…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted/40">
                  <Inbox className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <p className="mt-4 text-[13px] font-semibold text-foreground">
                  {statusFilter === "submitted" && !hasAnyFilter
                    ? "Inbox zero"
                    : "No matches"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  {statusFilter === "submitted" && !hasAnyFilter
                    ? "No new reports from the team. Check back later, or switch tabs to see reviewed / archived ones."
                    : "Try changing the filters, or clear them to see everything."}
                </p>
                {hasAnyFilter && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 inline-flex items-center gap-1 rounded-md border border-border bg-background px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted/60 transition-colors"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {filtered.map((r) => (
                  <li key={r.id}>
                    <ReportRow
                      report={r}
                      active={r.id === selectedId}
                      onClick={() => setSelectedId(r.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Detail pane */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {selected ? (
            <ReportDetail report={selected} onReload={reload} key={selected.id} />
          ) : (
            <div className="flex h-full items-center justify-center text-center p-10">
              <div className="max-w-[300px]">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/40">
                  <Inbox className="h-7 w-7 text-muted-foreground/60" />
                </div>
                <p className="mt-4 text-[14px] font-semibold text-foreground">
                  Pick a report to read
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">
                  The left pane shows everything waiting for review. Click
                  any of them to open full details and add leadership notes.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sublabel, tone,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  sublabel: string;
  tone: "primary" | "danger" | "success" | "neutral" | "muted";
}) {
  const tones = {
    primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    danger:  { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-500/20" },
    success: { bg: "bg-emerald-500/10", text: "text-emerald-300", border: "border-emerald-500/20" },
    neutral: { bg: "bg-blue-500/10", text: "text-blue-300", border: "border-blue-500/20" },
    muted:   { bg: "bg-muted/40", text: "text-muted-foreground", border: "border-border" },
  }[tone];
  return (
    <div className={`rounded-lg border ${tones.border} bg-card/50 px-3.5 py-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-md ${tones.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${tones.text}`} />
        </div>
        <span className={`text-[22px] font-bold tabular-nums leading-none ${tones.text}`}>
          {value}
        </span>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-foreground">{label}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>
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
        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
        active
          ? "border-primary/60 bg-primary/[0.08] shadow-sm"
          : "border-transparent hover:border-border hover:bg-muted/40",
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={[
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            active ? "" : "bg-muted/60 text-muted-foreground",
          ].join(" ")}
          style={active ? { background: `${meta.accent}22`, color: meta.accent } : undefined}
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
            <span
              className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap ${PRIORITY_META[report.priority].cls}`}
            >
              {PRIORITY_META[report.priority].label}
            </span>
          </div>
          <p className="mt-1 text-[10.5px] text-muted-foreground truncate">
            {report._senderName}
            {report._senderRole && ` · ${report._senderRole}`}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[9.5px] text-muted-foreground/80">
            <span>
              {report.submitted_at
                ? new Date(report.submitted_at).toLocaleDateString()
                : new Date(report.created_at).toLocaleDateString()}
            </span>
            {report.status === "reviewed" && (
              <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold">
                <Eye className="h-2 w-2" />
                reviewed
              </span>
            )}
            {report.status === "archived" && (
              <span className="text-zinc-500 font-semibold">archived</span>
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
    if (!confirm("Archive this report? It'll move out of the active list. You can still see it in the Archived filter.")) return;
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

  return (
    <div className="max-w-[920px] mx-auto p-6 md:p-8 space-y-6">
      {/* Top strip: type + priority + status */}
      <div className="flex items-center flex-wrap gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
          style={{
            color: meta.accent,
            borderColor: `${meta.accent}40`,
            background: `${meta.accent}15`,
          }}
        >
          <TypeIcon className="h-3 w-3" />
          {meta.label}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PRIORITY_META[report.priority].cls}`}
        >
          {PRIORITY_META[report.priority].label} priority
        </span>
        {report.status === "reviewed" && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-2.5 py-1 text-[11px] font-semibold">
            <Eye className="h-3 w-3" />
            Reviewed
          </span>
        )}
        {report.status === "archived" && (
          <span className="rounded-full border border-zinc-600/40 bg-zinc-700/10 text-zinc-400 px-2.5 py-1 text-[11px] font-semibold">
            Archived
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-[24px] md:text-[28px] font-bold tracking-tight text-foreground leading-tight">
        {report.title}
      </h1>

      {/* Sender card */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card/40 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[13px]">
          {report._senderAvatar ? (
            <img
              src={report._senderAvatar}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            senderInitials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground truncate">
            {report._senderName}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {report._senderRole || "—"}
            {report.company && (
              <>
                {" · "}
                {report.company === "simplicity" ? "Simplicity" : "CodeWithAli"}
              </>
            )}
          </p>
        </div>
        <div className="text-right text-[10.5px] text-muted-foreground shrink-0">
          <p className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {report.submitted_at
              ? new Date(report.submitted_at).toLocaleString()
              : "Draft"}
          </p>
          {report._projectName && (
            <p className="inline-flex items-center gap-1 mt-0.5">
              <FolderKanban className="h-2.5 w-2.5" />
              {report._projectName}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      {report.body ? (
        <div className="rounded-lg border border-border bg-card/40 p-6">
          <StructuredBody body={report.body} />
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card/30 p-6 text-center">
          <p className="text-[12px] text-muted-foreground italic">
            No details provided — just the title.
          </p>
        </div>
      )}

      {/* Reviewed-at info (if reviewed) */}
      {report.reviewed_at && (
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground pl-1">
          <CalendarClock className="h-3 w-3" />
          <span>
            Reviewed on{" "}
            {new Date(report.reviewed_at).toLocaleString()}
          </span>
        </div>
      )}

      {/* Review action surface */}
      <div className="rounded-lg border border-border bg-card/50 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h2 className="text-[12.5px] font-mono uppercase tracking-widest text-primary font-bold">
            Leadership note
          </h2>
        </div>
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">
          Leave a note for the sender — feedback, follow-up questions, or just
          &quot;acknowledged&quot;. They&apos;ll see it on their end next to this report.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="Acknowledged. Let's pick this up in our 1-on-1."
          className="w-full resize-y rounded-md border border-border bg-background/50 px-3.5 py-3 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
        />

        {err && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {err}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {report.status === "submitted" && (
            <button
              type="button"
              onClick={markReviewed}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shadow"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Mark reviewed
            </button>
          )}
          {report.status === "reviewed" && (
            <>
              <button
                type="button"
                onClick={saveNotesOnly}
                disabled={saving || notes === (report.review_notes ?? "")}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save note
              </button>
              <button
                type="button"
                onClick={unreview}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[11.5px] font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <X className="h-3 w-3" />
                Un-review
              </button>
            </>
          )}
          {report.status !== "archived" && (
            <button
              type="button"
              onClick={archive}
              disabled={saving}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-[11.5px] font-medium text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              <Archive className="h-3 w-3" />
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Structured body renderer ───────────────────────────────────
//
// The submission form serializes template fields as
//   Label:
//   value content
//
//   (blank line)
//   Next Label:
//   value content
//
// We try to detect that structure and render each block as a
// proper headed section. If the body doesn't match (plain text /
// freeform / legacy reports), we fall back to a whitespace-
// preserving paragraph render.

function StructuredBody({ body }: { body: string }) {
  const sections = useMemo(() => parseStructuredBody(body), [body]);

  if (!sections) {
    // Freeform — render as preserved prose.
    return (
      <p className="text-[13.5px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
        {body}
      </p>
    );
  }

  return (
    <div className="space-y-5">
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

/**
 * Parse "Label:\nvalue\n\n..." into an ordered list of
 * { label, value }. Returns null if the body doesn't look
 * structured — caller falls back to plain render.
 */
function parseStructuredBody(
  body: string,
): Array<{ label: string; value: string }> | null {
  const lines = body.split("\n");
  // A structured body starts with a label line: "Something:"
  // followed by at least one non-empty value line.
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
    // A label line must: start at col 0, end with a colon, and be
    // followed (eventually) by a non-empty value. Allow 2-80 chars
    // of label text so random colons in prose don't get picked up.
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

  // Require at least 2 sections, else assume unstructured.
  if (sections.length < 2) return null;

  // Each section value must be non-empty after trim.
  if (sections.some((s) => s.value.length === 0)) return null;

  return sections;
}

// ── Sub-components ──────────────────────────────────────────────

function TinySelect({
  value, onChange, options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex-1 rounded-md border border-border bg-background/50 px-2 py-1.5 text-[10.5px] text-foreground outline-none focus:border-primary/50 cursor-pointer"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}
