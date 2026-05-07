/**
 * ScenarioViews.tsx — Read-only timeline renderers for the
 * "Risk Term" and "Buffer" tabs of the Graduation Plan.
 *
 * Both views are non-mutating — they never touch the DB. Their job
 * is to surface alternate timelines visually using the same editorial
 * language as the Standard tab so the three views feel like one tool
 * with three lenses.
 */

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  GraduationCap,
  Info,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  BufferRemediation,
  RISK_TERM_PLAN,
  ScenarioCourse,
  ScenarioPlan,
  ScenarioTerm,
  Source,
  computeBufferPlan,
} from "./graduationScenarios";
import { Course } from "./GraduationPlan.queries";

// ═══════════════════════════════════════════════════════════════════
// RISK TERM VIEW
// ═══════════════════════════════════════════════════════════════════
export function RiskTermView() {
  return <ScenarioPlanView plan={RISK_TERM_PLAN} />;
}

// ═══════════════════════════════════════════════════════════════════
// BUFFER VIEW (auto-computed from live plan)
// ═══════════════════════════════════════════════════════════════════
export function BufferView({ courses }: { courses: Course[] }) {
  const status = computeBufferPlan(courses);

  if (status.kind === "no_failures") {
    return (
      <div className="px-10 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="border-l-[3px] border-emerald-500 bg-emerald-500/[0.05] py-6 pl-6 pr-6"
        >
          <div className="flex items-start gap-4">
            <div className="p-2 rounded-sm bg-emerald-500/15 border border-emerald-400/40 shrink-0 mt-0.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-foreground tracking-tight">
                No failures detected
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-foreground/80 max-w-3xl">
                Every course in the live plan is currently planned, in progress, or passed.
                The Standard timeline applies as-is — no buffer required.
              </p>
              <p className="mt-3 text-[12.5px] text-muted-foreground leading-relaxed max-w-3xl">
                If a class is failed or dropped this term, mark it with the appropriate status
                in the Standard tab and this view will auto-compute a recovery timeline:
                cascade delay, CC retake suggestions, and the new graduation target.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const { cascade } = status;

  return (
    <div className="px-10 pb-12">
      {/* ── Header ── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="pb-6"
      >
        <div className="flex items-baseline justify-between mb-1.5">
          <h2 className="text-[24px] font-bold text-foreground tracking-tight">
            Buffer Plan — Recovery Timeline
          </h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            Auto-computed from failures
          </span>
        </div>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-3xl">
          Reads the live plan, identifies failed/dropped courses, and projects the buffered
          graduation timeline. Critical-path failures cascade by one full semester each;
          non-critical failures are absorbed where possible.
        </p>

        {/* Top stats */}
        <div className="mt-6 border-y border-border">
          <div className="grid grid-cols-3 divide-x divide-border">
            <BufferStat
              label="Failures Detected"
              value={cascade.failures.length.toString()}
              accent="red"
              sub={`${cascade.failures.filter((f) => f.critical).length} critical · ${cascade.failures.filter((f) => !f.critical).length} non-critical`}
            />
            <BufferStat
              label="Semester Delay"
              value={`+${cascade.delaySemesters}`}
              accent={cascade.delaySemesters > 1 ? "red" : "amber"}
              sub="vs. Standard plan"
            />
            <BufferStat
              label="New Target"
              value={cascade.newTarget}
              accent={cascade.delaySemesters > 1 ? "red" : "amber"}
              sub="estimated graduation"
            />
          </div>
        </div>

        {/* Global notes */}
        {cascade.globalNotes.length > 0 && (
          <div className="mt-5 space-y-2">
            {cascade.globalNotes.map((n, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[13px] text-foreground/85">
                <Info className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
                <p className="leading-relaxed">{n}</p>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ── Per-failure remediation cards ── */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <h3 className="text-[15px] font-bold text-foreground tracking-tight mb-4">
          Recovery Strategy per Failure
        </h3>
        <div className="space-y-3">
          {cascade.remediations.map((r, i) => (
            <RemediationCard
              key={i}
              remediation={r}
              failureName={
                cascade.failures.find((f) => f.code === r.failedCode)?.name ?? r.failedCode
              }
              failureStatus={
                cascade.failures.find((f) => f.code === r.failedCode)?.status ?? "failed"
              }
            />
          ))}
        </div>
      </motion.section>
    </div>
  );
}

function BufferStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "red" | "amber" | "emerald";
}) {
  const cls =
    accent === "red"
      ? "text-red-300"
      : accent === "amber"
        ? "text-amber-200"
        : "text-emerald-200";
  return (
    <div className="px-7 py-6">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
        {label}
      </div>
      <div className={`mt-2 text-[28px] font-bold tabular-nums tracking-tight leading-none ${cls}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function RemediationCard({
  remediation,
  failureName,
  failureStatus,
}: {
  remediation: BufferRemediation;
  failureName: string;
  failureStatus: string;
}) {
  const sev = remediation.severity;
  const sevCls: Record<typeof sev, string> = {
    LOW:      "bg-emerald-500/[0.10] text-emerald-200 border-emerald-400/30",
    MEDIUM:   "bg-slate-500/[0.14] text-slate-200 border-slate-400/40",
    HIGH:     "bg-amber-500/[0.14] text-amber-200 border-amber-400/40",
    CRITICAL: "bg-red-500/[0.14] text-red-200 border-red-400/40",
  };
  const accentBorder =
    sev === "CRITICAL" ? "border-l-red-500" : sev === "HIGH" ? "border-l-amber-400" : "border-l-border";

  return (
    <div className={`pl-5 pr-5 py-4 border-l-[3px] bg-card/40 ${accentBorder} rounded-r-sm`}>
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <code className="text-[16px] font-mono font-bold text-foreground">
              {remediation.failedCode}
            </code>
            <span className="text-[14px] text-foreground/85 truncate">{failureName}</span>
            <span className="text-[10.5px] uppercase tracking-[0.15em] text-red-300 font-bold px-1.5 py-0.5 rounded-sm bg-red-500/15 border border-red-400/40">
              {failureStatus === "dropped" ? "Dropped" : "Failed"}
            </span>
          </div>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10.5px] font-bold tracking-wide whitespace-nowrap shrink-0 ${sevCls[sev]}`}
        >
          {sev}
        </span>
      </div>

      <div className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-2.5 text-[12.5px]">
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          Retake at
        </div>
        <div className="flex items-center gap-2 text-foreground/90">
          {remediation.retakeAt === "SJSU" ? (
            <GraduationCap className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Building2 className="h-3.5 w-3.5 text-amber-300" />
          )}
          <span className="font-medium">{remediation.retakeAt}</span>
        </div>

        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          Retake term
        </div>
        <div className="flex items-center gap-2 text-foreground/90">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{remediation.retakeTerm}</span>
        </div>

        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          Reason
        </div>
        <p className="text-foreground/85 leading-relaxed">{remediation.reason}</p>

        {remediation.blockedCodes.length > 0 && (
          <>
            <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
              Blocked downstream
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {remediation.blockedCodes.map((c) => (
                <code
                  key={c}
                  className="text-[11.5px] font-mono font-semibold text-amber-200 px-1.5 py-0.5 rounded-sm bg-amber-500/[0.10] border border-amber-400/30"
                >
                  {c}
                </code>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Shared scenario-plan renderer (used by Risk Term)
// ═══════════════════════════════════════════════════════════════════
function ScenarioPlanView({ plan }: { plan: ScenarioPlan }) {
  return (
    <div className="px-10 pb-12">
      {/* Header + precondition + highlights */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="pb-6"
      >
        <div className="flex items-baseline justify-between mb-1.5">
          <h2 className="text-[24px] font-bold text-foreground tracking-tight">
            {plan.title}
          </h2>
          <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-amber-200 font-bold">
            <Zap className="h-3.5 w-3.5" /> Aggressive scenario
          </span>
        </div>
        <p className="text-[13.5px] text-muted-foreground leading-relaxed max-w-3xl">
          {plan.subtitle}
        </p>

        {plan.precondition && (
          <div className="mt-5">
            <PreconditionBanner pc={plan.precondition} />
          </div>
        )}

        {/* Highlights */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5">
          {plan.highlights.map((h, i) => (
            <div key={i} className="flex items-start gap-2.5 text-[13px] text-foreground/85">
              {h.icon === "alert" ? (
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-1 shrink-0" />
              ) : h.icon === "ok" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300 mt-1 shrink-0" />
              ) : (
                <Info className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
              )}
              <p className="leading-relaxed">{h.text}</p>
            </div>
          ))}
        </div>

        {/* CC stat + cost */}
        <div className="mt-6 border-y border-border">
          <div className="grid grid-cols-3 divide-x divide-border">
            <BufferStat
              label="CC Units in Plan"
              value={plan.ccUnits.toString()}
              sub="offloaded from SJSU"
              accent="amber"
            />
            <BufferStat
              label="SJSU Terms"
              value={plan.terms.filter((t) => t.courses.some((c) => c.source === "SJSU" || c.source === "SJSU online")).length.toString()}
              sub="active at SJSU"
              accent="emerald"
            />
            <BufferStat
              label="Total Plan Units"
              value={plan.terms.reduce((s, t) => s + t.courses.reduce((u, c) => u + c.units, 0), 0).toString()}
              sub={plan.costNote ? plan.costNote : "across all terms"}
              accent="emerald"
            />
          </div>
        </div>
      </motion.section>

      {/* Timeline */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-[15px] font-bold text-foreground tracking-tight">
            Term Timeline
          </h3>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            {plan.terms[0]?.label} → {plan.terms[plan.terms.length - 1]?.label}
          </span>
        </div>
        <div className="border-t border-border">
          {plan.terms.map((term, i) => (
            <ScenarioTermRow key={term.id} term={term} index={i} />
          ))}
        </div>
      </motion.section>
    </div>
  );
}

function PreconditionBanner({
  pc,
}: {
  pc: NonNullable<ScenarioPlan["precondition"]>;
}) {
  const palette = {
    danger:  { border: "border-red-500",     bg: "bg-red-500/[0.07]",     icon: <ShieldAlert className="h-4 w-4 text-red-300" />,    chipBg: "bg-red-500/15 border-red-400/40 text-red-200" },
    warning: { border: "border-amber-400",   bg: "bg-amber-500/[0.06]",   icon: <AlertTriangle className="h-4 w-4 text-amber-300" />, chipBg: "bg-amber-500/15 border-amber-400/40 text-amber-200" },
    info:    { border: "border-primary",     bg: "bg-primary/[0.06]",     icon: <Info className="h-4 w-4 text-primary" />,            chipBg: "bg-primary/15 border-primary/40 text-primary" },
  } as const;
  const p = palette[pc.kind];
  return (
    <div className={`border-l-[3px] ${p.border} ${p.bg} py-4 pl-5 pr-5`}>
      <div className="flex items-start gap-3.5">
        <div className={`p-1.5 rounded-sm ${p.chipBg} border shrink-0 mt-0.5`}>
          {p.icon}
        </div>
        <div>
          <h4 className="text-[14px] font-bold text-foreground tracking-tight">
            {pc.headline}
          </h4>
          <p className="mt-1.5 text-[13px] text-foreground/85 leading-relaxed max-w-3xl">
            {pc.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function ScenarioTermRow({ term, index }: { term: ScenarioTerm; index: number }) {
  const totalUnits = term.courses.reduce((s, c) => s + c.units, 0);
  const ccUnits = term.courses
    .filter((c) => c.source !== "SJSU" && c.source !== "SJSU online")
    .reduce((s, c) => s + c.units, 0);

  const accentBar = term.isTarget
    ? "bg-emerald-500/70"
    : term.highRisk
      ? "bg-red-500/70"
      : "bg-border";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 + index * 0.04, ease: "easeOut" }}
      className="grid grid-cols-[200px_1fr] gap-x-8 py-6 border-b border-border last:border-b-0"
    >
      {/* Left rail */}
      <div className="relative pl-5">
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-full ${accentBar}`} />
        <div className="text-[20px] font-bold text-foreground tracking-tight leading-tight">
          {term.label}
        </div>
        {term.tag && (
          <div
            className={`mt-2 text-[11px] uppercase tracking-[0.15em] font-semibold ${
              term.isTarget ? "text-emerald-200" : term.highRisk ? "text-red-300" : "text-muted-foreground"
            }`}
          >
            {term.tag}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground tabular-nums">
          <span className="text-foreground font-semibold">{totalUnits}</span>
          <span>units</span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            <span className="text-foreground/85 font-medium">{term.courses.length}</span> courses
          </span>
        </div>
        {ccUnits > 0 && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-200 font-medium">
            <Building2 className="h-3.5 w-3.5" />
            {ccUnits} units at CC
          </div>
        )}
        {term.isTarget && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-emerald-200 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> graduation
          </div>
        )}
        {term.highRisk && !term.isTarget && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-red-300 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> high risk
          </div>
        )}
      </div>

      {/* Right column — courses */}
      <div className="min-w-0">
        <div className="grid grid-cols-[110px_minmax(0,1fr)_60px_minmax(180px,auto)_minmax(120px,auto)] items-center gap-x-4 px-2 pb-2.5 border-b border-border">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Code</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Course</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold text-right">Units</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Source / Category</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold text-right">Status</span>
        </div>
        {term.courses.map((c) => (
          <ScenarioCourseRow key={c.code} course={c} />
        ))}
      </div>
    </motion.div>
  );
}

function ScenarioCourseRow({ course }: { course: ScenarioCourse }) {
  const status = courseStatusChip(course.status);
  const isCC = course.source !== "SJSU" && course.source !== "SJSU online";

  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)_60px_minmax(180px,auto)_minmax(120px,auto)] items-start gap-x-4 px-2 py-3.5 border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        {course.critical && <CriticalDot />}
        <code className="text-[13.5px] font-mono font-semibold text-foreground truncate">
          {course.code}
        </code>
      </div>
      <div className="min-w-0">
        <span className="text-[14px] text-foreground/90 truncate block font-medium">
          {course.name}
        </span>
        {course.note && (
          <p className="mt-1 text-[11.5px] text-muted-foreground italic leading-relaxed">
            {course.note}
          </p>
        )}
      </div>
      <div className="text-right text-[13.5px] tabular-nums text-foreground/85 font-semibold">
        {course.units}
      </div>
      <div className="min-w-0 space-y-1">
        <SourcePill source={course.source} />
        {course.ccEquivalent && (
          <div className="text-[11px] text-muted-foreground italic">
            {course.ccEquivalent}
          </div>
        )}
        <div className="text-[10.5px] text-muted-foreground/80">{course.category}</div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10.5px] font-semibold tracking-wide whitespace-nowrap ${status.cls}`}
        >
          {status.label}
        </span>
      </div>

      {/* Hidden — placeholder so isCC variable is referenced (TS noise dodge) */}
      {isCC && null}
    </div>
  );
}

function SourcePill({ source }: { source: Source }) {
  const map: Record<Source, { label: string; cls: string; icon?: React.ReactNode }> = {
    "SJSU":           { label: "SJSU",           cls: "bg-primary/[0.14] text-primary border-primary/40",                icon: <GraduationCap className="h-2.5 w-2.5 mr-1" /> },
    "SJSU online":    { label: "SJSU online",    cls: "bg-primary/[0.10] text-primary border-primary/30",                icon: <GraduationCap className="h-2.5 w-2.5 mr-1" /> },
    "Mission CC":     { label: "Mission CC",     cls: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40",          icon: <Building2 className="h-2.5 w-2.5 mr-1" /> },
    "West Valley CC": { label: "West Valley CC", cls: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40",          icon: <Building2 className="h-2.5 w-2.5 mr-1" /> },
    "CC (either)":    { label: "Mission / WV",   cls: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40",          icon: <Building2 className="h-2.5 w-2.5 mr-1" /> },
    "Substitute":     { label: "Substitute",     cls: "bg-violet-500/[0.14] text-violet-200 border-violet-400/40",       icon: <Sparkles className="h-2.5 w-2.5 mr-1" /> },
  };
  const m = map[source];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10.5px] font-semibold tracking-wide whitespace-nowrap ${m.cls}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

function CriticalDot() {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-80 animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-500/20" />
    </span>
  );
}

function courseStatusChip(s: ScenarioCourse["status"]): { label: string; cls: string } {
  switch (s) {
    case "complete":
      return { label: "Complete", cls: "bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40" };
    case "in_progress":
      return { label: "In Progress", cls: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40" };
    case "critical-add":
      return { label: "Critical Add", cls: "bg-red-500/[0.14] text-red-200 border-red-400/40" };
    case "planned":
    default:
      return { label: "Planned", cls: "bg-slate-500/[0.12] text-slate-300 border-slate-400/30" };
  }
}

