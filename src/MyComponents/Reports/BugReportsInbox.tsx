/**
 * BugReportsInbox.tsx — Triage inbox for the bug_reports table.
 *
 * Tab-mate of ReportsInbox under /reports. List + detail layout:
 *   · Left list pane shows reports with severity dot + area pill
 *     + reporter; clickable to load detail.
 *   · Right detail pane shows full description, repro steps,
 *     screenshot, page URL, browser info, console + network logs,
 *     plus triage controls (status, resolution notes).
 *
 * Status workflow: open → in_progress → resolved | wontfix
 *
 * Visual language matches ReportsInbox so flipping between the
 * two tabs feels like the same app, not two apps.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Bug, Search, Loader2, AlertCircle, RefreshCw, Check, X,
  Clock, Image as ImageIcon, ChevronDown, Globe, Wifi, Terminal,
  Save,
} from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import React from "react";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";

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

const SEVERITY_META: Record<
  Severity,
  { label: string; dot: string; chip: string; rail: string }
> = {
  low:      { label: "Low",      dot: "bg-zinc-400",     chip: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300",      rail: "#71717a" },
  medium:   { label: "Medium",   dot: "bg-blue-400",     chip: "border-blue-500/40 bg-blue-500/10 text-blue-300",      rail: "#3b82f6" },
  high:     { label: "High",     dot: "bg-orange-400",   chip: "border-orange-500/40 bg-orange-500/10 text-orange-300", rail: "#f97316" },
  critical: { label: "Critical", dot: "bg-red-500",      chip: "border-red-500/50 bg-red-500/10 text-red-300",         rail: "#ef4444" },
};

const STATUS_META: Record<
  Status,
  { label: string; chip: string }
> = {
  open:        { label: "Open",         chip: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  in_progress: { label: "In progress",  chip: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  resolved:    { label: "Resolved",     chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" },
  wontfix:     { label: "Won't fix",    chip: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" },
};

const AREA_LABEL: Record<Area, string> = {
  chat: "Chat", huddle: "Huddle", onboarding: "Onboarding",
  hiring: "Hiring", reports: "Reports", tasks: "Tasks",
  axon: "Axon", other: "Other",
};

const ADMIN_ROLES = new Set(["CEO", "COO", "CFO", "Admin", "admin"]);

export function BugReportsInbox() {
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<Status | "all">("open");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");

  const { data: me } = ActiveUser();
  const username = (me?.[0] as any)?.username ?? "";
  const myRole = (me?.[0] as any)?.role ?? "";
  const isAdmin = ADMIN_ROLES.has(myRole);

  const reload = async () => {
    setLoading((cur) => (reports.length === 0 ? true : cur));
    setRefreshing(true);
    setError(null);

    const { data, error: err } = await supabase
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
    // Non-admins only see their own. The RLS policy permits all
    // reads (we keep it simple SQL-side), but the UI gates it so
    // the inbox isn't a leaky surface for non-leadership users.
    const visible = isAdmin
      ? rows
      : rows.filter((r) => r.reporter_username === username);

    setReports(visible);
    setLoading(false);
    setRefreshing(false);

    if (!selectedId && visible.length > 0) {
      setSelectedId(visible[0]!.id);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, isAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && r.severity !== severityFilter) return false;
      if (q) {
        const hay = `${r.title} ${r.description} ${r.reporter_username}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, statusFilter, severityFilter, search]);

  const selected = reports.find((r) => r.id === selectedId) ?? null;

  // Counts for the segmented status tabs.
  const statusCounts = useMemo(() => {
    const out: Record<Status, number> = { open: 0, in_progress: 0, resolved: 0, wontfix: 0 };
    for (const r of reports) out[r.status] = (out[r.status] ?? 0) + 1;
    return out;
  }, [reports]);

  return (
    <div className="flex flex-1 min-h-0">
      {/* List pane */}
      <aside className="flex w-[480px] shrink-0 flex-col border-r border-border/60 bg-card/15">
        <div className="space-y-3 border-b border-border/40 px-5 py-4 bg-card/30 backdrop-blur-sm">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, or reporter…"
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

          {/* Status segmented control */}
          <div className="flex rounded-lg border border-border/60 bg-background/40 p-0.5">
            {([
              ["open",        "Open",        statusCounts.open],
              ["in_progress", "Working",     statusCounts.in_progress],
              ["resolved",    "Resolved",    null],
              ["all",         "All",         null],
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

          {/* Severity filter + refresh */}
          <div className="flex items-center justify-between gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="appearance-none rounded-md border border-border/70 bg-background/40 pl-2 pr-6 py-1 text-[10.5px] font-semibold text-foreground/90 outline-none cursor-pointer hover:bg-muted/40"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical only</option>
              <option value="high">High only</option>
              <option value="medium">Medium only</option>
              <option value="low">Low only</option>
            </select>
            <button
              type="button"
              onClick={reload}
              disabled={refreshing}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-2 text-[11.5px] text-amber-200 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-[11.5px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading bug reports…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                  <Check className="h-6 w-6 text-emerald-300" />
                </div>
                <p className="mt-4 text-[13px] font-semibold text-foreground">
                  No bugs in this view
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed max-w-[260px]">
                  {statusFilter === "open"
                    ? "Either the team is shipping clean, or no one has reported anything yet."
                    : "Try a different filter to see other reports."}
                </p>
              </div>
            </div>
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
                <BugRow
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
          <BugDetail
            key={selected.id}
            report={selected}
            isAdmin={isAdmin}
            currentUsername={username}
            onReload={reload}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center p-10">
            <div className="max-w-[320px]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/40">
                <Bug className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="mt-4 text-[14px] font-semibold text-foreground">
                Pick a report to triage
              </p>
              <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
                {isAdmin
                  ? "Everything users have reported sits in the left pane. Open one to see logs + screenshots + repro steps."
                  : "You're only seeing reports you submitted. Engineering sees the full inbox."}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── List row ─────────────────────────────────────────────────────

function BugRow({
  report, active, onClick,
}: {
  report: BugReport;
  active: boolean;
  onClick: () => void;
}) {
  const sev = SEVERITY_META[report.severity];
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
      {/* Severity rail */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
        style={{ background: sev.rail, opacity: active ? 1 : 0.45 }}
      />
      <div className="flex items-start gap-2.5 pl-1.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
          <Bug className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p
              className={[
                "text-[12.5px] truncate",
                report.status === "open"
                  ? "font-bold text-foreground"
                  : "font-medium text-foreground/90",
              ].join(" ")}
            >
              {report.title}
            </p>
            <span
              className={`mt-1 h-2 w-2 shrink-0 rounded-full ${sev.dot}`}
              title={sev.label}
            />
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground truncate">
            {report.reporter_username}
            {report.reporter_role && (
              <span className="opacity-70"> · {report.reporter_role}</span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-2 text-[9.5px] text-muted-foreground/80">
            <span>{new Date(report.created_at).toLocaleDateString()}</span>
            <span className="opacity-40">·</span>
            <span>{AREA_LABEL[report.area]}</span>
            <span className="opacity-40">·</span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold border ${STATUS_META[report.status].chip}`}
            >
              {STATUS_META[report.status].label}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Detail pane ──────────────────────────────────────────────────

function BugDetail({
  report, isAdmin, currentUsername, onReload,
}: {
  report: BugReport;
  isAdmin: boolean;
  currentUsername: string;
  onReload: () => void;
}) {
  const [status, setStatus] = useState<Status>(report.status);
  const [resolutionNotes, setResolutionNotes] = useState(report.resolution_notes ?? "");
  const [logsTab, setLogsTab] = useState<"console" | "network" | "browser">("console");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sev = SEVERITY_META[report.severity];

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
    const { error } = await supabase
      .from("bug_reports")
      .update(patch)
      .eq("id", report.id);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    onReload();
  };

  const dirty =
    status !== report.status ||
    resolutionNotes !== (report.resolution_notes ?? "");

  return (
    <div className="flex h-full flex-col">
      <div
        className="w-full shrink-0"
        style={{ height: "3px", background: `linear-gradient(90deg, ${sev.rail}, ${sev.rail}33)` }}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[820px] mx-auto w-full px-7 py-7 space-y-6">
          {/* Header: title + chips */}
          <div>
            <div className="flex flex-wrap items-center gap-2 text-[10.5px] mb-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold ${sev.chip}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                {sev.label}
              </span>
              <span className={`inline-flex rounded-full border px-2 py-0.5 font-bold ${STATUS_META[report.status].chip}`}>
                {STATUS_META[report.status].label}
              </span>
              <span className="rounded-full border border-border/60 bg-card/40 px-2 py-0.5 text-muted-foreground/90">
                {AREA_LABEL[report.area]}
              </span>
              <span className="text-muted-foreground/70 ml-auto inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(report.created_at).toLocaleString(undefined, {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })}
              </span>
            </div>
            <h1 className="text-[1.55rem] font-black tracking-tight text-foreground leading-[1.15]">
              {report.title}
            </h1>
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">
              Reported by <span className="font-medium text-foreground/90">{report.reporter_username}</span>
              {report.reporter_role && <span> · {report.reporter_role}</span>}
              {report.reporter_email && <span> · {report.reporter_email}</span>}
            </p>
          </div>

          {/* Description */}
          <Section title="What happened">
            <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
              {report.description}
            </p>
          </Section>

          {/* Repro */}
          {report.repro_steps && (
            <Section title="Steps to reproduce">
              <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">
                {report.repro_steps}
              </p>
            </Section>
          )}

          {/* Screenshot */}
          {report.screenshot_url && (
            <Section title="Screenshot" icon={ImageIcon}>
              <a
                href={report.screenshot_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg border border-border/60 overflow-hidden bg-black/30"
              >
                <img
                  src={report.screenshot_url}
                  alt="Reporter screenshot"
                  className="w-full max-h-[480px] object-contain"
                />
              </a>
            </Section>
          )}

          {/* Page URL */}
          {report.page_url && (
            <Section title="Page" icon={Globe}>
              <code className="block rounded-md border border-border/60 bg-zinc-950/50 px-3 py-2 text-[11.5px] text-foreground/85 break-all">
                {report.page_url}
              </code>
            </Section>
          )}

          {/* Diagnostics — tabbed console / network / browser */}
          <Section title="Diagnostics" icon={Terminal}>
            <div className="rounded-xl border border-border/60 bg-zinc-950/50 overflow-hidden">
              <div className="flex border-b border-border/60 bg-card/40">
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
              <div className="max-h-[360px] overflow-y-auto p-3 text-[11px] font-mono leading-relaxed">
                {logsTab === "console" && <ConsoleLogs entries={report.console_logs ?? []} />}
                {logsTab === "network" && <NetworkLogs entries={report.network_logs ?? []} />}
                {logsTab === "browser" && <BrowserInfo info={report.browser_info ?? {}} />}
              </div>
            </div>
          </Section>

          {/* Spacer for sticky bar */}
          <div className="h-4" />
        </div>
      </div>

      {/* Triage bar (admins only) */}
      {isAdmin && (
        <div className="shrink-0 border-t border-border/60 bg-card/80 backdrop-blur px-6 py-3">
          <div className="max-w-[820px] mx-auto flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground shrink-0">
                Status
              </span>
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className="appearance-none rounded-md border border-border/70 bg-background/60 pl-3 pr-7 py-1.5 text-[12px] font-semibold text-foreground/90 outline-none cursor-pointer hover:bg-muted/40"
                >
                  {(Object.keys(STATUS_META) as Status[]).map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              </div>
              {report.triaged_by && (
                <span className="text-[10.5px] text-muted-foreground">
                  Last triaged by <span className="text-foreground/80">{report.triaged_by}</span>
                  {report.triaged_at && (
                    <> · {new Date(report.triaged_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</>
                  )}
                </span>
              )}
            </div>

            <textarea
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Resolution notes (what was the fix, what was the workaround)…"
              rows={3}
              className="w-full resize-y rounded-md border border-border/70 bg-background/60 px-3 py-2 text-[12px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/40"
            />

            {err && (
              <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[11.5px] text-red-300">
                {err}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
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
          </div>
        </div>
      )}
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────

function Section({
  title, icon: Icon, children,
}: {
  title: string;
  icon?: typeof Bug;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-widest text-muted-foreground">
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
        "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border-b-2 transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
      {children}
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
