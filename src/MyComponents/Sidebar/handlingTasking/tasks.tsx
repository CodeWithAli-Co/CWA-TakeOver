/**
 * tasks.tsx — Full-page task management.
 *
 * Sections:
 *   1. Header          — title + task count + Add Task button
 *   2. Stats strip     — one unified card with Total / To Do / Active / Done / Completion%
 *   3. View toggle     — List | Kanban
 *   4. Filter bar      — status pills + priority pills + search + assignee filter
 *   5. Task display    — List rows OR 3-column Kanban with drag-ready move buttons
 */

import React, { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Calendar, CheckCircle, ClipboardList, Clock,
  AlertCircle, ChevronRight, List, LayoutGrid, Users, X, Flag,
} from "lucide-react";
import { ActiveUser, Employees, Todos, TodosInterface } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "./addTodo";

export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "to-do" | "in-progress" | "done";

const priorityColors: Record<TaskPriority, string> = {
  high: "bg-primary/[0.08] text-primary border-primary/15",
  medium: "bg-amber-500/[0.06] text-amber-400/80 border-amber-500/10",
  low: "bg-muted/50 text-muted-foreground/70 border-border",
};

const statusColors: Record<TaskStatus, { dot: string; text: string; bg: string }> = {
  "to-do": { dot: "bg-amber-400", text: "text-amber-400", bg: "bg-amber-500/[0.08]" },
  "in-progress": { dot: "bg-blue-400", text: "text-blue-400", bg: "bg-blue-500/[0.08]" },
  done: { dot: "bg-emerald-400", text: "text-emerald-400", bg: "bg-emerald-500/[0.08]" },
};

// ════════════════════════════════════════
// TaskItem — list view row
// ════════════════════════════════════════
const TaskItem: React.FC<{
  task: TodosInterface;
  onStatusChange: (id: number, status: TaskStatus) => void;
}> = ({ task, onStatusChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const nextStatus: TaskStatus | null =
    task.status === "to-do" ? "in-progress" :
    task.status === "in-progress" ? "done" : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="bg-card border border-border hover:border-primary/10 rounded-sm transition-all duration-300 overflow-hidden group"
    >
      {/* Header row */}
      <div
        className="px-4 py-3 flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Status dot */}
        <div className={`h-1.5 w-1.5 rounded-full ${statusColors[task.status as TaskStatus]?.dot || "bg-white/20"} shrink-0`} />

        {/* Title + priority */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-foreground/80 truncate">
              {task.title}
            </span>
            {task.priority && (
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${priorityColors[task.priority]}`}>
                {task.priority}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/50">
            {task.deadline && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {task.deadline}
              </span>
            )}
            {task.assignee && task.assignee.length > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {Array.isArray(task.assignee) ? task.assignee.join(", ") : task.assignee}
              </span>
            )}
            {task.label && (
              <span className="flex items-center gap-1">
                <Flag className="h-3 w-3" /> {task.label}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {nextStatus && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.todo_id, nextStatus);
              }}
              className={`text-[11px] px-2.5 py-1 rounded-sm transition-colors ${
                nextStatus === "in-progress"
                  ? "bg-blue-500/[0.08] hover:bg-blue-500/[0.15] text-blue-400 border border-blue-500/15"
                  : "bg-emerald-500/[0.08] hover:bg-emerald-500/[0.15] text-emerald-400 border border-emerald-500/15"
              }`}
            >
              {nextStatus === "in-progress" ? "Start" : "Finish"}
            </button>
          )}
        </div>

        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform shrink-0 ${isExpanded ? "rotate-90" : ""}`}
        />
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="px-4 py-3 space-y-2">
              {task.description ? (
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-[12px] text-foreground/60 leading-relaxed">{task.description}</p>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground/60 italic">No description</p>
              )}

              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-muted-foreground/40">
                  Created {task.created_at ? new Date(task.created_at).toLocaleDateString() : "—"}
                </span>
                {task.priorityOrder && (
                  <span className="text-[10px] text-muted-foreground/40">
                    Priority order: {task.priorityOrder}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ════════════════════════════════════════
// KanbanCard — compact card for Kanban view
// ════════════════════════════════════════
const KanbanCard: React.FC<{
  task: TodosInterface;
  onStatusChange: (id: number, status: TaskStatus) => void;
}> = ({ task, onStatusChange }) => {
  const nextStatus: TaskStatus | null =
    task.status === "to-do" ? "in-progress" :
    task.status === "in-progress" ? "done" : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="bg-muted/30 border border-border hover:border-primary/10 rounded-sm p-3 transition-all group"
    >
      <div className="flex items-start justify-between mb-1.5 gap-2">
        <h4 className="text-[12px] font-medium text-foreground/80 leading-snug flex-1">
          {task.title}
        </h4>
        {task.priority && (
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border shrink-0 ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>
        )}
      </div>
      {task.description && (
        <p className="text-[11px] text-muted-foreground leading-snug mb-2 line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-2 text-[10px] text-muted-foreground/50 mb-2">
        {task.deadline && (
          <span className="flex items-center gap-0.5">
            <Calendar className="h-2.5 w-2.5" /> {task.deadline}
          </span>
        )}
        {task.assignee && (
          <span className="flex items-center gap-0.5">
            <Users className="h-2.5 w-2.5" />
            {Array.isArray(task.assignee) ? task.assignee[0] : task.assignee}
          </span>
        )}
      </div>

      {nextStatus && (
        <div className="pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onStatusChange(task.todo_id, nextStatus)}
            className="w-full text-[10px] text-primary hover:text-red-300 flex items-center justify-center gap-0.5"
          >
            {nextStatus === "in-progress" ? "Start" : "Mark done"}
            <ChevronRight className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
};

// ════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════
const TaskSettings: React.FC = () => {
  const { data: AllEmployees } = Employees();
  const { data: user } = ActiveUser();
  const { data: todos, refetch: refetchTodos } = Todos(user?.[0]?.username);

  const [statusFilter, setStatusFilter] = useState<"all" | TaskStatus>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"list" | "kanban">("list");

  // Proper realtime subscription with cleanup
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
  }, [refetchTodos]);

  const todosList = todos || [];

  // Stats from embedded counts in query result
  const todoCount = todosList.length > 0 ? todosList[0]?.todoCount || 0 : 0;
  const inProgressCount = todosList.length > 0 ? todosList[0]?.inProgressCount || 0 : 0;
  const doneCount = todosList.length > 0 ? todosList[0]?.doneCount || 0 : 0;
  const allCount = todosList.length > 0 ? todosList[0]?.allCount || 0 : todosList.length;
  const completionPct = allCount > 0 ? (doneCount / allCount) * 100 : 0;

  // Status change handler
  const handleStatusChange = async (id: number, status: TaskStatus) => {
    const { error } = await supabase
      .from("cwa_todos")
      .update({ status })
      .eq("todo_id", id);
    if (error) {
      await message(error.message, { title: "Error updating task", kind: "error" });
    }
  };

  // Filtered tasks
  const filtered = todosList.filter((task) => {
    const matchesSearch =
      task?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task?.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || task?.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || task?.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="min-h-screen bg-background overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-foreground tracking-tight">Tasks</h1>
              <p className="text-[12px] text-muted-foreground/60 mt-0.5">
                {allCount} total · {doneCount} completed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-muted/30 border border-border rounded-sm p-0.5">
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded-sm transition-colors ${
                  view === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-muted-foreground/80"
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`p-1.5 rounded-sm transition-colors ${
                  view === "kanban" ? "bg-primary/10 text-primary" : "text-muted-foreground/50 hover:text-muted-foreground/80"
                }`}
                title="Kanban view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            <AddTodo Users={AllEmployees || []} />
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div className="px-8 pt-5">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="flex">
            {/* Progress */}
            <div className="flex-1 px-5 py-4 border-r border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em] font-medium">
                  Completion
                </span>
                <span className="text-[18px] font-bold text-foreground tracking-tight">
                  {completionPct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {doneCount} of {allCount} tasks done
              </p>
            </div>

            <div className="px-5 py-4 border-r border-border min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertCircle className="h-3 w-3 text-amber-500/60" />
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em]">To Do</span>
              </div>
              <p className="text-xl font-bold text-amber-400 tracking-tight">{todoCount}</p>
            </div>
            <div className="px-5 py-4 border-r border-border min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-blue-500/60" />
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em]">Active</span>
              </div>
              <p className="text-xl font-bold text-blue-400 tracking-tight">{inProgressCount}</p>
            </div>
            <div className="px-5 py-4 border-r border-border min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle className="h-3 w-3 text-emerald-500/60" />
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em]">Done</span>
              </div>
              <p className="text-xl font-bold text-emerald-400 tracking-tight">{doneCount}</p>
            </div>
            <div className="px-5 py-4 min-w-[110px]">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="h-3 w-3 text-primary/60" />
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.12em]">Total</span>
              </div>
              <p className="text-xl font-bold text-foreground tracking-tight">{allCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-8 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status pills */}
          <div className="flex items-center bg-muted/30 border border-border rounded-sm p-0.5">
            {(["all", "to-do", "in-progress", "done"] as const).map((s) => {
              const counts: Record<string, number> = { all: allCount, "to-do": todoCount, "in-progress": inProgressCount, done: doneCount };
              const labels: Record<string, string> = { all: "All", "to-do": "To Do", "in-progress": "Active", done: "Done" };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-sm text-[11px] font-medium transition-all ${
                    statusFilter === s
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground/50 hover:text-muted-foreground/80"
                  }`}
                >
                  {labels[s]} ({counts[s]})
                </button>
              );
            })}
          </div>

          {/* Priority pills */}
          <div className="flex items-center bg-muted/30 border border-border rounded-sm p-0.5">
            {(["all", "high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition-all ${
                  priorityFilter === p
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground/50 hover:text-muted-foreground/80"
                }`}
              >
                {p === "all" ? "Any priority" : p}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-xs px-3 py-1.5 bg-muted/30 border border-border rounded-sm text-[12px] text-foreground/60 placeholder:text-muted-foreground/40 focus:outline-none focus:border-border"
          />

          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="p-1.5 rounded-sm bg-muted/30 text-muted-foreground hover:text-foreground/60">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Task display */}
      <div className="px-8 py-5 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-sm py-16 text-center">
            <ClipboardList className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
            <p className="text-[14px] text-muted-foreground font-medium mb-1">
              {allCount === 0 ? "No tasks yet" : "No tasks match your filters"}
            </p>
            <p className="text-[12px] text-muted-foreground/40">
              {allCount === 0 ? "Create one to get started" : "Try different filters or clear search"}
            </p>
          </div>
        ) : view === "list" ? (
          <ScrollArea className="h-[calc(100vh-340px)]">
            <div className="space-y-2 pr-3">
              <AnimatePresence>
                {filtered.map((task) => (
                  <TaskItem key={task.todo_id} task={task} onStatusChange={handleStatusChange} />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        ) : (
          // Kanban view — 3 columns
          <div className="grid grid-cols-3 gap-4">
            {(["to-do", "in-progress", "done"] as TaskStatus[]).map((status) => {
              const colTasks = filtered.filter((t) => t.status === status);
              const c = statusColors[status];
              const label = status === "to-do" ? "To Do" : status === "in-progress" ? "Active" : "Done";

              return (
                <div key={status} className="bg-card border border-border rounded-sm overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                      <span className={`text-[11px] uppercase tracking-wider font-medium ${c.text}`}>
                        {label}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <ScrollArea className="h-[calc(100vh-400px)]">
                    <div className="p-2 space-y-2">
                      <AnimatePresence>
                        {colTasks.length === 0 ? (
                          <div className="text-[11px] text-muted-foreground/40 text-center py-6">
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

export default TaskSettings;
