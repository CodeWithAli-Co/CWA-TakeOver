/**
 * jobHuntStore.ts — local state for the Job Hunt module: the master resume and
 * the saved job pipeline. Persisted to localStorage for v1 (move to a Supabase
 * table when you want cloud sync across devices).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { JobPosting } from "@/JobHunt/discoverJobs";
import type { TailorResult } from "@/JobHunt/tailorResume";
import { type ApplyProfile, emptyProfile } from "@/JobHunt/profile";

export type JobStatus = "saved" | "applied" | "interview" | "offer" | "rejected";
export const JOB_STATUSES: JobStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

/** Outcome of the last auto-apply attempt — persisted on the job so the UI
 *  can show success / "needs you" / error without re-running anything. */
export interface ApplyOutcome {
  status: "submitted" | "needs_human" | "manual" | "error";
  reason: string;
  at: number;                 // timestamp of the attempt
  applyUrl?: string | null;   // where to "open to finish" if it needs a human
}

export interface SavedJob extends JobPosting {
  id: string;
  status: JobStatus;
  notes?: string;
  tailored?: Omit<TailorResult, "error">;
  createdAt: number;
  applyResult?: ApplyOutcome;
}

/** Autopilot — the unattended apply loop config. */
export interface AutopilotConfig {
  query: string;               // roles to search for, same free text as the discover bar
  source: "boards" | "axon";   // discovery source
  minMatch: number;            // 0-100 — only auto-apply at/above this score
  dailyCap: number;            // hard ceiling of submits per calendar day
  perRunCap: number;           // max submits per single batch run
  autoTailor: boolean;         // tailor the resume per job before applying
  discoverFirst: boolean;      // pull fresh listings at the start of each run
  throttleSec: number;         // pause between applications (look human, be polite)
  intervalMin: number;         // continuous mode: minutes between batches
  scheduleEnabled: boolean;    // auto-start once per day at scheduleTime (while app is open)
  scheduleTime: string;        // "HH:MM" 24h local time to kick off the daily run
}

export const defaultAutopilot: AutopilotConfig = {
  query: "",
  source: "boards",
  minMatch: 70,
  dailyCap: 15,
  perRunCap: 5,
  autoTailor: true,
  discoverFirst: true,
  throttleSec: 25,
  intervalMin: 45,
  scheduleEnabled: false,
  scheduleTime: "08:30",
};

export type LogLevel = "info" | "ok" | "warn" | "error";
export interface AutopilotLog { id: string; ts: number; level: LogLevel; msg: string }

const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD, stable per day

const key = (j: { company: string; title: string }) => `${j.company}::${j.title}`.toLowerCase();

interface JobHuntState {
  masterResume: string;
  jobs: SavedJob[];
  profile: ApplyProfile;
  setProfile: (p: ApplyProfile) => void;
  setMasterResume: (r: string) => void;
  addJobs: (jobs: JobPosting[]) => number; // returns count actually added
  updateJob: (id: string, patch: Partial<SavedJob>) => void;
  removeJob: (id: string) => void;

  // autopilot
  autopilot: AutopilotConfig;
  applied: { date: string; count: number };
  runLog: AutopilotLog[];
  lastScheduledRun: string;        // date key of the last scheduled auto-start
  setAutopilot: (patch: Partial<AutopilotConfig>) => void;
  recordApplied: () => void;       // increment today's counter (resets on date rollover)
  appliedToday: () => number;      // submits already made today
  markScheduledRun: () => void;    // stamp today so the scheduler fires once/day
  log: (level: LogLevel, msg: string) => void;
  clearLog: () => void;
}

export const useJobHunt = create<JobHuntState>()(
  persist(
    (set, get) => ({
      masterResume: "",
      jobs: [],
      profile: emptyProfile,
      setProfile: (profile) => set({ profile }),
      setMasterResume: (masterResume) => set({ masterResume }),
      addJobs: (incoming) => {
        const existing = new Set(get().jobs.map((j) => key(j)));
        const fresh = incoming
          .filter((j) => !existing.has(key(j)))
          .map((j) => ({ ...j, id: crypto.randomUUID(), status: "saved" as JobStatus, createdAt: Date.now() }));
        if (fresh.length) set({ jobs: [...fresh, ...get().jobs] });
        return fresh.length;
      },
      updateJob: (id, patch) => set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)) }),
      removeJob: (id) => set({ jobs: get().jobs.filter((j) => j.id !== id) }),

      autopilot: defaultAutopilot,
      applied: { date: todayKey(), count: 0 },
      runLog: [],
      lastScheduledRun: "",
      setAutopilot: (patch) => set({ autopilot: { ...get().autopilot, ...patch } }),
      recordApplied: () => {
        const today = todayKey();
        const a = get().applied;
        set({ applied: a.date === today ? { date: today, count: a.count + 1 } : { date: today, count: 1 } });
      },
      appliedToday: () => {
        const a = get().applied;
        return a.date === todayKey() ? a.count : 0;
      },
      markScheduledRun: () => set({ lastScheduledRun: todayKey() }),
      log: (level, msg) =>
        set({ runLog: [{ id: crypto.randomUUID(), ts: Date.now(), level, msg }, ...get().runLog].slice(0, 200) }),
      clearLog: () => set({ runLog: [] }),
    }),
    { name: "jobhunt:v1" }
  )
);
