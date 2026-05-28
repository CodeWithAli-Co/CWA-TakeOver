/**
 * demoMode.ts — Toggle between live data and a pre-baked
 * "growth-stage demo" data set on the home dashboard.
 *
 * The toggle is a pure display-layer concern. It does NOT touch the
 * underlying tables, queries, or any other surface. Components that
 * want to swap to demo values read `useDemoMode()` and pick between
 * their real fetched data and the constants below.
 *
 * State persists to localStorage so the demo stays on between dev
 * restarts — convenient for pitch rehearsals.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DemoModeState {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (v: boolean) => void;
}

export const useDemoMode = create<DemoModeState>()(
  persist(
    (set) => ({
      enabled: false,
      toggle: () => set((s) => ({ enabled: !s.enabled })),
      setEnabled: (v) => set({ enabled: v }),
    }),
    { name: "cwa-dashboard-demo-mode" },
  ),
);

/**
 * The demo numbers — believably aspirational for a healthy growth-stage
 * agency, not "obviously fake" rich. Twelve months of revenue climbing
 * from ~$28k → ~$48k with expenses trailing comfortably below.
 */
export const DEMO_STATS = {
  teamMembers: 24,
  activeProjects: 12,
  monthlyRevenue: "$48k",
  monthlyRevenueRaw: 48_000,
  growthRate: "34%",
  // Quick-stat tile values
  chatMessages: 8_412,
  gitCommits: 1_287,
  hoursTracked: 642,
  // Task counters for the Tasks Overview
  openTasks: 47,
  completedTasks: 184,
} as const;

export const DEMO_REVENUE_SERIES: Array<{
  month: string;
  revenue: number;
  expenses: number;
}> = [
  { month: "Sep", revenue: 28_400, expenses: 19_100 },
  { month: "Oct", revenue: 31_200, expenses: 20_400 },
  { month: "Nov", revenue: 33_700, expenses: 21_500 },
  { month: "Dec", revenue: 35_900, expenses: 22_800 },
  { month: "Jan", revenue: 38_600, expenses: 23_900 },
  { month: "Feb", revenue: 41_500, expenses: 25_200 },
  { month: "Mar", revenue: 44_700, expenses: 26_800 },
  { month: "Apr", revenue: 48_100, expenses: 28_400 },
];

/**
 * Demo project tiles — same count + names look richer than the four
 * defaults. Used when demoMode is on to flesh out the Active Projects
 * grid.
 */
export const DEMO_PROJECTS = [
  { name: "Simplicity",       status: "Active",      progress: 82 },
  { name: "CWA Invoicer",     status: "Active",      progress: 91 },
  { name: "Mario Hauling",    status: "Active",      progress: 67 },
  { name: "Registry Site",    status: "Beta",        progress: 54 },
  { name: "Compass Banking",  status: "Active",      progress: 73 },
  { name: "Atlas Analytics",  status: "Planning",    progress: 22 },
  { name: "Northwind CRM",    status: "Active",      progress: 88 },
  { name: "Helios Recruit",   status: "Active",      progress: 41 },
] as const;

// ─── Row 4 Redux demo fixtures ─────────────────────────────
//
// These power AxonCheckin, CareerGrowth, and TeamPulse when
// useDemoMode().enabled is true. Realistic, varied, and recent —
// the goal is "this person clearly uses the product daily" not
// "look, demo data."

/** Demo Axon check-ins. Shown as the last 3 reflections when
 *  demo mode is on. Mixed across days + times-of-day. */
export const DEMO_CHECKINS: Array<{
  id: string;
  prompt: string;
  entry: string;
  axon_acknowledgement: string;
  time_of_day: "morning" | "midday" | "afternoon" | "evening";
  // Days ago from "today" so the labels stay correct on any
  // date the demo is shown. 0 = today, 1 = yesterday, etc.
  days_ago: number;
}> = [
  {
    id: "demo-checkin-1",
    prompt: "Good morning, Ali. What are you focused on today?",
    entry:
      "Personality engine ships today. Last QA pass on the mood overrides, then I want to record a quick demo for the team before the standup.",
    axon_acknowledgement:
      "Got it. I'll keep mood eval quiet on my end so you can focus.",
    time_of_day: "morning",
    days_ago: 0,
  },
  {
    id: "demo-checkin-2",
    prompt: "How did today go? Anything carrying over to tomorrow?",
    entry:
      "Hit a blocker on the Univer theme override — the CSS isolation is fighting me. Pushed a workaround but it's ugly. Sleeping on it.",
    axon_acknowledgement:
      "Noted. We can look at the override layer fresh in the morning if you want.",
    time_of_day: "evening",
    days_ago: 1,
  },
  {
    id: "demo-checkin-3",
    prompt: "How's the day going so far?",
    entry:
      "Worked late again but the v3 voice swap finally feels right. Tired but proud — this is the unlock for the demo.",
    axon_acknowledgement:
      "That's a real win. The voice carries the product.",
    time_of_day: "evening",
    days_ago: 2,
  },
];

/** Demo growth track — deliberately a LONGER-ARC career-track
 *  story than the Goal card's short-term sprint focus, so the two
 *  cards visually demonstrate distinct scopes. */
export const DEMO_GROWTH_TRACK = {
  current_role: "Founder / CEO",
  next_milestone: "Series A readiness",
  milestone_steps: [
    { id: "s1", label: "Enterprise tier shipped",                 completed: true,  due_date: null },
    { id: "s2", label: "First 3 enterprise pilots signed",        completed: true,  due_date: null },
    { id: "s3", label: "ARR run-rate clears $1M",                 completed: false, due_date: "2026-08-15" },
    { id: "s4", label: "Repeatable enterprise GTM motion",        completed: false, due_date: "2026-09-30" },
    { id: "s5", label: "Lead investor identified + diligence",    completed: false, due_date: "2026-10-31" },
    { id: "s6", label: "Term sheet signed",                       completed: false, due_date: "2026-12-15" },
  ],
  axon_note:
    "Two milestones cleared puts you ahead of where most founders are at this stage. The next one — clearing $1M run-rate — is the inflection point.",
  pacing_status: "ahead" as const,
};

/** Demo team-activity feed — 6 mixed entries (wins / status /
 *  kudos) per the spec. Hours_ago is relative so labels stay
 *  fresh; the formatter maps to "2h", "yesterday", "2d ago". */
export const DEMO_TEAM_ACTIVITY: Array<{
  id: string;
  activity_type: "win" | "status_change" | "kudos";
  description: string;
  hours_ago: number;
}> = [
  {
    id: "demo-act-1",
    activity_type: "win",
    description: "Sem closed the Bay Area Frontier Research Club lead",
    hours_ago: 1,
  },
  {
    id: "demo-act-2",
    activity_type: "kudos",
    description: "Emily → Ali: clean work on the personality engine ship",
    hours_ago: 3,
  },
  {
    id: "demo-act-3",
    activity_type: "status_change",
    description: "Ali marked v3 voice swap as shipped",
    hours_ago: 5,
  },
  {
    id: "demo-act-4",
    activity_type: "status_change",
    description: "Sam wrapped angel investor research — 47 names in the doc",
    hours_ago: 26,
  },
  {
    id: "demo-act-5",
    activity_type: "status_change",
    description: "Emily marked pitch deck v1 as shipped",
    hours_ago: 30,
  },
  {
    id: "demo-act-6",
    activity_type: "kudos",
    description: "Ali → Sem: thanks for tonight's outreach push",
    hours_ago: 50,
  },
];
