/**
 * reports.tsx (settings tab) — single-surface report submission.
 *
 * The layout is one continuous document, not a sequence of
 * question boxes. Title at the top. Compact metadata row below
 * (type, framework, priority, project). Below that, one large
 * textarea the user writes into. When a template is picked, the
 * body is pre-seeded with section headings + blank lines — you
 * edit the doc, not fill out a form.
 *
 * No per-field labels, no card-in-card nesting, no decorative
 * icons in headers. Matches how Linear, GitHub, and Apple's
 * Feedback Assistant handle structured reports.
 *
 * On submit: the textarea content goes to reports.body as-is.
 * The admin inbox's StructuredBody component parses "Label:\n..."
 * sections and renders them with section headings.
 */

import { useEffect, useRef, useState } from "react";
import {
  Send, Loader2, AlertCircle, Clock, Eye, FileText, FolderKanban,
  ClipboardList, AlertTriangle, MessageSquare,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import {
  REPORT_TEMPLATES,
  renderTemplateScaffold,
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

const TYPE_LABELS: Record<ReportTypeKey, string> = {
  status: "Status",
  project_update: "Project",
  incident: "Incident",
  feedback: "Feedback",
  other: "Other",
};

const TYPE_ICONS: Record<ReportTypeKey, typeof FileText> = {
  status: ClipboardList,
  project_update: FolderKanban,
  incident: AlertTriangle,
  feedback: MessageSquare,
  other: FileText,
};

const PRIORITY_LABELS: Record<ReportPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

// ── Main component ──────────────────────────────────────────────

export default function ReportSettings() {
  const { data: currentUser } = ActiveUser();
  const me = currentUser?.[0];
  const mySupaId = me?.supa_id as string | undefined;

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [myReports, setMyReports] = useState<ReportRow[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const [type, setType] = useState<ReportTypeKey>("status");
  const [priority, setPriority] = useState<ReportPriority>("normal");
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState<string>("weekly-checkin");
  const [body, setBody] = useState<string>("");

  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "sent" | "error"
  >("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const templatesForType = REPORT_TEMPLATES[type] ?? [];
  const template: ReportTemplate | undefined =
    templatesForType.find((t) => t.id === templateId) ?? templatesForType[0];

  // When type changes: pick first template, seed title + body if both empty.
  useEffect(() => {
    const first = REPORT_TEMPLATES[type]?.[0];
    if (!first) return;
    setTemplateId(first.id);
    if (!title.trim()) setTitle(first.defaultTitle);
    const scaffold = renderTemplateScaffold(first);
    // Only replace body if it's empty OR matches any template scaffold
    // for the previous type (i.e. unchanged pre-fill).
    const isPristine = !body.trim() || isAnyTemplateScaffold(body);
    if (isPristine) setBody(scaffold);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  // When template changes within a type: swap scaffold if pristine.
  useEffect(() => {
    if (!template) return;
    const scaffold = renderTemplateScaffold(template);
    const isPristine = !body.trim() || isAnyTemplateScaffold(body);
    if (isPristine) setBody(scaffold);

    // Re-seed title if safe.
    const allDefaults = new Set(
      templatesForType.map((t) => t.defaultTitle).filter(Boolean),
    );
    if (!title.trim() || allDefaults.has(title.trim())) {
      setTitle(template.defaultTitle);
    }
    // Place cursor in the body on template change so the user can start typing.
    setTimeout(() => {
      const el = bodyRef.current;
      if (!el) return;
      // Move cursor to the first empty line after the first heading.
      const firstHeadingNL = scaffold.indexOf("\n");
      const target = firstHeadingNL === -1 ? scaffold.length : firstHeadingNL + 1;
      try {
        el.focus();
        el.setSelectionRange(target, target);
      } catch { /* noop */ }
    }, 0);
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
    setBody("");
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

    // Strip out empty template headings (user didn't fill in that
    // section) so the inbox doesn't show "Timeline:\n\nBudget:\n..."
    // with nothing under the heading.
    const cleanedBody = stripEmptyScaffoldHeadings(body).trim();

    const { error } = await supabase.from("reports").insert({
      title: title.trim(),
      body: cleanedBody || null,
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
          "Reports table is not set up. Run migrations/reports_init.sql.",
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

  const TypeIcon = TYPE_ICONS[type];

  return (
    <div className="mx-auto max-w-[820px]">
      {/* Header */}
      <div className="pb-4 border-b border-border/60">
        <h1 className="text-[17px] font-semibold text-foreground tracking-tight">
          Submit a report
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          Leadership reviews everything in the reports inbox.
        </p>
      </div>

      {/* Title */}
      <div className="pt-5">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={140}
          placeholder="Title"
          className="w-full bg-transparent border-0 px-0 py-1 text-[22px] font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/40 outline-none focus:ring-0"
        />
      </div>

      {/* Metadata row — all the picks that aren't the document itself */}
      <div className="mt-2 flex items-center flex-wrap gap-2">
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
      </div>

      {/* Body — single continuous writing surface */}
      <div className="mt-4">
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={22}
          placeholder="Write your report. Pick a framework above to start with scaffolding, or just write."
          className="w-full resize-y bg-transparent border-0 px-0 py-2 text-[14px] text-foreground/95 placeholder:text-muted-foreground/40 leading-[1.65] outline-none focus:ring-0"
          style={{
            fontFamily:
              'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        />
        {template && template.blurb && (
          <p className="text-[10.5px] text-muted-foreground/80 italic border-t border-border/40 pt-2 mt-1">
            {template.blurb}
          </p>
        )}
      </div>

      {/* Submit row */}
      <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-border/60">
        <div className="text-[11.5px] text-muted-foreground min-w-0 flex-1">
          {submitState === "sent" && (
            <span className="text-emerald-400">Submitted.</span>
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
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={submitState === "submitting" || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-sm bg-foreground px-3.5 py-1.5 text-[12px] font-semibold text-background hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitState === "submitting" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Send className="h-3 w-3" />
          )}
          {submitState === "submitting" ? "Submitting" : "Submit"}
        </button>
      </div>

      {/* Recent reports */}
      <div className="mt-10 pt-6 border-t border-border/60">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-foreground">Recent</h2>
          {myReports.length > 0 && (
            <span className="text-[10.5px] text-muted-foreground">
              {myReports.length} of your reports
            </span>
          )}
        </div>

        {loadingReports ? (
          <p className="py-2 text-[11.5px] text-muted-foreground">Loading…</p>
        ) : myReports.length === 0 ? (
          <p className="py-3 text-[11.5px] text-muted-foreground">
            No reports yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 border border-border/60 rounded-sm">
            {myReports.map((r) => (
              <MyReportRow key={r.id} report={r} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Body-pristine detection ─────────────────────────────────────
//
// "Pristine" = the body is either empty, or it exactly matches a
// scaffold rendered by any template. We use this to know when it's
// safe to replace the body on template/type change without asking.

function isAnyTemplateScaffold(body: string): boolean {
  for (const typeKey of Object.keys(REPORT_TEMPLATES) as ReportTypeKey[]) {
    for (const tpl of REPORT_TEMPLATES[typeKey]) {
      if (renderTemplateScaffold(tpl) === body) return true;
    }
  }
  return false;
}

// ── Empty-heading stripper ─────────────────────────────────────
//
// If the user left a scaffold heading ("Timeline:") with no content
// beneath it, drop it on submit so the inbox shows a clean report.
// Handles both "Label:" and "Label (optional):" styles.

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
    // Look ahead for any non-blank, non-heading content before the next heading.
    let hasContent = false;
    for (let j = i + 1; j < lines.length; j++) {
      const peek = lines[j] ?? "";
      const peekIsHeading = /^[A-Z][^:]{0,80}(?: \(optional\))?:\s*$/.test(peek.trim());
      if (peekIsHeading) break;
      if (peek.trim() !== "") { hasContent = true; break; }
    }
    if (hasContent) {
      // Normalize "Label (optional):" to "Label:" on submission so the
      // inbox parser doesn't carry the optional marker forward.
      out.push(line.replace(/ \(optional\):/, ":"));
    }
    // Else drop the heading entirely — skip.
  }

  // Collapse triple-plus blank lines to a single blank line separator.
  return out.join("\n").replace(/\n{3,}/g, "\n\n");
}

// ── MetaSelect — compact dropdown in the metadata row ──────────

function MetaSelect({
  icon: Icon, value, onChange, options, placeholder,
}: {
  icon?: typeof FileText;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  placeholder?: string;
}) {
  // Find the currently-selected label so the button can display it.
  const current =
    options.find(([v]) => v === value)?.[1] ?? placeholder ?? "—";

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
      <span
        aria-hidden
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-[9px]"
      >
        ▾
      </span>
    </div>
  );
}

// ── Recent report row ──────────────────────────────────────────

function MyReportRow({ report }: { report: ReportRow }) {
  const TypeIcon = TYPE_ICONS[report.type] ?? FileText;
  return (
    <li className="px-3 py-2.5 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2.5">
        <TypeIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12.5px] font-medium text-foreground truncate">
              {report.title}
            </p>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {report.submitted_at
                ? new Date(report.submitted_at).toLocaleDateString()
                : "draft"}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <span>{TYPE_LABELS[report.type]}</span>
            <span>·</span>
            <span>{PRIORITY_LABELS[report.priority]}</span>
            <span>·</span>
            <StatusLabel status={report.status} reviewed={!!report.reviewed_at} />
          </div>
          {report.review_notes && (
            <div className="mt-2 border-l-2 border-primary/40 pl-2.5 py-0.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
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
  return <span className="text-amber-400">Submitted</span>;
}
