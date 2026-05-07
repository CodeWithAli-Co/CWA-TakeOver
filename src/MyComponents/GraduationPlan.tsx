/**
 * GraduationPlan.tsx — Executive view of Ali's BS CS & Linguistics degree path.
 *
 * Audience: CEO & COO only (gated via UserView at the route level).
 * Aesthetic: dark editorial — Bloomberg terminal × The Economist. Monochrome
 * neutrals, typographic hierarchy, thin dividers, semantic accents only.
 *
 * Sections:
 *   1. Hero header (program · grad target · status badge · GPAs)
 *   2. Stat strip (units · courses · semesters · critical)
 *   3. Unit progress bar (segmented: complete · in-progress · remaining)
 *   4. GPA repair banner (left-border alert, never a popup)
 *   5. Semester timeline (one term per row, courses listed per term)
 *   6. Danger pairs (high-risk course combinations)
 */

import { motion } from "framer-motion";
import {
  AlertTriangle,
  GraduationCap,
  Target,
  TrendingDown,
  CheckCircle2,
  Clock,
  Flame,
  ShieldAlert,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
type CourseStatus = "completed" | "in_progress" | "planned";

type Category =
  | "CS Core"
  | "CS Core Gateway"
  | "CS UD Elective"
  | "CS Elective"
  | "Major Elective"
  | "LING Core"
  | "LING Core — Capstone"
  | "LING Core — unlocks NLP"
  | "LING UD Choice"
  | "LING UD Elective"
  | "Major Prep"
  | "Major Prep — CRITICAL"
  | "GE: UD Area 4"
  | "GE: UD Area 3"
  | "GE: UD Area 2/5"
  | "GE: Area 6 Ethnic Studies"
  | "WID Requirement"
  | "AI: US1 Requirement";

type Course = {
  code: string;
  name: string;
  units: number;
  category: Category;
  status: CourseStatus;
  critical?: boolean;
};

type Term = {
  id: string;
  label: string;          // e.g. "Spring 2026"
  tag?: string;           // e.g. "Current — In Progress"
  mandatory?: boolean;    // summer terms flagged mandatory
  isCurrent?: boolean;
  isTarget?: boolean;     // graduation term
  courses: Course[];
};

// ─── Plan data ──────────────────────────────────────────────────────
const PLAN: Term[] = [
  {
    id: "sp26",
    label: "Spring 2026",
    tag: "Current — In Progress",
    isCurrent: true,
    courses: [
      { code: "BUS3 186", name: "Prof & Bus Ethics", units: 3, category: "GE: UD Area 4", status: "in_progress" },
      { code: "CS 22B", name: "Python Data Analysis", units: 3, category: "Major Elective", status: "in_progress" },
      { code: "LLD 100W", name: "Writing Workshop", units: 3, category: "WID Requirement", status: "in_progress" },
      { code: "MATH 42", name: "Discrete Math", units: 3, category: "Major Prep — CRITICAL", status: "in_progress", critical: true },
      { code: "PHIL 134", name: "Computers, Ethics, Society", units: 3, category: "GE: UD Area 3", status: "in_progress" },
    ],
  },
  {
    id: "su26",
    label: "Summer 2026",
    tag: "Mandatory",
    mandatory: true,
    courses: [
      { code: "MATH 31", name: "Calculus II", units: 4, category: "Major Prep — CRITICAL", status: "planned", critical: true },
      { code: "AAS 1", name: "Intro Asian American Studies", units: 3, category: "GE: Area 6 Ethnic Studies", status: "planned" },
    ],
  },
  {
    id: "fa26",
    label: "Fall 2026",
    courses: [
      { code: "CS 146", name: "Data Structures & Algorithms", units: 3, category: "CS Core Gateway", status: "planned", critical: true },
      { code: "CS 154", name: "Formal Languages & Computability", units: 3, category: "CS Core", status: "planned" },
      { code: "MATH 39", name: "Linear Algebra I", units: 3, category: "Major Prep", status: "planned" },
      { code: "LING 111", name: "Linguistic Phonetics", units: 3, category: "LING Core", status: "planned" },
      { code: "HIST 15", name: "Essentials of U.S. History", units: 3, category: "AI: US1 Requirement", status: "planned" },
    ],
  },
  {
    id: "sp27",
    label: "Spring 2027",
    courses: [
      { code: "CS 156", name: "Intro to Artificial Intelligence", units: 3, category: "CS Core", status: "planned" },
      { code: "MATH 161A", name: "Applied Prob & Statistics I", units: 3, category: "Major Prep", status: "planned" },
      { code: "LING 112", name: "Intro to Syntax", units: 3, category: "LING Core", status: "planned" },
      { code: "LING 115", name: "Corpus Linguistics", units: 3, category: "LING Core — unlocks NLP", status: "planned" },
      { code: "LING 113", name: "Intro to Phonology", units: 3, category: "LING UD Choice", status: "planned" },
    ],
  },
  {
    id: "su27",
    label: "Summer 2027",
    tag: "Mandatory",
    mandatory: true,
    courses: [
      { code: "ANTH 160", name: "Mysteries of Ancient Civilizations", units: 3, category: "GE: UD Area 2/5", status: "planned" },
      { code: "LING 122", name: "English as a World Language", units: 3, category: "LING UD Elective", status: "planned" },
    ],
  },
  {
    id: "fa27",
    label: "Fall 2027",
    courses: [
      { code: "CS 171", name: "Intro to Machine Learning", units: 3, category: "CS Core", status: "planned", critical: true },
      { code: "LING 124", name: "Intro to Speech Technology", units: 3, category: "LING Core", status: "planned", critical: true },
      { code: "CS 157A", name: "Intro to Database Mgmt Systems", units: 3, category: "CS UD Elective", status: "planned" },
    ],
  },
  {
    id: "sp28",
    label: "Spring 2028",
    tag: "Target Graduation",
    isTarget: true,
    courses: [
      { code: "LING 165", name: "Intro to Natural Language Processing", units: 3, category: "LING Core — Capstone", status: "planned", critical: true },
      { code: "CS 133", name: "Data Visualization", units: 3, category: "CS Elective", status: "planned" },
    ],
  },
];

// Danger pairs — derived from the plan above. These are the combinations that
// historically tank GPAs at SJSU, especially given the SJSU GPA repair window.
const DANGER_PAIRS: { pair: string; why: string }[] = [
  {
    pair: "MATH 42 + MATH 31",
    why: "Two math-heavy courses overlapping. If MATH 42 isn't fully closed, Calc II's pace will compound the deficit.",
  },
  {
    pair: "CS 146 + CS 154",
    why: "DS&A and Formal Languages are both proof-heavy CS gateway weed-outs. Stacking them is the standard SJSU GPA killer.",
  },
  {
    pair: "CS 156 + MATH 161A",
    why: "AI sits on top of probability theory. Taking it the same term as the underlying stats course doubles workload on the same concepts.",
  },
  {
    pair: "LING 165 before LING 115 or 124",
    why: "NLP capstone depends on Corpus Linguistics and Speech Tech. Reordering breaks the prerequisite chain.",
  },
  {
    pair: "Two upper-div Math in summer",
    why: "Compressed summer terms move at 2× pace. Pairing 161A-tier math with anything quantitative is a forced W.",
  },
  {
    pair: "LLD 100W + heavy STEM stack",
    why: "Writing-intensive (4–6 essays + revisions) does not cohabit with two CS cores. Already mitigated this term — keep the rule.",
  },
];

// ─── Computed totals ────────────────────────────────────────────────
const REQUIRED_UNITS = 120;
const REMAINING_UNITS = 82;
const COMPLETED_UNITS = REQUIRED_UNITS - REMAINING_UNITS; // 38

const allCourses = PLAN.flatMap((t) => t.courses);
const inProgressUnits = allCourses
  .filter((c) => c.status === "in_progress")
  .reduce((sum, c) => sum + c.units, 0);
const planTotalCourses = allCourses.length;
const planCompletedCourses = allCourses.filter((c) => c.status === "completed").length;
const semestersRemaining = PLAN.length;

// Spec: "4 critical: MATH 31, CS 146, CS 171, LING 165". We surface that figure
// directly so the stat block matches the brief; the `critical` flag in the
// course data drives the per-row pulse independently.
const CRITICAL_LEFT_DISPLAY = 4;

// Bar segments (units)
const remainingOnlyUnits = REMAINING_UNITS - inProgressUnits; // 82 - 15 = 67

// ─── Style helpers ──────────────────────────────────────────────────
function categoryStyle(cat: Category): string {
  // Indigo for CS, violet for LING, amber for Math/Prep, slate for GE/WID/AI, zinc for elective.
  if (cat.startsWith("CS"))
    return "bg-indigo-500/[0.08] text-indigo-300 border-indigo-500/20";
  if (cat.startsWith("LING"))
    return "bg-violet-500/[0.08] text-violet-300 border-violet-500/20";
  if (cat.startsWith("Major Prep"))
    return "bg-amber-500/[0.08] text-amber-300 border-amber-500/20";
  if (cat === "Major Elective")
    return "bg-zinc-500/[0.08] text-zinc-300 border-zinc-500/20";
  // GE / WID / AI
  return "bg-slate-500/[0.08] text-slate-300 border-slate-500/20";
}

function statusChip(status: CourseStatus): { label: string; cls: string } {
  switch (status) {
    case "completed":
      return { label: "Completed", cls: "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/20" };
    case "in_progress":
      return { label: "In Progress", cls: "bg-amber-500/[0.08] text-amber-300 border-amber-500/20" };
    case "planned":
    default:
      return { label: "Planned", cls: "bg-slate-500/[0.08] text-slate-400 border-slate-500/15" };
  }
}

// ─── Tiny presentational atoms ──────────────────────────────────────

/** Solid red dot with a slow ping — used to flag critical-path courses. */
function CriticalPulse() {
  return (
    <span className="relative inline-flex h-1.5 w-1.5 shrink-0" title="Critical path">
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 animate-ping" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
    </span>
  );
}

/** Tiny outlined badge — same language as the rest of the app's badges. */
function Pill({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-medium tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════
export default function GraduationPlan() {
  const onTrack = true; // While SJSU GPA is at risk, the *plan itself* still hits Spring 2028.

  const completedPct = (COMPLETED_UNITS / REQUIRED_UNITS) * 100;
  const inProgressPct = (inProgressUnits / REQUIRED_UNITS) * 100;
  const remainingPct = (remainingOnlyUnits / REQUIRED_UNITS) * 100;

  return (
    <div className="min-h-screen w-full bg-background text-foreground overflow-y-auto">
      {/* ════════════════════════════════════════════════════════
           1 · HERO HEADER
         ════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="px-10 pt-10 pb-6"
      >
        <div className="flex items-start justify-between gap-8">
          <div className="min-w-0">
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-sm bg-primary/[0.08] border border-primary/15">
                <GraduationCap className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Executive · Personal Education Plan
              </span>
            </div>

            <h1 className="text-[34px] leading-[1.1] font-bold tracking-tight text-foreground">
              BS Computer Science <span className="text-muted-foreground/60">&amp;</span> Linguistics
            </h1>

            <div className="mt-2 flex items-center gap-3 text-[13px] text-muted-foreground">
              <span>SJSU</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" />
                Target Graduation: <span className="text-foreground/85 font-medium">Spring 2028</span>
              </span>
              <span className="text-muted-foreground/30">·</span>
              <span>Student: <span className="text-foreground/85">Ali Alibrahimi</span></span>
            </div>
          </div>

          {/* Status badge */}
          <div className="shrink-0">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-sm border text-[11px] font-medium tracking-wide ${
                onTrack
                  ? "bg-emerald-500/[0.08] text-emerald-300 border-emerald-500/20"
                  : "bg-amber-500/[0.08] text-amber-300 border-amber-500/20"
              }`}
            >
              <span className="relative inline-flex h-1.5 w-1.5">
                <span
                  className={`absolute inline-flex h-full w-full rounded-full ${
                    onTrack ? "bg-emerald-400" : "bg-amber-400"
                  } opacity-75 animate-ping`}
                />
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    onTrack ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
              </span>
              {onTrack ? "On Track" : "At Risk"}
            </div>
          </div>
        </div>

        {/* GPA strip — typographic, no card */}
        <div className="mt-6 flex items-center gap-10 border-t border-border pt-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">SJSU GPA</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[28px] font-bold text-red-400 tabular-nums tracking-tight">1.390</span>
              <AlertTriangle className="h-4 w-4 text-red-400/80" />
              <span className="text-[11px] text-red-400/70">below 2.0 minimum</span>
            </div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Overall GPA</div>
            <div className="mt-1 text-[28px] font-bold text-foreground tabular-nums tracking-tight">2.457</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Program</div>
            <div className="mt-1 text-[15px] text-foreground/85">Dual Major · CS + Linguistics</div>
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════
           2 · STAT STRIP
         ════════════════════════════════════════════════════════ */}
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
              value={REQUIRED_UNITS.toString()}
              sub={`${REMAINING_UNITS} remaining`}
            />
            <Stat
              label="Plan Courses"
              value={`${planCompletedCourses}/${planTotalCourses}`}
              sub={`${allCourses.filter((c) => c.status === "in_progress").length} in progress`}
            />
            <Stat
              label="Semesters Remaining"
              value={semestersRemaining.toString()}
              sub="including current term"
            />
            <Stat
              label="Critical Requirements Left"
              value={CRITICAL_LEFT_DISPLAY.toString()}
              sub="MATH 31 · CS 146 · CS 171 · LING 165"
              accent="red"
            />
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════
           3 · UNIT PROGRESS BAR
         ════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08, ease: "easeOut" }}
        className="px-10 pb-8"
      >
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Unit Progress
          </h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            <span className="text-foreground/85 font-medium">{COMPLETED_UNITS}</span> / {REQUIRED_UNITS} units
          </span>
        </div>

        <div className="flex h-7 w-full overflow-hidden rounded-sm border border-border bg-card">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${completedPct}%` }}
            transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
            className="h-full bg-emerald-500/30 border-r border-emerald-500/40 flex items-center justify-center"
            title={`Completed: ${COMPLETED_UNITS} units`}
          >
            <span className="text-[10px] font-medium text-emerald-200 tabular-nums">
              {COMPLETED_UNITS}
            </span>
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${inProgressPct}%` }}
            transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
            className="h-full bg-amber-500/30 border-r border-amber-500/40 flex items-center justify-center"
            title={`In Progress: ${inProgressUnits} units`}
          >
            <span className="text-[10px] font-medium text-amber-200 tabular-nums">
              {inProgressUnits}
            </span>
          </motion.div>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${remainingPct}%` }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
            className="h-full bg-zinc-800/60 flex items-center justify-center"
            title={`Remaining: ${remainingOnlyUnits} units`}
          >
            <span className="text-[10px] font-medium text-zinc-400 tabular-nums">
              {remainingOnlyUnits}
            </span>
          </motion.div>
        </div>

        <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <LegendDot color="bg-emerald-500" label="Completed" />
          <LegendDot color="bg-amber-500" label="In Progress" />
          <LegendDot color="bg-zinc-700" label="Remaining" />
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════
           4 · GPA REPAIR BANNER
         ════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
        className="px-10 pb-8"
      >
        <div className="border-l-2 border-red-500 bg-red-500/[0.04] py-4 pl-5 pr-6">
          <div className="flex items-start gap-3">
            <ShieldAlert className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-baseline gap-3">
                <h4 className="text-[13px] font-semibold text-foreground">GPA Repair Window</h4>
                <span className="text-[10px] uppercase tracking-[0.15em] text-red-400/80">
                  Critical
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground max-w-3xl">
                SJSU GPA is{" "}
                <span className="text-red-400 font-medium tabular-nums">1.390</span> — minimum{" "}
                <span className="text-foreground/85 tabular-nums">2.0</span> required to graduate.
                Every grade from here forward is weighted heavily.{" "}
                <span className="text-foreground/85">No room for D's or W's.</span>
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════
           5 · SEMESTER TIMELINE
         ════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12, ease: "easeOut" }}
        className="px-10 pb-10"
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
            Term Timeline
          </h2>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Spring 2026 → Spring 2028
          </span>
        </div>

        <div className="border-t border-border">
          {PLAN.map((term, idx) => (
            <TermRow key={term.id} term={term} index={idx} />
          ))}
        </div>
      </motion.section>

      {/* ════════════════════════════════════════════════════════
           6 · DANGER PAIRS
         ════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
        className="px-10 pb-16"
      >
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-4 w-4 text-red-400" />
          <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
            High-Risk Course Combinations
          </h2>
          <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground ml-2">
            Avoid pairing in same term
          </span>
        </div>

        <div className="border-t border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-8 px-1 py-3 border-b border-border">
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Avoid Pairing
            </span>
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              Why
            </span>
          </div>
          {DANGER_PAIRS.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-8 px-1 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-3 w-3 text-red-400/70 shrink-0" />
                <code className="text-[12.5px] font-medium text-foreground/90 truncate">
                  {p.pair}
                </code>
              </div>
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">{p.why}</p>
            </div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

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
        ? "text-amber-300"
        : accent === "emerald"
          ? "text-emerald-300"
          : "text-foreground";
  return (
    <div className="px-6 py-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1.5 text-[26px] font-bold tabular-nums tracking-tight ${accentCls}`}>
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] text-muted-foreground/80 truncate">{sub}</div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      <span>{label}</span>
    </span>
  );
}

function TermRow({ term, index }: { term: Term; index: number }) {
  const totalUnits = term.courses.reduce((s, c) => s + c.units, 0);
  const accent = term.isCurrent
    ? "amber"
    : term.isTarget
      ? "emerald"
      : term.mandatory
        ? "slate"
        : "default";

  const accentBar =
    accent === "amber"
      ? "bg-amber-500/60"
      : accent === "emerald"
        ? "bg-emerald-500/60"
        : accent === "slate"
          ? "bg-slate-500/40"
          : "bg-border";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.18 + index * 0.04, ease: "easeOut" }}
      className="grid grid-cols-[200px_1fr] gap-x-8 py-6 border-b border-border last:border-b-0"
    >
      {/* Left rail — term label */}
      <div className="relative pl-4">
        <div className={`absolute left-0 top-1 bottom-1 w-[2px] ${accentBar}`} />
        <div className="text-[18px] font-bold text-foreground tracking-tight leading-tight">
          {term.label}
        </div>
        {term.tag && (
          <div
            className={`mt-1.5 text-[10px] uppercase tracking-[0.15em] ${
              term.isCurrent
                ? "text-amber-300"
                : term.isTarget
                  ? "text-emerald-300"
                  : "text-muted-foreground"
            }`}
          >
            {term.tag}
          </div>
        )}
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
          <span className="text-foreground/70 font-medium">{totalUnits}</span> units
          <span className="text-muted-foreground/40">·</span>
          <span>{term.courses.length} courses</span>
        </div>
        {term.isCurrent && (
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-amber-300/90">
            <Clock className="h-3 w-3" /> active term
          </div>
        )}
        {term.isTarget && (
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-300/90">
            <CheckCircle2 className="h-3 w-3" /> graduation
          </div>
        )}
      </div>

      {/* Right column — course rows */}
      <div className="min-w-0">
        <div className="grid grid-cols-[110px_minmax(0,1fr)_60px_minmax(180px,auto)_minmax(120px,auto)] items-center gap-x-4 px-1 pb-2 border-b border-border/60">
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">Code</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">Course</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 text-right">Units</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70">Category</span>
          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 text-right">Status</span>
        </div>

        {term.courses.map((c) => {
          const chip = statusChip(c.status);
          return (
            <div
              key={c.code}
              className="grid grid-cols-[110px_minmax(0,1fr)_60px_minmax(180px,auto)_minmax(120px,auto)] items-center gap-x-4 px-1 py-3 border-b border-border/30 last:border-b-0 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {c.critical && <CriticalPulse />}
                <code className="text-[12.5px] font-mono font-medium text-foreground/90 truncate">
                  {c.code}
                </code>
              </div>

              <div className="min-w-0">
                <span className="text-[13px] text-foreground/85 truncate block">{c.name}</span>
              </div>

              <div className="text-right text-[12.5px] tabular-nums text-foreground/70">
                {c.units}
              </div>

              <div className="min-w-0">
                <Pill className={categoryStyle(c.category)}>{c.category}</Pill>
              </div>

              <div className="flex items-center justify-end gap-2">
                {c.critical && c.status === "planned" && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-red-400/90 uppercase tracking-wide">
                    <TrendingDown className="h-3 w-3" /> critical
                  </span>
                )}
                <Pill className={chip.cls}>{chip.label}</Pill>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
