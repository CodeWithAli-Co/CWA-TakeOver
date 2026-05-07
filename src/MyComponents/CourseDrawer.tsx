/**
 * CourseDrawer.tsx — Strategic intelligence panel for a single course.
 *
 * Slides in from the right when a course row is clicked in the
 * Graduation Plan. Joins the live DB status (passed / in_progress /
 * planned) with the static intelligence registry in
 * graduationCourseData.ts. The result is a one-screen view of:
 *   1. Course identity (division, GE, dept, offered, min grade)
 *   2. Prereq chain (live status per node)
 *   3. What this course unlocks (downstream impact)
 *   4. Swap strategy (impact + safe alternatives)
 *   5. Workload + Ali's strength alignment
 *   6. Registration intelligence (auto-generated checklist)
 *   7. Advisor notes (free-text, hardcoded)
 *
 * Closes on:
 *   · X button
 *   · backdrop click
 *   · Escape key
 *
 * Sized for desktop (480px) and full-screen on mobile.
 */

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Check,
  AlertTriangle,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  Layers,
  Clock,
  Calendar,
  TrendingDown,
  CheckCircle2,
  XCircle,
  StickyNote,
  GitBranch,
  Unlock as UnlockIcon,
  RefreshCcw,
  Activity,
  Compass,
} from "lucide-react";

import {
  CRITICAL_PATH_CODES,
  CourseIntel,
  PrereqChain,
  RecommendedPrepFor,
  RegFlag,
  RiskLevel,
  StrengthAlignment,
  Unlock,
  Workload,
  getCourseIntel,
  isTransferred,
  getTransferNote,
} from "./graduationCourseData";
import { Course, CourseStatus } from "./GraduationPlan.queries";

// ─── Public API ────────────────────────────────────────────────────
export interface CourseDrawerProps {
  /** Code to display. When null/undefined the drawer is closed. */
  code: string | null;
  /** Live plan rows from Supabase — used to compute prereq status. */
  planCourses: Course[];
  /** Optional: the selected course's DB row (for live status chip). */
  selectedRow?: Course | null;
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// Top-level
// ═══════════════════════════════════════════════════════════════════
export default function CourseDrawer({
  code,
  planCourses,
  selectedRow,
  onClose,
}: CourseDrawerProps) {
  // Esc-to-close + lock body scroll while open
  useEffect(() => {
    if (!code) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [code, onClose]);

  return (
    <AnimatePresence>
      {code && (
        <DrawerInner
          code={code}
          planCourses={planCourses}
          selectedRow={selectedRow ?? null}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function DrawerInner({
  code,
  planCourses,
  selectedRow,
  onClose,
}: {
  code: string;
  planCourses: Course[];
  selectedRow: Course | null;
  onClose: () => void;
}) {
  const intel = getCourseIntel(code);

  // Index plan by code for O(1) prereq lookups
  const planByCode = useMemo(() => {
    const m = new Map<string, Course>();
    for (const c of planCourses) m.set(c.code, c);
    return m;
  }, [planCourses]);

  const isCritical = CRITICAL_PATH_CODES.has(code);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
      />

      {/* Panel */}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[480px] bg-background border-l border-border shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <DrawerHeader
          code={code}
          intel={intel}
          status={selectedRow?.status ?? null}
          onClose={onClose}
        />

        <div className="flex-1 overflow-y-auto">
          {isCritical && <CriticalPathBanner />}
          {!intel ? (
            <UnknownCoursePanel code={code} />
          ) : (
            <DrawerBody intel={intel} planByCode={planByCode} />
          )}
        </div>

        {/* Mobile-friendly bottom close */}
        <div className="sm:hidden border-t border-border p-3 bg-background">
          <button
            onClick={onClose}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm bg-muted text-foreground text-[13px] font-medium hover:bg-muted/70 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Header
// ═══════════════════════════════════════════════════════════════════
function DrawerHeader({
  code,
  intel,
  status,
  onClose,
}: {
  code: string;
  intel: CourseIntel | undefined;
  status: CourseStatus | null;
  onClose: () => void;
}) {
  const chip = status ? STATUS_CHIPS[status] : null;
  return (
    <div className="px-6 pt-6 pb-5 border-b border-border bg-background">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">
              Course Intelligence
            </span>
            {chip && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-semibold tracking-wide ${chip.cls}`}
              >
                {chip.label}
              </span>
            )}
          </div>
          <code className="block text-[28px] font-mono font-bold text-foreground tracking-tight leading-none">
            {code}
          </code>
          <h2 className="mt-2 text-[15px] font-semibold text-foreground/90 leading-snug">
            {intel?.fullName ?? "Course not in intelligence registry"}
          </h2>
          {intel && (
            <p className="mt-2 text-[12.5px] text-muted-foreground leading-relaxed max-w-[400px]">
              {intel.shortPurpose}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close drawer"
          className="shrink-0 p-1.5 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Critical path banner
// ═══════════════════════════════════════════════════════════════════
function CriticalPathBanner() {
  return (
    <div className="px-6 pt-5">
      <div className="border-l-[3px] border-red-500 bg-red-500/[0.07] py-3 pl-4 pr-4 flex items-start gap-3">
        <ShieldAlert className="h-4 w-4 text-red-300 mt-0.5 shrink-0" />
        <div>
          <div className="text-[12px] font-bold text-red-200 uppercase tracking-[0.12em]">
            Critical Path Course
          </div>
          <p className="mt-1 text-[12.5px] text-foreground/85 leading-relaxed">
            Missing or failing this course delays graduation by 1+ semester.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Body — section composition
// ═══════════════════════════════════════════════════════════════════
function DrawerBody({
  intel,
  planByCode,
}: {
  intel: CourseIntel;
  planByCode: Map<string, Course>;
}) {
  return (
    <div className="px-6 pb-8">
      <Section title="Course Identity" icon={<Compass className="h-3.5 w-3.5" />}>
        <IdentityBlock intel={intel} />
      </Section>

      <Section title="Prerequisite Chain" icon={<GitBranch className="h-3.5 w-3.5" />}>
        <PrereqChainBlock intel={intel} planByCode={planByCode} />
      </Section>

      <Section title="What This Course Unlocks" icon={<UnlockIcon className="h-3.5 w-3.5" />}>
        <UnlocksBlock intel={intel} />
      </Section>

      <Section
        title="If I Need to Drop or Delay…"
        icon={<RefreshCcw className="h-3.5 w-3.5" />}
      >
        <SwapStrategyBlock intel={intel} />
      </Section>

      <Section title="Workload Profile" icon={<Activity className="h-3.5 w-3.5" />}>
        <WorkloadBlock intel={intel} />
      </Section>

      <Section title="Before You Register" icon={<Layers className="h-3.5 w-3.5" />}>
        <RegistrationBlock intel={intel} planByCode={planByCode} />
      </Section>

      <Section title="Advisor Notes" icon={<StickyNote className="h-3.5 w-3.5" />}>
        <AdvisorNoteBlock intel={intel} />
      </Section>
    </div>
  );
}

function UnknownCoursePanel({ code }: { code: string }) {
  return (
    <div className="px-6 pt-8 pb-6">
      <div className="border-l-[3px] border-amber-400 bg-amber-500/[0.06] py-4 pl-4 pr-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 text-amber-300 mt-0.5 shrink-0" />
          <div>
            <div className="text-[13px] font-semibold text-foreground">
              No intelligence record yet
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
              <code className="text-foreground/85">{code}</code> isn't in the static
              registry. To enable the strategic panel, add an entry to{" "}
              <code className="text-foreground/85">graduationCourseData.ts</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section wrapper
// ═══════════════════════════════════════════════════════════════════
function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border last:border-b-0 py-5">
      <div className="flex items-center gap-2 mb-3.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <h3 className="text-[10.5px] uppercase tracking-[0.2em] font-bold text-foreground/80">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 1. Identity
// ═══════════════════════════════════════════════════════════════════
function IdentityBlock({ intel }: { intel: CourseIntel }) {
  const divisionCls =
    intel.division === "Upper Division"
      ? "bg-indigo-500/[0.14] text-indigo-200 border-indigo-400/40"
      : "bg-zinc-500/[0.14] text-zinc-200 border-zinc-400/40";

  const minGrade = intel.minGrade;
  const minGradeCls =
    minGrade.severity === "strict"
      ? "bg-red-500/[0.14] text-red-200 border-red-400/40"
      : minGrade.severity === "wid"
        ? "bg-amber-500/[0.14] text-amber-200 border-amber-400/40"
        : "bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40";

  return (
    <div className="space-y-3">
      <KV label="Units" value={`${intel.units} units`} />
      <KV
        label="Division"
        value={
          <Pill className={divisionCls}>{intel.division}</Pill>
        }
      />
      <KV label="Department" value={intel.department} />
      <KV
        label="Designation"
        value={<span className="text-foreground/90">{intel.geDesignation}</span>}
      />
      <KV
        label="Offered"
        value={
          <span className="inline-flex items-center gap-1.5 text-foreground/85">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {intel.offered}
          </span>
        }
      />
      <KV
        label="Min Grade"
        value={
          <div className="flex items-center gap-2 flex-wrap">
            <Pill className={minGradeCls}>
              {minGrade.value} or better
            </Pill>
            {minGrade.note && (
              <span className="text-[11px] text-muted-foreground">
                {minGrade.note}
              </span>
            )}
          </div>
        }
      />
      {intel.standingRequirement && (
        <KV
          label="Standing"
          value={
            <span className="text-foreground/85">{intel.standingRequirement}</span>
          }
        />
      )}
    </div>
  );
}

function KV({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3 items-baseline">
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-[13px] text-foreground/90 min-w-0">{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 2. Prereq chain
// ═══════════════════════════════════════════════════════════════════
function PrereqChainBlock({
  intel,
  planByCode,
}: {
  intel: CourseIntel;
  planByCode: Map<string, Course>;
}) {
  const hasFormal = intel.prereqChains.length > 0;
  const hasRecommended = (intel.recommendedPrep?.length ?? 0) > 0;
  if (!hasFormal && !hasRecommended) {
    return (
      <p className="text-[12.5px] text-muted-foreground italic">
        No course prerequisites for this entry.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {hasFormal && (
        <div className="space-y-3.5">
          {intel.prereqChains.map((chain, i) => (
            <ChainRow
              key={i}
              chain={chain}
              focusedCode={intel.code}
              planByCode={planByCode}
            />
          ))}
        </div>
      )}
      {hasRecommended && (
        <RecommendedPrepRow
          codes={intel.recommendedPrep!}
          planByCode={planByCode}
        />
      )}
    </div>
  );
}

/** Helpful-but-not-required prep. Visually distinct from hard chains:
 *  dotted top border, subtle "Recommended preparation" label, and
 *  chips render without the directional arrow flow. */
function RecommendedPrepRow({
  codes,
  planByCode,
}: {
  codes: string[];
  planByCode: Map<string, Course>;
}) {
  return (
    <div className="pt-3 border-t border-dashed border-border">
      <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-2 inline-flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-amber-300" />
        Recommended preparation
        <span className="text-muted-foreground/60 normal-case tracking-normal text-[10.5px] font-normal ml-1">
          (helpful, not required to register)
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {codes.map((c) => {
          const status = resolvePrereqStatus(c, planByCode, false);
          return <ChainNode key={c} code={c} status={status} isFocused={false} />;
        })}
      </div>
    </div>
  );
}

function ChainRow({
  chain,
  focusedCode,
  planByCode,
}: {
  chain: PrereqChain;
  focusedCode: string;
  planByCode: Map<string, Course>;
}) {
  // Ensure focused code is the last node (visual landing point).
  const codes =
    chain.codes[chain.codes.length - 1] === focusedCode
      ? chain.codes
      : [...chain.codes, focusedCode];

  return (
    <div>
      {chain.label && (
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-2">
          {chain.label}
        </div>
      )}
      <div className="flex items-center gap-1.5 flex-wrap">
        {codes.map((c, idx) => {
          const isFocused = c === focusedCode;
          const status = resolvePrereqStatus(c, planByCode, isFocused);
          return (
            <div key={idx} className="flex items-center gap-1.5">
              <ChainNode code={c} status={status} isFocused={isFocused} />
              {idx < codes.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type PrereqStatus =
  | { kind: "satisfied"; label: string }
  | { kind: "transferred"; label: string }
  | { kind: "in_progress"; label: string }
  | { kind: "planned"; label: string }
  | { kind: "failed"; label: string }
  | { kind: "missing"; label: string }
  | { kind: "self"; label: string };

function resolvePrereqStatus(
  code: string,
  planByCode: Map<string, Course>,
  isFocused: boolean,
): PrereqStatus {
  if (isFocused) return { kind: "self", label: "This course" };
  if (isTransferred(code)) {
    return { kind: "transferred", label: "Satisfied (Transfer)" };
  }
  const row = planByCode.get(code);
  if (!row) return { kind: "missing", label: "Not Yet Satisfied" };
  switch (row.status) {
    case "passed":
      return { kind: "satisfied", label: "Satisfied" };
    case "in_progress":
      return { kind: "in_progress", label: "In Progress" };
    case "failed":
      return { kind: "failed", label: "Failed — Retake" };
    case "dropped":
      return { kind: "missing", label: "Dropped" };
    case "planned":
    default:
      return { kind: "planned", label: "Planned" };
  }
}

function ChainNode({
  code,
  status,
  isFocused,
}: {
  code: string;
  status: PrereqStatus;
  isFocused: boolean;
}) {
  const palette: Record<PrereqStatus["kind"], { dot: string; ring: string; label: string; chip: string }> = {
    satisfied:    { dot: "bg-emerald-400", ring: "ring-emerald-400/30",   label: "text-emerald-200",  chip: "border-emerald-400/40 bg-emerald-500/[0.10]" },
    transferred:  { dot: "bg-emerald-400", ring: "ring-emerald-400/30",   label: "text-emerald-200",  chip: "border-emerald-400/40 bg-emerald-500/[0.07]" },
    in_progress:  { dot: "bg-amber-400",   ring: "ring-amber-400/30",     label: "text-amber-200",    chip: "border-amber-400/40 bg-amber-500/[0.10]" },
    planned:      { dot: "bg-slate-400",   ring: "ring-slate-400/20",     label: "text-slate-300",    chip: "border-slate-400/30 bg-slate-500/[0.06]" },
    failed:       { dot: "bg-red-500",     ring: "ring-red-500/30",       label: "text-red-200",      chip: "border-red-400/40 bg-red-500/[0.10]" },
    missing:      { dot: "bg-red-500",     ring: "ring-red-500/30",       label: "text-red-300",      chip: "border-red-400/40 bg-red-500/[0.08]" },
    self:         { dot: "bg-primary",     ring: "ring-primary/40",       label: "text-foreground",   chip: "border-primary/50 bg-primary/[0.12]" },
  };
  const p = palette[status.kind];

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm border ${p.chip} ${
        isFocused ? "shadow-sm" : ""
      }`}
      title={status.label}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${p.dot} ring-2 ${p.ring}`}
      />
      <code className={`text-[11.5px] font-mono font-semibold ${p.label}`}>
        {code}
      </code>
      <span className="text-[10px] text-muted-foreground">·</span>
      <span className={`text-[10.5px] ${p.label}`}>{status.label}</span>
      {isTransferred(code) && (
        <span className="text-[9.5px] text-muted-foreground/80 italic">
          {(getTransferNote(code) ?? "").split("(")[1]?.replace(")", "") ?? ""}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 3. Unlocks (Downstream Impact)
// ═══════════════════════════════════════════════════════════════════
function UnlocksBlock({ intel }: { intel: CourseIntel }) {
  const hasUnlocks = intel.unlocks.length > 0;
  const hasPrep = (intel.recommendedPrepFor?.length ?? 0) > 0;

  if (!hasUnlocks && !hasPrep) {
    return (
      <p className="text-[12.5px] text-muted-foreground leading-relaxed">
        Nothing else in the major chain depends on this course directly. It still
        satisfies its declared requirement (
        <span className="text-foreground/85">{intel.geDesignation}</span>).
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {hasUnlocks && (
        <div>
          <p className="text-[12.5px] text-muted-foreground mb-3 leading-relaxed">
            Passing <code className="text-foreground/85 font-semibold">{intel.code}</code>{" "}
            unlocks:
          </p>
          <ul className="space-y-2">
            {intel.unlocks.map((u) => (
              <UnlockCard key={u.code} unlock={u} />
            ))}
          </ul>
        </div>
      )}

      {hasPrep && (
        <div className="pt-1 border-t border-dashed border-border">
          <p className="text-[12.5px] text-muted-foreground mb-3 mt-3 leading-relaxed inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-300" />
            Helpful preparation for these courses (not a registration unlock):
          </p>
          <ul className="space-y-2">
            {intel.recommendedPrepFor!.map((p) => (
              <PrepForCard key={p.code} item={p} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UnlockCard({ unlock }: { unlock: Unlock }) {
  const isCritical = unlock.flags?.includes("critical-path");
  const isOnceYearly = unlock.flags?.includes("once-per-year");
  const hasRemaining = (unlock.remainingPrereqs?.length ?? 0) > 0;
  // If this card has remaining prereqs, soften the visual: it's a
  // partial unlock, not a clean one. Use amber accent regardless.
  const accentBorder = hasRemaining
    ? "border-l-amber-400"
    : isCritical
      ? "border-l-red-500"
      : isOnceYearly
        ? "border-l-amber-400"
        : "border-l-border";

  return (
    <li
      className={`pl-3 pr-3 py-2.5 border-l-[3px] bg-card/40 ${accentBorder} hover:bg-card/70 transition-colors rounded-r-sm`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[12.5px] font-mono font-semibold text-foreground">
              {unlock.code}
            </code>
            <span className="text-[12.5px] text-foreground/80 truncate">
              {unlock.name}
            </span>
          </div>
          <div className="mt-1 text-[10.5px] text-muted-foreground">
            {unlock.category}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {hasRemaining && (
            <Pill className="bg-amber-500/[0.14] text-amber-200 border-amber-400/40">
              Partial unlock
            </Pill>
          )}
          {isOnceYearly && (
            <Pill className="bg-amber-500/[0.14] text-amber-200 border-amber-400/40">
              <Clock className="h-2.5 w-2.5 mr-1" />
              1×/yr
            </Pill>
          )}
          {isCritical && (
            <Pill className="bg-red-500/[0.14] text-red-200 border-red-400/40">
              <ShieldAlert className="h-2.5 w-2.5 mr-1" />
              Critical
            </Pill>
          )}
        </div>
      </div>

      {/* Remaining-prereqs row + free-text note: only render when present */}
      {hasRemaining && (
        <div className="mt-2 text-[11.5px] text-amber-200/90 leading-relaxed">
          <span className="text-muted-foreground">Still needs: </span>
          {unlock.remainingPrereqs!.map((c, i) => (
            <span key={c}>
              <code className="text-foreground/90 font-semibold">{c}</code>
              {i < unlock.remainingPrereqs!.length - 1 && (
                <span className="text-muted-foreground">, </span>
              )}
            </span>
          ))}
        </div>
      )}
      {unlock.note && (
        <p className="mt-1.5 text-[11.5px] text-muted-foreground italic leading-relaxed">
          {unlock.note}
        </p>
      )}
    </li>
  );
}

/** Card for a course this one only HELPS prepare for (no formal
 *  unlock relationship). Visually softer than UnlockCard — no left
 *  border accent, dashed look, "Helpful prep" pill. */
function PrepForCard({ item }: { item: RecommendedPrepFor }) {
  return (
    <li className="pl-3 pr-3 py-2.5 bg-card/30 border border-dashed border-border/70 rounded-sm hover:bg-card/60 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-[12.5px] font-mono font-semibold text-foreground/85">
              {item.code}
            </code>
            <span className="text-[12.5px] text-foreground/70 truncate">
              {item.name}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground italic leading-relaxed">
            {item.reason}
          </p>
        </div>
        <Pill className="bg-amber-500/[0.10] text-amber-200 border-amber-400/30 shrink-0">
          Helpful prep
        </Pill>
      </div>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 4. Swap strategy
// ═══════════════════════════════════════════════════════════════════
function SwapStrategyBlock({ intel }: { intel: CourseIntel }) {
  const riskColors: Record<RiskLevel, string> = {
    CRITICAL: "bg-red-500/[0.14] text-red-200 border-red-400/40",
    HIGH:     "bg-amber-500/[0.14] text-amber-200 border-amber-400/40",
    MEDIUM:   "bg-slate-500/[0.14] text-slate-200 border-slate-400/40",
    LOW:      "bg-emerald-500/[0.10] text-emerald-200 border-emerald-400/30",
  };

  return (
    <div className="space-y-4">
      {/* A — Impact assessment */}
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-2.5">
          Impact Assessment
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5">
            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-[12.5px] text-foreground/85 leading-relaxed">
              <span className="text-muted-foreground">Graduation impact: </span>
              <span className={intel.criticalPath ? "text-red-300 font-semibold" : "text-foreground/90"}>
                {intel.delaysGraduation}
              </span>
            </div>
          </div>
          {intel.blockedDownstream.length > 0 && (
            <div className="flex items-start gap-2.5">
              <X className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <div className="text-[12.5px] text-foreground/85 leading-relaxed">
                <span className="text-muted-foreground">Downstream blocked: </span>
                {intel.blockedDownstream.map((c, i) => (
                  <span key={c}>
                    <code className="text-foreground/90 font-semibold">{c}</code>
                    {i < intel.blockedDownstream.length - 1 && (
                      <span className="text-muted-foreground">, </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="pt-1">
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mr-2">
              Risk:
            </span>
            <Pill className={riskColors[intel.riskLevel]}>{intel.riskLevel}</Pill>
          </div>
        </div>
      </div>

      {/* B — Safe swap alternatives */}
      <div>
        <div className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold mb-2.5">
          Safe Swap Alternatives
        </div>
        {intel.safeSwap === null ? (
          <div className="border-l-[3px] border-red-500 bg-red-500/[0.06] py-3 pl-3.5 pr-3.5">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="h-3.5 w-3.5 text-red-300 mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-foreground/85 leading-relaxed">
                <span className="font-semibold text-red-200">No safe swap.</span>{" "}
                This course is on the critical path. Dropping delays graduation by 1
                semester minimum.
              </p>
            </div>
          </div>
        ) : (
          <div className="border-l-[3px] border-emerald-500 bg-emerald-500/[0.05] py-3 pl-3.5 pr-3.5">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-300 mt-0.5 shrink-0" />
              <p className="text-[12.5px] text-foreground/85 leading-relaxed">
                {intel.safeSwap}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 5. Workload
// ═══════════════════════════════════════════════════════════════════
function WorkloadBlock({ intel }: { intel: CourseIntel }) {
  const wlColors: Record<Workload, { bar: number; text: string; label: string }> = {
    "Low":          { bar: 1, text: "text-emerald-200", label: "Low" },
    "Low-Medium":   { bar: 2, text: "text-emerald-200", label: "Low–Medium" },
    "Medium":       { bar: 3, text: "text-amber-200",   label: "Medium" },
    "Medium-Heavy": { bar: 4, text: "text-amber-200",   label: "Medium–Heavy" },
    "Heavy":        { bar: 5, text: "text-red-300",     label: "Heavy" },
    "Brutal":       { bar: 6, text: "text-red-300",     label: "Brutal" },
  };
  const wl = wlColors[intel.workload];

  const alignmentCls: Record<StrengthAlignment, string> = {
    Strong:   "bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40",
    Moderate: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40",
    Weak:     "bg-red-500/[0.14] text-red-200 border-red-400/40",
  };

  return (
    <div className="space-y-4">
      {/* Workload bar */}
      <div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
            Weekly Workload
          </span>
          <span className={`text-[12.5px] font-bold ${wl.text}`}>{wl.label}</span>
        </div>
        <div className="flex h-1.5 w-full gap-0.5">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className={`flex-1 rounded-sm ${
                n <= wl.bar
                  ? n <= 2
                    ? "bg-emerald-400/80"
                    : n <= 4
                      ? "bg-amber-400/80"
                      : "bg-red-400/80"
                  : "bg-zinc-700/60"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Leans on */}
      <div>
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          Leans on:{" "}
        </span>
        <span className="text-[12.5px] text-foreground/85">
          {intel.leansOn.join(" · ")}
        </span>
      </div>

      {/* Strength alignment */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">
          Ali's strength alignment:
        </span>
        <Pill className={alignmentCls[intel.strengthAlignment]}>
          {intel.strengthAlignment}
        </Pill>
      </div>

      {/* Pairing intel */}
      <div className="space-y-1.5 pt-1">
        {intel.pairsWell.length > 0 && (
          <div className="flex items-start gap-2 text-[12px]">
            <Check className="h-3.5 w-3.5 text-emerald-300 mt-0.5 shrink-0" />
            <span>
              <span className="text-muted-foreground">Pairs well with: </span>
              {intel.pairsWell.map((c, i) => (
                <span key={c}>
                  <code className="text-foreground/90 font-semibold">{c}</code>
                  {i < intel.pairsWell.length - 1 && (
                    <span className="text-muted-foreground">, </span>
                  )}
                </span>
              ))}
            </span>
          </div>
        )}
        {intel.doNotPairWith.length > 0 && (
          <div className="flex items-start gap-2 text-[12px]">
            <X className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
            <span>
              <span className="text-muted-foreground">Do NOT pair with: </span>
              {intel.doNotPairWith.map((c, i) => (
                <span key={c}>
                  <code className="text-foreground/90 font-semibold">{c}</code>
                  {i < intel.doNotPairWith.length - 1 && (
                    <span className="text-muted-foreground">, </span>
                  )}
                </span>
              ))}
            </span>
          </div>
        )}
        {intel.pairingNote && (
          <p className="text-[11.5px] text-muted-foreground italic leading-relaxed pt-1">
            {intel.pairingNote}
          </p>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 6. Registration intelligence
// ═══════════════════════════════════════════════════════════════════
function RegistrationBlock({
  intel,
  planByCode,
}: {
  intel: CourseIntel;
  planByCode: Map<string, Course>;
}) {
  // Auto-generate one row per required prereq
  const prereqFlags: RegFlag[] = intel.prereqsRequired.map((code) => {
    if (isTransferred(code)) {
      return {
        kind: "ok",
        text: `Prerequisite satisfied: ${code} (Transfer)`,
      };
    }
    const row = planByCode.get(code);
    if (row?.status === "passed") {
      return { kind: "ok", text: `Prerequisite satisfied: ${code}` };
    }
    if (row?.status === "in_progress") {
      return {
        kind: "warn",
        text: `Prerequisite in progress: ${code} — must pass first`,
      };
    }
    if (row?.status === "failed") {
      return {
        kind: "fail",
        text: `Prerequisite FAILED: ${code} — retake required`,
      };
    }
    return { kind: "fail", text: `Prerequisite needed: ${code}` };
  });

  // Standing
  const standingFlag: RegFlag | null = intel.standingRequirement
    ? { kind: "ok", text: `${intel.standingRequirement} — assumed satisfied` }
    : null;

  // Min grade
  const gradeFlag: RegFlag = {
    kind: intel.minGrade.severity === "strict" ? "warn" : "ok",
    text: `Grade minimum: ${intel.minGrade.value} or better required`,
  };

  // Offering
  const offeringFlag: RegFlag = (() => {
    if (intel.offered === "Fall only") {
      return {
        kind: "warn",
        text: "Fall only — missing this term = 1 year delay",
      };
    }
    if (intel.offered === "Spring only") {
      return {
        kind: "warn",
        text: "Spring only — missing this term = 1 year delay",
      };
    }
    if (intel.offered === "Variable — check advisor") {
      return {
        kind: "warn",
        text: "Variable offering — confirm with advisor before registering",
      };
    }
    return { kind: "ok", text: `Offered: ${intel.offered}` };
  })();

  const flags: RegFlag[] = [
    ...prereqFlags,
    ...(standingFlag ? [standingFlag] : []),
    gradeFlag,
    offeringFlag,
    ...(intel.extraRegFlags ?? []),
  ];

  return (
    <ul className="space-y-2">
      {flags.map((f, i) => (
        <FlagRow key={i} flag={f} />
      ))}
    </ul>
  );
}

function FlagRow({ flag }: { flag: RegFlag }) {
  const map = {
    ok:   { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />, text: "text-foreground/85" },
    warn: { icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />,  text: "text-foreground/85" },
    fail: { icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,           text: "text-red-200" },
  };
  const m = map[flag.kind];
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{m.icon}</span>
      <span className={`text-[12.5px] leading-relaxed ${m.text}`}>{flag.text}</span>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 7. Advisor note
// ═══════════════════════════════════════════════════════════════════
function AdvisorNoteBlock({ intel }: { intel: CourseIntel }) {
  if (!intel.advisorNote) {
    return (
      <p className="text-[12px] text-muted-foreground/70 italic leading-relaxed">
        No special advisor flags for this course.
      </p>
    );
  }
  return (
    <div className="border-l-[3px] border-amber-400 bg-amber-500/[0.06] py-3 pl-3.5 pr-3.5">
      <p className="text-[12.5px] leading-relaxed text-foreground/85">
        {intel.advisorNote}
      </p>
    </div>
  );
}

// ─── Atoms shared with main component ──────────────────────────────
function Pill({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10.5px] font-semibold tracking-wide whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

const STATUS_CHIPS: Record<CourseStatus, { label: string; cls: string }> = {
  passed:      { label: "Passed",      cls: "bg-emerald-500/[0.14] text-emerald-200 border-emerald-400/40" },
  in_progress: { label: "In Progress", cls: "bg-amber-500/[0.14] text-amber-200 border-amber-400/40" },
  failed:      { label: "Failed",      cls: "bg-red-500/[0.14] text-red-200 border-red-400/40" },
  dropped:     { label: "Dropped / W", cls: "bg-orange-500/[0.12] text-orange-200 border-orange-400/40" },
  planned:     { label: "Planned",     cls: "bg-slate-500/[0.12] text-slate-300 border-slate-400/30" },
};
