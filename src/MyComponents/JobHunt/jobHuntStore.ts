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
};

export type LogLevel = "info" | "ok" | "warn" | "error";
export interface AutopilotLog { id: string; ts: number; level: LogLevel; msg: string }

const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD, local-ish, stable per day

const key = (j: { company: string; title: string }) => `${j.company}::${j.title}`.toLowerCase();

i