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
