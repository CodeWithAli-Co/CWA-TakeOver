/**
 * AutopilotPanel — the cockpit for the unattended apply loop. Lives at the top
 * of JobHuntPage. Edit the run config, fire a single batch or let it run
 * continuously through the day, and watch the live log.
 */
import { useState } from "react";
import { Bot, Play, Square, Loader2, Trash2, ChevronDown, ChevronRight, Gauge } from "lucide-react";
import { useJobHunt, type AutopilotConfig, type LogLevel } from "./jobHuntStore";
import { useAutopilot } from "./useAutopilot";

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "text-muted-foreground",
  ok: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-muted-foreground/70">{hint}</span>}
    </label>
  );
}

const numCls =
  "bg-background border border-border rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:border-primary/50";

export function AutopilotPanel() {
  const cfg = useJobHunt((s) => s.autopilot);
  const setAutopilot = useJobHunt((s) => s.setAutopilot);
  const runLog = useJobHunt((s) => s.runLog);
  const clearLog = useJobHunt((s) => s.clearLog);
  const applied = useJobHunt((s) => s.applied);
  const appliedTodayFn = useJobHunt((s) => s.appliedToday);
  const profile = useJobHunt((s) => s.profile);
  const masterResume = useJobHunt((s) => s.masterResume);
  void applied; // subscription so the counter re-renders on each submit

  const { running, continuous, lastSummary, runNow, startContinuous, stop } = useAutopilot();
  const [open, setOpen] = useState(false);

  const done = appliedTodayFn();
  const pct = Math.min(100, Math.round((done / Math.max(1, cfg.dailyCap)) * 100));
  const ready = !!profile.email && !!masterResume.trim();
  const set = (patch: Partial<AutopilotConfig>) => setAutopilot(patch);

  return (
    <div className="bg-card border border-border rounded-lg mb-5 overflow-hidden">
      {/* header row */}
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-2 text-foreground">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          <Bot size={16} className={continuous ? "text-emerald-400" : "text-foreground"} />
          <span className="text-[14px] font-semibold">Autopilot</span>
        </button>

        {/* today's progress */}
        <div className="flex items-center gap-2 min-w-[160px]">
          <Gauge size={13} className="text-muted-foreground" />
          <div className="h-1.5 w-24 rounded-full bg-border overflow-hidden">
            <div className="h-full bg-emerald-500/80" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11.5px] tabular-nums text-muted-foreground">{done}/{cfg.dailyCap} today</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {continuous && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> running
            </span>
          )}
          {continuous ? (
            <button onClick={stop}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-red-600/40 text-[12px] text-red-300 hover:bg-red-500/10">
              <Square size={12} /> Stop
            </button>
          ) : (
            <>
              <button onClick={runNow} disabled={running || !ready}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border text-[12px] text-foreground disabled:opacity-50 hover:border-foreground/30">
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                {running ? "Running…" : "Run once"}
              </button>
              <button onClick={startContinuous} disabled={running || !ready}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50 hover:opacity-90">
                <Bot size={13} /> Start autopilot
              </button>
            </>
          )}
        </div>

        {!ready && (
          <p className="w-full text-[11px] text-amber-400/80">
            Add your master résumé and Apply profile (top-right) before autopilot can run.
          </p>
        )}
      </div>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          {/* config */}
          <div>
            <Field label="Roles to search for">
              <textarea value={cfg.query} onChange={(e) => set({ query: e.target.value })} rows={2}
                        placeholder="e.g. 'remote senior React/TS, $130k+, fintech or dev-tools, US time zones'"
                        className={`${numCls} resize-none w-full`} />
            </Field>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Source">
              <div className="flex items-center gap-1.5">
                {(["boards", "axon"] as const).map((sv) => (
                  <button key={sv} onClick={() => set({ source: sv })}
                          className={`h-8 px-2.5 rounded-md text-[11.5px] border transition-colors ${cfg.source === sv ? "border-foreground/40 bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                    {sv === "boards" ? "Job boards" : "Axon web"}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`Min match — ${cfg.minMatch}%`} hint="Only apply at/above this score">
              <input type="range" min={40} max={95} step={5} value={cfg.minMatch}
                     onChange={(e) => set({ minMatch: Number(e.target.value) })} className="accent-emerald-500 h-8" />
            </Field>
            <Field label="Daily cap" hint="Hard ceiling per day">
              <input type="number" min={1} max={40} value={cfg.dailyCap}
                     onChange={(e) => set({ dailyCap: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })} className={numCls} />
            </Field>
            <Field label="Per-run cap" hint="Max submits per batch">
              <input type="number" min={1} max={20} value={cfg.perRunCap}
                     onChange={(e) => set({ perRunCap: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className={numCls} />
            </Field>
            <Field label="Throttle (sec)" hint="Pause between applies">
              <input type="number" min={0} max={300} value={cfg.throttleSec}
                     onChange={(e) => set({ throttleSec: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })} className={numCls} />
            </Field>
            <Field label="Interval (min)" hint="Continuous: gap between batches">
              <input type="number" min={5} max={240} value={cfg.intervalMin}
                     onChange={(e) => set({ intervalMin: Math.max(5, Math.min(240, Number(e.target.value) || 5)) })} className={numCls} />
            </Field>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground cursor-pointer">
              <input type="checkbox" checked={cfg.autoTailor} onChange={(e) => set({ autoTailor: e.target.checked })} />
              Tailor résumé per job (Axon)
            </label>
            <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground cursor-pointer">
              <input type="checkbox" checked={cfg.discoverFirst} onChange={(e) => set({ discoverFirst: e.target.checked })} />
              Search for new postings each run
            </label>
          </div>

          {lastSummary && (
            <div className="text-[11.5px] text-muted-foreground">
              Last run: <span className="text-emerald-400">{lastSummary.submitted} submitted</span>
              {lastSummary.needsHuman > 0 && <>, <span className="text-amber-400">{lastSummary.needsHuman} need you</span></>}
              {lastSummary.errors > 0 && <>, <span className="text-red-400">{lastSummary.errors} errors</span></>}
              {" · "}{lastSummary.reason.replace("-", " ")}
            </div>
          )}

          {/* log */}
          <div className="rounded-md border border-border bg-background overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Activity log</span>
              {runLog.length > 0 && (
                <button onClick={clearLog} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </div>
            <div className="max-h-[240px] overflow-y-auto px-3 py-2 space-y-1 font-mono text-[11px]">
              {runLog.length === 0 ? (
                <p className="text-muted-foreground/60">No activity yet. Hit “Run once” to test, or “Start autopilot” to let it run.</p>
              ) : (
                runLog.map((e) => (
                  <div key={e.id} className="flex gap-2">
                    <span className="text-muted-foreground/50 shrink-0">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                    <span className={`${LEVEL_COLOR[e.level]} [overflow-wrap:anywhere]`}>{e.msg}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="text-[10.5px] text-muted-foreground">
            Autopilot runs only while this app is open. It applies through your apply-worker (Lever/Greenhouse/Ashby);
            captcha'd or unusual forms are flagged “needs you” and left for you to finish. The daily cap is enforced across restarts.
          </p>
        </div>
      )}
    </div>
  );
}

export default AutopilotPanel;
