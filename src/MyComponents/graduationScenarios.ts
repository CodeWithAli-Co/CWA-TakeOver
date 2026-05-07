/**
 * graduationScenarios.ts — What-if planning data for the Risk Term and
 * Buffer tabs of the Graduation Plan.
 *
 * Both tabs are READ-ONLY. They never mutate the DB. Their purpose is
 * to model alternate timelines:
 *
 *   · RISK_TERM_PLAN — hardcoded Fall 2027 target ("graduate one
 *     semester earlier") that aggressively offloads GE + math to
 *     West Valley / Mission community college over the summers.
 *
 *   · computeBufferPlan() — derives a delayed-but-safe timeline from
 *     the live plan whenever courses are marked failed or dropped.
 *     Cascades the affected critical-path chain forward and suggests
 *     CC retake options where applicable.
 */

import { Course, CourseStatus } from "./GraduationPlan.queries";
import { CRITICAL_PATH_CODES } from "./graduationCourseData";

// ─── Shared types ──────────────────────────────────────────────────
export type Source =
  | "SJSU"
  | "Mission CC"
  | "West Valley CC"
  | "CC (either)" // when both colleges have a clean equivalent
  | "SJSU online"
  | "Substitute";

export interface ScenarioCourse {
  code: string;
  /** SJSU code if at CC; CC equivalent shown in `ccEquivalent`. */
  name: string;
  units: number;
  category: string;
  source: Source;
  /** e.g. "Mission MAT 4B" or "WV HIST 17A". Optional — only when source is CC. */
  ccEquivalent?: string;
  /** Status semantics for the read-only view: "planned" | "in_progress" | "complete" | "critical-add". */
  status: "planned" | "in_progress" | "complete" | "critical-add";
  critical?: boolean;
  /** One-line note shown beneath the course (e.g. "Added — see precondition"). */
  note?: string;
}

export interface ScenarioTerm {
  id: string;
  label: string;
  /** Free-text framing — the strategic role this term plays. */
  tag?: string;
  /** Pinned right-side caption — e.g. "13 units · 4 at CC". */
  caption?: string;
  /** When true, draw the term in red — high-risk windows. */
  highRisk?: boolean;
  /** When true, draw the term in emerald — graduation. */
  isTarget?: boolean;
  courses: ScenarioCourse[];
}

export interface ScenarioPlan {
  /** Top-of-tab title. */
  title: string;
  /** One-line subtitle. */
  subtitle: string;
  /** Banner shown immediately under the title. Used for honest
   *  caveats like the LING 115 add deadline. */
  precondition?: {
    kind: "warning" | "info" | "danger";
    headline: string;
    body: string;
  };
  /** Bullet-style highlights about the plan — risk callouts,
   *  cost savings, etc. */
  highlights: { icon?: "alert" | "ok" | "info"; text: string }[];
  /** The actual timeline. */
  terms: ScenarioTerm[];
  /** Total CC units in the plan, used for header stats. */
  ccUnits: number;
  /** Estimated CC tuition savings note (display only). */
  costNote?: string;
}

// ═══════════════════════════════════════════════════════════════════
// RISK TERM — Fall 2027 graduation, aggressive CC offloading
// ═══════════════════════════════════════════════════════════════════

/** Mission College and West Valley College course equivalencies for
 *  the courses Ali wants to offload. Source: assist.org articulations
 *  for SJSU undergraduate transfer credit. Verify before enrolling.
 */
const CC_EQUIVALENTS: Record<string, { mission?: string; westValley?: string; both?: boolean }> = {
  "MATH 31":   { mission: "Mission MAT 4B",   westValley: "WV MATH 4B",   both: true  },
  "MATH 161A": { mission: "Mission MAT 10C",  westValley: "WV MATH 12",   both: false /* verify articulation per major */ },
  "HIST 15":   { westValley: "WV HIST 17A or HIST 17B", mission: "Mission HIS 17A or 17B", both: true },
  "AAS 1":     { westValley: "WV AAS 5",      mission: "Mission ETS 1A or 1B", both: true },
  "ANTH 160":  { westValley: "WV ANTH 1",     mission: "Mission ANT 101",  both: true },
};

/** Pretty-print the CC equivalent line. */
export function ccEquivalentLine(code: string): string | undefined {
  const eq = CC_EQUIVALENTS[code];
  if (!eq) return undefined;
  const parts: string[] = [];
  if (eq.mission)     parts.push(eq.mission);
  if (eq.westValley)  parts.push(eq.westValley);
  return parts.join(" · ");
}

export const RISK_TERM_PLAN: ScenarioPlan = {
  title: "Risk Term — Fall 2027 Graduation",
  subtitle: "One semester earlier than Standard. CC-offloaded summers + heavy SJSU terms.",
  precondition: {
    kind: "danger",
    headline: "Precondition: LING 115 must be added to Spring 2026",
    body:
      "LING 165 (capstone) is Spring-only and gated by LING 115, also Spring-only. To graduate Fall 2027, LING 115 had to be added to Spring 2026 — Ali's current term. If add/drop has closed, this plan is no longer reachable; switch to the Standard tab (Spring 2028) for the realistic fastest path.",
  },
  highlights: [
    { icon: "alert", text: "Spring 2026 stack: 18 units (added LING 115). Already brutal alongside MATH 42 + LLD 100W." },
    { icon: "alert", text: "Final term Fall 2027 stacks BOTH Fall-only critical courses — CS 171 and LING 124. Single failure delays graduation by a year." },
    { icon: "ok",    text: "5 CC offloads over Summer 2026 + Summer 2027 free 3 SJSU semesters from GE/math noise." },
    { icon: "ok",    text: "Two winter sessions (Jan 2027 + Jan 2028) absorb LING 122 and CS 157A — flattening the Spring 2027 and Fall 2027 loads." },
    { icon: "info",  text: "CC tuition is ~$46/unit (CA resident). Estimated savings vs. SJSU rate: ~$2,400 across the plan." },
  ],
  terms: [
    {
      id: "sp26",
      label: "Spring 2026",
      tag: "Current — Aggressive Add",
      caption: "18 units · all SJSU",
      highRisk: true,
      courses: [
        { code: "BUS3 186", name: "Prof & Bus Ethics",          units: 3, category: "GE: UD Area 4",         source: "SJSU", status: "in_progress" },
        { code: "CS 22B",   name: "Python Data Analysis",       units: 3, category: "Major Elective",        source: "SJSU", status: "in_progress" },
        { code: "LLD 100W", name: "Writing Workshop",           units: 3, category: "WID Requirement",       source: "SJSU", status: "in_progress" },
        { code: "MATH 42",  name: "Discrete Math",              units: 3, category: "Major Prep — CRITICAL", source: "SJSU", status: "in_progress", critical: true },
        { code: "PHIL 134", name: "Computers, Ethics, Society", units: 3, category: "GE: UD Area 3",         source: "SJSU", status: "in_progress" },
        { code: "LING 115", name: "Corpus Linguistics",         units: 3, category: "LING Core — CRITICAL ADD", source: "SJSU", status: "critical-add", critical: true,
          note: "Required addition to make LING 165 reachable Spring 2027. Spring-only course." },
      ],
    },
    {
      id: "su26",
      label: "Summer 2026",
      tag: "CC Heavy — Math + GE",
      caption: "13 units · all CC",
      highRisk: true,
      courses: [
        { code: "MATH 31",  name: "Calculus II",                  units: 4, category: "Major Prep — CRITICAL", source: "CC (either)", ccEquivalent: ccEquivalentLine("MATH 31"),  status: "planned", critical: true,
          note: "D/F/NC retake — CC pace + smaller class. Take ALONE-of-math at SJSU level." },
        { code: "MATH 161A", name: "Applied Prob & Statistics I", units: 3, category: "Major Prep",           source: "Mission CC", ccEquivalent: ccEquivalentLine("MATH 161A"), status: "planned",
          note: "Verify articulation on assist.org — some CSU programs require MATH 161A specifically." },
        { code: "HIST 15",  name: "Essentials of U.S. History",   units: 3, category: "AI: US1",              source: "CC (either)", ccEquivalent: ccEquivalentLine("HIST 15"),  status: "planned" },
        { code: "AAS 1",    name: "Intro Asian American Studies", units: 3, category: "GE: Area 6",           source: "CC (either)", ccEquivalent: ccEquivalentLine("AAS 1"),    status: "planned" },
      ],
    },
    {
      id: "fa26",
      label: "Fall 2026",
      tag: "SJSU Core Block",
      caption: "15 units · all SJSU",
      courses: [
        { code: "CS 146",  name: "Data Structures & Algorithms",     units: 3, category: "CS Core Gateway",      source: "SJSU", status: "planned", critical: true },
        { code: "CS 154",  name: "Formal Languages & Computability", units: 3, category: "CS Core",              source: "SJSU", status: "planned" },
        { code: "MATH 39", name: "Linear Algebra I",                 units: 3, category: "Major Prep",            source: "SJSU", status: "planned" },
        { code: "LING 111", name: "Linguistic Phonetics",            units: 3, category: "LING Core",             source: "SJSU", status: "planned" },
        { code: "LING 112", name: "Intro to Syntax",                 units: 3, category: "LING Core",             source: "SJSU", status: "planned",
          note: "Pulled forward from Spring 2027 to clear Spring 2027 for capstone." },
      ],
    },
    {
      id: "wi2627",
      label: "Winter 2026/27",
      tag: "Winter Session — Jan 2027 (3 weeks)",
      caption: "3 units · CC or SJSU online",
      courses: [
        { code: "LING 122", name: "English as a World Language", units: 3, category: "LING UD Elective", source: "SJSU online", status: "planned",
          note: "3-week SJSU winter session — reading + analysis. Pulled forward from Summer 2027 to flatten the load there." },
      ],
    },
    {
      id: "sp27",
      label: "Spring 2027",
      tag: "Capstone Early",
      caption: "12 units · all SJSU",
      courses: [
        { code: "LING 165", name: "Intro to Natural Language Processing", units: 3, category: "LING Core — CAPSTONE", source: "SJSU", status: "planned", critical: true,
          note: "Taken one year early — only viable if LING 115 was passed Spring 2026." },
        { code: "CS 156",  name: "Intro to Artificial Intelligence", units: 3, category: "CS Core",      source: "SJSU", status: "planned" },
        { code: "LING 113", name: "Intro to Phonology",               units: 3, category: "LING UD",      source: "SJSU", status: "planned" },
        { code: "CS 133",   name: "Data Visualization",               units: 3, category: "CS Elective",  source: "SJSU", status: "planned" },
      ],
    },
    {
      id: "su27",
      label: "Summer 2027",
      tag: "Final CC Push",
      caption: "3 units · all CC",
      courses: [
        { code: "ANTH 160", name: "Mysteries of Ancient Civilizations", units: 3, category: "GE: UD Area 2/5", source: "CC (either)", ccEquivalent: ccEquivalentLine("ANTH 160"), status: "planned" },
      ],
    },
    {
      id: "wi2728",
      label: "Winter 2027/28",
      tag: "Winter Session — Jan 2028 (3 weeks)",
      caption: "3 units · SJSU online",
      courses: [
        { code: "CS 157A", name: "Intro to Database Mgmt Systems", units: 3, category: "CS UD Elective", source: "SJSU online", status: "planned",
          note: "Pulled out of Fall 2027 to lighten the double-critical final term — verify SJSU winter offering." },
      ],
    },
    {
      id: "fa27",
      label: "Fall 2027",
      tag: "Target Graduation — Double Critical",
      caption: "6 units · all SJSU · GRADUATION",
      isTarget: true,
      highRisk: true,
      courses: [
        { code: "CS 171",   name: "Intro to Machine Learning",     units: 3, category: "CS Core",        source: "SJSU", status: "planned", critical: true,
          note: "Fall-only. Single failure pushes graduation by a year." },
        { code: "LING 124", name: "Intro to Speech Technology",    units: 3, category: "LING Core",      source: "SJSU", status: "planned", critical: true,
          note: "Fall-only. Required by LING 111 (Fall 2026) for chain integrity." },
      ],
    },
  ],
  ccUnits: 4 + 3 + 3 + 3 + 3, // MATH 31 + MATH 161A + HIST 15 + AAS 1 + ANTH 160
  costNote:
    "CC tuition (~$46/unit CA resident) × 16 CC units = ~$740. SJSU rate at ~$200/unit (full-time) saves ~$2,400 across the plan.",
};

// ═══════════════════════════════════════════════════════════════════
// BUFFER — auto-computed from failed courses in the live plan
// ═══════════════════════════════════════════════════════════════════

export type BufferStatus =
  | { kind: "no_failures" }
  | { kind: "buffered"; cascade: BufferCascade };

export interface BufferCascade {
  /** Failed/dropped courses from the live plan. */
  failures: { code: string; name: string; status: CourseStatus; termId: string; critical: boolean }[];
  /** Number of semesters added to the original target. */
  delaySemesters: number;
  /** New estimated graduation term, e.g. "Fall 2028". */
  newTarget: string;
  /** Per-failure remediation strategy. */
  remediations: BufferRemediation[];
  /** Macro-level recovery notes shown at the top of the tab. */
  globalNotes: string[];
}

export interface BufferRemediation {
  failedCode: string;
  /** Where to retake — CC or SJSU. */
  retakeAt: "Mission CC" | "West Valley CC" | "CC (either)" | "SJSU";
  retakeTerm: string; // e.g. "Summer 2026"
  reason: string;
  /** Codes that were blocked downstream and need to be re-slotted. */
  blockedCodes: string[];
  /** Risk level of the cascade. */
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** SJSU course → recommended CC retake equivalent for buffer plans.
 *  Math courses are the obvious wins; CS gateways stay at SJSU
 *  because the major requires the SJSU course directly. */
const RETAKE_RECOMMENDATIONS: Record<string, BufferRemediation["retakeAt"]> = {
  "MATH 30":   "CC (either)",
  "MATH 31":   "CC (either)",
  "MATH 39":   "CC (either)",
  "MATH 161A": "Mission CC",
  "MATH 42":   "SJSU", // SJSU equivalent often required
  "HIST 15":   "CC (either)",
  "AAS 1":     "CC (either)",
  "ANTH 160":  "CC (either)",
  // CS gateways stay at SJSU
  "CS 146":  "SJSU",
  "CS 154":  "SJSU",
  "CS 156":  "SJSU",
  "CS 171":  "SJSU",
  // LING courses must be SJSU
  "LING 111": "SJSU",
  "LING 115": "SJSU",
  "LING 124": "SJSU",
  "LING 165": "SJSU",
};

/** Given the live plan, compute the buffered timeline. */
export function computeBufferPlan(courses: Course[]): BufferStatus {
  const failures = courses
    .filter((c) => c.status === "failed" || c.status === "dropped")
    .map((c) => ({
      code: c.code,
      name: c.name,
      status: c.status,
      termId: c.term_id,
      critical: c.critical || CRITICAL_PATH_CODES.has(c.code),
    }));

  if (failures.length === 0) {
    return { kind: "no_failures" };
  }

  // Cascade math: each critical failure adds at least 1 semester of
  // delay. Non-critical failures only delay if no slot exists for the
  // retake without reordering — assume ≤ 0.5 semester (rounded up if
  // crossed with another fail).
  const criticalFails = failures.filter((f) => f.critical).length;
  const nonCriticalFails = failures.length - criticalFails;
  const delaySemesters =
    criticalFails + Math.ceil(nonCriticalFails / 2);

  // Project new target — the standard plan ends Spring 2028.
  const newTarget = projectTargetTerm("Spring 2028", delaySemesters);

  // Per-failure remediation
  const remediations: BufferRemediation[] = failures.map((f) => {
    const retakeAt = RETAKE_RECOMMENDATIONS[f.code] ?? "SJSU";
    const retakeTerm = nextRetakeTerm(f.termId, f.critical);
    const blockedCodes = downstreamFor(f.code);
    return {
      failedCode: f.code,
      retakeAt,
      retakeTerm,
      reason: buildReason(f.code, f.critical, retakeAt),
      blockedCodes,
      severity: f.critical ? "CRITICAL" : blockedCodes.length > 0 ? "HIGH" : "MEDIUM",
    };
  });

  const globalNotes: string[] = [];
  if (criticalFails > 0) {
    globalNotes.push(
      `${criticalFails} critical-path failure${criticalFails > 1 ? "s" : ""} detected — graduation pushed by ≥${criticalFails} semester${criticalFails > 1 ? "s" : ""}.`,
    );
  }
  if (nonCriticalFails > 0) {
    globalNotes.push(
      `${nonCriticalFails} non-critical failure${nonCriticalFails > 1 ? "s" : ""} — typically absorbable in summer or by re-slotting an elective.`,
    );
  }
  if (failures.some((f) => f.code.startsWith("MATH"))) {
    globalNotes.push(
      "Math failures are the easiest to recover via CC retake — Mission/West Valley both have transfer-clean equivalents.",
    );
  }

  return {
    kind: "buffered",
    cascade: {
      failures,
      delaySemesters,
      newTarget,
      remediations,
      globalNotes,
    },
  };
}

/** Map a SJSU term label and a delay count to a new term label. */
function projectTargetTerm(originalTerm: string, addSemesters: number): string {
  const seasons = ["Spring", "Summer", "Fall"]; // Summer counted as half — but for buffer purposes we use full term granularity for clarity
  const match = originalTerm.match(/(Spring|Summer|Fall)\s+(\d{4})/);
  if (!match) return originalTerm;
  const seasonIdx = seasons.indexOf(match[1]);
  let year = parseInt(match[2], 10);
  let idx = seasonIdx;
  // Treat each "semester" of delay as one Spring/Fall step; Summer
  // is bonus catch-up territory and not counted as a delay step.
  for (let i = 0; i < addSemesters; i++) {
    if (idx === 0) idx = 2;          // Spring → Fall same year
    else if (idx === 2) { idx = 0; year += 1; } // Fall → Spring next year
  }
  return `${seasons[idx]} ${year}`;
}

/** Suggest a retake term given the term where the failure happened. */
function nextRetakeTerm(failedTermId: string, critical: boolean): string {
  // termId format: 'sp26', 'su26', 'fa26', etc.
  const seasonAbbrevs = { sp: "Spring", su: "Summer", fa: "Fall" } as const;
  const abbrev = failedTermId.slice(0, 2) as keyof typeof seasonAbbrevs;
  const yy = parseInt(failedTermId.slice(2), 10);
  const year = 2000 + yy;
  // For critical failures, recommend the immediate next term.
  if (abbrev === "sp") return `Summer ${year}`;
  if (abbrev === "su") return critical ? `Fall ${year}` : `Spring ${year + 1}`;
  return `Spring ${year + 1}`;
}

/** Quick lookup of which downstream codes are blocked when a course
 *  fails. Mirrors the static intel registry's blockedDownstream. */
function downstreamFor(code: string): string[] {
  const map: Record<string, string[]> = {
    "MATH 42":  ["CS 146", "CS 154"],
    "MATH 31":  ["MATH 161A"],
    "MATH 30":  ["MATH 31", "MATH 39", "MATH 42"],
    "CS 146":   ["CS 156", "CS 171", "CS 157A", "CS 133"],
    "CS 154":   ["CS 153"],
    "CS 156":   [],
    "CS 171":   [],
    "LING 111": ["LING 124"],
    "LING 115": ["LING 165"],
    "LING 124": [],
    "LING 165": [],
  };
  return map[code] ?? [];
}

function buildReason(_code: string, critical: boolean, retakeAt: BufferRemediation["retakeAt"]): string {
  if (critical && retakeAt === "SJSU") {
    return `Critical-path course — must retake at SJSU to satisfy major. Schedule for the next available offering.`;
  }
  if (critical) {
    return `Critical-path course. CC retake is faster + cheaper, but verify articulation on assist.org before enrolling.`;
  }
  if (retakeAt !== "SJSU") {
    return `Non-critical — CC retake works well. Saves a SJSU slot for chain courses.`;
  }
  return `Re-slot to a future SJSU term. No CC equivalent strong enough for this major requirement.`;
}
