/**
 * autopilot.ts — the unattended apply loop.
 *
 * One batch = discover → filter by match + ATS → (optionally) tailor →
 * auto-apply → log, stopping at the daily cap, the per-run cap, or a stop
 * signal. Framework-agnostic: all state and side effects come in through
 * `AutopilotCtx`, so the same engine can be driven by the React hook now or a
 * scheduled task later.
 *
 * It NEVER applies to the same job twice (only "saved" jobs are candidates;
 * a successful submit flips the job to "applied"), and it hard-stops at the
 * per-day ceiling so a long-running session can't blow past 10–20/day.
 */
import { discoverJobs } from "./discoverJobs";
import { fetchJobsApi } from "./fetchJobsApi";
import { tailorResume } from "./tailorResume";
import { autoApply } from "./autoApply";
import { detectAts } from "./atsDetect";
import type { ApplyProfile } from "./profile";
import type { AutopilotConfig, SavedJob, LogLevel } from "@/MyComponents/JobHunt/jobHuntStore";

export interface AutopilotCtx {
  cfg: AutopilotConfig;
  profile: ApplyProfile;
  masterResume: string;
  jobs: () => SavedJob[];                                   // live snapshot of the pipeline
  addJobs: (jobs: any[]) => number;                          // dedupe-insert, returns new count
  updateJob: (id: string, patch: Partial<SavedJob>) => void;
  recordApplied: () => void;                                 // bump today's counter
  appliedToday: () => number;                                // submits already made today
  log: (level: LogLevel, msg: string) => void;
  shouldStop: () => boolean;                                 // cooperative cancel
}

export interface BatchSummary {
  submitted: number;
  needsHuman: number;
  manual: number;
  errors: number;
  considered: number;
  reason: "done" | "daily-cap" | "no-candidates" | "stopped" | "blocked";
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Can this job be driven by the worker right now? */
function isAutoApplyable(j: SavedJob): boolean {
  if (!j.url) return false;
  return !!detectAts(j.url).canAutoApply;
}

export async function runAutopilotBatch(ctx: AutopilotCtx): Promise<BatchSummary> {
  const { cfg, log } = ctx;
  const summary: BatchSummary = { submitted: 0, needsHuman: 0, manual: 0, errors: 0, considered: 0, reason: "done" };

  // Preconditions — fail loud, don't silently no-op.
  if (!ctx.profile.email) {
    log("error", "Autopilot blocked — set your Apply profile (email at minimum) first.");
    summary.reason = "blocked";
    return summary;
  }
  if (!ctx.masterResume.trim()) {
    log("error", "Autopilot blocked — add your master resume first.");
    summary.reason = "blocked";
    return summary;
  }

  const budget = () => cfg.dailyCap - ctx.appliedToday();
  if (budget() <= 0) {
    log("info", `Daily cap reached (${ctx.appliedToday()}/${cfg.dailyCap}). Resting until tomorrow.`);
    summary.reason = "daily-cap";
    return summary;
  }

  log("info", `Run starting — source: ${cfg.source === "boards" ? "job boards" : "Axon web"}, min match ${cfg.minMatch}, ${budget()} left of ${cfg.dailyCap} today.`);

  // 1. Discover fresh listings.
  if (cfg.discoverFirst && cfg.query.trim()) {
    log("info", "Searching for new postings…");
    try {
      const r = cfg.source === "boards"
        ? await fetchJobsApi(cfg.query, ctx.masterResume)
        : await discoverJobs({ query: cfg.query, resume: ctx.masterResume });
      if (r.error) log("warn", `Discovery: ${r.error}`);
      else {
        const added = ctx.addJobs(r.jobs);
        log("info", `Found ${r.jobs.length} listing${r.jobs.length === 1 ? "" : "s"}, ${added} new to your pipeline.`);
      }
    } catch (e: any) {
      log("warn", `Discovery failed: ${e?.message || "unknown error"}`);
    }
  }

  if (ctx.shouldStop()) { summary.reason = "stopped"; log("warn", "Stopped before applying."); return summary; }

  // 2. Pick candidates: unapplied, above threshold, worker-applyable, best first.
  const candidates = ctx.jobs()
    .filter((j) => j.status === "saved")
    .filter((j) => j.match_score >= cfg.minMatch)
    .filter(isAutoApplyable)
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, Math.min(budget(), cfg.perRunCap));

  summary.considered = candidates.length;
  if (!candidates.length) {
    log("info", `No auto-applyable jobs at/above ${cfg.minMatch}% match. Lower the threshold or run a wider search.`);
    summary.reason = "no-candidates";
    return summary;
  }

  log("info", `Queued ${candidates.length} application${candidates.length === 1 ? "" : "s"} this run.`);

  // 3. Tailor → apply, one at a time, throttled.
  for (const job of candidates) {
    if (ctx.shouldStop()) { summary.reason = "stopped"; log("warn", "Stopped mid-run."); break; }
    if (budget() <= 0) { summary.reason = "daily-cap"; log("info", "Hit daily cap mid-run — stopping."); break; }

    const tag = `${job.title} @ ${job.company}`;

    // tailor (skip if already tailored)
    let tailored = job.tailored;
    if (cfg.autoTailor && !tailored) {
      log("info", `Tailoring résumé → ${tag}`);
      try {
        const tr = await tailorResume({
          resume: ctx.masterResume,
          job: { company: job.company, title: job.title, summary: job.summary, requirements: job.requirements },
        });
        if (tr.error) {
          log("warn", `Tailor skipped (${job.company}): ${tr.error} — applying with master résumé.`);
        } else {
          const { error, ...keep } = tr;
          tailored = keep;
          ctx.updateJob(job.id, { tailored: keep });
        }
      } catch (e: any) {
        log("warn", `Tailor errored (${job.company}): ${e?.message || "unknown"} — applying with master résumé.`);
      }
    }

    if (ctx.shouldStop()) { summary.reason = "stopped"; log("warn", "Stopped mid-run."); break; }

    // apply
    log("info", `Applying → ${tag}`);
    try {
      const res = await autoApply({ url: job.url, company: job.company, tailored }, ctx.profile, ctx.masterResume);
      if (res.status === "submitted") {
        summary.submitted++;
        ctx.recordApplied();
        ctx.updateJob(job.id, { status: "applied" });
        log("ok", `✓ Submitted → ${tag}  (${ctx.appliedToday()}/${cfg.dailyCap} today)`);
      } else if (res.status === "needs_human") {
        summary.needsHuman++;
        ctx.updateJob(job.id, { notes: [job.notes, `Autopilot: needs you — ${res.reason}`].filter(Boolean).join("\n") });
        log("warn", `⚠ Needs you → ${tag}: ${res.reason}`);
      } else if (res.status === "manual") {
        summary.manual++;
        log("info", `Manual only → ${tag}: ${res.reason}`);
      } else {
        summary.errors++;
        log("error", `✗ ${tag}: ${res.reason}`);
      }
    } catch (e: any) {
      summary.errors++;
      log("error", `✗ ${tag}: ${e?.message || "apply crashed"}`);
    }

    // throttle between applications (skip the wait after the last one)
    if (!ctx.shouldStop() && budget() > 0 && job !== candidates[candidates.length - 1]) {
      await sleep(Math.max(0, cfg.throttleSec) * 1000);
    }
  }

  if (summary.reason === "done") {
    log("info", `Run complete — ${summary.submitted} submitted, ${summary.needsHuman} need you, ${summary.errors} error${summary.errors === 1 ? "" : "s"}. ${ctx.appliedToday()}/${cfg.dailyCap} today.`);
  }
  return summary;
}
