/**
 * useAutopilot — React controller around runAutopilotBatch.
 *
 * Two ways to run:
 *   · runNow()        — fire a single batch immediately.
 *   · startContinuous — run a batch now, then every cfg.intervalMin until the
 *                       daily cap is hit or the operator stops it. This is the
 *                       "set it and forget it" mode that spreads 10–20/day out
 *                       across the day so applications look human-paced.
 *
 * The engine reads live store state via useJobHunt.getState() on every access,
 * so config/resume/profile edits mid-run take effect on the next job.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useJobHunt } from "./jobHuntStore";
import { runAutopilotBatch, type AutopilotCtx, type BatchSummary } from "@/JobHunt/autopilot";

export function useAutopilot() {
  const [running, setRunning] = useState(false);
  const [continuous, setContinuous] = useState(false);
  const [lastSummary, setLastSummary] = useState<BatchSummary | null>(null);

  const stopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const continuousRef = useRef(false);
  useEffect(() => { continuousRef.current = continuous; }, [continuous]);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const buildCtx = useCallback((): AutopilotCtx => {
    const s = useJobHunt.getState();
    return {
      cfg: s.autopilot,
      profile: s.profile,
      masterResume: s.masterResume,
      jobs: () => useJobHunt.getState().jobs,
      addJobs: (jobs) => useJobHunt.getState().addJobs(jobs),
      updateJob: (id, patch) => useJobHunt.getState().updateJob(id, patch),
      recordApplied: () => useJobHunt.getState().recordApplied(),
      appliedToday: () => useJobHunt.getState().appliedToday(),
      log: (level, msg) => useJobHunt.getState().log(level, msg),
      shouldStop: () => stopRef.current,
    };
  }, []);

  const runOnce = useCallback(async (): Promise<BatchSummary> => {
    runningRef.current = true;
    setRunning(true);
    try {
      const summary = await runAutopilotBatch(buildCtx());
      setLastSummary(summary);
      return summary;
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }, [buildCtx]);

  const stop = useCallback(() => {
    stopRef.current = true;
    clearTimer();
    setContinuous(false);
    useJobHunt.getState().log("warn", "Autopilot stopped by you.");
  }, []);

  const runNow = useCallback(async () => {
    if (runningRef.current) return;
    stopRef.current = false;
    await runOnce();
  }, [runOnce]);

  const startContinuous = useCallback(async () => {
    if (continuous) return;
    stopRef.current = false;
    setContinuous(true);

    const tick = async () => {
      if (stopRef.current) return;
      const s = useJobHunt.getState();
      // Hit the cap? idle until the calendar rolls over (re-check on schedule).
      if (s.appliedToday() < s.autopilot.dailyCap && !runningRef.current) {
        await runOnce();
      }
      if (stopRef.current) return;
      const mins = Math.max(5, useJobHunt.getState().autopilot.intervalMin);
      timerRef.current = setTimeout(tick, mins * 60 * 1000);
    };
    await tick();
  }, [continuous, runOnce]);

  // Daily scheduler: while the app is open, fire the autopilot once per day at
  // the configured time. Polls every 30s so a time/enable change takes effect
  // promptly. markScheduledRun() stamps the day so it can't double-fire.
  useEffect(() => {
    const id = setInterval(() => {
      const s = useJobHunt.getState();
      const { scheduleEnabled, scheduleTime, dailyCap } = s.autopilot;
      if (!scheduleEnabled || continuousRef.current || runningRef.current) return;
      const today = new Date().toISOString().slice(0, 10);
      if (s.lastScheduledRun === today || s.appliedToday() >= dailyCap) return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm >= scheduleTime) {
        s.markScheduledRun();
        s.log("info", `Scheduled auto-start (${scheduleTime}).`);
        startContinuous();
      }
    }, 30000);
    return () => clearInterval(id);
  }, [startContinuous]);

  // Tear down the timer if the component unmounts.
  useEffect(() => () => { stopRef.current = true; clearTimer(); }, []);

  return { running, continuous, lastSummary, runNow, startContinuous, stop };
}
