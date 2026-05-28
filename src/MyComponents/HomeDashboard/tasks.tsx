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

// ── Company accent (left rail only — no second pill on the row) ──
const COMPANY_STYLE = {
  CodeWithAli: { label: "CWA",   rail: "bg-primary",      dot: "bg-primary" },
  simplicity:  { label: "SIMPL", rail: "bg-teal-400",     dot: "bg-teal-400" },
} as const;

type CompanyKey = keyof typeof COMPANY_STYLE;
function companyStyle(co: string | undefined | null) {
  if (co === "simplicity") return COMPANY_STYLE.simplicity;
  return COMPANY_STYLE.CodeWithAli;
}

// ── Priority — colored dot + label, no bordered pill ───────────
const PRIORITY_STYLE: Record<
  "high" | "medium" | "low",
  { dot: string; label: string; text: string }
> = {
  high:   { dot: "bg-destructive", label: "High",   text: "text-destructive" },
  medium: { dot: "bg-warning",     label: "Medium", text: "text-warning" },
  low:    { dot: "bg-success",     label: "Low",    text: "text-success" },
};

const STATUS_STYLE: Record<
  string,
  { icon: typeof Circle; chip: string }
> = {
  "to-do":       { icon: Circle,       chip: "text-text-tertiary" },
  "in-progress": { icon: PlayCircle,   chip: "text-warning" },
  "done":        { icon: CheckCircle2, chip: "text-success" },
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
      className="relative group flex items-stretch rounded-lg bg-card border-xs border-border-soft overflow-hidden"
    >
      {/* Left rail — company color (the only company indicator on the row) */}
      <div className={`w-[2px] ${co.rail} opacity-80`} />

      <div className="flex-1 min-w-0 flex items-center gap-3 py-3 pl-3.5 pr-3.5">
        {/* Status icon */}
        <Stat className={`h-4 w-4 shrink-0 ${STATUS_STYLE[task.status]?.chip ?? ""}`} />

        {/* Title + inline metadata */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-foreground truncate leading-snug">
            {task.title}
          </div>

          {/* Dot-separated metadata row — priority · deadline · company */}
          <div className="flex items-center gap-2 mt-0.5 text-[10.5px] text-text-tertiary">
            <span className={`inline-flex items-center gap-1 ${prio.text}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
              <span className="font-medium uppercase tracking-wider">{prio.label}</span>
            </span>

            {task.deadline && (
              <>
                <span className="text-text-tertiary/40">·</span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    overdue ? "text-destructive font-medium" : ""
                  }`}
                >
                  <CalendarClock className="h-2.5 w-2.5" />
                  {formatDeadline(task.deadline)}
                </span>
              </>
            )}

            <span className="text-text-tertiary/40">·</span>
            <span className="uppercase tracking-wider">{co.label}</span>
          </div>
        </div>

        {/* Row actions — hover-reveal, slim, token-driven */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {task.status === "to-do" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="text-[10px] px-2.5 h-6 rounded-md bg-background/60 hover:bg-warning/10 hover:text-warning border-xs border-border-soft text-text-tertiary uppercase tracking-wider font-semibold transition-colors"
              onClick={() => setStatus("in-progress")}
            >
              Start
            </motion.button>
          )}
          {task.status === "in-progress" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="text-[10px] px-2.5 h-6 rounded-md bg-background/60 hover:bg-success/10 hover:text-success border-xs border-border-soft text-text-tertiary uppercase tracking-wider font-semibold transition-colors"
              onClick={() => setStatus("done")}
            >
              Done
            </motion.button>
          )}
          {task.status === "done" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              className="text-[10px] px-2.5 h-6 rounded-md bg-background/60 hover:bg-popover border-xs border-border-soft text-text-tertiary hover:text-foreground uppercase tracking-wider font-semibold transition-colors"
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
    <div className="relative bg-card border-xs border-border-soft rounded-xl h-full overflow-hidden flex flex-col">
      {/* Single-row header — title + counts + filter tabs + search + add,
          all on one line so the body has more room for the actual task
          list. Title block collapses CWA/Simpl badges inline so the
          header doesn't get vertically tall. */}
      <div className="px-5 py-3 flex items-center gap-4 bg-popover/70 border-b border-xs border-border-soft">
        {/* Left: title + counts, inline */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div className="p-1.5 rounded-md bg-gradient-to-br from-primary/15 to-primary/[0.03] border border-primary/20">
            <ListTodo className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-[11px] text-foreground/90 uppercase tracking-[0.16em] font-semibold">
              Tasks
            </span>
            <span className="text-[10.5px] text-text-tertiary tabular-nums">{totalTasks}</span>
            <span className="text-text-tertiary/60">·</span>
            <span className="inline-flex items-center gap-1 text-[9.5px] text-text-tertiary uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-primary" />
              CWA {cwaCount}
            </span>
            <span className="inline-flex items-center gap-1 text-[9.5px] text-text-tertiary uppercase tracking-wider">
              <span className="w-1 h-1 rounded-full bg-teal-400" />
              Simpl {simpCount}
            </span>
          </div>
        </div>

        {/* Middle: filter tabs (was below the header) */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="bg-background/60 border-xs border-border-soft rounded-lg h-7 p-0.5">
            <TabsTrigger
              value="to-do"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary text-text-tertiary rounded-md text-[10.5px] h-6 px-2.5 font-semibold uppercase tracking-wider"
            >
              Open · {todoCount}
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              className="data-[state=active]:bg-warning/15 data-[state=active]:text-warning text-text-tertiary rounded-md text-[10.5px] h-6 px-2.5 font-semibold uppercase tracking-wider"
            >
              Active · {inProgressCount}
            </TabsTrigger>
            <TabsTrigger
              value="done"
              className="data-[state=active]:bg-success/15 data-[state=active]:text-success text-text-tertiary rounded-md text-[10.5px] h-6 px-2.5 font-semibold uppercase tracking-wider"
            >
              Done · {doneCount}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        {/* Right: modern search input with icon + clean add button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary pointer-events-none" />
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[170px] h-7 pl-7 pr-2 text-[11px] bg-background/60 border-xs border-border-soft placeholder:text-text-tertiary text-foreground focus:border-foreground/20 focus-visible:ring-0 rounded-lg"
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
