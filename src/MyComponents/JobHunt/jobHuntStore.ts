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

export interface SavedJob extends JobPosting {
  id: string;
  status: JobStatus;
  notes?: string;
  tailored?: Omit<TailorResult, "error">;
  createdAt: number;
}

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
    }),
    { name: "jobhunt:v1" }
  )
);
