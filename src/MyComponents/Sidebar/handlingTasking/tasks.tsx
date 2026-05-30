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
  Calendar, CheckCircle, CheckCircle2, ClipboardList, Clock,
  ChevronRight, Circle, CircleDashed, LayoutGrid, X, Flag, Search,
  Briefcase, Sparkles, Layers, Users, Edit3, Save, Trash2,
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
function AvatarStack({
  names,
  avatarsByName,
}: {
  names: string[];
  /** Optional username → URL map. When supplied, each face renders
   *  as a real <img> with the colored-initial circle as the
   *  underlay fallback. When absent (legacy call sites), the
   *  stack falls back to colored-initial chips. */
  avatarsByName?: Map<string, string>;
}) {
  const visible = names.slice(0, 3);
  const more = names.length - visible.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((n, i) => {
        const accent = avatarAccent(n);
        const url = avatarsByName?.get(n);
        return (
          <div
            key={i}
            title={n}
            className="relative w-5 h-5 rounded-full ring-2 ring-background flex items-center justify-center text-[8.5px] font-black text-white shrink-0 overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
              zIndex: 10 - i,
            }}
          >
            {url ? (
              <img
                src={url}
                alt={n}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              initialsFor(n)[0]
            )}
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      // Editorial card surface — matches home page row treatment:
      // hairline soft border, restrained background tint, hover
      // brightens slightly without changing border weight.
      className="relative bg-foreground/[0.03] hover:bg-foreground/[0.05] border-xs border-border-soft hover:border-border/25 rounded-none p-3 transition-colors group overflow-hidden"
    >
      {pMeta && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-none"
          style={{ background: pMeta.accent }}
        />
      )}

      <div className="pl-2 flex items-start justify-between mb-1.5 gap-2">
        <h4 className="text-[12.5px] font-semibold text-foreground leading-snug flex-1">
          {task.title}
        </h4>
        {pMeta && (
          // Priority chip — tinted bg + matching text + hairline.
          // Same recipe as the home page semantic chips.
          <span
            className="text-[9px] uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-none shrink-0 font-bold"
            style={{
              background: `${pMeta.accent}14`,
              color: pMeta.accent,
              border: `1px solid ${pMeta.accent}26`,
            }}
          >
            {pMeta.label}
          </span>
        )}
      </div>

      {task.description && (
        <p className="pl-2 text-[11px] text-text-tertiary leading-snug mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      {task.assigned_by && (
        <div className="pl-2 mb-1.5 inline-flex items-center gap-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-text-tertiary/70">
            Assigned by
          </span>
          <span
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[8px] font-bold text-white"
            style={{ background: avatarAccent(task.assigned_by) }}
          >
            {initialsFor(task.assigned_by)}
          </span>
          <span className="text-[10px] font-medium text-foreground/75">
            {task.assigned_by}
          </span>
        </div>
      )}

      <div className="pl-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 text-[10px]">
          {due && (
            <span className={["inline-flex items-center gap-1", due.color].join(" ")}>
              <Calendar className="h-2.5 w-2.5" />
              <Mono size="xs" className={due.color}>
                {due.label}
              </Mono>
            </span>
          )}
          {names.length > 0 && <AvatarStack names={names} />}
        </div>

        {nextStatus && (
          <button
            onClick={() => onStatusChange(task.todo_id, nextStatus)}
            className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-primary hover:text-primary/80 transition-opacity"
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
/**
 * Tasks page.
 *
 * When `embedded` is true (it is from OperationsHub), the outer page
 * header is hidden — the hub already renders a unified header above
 * the tab strip. The internal toolbar (scope toggle, view toggle,
 * Add) is kept and re-themed for the embedded variant so all
 * primary controls stay one click away.
 */
interface TaskSettingsProps {
  embedded?: boolean;
}

const TaskSettings: React.FC<TaskSettingsProps> = ({ embedded = false }) => {
  const { data: AllEmployees } = Employees();
  const { data: user } = ActiveUser();
  const currentRole = user?.[0]?.role ?? "";
  const isAdmin = ["CEO", "COO", "CFO", "Admin"].includes(currentRole as string);

  // Username → avatar URL Map. Supports both legacy storage-bucket
  // filenames (rewritten to public URLs via supabase storage) and
  // full http(s) avatars (DiceBear, Direct Hire). Built once per
  // Employees change; rows do an O(1) lookup at render time.
  const avatarsByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of (AllEmployees as any[] | undefined) ?? []) {
      if (!e?.username) continue;
      let url: string | undefined;
      if (typeof e.avatar === "string" && e.avatar.startsWith("http")) {
        url = e.avatar;
      } else if (e.avatar) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(e.avatar);
        url = data?.publicUrl;
      }
      if (url) map.set(e.username, url);
    }
    return map;
  }, [AllEmployees]);

  const [scope, setScope] = useState<"mine" | "everyone">("mine");
  const effectiveScope = isAdmin ? scope : "mine";

  // Always fetch both; render the active one. The unused query stays warm in the cache.
  const { data: mineTodos, refetch: refetchMine } = Todos(user?.[0]?.username);
  const { data: everyoneTodos, refetch: refetchEveryone } = AllTodos();
  const todos = effectiveScope === "everyone" ? everyoneTodos : mineTodos;
  const refetchTodos = effectiveScope === "everyone" ? refetchEveryone : refetchMine;

  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
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
    // Stamp completed_at when transitioning to done; null it when
    // moving out of done. Keeps the Velocity widget honest.
    const { error } = await supabase
      .from("cwa_todos")
      .update({
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      })
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
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [todosList, searchQuery, statusFilter, priorityFilter]);

  return (
    <div
      className={
        embedded
          ? "h-full flex flex-col bg-background overflow-hidden"
          : "h-screen flex flex-col bg-background overflow-hidden"
      }
    >
      {/* ═══════ TOOLBAR ═══════
       *  When `embedded`, we skip the big display title (the
       *  OperationsHub header above us owns that) and render only
       *  the toolbar — stats + controls — in a quieter strip that
       *  matches the editorial home-page chrome.
       *
       *  When standalone, we keep the original hero header for
       *  bookmarked-direct visits to /task. */}
      {embedded ? (
        <div className="px-6 py-3 border-b border-xs border-border/15 bg-background/95 flex items-center justify-between gap-4 flex-wrap">
          {/* Stat row — quiet, editorial. "X of Y closed · Z active". */}
          <div className="flex items-center gap-4 min-w-0 text-[11.5px]">
            {effectiveScope === "everyone" && isAdmin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold tabular-nums uppercase tracking-[0.12em] text-primary">
                Fleet view
              </span>
            )}
            <span className="inline-flex items-baseline gap-1.5">
              <span className="font-bold text-foreground tabular-nums text-[14px]">
                {doneCount}
              </span>
              <span className="text-text-tertiary">of {allCount} closed</span>
            </span>
            <span className="h-3 w-px bg-border-soft" />
            <span className="inline-flex items-baseline gap-1.5">
              <span className="font-bold text-warning tabular-nums text-[14px]">
                {inProgressCount}
              </span>
              <span className="text-text-tertiary">active</span>
            </span>
            <span className="h-3 w-px bg-border-soft" />
            <span className="inline-flex items-baseline gap-1.5">
              <span className="font-bold text-foreground/80 tabular-nums text-[14px]">
                {completionPct.toFixed(0)}%
              </span>
              <span className="text-text-tertiary">done</span>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Scope toggle — admin only. Editorial pill design. */}
            {isAdmin && (
              <div
                className="inline-flex items-center bg-foreground/[0.04] border-xs border-border-soft rounded-none p-0.5"
                title="Whose tasks to show"
              >
                <button
                  onClick={() => setScope("mine")}
                  data-active={scope === "mine"}
                  className="px-2.5 py-1 rounded text-[10.5px] font-bold uppercase tracking-[0.12em] transition-all text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
                >
                  Mine
                </button>
                <button
                  onClick={() => setScope("everyone")}
                  data-active={scope === "everyone"}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-bold uppercase tracking-[0.12em] transition-all text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
                >
                  <Users className="h-3 w-3" />
                  Everyone
                </button>
              </div>
            )}
            <div className="inline-flex items-center bg-foreground/[0.04] border-xs border-border-soft rounded-none p-0.5">
              <button
                onClick={() => setView("inbox")}
                data-active={view === "inbox"}
                className="p-1.5 rounded transition-colors text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
                title="Inbox view"
                aria-label="Inbox view"
              >
                <Layers className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("kanban")}
                data-active={view === "kanban"}
                className="p-1.5 rounded transition-colors text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
                title="Kanban view"
                aria-label="Kanban view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            <AddTodo Users={AllEmployees || []} />
          </div>
        </div>
      ) : (
        // Standalone (legacy /task route) — original hero header kept
        // so direct visits still feel intentional.
        <div className="px-8 pt-7 pb-4 border-b border-border bg-card/40">
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
              {isAdmin && (
                <div className="inline-flex items-center bg-card border border-border rounded-none p-0.5" title="Whose tasks to show">
                  <button
                    onClick={() => setScope("mine")}
                    data-active={scope === "mine"}
                    className="px-2.5 py-1 rounded text-[10.5px] font-bold uppercase tracking-wider transition-all text-muted-foreground hover:text-primary-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    Mine
                  </button>
                  <button
                    onClick={() => setScope("everyone")}
                    data-active={scope === "everyone"}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10.5px] font-bold uppercase tracking-wider transition-all text-muted-foreground hover:text-primary-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  >
                    <Users className="h-3 w-3" />
                    Everyone
                  </button>
                </div>
              )}
              <div className="inline-flex items-center bg-card border border-border rounded-none p-0.5">
                <button
                  onClick={() => setView("inbox")}
                  data-active={view === "inbox"}
                  className="p-1.5 rounded transition-colors text-muted-foreground hover:text-primary-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                  title="Inbox view"
                  aria-label="Inbox view"
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setView("kanban")}
                  data-active={view === "kanban"}
                  className="p-1.5 rounded transition-colors text-muted-foreground hover:text-primary-foreground data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
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
      )}

      {/* ═══════ TASK DISPLAY (flush against the unified header) ═══════ */}
      <div className="flex-1 min-h-0 flex flex-col">
        {view === "inbox" ? (
          <InboxView
            tasks={filtered}
            onStatusChange={handleStatusChange}
            showAssignee={effectiveScope === "everyone"}
            avatarsByName={avatarsByName}
            stats={{ allCount, todoCount, inProgressCount, doneCount, completionPct }}
            filters={{
              status: statusFilter,
              setStatus: setStatusFilter,
              priority: priorityFilter,
              setPriority: setPriorityFilter,
              search: searchQuery,
              setSearch: setSearchQuery,
            }}
          />
        ) : (
          <div className="grid grid-cols-3 gap-4 mx-6 mt-5 pb-8">
            {(["to-do", "in-progress", "done"] as TaskStatus[]).map((status) => {
              const colTasks = filtered.filter((t) => t.status === status);
              const m = STATUS_META[status];
              return (
                <div
                  key={status}
                  // Editorial column: hairline soft border, restrained
                  // surface tint, no header bg — let the section label
                  // carry the tone, not the chrome.
                  className="bg-foreground/[0.02] border-xs border-border/15 rounded-none overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-xs border-border/15 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: m.dot }}
                      />
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-[0.16em] ${m.text}`}
                      >
                        {m.label}
                      </span>
                    </div>
                    <span className="text-[10.5px] font-bold tabular-nums text-text-tertiary">
                      {colTasks.length}
                    </span>
                  </div>
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="p-2.5 space-y-2">
                      <AnimatePresence>
                        {colTasks.length === 0 ? (
                          <div className="text-[11px] text-text-tertiary italic text-center py-10">
                            <Flag className="h-3.5 w-3.5 mx-auto mb-1.5 text-text-tertiary/40" />
                            Nothing here.
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

// Shared types for InboxView + FleetCockpit
interface InboxStats {
  allCount: number;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  completionPct: number;
}
interface InboxFilters {
  status: "all" | TaskStatus;
  setStatus: (s: "all" | TaskStatus) => void;
  priority: "all" | TaskPriority;
  setPriority: (p: "all" | TaskPriority) => void;
  search: string;
  setSearch: (s: string) => void;
}

const InboxView: React.FC<{
  tasks: TodosInterface[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  showAssignee: boolean;
  /** username → avatar URL, threaded down to rows + detail pane. */
  avatarsByName: Map<string, string>;
  stats: InboxStats;
  filters: InboxFilters;
}> = ({ tasks, onStatusChange, showAssignee, avatarsByName, stats, filters }) => {
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
  const [editingTask, setEditingTask] = useState<TodosInterface | null>(null);

  // Re-anchor selection if it falls outside the current filtered set
  useEffect(() => {
    if (selectedId === null) return;
    const stillHere = tasks.some((t) => t.todo_id === selectedId);
    if (!stillHere) {
      setSelectedId(focusTop[0]?.task.todo_id ?? openSorted[0]?.task.todo_id ?? null);
    }
  }, [tasks, selectedId, focusTop, openSorted]);

  const selected = scored.find((s) => s.task.todo_id === selectedId) ?? null;

  // Split the open backlog into ACTIVE (in-progress) and TO DO so
  // the sidebar shows them as visually distinct subsections instead
  // of mixing them under one OPEN header. Focus items are skipped
  // here because they're already pinned at the top.
  const focusIds = new Set(focusTop.map((s) => s.task.todo_id));
  const remainingOpen = openSorted.filter(
    (s) => !focusIds.has(s.task.todo_id),
  );
  const activeItems = remainingOpen.filter(
    (s) => s.task.status === "in-progress",
  );
  const todoItems = remainingOpen.filter((s) => s.task.status === "to-do");

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-background overflow-hidden">
      {/* Horizontal filter bar — pulls status pills, priority chips
       *  and search out of the right rail and into a quiet bar above
       *  the 3-pane content. Replaces the old FleetCockpit which had
       *  six stacked sections crammed into the right rail. */}
      <InboxFilterBar filters={filters} stats={stats} />

      {/* 2-pane grid — list on the left, rich detail on the right.
       *  Sidebar widened to 420px so titles can wrap to 2 full lines
       *  without ever truncating, and the meta cluster (assignee
       *  initial + due chip) sits comfortably on the right edge. */}
      <div className="grid grid-cols-1 lg:grid-cols-[620px_1fr] gap-0 flex-1 min-h-0">
      {/* ─────────── LEFT PANE: list + AXON focus pinned ───────────
       *  Editorial chrome: hairline divider, slightly tinted surface
       *  to differentiate from the center, no heavy gradients. */}
      <aside className="border-r border-xs border-border/15 flex flex-col min-h-0 bg-foreground/[0.02]">
        <ScrollArea className="flex-1 min-h-0">
          {/* AXON Focus — pinned at the top. Bumped padding + spacing
           *  so the section breathes. */}
          {focusTop.length > 0 && (
            <div className="px-4 pt-5 pb-4 border-b border-xs border-border/15">
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-primary">
                  Axon focus
                </span>
                <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
                  {focusTop.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {focusTop.map((s) => (
                  <InboxListItem
                    key={s.task.todo_id}
                    scored={s}
                    isActive={s.task.todo_id === selectedId}
                    onSelect={() => setSelectedId(s.task.todo_id)}
                    showAssignee={showAssignee}
                    avatarsByName={avatarsByName}
                    focal
                  />
                ))}
              </div>
            </div>
          )}

          {/* Active — in-progress items, surfaces first because work
           *  in motion deserves higher attention than work not yet
           *  started. Warning-tinted dot + label so it reads as the
           *  "currently happening" pile. */}
          {activeItems.length > 0 && (
            <div className="px-4 pt-5 pb-4">
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-warning">
                  Active
                </span>
                <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
                  {activeItems.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {activeItems.map((s) => (
                  <InboxListItem
                    key={s.task.todo_id}
                    scored={s}
                    isActive={s.task.todo_id === selectedId}
                    onSelect={() => setSelectedId(s.task.todo_id)}
                    showAssignee={showAssignee}
                    avatarsByName={avatarsByName}
                  />
                ))}
              </div>
            </div>
          )}

          {/* To do — not started yet. Hairline divider above so the
           *  visual break between ACTIVE and TO DO is unmistakable
           *  (matches the divider pattern around AXON Focus / Done).
           *  Quiet tertiary tone — these items are waiting, not
           *  currently demanding action. */}
          {todoItems.length > 0 && (
            <div
              className={[
                "px-4 pt-5 pb-4",
                activeItems.length > 0
                  ? "border-t border-xs border-border/15"
                  : "",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-text-tertiary/70" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground/75">
                  To do
                </span>
                <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
                  {todoItems.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {todoItems.map((s) => (
                  <InboxListItem
                    key={s.task.todo_id}
                    scored={s}
                    isActive={s.task.todo_id === selectedId}
                    onSelect={() => setSelectedId(s.task.todo_id)}
                    showAssignee={showAssignee}
                    avatarsByName={avatarsByName}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state — only renders when both Active and To do
           *  are empty (no focus items handled by their own block). */}
          {activeItems.length === 0 && todoItems.length === 0 && focusTop.length === 0 && (
            <p className="text-[11px] text-text-tertiary italic px-5 py-6">
              Nothing open. Inbox zero.
            </p>
          )}

          {/* Done */}
          {doneTasks.length > 0 && (
            <div className="px-4 pt-4 pb-5 border-t border-xs border-border/15">
              <div className="flex items-center gap-1.5 mb-3 px-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-success">
                  Done
                </span>
                <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
                  {doneTasks.length}
                </span>
              </div>
              <div className="space-y-0.5 opacity-65">
                {doneTasks.map((s) => (
                  <InboxListItem
                    key={s.task.todo_id}
                    scored={s}
                    isActive={s.task.todo_id === selectedId}
                    onSelect={() => setSelectedId(s.task.todo_id)}
                    showAssignee={showAssignee}
                    avatarsByName={avatarsByName}
                  />
                ))}
              </div>
            </div>
          )}
        </ScrollArea>
      </aside>

      {/* ─────────── CENTER PANE: selected task detail ──────────
       *  Now also hosts the activity timeline, suggested actions,
       *  and related tasks (moved out of the deleted right rail).
       *  The TaskDetail component renders them inline below the
       *  description as task "context" rather than as a separate
       *  sidebar fighting for attention. */}
      <main className="overflow-y-auto bg-background">
        {selected ? (
          <TaskDetail
            scored={selected}
            allTasks={tasks}
            onStatusChange={onStatusChange}
            onEditClick={() => setEditingTask(selected.task)}
            showAssignee={showAssignee}
            avatarsByName={avatarsByName}
          />
        ) : (
          <div className="h-full flex items-center justify-center px-8 py-16 text-center">
            <div className="max-w-sm">
              <div className="mx-auto mb-4 h-10 w-10 rounded-none bg-foreground/[0.04] border-xs border-border-soft flex items-center justify-center">
                <ClipboardList className="h-4 w-4 text-text-tertiary" />
              </div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary mb-2">
                {tasks.length === 0 ? "Filters cleared the board" : "Select a task"}
              </div>
              <p className="text-[13px] text-foreground font-semibold mb-1.5">
                {tasks.length === 0 ? "No tasks match these filters." : "Pick a task to inspect."}
              </p>
              <p className="text-[11.5px] text-text-tertiary leading-relaxed">
                {tasks.length === 0
                  ? "Adjust the filter pills above to widen the search."
                  : "AXON Focus pins the most urgent items to the top. Click any task to load full context."}
              </p>
            </div>
          </div>
        )}
      </main>
      </div>{/* /2-pane grid */}

      {/* Edit drawer */}
      <AnimatePresence>
        {editingTask && (
          <TaskEditDrawer
            task={editingTask}
            onClose={() => setEditingTask(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// TaskEditDrawer - slide-in edit form
// ════════════════════════════════════════════════════════════════
export const TaskEditDrawer: React.FC<{
  task: TodosInterface;
  onClose: () => void;
}> = ({ task, onClose }) => {
  const [title, setTitle] = useState(task.title ?? "");
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>((task.priority as TaskPriority) ?? "medium");
  const [status, setStatus] = useState<TaskStatus>((task.status as TaskStatus) ?? "to-do");
  const [deadline, setDeadline] = useState<string>(task.deadline ? task.deadline.slice(0, 10) : "");
  const [label, setLabel] = useState(task.label ?? "");
  const [assigneeText, setAssigneeText] = useState(
    Array.isArray(task.assignee) ? task.assignee.join(", ") : "",
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    title !== (task.title ?? "") ||
    description !== (task.description ?? "") ||
    priority !== task.priority ||
    status !== task.status ||
    deadline !== (task.deadline ? task.deadline.slice(0, 10) : "") ||
    label !== (task.label ?? "") ||
    assigneeText !== (Array.isArray(task.assignee) ? task.assignee.join(", ") : "");

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const priorityOrderMap = { low: 1, medium: 2, high: 3 };
    const assignees = assigneeText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    // Only touch completed_at when the status field actually changed
    // — editing a title or label on an already-done task shouldn't
    // re-stamp its completion time.
    const statusChanged = status !== task.status;
    const patch = {
      title: title.trim(),
      description,
      priority,
      priorityOrder: priorityOrderMap[priority],
      status,
      deadline: deadline ? new Date(deadline + "T23:59:00").toISOString() : task.deadline,
      label: label.trim(),
      assignee: assignees,
      ...(statusChanged && {
        completed_at: status === "done" ? new Date().toISOString() : null,
      }),
    };
    const { error } = await supabase.from("cwa_todos").update(patch).eq("todo_id", task.todo_id);
    setSaving(false);
    if (error) {
      await message(error.message, { title: "Error saving task", kind: "error" });
      return;
    }
    onClose();
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("cwa_todos").delete().eq("todo_id", task.todo_id);
    setDeleting(false);
    if (error) {
      await message(error.message, { title: "Error deleting task", kind: "error" });
      return;
    }
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border-l border-border overflow-y-auto flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3 flex items-center justify-between">
          <div>
            <Tracker tone="muted" size="sm">EDIT TASK #{task.todo_id}</Tracker>
            <h3 className="text-[14px] font-bold tracking-tight text-foreground mt-0.5 truncate max-w-[380px]">
              {task.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-none text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="Close edit drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1">
          <DrawerField label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-background border border-border rounded-none px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
              autoFocus
            />
          </DrawerField>

          <DrawerField label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={8}
              placeholder="What needs to happen? Steps, context, links…"
              className="w-full bg-background border border-border rounded-none px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/60 resize-y leading-relaxed"
            />
            <Mono size="xs" tone="muted">{description.length} chars · whitespace preserved when saved</Mono>
          </DrawerField>

          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Priority">
              <div className="inline-flex items-stretch border border-border rounded-none overflow-hidden w-full">
                {(["low", "medium", "high"] as TaskPriority[]).map((p) => {
                  const meta = PRIORITY_META[p];
                  const active = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className="flex-1 px-2 py-1.5 text-[11px] uppercase tracking-wider font-bold transition-colors"
                      style={{
                        background: active ? `${meta.accent}24` : "transparent",
                        color: active ? meta.accent : "rgb(110,110,116)",
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </DrawerField>
            <DrawerField label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full bg-background border border-border rounded-none px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              >
                <option value="to-do">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </DrawerField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DrawerField label="Deadline">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-background border border-border rounded-none px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </DrawerField>
            <DrawerField label="Label">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Bug, Feature"
                className="w-full bg-background border border-border rounded-none px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </DrawerField>
          </div>

          <DrawerField label="Assignees (comma-separated usernames)">
            <input
              type="text"
              value={assigneeText}
              onChange={(e) => setAssigneeText(e.target.value)}
              placeholder="alice, bob"
              className="w-full bg-background border border-border rounded-none px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
            />
          </DrawerField>

          {task.assigned_by && (
            <Mono size="xs" tone="muted">
              originally assigned by <span className="text-violet-300 font-semibold">{task.assigned_by}</span>
            </Mono>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex items-center justify-between gap-2">
          {confirmDelete ? (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 h-8 rounded-none border border-red-500/40 bg-red-500/15 text-[11px] uppercase tracking-[0.16em] font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                {deleting ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2 h-8 text-[10.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-none text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-8 rounded-none border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {dirty ? "Discard" : "Close"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!title.trim() || !dirty || saving}
              className="inline-flex items-center gap-1.5 px-4 h-8 rounded-none bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.16em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-3 w-3" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DrawerField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <Tracker tone="muted" size="sm" className="mb-1.5">{label}</Tracker>
    {children}
  </div>
);

// ════════════════════════════════════════════════════════════════
// InboxListItem - compact row in the left pane
// ════════════════════════════════════════════════════════════════
const InboxListItem: React.FC<{
  scored: ScoredTask;
  isActive: boolean;
  onSelect: () => void;
  showAssignee: boolean;
  avatarsByName: Map<string, string>;
  focal?: boolean;
}> = ({ scored, isActive, onSelect, showAssignee, avatarsByName, focal }) => {
  const { task, daysLeft } = scored;
  const priority = task.priority as TaskPriority | undefined;
  const pMeta = priority ? PRIORITY_META[priority] : null;
  const status = task.status as TaskStatus;
  const sMeta = STATUS_META[status];
  const names = assigneeNames(task.assignee);

  // Status icon — proper visual signal instead of a tiny dot.
  // Outline circle for to-do, dashed circle for in-progress (subtle
  // motion cue), filled check for done. Tone-coded.
  const StatusIcon =
    status === "done"
      ? CheckCircle2
      : status === "in-progress"
        ? CircleDashed
        : Circle;
  const statusIconCls =
    status === "done"
      ? "text-success"
      : status === "in-progress"
        ? "text-warning"
        : "text-text-tertiary/80";

  return (
    <button
      type="button"
      onClick={onSelect}
      data-active={isActive}
      className={[
        // Linear-style row: tighter padding, real visual presence
        // when active (bg + bold + bigger left rail), clear hover.
        "group relative block w-full rounded-none transition-colors text-left pl-3.5 pr-3 py-2.5",
        isActive
          ? "bg-foreground/[0.09]"
          : "hover:bg-foreground/[0.045]",
      ].join(" ")}
      style={
        // Stronger active rail (3px) so the selected row is unmistakable.
        // Focal but inactive rows get a 2px priority-color rail.
        isActive
          ? { boxShadow: "inset 3px 0 0 hsl(var(--primary))" }
          : focal && pMeta
            ? { boxShadow: `inset 2px 0 0 ${pMeta.accent}` }
            : undefined
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Status icon — 12px, real lucide icon, tone-coded. Reads
         *  at a glance: circle = to-do, dashed = active, check = done. */}
        <StatusIcon
          size={12}
          strokeWidth={2.2}
          className={`shrink-0 ${statusIconCls}`}
        />

        {/* Priority pin — only renders for high. Tiny red flag that
         *  draws the eye to urgent rows without adding text noise to
         *  every row. */}
        {priority === "high" && (
          <Flag
            size={10}
            strokeWidth={2.8}
            className="text-destructive shrink-0 fill-destructive/30"
          />
        )}

        {/* Title — single line, truncated. The title is the row's
         *  anchor; long titles get cut with ellipsis. Bold when
         *  active so the selected row stands out by font weight too. */}
        <span
          className={[
            "flex-1 truncate text-[12.5px] leading-[1.3]",
            isActive ? "font-bold text-foreground" : "font-semibold",
            status === "done" ? "line-through opacity-55" : "",
          ].join(" ")}
        >
          {task.title}
        </span>

        {/* Right-aligned meta cluster — real assignee avatar + due
         *  chip. Always sits at the row's right edge so the eye can
         *  scan a column of dates / faces down the list. */}
        {showAssignee && names.length > 0 && (
          (() => {
            const avatarUrl = avatarsByName.get(names[0]!);
            return (
              <span
                className="relative w-4 h-4 rounded-full overflow-hidden text-[8px] font-bold uppercase flex items-center justify-center text-white shrink-0"
                style={{ background: avatarAccent(names[0]!) }}
                title={names.join(", ")}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={names[0]}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  names[0]!.slice(0, 1)
                )}
              </span>
            );
          })()
        )}
        {daysLeft !== null && (
          <span
            className={[
              "text-[10.5px] tabular-nums shrink-0 font-semibold",
              daysLeft <= 1
                ? "text-destructive"
                : daysLeft <= 3
                  ? "text-warning"
                  : "text-text-tertiary",
            ].join(" ")}
          >
            {daysLeft === 0
              ? "Today"
              : daysLeft === 1
                ? "1d"
                : `${daysLeft}d`}
          </span>
        )}
      </div>
    </button>
  );
};

// ════════════════════════════════════════════════════════════════
// InboxFilterBar — horizontal filter strip above the 3-pane content.
//
// Pulls status pills, priority pills, and search out of the cluttered
// right rail (where they were stacked vertically under FleetCockpit)
// and lays them flat above the inbox. Cleaner UX: page-level controls
// live with the page, task-detail controls stay with the detail.
// ════════════════════════════════════════════════════════════════
const InboxFilterBar: React.FC<{
  filters: InboxFilters;
  stats: InboxStats;
}> = ({ filters, stats }) => {
  const statusLabels: Record<string, string> = {
    all: "All",
    "to-do": "To do",
    "in-progress": "Active",
    done: "Done",
  };
  const statusCounts: Record<string, number> = {
    all: stats.allCount,
    "to-do": stats.todoCount,
    "in-progress": stats.inProgressCount,
    done: stats.doneCount,
  };

  return (
    <div className="px-6 py-2.5 border-b border-xs border-border/15 bg-background/95 flex items-center gap-3 flex-wrap">
      {/* Status pill group */}
      <div className="inline-flex items-center bg-foreground/[0.04] border-xs border-border-soft rounded-none p-0.5">
        {(["all", "to-do", "in-progress", "done"] as const).map((s) => {
          const isActive = filters.status === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => filters.setStatus(s)}
              data-active={isActive}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-[0.10em] transition-colors text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
            >
              {statusLabels[s]}
              <span className="ml-1 opacity-70 tabular-nums">{statusCounts[s]}</span>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <span className="hidden md:inline-block h-4 w-px bg-border-soft" />

      {/* Priority pill group */}
      <div className="inline-flex items-center bg-foreground/[0.04] border-xs border-border-soft rounded-none p-0.5">
        {(["all", "high", "medium", "low"] as const).map((p) => {
          const isActive = filters.priority === p;
          const m = p === "all" ? null : PRIORITY_META[p];
          return (
            <button
              key={p}
              type="button"
              onClick={() => filters.setPriority(p)}
              data-active={isActive}
              className="px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-[0.10em] transition-colors text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
              style={
                isActive && m
                  ? { color: m.accent, background: `${m.accent}1f` }
                  : undefined
              }
            >
              {p === "all" ? "Any" : m?.label}
            </button>
          );
        })}
      </div>

      {/* Search — pushed to the right via ml-auto */}
      <div className="relative flex-1 min-w-[180px] max-w-md ml-auto">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search tasks…"
          value={filters.search}
          onChange={(e) => filters.setSearch(e.target.value)}
          className="w-full pl-7 pr-7 py-1.5 bg-foreground/[0.04] border-xs border-border-soft rounded-none text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors"
        />
        {filters.search && (
          <button
            onClick={() => filters.setSearch("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// TaskDetail - center pane content
// ════════════════════════════════════════════════════════════════
const TaskDetail: React.FC<{
  scored: ScoredTask;
  allTasks: TodosInterface[];
  onStatusChange: (id: number, status: TaskStatus) => void;
  onEditClick: () => void;
  showAssignee: boolean;
  avatarsByName: Map<string, string>;
}> = ({ scored, allTasks, onStatusChange, onEditClick, showAssignee, avatarsByName }) => {
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

  // Activity timeline — same synthesis as the old TaskActivityRail.
  // Three possible events: created, moved to active, marked done.
  const created = task.created_at ? new Date(task.created_at) : null;
  const timeline: { when: string; title: string; subtitle: string }[] = [];
  if (status === "done")
    timeline.push({
      when: "Recently",
      title: "Marked done",
      subtitle: "AXON closed the loop.",
    });
  if (status === "in-progress")
    timeline.push({
      when: "Recently",
      title: "Moved to active",
      subtitle: "AXON is watching for sign-off.",
    });
  if (created) {
    const label =
      daysSinceCreated === 0
        ? "Today"
        : daysSinceCreated === 1
          ? "Yesterday"
          : `${daysSinceCreated}d ago`;
    timeline.push({
      when: label,
      title: "Task created",
      subtitle: created.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    });
  }

  // Related tasks — same priority or shared assignee, not done.
  const related = allTasks
    .filter((t) => t.todo_id !== task.todo_id && t.status !== "done")
    .filter(
      (t) =>
        t.priority === task.priority ||
        assigneeNames(t.assignee).some((n) => names.includes(n)),
    )
    .slice(0, 4);

  return (
    // Centered reading column. Wider now (760px) since the right
    // rail is gone and the column has more real estate to use.
    <div className="mx-auto max-w-[760px] px-6 lg:px-8 py-7">
      {/* Tiny breadcrumb — quiet, doesn't fight for attention. */}
      <div className="flex items-center gap-1.5 mb-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
        <span>Task</span>
        <span className="opacity-40">/</span>
        <span className="tabular-nums">#{task.todo_id}</span>
      </div>

      {/* Hero title — the only large typography on the page. */}
      <h1
        className={[
          "font-bold text-foreground leading-[1.15] mb-4",
          status === "done" ? "line-through opacity-60" : "",
        ].join(" ")}
        style={{
          fontFamily: 'var(--ed-font-display, Inter), system-ui, sans-serif',
          fontSize: "clamp(22px, 2.2vw, 28px)",
          letterSpacing: "-0.02em",
        }}
      >
        {task.title}
      </h1>

      {/* Inline metadata strip — chips and facts on a single wrapped
       *  row. Replaces the old 4-box `MetricMini` grid which made the
       *  detail pane feel like an admin form. */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <span
          className={["inline-flex items-center gap-1.5 rounded-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]", sMeta.text].join(" ")}
          style={{ background: sMeta.tint }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sMeta.dot }} />
          {sMeta.label}
        </span>
        {pMeta && (
          <span
            className="inline-flex items-center gap-1 rounded-none px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.10em]"
            style={{
              background: `${pMeta.accent}14`,
              color: pMeta.accent,
              border: `1px solid ${pMeta.accent}33`,
            }}
          >
            <Flag size={8} strokeWidth={3} />
            {pMeta.label}
          </span>
        )}
        {daysLeft !== null && (
          <span
            className={[
              "inline-flex items-center gap-1 text-[11.5px] font-medium",
              daysLeft <= 1 ? "text-destructive" : "text-text-secondary",
            ].join(" ")}
          >
            <Calendar size={11} strokeWidth={2.5} />
            {daysLeft === 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : `${daysLeft}d left`}
          </span>
        )}
        {showAssignee && names.length > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <AvatarStack names={names} avatarsByName={avatarsByName} />
            <span className="text-[11.5px] text-text-secondary">{names.join(", ")}</span>
          </span>
        )}
        {/* Separator dot between primary chips and quiet meta */}
        {(daysSinceCreated !== null || task.label) && (
          <span className="text-text-tertiary/40">·</span>
        )}
        {daysSinceCreated !== null && (
          <span className="text-[11.5px] text-text-tertiary tabular-nums">
            Created {daysSinceCreated}d ago
          </span>
        )}
        {task.label && (
          <span className="inline-flex items-center gap-1 text-[11.5px] text-text-tertiary">
            <Briefcase size={10} />
            {task.label}
          </span>
        )}
      </div>

      {/* "Assigned by" line — quieter inline note (not a chip).
       *  Real avatar img with colored-initial fallback. */}
      {task.assigned_by && (
        <div className="inline-flex items-center gap-1.5 mb-5 text-[11.5px]">
          <span className="text-text-tertiary">Assigned by</span>
          {(() => {
            const assignedByAvatar = avatarsByName.get(task.assigned_by);
            return (
              <span
                className="relative w-4 h-4 rounded-full overflow-hidden text-[8.5px] font-bold uppercase flex items-center justify-center text-white"
                style={{ background: avatarAccent(task.assigned_by) }}
              >
                {assignedByAvatar ? (
                  <img
                    src={assignedByAvatar}
                    alt={task.assigned_by}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  task.assigned_by.slice(0, 1)
                )}
              </span>
            );
          })()}
          <span className="font-semibold text-foreground/85">{task.assigned_by}</span>
        </div>
      )}

      {/* Action row — compressed: less vertical spacing, no full
       *  border-bottom (the AXON callout below provides the visual
       *  break). */}
      <div className="flex items-center gap-2 mb-5">
        {nextStatus && (
          <button
            type="button"
            onClick={() => onStatusChange(task.todo_id, nextStatus)}
            className={[
              "inline-flex items-center gap-1.5 rounded-none px-3.5 py-2 text-[12px] font-bold transition-opacity hover:opacity-90",
              nextStatus === "in-progress"
                ? "bg-primary text-primary-foreground"
                : "bg-success text-background",
            ].join(" ")}
          >
            {nextStatus === "in-progress" ? "Start task" : "Mark as done"}
            <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}
        {status === "in-progress" && (
          <button
            type="button"
            onClick={() => onStatusChange(task.todo_id, "to-do")}
            className="inline-flex items-center gap-1.5 rounded-none border-xs border-border-soft px-3.5 py-2 text-[12px] font-semibold text-text-secondary hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
          >
            Move back
          </button>
        )}
        <button
          type="button"
          onClick={onEditClick}
          className="inline-flex items-center gap-1.5 rounded-none border-xs border-border-soft px-3.5 py-2 text-[12px] font-semibold text-text-secondary hover:text-foreground hover:bg-foreground/[0.04] transition-colors ml-auto"
        >
          <Edit3 className="h-3 w-3" />
          Edit
        </button>
      </div>

      {/* AXON callout — compact: smaller icon chip, single-line label
       *  on the left of the body, no caps header. ~50% the height of
       *  the previous version. */}
      <div className="mb-6 rounded-none border-xs border-primary/20 bg-primary/[0.04] px-3 py-2.5 flex items-center gap-2.5">
        <div className="w-5 h-5 rounded bg-primary/15 flex items-center justify-center shrink-0">
          <Sparkles size={11} className="text-primary" />
        </div>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-primary shrink-0">
          Axon
        </span>
        <span className="text-text-tertiary/60 shrink-0">·</span>
        <p className="text-[12.5px] text-foreground/85 leading-snug">
          {status === "done"
            ? `Closed and accounted for. No further action needed.`
            : daysLeft !== null && daysLeft <= 1
              ? `${daysLeft === 0 ? "Due today" : "Due tomorrow"} — highest-urgency item on the board. Mark done when shipped.`
              : status === "in-progress"
                ? `Already in motion. Watching for sign-off — mark done when the work lands.`
                : `${rationale}. ${pMeta ? `Priority is ${pMeta.label.toLowerCase()}. ` : ""}Tap Start to commit to this one next.`}
        </p>
      </div>

      {/* Description — proper prose. */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Description
          </div>
          {task.description && (
            <span className="text-[10.5px] tabular-nums text-text-tertiary">
              {task.description.length} chars
            </span>
          )}
        </div>
        {task.description ? (
          // Collapse runs of 3+ newlines into 2 so we don't get
          // giant vertical gaps between paragraphs when the original
          // text has accidental empty lines (a common cut-and-paste
          // artifact). Two newlines still produce a real paragraph
          // break, just without the dead space.
          <div className="text-[13.5px] text-foreground/90 leading-[1.65] whitespace-pre-wrap">
            {task.description.replace(/\n{3,}/g, "\n\n")}
          </div>
        ) : (
          <p className="text-[12.5px] text-text-tertiary italic">
            No description on file. Click Edit to add one.
          </p>
        )}
      </section>

      {/* ── Footer context ─────────────────────────────────────────
       *  Activity timeline, suggested next steps, and related tasks
       *  used to live in a separate right-rail aside. Folding them
       *  into the bottom of the task detail gives them room to
       *  breathe and turns the long empty stretch below the
       *  description into useful context. */}
      <div className="mt-10 pt-7 border-t border-xs border-border/15 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-7">
        {/* Activity timeline — left column on md+. Vertical thread
         *  with small dot anchors and a connecting hairline. */}
        <section>
          <div className="flex items-center gap-1.5 mb-3.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
              Activity
            </span>
          </div>
          <ul className="space-y-3.5 list-none p-0 m-0">
            {timeline.map((ev, i) => (
              <li key={i} className="relative pl-4 list-none">
                <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full bg-primary/80" />
                {i < timeline.length - 1 && (
                  <span className="absolute left-[3px] top-3 bottom-[-14px] w-px bg-border/30" />
                )}
                <p className="text-[12px] text-foreground font-semibold leading-snug">
                  {ev.title}
                </p>
                <p className="text-[11px] text-text-tertiary leading-snug mt-0.5">
                  {ev.subtitle}
                </p>
                <p className="text-[10px] text-text-tertiary/70 mt-1 font-medium uppercase tracking-wider">
                  {ev.when}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Suggested next + Related — right column on md+. */}
        <div className="space-y-7">
          {(nextStatus || status !== "done") && (
            <section>
              <div className="flex items-center gap-1.5 mb-3.5">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                  Suggested next
                </span>
              </div>
              <div className="space-y-1.5">
                {nextStatus && (
                  <button
                    type="button"
                    onClick={() => onStatusChange(task.todo_id, nextStatus)}
                    className="w-full rounded-none border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-border/25 px-3 py-2.5 flex items-center gap-2 text-left transition-colors group"
                  >
                    {nextStatus === "in-progress" ? (
                      <Clock size={13} className="text-primary shrink-0" />
                    ) : (
                      <CheckCircle size={13} className="text-success shrink-0" />
                    )}
                    <p className="flex-1 text-[12px] text-foreground font-medium leading-snug">
                      {nextStatus === "in-progress"
                        ? "Start this task now"
                        : "Mark this task as done"}
                    </p>
                    <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
                {status !== "done" && (
                  <button
                    type="button"
                    onClick={onEditClick}
                    className="w-full rounded-none border-xs border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-border/25 px-3 py-2.5 flex items-center gap-2 text-left transition-colors group"
                  >
                    <Flag size={13} className="text-warning shrink-0" />
                    <p className="flex-1 text-[12px] text-foreground font-medium leading-snug">
                      Reassign or change priority
                    </p>
                    <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                )}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section>
              <div className="flex items-center gap-1.5 mb-3.5">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                  Related
                </span>
                <span className="text-[10px] font-bold tabular-nums text-text-tertiary ml-0.5">
                  {related.length}
                </span>
              </div>
              <ul className="space-y-0.5 list-none p-0 m-0">
                {related.map((r) => {
                  const pAccent = r.priority
                    ? PRIORITY_META[r.priority as TaskPriority].accent
                    : "rgb(110,110,116)";
                  return (
                    <li
                      key={r.todo_id}
                      className="list-none rounded-none border-xs border-transparent hover:border-border-soft hover:bg-foreground/[0.04] px-2 py-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-1 h-1 rounded-full shrink-0"
                          style={{ background: pAccent }}
                        />
                        <span className="text-[11.5px] font-semibold text-foreground truncate flex-1">
                          {r.title}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// TaskActivityRail removed — its content (activity timeline,
// suggested actions, related tasks) is now rendered inline at the
// bottom of TaskDetail. Page is 2-pane: list + rich detail.
// ════════════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════════════
// (FleetCockpit + CockpitStat removed — page-level filters/search/
//  completion now live in InboxFilterBar above the 3-pane grid and
//  the toolbar at the top of the page. Right rail is task-only.)
// ════════════════════════════════════════════════════════════════
