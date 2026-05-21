/**
 * tasks.tsx - Full-page task management, redesigned.
 *
 * Editorial language sweep:
 *   - Tracker breadcrumb + display title in header
 *   - Stats strip with mono numbers + tracker labels
 *   - TaskItem: priority-color LEFT-RAIL + status pill +
 *     real assignee avatar pills + due-date chip with semantic color
 *   - Kanban: matched vocabulary, cleaner cards
 *
 * Preserves all data wiring: Employees, Todos hook, supabase realtime
 * subscription, status mutation. No schema changes.
 */

import React, { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Calendar, CheckCircle, ClipboardList, Clock,
  AlertCircle, ChevronRight, ChevronDown, LayoutGrid, X, Flag, Search,
  Briefcase, Sparkles, Layers, Users,
} from "lucide-react";
import { ActiveUser, AllTodos, Employees, Todos, TodosInterface } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "./addTodo";
import { Tracker, TrackerDot } from "@/components/editorial/Tracker";
import { Mono } from "@/components/editorial/Mono";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "to-do" | "in-progress" | "done";

// Priority meta: left-rail color + pill style
const PRIORITY_META: Record<TaskPriority, { accent: string; label: string }> = {
  high:   { accent: "rgb(239,68,68)",  label: "HIGH" },
  medium: { accent: "rgb(251,191,36)", label: "MEDIUM" },
  low:    { accent: "rgb(110,110,116)", label: "LOW" },
};

// Status meta: pill colors + label
const STATUS_META: Record<TaskStatus, { dot: string; tint: string; text: string; label: string }> = {
  "to-do":       { dot: "rgb(251,191,36)", tint: "rgba(251,191,36,0.12)", text: "text-amber-400",   label: "TO DO" },
  "in-progress": { dot: "rgb(56,189,248)", tint: "rgba(56,189,248,0.12)", text: "text-sky-400",     label: "ACTIVE" },
  done:          { dot: "rgb(52,211,153)", tint: "rgba(52,211,153,0.12)", text: "text-emerald-400", label: "DONE" },
};

// Avatar palette - deterministic by username hash
function avatarAccent(name: string): string {
  const palette = [
    "rgb(239,68,68)", "rgb(245,158,11)", "rgb(16,185,129)", "rgb(14,165,233)",
    "rgb(168,85,247)", "rgb(236,72,153)", "rgb(34,211,238)", "rgb(251,191,36)",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length]!;
}

function initialsFor(name: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/[\s_-]+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

// Due-date chip: parse "N Days" or actual date string and color it
function dueDateMeta(deadline?: string): { label: string; color: string; bg: string } | null {
  if (!deadline) return null;

  // Try to parse "N Days", "N Day"
  const daysMatch = deadline.match(/^(\d+)\s*days?$/i);
  if (daysMatch) {
    const n = parseInt(daysMatch[1]!, 10);
    if (n <= 1) return { label: `${n}d`, color: "text-rose-400",    bg: "rgba(244,63,94,0.10)" };
    if (n <= 3) return { label: `${n}d`, color: "text-amber-400",   bg: "rgba(251,191,36,0.10)" };
    return            { label: `${n}d`, color: "text-muted-foreground", bg: "rgba(110,110,116,0.10)" };
  }

  // Fallback: just show whatever string
  return { label: deadline, color: "text-muted-foreground", bg: "rgba(110,110,116,0.10)" };
}

// Get assignee names as a flat array regardless of source shape
function assigneeNames(a: any): string[] {
  if (!a) return [];
  if (Array.isArray(a)) return a.filter(Boolean).map(String);
  if (typeof a === "string") return a.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

// AvatarStack - shows up to 3 employee avatars with overflow
function AvatarStack({ names }: { names: string[] }) {
  const visible = names.slice(0, 3);
  const more = names.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((n, i) => {
        const accent = avatarAccent(n);
        return (
          <div
            key={i}
            title={n}
            className="w-5 h-5 rounded-full ring-2 ring-background flex items-center justify-center text-[8.5px] font-black text-white shrink-0"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              zIndex: 10 - i,
            }}
          >
            {initialsFor(n)[0]}
          </div>
        );
      })}
      {more > 0 && (
        <div
          className="w-5 h-5 rounded-full ring-2 ring-background bg-secondary border border-border flex items-center justify-center text-[8px] font-bold text-muted-foreground shrink-0"
          title={`${more} more`}
        >
          +{more}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// KanbanCard - compact card for Kanban view
// ═══════════════════════════════════════════════════════════════
const KanbanCard: React.FC<{
  task: TodosInterface;
  onStatusChange: (id: number, status: TaskStatus) => void;
}> = ({ task, onStatusChange }) => {
  const nextStatus: TaskStatus | null =
    task.status === "to-do" ? "in-progress" :
    task.status === "in-progress" ? "done" : null;

  const priority = task.priority as TaskPriority | undefined;
  const pMeta = priority ? PRIORITY_META[priority] : null;
  const due = dueDateMeta(task.deadline as any);
  const names = assigneeNames(task.assignee);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="relative bg-card border border-border hover:border-border-strong rounded-lg p-3 transition-all group overflow-hidden"
    >
      {pMeta && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
          style={{ background: pMeta.accent }}
        />
      )}

      <div className="pl-2 flex items-start justify-between mb-2 gap-2">
        <h4 className="text-[12.5px] font-semibold text-foreground leading-snug flex-1">
          {task.title}
        </h4>
        {pMeta && (
          <span
            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 font-bold"
            style={{
              background: `${pMeta.accent}14`,
              color: pMeta.accent,
              border: `1px solid ${pMeta.accent}33`,
            }}
          >
            {pMeta.label}
          </span>
        )}
      </div>

      {task.description && (
        <p className="pl-2 text-[11px] text-muted-foreground leading-snug mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="pl-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-[10px]">
          {due && (
            <span className={["inline-flex items-center gap-1", due.color].join(" ")}>
              <Calendar className="h-2.5 w-2.5" />
              <Mono size="xs" className={due.color}>{due.label}</Mono>
            </span>
          )}
          {names.length > 0 && <AvatarStack names={names} />}
        </div>

        {nextStatus && (
          <button
            onClick={() => onStatusChange(task.todo_id, nextStatus)}
            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-all"
          >
            {nextStatus === "in-progress" ? "Start" : "Finish"}
            <ChevronRight className="h-2.5 w-2.5" strokeWidth={3} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
const TaskSettings: React.FC = () => {
  const { data: AllEmployees } = Employees();
  const { data: user } = ActiveUser();
  const currentRole = user?.[0]?.role ?? "";
  const isAdmin = ["CEO", "COO", "CFO", "Admin"].includes(currentRole as string);

  const [scope, setScope] = useState<"mine" | "everyone">("mine");
  const effectiveScope = isAdmin ? scope : "mine";

  // Always fetch both; render the active one. The unused query stays warm in the cache.
  const { data: mineTodos, refetch: refetchMine } = Todos(user?.[0]?.username);
  const { data: everyoneTodos, refetch: refetchEveryone } = AllTodos();
  const todos = effectiveScope === "everyone" ? everyoneTodos : mineTodos;
  const refetchTodos = effectiveScope === "everyone" ? refetchEveryone : refetchMine;

  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"inbox" | "kanban">("inbox");

  useEffect(() => {
    const channel = supabase
      .channel("task-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_todos" },
        () => refetchTodos()
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [refetchTodos, effectiveScope]);

  const todosList = todos || [];

  const todoCount = todosList.length > 0 ? todosList[0]?.todoCount || 0 : 0;
  const inProgressCount = todosList.length > 0 ? todosList[0]?.inProgressCount || 0 : 0;
  const doneCount = todosList.length > 0 ? todosList[0]?.doneCount || 0 : 0;
  const allCount = todosList.length > 0 ? todosList[0]?.allCount || 0 : todosList.length;
  const completionPct = allCount > 0 ? (doneCount / allCount) * 100 : 0;

  const handleStatusChange = async (id: number, status: TaskStatus) => {
    const { error } = await supabase
      .from("cwa_todos")
      .update({ status })
      .eq("todo_id", id);
    if (error) {
      await message(error.message, { title: "Error updating task", kind: "error" });
    }
  };

  const filtered = useMemo(() => {
    return todosList.filter((task) => {
      const matchesSearch =
        task?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task?.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || task?.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || task?.priority === priorityFilter;
      const matchesAssignee =
        assigneeFilter === "all" ||
        assigneeNames(task?.assignee).includes(assigneeFilter);
      return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
    });
  }, [todosList, searchQuery, statusFilter, priorityFilter, assigneeFilter]);

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* ═══════ EDITORIAL HEADER ═══════ */}
      <div className="px-8 pt-7 pb-3">
        <Tracker tone="muted" size="sm" className="mb-2">
          <TrackerDot color="rgb(239,68,68)" />
          TASKS - {allCount} TOTAL - {completionPct.toFixed(0)}% DONE
        </Tracker>
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <h1
              className="font-black text-foreground leading-none"
              style={{
                fontFamily: 'var(--ed-font-display, Inter), system-ui, sans-serif',
                fontSize: "clamp(26px, 2.6vw, 34px)",
                letterSpacing: "-0.02em",
              }}
            >
              Tasks.
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed">
              {effectiveScope === "everyone" && isAdmin && (
                <span className="text-primary font-bold mr-1">[FLEET VIEW]</span>
              )}
              {allCount === 0
                ? "Nothing to do yet. AXON will surface tasks as work lands."
                : completionPct === 100
                  ? "Inbox zero. Every task closed."
                  : effectiveScope === "everyone"
                    ? `Watching ${allCount} tasks across the team. ${doneCount} closed, ${inProgressCount} in motion.`
                    : `${doneCount} of ${allCount} closed. ${inProgressCount} in motion. AXON nudges owners as deadlines approach.`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Scope toggle - admin only */}
            {isAdmin && (
              <div className="inline-flex items-center bg-card border border-border rounded-md p-0.5" title="Whose tasks to show">
                <button
                  onClick={() => setScope("mine")}
                  data-active={scope === "mine"}
                  className="px-2.5 py-1 rounded text-[10.5px] font-bold uppercase tracking-wider transition-all text-muted-foreground hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  Mine
                </button>
                <button
                  onClick={() => setScope("everyone")}
                  data-active={scope === "everyone"}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-bold uppercase tracking-wider transition-all text-muted-foreground hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  <Users className="h-3 w-3" />
                  Everyone
                </button>
              </div>
            )}
            <div className="inline-flex items-center bg-card border border-border rounded-md p-0.5">
              <button
                onClick={() => setView("inbox")}
                data-active={view === "inbox"}
                className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                title="Inbox view"
                aria-label="Inbox view"
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("kanban")}
                data-active={view === "kanban"}
                className="p-1.5 rounded transition-colors text-muted-foreground hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                title="Kanban view"
                aria-label="Kanban view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            <AddTodo Users={AllEmployees || []} />
          </div>
        </div>
      </div>

      {/* ═══════ STATS STRIP - editorial ═══════ */}
      <div className="px-8 pt-4">
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[1.6fr_repeat(4,1fr)]">
            {/* Completion (focal) */}
            <div className="px-5 py-4 border-b md:border-b-0 md:border-r border-border">
              <div className="flex items-center justify-between mb-2.5">
                <Tracker tone="muted" size="sm">COMPLETION</Tracker>
                <Mono size="md" tone="brand" className="font-black">
                  {completionPct.toFixed(0)}%
                </Mono>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full bg-primary rounded-full"
                  style={{ boxShadow: "0 0 12px rgba(239,68,68,0.4)" }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {doneCount} of {allCount} tasks done
              </p>
            </div>

            <StatCell icon={AlertCircle} label="To Do"  value={todoCount}       color="amber" />
            <StatCell icon={Clock}       label="Active" value={inProgressCount} color="sky"   />
            <StatCell icon={CheckCircle} label="Done"   value={doneCount}       color="emerald" />
            <StatCell icon={Activity}    label="Total"  value={allCount}        color="brand" />
          </div>
        </div>
      </div>

      {/* ═══════ FILTER BAR ═══════ */}
      <div className="px-8 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-card border border-border rounded-md p-0.5">
            {(["all", "to-do", "in-progress", "done"] as const).map((s) => {
              const counts: Record<string, number> = { all: allCount, "to-do": todoCount, "in-progress": inProgressCount, done: doneCount };
              const labels: Record<string, string> = { all: "All", "to-do": "To Do", "in-progress": "Active", done: "Done" };
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  data-active={isActive}
                  className="px-2.5 py-1 rounded text-[11px] font-bold transition-all text-muted-foreground hover:text-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  {labels[s]} <span className="opacity-60">({counts[s]})</span>
                </button>
              );
            })}
          </div>

          <div className="inline-flex items-center bg-card border border-border rounded-md p-0.5">
            {(["all", "high", "medium", "low"] as const).map((p) => {
              const isActive = priorityFilter === p;
              const pAccent = p === "all" ? null : PRIORITY_META[p].accent;
              return (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  data-active={isActive}
                  className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-all text-muted-foreground hover:text-foreground"
                  style={
                    isActive && pAccent
                      ? { background: `${pAccent}1a`, color: pAccent }
                      : isActive
                      ? { background: "rgba(239,68,68,0.12)", color: "rgb(239,68,68)" }
                      : undefined
                  }
                >
                  {p === "all" ? "Any" : p}
                </button>
              );
            })}
          </div>

          {/* Assignee filter - only when scope=everyone */}
          {effectiveScope === "everyone" && (
            <div className="relative">
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="appearance-none pl-7 pr-8 py-1.5 bg-card border border-border rounded-md text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground focus:outline-none focus:border-border-strong cursor-pointer"
                title="Filter by assignee"
              >
                <option value="all">Everyone</option>
                {(AllEmployees || []).map((emp: any) => (
                  <option key={emp.supa_id ?? emp.id} value={emp.username}>
                    {emp.username}
                  </option>
                ))}
              </select>
              <Users className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            </div>
          )}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-7 py-1.5 bg-card border border-border rounded-md text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border-strong"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ TASK DISPLAY ═══════ */}
      <div className="px-8 py-5 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-lg py-16 text-center">
            <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <Tracker tone="muted" size="sm" className="mb-2">
              {allCount === 0 ? "NO TASKS YET" : "NO MATCHES"}
            </Tracker>
            <p className="text-[13px] text-foreground/70 font-semibold mb-1">
              {allCount === 0 ? "Nothing on the list." : "Filters cleared the board."}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {allCount === 0
                ? "Create one to get started, or wait for AXON to surface something."
                : "Try a different filter combination or clear the search."}
            </p>
          </div>
        ) : view === "inbox" ? (
          <InboxView tasks={filtered} onStatusChange={handleStatusChange} showAssignee={effectiveScope === "everyone"} />
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {(["to-do", "in-progress", "done"] as TaskStatus[]).map((status) => {
              const colTasks = filtered.filter((t) => t.status === status);
              const m = STATUS_META[status];
              return (
                <div key={status} className="bg-card border border-border rounded-lg overflow-hidden flex flex-col">
                  <div
                    className="px-3.5 py-2.5 border-b border-border flex items-center justify-between"
                    style={{ background: m.tint }}
                  >
                    <Tracker size="sm" className={m.text}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block mr-2 align-middle" style={{ background: m.dot, boxShadow: `0 0 6px ${m.dot}` }} />
                      {m.label}
                    </Tracker>
                    <Mono size="xs" tone="muted">{colTasks.length}</Mono>
                  </div>
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="p-2 space-y-2">
                      <AnimatePresence>
                        {colTasks.length === 0 ? (
                          <div className="text-[11px] text-muted-foreground/60 text-center py-8">
                            <Flag className="h-3.5 w-3.5 mx-auto mb-1.5 text-muted-foreground/30" />
                            Empty
                          </div>
                        ) : (
                          colTasks.map((task) => (
                            <KanbanCard key={task.todo_id} task={task} onStatusChange={handleStatusChange} />
                          ))
                        )}
                      </AnimatePresence>
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// StatCell - editorial mini stat tile
// ═══════════════════════════════════════════════════════════════
function StatCell({
  icon: Icon, label, value, color,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  color: "amber" | "sky" | "emerald" | "brand";
}) {
  const colorMap: Record<string, { dot: string; text: string }> = {
    amber:   { dot: "rgb(251,191,36)", text: "text-amber-400"   },
    sky:     { dot: "rgb(56,189,248)", text: "text-sky-400"     },
    emerald: { dot: "rgb(52,211,153)", text: "text-emerald-400" },
    brand:   { dot: "rgb(239,68,68)",  text: "text-primary"     },
  };
  const c = colorMap[color]!;
  return (
    <div className="px-5 py-4 border-r last:border-r-0 border-border">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className={["h-3 w-3", c.text].join(" ")} />
        <Tracker tone="muted" size="sm">{label.toUpperCase()}</Tracker>
      </div>
      <Mono size="md" className={[c.text, "font-black"].join(" ")}>
        {value}
      </Mono>
    </div>
  );
}



export default TaskSettings;

// ════════════════════════════════════════════════════════════════
// INBOX VIEW - 3-pane layout (mirrors Onboarding)
//   LEFT: AXON Focus pinned + scrollable task list
//   CENTER: selected task detail (hero, verdict, metrics, description)
//   RIGHT: AXON activity rail (timeline + suggests + related)
// ════════════════════════════════════════════════════════════════

interface ScoredTask {
  task: TodosInterface;
  score: number;
  rationale: string;
  daysLeft: number | null;
}

function parseDays(deadline?: string): number | null {
  if (!deadline) return null;
  const m = deadline.match(/^(\d+)\s*days?$/i);
  return m ? parseInt(m[1]!, 10) : null;
}

function scoreTask(t: TodosInterface): ScoredTask {
  const status = t.status as TaskStatus;
  const priority = t.priority as TaskPriority | undefined;
  const days = parseDays(t.deadline as any);

  let score = 0;
  let rationale = "";

  if (status === "done") {
    score = -1;
    rationale = "Already done";
  } else if (days !== null && days <= 1) {
    score = 100 + (priority === "high" ? 30 : priority === "medium" ? 15 : 0);
    rationale = days === 0 ? "Due today" : `Due in ${days}d`;
  } else if (status === "in-progress") {
    score = 60 + (priority === "high" ? 30 : priority === "medium" ? 15 : 0);
    rationale = "Already in motion";
  } else if (priority === "high") {
    score = 50;
    rationale = "High priority";
  } else if (days !== null && days <= 3) {
    score = 40;
    rationale = `Due in ${days}d`;
  } else if (priority === "medium") {
    score = 20;
    rationale = "Medium priority";
  } else {
    score = 5;
    rationale = "Low urgency";
  }

  return { task: t, score, rationale, daysLeft: days };
}

const InboxView: React.FC<{
  tasks: TodosInterface[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  showAssignee: boolean;
}> = ({ tasks, onStatusChange, showAssignee }) => {
  // Score every task, sort open ones by AXON score, keep dones at the bottom
  const scored = useMemo(() => tasks.map(scoreTask), [tasks]);
  const openSorted = useMemo(
    () => scored.filter((s) => s.task.status !== "done").sort((a, b) => b.score - a.score),
    [scored],
  );
  const doneTasks = useMemo(
    () => scored.filter((s) => s.task.status === "done"),
    [scored],
  );
  const focusTop = openSorted.slice(0, 3);

  const [selectedId, setSelectedId] = useState<number | null>(
    () => focusTop[0]?.task.todo_id ?? openSorted[0]?.task.todo_id ?? doneTasks[0]?.task.todo_id ?? null,
  );

  // Re-anchor selection if it falls outside the current filtered set
  useEffect(() => {
    if (selectedId === null) return;
    const stillHere = tasks.some((t) => t.todo_id === selectedId);
    if (!stillHere) {
      setSelectedId(focusTop[0]?.task.todo_id ?? openSorted[0]?.task.todo_id ?? null);
    }
  }, [tasks, selectedId, focusTop, openSorted]);

  const selected = scored.find((s) => s.task.todo_id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-0 rounded-xl border border-border bg-card overflow-hidden min-h-[calc(100vh-340px)]">
      {/* ─────────── LEFT PANE: list + AXON focus pinned ─────────── */}
      <aside
        className="border-r border-border flex flex-col min-h-0"
        style={{ background: "rgba(0,0,0,0.25)" }}
      >
        <ScrollArea className="flex-1 min-h-0">
          {/* AXON Focus pinned */}
          {focusTop.length > 0 && (
            <div
              className="px-3 pt-3 pb-2 border-b border-border"
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(239,68,68,0.10), transparent 60%)",
              }}
            >
              <Tracker tone="brand" size="sm" className="mb-2 px-1">
                <TrackerDot color="rgb(239,68,68)" />
                AXON FOCUS
              </Tracker>
              <div className="space-y-1">
                {focusTop.map((s) => (
                  <InboxListItem
                    key={s.task.todo_id}
                    scored={s}
                    isActive={s.task.todo_id === selectedId}
                    onSelect={() => setSelectedId(s.task.todo_id)}
                    showAssignee={showAssignee}
                    focal
                  />
                ))}
              </div>
            </div>
          )}

          {/* All open tasks (open - focus top) */}
          <div className="px-3 pt-3 pb-2">
            <Tracker tone="muted" size="sm" className="mb-2 px-1">
              <TrackerDot />
              OPEN · {openSorted.length}
            </Tracker>
            <div className="space-y-1">
              {openSorted.length === 0 ? (
                <p className="text-[11px] text-muted-foreground px-2 py-2">
                  Nothing open. Inbox zero.
                </p>
              ) : (
                openSorted.slice(focusTop.length).map((s) => (
                  <InboxListItem
                    key={s.task.todo_id}
                    scored={s}
                    isActive={s.task.todo_id === selectedId}
                    onSelect={() => setSelectedId(s.task.todo_id)}
                    showAssignee={showAssignee}
                  />
                ))
              )}
            </div>
          </div>

          {/* Done */}
          {doneTasks.length > 0 && (
            <div className="px-3 pt-1 pb-3 border-t border-border">
              <Tracker tone="muted" size="sm" className="mb-2 px-1 text-emerald-400">
                <TrackerDot color="rgb(52,211,153)" />
                DONE · {doneTasks.length}
              </Tracker>
              <div className="space-y-1 opacity-70">
                {doneTasks.map((s) => (
                  <InboxListItem
                    key={s.task.todo_id}
                    scored={s}
                    isActive={s.task.todo_id === selectedId}
                    onSelect={() => setSelectedId(s.task.todo_id)}
                    showAssignee={showAssignee}
                  />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* ─────────── CENTER PANE: selected task detail ─────────── */}
      <main className="overflow-y-auto bg-background/30">
        {selected ? (
          <TaskDetail scored={selected} onStatusChange={onStatusChange} showAssignee={showAssignee} />
        ) : (
          <div className="h-full flex items-center justify-center px-8 py-16 text-center">
            <div className="max-w-sm">
              <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
              <Tracker tone="muted" size="sm" className="mb-2">SELECT A TASK</Tracker>
              <p className="text-[13px] text-foreground/80 font-semibold mb-1">Pick a task to inspect.</p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                AXON Focus pins the most urgent items to the top. Click any task on the left to load full context.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* ─────────── RIGHT PANE: AXON activity rail ─────────── */}
      <aside
        className="border-l border-border overflow-y-auto px-4 py-5 space-y-6"
        style={{
          background:
            "linear-gradient(180deg, rgba(40,40,48,0.4), rgba(28,28,32,0.5))",
          backdropFilter: "blur(8px)",
        }}
      >
        {selected ? (
          <TaskActivityRail scored={selected} allTasks={tasks} onStatusChange={onStatusChange} />
        ) : (
          <div className="text-center px-3 py-12">
            <Sparkles className="h-5 w-5 mx-auto text-muted-foreground mb-3" />
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              AXON's activity stream appears once you select a task.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// InboxListItem - compact row in the left pane
// ════════════════════════════════════════════════════════════════
const InboxListItem: React.FC<{
  scored: ScoredTask;
  isActive: boolean;
  onSelect: () => void;
  showAssignee: boolean;
  focal?: boolean;
}> = ({ scored, isActive, onSelect, showAssignee, focal }) => {
  const { task, daysLeft } = scored;
  const priority = task.priority as TaskPriority | undefined;
  const pMeta = priority ? PRIORITY_META[priority] : null;
  const status = task.status as TaskStatus;
  const sMeta = STATUS_META[status];
  const names = assigneeNames(task.assignee);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={isActive}
      className={[
        "group relative block w-full rounded-md transition-all text-left px-2.5 py-2",
        isActive
          ? "bg-primary/12 text-foreground"
          : focal
            ? "bg-card hover:bg-secondary/60"
            : "hover:bg-secondary/40 text-foreground/85",
      ].join(" ")}
      style={
        isActive
          ? { boxShadow: "inset 3px 0 0 rgb(239,68,68)" }
          : focal && pMeta
            ? { boxShadow: `inset 2px 0 0 ${pMeta.accent}` }
            : undefined
      }
    >
      <div className="flex items-start gap-2">
        {/* Status dot */}
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
          style={{ background: sMeta.dot, boxShadow: status === "in-progress" ? `0 0 6px ${sMeta.dot}` : undefined }}
        />
        <div className="min-w-0 flex-1">
          <p className={["text-[12px] font-semibold leading-tight truncate", status === "done" ? "line-through opacity-60" : ""].join(" ")}>
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[10px]">
            {pMeta && (
              <span style={{ color: pMeta.accent }} className="font-bold uppercase tracking-wider">
                {pMeta.label}
              </span>
            )}
            {daysLeft !== null && (
              <Mono size="xs" tone={daysLeft <= 1 ? "brand" : "muted"}>
                {daysLeft === 0 ? "today" : `${daysLeft}d`}
              </Mono>
            )}
            {showAssignee && names.length > 0 && (
              <span className="text-muted-foreground truncate">
                {names[0]}{names.length > 1 ? ` +${names.length - 1}` : ""}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

// ════════════════════════════════════════════════════════════════
// TaskDetail - center pane content
// ════════════════════════════════════════════════════════════════
const TaskDetail: React.FC<{
  scored: ScoredTask;
  onStatusChange: (id: number, status: TaskStatus) => void;
  showAssignee: boolean;
}> = ({ scored, onStatusChange, showAssignee }) => {
  const { task, rationale, daysLeft } = scored;
  const priority = task.priority as TaskPriority | undefined;
  const pMeta = priority ? PRIORITY_META[priority] : null;
  const status = task.status as TaskStatus;
  const sMeta = STATUS_META[status];
  const names = assigneeNames(task.assignee);
  const nextStatus: TaskStatus | null =
    status === "to-do" ? "in-progress" :
    status === "in-progress" ? "done" : null;

  const daysSinceCreated = task.created_at
    ? Math.max(0, Math.round((Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="px-7 lg:px-9 py-7">
      {/* Tracker breadcrumb */}
      <Tracker tone="muted" size="sm" className="mb-3">
        <TrackerDot color={pMeta?.accent ?? sMeta.dot} />
        TASK · #{task.todo_id} · {status.toUpperCase()}
      </Tracker>

      {/* Hero: status + priority badges, then big title */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span
          className={["inline-flex items-center gap-1.5 rounded text-[10px] font-bold uppercase tracking-wider px-2 py-0.5", sMeta.text].join(" ")}
          style={{ background: sMeta.tint }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sMeta.dot }} />
          {sMeta.label}
        </span>
        {pMeta && (
          <span
            className="inline-flex items-center rounded text-[10px] font-bold uppercase tracking-wider px-2 py-0.5"
            style={{
              background: `${pMeta.accent}14`,
              color: pMeta.accent,
              border: `1px solid ${pMeta.accent}33`,
            }}
          >
            {pMeta.label}
          </span>
        )}
        {showAssignee && names.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <AvatarStack names={names} />
            <span className="text-[11px] text-muted-foreground">{names.join(", ")}</span>
          </span>
        )}
      </div>

      <h1
        className={[
          "font-black text-foreground leading-tight mb-3",
          status === "done" ? "line-through opacity-60" : "",
        ].join(" ")}
        style={{
          fontFamily: 'var(--ed-font-display, Inter), system-ui, sans-serif',
          fontSize: "clamp(24px, 2.6vw, 34px)",
          letterSpacing: "-0.02em",
        }}
      >
        {task.title}
      </h1>

      <div className="flex items-center gap-3 text-[11.5px] text-muted-foreground mb-6 flex-wrap">
        {daysLeft !== null && (
          <span className="inline-flex items-center gap-1">
            <Calendar size={11} className={daysLeft <= 1 ? "text-rose-400" : "text-muted-foreground"} />
            <Mono size="xs" tone={daysLeft <= 1 ? "brand" : "muted"}>
              {daysLeft === 0 ? "due today" : `${daysLeft}d left`}
            </Mono>
          </span>
        )}
        {daysSinceCreated !== null && (
          <Mono size="xs" tone="muted">created {daysSinceCreated}d ago</Mono>
        )}
        {task.label && (
          <span className="inline-flex items-center gap-1">
            <Briefcase size={10} />
            <Mono size="xs" tone="muted" uppercase>{task.label}</Mono>
          </span>
        )}
      </div>

      {/* Quick action buttons */}
      {nextStatus && (
        <div className="flex items-center gap-2 mb-6">
          <button
            type="button"
            onClick={() => onStatusChange(task.todo_id, nextStatus)}
            className={[
              "inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12px] font-bold uppercase tracking-wider transition-opacity hover:opacity-90",
              nextStatus === "in-progress" ? "text-sky-400" : "text-emerald-400",
            ].join(" ")}
            style={{
              background: nextStatus === "in-progress" ? "rgba(56,189,248,0.15)" : "rgba(52,211,153,0.15)",
              boxShadow: nextStatus === "in-progress"
                ? "0 0 0 1px rgba(56,189,248,0.35), 0 4px 12px -2px rgba(56,189,248,0.3)"
                : "0 0 0 1px rgba(52,211,153,0.35), 0 4px 12px -2px rgba(52,211,153,0.3)",
            }}
          >
            {nextStatus === "in-progress" ? "Start" : "Finish"}
            <ChevronRight className="h-3 w-3" strokeWidth={3} />
          </button>
          {status === "in-progress" && (
            <button
              type="button"
              onClick={() => onStatusChange(task.todo_id, "to-do")}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-[12px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Move back
            </button>
          )}
        </div>
      )}

      {/* AXON verdict card */}
      <div
        className="relative rounded-xl border border-primary/30 overflow-hidden mb-6"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(239,68,68,0.08), transparent 60%), hsl(var(--card))",
        }}
      >
        <span
          aria-hidden
          className="absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full"
          style={{ background: "rgb(239,68,68)", boxShadow: "0 0 12px rgba(239,68,68,0.6)" }}
        />
        <div className="px-6 py-5 flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
            style={{
              background: "rgb(239,68,68)",
              boxShadow: "0 6px 16px -4px rgba(239,68,68,0.6)",
            }}
          >
            <Sparkles size={15} className="text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <Tracker tone="brand" size="sm" className="mb-1.5">AXON · STATUS READ</Tracker>
            <p className="text-[13.5px] text-foreground leading-relaxed">
              {status === "done"
                ? `Closed and accounted for. No further action needed.`
                : daysLeft !== null && daysLeft <= 1
                  ? `${daysLeft === 0 ? "Due today" : "Due tomorrow"} — the highest-urgency item on the board. Tap Finish when shipped; AXON will close the loop.`
                  : status === "in-progress"
                    ? `Already in motion. AXON is watching for sign-off. Mark Finish when the work lands.`
                    : `${rationale}. ${pMeta ? `Priority is ${pMeta.label.toLowerCase()}. ` : ""}Tap Start to commit to this one next.`}
            </p>
          </div>
        </div>
      </div>

      {/* 2x2 metric grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <MetricMini label="Priority" value={pMeta?.label ?? "—"} accent={pMeta?.accent ?? "rgb(110,110,116)"} />
        <MetricMini label="Status" value={sMeta.label} accent={sMeta.dot} />
        <MetricMini
          label="Days left"
          value={daysLeft === null ? "—" : daysLeft === 0 ? "today" : `${daysLeft}d`}
          accent={daysLeft !== null && daysLeft <= 1 ? "rgb(244,63,94)" : "rgb(110,110,116)"}
        />
        <MetricMini
          label="Assignees"
          value={names.length === 0 ? "—" : String(names.length)}
          accent="rgb(168,85,247)"
        />
      </div>

      {/* Description */}
      <div className="mb-6">
        <Tracker tone="muted" size="sm" className="mb-2">DESCRIPTION</Tracker>
        {task.description ? (
          <p className="text-[13.5px] text-foreground/85 leading-relaxed">{task.description}</p>
        ) : (
          <p className="text-[12px] text-muted-foreground italic">No description on file.</p>
        )}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────
// MetricMini - small KPI tile used in TaskDetail
// ────────────────────────────────────────────────────────────────
const MetricMini: React.FC<{ label: string; value: string; accent: string }> = ({ label, value, accent }) => (
  <div className="rounded-lg border border-border bg-card px-4 py-3">
    <Tracker tone="muted" size="sm">{label.toUpperCase()}</Tracker>
    <p
      className="ed-display text-[20px] font-black mt-1.5 leading-none tabular-nums"
      style={{ color: accent, fontFamily: 'var(--ed-font-display, Inter), system-ui, sans-serif', letterSpacing: "-0.02em" }}
    >
      {value}
    </p>
  </div>
);

// ════════════════════════════════════════════════════════════════
// TaskActivityRail - right pane
// ════════════════════════════════════════════════════════════════
const TaskActivityRail: React.FC<{
  scored: ScoredTask;
  allTasks: TodosInterface[];
  onStatusChange: (id: number, status: TaskStatus) => void;
}> = ({ scored, allTasks, onStatusChange }) => {
  const { task } = scored;
  const status = task.status as TaskStatus;
  const created = task.created_at ? new Date(task.created_at) : null;
  const daysSince = created ? Math.max(0, Math.round((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24))) : null;

  // Synthesize a timeline from what we know
  const timeline: { when: string; title: string; subtitle: string }[] = [];
  if (status === "done") timeline.push({ when: "Recently", title: "Marked done", subtitle: "AXON closed the loop" });
  if (status === "in-progress") timeline.push({ when: "Recently", title: "Moved to active", subtitle: "AXON is watching for sign-off" });
  if (created) {
    const label = daysSince === 0 ? "Today" : daysSince === 1 ? "Yesterday" : `${daysSince}d ago`;
    timeline.push({
      when: label,
      title: "Task created",
      subtitle: created.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    });
  }

  // Suggestions: related tasks (same priority or assignee)
  const names = assigneeNames(task.assignee);
  const related = allTasks
    .filter((t) => t.todo_id !== task.todo_id && t.status !== "done")
    .filter((t) => t.priority === task.priority || assigneeNames(t.assignee).some((n) => names.includes(n)))
    .slice(0, 3);

  const nextStatus: TaskStatus | null =
    status === "to-do" ? "in-progress" :
    status === "in-progress" ? "done" : null;

  return (
    <>
      <section>
        <Tracker tone="muted" size="sm" className="mb-3">
          <TrackerDot color="rgb(239,68,68)" />
          AXON TIMELINE
        </Tracker>
        <ul className="space-y-3">
          {timeline.map((ev, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(239,68,68,0.15)" }}>
                <Sparkles size={11} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] mb-0.5">
                  <span className="font-bold text-primary">AXON</span>
                  <span className="text-muted-foreground"> · {ev.when}</span>
                </p>
                <p className="text-[12px] text-foreground font-semibold leading-snug">{ev.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{ev.subtitle}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* AXON Suggests */}
      <section>
        <Tracker tone="muted" size="sm" className="mb-3">
          <TrackerDot color="rgb(239,68,68)" />
          AXON SUGGESTS
        </Tracker>
        <div className="space-y-2">
          {nextStatus && (
            <button
              type="button"
              onClick={() => onStatusChange(task.todo_id, nextStatus)}
              className="w-full rounded-lg border border-border bg-card p-3 flex items-start gap-2 text-left hover:border-border-strong transition-colors group"
            >
              {nextStatus === "in-progress" ? (
                <Clock size={13} className="text-sky-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle size={13} className="text-emerald-400 shrink-0 mt-0.5" />
              )}
              <p className="flex-1 text-[11.5px] text-foreground leading-snug">
                {nextStatus === "in-progress" ? "Start this task now" : "Mark this task as done"}
              </p>
              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
            </button>
          )}
          {status !== "done" && (
            <div className="rounded-lg border border-border bg-card p-3 flex items-start gap-2">
              <Flag size={13} className="text-amber-400 shrink-0 mt-0.5" />
              <p className="flex-1 text-[11.5px] text-foreground leading-snug">
                Reassign or change priority via task settings
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section>
          <Tracker tone="muted" size="sm" className="mb-3">
            <TrackerDot />
            RELATED · {related.length}
          </Tracker>
          <ul className="space-y-1">
            {related.map((r) => {
              const pAccent = r.priority ? PRIORITY_META[r.priority as TaskPriority].accent : "rgb(110,110,116)";
              return (
                <li key={r.todo_id} className="rounded border border-border bg-card/60 px-2.5 py-2 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full" style={{ background: pAccent }} />
                    <span className="font-semibold text-foreground truncate flex-1">{r.title}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
};
