/**
 * GraduationPlan.tsx — Live executive view of Ali's BS CS & Linguistics degree.
 *
 * Reads from `graduation_plan_*` Supabase tables. CEO/COO can:
 *   · Mark courses Passed / Failed / Dropped — drives header math
 *   · Drag courses between semesters (HTML5 native DnD)
 *   · Add / edit / delete courses inline
 *   · Edit GPA values and target graduation term
 *
 * "Current term" auto-detects from today's date so the page ages
 * correctly without manual touches.
 *
 * Design language unchanged from the prior static version —
 * monochrome editorial dark with semantic accent colors. All edit
 * affordances are subtle (hover-revealed, dotted underlines on
 * editable text) so the executive read remains the primary mode.
 */

import { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  GraduationCap,
  Target,
  TrendingDown,
  CheckCircle2,
  Clock,
  Flame,
  ShieldAlert,
  Plus,
  Trash2,
  Pencil,
  GripVertical,
  X,
  Check,
  ChevronDown,
  Zap,
  ShieldCheck,
} from "lucide-react";

import {
  Course,
  CourseStatus,
  Meta,
  PlanData,
  Term,
  computeUnitTotals,
  detectCurrentTermId,
  useAddCourse,
  useDeleteCourse,
  useEditCourse,
  useGraduationPlan,
  useMoveCourse,
  useUpdateCourseStatus,
  useUpdateMeta,
  PLAN_QUERY_KEY,
} from "./GraduationPlan.queries";
import supabase from "./supabase";
import { useQueryClient } from "@tanstack/react-query";
import CourseDrawer from "./CourseDrawer";
import { RiskTermView, BufferView } from "./ScenarioViews";

// ─── Danger pairs (UI-only, not DB-backed) ──────────────────────────
const DANGER_PAIRS: { pair: string; why: string }[] = [
  { pair: "MATH 42 + MATH 31", why: "Two math-heavy courses overlapping. If MATH 42 isn't fully closed, Calc II's pace will compound the deficit." },
  { pair: "CS 146 + CS 154", why: "DS&A and Formal Languages are both proof-heavy CS gateway weed-outs. Stacking them is the standard SJSU GPA killer." },
  { pair: "CS 156 + MATH 161A", why: "AI sits on top of probability theory. Taking it the same term as the underlying stats course doubles workload on the same concepts." },
  { pair: "LING 165 before LING 115 or 124", why: "NLP capstone depends on Corpus Linguistics and Speech Tech. Reordering breaks the prerequisite chain." },
  { pair: "Two upper-div Math in summer", why: "Compressed summer terms move at 2× pace. Pairing 161A-tier math with anything quantitative is a forced W." },
  { pair: "LLD 100W + heavy STEM stack", why: "Writing-intensive (4–6 essays + revisions) does not cohabit with two CS cores. Already mitigated this term — keep the rule." },
];

// ═══════════════════════════════════════════════════════════════════
// Top-level component
// ═══════════════════════════════════════════════════════════════════
export default function GraduationPlan() {
  const { data, isLoading, error } = useGraduationPlan();
  const qc = useQueryClient();

  // Realtime sync — both Ali and Hanif see edits live.
  useEffect(() => {
    const ch = supabase
      .channel("graduation-plan-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "graduation_plan_courses" },
        () => qc.invalidateQueries({ queryKey: PLAN_QUERY_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "graduation_plan_meta" },
        () => qc.invalidateQueries({ queryKey: PLAN_QUERY_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "graduation_plan_terms" },
        () => qc.invalidateQueries({ queryKey: PLAN_QUERY_KEY }),
      )
      .subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [qc]);

  if (isLoading) {
    return <LoadingState />;
  }
  if (error || !data) {
    return <ErrorState message={error?.message ?? "No plan data"} />;
  }
  return <PlanView data={data} />;
}

// ─── Loading / error ───────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      <div className="h-6 w-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center">
      <div className="text-center max-w-md">
        <AlertTriangle className="h-6 w-6 text-red-400 mx-auto mb-3" />
        <h2 className="text-[15px] font-semibold text-foreground mb-1">
          Couldn't load graduation plan
        </h2>
        <p className="text-[12.5px] text-muted-foreground">{message}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-3">
          Run <code className="text-foreground/85">migrations/graduation_plan_schema.sql</code> in Supabase.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main view
// ═══════════════════════════════════════════════════════════════════
type ScenarioTab = "standard" | "risk" | "buffer";

function PlanView({ data }: { data: PlanData }) {
  const { meta, terms, courses } = data;

  // Tab state — three views on the same plan. Standard is the live
  // editable timeline; risk and buffer are read-only what-if views.
  const [activeTab, setActiveTab] = useState<ScenarioTab>("standard");

  // Drawer state — single source of truth for which course's
  // intelligence panel is currently open. We track the row id (so the
  // active-row highlight survives a refetch where the array reorders)
  // and the code (so we can drive the drawer with stable lookup).
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const selectedRow = useMemo(
    () => courses.find((c) => c.id === selectedRowId) ?? null,
    [courses, selectedRowId],
  );

  // Auto-detect current term — this replaces the hardcoded `isCurrent`
  // flag and makes the page age correctly with the calendar.
  const currentTermId = useMemo(() => detectCurrentTermId(terms), [terms]);
  const targetTermId = useMemo(() => terms.find((t) => t.is_target)?.id, [terms]);

  // Group courses by term for easy rendering
  const coursesByTerm = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const t of terms) map.set(t.id, []);
    for (const c of courses) {
      const arr = map.get(c.term_id);
      if (arr) arr.push(c);
    }
    for (const [k, arr] of map) {
      arr.sort((a, b) => a.position - b.position);
      map.set(k, arr);
    }
    return map;
  }, [terms, courses]);

  const totals = useMemo(() => computeUnitTotals(data), [data]);
  const onTrack = !!targetTermId; // Plan exists → on track. Could be smarter later.

  const completedPct = (totals.completed / totals.required) * 100;
  const inProgressPct = (totals.inProgress / totals.required) * 100;
  const remainingPct = (totals.remaining / totals.required) * 100;

  // For "Critical Requirements Left" — count critical courses not yet passed/in-progress
  const criticalLeft = courses.filter(
    (c) => c.critical && c.status !== "passed" && c.status !== "in_progress",
  );

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-y-auto">
      {/* 1 · HERO HEADER ================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="px-10 pt-10 pb-6"
      >
        <Hero meta={meta} onTrack={onTrack} />
      </motion.section>

      {/* 2 · STAT STRIP =================================================== */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05, ease: "easeOut" }}
        className="px-10 pb-6"
      >
        <div className="border-y border-border">
          <div className="grid grid-cols-4 divide-x divide-border">
            <Stat
              label="Total Units"
              value={totals.required.toString()}
              sub={`${totals.remaining + totals.inProgress} remaining`}
            />
            <Stat
              label="Plan Courses"
              value={`${courses.filter((c) => c.status === "passed").length}/${courses.length}`}
              sub={`${courses.filter((c) => c.status === "in_progress").length} in progress`}
            />
            <Stat
              label="Semesters Remaining"
              value={terms
                .filter((t) => {
                  // not yet started or currently active
                  const idx = terms.findIndex((x) => x.id === t.id);
                  const curIdx = currentTermId
                    ? terms.findIndex((x) => x.id === currentTermId)
                    : -1;
                  return curIdx === -1 ? true : idx >= curIdx;
                })
                .length.toString()}
              sub="including current term"
            />
            <Stat
              label="Critical Requirements Left"
              value={criticalLeft.length.toString()}
              sub={
                criticalLeft.length
                  ? criticalLeft.map((c) => c.code).join(" · ")
                  : "all on track"
              }
              accent={criticalLeft.length ? "red" : "emerald"}
            />
          </div>
        </div>
      </motion.section>

      {/* 3 · UNIT PROGRESS BAR ============================================= */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        className="px-10 pb-8"
      >
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-foreground/80 font-semibold">
            Unit Progress
          </h3>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            <span className="text-foreground font-semibold">{totals.completed}</span>
            <span className="text-muted-foreground/60"> / </span>
            <span className="text-foreground/85">{totals.required}</span> units completed
          </span>
        </div>

        <div className="flex h-10 w-full overflow-hidden rounded-sm border border-border bg-card">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completedPct}%` }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="h-full bg-emerald-500/40 border-r border-emerald-400/60 flex items-center justify-center"
            title={`Completed: ${totals.completed} units`}
          >
            {completedPct > 4 && (
              <span className="text-[13px] font-bold text-emerald-100 tabular-nums">
                {totals.completed}
              </span>
            )}
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${inProgressPct}%` }}
            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
            className="h-full bg-amber-500/40 border-r border-amber-400/60 flex items-center justify-center"
            title={`In Progress: ${totals.inProgress} units`}
          >
            {inProgressPct > 4 && (
              <span className="text-[13px] font-bold text-amber-100 tabular-nums">
                {totals.inProgress}
              </span>
            )}
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${remainingPct}%` }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
            className="h-full bg-zinc-800/80 flex items-center justify-center"
            title={`Remaining: ${totals.remaining} units`}
          >
            {remainingPct > 4 && (
              <span className="text-[13px] font-bold text-zinc-300 tabular-nums">
                {totals.remaining}
              </span>
            )}
          </motion.div>
        </div>

        <div className="mt-3 flex items-center gap-5 text-[11px] text-muted-foreground">
          <LegendDot color="bg-emerald-400" label="Completed (Passed + Prior)" />
          <LegendDot color="bg-amber-400" label="In Progress" />
          <LegendDot color="bg-zinc-600" label="Remaining" />
        </div>
      </motion.section>

      {/* 4 · GPA REPAIR BANNER ============================================= */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        className="px-10 pb-8"
      >
        <GpaBanner sjsuGpa={meta.sjsu_gpa} />
      </motion.section>

      {/* ── TAB STRIP — controls the timeline section below ───────────── */}
      <ScenarioTabs active={activeTab} onChange={setActiveTab} />

      {/* Branch: Standard tab gets the live timeline + danger pairs.
          Risk and Buffer tabs render their own read-only views. */}
      {activeTab !== "standard" ? (
        <>
          {activeTab === "risk" && <RiskTermView />}
          {activeTab === "buffer" && <BufferView courses={courses} />}
        </>
      ) : (
        <StandardTimelineSection
          terms={terms}
          coursesByTerm={coursesByTerm}
          currentTermId={currentTermId}
          selectedRowId={selectedRowId}
          onSelectRow={setSelectedRowId}
        />
      )}

      {/* Strategic intelligence drawer — opens when a course row is clicked. */}
      <CourseDrawer
        code={selectedRow?.code ?? null}
        planCourses={courses}
        selectedRow={selectedRow}
        onClose={() => setSelectedRowId(null)}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab strip — three views on the same plan
// ═══════════════════════════════════════════════════════════════════
function ScenarioTabs({
  active,
  onChange,
}: {
  active: ScenarioTab;
  onChange: (t: ScenarioTab) => void;
}) {
  const tabs: { id: ScenarioTab; label: string; sub: string; icon: React.ReactNode }[] = [
    {
      id: "standard",
      label: "Standard",
      sub: "Live editable plan · Spring 2028",
      icon: <GraduationCap className="h-3.5 w-3.5" />,
    },
    {
      id: "risk",
      label: "Risk Term",
      sub: "Aggressive · Fall 2027 + CC + Winter",
      icon: <Zap className="h-3.5 w-3.5" />,
    },
    {
      id: "buffer",
      label: "Buffer",
      sub: "Recovery from failures · auto-computed",
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
    },
  ];
  return (
    <div className="px-10 mb-2">
      <div className="border-b border-border flex items-stretch gap-0">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative px-6 py-3.5 text-left transition-colors group ${
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/85"
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={isActive ? "text-primary" : "text-muted-foreground/70"}>
                  {t.icon}
                </span>
                <span className="text-[13px] font-bold tracking-tight">{t.label}</span>
              </div>
              <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground/80 font-medium">
                {t.sub}
              </div>
              {isActive && (
                <motion.div
                  layoutId="scenario-tab-underline"
                  className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary"
                  transition={{ type: "spring", damping: 28, stiffness: 320 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Standard timeline — extracted so the tab branch stays clean
// ═══════════════════════════════════════════════════════════════════
function StandardTimelineSection({
  terms,
  coursesByTerm,
  currentTermId,
  selectedRowId,
  onSelectRow,
}: {
  terms: Term[];
  coursesByTerm: Map<string, Course[]>;
  currentTermId: string | null;
  selectedRowId: number | null;
  onSelectRow: (id: number) => void;
}) {
  return (
    <>
      {/* 5 · SEMESTER TIMELINE ============================================ */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
        className="px-10 pb-10"
      >
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-[18px] font-bold text-foreground tracking-tight">
            Term Timeline
          </h2>
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
            {terms[0]?.label} → {terms[terms.length - 1]?.label}
          </span>
        </div>

        <div className="border-t border-border">
          {terms.map((term, idx) => (
            <TermRow
              key={term.id}
              term={term}
              courses={coursesByTerm.get(term.id) ?? []}
              index={idx}
              isCurrent={term.id === currentTermId}
              isTarget={term.is_target}
              selectedRowId={selectedRowId}
              onSelectRow={onSelectRow}
            />
          ))}
        </div>
      </motion.section>

      {/* 6 · DANGER PAIRS ================================================= */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        className="px-10 pb-16"
      >
        <div className="flex items-center gap-2.5 mb-5">
          <Flame className="h-5 w-5 text-red-400" />
          <h2 className="text-[18px] font-bold text-foreground tracking-tight">
            High-Risk Course Combinations
          </h2>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold ml-2">
            Avoid pairing in same term
          </span>
        </div>

        <div className="border-t border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-8 px-2 py-3 border-b border-border">
            <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/70 font-semibold">
              Avoid Pairing
            </span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-foreground/70 font-semibold">
              Why
            </span>
          </div>
          {DANGER_PAIRS.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-8 px-2 py-4 border-b border-border/60 last:border-b-0 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                <code className="text-[13.5px] font-semibold text-foreground truncate">
                  {p.pair}
                </code>
              </div>
              <p className="text-[13.5px] leading-relaxed text-foreground/75">{p.why}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Hero (with editable target grad term + GPAs)
// ═══════════════════════════════════════════════════════════════════
function Hero({ meta, onTrack }: { meta: Meta; onTrack: boolean }) {
  const updateMeta = useUpdateMeta();

  return (
    <>
      <div className="flex items-start justify-between gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-sm bg-primary/[0.12] border border-primary/30">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <span className="text-[11px] uppercase tracking-[0.2em] text-foreground/70 font-semibold">
              Executive · Personal Education Plan
            </span>
          </div>

          <h1 className="text-[38px] leading-[1.05] font-bold tracking-tight text-foreground">
            {meta.program.split("&").length === 2 ? (
              <>
                {meta.program.split("&")[0].trim()}{" "}
                <span className="text-muted-foreground/70">&amp;</span>{" "}
                {meta.program.split("&")[1].trim()}
              </>
            ) : (
              meta.program
            )}
          </h1>

          <div className="mt-3 flex items-center gap-3 text-[14px] text-muted-foreground flex-wrap">
            <span className="text-foreground/75 font-medium">{meta.university}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="inline-flex items-center gap-1.5">
              <Target className="h-4 w-4" />
              Target Graduation:{" "}
              <EditableText
                value={meta.target_grad_term}
                onSave={(v) => updateMeta.mutate({ target_grad_term: v })}
                className="text-foreground font-semibold ml-1"
              />
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span>
              Student:{" "}
              <EditableText
                value={meta.student_name}
                onSave={(v) => updateMeta.mutate({ student_name: v })}
                className="text-foreground font-medium"
              />
            </span>
          </div>
        </div>

        {/* Status badge */}
        <div className="shrink-0">
          <div
            className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-sm border text-[12px] font-semibold tracking-wide ${
              onTrack
                ? "bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40"
                : "bg-amber-500/[0.14] text-amber-200 border-amber-400/40"
            }`}
          >
            <span className="relative inline-flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${onTrack ? "bg-emerald-400" : "bg-amber-400"} opacity-80 animate-ping`}
              />
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${onTrack ? "bg-emerald-400" : "bg-amber-400"}`}
              />
            </span>
            {onTrack ? "On Track" : "At Risk"}
          </div>
        </div>
      </div>

      {/* GPA strip */}
      <div className="mt-7 flex items-center gap-12 border-t border-border pt-6 flex-wrap">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            SJSU GPA
          </div>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <EditableNumber
              value={meta.sjsu_gpa}
              onSave={(v) => updateMeta.mutate({ sjsu_gpa: v })}
              className={`text-[34px] font-bold tabular-nums tracking-tight leading-none ${
                meta.sjsu_gpa !== null && meta.sjsu_gpa < 2.0 ? "text-red-400" : "text-foreground"
              }`}
            />
            {meta.sjsu_gpa !== null && meta.sjsu_gpa < 2.0 && (
              <>
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <span className="text-[12px] text-red-300/90 font-medium">
                  below 2.0 minimum
                </span>
              </>
            )}
          </div>
        </div>
        <div className="h-12 w-px bg-border" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Overall GPA
          </div>
          <div className="mt-1.5">
            <EditableNumber
              value={meta.overall_gpa}
              onSave={(v) => updateMeta.mutate({ overall_gpa: v })}
              className="text-[34px] font-bold text-foreground tabular-nums tracking-tight leading-none"
            />
          </div>
        </div>
        <div className="h-12 w-px bg-border" />
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
            Program
          </div>
          <div className="mt-1.5 text-[16px] text-foreground/90 font-medium">
            {meta.program}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Term row (with drag-and-drop drop zone + add-course button)
// ═══════════════════════════════════════════════════════════════════
function TermRow({
  term,
  courses,
  index,
  isCurrent,
  isTarget,
  selectedRowId,
  onSelectRow,
}: {
  term: Term;
  courses: Course[];
  index: number;
  isCurrent: boolean;
  isTarget: boolean;
  selectedRowId: number | null;
  onSelectRow: (id: number) => void;
}) {
  const moveCourse = useMoveCourse();
  const addCourse = useAddCourse();
  const [adding, setAdding] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const totalUnits = courses.reduce((s, c) => s + c.units, 0);

  const accentBar = isCurrent
    ? "bg-amber-500/70"
    : isTarget
      ? "bg-emerald-500/70"
      : term.mandatory
        ? "bg-slate-500/50"
        : "bg-border";

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const idStr = e.dataTransfer.getData("text/plain");
    const id = Number(idStr);
    if (!Number.isFinite(id)) return;
    moveCourse.mutate({ id, term_id: term.id });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.18 + index * 0.04, ease: "easeOut" }}
      className={`grid grid-cols-[200px_1fr] gap-x-8 py-6 border-b border-border last:border-b-0 transition-colors ${dragOver ? "bg-primary/[0.04]" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Left rail */}
      <div className="relative pl-5">
        <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-full ${accentBar}`} />
        <div className="text-[20px] font-bold text-foreground tracking-tight leading-tight">
          {term.label}
        </div>
        {(term.tag || isCurrent || isTarget) && (
          <div
            className={`mt-2 text-[11px] uppercase tracking-[0.15em] font-semibold ${
              isCurrent ? "text-amber-200" : isTarget ? "text-emerald-200" : "text-muted-foreground"
            }`}
          >
            {isCurrent ? "Current — In Progress" : isTarget ? "Target Graduation" : term.tag}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2 text-[12.5px] text-muted-foreground tabular-nums">
          <span className="text-foreground font-semibold">{totalUnits}</span>
          <span>units</span>
          <span className="text-muted-foreground/40">·</span>
          <span>
            <span className="text-foreground/85 font-medium">{courses.length}</span> courses
          </span>
        </div>
        {isCurrent && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-amber-200 font-medium">
            <Clock className="h-3.5 w-3.5" /> active term
          </div>
        )}
        {isTarget && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] text-emerald-200 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> graduation
          </div>
        )}
      </div>

      {/* Right column — course rows */}
      <div className="min-w-0">
        <div className="grid grid-cols-[18px_120px_minmax(0,1fr)_60px_minmax(200px,auto)_minmax(160px,auto)_36px] items-center gap-x-4 px-2 pb-2.5 border-b border-border">
          <span />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Code</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Course</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold text-right">Units</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Category</span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold text-right">Status</span>
          <span />
        </div>

        {courses.map((c) => (
          <CourseRow
            key={c.id}
            course={c}
            isSelected={c.id === selectedRowId}
            onSelect={() => onSelectRow(c.id)}
          />
        ))}

        {courses.length === 0 && !adding && (
          <div className="px-2 py-4 text-[12px] text-muted-foreground/60 italic">
            No courses — add one or drop one here.
          </div>
        )}

        {/* Add-course inline form OR add-course trigger */}
        {adding ? (
          <AddCourseForm
            onSubmit={(payload) => {
              addCourse.mutate(
                { ...payload, term_id: term.id },
                { onSuccess: () => setAdding(false) },
              );
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-1 inline-flex items-center gap-1.5 px-2 py-2 text-[11.5px] text-muted-foreground hover:text-primary hover:bg-primary/[0.05] rounded-sm transition-colors font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            Add course to {term.label}
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Course row — draggable, clickable (opens drawer), with status menu
// + edit + delete. Interactive children (status pill, edit, delete,
// drag handle) call stopPropagation so they don't also open the drawer.
// ═══════════════════════════════════════════════════════════════════
function CourseRow({
  course,
  isSelected,
  onSelect,
}: {
  course: Course;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const updateStatus = useUpdateCourseStatus();
  const editCourse = useEditCourse();
  const deleteCourse = useDeleteCourse();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const chip = statusChip(course.status);

  if (editing) {
    return (
      <EditCourseInline
        course={course}
        onSubmit={(patch) => {
          editCourse.mutate(
            { id: course.id, patch },
            { onSuccess: () => setEditing(false) },
          );
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  // Click handler — only fires drawer-open if the click didn't land on
  // an interactive child (button, input, code editor, etc.). The
  // interactive children also call stopPropagation as belt-and-suspenders.
  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button, input, [data-no-drawer]")) return;
    onSelect();
  };

  return (
    <div
      draggable
      onClick={handleRowClick}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(course.id));
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`group relative grid grid-cols-[18px_120px_minmax(0,1fr)_60px_minmax(200px,auto)_minmax(160px,auto)_36px] items-center gap-x-4 px-2 py-3.5 border-b border-border/40 last:border-b-0 transition-colors cursor-pointer ${
        dragging
          ? "opacity-40"
          : isSelected
            ? "bg-primary/[0.06]"
            : "hover:bg-muted/30"
      }`}
    >
      {/* Active-row accent strip on the left */}
      {isSelected && (
        <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary" aria-hidden />
      )}
      {/* Drag handle — cursor hint only, dragging fires from the row itself */}
      <div
        data-no-drawer
        className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Code + critical pulse */}
      <div className="flex items-center gap-2.5 min-w-0">
        {course.critical && <CriticalPulse />}
        <code className="text-[13.5px] font-mono font-semibold text-foreground truncate">
          {course.code}
        </code>
      </div>

      {/* Name */}
      <div className="min-w-0">
        <span className="text-[14px] text-foreground/90 truncate block font-medium">
          {course.name}
        </span>
      </div>

      {/* Units */}
      <div className="text-right text-[13.5px] tabular-nums text-foreground/85 font-semibold">
        {course.units}
      </div>

      {/* Category */}
      <div className="min-w-0">
        <Pill className={categoryStyle(course.category)}>{course.category}</Pill>
      </div>

      {/* Status (clickable menu) */}
      <div className="flex items-center justify-end gap-2 relative">
        {course.critical && course.status !== "passed" && course.status !== "in_progress" && (
          <span className="inline-flex items-center gap-1 text-[10.5px] text-red-300 uppercase tracking-wide font-bold">
            <TrendingDown className="h-3.5 w-3.5" /> critical
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1.5 group/btn"
        >
          <Pill className={`${chip.cls} hover:brightness-125 transition-all`}>
            {chip.label}
            <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
          </Pill>
        </button>
        <AnimatePresence>
          {menuOpen && (
            <StatusMenu
              current={course.status}
              onPick={(s) => {
                updateStatus.mutate({ id: course.id, status: s });
                setMenuOpen(false);
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Row actions (edit / delete) — hover-reveal */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          title="Edit"
          className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete ${course.code}?`)) {
              deleteCourse.mutate(course.id);
            }
          }}
          title="Delete"
          className="p-1 rounded-sm text-muted-foreground hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Status menu (planned / in_progress / passed / failed / dropped)
// ═══════════════════════════════════════════════════════════════════
function StatusMenu({
  current,
  onPick,
  onClose,
}: {
  current: CourseStatus;
  onPick: (s: CourseStatus) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const options: { value: CourseStatus; label: string; cls: string }[] = [
    { value: "planned",     label: "Planned",     cls: "text-slate-300" },
    { value: "in_progress", label: "In Progress", cls: "text-amber-200" },
    { value: "passed",      label: "Passed",      cls: "text-emerald-200" },
    { value: "failed",      label: "Failed",      cls: "text-red-300" },
    { value: "dropped",     label: "Dropped / W", cls: "text-orange-300" },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-1.5 z-20 bg-card border border-border rounded-sm shadow-lg shadow-black/40 overflow-hidden min-w-[160px]"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPick(opt.value)}
          className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center justify-between hover:bg-muted/50 transition-colors ${opt.cls}`}
        >
          <span className="font-medium">{opt.label}</span>
          {current === opt.value && <Check className="h-3.5 w-3.5" />}
        </button>
      ))}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Add-course inline form
// ═══════════════════════════════════════════════════════════════════
function AddCourseForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: {
    code: string;
    name: string;
    units: number;
    category: string;
    critical: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [units, setUnits] = useState(3);
  const [category, setCategory] = useState("Major Elective");
  const [critical, setCritical] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim() || !name.trim()) return;
        onSubmit({ code: code.trim(), name: name.trim(), units, category, critical });
      }}
      className="grid grid-cols-[18px_120px_minmax(0,1fr)_60px_minmax(200px,auto)_auto_36px] items-center gap-x-4 px-2 py-3 border-b border-border/40 bg-primary/[0.04]"
    >
      <span />
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="CS 100"
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] font-mono font-semibold text-foreground focus:outline-none focus:border-primary/60"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Course name"
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
      />
      <input
        type="number"
        value={units}
        min={1}
        max={9}
        onChange={(e) => setUnits(Number(e.target.value) || 3)}
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-right tabular-nums text-foreground focus:outline-none focus:border-primary/60"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category"
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-primary/60"
      />
      <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={critical}
          onChange={(e) => setCritical(e.target.checked)}
          className="accent-red-500"
        />
        critical
      </label>
      <div className="flex items-center justify-end gap-1">
        <button
          type="submit"
          title="Save"
          className="p-1 rounded-sm text-emerald-300 hover:bg-emerald-500/[0.1]"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="Cancel"
          className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Edit course inline (replaces the row when editing)
// ═══════════════════════════════════════════════════════════════════
function EditCourseInline({
  course,
  onSubmit,
  onCancel,
}: {
  course: Course;
  onSubmit: (patch: Partial<Pick<Course, "code" | "name" | "units" | "category" | "critical">>) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(course.code);
  const [name, setName] = useState(course.name);
  const [units, setUnits] = useState(course.units);
  const [category, setCategory] = useState(course.category);
  const [critical, setCritical] = useState(course.critical);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ code, name, units, category, critical });
      }}
      className="grid grid-cols-[18px_120px_minmax(0,1fr)_60px_minmax(200px,auto)_auto_36px] items-center gap-x-4 px-2 py-3 border-b border-border/40 bg-amber-500/[0.04]"
    >
      <span />
      <input
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] font-mono font-semibold text-foreground focus:outline-none focus:border-primary/60"
      />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
      />
      <input
        type="number"
        value={units}
        min={1}
        max={9}
        onChange={(e) => setUnits(Number(e.target.value) || 3)}
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[13px] text-right tabular-nums text-foreground focus:outline-none focus:border-primary/60"
      />
      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-primary/60"
      />
      <label className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
        <input
          type="checkbox"
          checked={critical}
          onChange={(e) => setCritical(e.target.checked)}
          className="accent-red-500"
        />
        critical
      </label>
      <div className="flex items-center justify-end gap-1">
        <button
          type="submit"
          title="Save"
          className="p-1 rounded-sm text-emerald-300 hover:bg-emerald-500/[0.1]"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          title="Cancel"
          className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════
// GPA banner (uses live SJSU GPA)
// ═══════════════════════════════════════════════════════════════════
function GpaBanner({ sjsuGpa }: { sjsuGpa: number | null }) {
  const atRisk = sjsuGpa !== null && sjsuGpa < 2.0;
  if (!atRisk) {
    // Reframe to a positive note when GPA is healthy.
    return (
      <div className="border-l-[3px] border-emerald-500 bg-emerald-500/[0.05] py-5 pl-6 pr-6">
        <div className="flex items-start gap-3.5">
          <div className="p-1.5 rounded-sm bg-emerald-500/15 border border-emerald-400/30 shrink-0 mt-0.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[15px] font-bold text-foreground tracking-tight">
              SJSU GPA above minimum
            </h4>
            <p className="mt-2 text-[14px] leading-relaxed text-foreground/80">
              SJSU GPA is{" "}
              <span className="text-emerald-200 font-bold tabular-nums">
                {sjsuGpa?.toFixed(3) ?? "—"}
              </span>{" "}
              — comfortably above the 2.0 graduation minimum.
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="border-l-[3px] border-red-500 bg-red-500/[0.07] py-5 pl-6 pr-6">
      <div className="flex items-start gap-3.5">
        <div className="p-1.5 rounded-sm bg-red-500/20 border border-red-400/40 shrink-0 mt-0.5">
          <ShieldAlert className="h-4 w-4 text-red-300" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h4 className="text-[15px] font-bold text-foreground tracking-tight">
              GPA Repair Window
            </h4>
            <span className="text-[10px] uppercase tracking-[0.18em] text-red-300 font-bold px-1.5 py-0.5 rounded-sm bg-red-500/15 border border-red-400/40">
              Critical
            </span>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-foreground/80 max-w-3xl">
            SJSU GPA is{" "}
            <span className="text-red-300 font-bold tabular-nums">
              {sjsuGpa.toFixed(3)}
            </span>{" "}
            — minimum{" "}
            <span className="text-foreground font-semibold tabular-nums">2.0</span>{" "}
            required to graduate. Every grade from here forward is weighted heavily.{" "}
            <span className="text-foreground font-semibold">No room for D's or W's.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Atoms ──────────────────────────────────────────────────────────
function CriticalPulse() {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0" title="Critical path">
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-80 animate-ping" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-500/20" />
    </span>
  );
}

function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-sm border text-[11px] font-semibold tracking-wide whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="font-medium">{label}</span>
    </span>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "red" | "amber" | "emerald";
}) {
  const accentCls =
    accent === "red"
      ? "text-red-400"
      : accent === "amber"
        ? "text-amber-200"
        : accent === "emerald"
          ? "text-emerald-200"
          : "text-foreground";
  return (
    <div className="px-7 py-6">
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
        {label}
      </div>
      <div className={`mt-2 text-[30px] font-bold tabular-nums tracking-tight leading-none ${accentCls}`}>
        {value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

// ─── Editable text & number primitives ─────────────────────────────
function EditableText({
  value,
  onSave,
  className = "",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== value) onSave(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={`bg-transparent border-b border-primary/60 focus:outline-none ${className}`}
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={`${className} inline-block hover:underline decoration-dotted underline-offset-4 transition-all cursor-text text-left`}
    >
      {value}
    </button>
  );
}

function EditableNumber({
  value,
  onSave,
  className = "",
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => {
    setDraft(value?.toString() ?? "");
  }, [value]);
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="0.001"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const n = draft.trim() === "" ? null : Number(draft);
          if (n === null || Number.isFinite(n)) {
            if (n !== value) onSave(n);
          }
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value?.toString() ?? "");
            setEditing(false);
          }
        }}
        className={`bg-transparent border-b border-primary/60 focus:outline-none w-[120px] ${className}`}
      />
    );
  }
  return (
    <button
      onClick={() => setEditing(true)}
      className={`${className} hover:underline decoration-dotted underline-offset-4 transition-all cursor-text`}
    >
      {value !== null ? value.toFixed(3) : "—"}
    </button>
  );
}

// ─── Style helpers ─────────────────────────────────────────────────
function categoryStyle(cat: string): string {
  if (cat.startsWith("CS")) return "bg-indigo-500/[0.14] text-indigo-200 border-indigo-400/40";
  if (cat.startsWith("LING")) return "bg-violet-500/[0.14] text-violet-200 border-violet-400/40";
  if (cat.startsWith("Major Prep")) return "bg-amber-500/[0.14] text-amber-200 border-amber-400/40";
  if (cat === "Major Elective") return "bg-zinc-500/[0.14] text-zinc-200 border-zinc-400/40";
  return "bg-slate-500/[0.14] text-slate-200 border-slate-400/40";
}

function statusChip(status: CourseStatus): { label: string; cls: string } {
  switch (status) {
    case "passed":
      return { label: "Passed", cls: "bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40" };
    case "in_progress":
      return { label: "In Progress", cls: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40" };
    case "failed":
      return { label: "Failed", cls: "bg-red-500/[0.14] text-red-200 border-red-400/40" };
    case "dropped":
      return { label: "Dropped / W", cls: "bg-orange-500/[0.12] text-orange-200 border-orange-400/40" };
    case "planned":
    default:
      return { label: "Planned", cls: "bg-slate-500/[0.12] text-slate-300 border-slate-400/30" };
  }
}
