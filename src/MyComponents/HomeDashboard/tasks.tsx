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
      className="relative group flex items-stretch rounded-md bg-card/50 hover:bg-card/80 border border-white/[0.04] hover:border-white/[0.08] transition-all"
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
    <div className="relative bg-card border border-border rounded-md h-full overflow-hidden flex flex-col">
      {/* Ambient accent rail at top */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-primary/40 to-transparent pointer-events-none" />

      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-md bg-gradient-to-br from-primary/15 to-primary/[0.03] border border-primary/20">
            <ListTodo className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground/80 uppercase tracking-[0.18em] font-semibold">
                Tasks
              </span>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums">{totalTasks}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/60 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                CWA {cwaCount}
              </span>
              <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/60 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                Simpl {simpCount}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Input
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[140px] h-7 text-[11px] bg-muted/30 border-border placeholder:text-muted-foreground/40 focus:border-primary/30"
          />
          <AddTodo Users={AllEmployees || []} homeDash />
        </div>
      </div>

      <div className="px-5 pb-4">
        <Tabs value={selectedTab} className="mb-3" onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="bg-muted/30 border border-border rounded-md h-7 p-0.5">
            <TabsTrigger
              value="to-do"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[inset_0_-2px_0_rgba(var(--brand-accent-rgb),0.8)] text-muted-foreground/80 rounded-[4px] text-[10.5px] h-6 px-3 font-semibold uppercase tracking-wider"
            >
              Open · {todoCount}
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              className="data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-300 text-muted-foreground/80 rounded-[4px] text-[10.5px] h-6 px-3 font-semibold uppercase tracking-wider"
            >
              Active · {inProgressCount}
            </TabsTrigger>
            <TabsTrigger
              value="done"
              className="data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-300 text-muted-foreground/80 rounded-[4px] text-[10.5px] h-6 px-3 font-semibold uppercase tracking-wider"
            >
              Done · {doneCount}
            </TabsTrigger>
          </TabsList>
        </Tabs>
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
