import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft,
  SkipForward, Target, Calendar, Network, BarChart3,
  Layers, Award, Clock,
  X, GraduationCap,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/shadcnComponents/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  PHASES, ALL_WEEKS, ALL_TASKS,
  Phase, Month, Week, Task,
  DAY_ORDER, DAY_LABELS, DAY_FULL_LABELS,
  TASK_TYPE_CONFIG, PHASE_CONFIG, CHECKPOINTS,
  getPhaseForWeek, getMonthForWeek,
  type DayOfWeek,
} from "./trainingData";

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initial;
    } catch { return initial; }
  });
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(resolved)); } catch {}
      return resolved;
    });
  }, [key]);
  return [value, set] as const;
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE GRAPH
// ─────────────────────────────────────────────────────────────────────────────
const WEEK_STEP   = 74;  // px between week node centres vertically
const GRAPH_PAD   = 52;
const COL_P       = 100; // phase  column centre-x
const COL_M       = 290; // month  column centre-x
const COL_W       = 480; // week   column centre-x
const NODE_P_W    = 160; const NODE_P_H = 54;
const NODE_M_W    = 148; const NODE_M_H = 46;
const NODE_W_W    = 136; const NODE_W_H = 40;

interface NodePos { x: number; y: number; w: number; h: number; }

function weekY(idx: number) { return GRAPH_PAD + idx * WEEK_STEP; }

function buildLayout() {
  const weekNodes: { week: Week; pos: NodePos; idx: number }[] = [];
  const monthNodes: { month: Month; pos: NodePos }[] = [];
  const phaseNodes: { phase: Phase; pos: NodePos }[] = [];

  let wi = 0;
  for (const phase of PHASES) {
    const phaseWeekIdxStart = wi;
    for (const month of phase.months) {
      const monthWeekIdxStart = wi;
      for (const week of month.weeks) {
        weekNodes.push({ week, idx: wi, pos: { x: COL_W - NODE_W_W / 2, y: weekY(wi), w: NODE_W_W, h: NODE_W_H } });
        wi++;
      }
      const monthWeekIdxEnd = wi - 1;
      const mcy = (weekY(monthWeekIdxStart) + weekY(monthWeekIdxEnd) + NODE_W_H) / 2 - NODE_M_H / 2;
      monthNodes.push({ month, pos: { x: COL_M - NODE_M_W / 2, y: mcy, w: NODE_M_W, h: NODE_M_H } });
    }
    const phaseWeekIdxEnd = wi - 1;
    const pcy = (weekY(phaseWeekIdxStart) + weekY(phaseWeekIdxEnd) + NODE_W_H) / 2 - NODE_P_H / 2;
    phaseNodes.push({ phase, pos: { x: COL_P - NODE_P_W / 2, y: pcy, w: NODE_P_W, h: NODE_P_H } });
  }

  const totalH = GRAPH_PAD + wi * WEEK_STEP + 40;
  return { weekNodes, monthNodes, phaseNodes, totalH };
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

interface NodeGraphProps {
  completedTasks: Record<string, boolean>;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}

function NodeGraph({ completedTasks, selectedNodeId, onSelectNode }: NodeGraphProps) {
  const { weekNodes, monthNodes, phaseNodes, totalH } = useMemo(buildLayout, []);

  const weekCompletionPct = useCallback((week: Week) => {
    const total = week.tasks.length;
    if (total === 0) return 0;
    const done = week.tasks.filter((t) => completedTasks[t.id]).length;
    return Math.round((done / total) * 100);
  }, [completedTasks]);

  const monthCompletionPct = useCallback((month: Month) => {
    const tasks = month.weeks.flatMap((w) => w.tasks);
    if (tasks.length === 0) return 0;
    return Math.round(tasks.filter((t) => completedTasks[t.id]).length / tasks.length * 100);
  }, [completedTasks]);

  // Determine which node IDs are "connected" to selected
  const connectedIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const set = new Set<string>();
    // Phase selected → all its months + weeks
    const selPhase = PHASES.find((p) => p.id === selectedNodeId);
    if (selPhase) {
      selPhase.months.forEach((m) => {
        set.add(m.id);
        m.weeks.forEach((w) => set.add(w.id));
      });
    }
    // Month selected → its phase + weeks
    const selMonth = PHASES.flatMap((p) => p.months).find((m) => m.id === selectedNodeId);
    if (selMonth) {
      set.add(selMonth.phaseId);
      selMonth.weeks.forEach((w) => set.add(w.id));
    }
    // Week selected → its month + phase
    const selWeek = ALL_WEEKS.find((w) => w.id === selectedNodeId);
    if (selWeek) {
      set.add(selWeek.monthId);
      set.add(selWeek.phaseId);
    }
    return set;
  }, [selectedNodeId]);

  const nodeOpacity = (id: string) => {
    if (!selectedNodeId) return 1;
    if (id === selectedNodeId) return 1;
    return connectedIds.has(id) ? 0.7 : 0.22;
  };

  return (
    <div style={{ position: "relative", width: 620, height: totalH, flexShrink: 0 }}>
      {/* SVG layer — edges */}
      <svg
        style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
        width={620}
        height={totalH}
      >
        {/* Phase → Month edges */}
        {phaseNodes.map(({ phase, pos: pp }) => {
          const cfg = PHASE_CONFIG[phase.id];
          return monthNodes
            .filter((mn) => mn.month.phaseId === phase.id)
            .map(({ month, pos: mp }) => {
              const x1 = pp.x + pp.w;
              const y1 = pp.y + pp.h / 2;
              const x2 = mp.x;
              const y2 = mp.y + mp.h / 2;
              const dimmed = selectedNodeId && !connectedIds.has(month.id) && selectedNodeId !== phase.id;
              return (
                <path
                  key={`pm-${phase.id}-${month.id}`}
                  d={bezier(x1, y1, x2, y2)}
                  stroke={cfg.line}
                  strokeWidth={dimmed ? 1 : 1.8}
                  fill="none"
                  opacity={dimmed ? 0.12 : 0.55}
                />
              );
            });
        })}
        {/* Month → Week edges */}
        {monthNodes.map(({ month, pos: mp }) => {
          const cfg = PHASE_CONFIG[month.phaseId];
          return weekNodes
            .filter((wn) => wn.week.monthId === month.id)
            .map(({ week, pos: wp }) => {
              const x1 = mp.x + mp.w;
              const y1 = mp.y + mp.h / 2;
              const x2 = wp.x;
              const y2 = wp.y + wp.h / 2;
              const dimmed = selectedNodeId && !connectedIds.has(week.id) && selectedNodeId !== month.id;
              return (
                <path
                  key={`mw-${month.id}-${week.id}`}
                  d={bezier(x1, y1, x2, y2)}
                  stroke={cfg.line}
                  strokeWidth={dimmed ? 1 : 1.5}
                  fill="none"
                  opacity={dimmed ? 0.1 : 0.4}
                />
              );
            });
        })}
      </svg>

      {/* Phase nodes */}
      {phaseNodes.map(({ phase, pos }) => {
        const cfg = PHASE_CONFIG[phase.id];
        const isSelected = selectedNodeId === phase.id;
        const pct = Math.round(
          PHASES.find((p) => p.id === phase.id)!.months
            .flatMap((m) => m.weeks.flatMap((w) => w.tasks))
            .filter((t) => completedTasks[t.id]).length /
          Math.max(1, PHASES.find((p) => p.id === phase.id)!.months
            .flatMap((m) => m.weeks.flatMap((w) => w.tasks)).length) * 100
        );
        return (
          <motion.div
            key={phase.id}
            onClick={() => onSelectNode(isSelected ? null : phase.id)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.w,
              height: pos.h,
              opacity: nodeOpacity(phase.id),
              cursor: "pointer",
              transition: "opacity 0.2s",
              zIndex: 10,
            }}
            className={`rounded border-2 flex flex-col justify-center px-3 select-none ${cfg.bg} ${
              isSelected ? `${cfg.border} shadow-lg` : "border-zinc-700/50"
            }`}
          >
            <div className={`text-[11px] font-bold tracking-widest uppercase ${cfg.text} mb-0.5`}>
              Phase {phase.phaseNumber}
            </div>
            <div className="text-amber-50 text-[12px] font-semibold leading-tight truncate">
              {phase.title}
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700`}
                style={{ width: `${pct}%`, background: cfg.line }}
              />
            </div>
            {isSelected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute -right-2 top-1/2 -translate-y-1/2"
              >
                <div
                  className="w-3 h-3 rotate-45 border-r-2 border-t-2"
                  style={{ borderColor: cfg.line }}
                />
              </motion.div>
            )}
          </motion.div>
        );
      })}

      {/* Month nodes */}
      {monthNodes.map(({ month, pos }) => {
        const cfg = PHASE_CONFIG[month.phaseId];
        const isSelected = selectedNodeId === month.id;
        const pct = monthCompletionPct(month);
        return (
          <motion.div
            key={month.id}
            onClick={() => onSelectNode(isSelected ? null : month.id)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.w,
              height: pos.h,
              opacity: nodeOpacity(month.id),
              cursor: "pointer",
              transition: "opacity 0.2s",
              zIndex: 10,
            }}
            className={`rounded border flex flex-col justify-center px-2.5 select-none ${
              isSelected ? `${cfg.bg} ${cfg.border}` : "bg-zinc-900/70 border-zinc-700/40"
            }`}
          >
            <div className={`text-[10px] font-semibold ${cfg.muted} uppercase tracking-widest`}>
              Month {month.monthNumber}
            </div>
            <div className="text-amber-50/90 text-[11px] leading-tight truncate">
              {month.title}
            </div>
            <div className="mt-1 h-0.5 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: cfg.line }}
              />
            </div>
          </motion.div>
        );
      })}

      {/* Week nodes */}
      {weekNodes.map(({ week, pos }) => {
        const cfg = PHASE_CONFIG[week.phaseId];
        const isSelected = selectedNodeId === week.id;
        const pct = weekCompletionPct(week);
        const done = week.tasks.filter((t) => completedTasks[t.id]).length;
        const total = week.tasks.length;
        return (
          <motion.div
            key={week.id}
            onClick={() => onSelectNode(isSelected ? null : week.id)}
            whileHover={{ scale: 1.04, x: 2 }}
            whileTap={{ scale: 0.96 }}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              width: pos.w,
              height: pos.h,
              opacity: nodeOpacity(week.id),
              cursor: "pointer",
              transition: "opacity 0.2s",
              zIndex: 10,
            }}
            className={`rounded flex items-center px-2.5 gap-2 select-none border ${
              isSelected
                ? `${cfg.bg} ${cfg.border} shadow-md`
                : pct === 100
                ? "bg-zinc-900/50 border-zinc-600/50"
                : "bg-zinc-950/80 border-zinc-800/50"
            }`}
          >
            <div
              className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: pct === 100 ? "#16a34a" : cfg.nodeFill, border: `1.5px solid ${cfg.line}` }}
            >
              {pct === 100 ? "✓" : week.weekNumber}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-amber-50/85 text-[10.5px] leading-tight truncate font-medium">
                {week.title}
              </div>
              <div className="text-zinc-500 text-[9px]">
                {done}/{total} tasks
              </div>
            </div>
            <div
              className="w-1.5 h-full rounded-r flex-shrink-0"
              style={{
                background: `linear-gradient(to top, ${cfg.line} ${pct}%, transparent ${pct}%)`,
                opacity: 0.7,
              }}
            />
          </motion.div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL PANEL
// ─────────────────────────────────────────────────────────────────────────────
interface DetailPanelProps {
  selectedNodeId: string | null;
  completedTasks: Record<string, boolean>;
  deferredTasks: Record<string, DayOfWeek>;
  onToggleTask: (id: string) => void;
  onDeferTask: (taskId: string, week: Week) => void;
  onClose: () => void;
  onJumpToWeek: (weekNumber: number) => void;
}

function DetailPanel({
  selectedNodeId, completedTasks, deferredTasks,
  onToggleTask, onDeferTask, onClose, onJumpToWeek,
}: DetailPanelProps) {
  if (!selectedNodeId) return null;

  const selPhase = PHASES.find((p) => p.id === selectedNodeId);
  const selMonth = PHASES.flatMap((p) => p.months).find((m) => m.id === selectedNodeId);
  const selWeek = ALL_WEEKS.find((w) => w.id === selectedNodeId);

  if (selPhase) {
    const cfg = PHASE_CONFIG[selPhase.id];
    const allTasks = selPhase.months.flatMap((m) => m.weeks.flatMap((w) => w.tasks));
    const done = allTasks.filter((t) => completedTasks[t.id]).length;
    return (
      <PanelShell title={selPhase.title} subtitle={`Phase ${selPhase.phaseNumber} · ${selPhase.duration}`} cfg={cfg} onClose={onClose}>
        <p className="text-amber-50/60 text-sm leading-relaxed mb-4">{selPhase.goal}</p>
        <div className="flex gap-3 mb-4">
          <StatChip label="Months" value={String(selPhase.months.length)} cfg={cfg} />
          <StatChip label="Weeks" value={String(selPhase.months.reduce((s, m) => s + m.weeks.length, 0))} cfg={cfg} />
          <StatChip label="Tasks" value={`${done}/${allTasks.length}`} cfg={cfg} />
        </div>
        <ProgressBar pct={Math.round(done / Math.max(1, allTasks.length) * 100)} cfg={cfg} />
        <div className="mt-4 space-y-2">
          {selPhase.months.map((m) => {
            const mTasks = m.weeks.flatMap((w) => w.tasks);
            const mDone = mTasks.filter((t) => completedTasks[t.id]).length;
            return (
              <div key={m.id} className={`rounded border p-2.5 ${cfg.bg} ${cfg.border}`}>
                <div className="flex justify-between items-center">
                  <span className="text-amber-50/90 text-sm font-medium">{m.title}</span>
                  <span className={`text-xs ${cfg.text}`}>{mDone}/{mTasks.length}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 rounded bg-zinc-900/60 border border-zinc-800">
          <p className="text-amber-50/50 text-xs italic">{selPhase.subtitle}</p>
        </div>
      </PanelShell>
    );
  }

  if (selMonth) {
    const phase = PHASES.find((p) => p.id === selMonth.phaseId)!;
    const cfg = PHASE_CONFIG[phase.id];
    const allTasks = selMonth.weeks.flatMap((w) => w.tasks);
    const done = allTasks.filter((t) => completedTasks[t.id]).length;
    return (
      <PanelShell title={selMonth.title} subtitle={`Month ${selMonth.monthNumber} · ${phase.title}`} cfg={cfg} onClose={onClose}>
        <div className="flex gap-3 mb-4">
          <StatChip label="Weeks" value={String(selMonth.weeks.length)} cfg={cfg} />
          <StatChip label="Tasks" value={`${done}/${allTasks.length}`} cfg={cfg} />
        </div>
        <ProgressBar pct={Math.round(done / Math.max(1, allTasks.length) * 100)} cfg={cfg} />
        <div className="mt-4 space-y-2">
          {selMonth.weeks.map((w) => {
            const wDone = w.tasks.filter((t) => completedTasks[t.id]).length;
            const pct = Math.round(wDone / Math.max(1, w.tasks.length) * 100);
            return (
              <button
                key={w.id}
                onClick={() => onJumpToWeek(w.weekNumber)}
                className={`w-full text-left rounded border p-2.5 transition-all hover:border-zinc-500 ${cfg.bg} ${cfg.border}`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-amber-50/90 text-sm font-medium">Week {w.weekNumber}: {w.title}</span>
                  <span className={`text-xs ${cfg.text}`}>{pct}%</span>
                </div>
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: PHASE_CONFIG[w.phaseId].line }} />
                </div>
              </button>
            );
          })}
        </div>
      </PanelShell>
    );
  }

  if (selWeek) {
    const phase = getPhaseForWeek(selWeek);
    const month = getMonthForWeek(selWeek);
    const cfg = PHASE_CONFIG[phase.id];
    const done = selWeek.tasks.filter((t) => completedTasks[t.id]).length;
    return (
      <PanelShell
        title={`Week ${selWeek.weekNumber}: ${selWeek.title}`}
        subtitle={`${phase.title} · ${month.title}`}
        cfg={cfg}
        onClose={onClose}
      >
        <div className="flex gap-2 flex-wrap mb-3">
          {selWeek.topics.map((t) => (
            <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text} bg-black/20`}>{t}</span>
          ))}
        </div>
        <ProgressBar pct={Math.round(done / Math.max(1, selWeek.tasks.length) * 100)} cfg={cfg} />
        <div className="text-xs text-zinc-500 mb-3 mt-1">{done}/{selWeek.tasks.length} tasks complete</div>

        <div className="space-y-2">
          {selWeek.tasks.map((task) => {
            const isComplete = completedTasks[task.id];
            const isDeferred = deferredTasks[task.id] !== undefined;
            const taskCfg = TASK_TYPE_CONFIG[task.type];
            return (
              <motion.div
                key={task.id}
                layout
                className={`rounded border p-2.5 flex gap-2.5 items-start transition-all ${
                  isComplete
                    ? "bg-zinc-900/30 border-zinc-800/40 opacity-50"
                    : `${taskCfg.bg}`
                }`}
              >
                <button
                  onClick={() => onToggleTask(task.id)}
                  className="mt-0.5 flex-shrink-0 text-zinc-400 hover:text-green-400 transition-colors"
                >
                  {isComplete ? (
                    <CheckCircle2 size={16} className="text-green-500" />
                  ) : (
                    <Circle size={16} />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-[12px] leading-snug ${isComplete ? "line-through text-zinc-500" : "text-amber-50/90"}`}>
                    {task.text}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] ${taskCfg.color}`}>{taskCfg.icon} {taskCfg.label}</span>
                    <span className="text-zinc-600 text-[10px]">· {task.hours}h</span>
                    <span className="text-zinc-600 text-[10px]">· {DAY_FULL_LABELS[task.day]}</span>
                    {isDeferred && <span className="text-amber-500 text-[10px]">↩ deferred to {DAY_FULL_LABELS[deferredTasks[task.id]]}</span>}
                  </div>
                </div>
                {!isComplete && (
                  <button
                    onClick={() => onDeferTask(task.id, selWeek)}
                    title="Defer to next day"
                    className="flex-shrink-0 text-zinc-600 hover:text-amber-400 transition-colors mt-0.5"
                  >
                    <SkipForward size={13} />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 border-t border-zinc-800 pt-3">
          <p className="text-zinc-500 text-xs mb-2 font-semibold uppercase tracking-widest">Daily Schedule</p>
          <div className="space-y-1.5">
            {selWeek.dailySchedule.map((d) => (
              <div key={d.day} className="flex gap-2 items-start">
                <span className="text-zinc-500 text-[10px] w-8 pt-0.5">{DAY_LABELS[d.day]}</span>
                <span className="text-amber-50/70 text-[11px] flex-1 leading-snug">{d.focus}</span>
                <span className="text-zinc-600 text-[10px] flex-shrink-0">{d.hours}h</span>
              </div>
            ))}
          </div>
        </div>
      </PanelShell>
    );
  }

  return null;
}

// Small shared components for the panel
function PanelShell({
  title, subtitle, cfg, onClose, children,
}: {
  title: string; subtitle: string; cfg: any; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="h-full flex flex-col"
    >
      <div className={`px-4 py-3 border-b ${cfg.border} flex items-start justify-between gap-2`}>
        <div>
          <h3 className="text-amber-50 font-semibold text-sm leading-tight">{title}</h3>
          <p className={`text-xs mt-0.5 ${cfg.text}`}>{subtitle}</p>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-amber-50 mt-0.5 flex-shrink-0">
          <X size={15} />
        </button>
      </div>
      <ScrollArea className="flex-1 p-4">{children}</ScrollArea>
    </motion.div>
  );
}

function StatChip({ label, value, cfg }: { label: string; value: string; cfg: any }) {
  return (
    <div className={`rounded px-2.5 py-1.5 border text-center flex-1 ${cfg.bg} ${cfg.border}`}>
      <div className={`text-base font-bold ${cfg.text}`}>{value}</div>
      <div className="text-zinc-500 text-[10px]">{label}</div>
    </div>
  );
}

function ProgressBar({ pct, cfg }: { pct: number; cfg: any }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-500">Progress</span>
        <span className={cfg.text}>{pct}%</span>
      </div>
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: cfg.line }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WEEK SCHEDULE VIEW
// ─────────────────────────────────────────────────────────────────────────────
interface WeekScheduleProps {
  week: Week;
  completedTasks: Record<string, boolean>;
  deferredTasks: Record<string, DayOfWeek>;
  onToggleTask: (id: string) => void;
  onDeferTask: (taskId: string, week: Week) => void;
}

function WeekSchedule({ week, completedTasks, deferredTasks, onToggleTask, onDeferTask }: WeekScheduleProps) {
  const cfg = PHASE_CONFIG[week.phaseId];
  const phase = getPhaseForWeek(week);

  const tasksByDay = useMemo(() => {
    const map: Record<DayOfWeek, Task[]> = {
      monday: [], tuesday: [], wednesday: [], thursday: [],
      friday: [], saturday: [], sunday: [],
    };
    week.tasks.forEach((t) => {
      const effectiveDay = deferredTasks[t.id] ?? t.day;
      if (!completedTasks[t.id]) map[effectiveDay].push(t);
    });
    // Completed tasks stay on original day (greyed)
    week.tasks.filter((t) => completedTasks[t.id]).forEach((t) => {
      map[t.day].push(t);
    });
    return map;
  }, [week, completedTasks, deferredTasks]);

  return (
    <div className="space-y-4">
      {/* Week header */}
      <div className={`rounded-lg border p-4 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white border-2"
            style={{ background: cfg.nodeFill, borderColor: cfg.line }}
          >
            {week.weekNumber}
          </div>
          <div>
            <h2 className="text-amber-50 font-semibold text-lg">{week.title}</h2>
            <p className={`text-sm ${cfg.text}`}>{phase.title} · {getMonthForWeek(week).title}</p>
          </div>
          <div className="ml-auto text-right">
            <div className={`text-2xl font-bold ${cfg.text}`}>
              {Math.round(week.tasks.filter((t) => completedTasks[t.id]).length / Math.max(1, week.tasks.length) * 100)}%
            </div>
            <div className="text-zinc-500 text-xs">complete</div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          {week.topics.map((t) => (
            <span key={t} className={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.text} bg-black/30`}>{t}</span>
          ))}
        </div>
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {/* Weekdays */}
        {(["monday", "tuesday", "wednesday", "thursday"] as DayOfWeek[]).map((day) => {
          const sched = week.dailySchedule.find((d) => d.day === day);
          const tasks = tasksByDay[day];
          return (
            <DayCard
              key={day}
              day={day}
              sched={sched}
              tasks={tasks}
              cfg={cfg}
              completedTasks={completedTasks}
              deferredTasks={deferredTasks}
              week={week}
              onToggleTask={onToggleTask}
              onDeferTask={onDeferTask}
            />
          );
        })}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(["friday", "saturday", "sunday"] as DayOfWeek[]).map((day) => {
          const sched = week.dailySchedule.find((d) => d.day === day);
          const tasks = tasksByDay[day];
          return (
            <DayCard
              key={day}
              day={day}
              sched={sched}
              tasks={tasks}
              cfg={cfg}
              completedTasks={completedTasks}
              deferredTasks={deferredTasks}
              week={week}
              onToggleTask={onToggleTask}
              onDeferTask={onDeferTask}
            />
          );
        })}
      </div>
    </div>
  );
}

function DayCard({
  day, sched, tasks, completedTasks, deferredTasks, week, onToggleTask, onDeferTask,
}: {
  day: DayOfWeek;
  sched: any;
  tasks: Task[];
  cfg?: any;
  completedTasks: Record<string, boolean>;
  deferredTasks: Record<string, DayOfWeek>;
  week: Week;
  onToggleTask: (id: string) => void;
  onDeferTask: (taskId: string, week: Week) => void;
}) {
  const isWeekend = day === "saturday" || day === "sunday";
  const pendingTasks = tasks.filter((t) => !completedTasks[t.id]);
  const doneTasks = tasks.filter((t) => completedTasks[t.id]);

  return (
    <div
      className={`rounded-lg border flex flex-col ${
        isWeekend ? "bg-zinc-900/50 border-zinc-700/40" : "bg-zinc-950/80 border-zinc-800/40"
      }`}
    >
      {/* Day header */}
      <div className={`px-3 py-2 border-b border-zinc-800/50 flex items-center justify-between`}>
        <div>
          <span className="text-amber-50 font-semibold text-sm">{DAY_FULL_LABELS[day]}</span>
          {isWeekend && (
            <span className="ml-2 text-[10px] text-zinc-500 italic">
              {day === "saturday" ? "Sprint" : "Review + Plan"}
            </span>
          )}
        </div>
        {sched && (
          <div className="flex items-center gap-1 text-zinc-500">
            <Clock size={10} />
            <span className="text-[10px]">{sched.hours}h</span>
          </div>
        )}
      </div>

      {/* Focus */}
      {sched && (
        <div className="px-3 py-1.5 border-b border-zinc-800/30">
          <p className="text-zinc-400 text-[11px] leading-snug">{sched.focus}</p>
        </div>
      )}

      {/* Tasks */}
      <div className="flex-1 p-2 space-y-1.5">
        {pendingTasks.map((task) => {
          const taskCfg = TASK_TYPE_CONFIG[task.type];
          const isDeferred = deferredTasks[task.id] !== undefined;
          return (
            <div
              key={task.id}
              className={`rounded border p-2 flex gap-2 items-start ${taskCfg.bg}`}
            >
              <button
                onClick={() => onToggleTask(task.id)}
                className="mt-0.5 flex-shrink-0 text-zinc-500 hover:text-green-400 transition-colors"
              >
                <Circle size={14} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-amber-50/85 text-[11px] leading-snug">{task.text}</p>
                <div className="flex gap-1.5 mt-0.5 flex-wrap">
                  <span className={`text-[9px] ${taskCfg.color}`}>{taskCfg.icon} {taskCfg.label}</span>
                  <span className="text-zinc-600 text-[9px]">{task.hours}h</span>
                  {isDeferred && (
                    <span className="text-amber-500 text-[9px]">↩ deferred</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDeferTask(task.id, week)}
                title="Push to next day"
                className="text-zinc-700 hover:text-amber-500 transition-colors flex-shrink-0"
              >
                <SkipForward size={11} />
              </button>
            </div>
          );
        })}
        {doneTasks.map((task) => (
          <div key={task.id} className="rounded border border-zinc-800/30 p-2 flex gap-2 items-start opacity-40">
            <button onClick={() => onToggleTask(task.id)} className="mt-0.5 flex-shrink-0">
              <CheckCircle2 size={14} className="text-green-500" />
            </button>
            <p className="text-zinc-500 text-[11px] line-through leading-snug">{task.text}</p>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-zinc-700 text-[11px] italic px-1">No tasks scheduled</p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TASK BOARD (Kanban)
// ─────────────────────────────────────────────────────────────────────────────
interface TaskBoardProps {
  week: Week;
  completedTasks: Record<string, boolean>;
  deferredTasks: Record<string, DayOfWeek>;
  onToggleTask: (id: string) => void;
  onDeferTask: (taskId: string, week: Week) => void;
  currentDay: DayOfWeek;
}

function TaskBoard({ week, completedTasks, deferredTasks, onToggleTask, onDeferTask, currentDay }: TaskBoardProps) {
  const columns = useMemo(() => {
    const today: Task[] = [];
    const thisWeek: Task[] = [];
    const deferred: Task[] = [];
    const done: Task[] = [];

    week.tasks.forEach((t) => {
      if (completedTasks[t.id]) { done.push(t); return; }
      if (deferredTasks[t.id] !== undefined) { deferred.push(t); return; }
      if (t.day === currentDay) { today.push(t); return; }
      thisWeek.push(t);
    });

    return { today, thisWeek, deferred, done };
  }, [week, completedTasks, deferredTasks, currentDay]);

  const colDef = [
    { key: "today" as const, label: "Today", icon: <Target size={14} />, color: "text-red-400", border: "border-red-900/40", bg: "bg-red-950/10" },
    { key: "thisWeek" as const, label: "This Week", icon: <Calendar size={14} />, color: "text-amber-400", border: "border-amber-900/40", bg: "bg-amber-950/10" },
    { key: "deferred" as const, label: "Deferred", icon: <SkipForward size={14} />, color: "text-zinc-400", border: "border-zinc-700/40", bg: "bg-zinc-900/20" },
    { key: "done" as const, label: "Completed", icon: <CheckCircle2 size={14} />, color: "text-green-400", border: "border-green-900/40", bg: "bg-green-950/10" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {colDef.map((col) => {
        const tasks = columns[col.key];
        return (
          <div key={col.key} className={`rounded-lg border flex flex-col min-h-64 ${col.bg} ${col.border}`}>
            <div className={`px-3 py-2.5 border-b ${col.border} flex items-center gap-2`}>
              <span className={col.color}>{col.icon}</span>
              <span className="text-amber-50/90 text-sm font-semibold">{col.label}</span>
              <span className={`ml-auto text-xs rounded-full px-1.5 py-0.5 ${col.color} bg-black/30`}>{tasks.length}</span>
            </div>
            <div className="flex-1 p-2 space-y-2 overflow-y-auto">
              <AnimatePresence>
                {tasks.map((task) => {
                  const taskCfg = TASK_TYPE_CONFIG[task.type];
                  const isDone = completedTasks[task.id];
                  return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`rounded border p-2.5 ${isDone ? "opacity-40 bg-zinc-900/30 border-zinc-800/30" : taskCfg.bg}`}
                    >
                      <p className={`text-[11.5px] leading-snug mb-1.5 ${isDone ? "line-through text-zinc-500" : "text-amber-50/90"}`}>
                        {task.text}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] ${taskCfg.color}`}>{taskCfg.icon} {taskCfg.label}</span>
                        <span className="text-zinc-600 text-[9px]">{task.hours}h</span>
                        <span className="text-zinc-600 text-[9px]">{DAY_LABELS[task.day]}</span>
                        <div className="ml-auto flex gap-1">
                          {!isDone && (
                            <button
                              onClick={() => onDeferTask(task.id, week)}
                              className="text-zinc-600 hover:text-amber-400 transition-colors"
                              title="Defer to next day"
                            >
                              <SkipForward size={11} />
                            </button>
                          )}
                          <button
                            onClick={() => onToggleTask(task.id)}
                            className={`transition-colors ${isDone ? "text-green-500 hover:text-zinc-500" : "text-zinc-500 hover:text-green-400"}`}
                          >
                            {isDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              {tasks.length === 0 && (
                <div className="flex items-center justify-center h-20 text-zinc-700 text-xs italic">
                  {col.key === "done" ? "Nothing completed yet" : "Empty"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESS VIEW
// ─────────────────────────────────────────────────────────────────────────────
function ProgressView({ completedTasks }: { completedTasks: Record<string, boolean> }) {
  return (
    <div className="space-y-6">
      {PHASES.map((phase) => {
        const cfg = PHASE_CONFIG[phase.id];
        const allTasks = phase.months.flatMap((m) => m.weeks.flatMap((w) => w.tasks));
        const done = allTasks.filter((t) => completedTasks[t.id]).length;
        const pct = Math.round(done / Math.max(1, allTasks.length) * 100);
        return (
          <Card key={phase.id} className={`bg-zinc-950 border ${cfg.border}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={`text-base ${cfg.text}`}>
                    Phase {phase.phaseNumber}: {phase.title}
                  </CardTitle>
                  <p className="text-zinc-500 text-xs mt-0.5">{phase.duration} · {phase.subtitle}</p>
                </div>
                <div className={`text-3xl font-bold ${cfg.text}`}>{pct}%</div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: cfg.line }}
                />
              </div>
              <div className="space-y-3">
                {phase.months.map((month) => {
                  const mTasks = month.weeks.flatMap((w) => w.tasks);
                  const mDone = mTasks.filter((t) => completedTasks[t.id]).length;
                  const mPct = Math.round(mDone / Math.max(1, mTasks.length) * 100);
                  return (
                    <div key={month.id}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-amber-50/70">Month {month.monthNumber}: {month.title}</span>
                        <span className="text-zinc-500">{mDone}/{mTasks.length} tasks</span>
                      </div>
                      <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${mPct}%`, background: cfg.line, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Checkpoint */}
              {(() => {
                const cp = CHECKPOINTS.find((c) => c.phaseId === phase.id);
                if (!cp) return null;
                return (
                  <div className={`mt-4 p-3 rounded border ${cfg.bg} ${cfg.border}`}>
                    <p className={`text-xs font-semibold ${cfg.text} mb-2 flex items-center gap-1`}>
                      <Award size={11} /> {cp.title}
                    </p>
                    <ul className="space-y-1">
                      {cp.items.map((item) => (
                        <li key={item} className="text-zinc-400 text-[11px] flex gap-1.5 items-start">
                          <span className="mt-0.5 text-zinc-600">▸</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function TrainingPlanDashboard() {
  const [completedTasks, setCompletedTasks] = useLocalStorage<Record<string, boolean>>("tp_completed", {});
  const [deferredTasks, setDeferredTasks] = useLocalStorage<Record<string, DayOfWeek>>("tp_deferred", {});
  const [currentWeekNum, setCurrentWeekNum] = useLocalStorage<number>("tp_week", 1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("graph");

  const currentDay = useMemo((): DayOfWeek => {
    const map: DayOfWeek[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    return map[new Date().getDay()];
  }, []);

  const currentWeek = useMemo(
    () => ALL_WEEKS.find((w) => w.weekNumber === currentWeekNum) ?? ALL_WEEKS[0],
    [currentWeekNum]
  );

  const totalTasks = ALL_TASKS.length;
  const doneTasks = Object.values(completedTasks).filter(Boolean).length;
  const overallPct = Math.round(doneTasks / Math.max(1, totalTasks) * 100);

  const weekDone = currentWeek.tasks.filter((t) => completedTasks[t.id]).length;
  const weekPct = Math.round(weekDone / Math.max(1, currentWeek.tasks.length) * 100);

  const currentPhase = getPhaseForWeek(currentWeek);
  const phaseCfg = PHASE_CONFIG[currentPhase.id];

  const todayTaskCount = currentWeek.tasks.filter(
    (t) => !completedTasks[t.id] && (deferredTasks[t.id] ?? t.day) === currentDay
  ).length;

  const toggleTask = useCallback((id: string) => {
    setCompletedTasks((prev) => ({ ...prev, [id]: !prev[id] }));
  }, [setCompletedTasks]);

  const deferTask = useCallback((taskId: string, week: Week) => {
    const task = week.tasks.find((t) => t.id === taskId);
    if (!task) return;
    const effectiveDay = deferredTasks[taskId] ?? task.day;
    const idx = DAY_ORDER.indexOf(effectiveDay);
    const nextDay = DAY_ORDER[(idx + 1) % 7];
    setDeferredTasks((prev) => ({ ...prev, [taskId]: nextDay }));
  }, [deferredTasks, setDeferredTasks]);

  const jumpToWeek = useCallback((weekNumber: number) => {
    setCurrentWeekNum(weekNumber);
    setActiveTab("schedule");
    setSelectedNodeId(null);
  }, [setCurrentWeekNum]);

  return (
    <div className="min-h-screen bg-black text-amber-50 flex flex-col">
      {/* ── Header ── */}
      <div className="bg-gradient-to-r from-red-950 via-zinc-950 to-black border-b border-red-900/20 flex-shrink-0">
        <div className="flex items-center gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-900/40 border border-red-700/60 flex items-center justify-center">
              <GraduationCap size={20} className="text-red-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-amber-50">Training Plan</h1>
              <p className="text-zinc-500 text-xs">6–12 Month Full-Stack Mastery Curriculum</p>
            </div>
          </div>

          {/* Stats row */}
          <div className="ml-auto flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4 mr-2">
              <div className="text-center">
                <div className="text-xl font-bold text-amber-50">{overallPct}%</div>
                <div className="text-[10px] text-zinc-500">Overall</div>
              </div>
              <div className="w-32 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${overallPct}%` }}
                  transition={{ duration: 1 }}
                  className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500"
                />
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-zinc-300">{doneTasks}</div>
                <div className="text-[10px] text-zinc-500">/{totalTasks} Tasks</div>
              </div>
            </div>

            <div className={`hidden xl:flex items-center gap-2 px-3 py-1.5 rounded border ${phaseCfg.bg} ${phaseCfg.border}`}>
              <Layers size={13} className={phaseCfg.text} />
              <span className={`text-xs font-medium ${phaseCfg.text}`}>{currentPhase.title}</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-900/10 border border-amber-900/30">
              <Target size={13} className="text-amber-400" />
              <span className="text-xs text-amber-400 font-medium">{todayTaskCount} due today</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="flex items-center gap-4 px-6 pt-4 pb-0 border-b border-zinc-800/50 flex-shrink-0">
            <TabsList className="bg-zinc-900/50 border border-zinc-800">
              <TabsTrigger value="graph" className="gap-1.5 data-[state=active]:bg-red-900/40 data-[state=active]:text-amber-50">
                <Network size={13} /> Node Graph
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-1.5 data-[state=active]:bg-red-900/40 data-[state=active]:text-amber-50">
                <Calendar size={13} /> This Week
              </TabsTrigger>
              <TabsTrigger value="board" className="gap-1.5 data-[state=active]:bg-red-900/40 data-[state=active]:text-amber-50">
                <Layers size={13} /> Task Board
              </TabsTrigger>
              <TabsTrigger value="progress" className="gap-1.5 data-[state=active]:bg-red-900/40 data-[state=active]:text-amber-50">
                <BarChart3 size={13} /> Progress
              </TabsTrigger>
            </TabsList>

            {/* Week navigator (shown outside graph) */}
            {activeTab !== "graph" && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setCurrentWeekNum((n) => Math.max(1, n - 1))}
                  disabled={currentWeekNum <= 1}
                  className="p-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-amber-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className={`text-sm font-semibold ${phaseCfg.text} min-w-24 text-center`}>
                  Week {currentWeekNum}
                </span>
                <button
                  onClick={() => setCurrentWeekNum((n) => Math.min(ALL_WEEKS.length, n + 1))}
                  disabled={currentWeekNum >= ALL_WEEKS.length}
                  className="p-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-amber-50 disabled:opacity-30 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>

          {/* ── Graph Tab ── */}
          <TabsContent value="graph" className="flex-1 overflow-hidden m-0 mt-0">
            <div className="flex h-full">
              {/* Graph canvas */}
              <ScrollArea className="flex-1 p-6">
                <div className="flex flex-col gap-3 mb-4">
                  <p className="text-zinc-500 text-xs">Click any node to explore. Click a week node to see tasks and schedule.</p>
                  <div className="flex gap-4 text-xs text-zinc-500">
                    {PHASES.map((p) => {
                      const cfg = PHASE_CONFIG[p.id];
                      return (
                        <span key={p.id} className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.line }} />
                          Phase {p.phaseNumber}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <NodeGraph
                  completedTasks={completedTasks}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={setSelectedNodeId}
                />
              </ScrollArea>

              {/* Detail panel */}
              <AnimatePresence mode="wait">
                {selectedNodeId && (
                  <motion.div
                    key={selectedNodeId}
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 360, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex-shrink-0 border-l border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden"
                    style={{ width: 360 }}
                  >
                    <DetailPanel
                      selectedNodeId={selectedNodeId}
                      completedTasks={completedTasks}
                      deferredTasks={deferredTasks}
                      onToggleTask={toggleTask}
                      onDeferTask={deferTask}
                      onClose={() => setSelectedNodeId(null)}
                      onJumpToWeek={jumpToWeek}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </TabsContent>

          {/* ── Schedule Tab ── */}
          <TabsContent value="schedule" className="flex-1 overflow-hidden m-0 mt-0">
            <ScrollArea className="h-full p-6">
              <WeekSchedule
                week={currentWeek}
                completedTasks={completedTasks}
                deferredTasks={deferredTasks}
                onToggleTask={toggleTask}
                onDeferTask={deferTask}
              />
            </ScrollArea>
          </TabsContent>

          {/* ── Task Board Tab ── */}
          <TabsContent value="board" className="flex-1 overflow-hidden m-0 mt-0">
            <ScrollArea className="h-full p-6">
              <div className="mb-4">
                <h2 className={`text-lg font-semibold ${phaseCfg.text}`}>Week {currentWeekNum}: {currentWeek.title}</h2>
                <p className="text-zinc-500 text-sm mt-0.5">
                  Today is <span className="text-amber-50/70 capitalize">{currentDay}</span> ·{" "}
                  <span className={phaseCfg.text}>{weekPct}%</span> of this week complete
                </p>
              </div>
              <TaskBoard
                week={currentWeek}
                completedTasks={completedTasks}
                deferredTasks={deferredTasks}
                onToggleTask={toggleTask}
                onDeferTask={deferTask}
                currentDay={currentDay}
              />
            </ScrollArea>
          </TabsContent>

          {/* ── Progress Tab ── */}
          <TabsContent value="progress" className="flex-1 overflow-hidden m-0 mt-0">
            <ScrollArea className="h-full p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-amber-50">Overall Progress</h2>
                <p className="text-zinc-500 text-sm mt-1">
                  {doneTasks} of {totalTasks} tasks complete across all phases
                </p>
                <div className="mt-3 h-3 bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${overallPct}%` }}
                    transition={{ duration: 1 }}
                    className="h-full rounded-full bg-gradient-to-r from-red-700 via-amber-600 to-purple-600"
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-500 mt-1">
                  <span>0%</span>
                  <span className="text-amber-50 font-semibold">{overallPct}%</span>
                  <span>100% — Senior Level</span>
                </div>
              </div>
              <ProgressView completedTasks={completedTasks} />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
