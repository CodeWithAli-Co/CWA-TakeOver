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
// RISK TERM — Two paces (Heavy / Locked In)
//
// Spring 2026 is LOCKED — the term ends in days and add/drop has long
// since closed. Both paces preserve Ali's currently enrolled 5 courses
// unchanged. They differ only in how aggressively they compress the
// remaining terms.
//
//   · heavy    — Fall 2027 grad (−1 semester). Heavy CC summer +
//                2 winter sessions. Requires advisor approval to
//                substitute LING 165 with an alternative LING
//                capstone (e.g. LING 174). The Spring-only
//                LING 115 → LING 165 chain otherwise blocks any
//                Fall 2027 finish.
//
//   · locked   — Summer 2027 grad (−2 semesters). Theoretical floor.
//                Requires THREE advisor-approved substitutions —
//                LING 165, LING 124, and CS 171 — because the
//                remaining time doesn't include another Fall term
//                where those Fall-only / Spring-only critical
//                courses can run. This pace exists to show the
//                absolute structural limit, not as a recommendation.
// ═══════════════════════════════════════════════════════════════════

export type RiskPace = "heavy" | "locked";

export interface RiskPaceMeta {
  id: RiskPace;
  label: string;
  /** Single-line subtitle for the dropdown. */
  tagline: string;
  /** Estimated graduation term — used in the dropdown badge. */
  target: string;
  /** Approximate semesters trimmed vs. the Standard plan. */
  trimmed: number; // 0 = same date, 1 = one term earlier, etc.
  /** Risk level for the badge. */
  intensity: "Heavy" | "Extreme";
}

export const RISK_PACES: RiskPaceMeta[] = [
  {
    id: "heavy",
    label: "Heavy Lock-In",
    tagline: "Fall 2027 · CC summer + winter sessions + LING 165 substitution",
    target: "Fall 2027",
    trimmed: 1,
    intensity: "Heavy",
  },
  {
    id: "locked",
    label: "Maximum Lock-In",
    tagline: "Summer 2027 · structural floor — 3 substitutions + dean approval",
    target: "Summer 2027",
    trimmed: 2,
    intensity: "Extreme",
  },
];

// ─── Shared Spring 2026 (locked across all paces) ──────────────────
const LOCKED_SPRING_2026: ScenarioTerm = {
  id: "sp26",
  label: "Spring 2026",
  tag: "Current — Locked (term ends in days)",
  caption: "15 units · all SJSU · in progress",
  courses: [
    { code: "BUS3 186", name: "Prof & Bus Ethics",          units: 3, category: "GE: UD Area 4",         source: "SJSU", status: "in_progress" },
    { code: "CS 22B",   name: "Python Data Analysis",       units: 3, category: "Major Elective",        source: "SJSU", status: "in_progress" },
    { code: "LLD 100W", name: "Writing Workshop",           units: 3, category: "WID Requirement",       source: "SJSU", status: "in_progress" },
    { code: "MATH 42",  name: "Discrete Math",              units: 3, category: "Major Prep — CRITICAL", source: "SJSU", status: "in_progress", critical: true },
    { code: "PHIL 134", name: "Computers, Ethics, Society", units: 3, category: "GE: UD Area 3",         source: "SJSU", status: "in_progress" },
  ],
};


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

// ─── Pace 1: Heavy Lock-In — Fall 2027 (−1 semester) ──────────────
const HEAVY_PLAN: ScenarioPlan = {
  title: "Heavy Lock-In — Fall 2027 Graduation",
  subtitle:
    "One semester earlier than Standard. CC-offloaded summer, 2 winter sessions, and a LING 165 capstone substitution.",
  precondition: {
    kind: "danger",
    headline: "Requires advisor approval — LING 165 capstone substitution",
    body:
      "LING 115 → LING 165 is a Spring-only chain that otherwise locks the earliest graduation to Spring 2028. To finish Fall 2027 you must substitute LING 165 with another LING capstone the department will accept (e.g. LING 174 Computational Linguistics, LING 181 Sociolinguistics, or a faculty-supervised independent study). Get written advisor + chair approval before Spring 2027 registration. If approval is denied this collapses back to Spring 2028 — same as the Standard plan.",
  },
  highlights: [
    { icon: "alert", text: "Substitute course must be approved BEFORE Spring 2027 registration. Late approval = Standard timeline applies." },
    { icon: "alert", text: "Fall 2027 final term carries 9 units (CS 171 + LING 124 + LING substitute) — the most loaded final term in any pace." },
    { icon: "ok",    text: "Trimmed by 1 full semester. Frees Spring 2028 entirely for work, internship, or grad school applications." },
    { icon: "ok",    text: "5 CC offloads + 2 winter sessions = ~$3,500 saved vs. SJSU tuition for the same units." },
  ],
  terms: [
    LOCKED_SPRING_2026,
    {
      id: "su26",
      label: "Summer 2026",
      tag: "CC Heavy — Math + GE",
      caption: "13 units · all CC",
      highRisk: true,
      courses: [
        { code: "MATH 31",   name: "Calculus II",                  units: 4, category: "Major Prep — CRITICAL", source: "CC (either)", ccEquivalent: ccEquivalentLine("MATH 31"),   status: "planned", critical: true,
          note: "D/F/NC retake — CC pace + smaller class. Take alongside light GE only." },
        { code: "MATH 161A", name: "Applied Prob & Statistics I",  units: 3, category: "Major Prep",            source: "Mission CC",  ccEquivalent: ccEquivalentLine("MATH 161A"), status: "planned",
          note: "Verify articulation on assist.org." },
        { code: "HIST 15",   name: "Essentials of U.S. History",   units: 3, category: "AI: US1",               source: "CC (either)", ccEquivalent: ccEquivalentLine("HIST 15"),   status: "planned" },
        { code: "AAS 1",     name: "Intro Asian American Studies", units: 3, category: "GE: Area 6",            source: "CC (either)", ccEquivalent: ccEquivalentLine("AAS 1"),     status: "planned" },
      ],
    },
    {
      id: "fa26",
      label: "Fall 2026",
      tag: "SJSU Core Block",
      caption: "15 units · all SJSU",
      courses: [
        { code: "CS 146",   name: "Data Structures & Algorithms",     units: 3, category: "CS Core Gateway", source: "SJSU", status: "planned", critical: true },
        { code: "CS 154",   name: "Formal Languages & Computability", units: 3, category: "CS Core",         source: "SJSU", status: "planned" },
        { code: "MATH 39",  name: "Linear Algebra I",                 units: 3, category: "Major Prep",      source: "SJSU", status: "planned" },
        { code: "LING 111", name: "Linguistic Phonetics",             units: 3, category: "LING Core",       source: "SJSU", status: "planned", critical: true },
        { code: "LING 112", name: "Intro to Syntax",                  units: 3, category: "LING Core",       source: "SJSU", status: "planned" },
      ],
    },
    {
      id: "wi2627",
      label: "Winter 2026/27",
      tag: "Winter Session — Jan 2027 (3 weeks)",
      caption: "3 units · SJSU online",
      courses: [
        { code: "LING 113", name: "Intro to Phonology", units: 3, category: "LING UD", source: "SJSU online", status: "planned" },
      ],
    },
    {
      id: "sp27",
      label: "Spring 2027",
      tag: "Closeout",
      caption: "12 units · all SJSU",
      courses: [
        { code: "CS 156",   name: "Intro to Artificial Intelligence", units: 3, category: "CS Core",     source: "SJSU", status: "planned" },
        { code: "LING 115", name: "Corpus Linguistics",               units: 3, category: "LING Core — TIME-SENSITIVE", source: "SJSU", status: "planned", critical: true,
          note: "Take this even though LING 165 will be substituted — LING 115 is still its own LING Core requirement." },
        { code: "CS 133",   name: "Data Visualization",               units: 3, category: "CS Elective", source: "SJSU", status: "planned" },
        { code: "LING 122", name: "English as a World Language",      units: 3, category: "LING UD",     source: "SJSU", status: "planned" },
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
          note: "Verify SJSU winter offering — DB courses don't always run." },
      ],
    },
    {
      id: "fa27",
      label: "Fall 2027",
      tag: "Target Graduation — Triple Stack",
      caption: "9 units · GRADUATION",
      isTarget: true,
      highRisk: true,
      courses: [
        { code: "CS 171",   name: "Intro to Machine Learning",  units: 3, category: "CS Core", source: "SJSU", status: "planned", critical: true,
          note: "Fall-only. Single failure forces an extra semester since the LING substitute also lands here." },
        { code: "LING 124", name: "Intro to Speech Technology", units: 3, category: "LING Core", source: "SJSU", status: "planned", critical: true },
        { code: "LING 174", name: "Capstone Substitute (advisor-approved)", units: 3, category: "LING Capstone — SUBSTITUTE", source: "Substitute", status: "critical-add", critical: true,
          note: "Stand-in for LING 165. Must be approved by department before Spring 2027 registration." },
      ],
    },
  ],
  ccUnits: 4 + 3 + 3 + 3 + 3, // MATH 31 + MATH 161A + HIST 15 + AAS 1 + ANTH 160
  costNote: "CC tuition × 16 units ≈ $740. SJSU savings ~$3,500 across the plan.",
};

// ─── Pace 2: Maximum Lock-In — Summer 2027 (−2 semesters) ─────────
//
// THIS PACE EXISTS TO SHOW THE STRUCTURAL FLOOR, NOT AS A RECOMMENDED
// PATH. Three of the program's most consequential courses are
// season-locked — CS 171 (Fall only), LING 124 (Fall only), and
// LING 165 (Spring only via LING 115). Fitting all three into the
// window between Spring 2026 (current, locked) and Summer 2027
// requires substitutions for ALL THREE, plus dean-level scheduling
// flexibility. The plan below shows the only timeline shape that
// touches Summer 2027, with the substitutions called out explicitly.
const LOCKED_IN_PLAN: ScenarioPlan = {
  title: "Maximum Lock-In — Summer 2027 Graduation",
  subtitle:
    "Two semesters earlier than Standard. Structural floor — requires three advisor-approved substitutions and a dean-approved overload.",
  precondition: {
    kind: "danger",
    headline:
      "Requires THREE substitutions + dean approval — show this to advisor before assuming it's reachable",
    body:
      "Three season-locked courses (CS 171 Fall-only, LING 124 Fall-only, LING 165 Spring-only) cannot all run between Spring 2026 and Summer 2027 because the calendar simply doesn't include another Fall after Fall 2026. Each must be substituted with an advisor-and-chair-approved alternative. This pace also depends on a Summer 2027 unit overload (12 units in a compressed term) that requires dean approval. If any one approval is denied, this collapses back to Heavy Lock-In (Fall 2027) or Standard (Spring 2028). Treat this view as 'what would have to be true' — not a plan to register against until every signature is in writing.",
  },
  highlights: [
    { icon: "alert", text: "Three substitutions required: LING 165, LING 124, CS 171. All three need written department approval before Spring 2027 registration." },
    { icon: "alert", text: "Summer 2027 carries 12 units across a 6–8 week term. Requires dean overload approval and brutal pace." },
    { icon: "alert", text: "If even one substitution is denied, this collapses to Heavy Lock-In (Fall 2027) or Standard (Spring 2028)." },
    { icon: "ok",    text: "Trims a full year off the original Standard plan — frees Fall 2027 + Spring 2028 entirely." },
    { icon: "info",  text: "Use this pace to negotiate. Showing the advisor exactly what would have to be approved often shapes a more realistic Heavy plan." },
  ],
  terms: [
    LOCKED_SPRING_2026,
    {
      id: "su26",
      label: "Summer 2026",
      tag: "CC Heavy — Math + GE",
      caption: "13 units · all CC",
      highRisk: true,
      courses: [
        { code: "MATH 31",   name: "Calculus II",                  units: 4, category: "Major Prep — CRITICAL", source: "CC (either)", ccEquivalent: ccEquivalentLine("MATH 31"),   status: "planned", critical: true },
        { code: "MATH 161A", name: "Applied Prob & Statistics I",  units: 3, category: "Major Prep",            source: "Mission CC",  ccEquivalent: ccEquivalentLine("MATH 161A"), status: "planned" },
        { code: "HIST 15",   name: "Essentials of U.S. History",   units: 3, category: "AI: US1",               source: "CC (either)", ccEquivalent: ccEquivalentLine("HIST 15"),   status: "planned" },
        { code: "AAS 1",     name: "Intro Asian American Studies", units: 3, category: "GE: Area 6",            source: "CC (either)", ccEquivalent: ccEquivalentLine("AAS 1"),     status: "planned" },
      ],
    },
    {
      id: "fa26",
      label: "Fall 2026",
      tag: "SJSU Core Block — All Cores",
      caption: "15 units · all SJSU",
      highRisk: true,
      courses: [
        { code: "CS 146",   name: "Data Structures & Algorithms",     units: 3, category: "CS Core Gateway", source: "SJSU", status: "planned", critical: true },
        { code: "CS 154",   name: "Formal Languages & Computability", units: 3, category: "CS Core",         source: "SJSU", status: "planned" },
        { code: "MATH 39",  name: "Linear Algebra I",                 units: 3, category: "Major Prep",      source: "SJSU", status: "planned" },
        { code: "LING 111", name: "Linguistic Phonetics",             units: 3, category: "LING Core",       source: "SJSU", status: "planned", critical: true },
        { code: "LING 112", name: "Intro to Syntax",                  units: 3, category: "LING Core",       source: "SJSU", status: "planned" },
      ],
    },
    {
      id: "wi2627",
      label: "Winter 2026/27",
      tag: "Winter Session — Jan 2027",
      caption: "3 units · SJSU online",
      courses: [
        { code: "LING 113", name: "Intro to Phonology", units: 3, category: "LING UD", source: "SJSU online", status: "planned" },
      ],
    },
    {
      id: "sp27",
      label: "Spring 2027",
      tag: "Final SJSU Term",
      caption: "15 units · all SJSU",
      highRisk: true,
      courses: [
        { code: "CS 156",   name: "Intro to Artificial Intelligence", units: 3, category: "CS Core",     source: "SJSU", status: "planned" },
        { code: "LING 115", name: "Corpus Linguistics",               units: 3, category: "LING Core",   source: "SJSU", status: "planned", critical: true },
        { code: "CS 133",   name: "Data Visualization",               units: 3, category: "CS Elective", source: "SJSU", status: "planned" },
        { code: "LING 122", name: "English as a World Language",      units: 3, category: "LING UD",     source: "SJSU", status: "planned" },
        { code: "ANTH 160", name: "Mysteries of Ancient Civilizations", units: 3, category: "GE: UD Area 2/5", source: "SJSU online", status: "planned",
          note: "Pulled forward from Summer 2027 since Summer is now graduation term." },
      ],
    },
    {
      id: "su27",
      label: "Summer 2027",
      tag: "Target Graduation — Quadruple Substitution Stack",
      caption: "12 units · GRADUATION",
      isTarget: true,
      highRisk: true,
      courses: [
        { code: "CS 171", name: "ML Substitute (advisor-approved)", units: 3, category: "CS Core — SUBSTITUTE", source: "Substitute", status: "critical-add", critical: true,
          note: "Stand-in for CS 171 (Fall-only). Common substitutes: CS 178 (Neural Networks), CS 185C (special topics), or independent study with a faculty researcher." },
        { code: "LING 124", name: "Speech Tech Substitute (advisor-approved)", units: 3, category: "LING Core — SUBSTITUTE", source: "Substitute", status: "critical-add", critical: true,
          note: "Stand-in for LING 124 (Fall-only). Substitutes are department-approved on a case-by-case basis." },
        { code: "LING 174", name: "Capstone Substitute (advisor-approved)", units: 3, category: "LING Capstone — SUBSTITUTE", source: "Substitute", status: "critical-add", critical: true,
          note: "Stand-in for LING 165 (Spring-only)." },
        { code: "CS 157A", name: "Intro to Database Mgmt Systems", units: 3, category: "CS UD Elective", source: "SJSU online", status: "planned",
          note: "Verify SJSU summer 2027 online section." },
      ],
    },
  ],
  ccUnits: 4 + 3 + 3 + 3, // MATH 31 + MATH 161A + HIST 15 + AAS 1
  costNote: "CC tuition ≈ $600 across summer 2026. SJSU savings ~$4,000 vs. the full-tuition Standard plan, IF every approval lands.",
};

export const RISK_PLANS: Record<RiskPace, ScenarioPlan> = {
  heavy:  HEAVY_PLAN,
  locked: LOCKED_IN_PLAN,
};

/** Default — Heavy is the more conservative of the two remaining
 *  paces and the more likely to actually be reachable. Locked In is
 *  for showing the structural floor, not for default planning. */
export const DEFAULT_RISK_PACE: RiskPace = "heavy";

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
