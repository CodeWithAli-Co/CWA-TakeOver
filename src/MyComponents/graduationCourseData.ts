/**
 * graduationCourseData.ts — Strategic intelligence registry for every
 * course on Ali's BS CS & Linguistics path. Keyed by course code.
 *
 * The DB (graduation_plan_courses) tracks WHAT'S in the plan and its
 * status. This file tracks WHY each course matters, what it unlocks,
 * what to swap it with, what a fail costs, and what the advisor has
 * flagged. The drawer joins the two: live status from DB, deep
 * intelligence from here.
 *
 * Adding a new course: just append a CourseIntel object with its
 * code as the key. Cross-references (prereq chains, unlocks) are
 * resolved by code lookup, so partial graphs are fine.
 *
 * IMPORTANT semantics:
 *   - prereqsRequired   = HARD registration prerequisites only.
 *   - recommendedPrep   = Helpful background, NOT registration-blocking.
 *   - unlocks           = Courses this one actually helps gate.
 *   - recommendedPrepFor = Courses this one helps prepare for, but
 *                         that have a different formal prerequisite.
 *   - Unlock.remainingPrereqs = Other prereqs still needed after
 *                               passing the focused course.
 */

// ─── Types ──────────────────────────────────────────────────────────
export type Division = "Lower Division" | "Upper Division";

export type Offered =
  | "Spring & Fall"
  | "Spring, Summer & Fall"
  | "Spring & Fall (verify summer)"
  | "Fall only"
  | "Spring only"
  | "Variable — check advisor"
  | "Spring 2026"; // one-off seasonal listings

export type MinGrade = {
  value: "C-" | "C" | "B-" | "B";
  /** Severity drives banner color in the UI:
   *   standard = green   (C- is the major default)
   *   wid      = amber   (C strict, C- not accepted)
   *   strict   = red     (C- minimum + critical bottleneck) */
  severity: "standard" | "wid" | "strict";
  /** Optional rationale shown next to the chip. */
  note?: string;
};

export type Workload =
  | "Low"
  | "Low-Medium"
  | "Medium"
  | "Medium-Heavy"
  | "Heavy"
  | "Brutal";

export type StrengthAlignment = "Strong" | "Moderate" | "Weak";

export type RiskLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type RegFlagKind = "ok" | "warn" | "fail";

export interface RegFlag {
  kind: RegFlagKind;
  text: string;
}

/** A downstream course this one unlocks. */
export interface Unlock {
  code: string;
  name: string;
  category: string;
  /** Visual flags drive red highlighting on the unlock card. */
  flags?: ("once-per-year" | "critical-path")[];
  /** Other prereqs still required after passing the focused course. */
  remainingPrereqs?: string[];
  /** Free-text caveat shown beneath the card. */
  note?: string;
}

/** A course that benefits from this one but doesn't formally require it. */
export interface RecommendedPrepFor {
  code: string;
  name: string;
  /** One-line explanation of the help relationship. */
  reason: string;
}

/** Each prereq chain renders as a left-to-right horizontal lane.
 *  Multiple chains stack vertically when a course needs both
 *  (e.g. CS 146 needs both CS 46B and MATH 42). */
export interface PrereqChain {
  /** Codes in order, ending at THIS course (so the visual chain
   *  always lands on the focused course). The trailing code is
   *  ignored if it equals the focused course; otherwise added. */
  codes: string[];
  /** Optional label shown above the chain for clarity. */
  label?: string;
}

export interface CourseIntel {
  // ── 1 · Identity ──
  code: string;
  fullName: string;
  units: number;
  division: Division;
  /** The graduation requirement this satisfies. */
  geDesignation: string;
  department: string;
  offered: Offered;
  minGrade: MinGrade;
  /** Long descriptor used as a sub-header (1 line). */
  shortPurpose: string;

  // ── 2 · Prereqs ──
  prereqChains: PrereqChain[];
  /** Codes that must be cleared (status passed/transfer) before
   *  registration. Used by the Registration Intelligence section. */
  prereqsRequired: string[];
  /** Helpful but NOT registration-blocking background courses. */
  recommendedPrep?: string[];
  /** Optional non-course standing/GPA conditions. */
  standingRequirement?: string;

  // ── 3 · Unlocks ──
  /** Courses this one is a HARD prerequisite for. */
  unlocks: Unlock[];
  /** Courses this one helps prepare for but doesn't formally gate. */
  recommendedPrepFor?: RecommendedPrepFor[];

  // ── 4 · Swap strategy ──
  /** True if missing/failing this delays graduation by ≥1 semester. */
  criticalPath: boolean;
  riskLevel: RiskLevel;
  /** Plain-language consequence if dropped. */
  delaysGraduation: string;
  /** Codes whose registration becomes blocked if this fails. */
  blockedDownstream: string[];
  /** If non-critical, suggest a swap. If critical, set null. */
  safeSwap: string | null;

  // ── 5 · Workload + alignment ──
  workload: Workload;
  /** What the course primarily tests — drives the alignment
   *  computation and the "leans on" line in the drawer. */
  leansOn: ("Math" | "Programming" | "Theory" | "Memorization" | "Writing" | "Discussion" | "Linguistics")[];
  strengthAlignment: StrengthAlignment;
  pairsWell: string[];      // course codes
  doNotPairWith: string[];  // course codes
  pairingNote?: string;

  // ── 6 · Registration intel (extra rows beyond auto-generated) ──
  extraRegFlags?: RegFlag[];

  // ── 7 · Advisor note ──
  advisorNote?: string;
}

// ─── Already-satisfied codes (transfer credits etc.) ────────────────
// These don't appear in the user's plan as "passed" rows — they sit
// on the transcript already. Treated as satisfied when looking up
// prereq status.
//
// NOTE: The student's MyProgress shows ENGL 2 satisfying GE Area 1B
// (NOT ENGL 1B). We expose both ENGL 2 (the actual transcript line)
// and a synthetic "GE 1B" code so prereq chains that just need
// "Area 1B complete" can resolve cleanly without each course
// hard-coding ENGL 2.
export const TRANSFERRED_OR_PRIOR: Record<string, string> = {
  "MATH 30":  "Calculus I (Transfer — B)",
  "CS 46A":   "Intro to Programming (Transfer)",
  "CS 46B":   "Intro to Data Structures (Transfer)",
  "CS 22A":   "Computational Thinking (Transfer)",
  "LING 101": "Introduction to Linguistics (Transfer — B+)",
  "ENGL 2":   "Critical Thinking and Writing (Transfer — satisfies GE Area 1B)",
  "GE 1B":    "GE Area 1B satisfied via ENGL 2 transfer",
};

// ─── Critical path codes ────────────────────────────────────────────
// Mirrors the prompt's list: missing/failing any of these delays
// graduation by ≥1 semester.
export const CRITICAL_PATH_CODES = new Set([
  "MATH 42", "MATH 31",
  "CS 146", "CS 171",
  "LING 111", "LING 115", "LING 124", "LING 165",
]);

// Helpers
const cs   = "Computer Science";
const ling = "Linguistics";
const math = "Mathematics";
const ge   = "General Education";
const wid  = "Writing in the Disciplines";

// ─── Course registry ────────────────────────────────────────────────
export const COURSE_INTEL: Record<string, CourseIntel> = {

  // ═══ SPRING 2026 ════════════════════════════════════════════════
  "BUS3 186": {
    code: "BUS3 186",
    fullName: "Professional & Business Ethics",
    units: 3,
    division: "Upper Division",
    geDesignation: "GE: UD Area 4 — Self, Society & Equality in the U.S.",
    department: "Business / GE",
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Satisfies UD Area 4 — required for graduation.",
    prereqChains: [{ codes: ["GE 1B", "BUS3 186"] }],
    prereqsRequired: ["GE 1B"],
    standingRequirement: "Junior standing",
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No direct delay — UD Area 4 can be re-slotted.",
    blockedDownstream: [],
    safeSwap: "Move to Summer 2026 or Fall 2026. Any other UD Area 4 course (e.g. SOCI 105, JS 134) substitutes.",
    workload: "Low-Medium",
    leansOn: ["Writing", "Discussion"],
    strengthAlignment: "Strong",
    pairsWell: ["MATH 42", "PHIL 134"],
    doNotPairWith: [],
    pairingNote: "Light reading + reflective essays. Easy companion to a heavy STEM course.",
    advisorNote: undefined,
  },

  "CS 22B": {
    code: "CS 22B",
    fullName: "Python Data Analysis",
    units: 3,
    division: "Lower Division",
    geDesignation: "Major Elective — fills 15 elective units bucket",
    department: cs,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Programming-friendly elective. Useful background for later data/ML courses but not a formal prereq.",
    prereqChains: [{ codes: ["CS 22A", "CS 22B"] }],
    prereqsRequired: ["CS 22A"],
    // ─── Strategic intelligence corrections ─────────────────────
    // CS 22B does NOT formally unlock CS 171 or CS 133 for an
    // undergraduate; both require CS 146. CS 22B is helpful prep
    // only. We surface that relationship without misrepresenting
    // it as a registration unlock.
    unlocks: [],
    recommendedPrepFor: [
      {
        code: "CS 133",
        name: "Data Visualization",
        reason: "Python/data-analysis background helps, but undergraduate registration requires CS 146.",
      },
      {
        code: "CS 171",
        name: "Intro to Machine Learning",
        reason: "Python/data-analysis background helps, but the formal prerequisite is CS 146.",
      },
    ],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — major elective slot is flexible.",
    blockedDownstream: [],
    safeSwap: "Any CS-prefix elective (CS 133 itself, CS 149, CS 152) — same elective bucket.",
    workload: "Medium",
    leansOn: ["Programming"],
    strengthAlignment: "Strong",
    pairsWell: ["LLD 100W", "BUS3 186"],
    doNotPairWith: [],
    pairingNote: "Project-based — reasonable to pair with a writing course since cognitive modes don't compete.",
  },

  "LLD 100W": {
    code: "LLD 100W",
    fullName: "Writing Workshop",
    units: 3,
    division: "Upper Division",
    geDesignation: "WID — Writing in the Disciplines (graduation requirement)",
    department: wid,
    offered: "Spring & Fall",
    minGrade: { value: "C", severity: "wid", note: "C- is NOT accepted for WID credit." },
    shortPurpose: "WID is a hard graduation requirement. Pass once, never revisit.",
    prereqChains: [{ codes: ["GE 1B", "LLD 100W"] }],
    prereqsRequired: ["GE 1B"],
    standingRequirement: "Junior standing + Core GE complete",
    unlocks: [],
    criticalPath: false,
    riskLevel: "MEDIUM",
    delaysGraduation: "No delay if passed this term. Failing forces a retake before graduation.",
    blockedDownstream: [],
    safeSwap: "Any other 100W (ENGL 100W, BUS3 100W) — same WID bucket. Avoid stacking with two heavy CS cores.",
    workload: "Medium",
    leansOn: ["Writing"],
    strengthAlignment: "Strong",
    pairsWell: ["CS 22B", "PHIL 134"],
    doNotPairWith: ["CS 146", "CS 154", "CS 171", "MATH 39"],
    pairingNote: "4–6 essays + revisions per term. Do not pair with two heavy CS cores or two math courses.",
    extraRegFlags: [
      { kind: "warn", text: "C- is not accepted for WID credit. Aim for C or higher." },
    ],
  },

  "MATH 42": {
    code: "MATH 42",
    fullName: "Discrete Mathematics",
    units: 3,
    division: "Lower Division",
    geDesignation: "Major Preparation — CRITICAL BOTTLENECK",
    department: math,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "strict", note: "Failing blocks the entire CS upper division." },
    shortPurpose: "Gate for CS 146 and CS 154. The most consequential class this term.",
    prereqChains: [{ codes: ["MATH 30", "MATH 42"] }],
    prereqsRequired: ["MATH 30"],
    unlocks: [
      { code: "CS 146", name: "Data Structures & Algorithms", category: "CS Core Gateway", flags: ["critical-path"] },
      { code: "CS 154", name: "Formal Languages & Computability", category: "CS Core" },
    ],
    criticalPath: true,
    riskLevel: "CRITICAL",
    delaysGraduation: "Failing delays graduation by ≥ 1 semester (CS 146 + CS 154 both blocked).",
    blockedDownstream: ["CS 146", "CS 154"],
    safeSwap: null,
    workload: "Heavy",
    leansOn: ["Math", "Theory"],
    strengthAlignment: "Weak",
    pairsWell: ["BUS3 186", "PHIL 134", "CS 22B"],
    doNotPairWith: ["MATH 31", "CS 154", "MATH 39"],
    pairingNote: "Already paired with light GE this term — keep it that way. Do NOT add another math.",
    advisorNote:
      "Currently enrolled. This is the #1 priority this semester. Failing again delays the entire CS upper-division sequence by a full year.",
  },

  "PHIL 134": {
    code: "PHIL 134",
    fullName: "Computers, Ethics, and Society",
    units: 3,
    division: "Upper Division",
    geDesignation: "GE: UD Area 3 — Cultures & Global Understanding (also Major Prep slot)",
    department: ge,
    offered: "Spring 2026",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Doubles as UD Area 3 + a CS major prep requirement — efficient combo.",
    prereqChains: [],
    prereqsRequired: [],
    standingRequirement: "Junior standing",
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay if re-slotted, but PHIL 134 is still owed as a BSCSL major-prep requirement.",
    blockedDownstream: [],
    // PHIL 134 double-counts as UD Area 3 AND a major-prep requirement.
    // Substituting another UD Area 3 course closes the GE slot but
    // leaves the major-prep requirement open, so it isn't a real swap.
    safeSwap:
      "Not recommended. Another UD Area 3 GE will close the GE slot, but you still need PHIL 134 later for the BSCSL major-prep requirement.",
    workload: "Low-Medium",
    leansOn: ["Writing", "Discussion"],
    strengthAlignment: "Strong",
    pairsWell: ["MATH 42", "BUS3 186", "CS 22B"],
    doNotPairWith: [],
    pairingNote: "Discussion-heavy, light reading. Pairs naturally with any heavy STEM course.",
  },

  // ═══ SUMMER 2026 ════════════════════════════════════════════════
  "MATH 31": {
    code: "MATH 31",
    fullName: "Calculus II",
    units: 4,
    division: "Lower Division",
    geDesignation: "Major Preparation — CRITICAL",
    department: math,
    offered: "Spring, Summer & Fall",
    minGrade: { value: "C-", severity: "strict", note: "D/F/NC retake — must clear this attempt." },
    shortPurpose: "Gate for MATH 161A. Without it, MATH 161A (and graduation requirements) stall.",
    prereqChains: [{ codes: ["MATH 30", "MATH 31"] }],
    prereqsRequired: ["MATH 30"],
    unlocks: [
      { code: "MATH 161A", name: "Applied Probability & Statistics I", category: "Major Prep" },
    ],
    recommendedPrepFor: [
      {
        code: "MATH 39",
        name: "Linear Algebra I",
        reason: "MATH 31 is helpful background; MATH 39's formal prereq is MATH 30.",
      },
    ],
    criticalPath: true,
    riskLevel: "CRITICAL",
    delaysGraduation: "Failing delays MATH 161A and the graduation requirement chain by 1+ semester.",
    blockedDownstream: ["MATH 161A"],
    safeSwap: null,
    workload: "Heavy",
    leansOn: ["Math"],
    strengthAlignment: "Weak",
    pairsWell: [],
    doNotPairWith: ["MATH 39", "MATH 42", "CS 154", "MATH 161A"],
    pairingNote: "Take ALONE this summer. Compressed term + math + retake = no co-registration.",
    advisorNote:
      "You have a D/F/NC history in this course. Do NOT pair with any other math or CS theory course. Take it alone in Summer 2026.",
  },

  "AAS 1": {
    code: "AAS 1",
    fullName: "Introduction to Asian American Studies",
    units: 3,
    division: "Lower Division",
    geDesignation: "GE: Area 6 — Ethnic Studies (C- minimum required by CSU policy)",
    department: ge,
    // Audit listed AAS 1 under all terms; keep summer warning.
    offered: "Spring, Summer & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Satisfies the CSU Ethnic Studies requirement.",
    prereqChains: [],
    prereqsRequired: [],
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — many Area 6 substitutes (AFAM 2A, MAS 10, NAS 1).",
    blockedDownstream: [],
    safeSwap: "Any other CSU Ethnic Studies course (AFAM 2A, MAS 10, NAS 1) — same Area 6 credit.",
    workload: "Low-Medium",
    leansOn: ["Memorization", "Writing"],
    strengthAlignment: "Moderate",
    pairsWell: ["MATH 31"],
    doNotPairWith: [],
    pairingNote: "Light enough to pair with a heavy summer math.",
    extraRegFlags: [
      { kind: "warn", text: "Verify Summer 2026 section availability before relying on it." },
    ],
  },

  // ═══ FALL 2026 ══════════════════════════════════════════════════
  "CS 146": {
    code: "CS 146",
    fullName: "Data Structures & Algorithms",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Preparation — CS Core (Primary Gateway)",
    department: cs,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "strict", note: "Gateway to virtually every UD CS course." },
    shortPurpose: "The single most-unlocking course in the major. Pass it well.",
    prereqChains: [
      { codes: ["CS 46A", "CS 46B", "CS 146"], label: "Programming chain" },
      { codes: ["MATH 30", "MATH 42", "CS 146"], label: "Math chain" },
    ],
    prereqsRequired: ["CS 46B", "MATH 42", "MATH 30"],
    unlocks: [
      { code: "CS 156",  name: "Intro to Artificial Intelligence",   category: "CS Core" },
      { code: "CS 171",  name: "Intro to Machine Learning",          category: "CS Core", flags: ["once-per-year", "critical-path"] },
      { code: "CS 133",  name: "Data Visualization",                  category: "CS Elective" },
      { code: "CS 157A", name: "Database Management Systems",         category: "CS UD Elective" },
      { code: "CS 151",  name: "Object-Oriented Design",              category: "CS Elective" },
      { code: "CS 155",  name: "Design and Analysis of Algorithms",   category: "CS Elective" },
      // CS 149 also requires CS 47 / CMPE 102 (assembly/architecture).
      // CS 146 is necessary but not sufficient — surface that.
      {
        code: "CS 149",
        name: "Operating Systems",
        category: "CS Elective",
        remainingPrereqs: ["CS 47 or CMPE 102"],
        note: "CS 146 alone is not enough — you'll also need CS 47 or CMPE 102 (assembly / computer architecture).",
      },
    ],
    criticalPath: true,
    riskLevel: "CRITICAL",
    delaysGraduation: "Failing delays every CS UD course. Earliest graduation slips to Fall 2028.",
    blockedDownstream: ["CS 156", "CS 171", "CS 157A", "CS 133"],
    safeSwap: null,
    // High stakes but aligned with Ali's programming strength.
    // Heavy, not Brutal — keep CRITICAL risk level so the planning UI
    // still flags the consequence of failure.
    workload: "Heavy",
    leansOn: ["Programming", "Theory"],
    strengthAlignment: "Strong",
    pairsWell: ["LING 111", "HIST 15"],
    doNotPairWith: ["CS 154", "MATH 39", "LLD 100W"],
    pairingNote: "Already correctly slotted with LING 111 + HIST 15 — both light enough to absorb the project load.",
    extraRegFlags: [
      { kind: "warn", text: "Confirm Java prereq: CS 49J vs CS 49C — known transcript gap." },
    ],
    advisorNote:
      "Confirm with advisor whether CS 49C (C programming) satisfies the Java prerequisite, or if CS 49J is still required. This is a known gap in your transfer record.",
  },

  "CS 154": {
    code: "CS 154",
    fullName: "Formal Languages & Computability",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Preparation — CS Core",
    department: cs,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "CS theory core. Proof-heavy — second-hardest gateway after CS 146.",
    prereqChains: [{ codes: ["CS 46B", "CS 154"] }, { codes: ["MATH 42", "CS 154"] }],
    prereqsRequired: ["CS 46B", "MATH 42"],
    unlocks: [
      { code: "CS 153", name: "Compiler Design", category: "CS Elective" },
    ],
    criticalPath: false,
    riskLevel: "MEDIUM",
    delaysGraduation: "No direct graduation delay (Spring & Fall offering means re-slotting is possible).",
    blockedDownstream: ["CS 153"],
    safeSwap: "Move to Spring 2027 or Fall 2027 — but pairing with CS 146 in Fall 2026 was the planned distribution.",
    workload: "Heavy",
    leansOn: ["Theory", "Math"],
    strengthAlignment: "Moderate",
    // Resolve the prior contradiction with MATH 39: do NOT pair them.
    pairsWell: ["LING 111", "HIST 15"],
    doNotPairWith: ["CS 146", "MATH 39", "MATH 31", "LLD 100W"],
    pairingNote:
      "Avoid pairing with CS 146 unless the term is capped at 12–15 units and there is no other heavy math/theory course.",
  },

  "MATH 39": {
    code: "MATH 39",
    fullName: "Linear Algebra I",
    units: 3,
    division: "Lower Division",
    geDesignation: "Major Preparation",
    department: math,
    offered: "Spring, Summer & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Linear algebra foundation — useful for ML and graphics electives.",
    prereqChains: [{ codes: ["MATH 30", "MATH 39"] }],
    prereqsRequired: ["MATH 30"],
    unlocks: [],
    recommendedPrepFor: [
      {
        code: "CS 171",
        name: "Intro to Machine Learning",
        reason: "Linear algebra fluency helps ML, but CS 171's formal prereq is CS 146.",
      },
      {
        code: "MATH 161A",
        name: "Applied Probability & Statistics I",
        reason: "Linear algebra is supportive background; MATH 161A's formal prereq is MATH 31.",
      },
    ],
    criticalPath: false,
    riskLevel: "MEDIUM",
    delaysGraduation: "No delay if re-slotted. CS 171 doesn't list MATH 39 as a hard prereq.",
    blockedDownstream: [],
    safeSwap: "Move to Spring 2027 or Summer 2027 — no chain damage.",
    workload: "Heavy",
    leansOn: ["Math"],
    strengthAlignment: "Weak",
    pairsWell: [],
    doNotPairWith: ["CS 146", "CS 154", "MATH 31", "MATH 42"],
    pairingNote: "Math course — never pair with another math or CS theory in the same term.",
  },

  "LING 111": {
    code: "LING 111",
    fullName: "Linguistic Phonetics",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Requirement — LING Core (TIME-SENSITIVE)",
    department: ling,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "strict", note: "Hard prereq for LING 124 (Fall only)." },
    shortPurpose: "Foundation phonetics. Required prereq for LING 124 (Speech Tech, Fall only).",
    prereqChains: [{ codes: ["LING 101", "LING 111"] }],
    prereqsRequired: ["LING 101"],
    unlocks: [
      { code: "LING 124", name: "Intro to Speech Technology", category: "LING Core", flags: ["once-per-year", "critical-path"] },
    ],
    criticalPath: true,
    riskLevel: "HIGH",
    // Corrected: Fall 2026 is preferred but not the only window —
    // LING 111 is offered Spring & Fall.
    delaysGraduation:
      "Missing Fall 2026 does not automatically delay graduation if taken Spring 2027. Missing both Fall 2026 AND Spring 2027 blocks LING 124 in Fall 2027.",
    blockedDownstream: ["LING 124"],
    safeSwap: null,
    workload: "Medium",
    leansOn: ["Linguistics"],
    strengthAlignment: "Strong",
    pairsWell: ["CS 146", "HIST 15"],
    doNotPairWith: [],
    pairingNote: "Comfortable companion to CS 146 — different cognitive modes.",
    advisorNote:
      "Take by Spring 2027 at the latest. Missing both Fall 2026 and Spring 2027 blocks LING 124 in Fall 2027.",
  },

  "HIST 15": {
    code: "HIST 15",
    fullName: "Essentials of U.S. History",
    units: 3,
    division: "Lower Division",
    geDesignation: "American Institutions — US1 (American History — graduation requirement)",
    department: "History / GE",
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Closes the AI: US1 (American History) graduation requirement.",
    prereqChains: [],
    prereqsRequired: [],
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation:
      "No delay if re-slotted. The student is missing US1 specifically; US2 and US3 are already satisfied.",
    blockedDownstream: [],
    // Critical correction: POLS 1 satisfies US2/US3, NOT US1. Do not
    // suggest it as a substitute. The valid US1 alternatives are
    // history-prefixed.
    safeSwap:
      "Move to Summer 2027. Alternatives that also satisfy US1: AMS 10, HIST 20A, HIST 20B, HIST 170, HIST 170S, HIST 188.",
    workload: "Medium",
    leansOn: ["Memorization", "Writing"],
    strengthAlignment: "Moderate",
    pairsWell: ["CS 146", "LING 111"],
    doNotPairWith: [],
    pairingNote: "Reading-heavy but predictable. Sits well next to a CS core.",
  },

  // ═══ SPRING 2027 ════════════════════════════════════════════════
  "CS 156": {
    code: "CS 156",
    fullName: "Intro to Artificial Intelligence",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Requirement — CS Core",
    department: cs,
    offered: "Variable — check advisor",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Programming + logic foundations — useful conceptual prep for CS 171.",
    prereqChains: [{ codes: ["CS 146", "CS 156"] }],
    prereqsRequired: ["CS 146"],
    unlocks: [],
    recommendedPrepFor: [
      {
        code: "CS 171",
        name: "Intro to Machine Learning",
        reason: "Conceptually helpful but not a formal prerequisite — CS 171 only requires CS 146.",
      },
    ],
    criticalPath: false,
    riskLevel: "MEDIUM",
    delaysGraduation: "No delay — variable offering means re-slot is possible if missed.",
    blockedDownstream: [],
    safeSwap: "Re-slot to Fall 2027 if Spring 2027 isn't offered. Check ahead of registration.",
    workload: "Heavy",
    leansOn: ["Programming", "Theory"],
    strengthAlignment: "Strong",
    pairsWell: ["LING 112", "LING 122"],
    doNotPairWith: ["CS 154", "LLD 100W"],
    pairingNote:
      "Can be paired with MATH 161A only if the rest of the term is linguistics/writing-heavy, not another hard CS/math course.",
    extraRegFlags: [
      { kind: "warn", text: "Listed as variable offering — confirm Spring 2027 availability before locking the schedule." },
    ],
    advisorNote:
      "Listed as 'Variable Offering — See Advisor.' Confirm Spring 2027 availability before building plan around it.",
  },

  "MATH 161A": {
    code: "MATH 161A",
    fullName: "Applied Probability & Statistics I",
    units: 3,
    division: "Lower Division",
    geDesignation: "Major Preparation",
    department: math,
    offered: "Spring, Summer & Fall",
    minGrade: { value: "C-", severity: "standard", note: "Required for graduation." },
    shortPurpose: "Statistical foundation. Required for graduation; supportive background for CS 171.",
    prereqChains: [{ codes: ["MATH 30", "MATH 31", "MATH 161A"] }],
    prereqsRequired: ["MATH 31"],
    unlocks: [
      { code: "MATH 161B", name: "Applied Statistics II (optional)", category: "Math Elective" },
    ],
    recommendedPrepFor: [
      {
        code: "CS 171",
        name: "Intro to Machine Learning",
        reason: "Statistics fluency helps significantly, but CS 171's formal prereq is CS 146 — MATH 161A is not a registration block.",
      },
    ],
    criticalPath: false,
    riskLevel: "HIGH",
    // Corrected: MATH 161A is required for the major, but it is not a
    // formal CS 171 registration prerequisite. Failing delays the
    // graduation requirement, not specifically CS 171 registration.
    delaysGraduation:
      "Failing delays the major's graduation requirement and pushes statistics fluency back, but does not formally block CS 171 registration.",
    blockedDownstream: [],
    safeSwap: "Re-slot to Summer 2027 if needed — but stacking with summer LING courses is risky.",
    workload: "Heavy",
    leansOn: ["Math"],
    strengthAlignment: "Weak",
    pairsWell: ["LING 112", "LING 122"],
    doNotPairWith: ["MATH 39", "MATH 31"],
    pairingNote:
      "Can sit alongside CS 156 only if the rest of the term is linguistics/writing — never alongside another hard math or CS theory.",
  },

  "LING 112": {
    code: "LING 112",
    fullName: "Introduction to Syntax",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Requirement — LING Core",
    department: ling,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Syntax foundations — supports later LING UD electives.",
    prereqChains: [{ codes: ["LING 101", "LING 112"] }],
    prereqsRequired: ["LING 101"],
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — Spring & Fall offering is forgiving.",
    blockedDownstream: [],
    safeSwap: "Re-slot to Fall 2027 — no chain damage.",
    workload: "Medium",
    leansOn: ["Linguistics"],
    strengthAlignment: "Strong",
    pairsWell: ["LING 113", "LING 115"],
    doNotPairWith: [],
    pairingNote: "Three LING courses in one term is heavy but coherent — only do it Spring 2027 as planned.",
  },

  "LING 115": {
    code: "LING 115",
    fullName: "Corpus Linguistics",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Requirement — LING Core (TIME-SENSITIVE — unlocks NLP)",
    department: ling,
    offered: "Spring only",
    minGrade: { value: "C-", severity: "strict", note: "Hard prereq for LING 165 (graduation anchor)." },
    shortPurpose: "Direct prereq for LING 165 (Spring 2028 capstone). The Spring 2027 anchor.",
    prereqChains: [
      { codes: ["LING 101", "LING 115"] },
      { codes: ["CS 22A", "LING 115"] },
    ],
    prereqsRequired: ["LING 101", "CS 22A"],
    unlocks: [
      { code: "LING 165", name: "Intro to Natural Language Processing", category: "LING Core — Capstone", flags: ["once-per-year", "critical-path"] },
    ],
    criticalPath: true,
    riskLevel: "CRITICAL",
    delaysGraduation: "Missing or failing slips LING 165 to Spring 2029 → graduation pushed a full year.",
    blockedDownstream: ["LING 165"],
    safeSwap: null,
    workload: "Medium",
    leansOn: ["Programming", "Linguistics"],
    strengthAlignment: "Strong",
    pairsWell: ["LING 112", "LING 113"],
    doNotPairWith: ["MATH 161A"],
    pairingNote: "Programming + linguistics overlap with CS 156 — already separated by term planning.",
    advisorNote:
      "Spring only. Must pass to unlock LING 165 in Spring 2028. Final-year graduation depends on this slot.",
  },

  "LING 113": {
    code: "LING 113",
    fullName: "Introduction to Phonology",
    units: 3,
    division: "Upper Division",
    geDesignation: "LING UD Choice — chosen for chain coherence with LING 111",
    department: ling,
    offered: "Spring only",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "LING UD elective. Builds on LING 111's phonetics.",
    prereqChains: [{ codes: ["LING 101", "LING 113"] }],
    prereqsRequired: ["LING 101"],
    recommendedPrep: ["LING 111"],
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — LING UD slots have multiple substitutes.",
    blockedDownstream: [],
    safeSwap: "Any LING UD elective (LING 116, LING 117) fills the same bucket.",
    workload: "Medium",
    leansOn: ["Linguistics"],
    strengthAlignment: "Strong",
    pairsWell: ["LING 112", "LING 115"],
    doNotPairWith: [],
    pairingNote: "Three LING courses in Spring 2027 is intentional — they share methods, so prep compounds.",
  },

  // ═══ SUMMER 2027 ════════════════════════════════════════════════
  "ANTH 160": {
    code: "ANTH 160",
    fullName: "Mysteries of Ancient Civilizations",
    units: 3,
    division: "Upper Division",
    geDesignation: "GE: UD Area 2/5 — Earth, Environment & Sustainability",
    department: ge,
    offered: "Spring, Summer & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Closes the UD Area 2/5 graduation requirement.",
    prereqChains: [{ codes: ["GE 1B", "ANTH 160"] }],
    prereqsRequired: ["GE 1B"],
    standingRequirement: "Junior standing",
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — many UD Area 2/5 substitutes.",
    blockedDownstream: [],
    safeSwap: "Any UD Area 2/5 GE works as substitute.",
    workload: "Low-Medium",
    leansOn: ["Memorization", "Writing"],
    strengthAlignment: "Moderate",
    pairsWell: ["LING 122"],
    doNotPairWith: [],
    pairingNote: "Light summer pairing — doesn't compete with linguistics elective load.",
  },

  "LING 122": {
    code: "LING 122",
    fullName: "English as a World Language",
    units: 3,
    division: "Upper Division",
    geDesignation: "LING UD Elective",
    department: ling,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Fills the LING UD elective slot. Reading + analysis.",
    prereqChains: [{ codes: ["LING 101", "LING 122"] }],
    prereqsRequired: ["LING 101"],
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — LING UD electives are interchangeable.",
    blockedDownstream: [],
    safeSwap: "Any LING UD elective.",
    workload: "Low-Medium",
    leansOn: ["Linguistics", "Writing"],
    strengthAlignment: "Strong",
    pairsWell: ["ANTH 160"],
    doNotPairWith: [],
    extraRegFlags: [
      { kind: "warn", text: "Verify Summer 2027 offering — listed Spring & Fall." },
    ],
  },

  // ═══ FALL 2027 ══════════════════════════════════════════════════
  "CS 171": {
    code: "CS 171",
    fullName: "Intro to Machine Learning",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Requirement — CS Core (TIME-SENSITIVE)",
    department: cs,
    offered: "Fall only",
    minGrade: { value: "C-", severity: "strict", note: "Fall only — single annual offering." },
    shortPurpose: "Capstone CS technical anchor. The resume course.",
    // Only the CS 146 chain is a HARD prereq chain. The math chain
    // is recommended preparation, not a registration block.
    prereqChains: [
      { codes: ["CS 146", "CS 171"], label: "Algorithms chain (required)" },
    ],
    prereqsRequired: ["CS 146"],
    recommendedPrep: ["MATH 161A", "MATH 39"],
    unlocks: [],
    criticalPath: true,
    riskLevel: "CRITICAL",
    delaysGraduation: "Missing Fall 2027 = next chance Fall 2028 = graduation Spring 2029.",
    blockedDownstream: [],
    safeSwap: null,
    workload: "Brutal",
    leansOn: ["Programming", "Math"],
    strengthAlignment: "Strong",
    pairsWell: ["LING 124", "CS 157A"],
    doNotPairWith: ["CS 154"],
    pairingNote: "Already correctly slotted with LING 124 + CS 157A. Don't add a second math.",
    advisorNote:
      "Fall only. If missed in Fall 2027, next opportunity is Fall 2028, which pushes graduation to Spring 2029.",
  },

  "LING 124": {
    code: "LING 124",
    fullName: "Intro to Speech Technology",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Requirement — LING Core (TIME-SENSITIVE)",
    department: ling,
    offered: "Fall only",
    minGrade: { value: "C-", severity: "strict" },
    shortPurpose: "LING/CS bridge — speech tech, programming-heavy linguistics.",
    prereqChains: [
      { codes: ["LING 101", "LING 124"] },
      { codes: ["LING 111", "LING 124"], label: "Required chain" },
    ],
    prereqsRequired: ["LING 101", "LING 111"],
    unlocks: [],
    criticalPath: true,
    riskLevel: "CRITICAL",
    // Corrected: missing Fall 2027 means waiting for Fall 2028, which
    // pushes graduation to Fall 2028 (one semester), NOT Spring 2029.
    delaysGraduation:
      "Missing Fall 2027 likely pushes graduation to Fall 2028 because the next offering is Fall 2028.",
    blockedDownstream: [],
    safeSwap: null,
    workload: "Medium-Heavy",
    leansOn: ["Linguistics", "Programming"],
    strengthAlignment: "Strong",
    pairsWell: ["CS 171", "CS 157A"],
    doNotPairWith: [],
    pairingNote: "Pairs naturally with CS 171 — same toolchain (Python, signal processing).",
    advisorNote:
      "Fall only. Requires LING 111. This is why LING 111 must be cleared by Spring 2027 — any later and LING 124 slots into Fall 2028.",
  },

  "CS 157A": {
    code: "CS 157A",
    fullName: "Intro to Database Management Systems",
    units: 3,
    division: "Upper Division",
    geDesignation: "CS UD Elective",
    department: cs,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "SQL, schema design, query planning. Job-relevant elective.",
    prereqChains: [{ codes: ["CS 146", "CS 157A"] }],
    prereqsRequired: ["CS 146"],
    unlocks: [
      { code: "CS 157B", name: "Advanced Database Systems", category: "CS Elective" },
    ],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — CS UD elective is swappable.",
    blockedDownstream: [],
    safeSwap: "Any CS UD elective (CS 151, 153, 155) fills the same slot.",
    workload: "Medium",
    leansOn: ["Programming"],
    strengthAlignment: "Strong",
    pairsWell: ["CS 171", "LING 124"],
    doNotPairWith: ["CS 146"],
    pairingNote: "Light enough to absorb alongside CS 171's brutality.",
  },

  // ═══ SPRING 2028 ════════════════════════════════════════════════
  "LING 165": {
    code: "LING 165",
    fullName: "Intro to Natural Language Processing",
    units: 3,
    division: "Upper Division",
    geDesignation: "Major Requirement — LING Core CAPSTONE",
    department: ling,
    offered: "Spring only",
    minGrade: { value: "C-", severity: "strict", note: "Graduation anchor — Spring only." },
    shortPurpose: "The capstone course. Final semester. Everything else protects this slot.",
    prereqChains: [
      { codes: ["LING 101", "LING 165"] },
      { codes: ["LING 115", "LING 165"], label: "Critical prereq chain" },
    ],
    prereqsRequired: ["LING 101", "LING 115"],
    unlocks: [],
    criticalPath: true,
    riskLevel: "CRITICAL",
    delaysGraduation: "Missing Spring 2028 = Spring 2029 (Fall 2028 not offered) = full-year delay.",
    blockedDownstream: [],
    safeSwap: null,
    workload: "Heavy",
    leansOn: ["Programming", "Linguistics"],
    strengthAlignment: "Strong",
    pairsWell: ["CS 133"],
    doNotPairWith: [],
    pairingNote: "Final term — pairs with CS 133 (Data Viz). Both programming-forward, no chain risk left.",
    advisorNote:
      "Spring only. The entire plan is built to protect this slot. If missed, graduation is Spring 2029 at earliest.",
  },

  "CS 133": {
    code: "CS 133",
    fullName: "Data Visualization",
    units: 3,
    division: "Upper Division",
    geDesignation: "CS Elective",
    department: cs,
    offered: "Spring & Fall",
    minGrade: { value: "C-", severity: "standard" },
    shortPurpose: "Visualization techniques. Pairs naturally with NLP capstone.",
    prereqChains: [{ codes: ["CS 146", "CS 133"] }],
    prereqsRequired: ["CS 146"],
    recommendedPrep: ["CS 22B"],
    unlocks: [],
    criticalPath: false,
    riskLevel: "LOW",
    delaysGraduation: "No delay — CS elective is fully swappable.",
    blockedDownstream: [],
    safeSwap: "Any CS elective (CS 131, CS 149, CS 152) fills this slot.",
    workload: "Medium",
    leansOn: ["Programming"],
    strengthAlignment: "Strong",
    pairsWell: ["LING 165"],
    doNotPairWith: [],
    pairingNote: "Programming-forward — won't compete cognitively with NLP capstone.",
  },
};

// ─── Lookup helpers ────────────────────────────────────────────────

/** Find a course by code. Returns undefined for codes outside the
 *  registry (e.g. user added an off-plan elective). */
export function getCourseIntel(code: string): CourseIntel | undefined {
  return COURSE_INTEL[code];
}

/** True if `code` should be treated as already satisfied (transfer
 *  credit etc.) when rendering prereq chains. */
export function isTransferred(code: string): boolean {
  return code in TRANSFERRED_OR_PRIOR;
}

/** Human-readable transfer note, or undefined. */
export function getTransferNote(code: string): string | undefined {
  return TRANSFERRED_OR_PRIOR[code];
}
