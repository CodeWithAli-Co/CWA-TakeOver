import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "@/MyComponents/Sidebar/handlingTasking/addTodo";
import { useEffect, useState } from "react";
import supabase from "@/MyComponents/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ActiveUser, Employees, Todos } from "@/stores/query";
import {
  ListTodo,
  Flame,
  Zap,
  Leaf,
  Circle,
  PlayCircle,
  CheckCircle2,
  CalendarClock,
  Building2,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/shadcnComponents/input";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";

// ── Company accent tokens ──────────────────────────────────────
// CWA = red, Simplicity = teal. We tint everything at the row level.
const COMPANY_STYLE = {
  CodeWithAli: {
    label: "CWA",
    dot: "bg-red-500",
    glow: "shadow-[0_0_10px_rgba(220,38,38,0.4)]",
    border: "border-red-500/25",
    pill: "bg-red-500/[0.08] text-red-300/80 border-red-500/15",
    rail: "bg-gradient-to-b from-red-500/60 to-red-500/10",
  },
  simplicity: {
    label: "SIMPL",
    dot: "bg-teal-400",
    glow: "shadow-[0_0_10px_rgba(20,184,166,0.45)]",
    border: "border-teal-400/30",
    pill: "bg-teal-500/[0.08] text-teal-300/85 border-teal-400/20",
    rail: "bg-gradient-to-b from-teal-400/70 to-teal-400/10",
  },
} as const;

type CompanyKey = keyof typeof COMPANY_STYLE;
function companyStyle(co: string | undefined | null) {
  if (co === "simplicity") return COMPANY_STYLE.simplicity;
  return COMPANY_STYLE.CodeWithAli;
}

// ── Priority chip ──────────────────────────────────────────────
const PRIORITY_STYLE: Record<
  "high" | "medium" | "low",
  { icon: typeof Flame; label: string; className: string }
> = {
  high:   { icon: Flame,  label: "High",   className: "text-red-400/85 bg-red-500/[0.08] border-red-500/20" },
  medium: { icon: Zap,    label: "Medium", className: "text-amber-300/85 bg-amber-500/[0.08] border-amber-500/20" },
  low:    { icon: Leaf,   label: "Low",    className: "text-emerald-300/85 bg-emerald-500/[0.08] border-emerald-500/20" },
};

const STATUS_STYLE: Record<
  string,
  { icon: typeof Circle; chip: string }
> = {
  "to-do":       { icon: Circle,       chip: "text-muted-foreground" },
  "in-progress": { icon: PlayCircle,   chip: "text-amber-300" },
  "done":        { icon: CheckCircle2, chip: "text-emerald-300" },
};

// ── Deadline helper ────────────────────────────────────────────
function formatDeadline(iso: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(diffMs / dayMs);
  if (diffDays < -1) return `Overdue · ${Math.abs(diffDays)}d`;
  if (diffDays === -1) return "Overdue · yesterday";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── Single task row ────────────────────────────────────────────
function TaskItem({ task }: { task: any }) {
  const co = companyStyle(task.company);
  const prio = PRIORITY_STYLE[(task.priority as keyof typeof PRIORITY_STYLE) ?? "low"] ?? PRIORITY_STYLE.low;
  const Stat = STATUS_STYLE[task.status]?.icon ?? Circle;

  const overdue =
    task.deadline &&
    task.status !== "done" &&
    new Date(task.deadline).getTime() < Date.now();

  async function setStatus(next: string) {
    const { error } = await supabase
      .from("cwa_todos")
      .update({ status: next })
      .eq("todo_id", task.todo_id);
    if (error) {
      await message(error.message, { title: "Error updating task", kind: "error" });
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="relative group flex items-stretch rounded-md bg-zinc-950/40 border border-zinc-800"
    >
      {/* Left rail — company color */}
      <div className={`w-[3px] rounded-l-md ${co.rail}`} />

      <div className="flex-1 min-w-0 flex items-center gap-3 py-2.5 pl-3 pr-3">
        {/* Status icon */}
        <Stat className={`h-3.5 w-3.5 shrink-0 ${STATUS_STYLE[task.status]?.chip ?? ""}`} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium text-foreground/90 truncate">
              {task.title}
            </span>

            {/* Priority chip */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-[1px] text-[9.5px] uppercase tracking-wider font-semibold border rounded-sm ${prio.className}`}
            >
              <prio.icon className="h-2.5 w-2.5" />
              {prio.label}
            </span>

            {/* Company pill */}
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-[1px] text-[9.5px] uppercase tracking-wider font-semibold border rounded-sm ${co.pill}`}
              title={(task.company as CompanyKey) ?? "CodeWithAli"}
            >
              <Building2 className="h-2.5 w-2.5" />
              {co.label}
            </span>
          </div>

          {task.deadline && (
            <div
              className={`flex items-center gap-1 mt-0.5 text-[10.5px] ${
                overdue ? "text-red-400/90 font-medium" : "text-muted-foreground/65"
              }`}
            >
              <CalendarClock className="h-2.5 w-2.5" />
              {formatDeadline(task.deadline)}
            </div>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status === "to-do" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              className={`text-[10px] px-2.5 py-1 rounded-sm bg-muted/40 hover:bg-amber-500/10 hover:text-amber-300 border border-border hover:border-amber-500/30 text-muted-foreground transition-all`}
              onClick={() => setStatus("in-progress")}
            >
              Start
            </motion.button>
          )}
          {task.status === "in-progress" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="text-[10px] px-2.5 py-1 rounded-sm bg-muted/40 hover:bg-emerald-500/10 hover:text-emerald-300 border border-border hover:border-emerald-500/30 text-muted-foreground transition-all"
              onClick={() => setStatus("done")}
            >
              Done
            </motion.button>
          )}
          {task.status === "done" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="text-[10px] px-2.5 py-1 rounded-sm bg-muted/40 hover:bg-muted/60 border border-border text-muted-foreground/60 hover:text-foreground/80 transition-all"
              onClick={() => setStatus("to-do")}
            >
              Reopen
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Main widget ─────────────────────────────────────────────────
export const TasksComponent = () => {
  const [selectedTab, setSelectedTab] = useState<"to-do" | "in-progress" | "done">("to-do");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: AllEmployees } = Employees();
  const { data: user } = ActiveUser();
  const {
    data: todos,
    refetch: refetchTodos,
  } = Todos(user?.[0]?.username);

  useEffect(() => {
    const subscription = supabase
      .channel("all-todos")
      .on("postgres_changes", { event: "*", schema: "public", table: "cwa_todos" }, () => refetchTodos())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [refetchTodos]);

  useEffect(() => {
    if (user && user.length > 0) refetchTodos();
  }, [selectedTab, user]);

  const filteredTasks = (todos ?? []).filter((task: any) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      task.title.toLowerCase().includes(q) ||
      (task.description && task.description.toLowerCase().includes(q));
    return matchesSearch && task.status === selectedTab;
  });

  const todoCount = todos?.filter((t: any) => t.status === "to-do").length ?? 0;
  const inProgressCount = todos?.filter((t: any) => t.status === "in-progress").length ?? 0;
  const doneCount = todos?.filter((t: any) => t.status === "done").length ?? 0;
  const totalTasks = todos?.length ?? 0;

  // Company distribution summary for the header badge.
  const cwaCount = todos?.filter((t: any) => !t.company || t.company === "CodeWithAli").length ?? 0;
  const simpCount = todos?.filter((t: any) => t.company === "simplicity").length ?? 0;

  return (
    <div className="relative bg-zinc-950/40 border border-zinc-800 rounded-lg h-full overflow-hidden flex flex-col">
      {/* Single-row header — title + counts + filter tabs + search + add,
          all on one line so the body has more room for the actual task
          list. Title block collapses CWA/Simpl badges inline so the
          header doesn't get vertically tall. */}
      <div className="px-5 py-2.5 flex items-center gap-4 bg-zinc-900/50 border-b border-zinc-800">
        {/* Left: title + counts, inline */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div className="p-1.5 rounded-md bg-gradient-to-br from-primary/15 to-primary/[0.03] border border-primary/20">
            <ListTodo className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] text-foreground/85 uppercase tracking-[0.16em] font-semibold">
              Tasks
            </span>
            <span className="text-[10.5px] text-zinc-500 tabular-nums">{totalTasks}</span>
            <span className="text-zinc-700">·</span>
            <span className="inline-flex items-center gap-1 text-[9.5px] text-zinc-400 uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-red-500" />
              CWA {cwaCount}
            </span>
            <span className="inline-flex items-center gap-1 text-[9.5px] text-zinc-400 uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-teal-400" />
              Simpl {simpCount}
            </span>
          </div>
        </div>

        {/* Middle: filter tabs (was below the header) */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="bg-zinc-950/60 border border-zinc-800 rounded-md h-7 p-0.5">
            <TabsTrigger
              value="to-do"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-zinc-400 rounded-[4px] text-[10.5px] h-6 px-2.5 font-semibold uppercase tracking-wider"
            >
              Open · {todoCount}
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              className="data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 text-zinc-400 rounded-[4px] text-[10.5px] h-6 px-2.5 font-semibold uppercase tracking-wider"
            >
              Active · {inProgressCount}
            </TabsTrigger>
            <TabsTrigger
              value="done"
              className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 text-zinc-400 rounded-[4px] text-[10.5px] h-6 px-2.5 font-semibold uppercase tracking-wider"
            >
              Done · {doneCount}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        {/* Right: modern search input with icon + clean add button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 pointer-events-none" />
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[170px] h-7 pl-7 pr-2 text-[11px] bg-zinc-950/60 border border-zinc-800 placeholder:text-zinc-500 text-zinc-200 focus:border-zinc-600 focus-visible:ring-0 rounded-md"
            />
          </div>
          <AddTodo Users={AllEmployees || []} homeDash />
        </div>
      </div>

      <div className="px-5 pb-5 flex-1 min-h-0">
        {filteredTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <ListTodo className="h-8 w-8 text-white/[0.06] mb-2" />
            <p className="text-[12.5px] text-muted-foreground/50">
              No {selectedTab === "to-do" ? "open" : selectedTab} tasks
            </p>
            <p className="text-[10.5px] text-muted-foreground/30 mt-1">
              {selectedTab === "to-do"
                ? "You're clear — ask AXON to add one."
                : "Nothing here."}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[340px]">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={selectedTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="space-y-1.5"
              >
                {filteredTasks.map((task: any) => (
                  <TaskItem key={task.todo_id} task={task} />
                ))}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default TasksComponent;
