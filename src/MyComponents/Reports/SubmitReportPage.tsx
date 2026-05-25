/**
 * SubmitReportPage.tsx — Primary surface for writing reports.
 *
 * Built around three answers a new user needs:
 *   1. WHAT is a report and WHY should I write one
 *      → editorial hero block at the top with a clear blurb
 *   2. WHEN do I need to submit one
 *      → "Due this week" cards driven by report_assignments
 *   3. HOW do I start
 *      → "Recommended for you" template gallery keyed to the
 *        user's role, plus a clean submission form
 *
 * Layout: single-column editorial document, max-width capped so
 * the writing surface stays readable. Each section uses the
 * mono-uppercase eyebrow + heavy title pattern from /onboarding.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Loader2, AlertCircle, Clock, Eye, FileText, FolderKanban,
  ClipboardList, AlertTriangle, MessageSquare, CheckCircle2,
  CalendarDays, Sparkles, ArrowRight, Inbox,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import {
  REPORT_TEMPLATES,
  recommendationsForRole,
  renderTemplateScaffold,
  type ReportTypeKey,
  type ReportTemplate,
  type RoleRecommendation,
} from "@/MyComponents/SettingNavComponents/reportTemplates";

// ── Types ───────────────────────────────────────────────────────

type ReportPriority = "low" | "normal" | "high" | "urgent";
type ReportStatus = "draft" | "submitted" | "reviewed" | "archived";

interface ReportRow {
  id: string;
  title: string;
  body: string | null;
  type: ReportTypeKey;
  priority: ReportPriority;
  project_id: string | null;
  status: ReportStatus;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

interface Assignment {
  id: string;
  assignee_username: string;
  type: ReportTypeKey;
  template_id: string;
  title: string;
  due_date: string;             // ISO date
  recurrence: "none" | "weekly" | "biweekly" | "monthly";
  status: "pending" | "submitted" | "canceled";
  submitted_report_id: string | null;
  notes: string | null;
  created_by: string;
}

interface ProjectLite {
  id: string;
  name: string;
  company: string;
}

const TYPE_LABELS: Record<ReportTypeKey, string> = {
  status: "Status",
  project_update: "Project",
  incident: "Incident",
  feedback: "Feedback",
  other: "Other",
};

const TYPE_META: Record<ReportTypeKey, { icon: typeof FileText; rail: string }> = {
  status:         { icon: ClipboardList,  rail: "#60a5fa" },
  project_update: { icon: FolderKanban,   rail: "#a78bfa" },
  incident:       { icon: AlertTriangle,  rail: "#f87171" },
  feedback:       { icon: MessageSquare,  rail: "#4ade80" },
  other:          { icon: FileText,       rail: "#a1a1aa" },
};

const PRIORITY_LABELS: Record<ReportPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

// ── Main ────────────────────────────────────────────────────────

export function SubmitReportPage() {
  const { data: currentUser } = ActiveUser();
  const me = currentUser?.[0];
  const username = (me as any)?.username ?? "";
  const role = (me as any)?.role ?? "";
  const mySupaId = (me as any)?.supa_id as string | undefined;
  const company = (me as any)?.company === "simplicity" ? "simplicity" : "codewithali";

  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [myReports, setMyReports] = useState<ReportRow[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [type, setType] = useState<ReportTypeKey>("status");
  const [priority, setPriority] = useState<ReportPriority>("normal");
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<string>("weekly-checkin");
  const [body, setBody] = useState<string>("");
  // When a user clicks "Start" on a recommended template or
  // assignment, we remember which assignment they're fulfilling
  // so we can mark it submitted on save.
  const [fulfilingAssignmentId, setFulfilingAssignmentId] = useState<string | null>(null);

  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const templatesForType = REPORT_TEMPLATES[type] ?? [];
  const template: ReportTemplate | undefined =
    templatesForType.find((t) => t.id === templateId) ?? templatesForType[0];

  const recommendations = useMemo(() => recommendationsForRole(role), [role]);

  // ── Initial data load ─────────────────────────────────────
  const reload = async () => {
    setLoading(true);
    const [p, r, a] = await Promise.all([
      supabase.from("projects").select("id, name, company").order("name"),
      mySupaId
        ? supabase
            .from("reports")
            .select(
              "id, title, body, type, priority, project_id, status, review_notes, submitted_at, reviewed_at",
            )
            .eq("sender_user_id", mySupaId)
            .order("created_at", { ascending: false })
            .limit(15)
        : Promise.resolve({ data: [], error: null } as any),
      username
        ? supabase
            .from("report_assignments")
            .select("*")
            .eq("assignee_username", username)
            .eq("status", "pending")
            .order("due_date", { ascending: true })
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    setProjects((p.data ?? []) as ProjectLite[]);
    setMyReports((r.data ?? []) as ReportRow[]);
    // Assignments table might not exist yet — silently treat as empty.
    if (a.error) {
      const msg = (a.error.message || "").toLowerCase();
      if (!msg.includes("does not exist") && (a.error as any).code !== "42P01") {
        console.warn("[submit] assignments fetch failed:", a.error.message);
      }
      setAssignments([]);
    } else {
      setAssignments((a.data ?? []) as Assignment[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySupaId, username]);

  // ── Template change → re-seed body if pristine ────────────
  useEffect(() => {
    if (!template) return;
    const scaffold = renderTemplateScaffold(template);
    if (!body.trim() || isAnyTemplateScaffold(body)) {
      setBody(scaffold);
    }
    const allDefaults = new Set(
      templatesForType.map((t) => t.defaultTitle).filter(Boolean),
    );
    if (!title.trim() || allDefaults.has(title.trim())) {
      setTitle(template.defaultTitle);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, type]);

  // ── Actions ───────────────────────────────────────────────
  const startWithRecommendation = (rec: RoleRecommendation) => {
    setType(rec.type);
    setTemplateId(rec.templateId);
    setFulfilingAssignmentId(null);
    // Scroll the form into view + focus title for a clean start.
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      titleRef.current?.focus();
    }, 50);
  };

  const startFromAssignment = (a: Assignment) => {
    setType(a.type);
    setTemplateId(a.template_id);
    setTitle(a.title);
    setFulfilingAssignmentId(a.id);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      titleRef.current?.focus();
    }, 50);
  };

  const submit = async () => {
    if (!mySupaId) {
      setSubmitError("Your account is not fully provisioned. Contact an admin.");
      setSubmitState("error");
      return;
    }
    if (!title.trim()) {
      setSubmitError("Title is required.");
      setSubmitState("error");
      titleRef.current?.focus();
      return;
    }

    setSubmitState("submitting");
    setSubmitError(null);

    const cleanedBody = stripEmptyScaffoldHeadings(body).trim();

    const { data: inserted, error } = await supabase
      .from("reports")
      .insert({
        title: title.trim(),
        body: cleanedBody || null,
        type,
        priority,
        project_id: projectId || null,
        sender_user_id: mySupaId,
        company,
        status: "submitted",
      })
      .select("id")
      .single();

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("does not exist") || (error as any).code === "42P01") {
        setSubmitError("Reports table is not set up. Run migrations/reports_init.sql.");
      } else {
        setSubmitError(error.message);
      }
      setSubmitState("error");
      return;
    }

    // If this fulfils an assignment, mark it submitted + spawn
    // the next occurrence if it's recurring. Best-effort — a
    // missing report_assignments table just no-ops.
    if (fulfilingAssignmentId && inserted?.id) {
      const a = assignments.find((x) => x.id === fulfilingAssignmentId);
      const now = new Date().toISOString();
      await supabase
        .from("report_assignments")
        .update({
          status: "submitted",
          submitted_report_id: inserted.id,
          submitted_at: now,
        })
        .eq("id", fulfilingAssignmentId)
        .then(() => null, () => null);

      // Spawn next occurrence for recurring assignments.
      if (a && a.recurrence !== "none") {
        const next = new Date(a.due_date);
        const days = a.recurrence === "weekly" ? 7
                   : a.recurrence === "biweekly" ? 14
                   : 30;
        next.setDate(next.getDate() + days);
        await supabase
          .from("report_assignments")
          .insert({
            assignee_username: a.assignee_username,
            type: a.type,
            template_id: a.template_id,
            title: a.title,
            due_date: next.toISOString().slice(0, 10),
            recurrence: a.recurrence,
            status: "pending",
            notes: a.notes,
            created_by: a.created_by,
            company,
          })
          .then(() => null, () => null);
      }
    }

    setSubmitState("sent");
    setFulfilingAssignmentId(null);
    setTitle("");
    setBody("");
    setPriority("normal");
    setProjectId("");
    await reload();
    setTimeout(() => setSubmitState("idle"), 3500);
  };

  // ── Render ────────────────────────────────────────────────

  const TypeIcon = TYPE_META[type].icon;

  // Bucket assignments: overdue / due-this-week / due-later
  const today = startOfDay(new Date());
  const weekFromNow = new Date(today); weekFromNow.setDate(weekFromNow.getDate() + 7);
  const overdue = assignments.filter((a) => new Date(a.due_date) < today);
  const dueSoon = assignments.filter((a) => {
    const d = new Date(a.due_date);
    return d >= today && d <= weekFromNow;
  });
  const dueLater = assignments.filter((a) => new Date(a.due_date) > weekFromNow);

  return (
    <div className="h-svh min-h-0 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-[860px] px-6 md:px-10 py-8 md:py-12 space-y-12">
        {/* ── Hero — what is this page, why am I here ───────── */}
        <Hero
          username={username}
          role={role}
          overdueCount={overdue.length}
          dueSoonCount={dueSoon.length}
          onViewInbox={() => navigate({ to: "/reports" }).catch(() => {})}
        />

        {/* ── Assignments — what you owe ────────────────────── */}
        {(overdue.length > 0 || dueSoon.length > 0 || dueLater.length > 0) && (
          <section className="space-y-4">
            <SectionEyebrow eyebrow="§ 01" title="Assigned to you" hint={`${overdue.length + dueSoon.length + dueLater.length} open`} />
            {overdue.length > 0 && (
              <AssignmentGroup
                label="Overdue"
                tone="danger"
                assignments={overdue}
                onStart={startFromAssignment}
              />
            )}
            {dueSoon.length > 0 && (
              <AssignmentGroup
                label="Due this week"
                tone="warning"
                assignments={dueSoon}
                onStart={startFromAssignment}
              />
            )}
            {dueLater.length > 0 && (
              <AssignmentGroup
                label="Coming up"
                tone="neutral"
                assignments={dueLater.slice(0, 5)}
                onStart={startFromAssignment}
              />
            )}
          </section>
        )}

        {/* ── Recommendations for your role ─────────────────── */}
        <section className="space-y-4">
          <SectionEyebrow
            eyebrow="§ 02"
            title="Recommended for you"
            hint={role ? `Based on your role · ${role}` : undefined}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            {recommendations.map((rec) => (
              <RecommendationCard
                key={`${rec.type}/${rec.templateId}`}
                rec={rec}
                onStart={() => startWithRecommendation(rec)}
              />
            ))}
          </div>
        </section>

        {/* ── Write a report — the form ──────────────────────  */}
        <section ref={formRef} className="space-y-4">
          <SectionEyebrow eyebrow="§ 03" title="Write a report" hint="Goes to CEO · COO · CFO · Admin" />

          {/* If we're fulfilling an assignment, show a banner */}
          {fulfilingAssignmentId && (() => {
            const a = assignments.find((x) => x.id === fulfilingAssignmentId);
            if (!a) return null;
            return (
              <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/[0.06] px-4 py-3">
                <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-foreground">
                    Fulfilling assignment from {a.created_by}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Due {formatDue(a.due_date)} · Submitting will mark it done
                    {a.recurrence !== "none" && (
                      <span> and spawn the next {a.recurrence} occurrence</span>
                    )}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFulfilingAssignmentId(null)}
                  className="text-[10.5px] font-semibold text-muted-foreground hover:text-foreground shrink-0"
                >
                  Detach
                </button>
              </div>
            );
          })()}

          <div className="rounded-lg border border-border bg-muted/30 p-5 md:p-6 space-y-4">
            {/* Title */}
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Title — what's this report about?"
              className="w-full bg-transparent border-0 px-0 py-1 text-[20px] font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-0"
            />

            {/* Metadata row */}
            <div className="flex items-center flex-wrap gap-2 pb-3 border-b border-border/60">
              <MetaSelect
                icon={TypeIcon}
                value={type}
                onChange={(v) => setType(v as ReportTypeKey)}
                options={(Object.keys(TYPE_LABELS) as ReportTypeKey[]).map((k) => [
                  k, TYPE_LABELS[k],
                ])}
              />
              {templatesForType.length > 0 && (
                <MetaSelect
                  value={templateId}
                  onChange={(v) => setTemplateId(v)}
                  options={templatesForType.map((t) => [t.id, t.name])}
                />
              )}
              <MetaSelect
                value={priority}
                onChange={(v) => setPriority(v as ReportPriority)}
                options={(Object.keys(PRIORITY_LABELS) as ReportPriority[]).map((k) => [
                  k, `${PRIORITY_LABELS[k]} priority`,
                ])}
              />
              {type === "project_update" && (
                <MetaSelect
                  value={projectId}
                  onChange={setProjectId}
                  placeholder="No project"
                  options={[
                    ["", "No project"],
                    ...projects.map((p): [string, string] => [
                      p.id,
                      `${p.name} · ${p.company === "simplicity" ? "Simplicity" : "CWA"}`,
                    ]),
                  ]}
                />
              )}
              {template?.blurb && (
                <span className="ml-auto text-[10.5px] text-muted-foreground/80 italic">
                  {template.blurb}
                </span>
              )}
            </div>

            {/* Body */}
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              placeholder="Write your report."
              className="w-full resize-y bg-transparent border-0 px-0 py-2 text-[14px] text-foreground/95 placeholder:text-muted-foreground/40 leading-[1.65] outline-none focus:ring-0"
              style={{
                fontFamily:
                  'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
            />

            {/* Submit row */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/60">
              <div className="text-[11.5px] text-muted-foreground min-w-0 flex-1">
                {submitState === "sent" && (
                  <span className="inline-flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Submitted. Leadership has it.
                  </span>
                )}
                {submitState === "error" && (
                  <span className="inline-flex items-center gap-1 text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    {submitError ?? "Failed to submit."}
                  </span>
                )}
                {submitState === "idle" && (
                  <span>Goes to CEO · COO · CFO · Admin.</span>
                )}
                {submitState === "submitting" && (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Sending…
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={submit}
                disabled={submitState === "submitting" || !title.trim()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitState === "submitting" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {submitState === "submitting" ? "Submitting" : "Submit report"}
              </button>
            </div>
          </div>
        </section>

        {/* ── Your recent submissions ───────────────────────── */}
        <section className="space-y-4">
          <SectionEyebrow
            eyebrow="§ 04"
            title="Your recent submissions"
            hint={myReports.length > 0 ? `${myReports.length} submitted` : undefined}
          />
          {loading ? (
            <p className="text-[11.5px] text-muted-foreground inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading…
            </p>
          ) : myReports.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-card/30 p-6 text-center">
              <p className="text-[12.5px] text-foreground/80">
                Nothing yet. Pick a template above to get started.
              </p>
            </div>
          ) : (
            <ul className="rounded-md border border-border bg-muted/30 divide-y divide-border/60 overflow-hidden">
              {myReports.map((r) => (
                <RecentRow key={r.id} report={r} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────

function Hero({
  username, role, overdueCount, dueSoonCount, onViewInbox,
}: {
  username: string;
  role: string;
  overdueCount: number;
  dueSoonCount: number;
  onViewInbox: () => void;
}) {
  // Build a single-line "what's the state of your reporting"
  // summary so the user knows at a glance whether they're caught
  // up or behind. Phrases swap by count for a more human feel.
  const stateLine = (() => {
    if (overdueCount > 0) {
      return (
        <>
          You have <span className="text-red-400 font-semibold">{overdueCount}</span> overdue
          {dueSoonCount > 0 && (
            <> and <span className="text-amber-400 font-semibold">{dueSoonCount}</span> due this week</>
          )}.
        </>
      );
    }
    if (dueSoonCount > 0) {
      return (
        <>
          You have <span className="text-amber-400 font-semibold">{dueSoonCount}</span> due this week.
        </>
      );
    }
    return <>Nothing&apos;s overdue — write something proactive while you have the cycles.</>;
  })();

  return (
    <header className="space-y-3">
      <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground">
        <Sparkles className="h-3 w-3 text-primary" />
        Reports · Writer
      </div>
      <h1 className="text-[2rem] md:text-[2.4rem] font-semibold tracking-tight text-foreground leading-[1.05]">
        Tell leadership what&apos;s going on.
      </h1>
      <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-[640px]">
        Reports are how the team keeps leadership in the loop without endless
        meetings — a structured note that ships once, gets reviewed once,
        and gets you back to building. Hi {username || "there"}
        {role && <> · {role}</>}. {stateLine}
      </p>
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={onViewInbox}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/40 px-3 py-1.5 text-[11.5px] font-semibold text-foreground/85 hover:bg-muted/60 hover:text-foreground transition-colors"
        >
          <Inbox className="h-3.5 w-3.5" />
          See the inbox
          <ArrowRight className="h-3 w-3 opacity-60" />
        </button>
      </div>
    </header>
  );
}

// ── Section eyebrow ─────────────────────────────────────────────

function SectionEyebrow({
  eyebrow, title, hint,
}: {
  eyebrow: string;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-b border-border/60 pb-2">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-muted-foreground/80">
        {eyebrow}
      </p>
      <h2 className="text-[14px] font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      {hint && (
        <p className="ml-auto text-[10.5px] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  );
}

// ── Recommendation card ─────────────────────────────────────────

function RecommendationCard({
  rec, onStart,
}: {
  rec: RoleRecommendation;
  onStart: () => void;
}) {
  const meta = TYPE_META[rec.type];
  const Icon = meta.icon;
  const tpl = REPORT_TEMPLATES[rec.type].find((t) => t.id === rec.templateId);
  return (
    <button
      type="button"
      onClick={onStart}
      className="group relative overflow-hidden rounded-lg border border-border bg-muted/30 hover:bg-muted/50 hover:border-foreground/30 text-left transition-colors p-4"
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
        style={{ background: meta.rail }}
      />
      <div className="pl-2 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4" style={{ color: meta.rail }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-foreground tracking-tight truncate">
              {tpl?.name ?? rec.templateId}
            </p>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/80 shrink-0">
              {rec.cadence}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground leading-relaxed">
            {rec.reason}
          </p>
          <p className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            Start <ArrowRight className="h-3 w-3" />
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Assignment group ────────────────────────────────────────────

function AssignmentGroup({
  label, tone, assignments, onStart,
}: {
  label: string;
  tone: "danger" | "warning" | "neutral";
  assignments: Assignment[];
  onStart: (a: Assignment) => void;
}) {
  const tones = {
    danger:  { dot: "bg-red-500",    label: "text-red-400" },
    warning: { dot: "bg-amber-400",  label: "text-amber-400" },
    neutral: { dot: "bg-zinc-400",   label: "text-muted-foreground" },
  }[tone];

  return (
    <div className="space-y-2">
      <p className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] ${tones.label}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${tones.dot}`} />
        {label} · {assignments.length}
      </p>
      <div className="space-y-1.5">
        {assignments.map((a) => (
          <AssignmentRow key={a.id} assignment={a} onStart={() => onStart(a)} />
        ))}
      </div>
    </div>
  );
}

function AssignmentRow({
  assignment, onStart,
}: {
  assignment: Assignment;
  onStart: () => void;
}) {
  const meta = TYPE_META[assignment.type];
  const Icon = meta.icon;
  return (
    <div className="group relative flex items-center gap-3 rounded-md border border-border bg-muted/30 hover:border-foreground/30 transition-colors px-3 py-2.5">
      <span
        aria-hidden="true"
        className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
        style={{ background: meta.rail }}
      />
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted ml-1.5">
        <Icon className="h-3.5 w-3.5" style={{ color: meta.rail }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-foreground tracking-tight truncate">
          {assignment.title}
        </p>
        <p className="mt-0.5 text-[10.5px] text-muted-foreground inline-flex items-center gap-1.5">
          <CalendarDays className="h-3 w-3 opacity-60" />
          Due {formatDue(assignment.due_date)}
          {assignment.recurrence !== "none" && (
            <>
              <span className="opacity-50">·</span>
              <span>{assignment.recurrence}</span>
            </>
          )}
          {assignment.notes && (
            <>
              <span className="opacity-50">·</span>
              <span className="truncate max-w-[280px]">{assignment.notes}</span>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground/90 hover:bg-muted/60 hover:text-foreground transition-colors shrink-0"
      >
        Start
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

// ── Recent row ──────────────────────────────────────────────────

function RecentRow({ report }: { report: ReportRow }) {
  const meta = TYPE_META[report.type];
  const Icon = meta.icon;
  return (
    <li className="px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-3.5 w-3.5" style={{ color: meta.rail }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-medium text-foreground truncate tracking-tight">
              {report.title}
            </p>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
              {report.submitted_at
                ? new Date(report.submitted_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "draft"}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <span>{TYPE_LABELS[report.type]}</span>
            <span className="opacity-50">·</span>
            <span>{PRIORITY_LABELS[report.priority]}</span>
            <span className="opacity-50">·</span>
            <StatusLabel status={report.status} reviewed={!!report.reviewed_at} />
          </div>
          {report.review_notes && (
            <div className="mt-2 border-l-2 border-primary/40 pl-2.5 py-0.5">
              <p className="text-[9.5px] font-mono uppercase tracking-widest text-muted-foreground">
                Leadership note
              </p>
              <p className="mt-0.5 text-[11.5px] text-foreground/90 leading-snug whitespace-pre-wrap">
                {report.review_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusLabel({
  status, reviewed,
}: {
  status: ReportStatus;
  reviewed: boolean;
}) {
  if (status === "reviewed" || reviewed) {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400">
        <Eye className="h-2.5 w-2.5" />
        Reviewed
      </span>
    );
  }
  if (status === "archived") {
    return <span className="text-muted-foreground">Archived</span>;
  }
  return <span className="text-primary">Submitted</span>;
}

// ── MetaSelect (form metadata row) ──────────────────────────────

function MetaSelect({
  icon: Icon, value, onChange, options, placeholder,
}: {
  icon?: typeof FileText;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  placeholder?: string;
}) {
  const current = options.find(([v]) => v === value)?.[1] ?? placeholder ?? "—";
  return (
    <div className="relative inline-flex items-center">
      {Icon && (
        <Icon className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "appearance-none rounded-sm border border-border bg-background text-foreground/90 hover:bg-muted/40 hover:text-foreground transition-colors outline-none focus:border-primary/50",
          "py-1 pr-7 text-[11.5px] font-medium cursor-pointer",
          Icon ? "pl-6" : "pl-2.5",
        ].join(" ")}
        title={current}
      >
        {options.map(([v, label]) => (
          <option key={v || "__empty"} value={v}>
            {label}
          </option>
        ))}
      </select>
      <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[9px]">
        ▾
      </span>
    </div>
  );
}

// ── helpers ─────────────────────────────────────────────────────

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function formatDue(dueDate: string): string {
  const d = new Date(dueDate);
  const today = startOfDay(new Date());
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < -1) return `${Math.abs(diff)} days ago`;
  if (diff === -1) return "yesterday";
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff < 7) return `in ${diff} days`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isAnyTemplateScaffold(body: string): boolean {
  for (const typeKey of Object.keys(REPORT_TEMPLATES) as ReportTypeKey[]) {
    for (const tpl of REPORT_TEMPLATES[typeKey]) {
      if (renderTemplateScaffold(tpl) === body) return true;
    }
  }
  return false;
}

function stripEmptyScaffoldHeadings(body: string): string {
  const lines = body.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const isHeading = /^[A-Z][^:]{0,80}(?: \(optional\))?:\s*$/.test(line.trim());
    if (!isHeading) {
      out.push(line);
      continue;
    }
    let hasContent = false;
    for (let j = i + 1; j < lines.length; j++) {
      const peek = lines[j] ?? "";
      const peekIsHeading = /^[A-Z][^:]{0,80}(?: \(optional\))?:\s*$/.test(peek.trim());
      if (peekIsHeading) break;
      if (peek.trim() !== "") { hasContent = true; break; }
    }
    if (hasContent) {
      out.push(line.replace(/ \(optional\):/, ":"));
    }
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

// Silence lint for icon imports we kept around for future use.
void Clock;
