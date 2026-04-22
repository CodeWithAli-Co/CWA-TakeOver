/**
 * reports.tsx (settings tab) — structured report submission.
 *
 * Layout philosophy: this is a form for working adults, not a
 * tutorial. No step numbers, no hero marketing card, no monospace
 * scratchpad. Just:
 *
 *   1. Report-type pill row
 *   2. Starting-framework row (templates for that type)
 *   3. Basics card (title, priority, project when relevant)
 *   4. Structured fields generated from the chosen template —
 *      each template field renders as a labeled input/textarea
 *   5. Submit
 *   6. Your recent reports
 *
 * When the user picks a template, the form expands to show real
 * labeled fields for each section of that template. Empty fields
 * are skipped on submit; values are serialized to a readable
 * "Label:\n<value>" body string that the inbox renders as prose.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Send, Loader2, Check, AlertCircle, Sparkles, AlertTriangle,
  MessageSquare, FileText, FolderKanban, ClipboardList,
  Clock, Eye, Pencil,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import {
  REPORT_TEMPLATES,
  serializeTemplate,
  type ReportTypeKey,
  type ReportTemplate,
} from "./reportTemplates";

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

interface ProjectLite {
  id: string;
  name: string;
  company: string;
}

const TYPE_META: Record<
  ReportTypeKey,
  { label: string; icon: typeof FileText; accent: string }
> = {
  status:         { label: "Status update",   icon: ClipboardList,  accent: "#3b82f6" },
  project_update: { label: "Project update",  icon: FolderKanban,   accent: "#8b5cf6" },
  incident:       { label: "Incident",        icon: AlertTriangle,  accent: "#ef4444" },
  feedback:       { label: "Feedback",        icon: MessageSquare,  accent: "#10b981" },
  other:          { label: "Other",           icon: FileText,       accent: "#64748b" },
};

const PRIORITY_META: Record<ReportPriority, { label: string; cls: string }> = {
  low:    { label: "Low",    cls: "border-zinc-500/40 bg-zinc-500/10 text-zinc-300" },
  normal: { label: "Normal", cls: "border-blue-500/40 bg-blue-500/10 text-blue-300" },
  high:   { label: "High",   cls: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  urgent: { label: "Urgent", cls: "border-red-500/40 bg-red-500/10 text-red-300" },
};

// ── Main component ──────────────────────────────────────────────

export default function ReportSettings() {
  const { data: currentUser } = ActiveUser();
  const me = currentUser?.[0];
  const mySupaId = me?.supa_id as string | undefined;

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [myReports, setMyReports] = useState<ReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  // Form state
  const [type, setType] = useState<ReportTypeKey>("status");
  const [priority, setPriority] = useState<ReportPriority>("normal");
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<string>("weekly-checkin");
  /** Values for each template field, keyed by field.key. Also
   *  stores a `__freeform` key for when no template is picked. */
  const [values, setValues] = useState<Record<string, string>>({});

  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const typeMeta = TYPE_META[type];
  const templatesForType = REPORT_TEMPLATES[type] ?? [];
  const template: ReportTemplate | undefined =
    templatesForType.find((t) => t.id === templateId) ?? templatesForType[0];

  // Re-pick default template when type changes.
  useEffect(() => {
    const first = REPORT_TEMPLATES[type]?.[0];
    if (first) {
      setTemplateId(first.id);
      // Seed title if user hasn't typed one.
      if (!title.trim()) {
        setTitle(first.defaultTitle);
      }
    }
    // Wipe field values since old ones won't match new fields.
    setValues({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // Re-seed title when template changes (unless user has edited it
  // to something non-empty and non-matching the old default).
  useEffect(() => {
    if (!template) return;
    // If title is empty OR equals any template's default for the
    // current type, treat it as "safe to replace".
    const allDefaults = new Set(
      templatesForType.map((t) => t.defaultTitle).filter(Boolean),
    );
    if (!title.trim() || allDefaults.has(title.trim())) {
      setTitle(template.defaultTitle);
    }
    // Wipe field values so stale keys don't bleed across templates.
    setValues({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  const reload = async () => {
    setLoadingReports(true);
    const [p, r] = await Promise.all([
      supabase.from("projects").select("id, name, company").order("name"),
      mySupaId
        ? supabase
            .from("reports")
            .select(
              "id, title, body, type, priority, project_id, status, review_notes, submitted_at, reviewed_at",
            )
            .eq("sender_user_id", mySupaId)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [], error: null } as any),
    ]);
    setProjects((p.data ?? []) as ProjectLite[]);
    setMyReports((r.data ?? []) as ReportRow[]);
    setLoadingReports(false);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySupaId]);

  const resetForm = () => {
    setType("status");
    setPriority("normal");
    setProjectId("");
    setTitle("");
    setTemplateId("weekly-checkin");
    setValues({});
  };

  // Body preview — used both for the Submit button's title and the
  // actual payload. When there's no template (Blank / freeform),
  // we fall back to the `__freeform` field.
  const buildBody = (): string => {
    if (!template || template.fields.length === 0) {
      return (values["__freeform"] ?? "").trim();
    }
    return serializeTemplate(template, values);
  };

  const submit = async () => {
    if (!mySupaId) {
      setSubmitError("Your account isn't fully provisioned. Contact an admin.");
      setSubmitState("error");
      return;
    }
    if (!title.trim()) {
      setSubmitError("Give the report a title.");
      setSubmitState("error");
      return;
    }
    setSubmitState("submitting");
    setSubmitError(null);

    const body = buildBody();

    const { error } = await supabase.from("reports").insert({
      title: title.trim(),
      body: body || null,
      type,
      priority,
      project_id: projectId || null,
      sender_user_id: mySupaId,
      company: me?.company === "simplicity" ? "simplicity" : "codewithali",
      status: "submitted",
    });

    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("does not exist") || (error as any).code === "42P01") {
        setSubmitError(
          "Reports table isn't set up yet. Ask an admin to run migrations/reports_init.sql.",
        );
      } else {
        setSubmitError(error.message);
      }
      setSubmitState("error");
      return;
    }

    setSubmitState("sent");
    resetForm();
    await reload();
    setTimeout(() => setSubmitState("idle"), 3500);
  };

  return (
    <div className="mx-auto max-w-[820px] space-y-6">
      {/* ─── Heading ─── */}
      <div>
        <h1 className="text-[20px] font-bold tracking-tight text-foreground">
          New report
        </h1>
        <p className="mt-1 text-[12.5px] text-muted-foreground">
          Send to CEO / COO / CFO. Pick a type + framework, fill in the
          relevant sections, submit.
        </p>
      </div>

      {/* ─── Type row ─── */}
      <Section
        label="Report type"
        hint="What kind of report is this?"
      >
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TYPE_META) as ReportTypeKey[]).map((t) => {
            const meta = TYPE_META[t];
            const Icon = meta.icon;
            const active = t === type;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={[
                  "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors",
                  active
                    ? "border-transparent text-white shadow-sm"
                    : "border-border bg-card/40 text-foreground/80 hover:text-foreground hover:bg-card/70",
                ].join(" ")}
                style={active ? { background: meta.accent } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ─── Template row ─── */}
      {templatesForType.length > 0 && (
        <Section
          label="Starting framework"
          hint="Each framework guides you through the right sections. You can leave fields blank."
        >
          <div className="flex flex-wrap gap-1.5">
            {templatesForType.map((tpl) => {
              const active = tpl.id === templateId;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplateId(tpl.id)}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] transition-colors",
                    active
                      ? "border-primary/60 bg-primary/10 text-primary font-semibold"
                      : "border-border bg-card/40 text-foreground/80 hover:text-foreground hover:bg-card/70 font-medium",
                  ].join(" ")}
                  title={tpl.blurb}
                >
                  {tpl.name}
                </button>
              );
            })}
          </div>
          {template && (
            <p className="mt-2 text-[11px] text-muted-foreground italic">
              {template.blurb}
            </p>
          )}
        </Section>
      )}

      {/* ─── Basics card ─── */}
      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          <h2 className="text-[12px] font-mono uppercase tracking-widest text-muted-foreground">
            Basics
          </h2>
        </div>

        <FieldLine
          label="Title"
          hint="One-line summary. Shows up as the subject in the inbox."
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            placeholder="Short, specific, action-oriented"
            className="w-full rounded-md border border-border bg-background/50 px-3.5 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </FieldLine>

        <div className="grid gap-5 md:grid-cols-2">
          <FieldLine label="Priority">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PRIORITY_META) as ReportPriority[]).map((p) => {
                const active = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={[
                      "rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-all",
                      active
                        ? `${PRIORITY_META[p].cls} ring-2 ring-offset-1 ring-offset-card ring-primary/30`
                        : "border-border bg-background/30 text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                );
              })}
            </div>
          </FieldLine>

          {type === "project_update" && (
            <FieldLine label="Project">
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-md border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
              >
                <option value="">Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{" "}({p.company === "simplicity" ? "Simplicity" : "CodeWithAli"})
                  </option>
                ))}
              </select>
            </FieldLine>
          )}
        </div>
      </div>

      {/* ─── Template fields / Freeform body ─── */}
      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <typeMeta.icon className="h-3.5 w-3.5" style={{ color: typeMeta.accent }} />
          <h2 className="text-[12px] font-mono uppercase tracking-widest text-muted-foreground">
            {template && template.fields.length > 0
              ? `${template.name} details`
              : "Details"}
          </h2>
        </div>

        {template && template.fields.length > 0 ? (
          template.fields.map((f) => (
            <FieldLine
              key={f.key}
              label={f.label}
              hint={f.hint}
              optional={f.optional}
            >
              {f.kind === "line" ? (
                <input
                  type="text"
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  placeholder={f.placeholder}
                  className="w-full rounded-md border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              ) : (
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  rows={f.rows ?? 3}
                  placeholder={f.placeholder}
                  className="w-full resize-y rounded-md border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
                />
              )}
            </FieldLine>
          ))
        ) : (
          <FieldLine
            label="Details"
            hint="Everything worth saying. Plain text — line breaks preserved."
          >
            <textarea
              value={values["__freeform"] ?? ""}
              onChange={(e) =>
                setValues((v) => ({ ...v, __freeform: e.target.value }))
              }
              rows={10}
              placeholder="What's the situation, what's the ask, what does leadership need to know."
              className="w-full resize-y rounded-md border border-border bg-background/50 px-3.5 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/50 leading-relaxed outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
            />
          </FieldLine>
        )}
      </div>

      {/* ─── Submit bar ─── */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 backdrop-blur-sm px-5 py-4">
        <div className="min-w-0 flex-1 text-[11.5px]">
          {submitState === "sent" && (
            <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold">
              <Check className="h-3.5 w-3.5" />
              Submitted. Leadership will see it in their inbox.
            </span>
          )}
          {submitState === "error" && (
            <span className="inline-flex items-center gap-1.5 text-red-300">
              <AlertCircle className="h-3.5 w-3.5" />
              {submitError ?? "Failed to submit"}
            </span>
          )}
          {submitState === "idle" && (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <typeMeta.icon className="h-3.5 w-3.5" style={{ color: typeMeta.accent }} />
              Submitting to <b className="text-foreground">CEO / COO / CFO / Admin</b>.
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitState === "submitting" || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
        >
          {submitState === "submitting" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          {submitState === "submitting" ? "Submitting…" : "Submit report"}
        </button>
      </div>

      {/* ─── Your recent reports ─── */}
      <section className="pt-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <h2 className="text-[12px] font-mono uppercase tracking-widest text-muted-foreground">
              Your recent reports
            </h2>
          </div>
          {myReports.length > 0 && (
            <span className="text-[10.5px] text-muted-foreground">
              Last {myReports.length}
            </span>
          )}
        </div>

        {loadingReports ? (
          <div className="flex items-center gap-2 p-3 text-[11.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </div>
        ) : myReports.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/30 p-6 text-center">
            <Send className="mx-auto h-6 w-6 text-muted-foreground/40" />
            <p className="mt-2 text-[12px] text-foreground">
              Nothing yet.
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Your submitted reports will show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {myReports.map((r) => (
              <MyReportRow key={r.id} report={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────

function Section({
  label, hint, children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2">
        <h2 className="text-[12.5px] font-semibold text-foreground">{label}</h2>
        {hint && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Field wrapper — label + optional hint + the input ──────────

function FieldLine({
  label, hint, optional, children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-[11.5px] font-semibold text-foreground/90">
          {label}
          {optional && (
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
              (optional)
            </span>
          )}
        </label>
      </div>
      {children}
      {hint && (
        <p className="mt-1 text-[10.5px] text-muted-foreground leading-snug">
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Recent report row ──────────────────────────────────────────

function MyReportRow({ report }: { report: ReportRow }) {
  const TypeIcon = TYPE_META[report.type]?.icon ?? FileText;
  const accent = TYPE_META[report.type]?.accent ?? "#64748b";
  return (
    <li className="group rounded-lg border border-border bg-card/40 px-4 py-3 hover:bg-card/60 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: `${accent}22`, color: accent }}
        >
          <TypeIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground truncate">
            {report.title}
          </p>
          {report.body && (
            <p className="mt-1 text-[11.5px] text-muted-foreground line-clamp-2 leading-snug whitespace-pre-wrap">
              {report.body}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            <span
              className={`rounded-full border px-1.5 py-0.5 font-semibold ${PRIORITY_META[report.priority].cls}`}
            >
              {PRIORITY_META[report.priority].label}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {report.submitted_at
                ? new Date(report.submitted_at).toLocaleDateString()
                : "draft"}
            </span>
            <StatusBadge status={report.status} reviewed={!!report.reviewed_at} />
          </div>
          {report.review_notes && (
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/[0.05] px-3 py-2">
              <p className="text-[10px] font-semibold text-primary/80 uppercase tracking-wider mb-0.5">
                Leadership note
              </p>
              <p className="text-[11.5px] text-foreground/90 leading-snug whitespace-pre-wrap">
                {report.review_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function StatusBadge({
  status, reviewed,
}: {
  status: ReportStatus;
  reviewed: boolean;
}) {
  if (status === "reviewed" || reviewed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300 font-semibold">
        <Eye className="h-2.5 w-2.5" />
        Reviewed
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="rounded-full border border-zinc-600/40 bg-zinc-700/10 px-1.5 py-0.5 text-zinc-400 font-semibold">
        Archived
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-300 font-semibold">
      Submitted
    </span>
  );
}
