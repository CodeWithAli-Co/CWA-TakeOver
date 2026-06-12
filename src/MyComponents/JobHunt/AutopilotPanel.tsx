/**
 * AutopilotPanel — the unattended-apply cockpit, rebuilt in the Takeover
 * editorial system (surface elevation, red-dot section labels, Newsreader /
 * Hanken / JetBrains type). Lives in its own tab. The useAutopilot engine is
 * lifted to the page and passed in as `ap` so switching tabs never tears down
 * a running batch.
 */
import { type ReactNode } from "react";
import { Play, Square, Loader2, Trash2, Gauge, CalendarClock, Bot } from "lucide-react";
import { useJobHunt, type AutopilotConfig, type LogLevel } from "./jobHuntStore";
import type { BatchSummary } from "@/JobHunt/autopilot";

const FONT_DISPLAY = 'Newsreader, Georgia, serif';
const FONT_UI = '"Hanken Grotesk", Inter, system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
const ACCENT = "#e0503c";
const LEVEL: Record<LogLevel, string> = { info: "text-fg-subtle", ok: "text-emerald-400", warn: "text-amber-400", error: "text-red-400" };

export interface AutopilotApi {
  running: boolean;
  continuous: boolean;
  lastSummary: BatchSummary | null;
  runNow: () => void;
  startContinuous: () => void;
  stop: () => void;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
      <span className="text-[10px] uppercase tracking-[0.2em] text-fg-subtle" style={{ fontFamily: FONT_MONO }}>{children}</span>
    </div>
  );
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[10px] uppercase tracking-wider text-fg-subtle" style={{ fontFamily: FONT_MONO }}>{label}</span>
      {children}
      {hint && <span className="text-[10px] text-fg-faint" style={{ fontFamily: FONT_UI }}>{hint}</span>}
    </label>
  );
}
const inputCls = "w-full bg-background border border-line rounded-md px-2.5 py-1.5 text-[13px] text-foreground focus:outline-none focus:border-foreground/30";

export function AutopilotPanel({ ap }: { ap: AutopilotApi }) {
  const cfg = useJobHunt((s) => s.autopilot);
  const setAutopilot = useJobHunt((s) => s.setAutopilot);
  const runLog = useJobHunt((s) => s.runLog);
  const clearLog = useJobHunt((s) => s.clearLog);
  const applied = useJobHunt((s) => s.applied);
  const appliedTodayFn = useJobHunt((s) => s.appliedToday);
  const profile = useJobHunt((s) => s.profile);
  const masterResume = useJobHunt((s) => s.masterResume);
  void applied;

  const { running, continuous, lastSummary, runNow, startContinuous, stop } = ap;
  const done = appliedTodayFn();
  const pct = Math.min(100, Math.round((done / Math.max(1, cfg.dailyCap)) * 100));
  const ready = !!profile.email && !!masterResume.trim();
  const set = (patch: Partial<AutopilotConfig>) => setAutopilot(patch);

  return (
    <div className="bg-surface border border-line rounded-xl p-5 space-y-5" style={{ fontFamily: FONT_UI }}>
      {/* header */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2.5">
          <Bot size={18} className={continuous ? "text-emerald-400" : "text-foreground"} />
          <h2 className="text-[19px] text-foreground" style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }}>Autopilot</h2>
        </div>

        <div className="flex items-center gap-2.5 min-w-[180px]">
          <Gauge size={14} className="text-fg-subtle" />
          <div className="h-1.5 w-28 rounded-full bg-line overflow-hidden">
            <div className="h-full" style={{ width: `${pct}%`, background: ACCENT }} />
          </div>
          <span className="text-[11px] tabular-nums text-fg-muted" style={{ fontFamily: FONT_MONO }}>{done}/{cfg.dailyCap} today</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {continuous && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400" style={{ fontFamily: FONT_MONO }}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> RUNNING
            </span>
          )}
          {continuous ? (
            <button onClick={stop} className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-red-600/40 text-[12px] text-red-300 hover:bg-red-500/10" style={{ fontFamily: FONT_UI }}>
              <Square size={12} /> Stop
            </button>
          ) : (
            <>
              <button onClick={runNow} disabled={running || !ready}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md border border-line text-[12px] text-foreground disabled:opacity-50 hover:border-foreground/30" style={{ fontFamily: FONT_UI }}>
                {running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}{running ? "Running…" : "Run once"}
              </button>
              <button onClick={startContinuous} disabled={running || !ready}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50 hover:opacity-90" style={{ fontFamily: FONT_UI }}>
                <Bot size={13} /> Start autopilot
              </button>
            </>
          )}
        </div>

        {!ready && <p className="w-full text-[11.5px] text-amber-400/80" style={{ fontFamily: FONT_UI }}>Add your master résumé and Apply profile before autopilot can run.</p>}
      </div>

      {/* run config */}
      <div className="bg-surface-2 border border-line rounded-lg p-4 space-y-4">
        <SectionLabel>Run config</SectionLabel>
        <Field label="Roles to search for">
          <textarea value={cfg.query} onChange={(e) => set({ query: e.target.value })} rows={2}
            placeholder="e.g. 'remote senior React/TS, $130k+, fintech or dev-tools, US time zones'"
            className={`${inputCls} resize-none`} />
        </Field>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5">
          <Field label="Source">
            <div className="flex items-center gap-1.5">
              {(["boards", "axon"] as const).map((sv) => (
                <button key={sv} onClick={() => set({ source: sv })}
                  className={`h-9 px-2.5 rounded-md text-[11.5px] border transition-colors ${cfg.source === sv ? "border-foreground/40 bg-foreground/5 text-foreground" : "border-line text-fg-subtle hover:text-foreground"}`}
                  style={{ fontFamily: FONT_UI }}>
                  {sv === "boards" ? "Job boards" : "Axon web"}
                </button>
              ))}
            </div>
          </Field>
          <Field label={`Min match — ${cfg.minMatch}%`} hint="Only apply at/above this score">
            <input type="range" min={40} max={95} step={5} value={cfg.minMatch} onChange={(e) => set({ minMatch: Number(e.target.value) })} className="accent-[#e0503c] h-9" />
          </Field>
          <Field label="Daily cap" hint="Hard ceiling per day">
            <input type="number" min={1} max={40} value={cfg.dailyCap} onChange={(e) => set({ dailyCap: Math.max(1, Math.min(40, Number(e.target.value) || 1)) })} className={inputCls} style={{ fontFamily: FONT_MONO }} />
          </Field>
          <Field label="Per-run cap" hint="Max submits per batch">
            <input type="number" min={1} max={20} value={cfg.perRunCap} onChange={(e) => set({ perRunCap: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} className={inputCls} style={{ fontFamily: FONT_MONO }} />
          </Field>
          <Field label="Throttle (sec)" hint="Pause between applies">
            <input type="number" min={0} max={300} value={cfg.throttleSec} onChange={(e) => set({ throttleSec: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })} className={inputCls} style={{ fontFamily: FONT_MONO }} />
          </Field>
          <Field label="Interval (min)" hint="Continuous: gap between batches">
            <input type="number" min={5} max={240} value={cfg.intervalMin} onChange={(e) => set({ intervalMin: Math.max(5, Math.min(240, Number(e.target.value) || 5)) })} className={inputCls} style={{ fontFamily: FONT_MONO }} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground cursor-pointer">
            <input type="checkbox" checked={cfg.autoTailor} onChange={(e) => set({ autoTailor: e.target.checked })} /> Tailor résumé per job (Axon)
          </label>
          <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground cursor-pointer">
            <input type="checkbox" checked={cfg.discoverFirst} onChange={(e) => set({ discoverFirst: e.target.checked })} /> Search for new postings each run
          </label>
        </div>
      </div>

      {/* schedule */}
      <div className="bg-surface-2 border border-line rounded-lg p-4 space-y-3">
        <SectionLabel>Schedule</SectionLabel>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground cursor-pointer">
            <input type="checkbox" checked={cfg.scheduleEnabled} onChange={(e) => set({ scheduleEnabled: e.target.checked })} />
            <CalendarClock size={14} className="text-fg-subtle" /> Auto-start daily at
          </label>
          <input type="time" value={cfg.scheduleTime} onChange={(e) => set({ scheduleTime: e.target.value })} disabled={!cfg.scheduleEnabled}
            className={`${inputCls} w-auto disabled:opacity-50`} style={{ fontFamily: FONT_MONO }} />
          <span className="text-[11px] text-fg-subtle" style={{ fontFamily: FONT_UI }}>fires once/day while the app is open</span>
        </div>
      </div>

      {lastSummary && (
        <div className="text-[11.5px] text-fg-subtle" style={{ fontFamily: FONT_UI }}>
          Last run: <span className="text-emerald-400">{lastSummary.submitted} submitted</span>
          {lastSummary.needsHuman > 0 && <>, <span className="text-amber-400">{lastSummary.needsHuman} need you</span></>}
          {lastSummary.errors > 0 && <>, <span className="text-red-400">{lastSummary.errors} errors</span></>}
          {" · "}{lastSummary.reason.replace("-", " ")}
        </div>
      )}

      {/* activity log */}
      <div className="bg-surface-2 border border-line rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <SectionLabel>Activity log</SectionLabel>
          {runLog.length > 0 && (
            <button onClick={clearLog} className="inline-flex items-center gap-1 text-[11px] text-fg-subtle hover:text-foreground" style={{ fontFamily: FONT_UI }}>
              <Trash2 size={11} /> Clear
            </button>
          )}
        </div>
        <div className="max-h-[300px] overflow-y-auto px-4 py-3 space-y-1.5 text-[11px]" style={{ fontFamily: FONT_MONO }}>
          {runLog.length === 0 ? (
            <p className="text-fg-faint">No activity yet. Hit “Run once” to test, or “Start autopilot” to let it run.</p>
          ) : (
            runLog.map((e) => (
              <div key={e.id} className="flex gap-2">
                <span className="text-fg-faint shrink-0">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span className={`${LEVEL[e.level]} [overflow-wrap:anywhere]`}>{e.msg}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <p className="text-[10.5px] text-fg-faint" style={{ fontFamily: FONT_UI }}>
        Autopilot runs only while this app is open. It applies through your apply-worker (Lever/Greenhouse/Ashby); captcha'd or unusual forms are flagged “needs you” and left for you to finish. The daily cap is enforced across restarts.
      </p>
    </div>
  );
}

export default AutopilotPanel;
