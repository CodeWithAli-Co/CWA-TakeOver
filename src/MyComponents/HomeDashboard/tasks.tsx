import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "@/MyComponents/Sidebar/handlingTasking/addTodo";
import { useEffect, useRef, useState } from "react";
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
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";

// ── Company accent (small dot on the right of the row) ──
const COMPANY_STYLE = {
  CodeWithAli: { label: "CWA",   dot: "bg-primary" },
  simplicity:  { label: "SIMPL", dot: "bg-teal-400" },
} as const;

type CompanyKey = keyof typeof COMPANY_STYLE;
function companyStyle(co: string | undefined | null) {
  if (co === "simplicity") return COMPANY_STYLE.simplicity;
  return COMPANY_STYLE.CodeWithAli;
}

// ── Priority — left rail colour + foreground tint for the label. ──
// Rail is solid 2px of colour at low alpha on the left edge of every
// task row; the only big visual signal of priority. Avoids per-row
// chips on every task.
const PRIORITY_STYLE: Record<
  "high" | "medium" | "low",
  { rail: string; text: string; label: string }
> = {
  high:   { rail: "bg-destructive",        text: "text-destructive", label: "High" },
  medium: { rail: "bg-warning",            text: "text-warning",     label: "Medium" },
  low:    { rail: "bg-success",            text: "text-success",     label: "Low" },
};

// ── Status — small icon, sized to read at the start of the row ──
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
      // Flush row — no per-row card. Sits inside the parent panel
      // and is separated from siblings by a hairline. Hover lifts a
      // very faint surface so the row reads as a hit target without
      // adding chrome.
      className="
        relative group flex items-stretch
        border-b border-xs border-border/20 last:border-b-0
        hover:bg-foreground/[0.025] transition-colors
      "
    >
      {/* Priority rail — 2px solid colour on the left edge. This is
       *  the one strong colour signal per row; the priority label
       *  itself recedes into the meta line. */}
      <div className={`w-[2px] ${prio.rail} opacity-90`} />

      <div className="flex-1 min-w-0 flex items-center gap-3 py-2.5 pl-3 pr-3">
        {/* Status icon — small, recedes when not focal */}
        <Stat className={`h-3.5 w-3.5 shrink-0 ${STATUS_STYLE[task.status]?.chip ?? ""}`} />

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-foreground truncate leading-snug">
            {task.title}
          </div>

          {/* Meta — only show genuinely-useful info; priority is on
           *  the left rail already so it's just a quiet text label
           *  here. Company is a small coloured dot at the end. */}
          <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-text-tertiary">
            <span className={`${prio.text} font-medium`}>{prio.label}</span>

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
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${co.dot}`} />
          </div>
        </div>

        {/* Row actions — hover-reveal, single-action cycle button.
         *  Compact ghost button using neutral surface tokens. */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {task.status === "to-do" && (
            <button
              type="button"
              className="text-[10px] px-2 h-6 rounded-md hover:bg-warning/10 hover:text-warning text-text-tertiary uppercase tracking-wider font-semibold transition-colors"
              onClick={() => setStatus("in-progress")}
            >
              Start
            </button>
          )}
          {task.status === "in-progress" && (
            <button
              type="button"
              className="text-[10px] px-2 h-6 rounded-md hover:bg-success/10 hover:text-success text-text-tertiary uppercase tracking-wider font-semibold transition-colors"
              onClick={() => setStatus("done")}
            >
              Done
            </button>
          )}
          {task.status === "done" && (
            <button
              type="button"
              className="text-[10px] px-2 h-6 rounded-md hover:bg-popover text-text-tertiary hover:text-foreground uppercase tracking-wider font-semibold transition-colors"
              onClick={() => setStatus("to-do")}
            >
              Reopen
            </button>
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
      {/* Single calm header — title + count + tiny company dots
       *  inline, filter tabs in the middle, search/add on the right.
       *  No icon chip, no second meta line, no bordered tabs cluster.
       *  Sits on bg-popover/40 so it reads as the same surface as
       *  the row body, just slightly elevated. */}
      <div className="px-4 py-2.5 flex items-center gap-3 bg-popover/40 border-b border-xs border-border-soft">
        {/* Left: title + total + company dots */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <span className="text-[11px] text-foreground uppercase tracking-[0.14em] font-bold">
            Tasks
          </span>
          <span className="text-[11px] text-text-tertiary tabular-nums font-medium">
            {totalTasks}
          </span>
          <span className="inline-flex items-center gap-1 ml-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-primary"
              title={`CodeWithAli · ${cwaCount}`}
            />
            <span className="text-[10px] text-text-tertiary tabular-nums">{cwaCount}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full bg-teal-400"
              title={`Simplicity · ${simpCount}`}
            />
            <span className="text-[10px] text-text-tertiary tabular-nums">{simpCount}</span>
          </span>
        </div>

        {/* Middle: filter tabs */}
        <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
          <TabsList className="bg-transparent rounded-md h-7 p-0 gap-0.5">
            <TabsTrigger
              value="to-do"
              className="data-[state=active]:bg-primary/12 data-[state=active]:text-primary text-text-tertiary rounded-md text-[10.5px] h-6 px-2 font-semibold uppercase tracking-wider"
            >
              Open · {todoCount}
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              className="data-[state=active]:bg-warning/12 data-[state=active]:text-warning text-text-tertiary rounded-md text-[10.5px] h-6 px-2 font-semibold uppercase tracking-wider"
            >
              Active · {inProgressCount}
            </TabsTrigger>
            <TabsTrigger
              value="done"
              className="data-[state=active]:bg-success/12 data-[state=active]:text-success text-text-tertiary rounded-md text-[10.5px] h-6 px-2 font-semibold uppercase tracking-wider"
            >
              Done · {doneCount}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex-1" />

        {/* Right: collapsible search + add button.
         *  Search starts as an icon button (h-7 w-7). Click expands
         *  it to a 180px input with a soft primary-tinted shimmer
         *  trailing the expansion. Blur with empty value collapses.
         *  Esc clears + collapses. */}
        <div className="flex items-center gap-1.5 shrink-0">
          <CollapsibleSearch value={searchQuery} onChange={setSearchQuery} />
          <AddTodo Users={AllEmployees || []} homeDash />
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {filteredTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-8">
            <ListTodo className="h-7 w-7 text-foreground/10 mb-2" />
            <p className="text-[12.5px] text-text-tertiary">
              No {selectedTab === "to-do" ? "open" : selectedTab} tasks
            </p>
            <p className="text-[10.5px] text-text-tertiary/60 mt-1">
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

/**
 * CollapsibleSearch — icon-button that expands into a 180px input
 * on click. Smooth Apple-curve width animation, autofocus on open,
 * blur-to-collapse when empty, Esc to clear + collapse.
 *
 * The "shimmer" is a one-shot effect during the expansion: a soft
 * primary-tinted gradient sweeps horizontally across the bar (via
 * background-position animation) for ~0.9s after open, then fades
 * to invisible. Subtle — gives the reveal a premium feel without
 * the loud "loading bar" vibe you'd get from a persistent animation.
 */
function CollapsibleSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shimmering, setShimmering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const shimmerTimer = useRef<number | null>(null);

  function expand() {
    if (open) return;
    setOpen(true);
    // Kick off the shimmer for ~0.9s, then let it fade out.
    setShimmering(true);
    if (shimmerTimer.current) window.clearTimeout(shimmerTimer.current);
    shimmerTimer.current = window.setTimeout(() => setShimmering(false), 900);
    // Autofocus once the width animation begins so the cursor lands
    // inside the now-visible input.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function maybeCollapse() {
    // Don't collapse while the user is mid-search; only when the
    // input is empty does losing focus make sense as "I'm done".
    if (!value.trim()) setOpen(false);
  }

  useEffect(() => () => {
    if (shimmerTimer.current) window.clearTimeout(shimmerTimer.current);
  }, []);

  return (
    <motion.div
      animate={{ width: open ? 180 : 28 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="relative h-7 flex-shrink-0"
    >
      {/* Shimmer halo — soft primary-tinted gradient that sweeps
       *  horizontally during the expansion. position absolute so it
       *  paints behind the input + button; pointer-events-none. The
       *  bg-gradient + background-position keyframe lives below. */}
      <AnimatePresence>
        {shimmering && open && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 rounded-md pointer-events-none overflow-hidden"
          >
            {/* Inner shimmer gradient. background-size:200% so the
             *  position animation actually slides. */}
            <div
              className="absolute inset-0 rounded-md"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.18) 50%, transparent 100%)",
                backgroundSize: "200% 100%",
                animation: "taskSearchShimmer 0.9s ease-out forwards",
              }}
            />
            {/* Soft halo around the bar — a glow tint. */}
            <div
              className="absolute -inset-1 rounded-md"
              style={{
                boxShadow: "0 0 12px 2px hsl(var(--primary) / 0.18)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!open ? (
        <button
          type="button"
          onClick={expand}
          aria-label="Search tasks"
          title="Search tasks"
          className="
            relative w-7 h-7 inline-flex items-center justify-center rounded-md
            text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05]
            border-xs border-border-soft hover:border-border
            transition-colors
          "
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="relative w-full h-7">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary pointer-events-none z-10" />
          <input
            ref={inputRef}
            placeholder="Search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={maybeCollapse}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onChange("");
                setOpen(false);
                inputRef.current?.blur();
              }
            }}
            className="
              relative w-full h-7 pl-7 pr-2 text-[11px] rounded-md
              bg-background/40 text-foreground placeholder:text-text-tertiary
              border-xs border-border/40 focus:border-primary/45
              focus:outline-none focus-visible:ring-0
            "
          />
        </div>
      )}

      {/* Keyframe for the shimmer slide. Inlined so the component
       *  is self-contained — no need to touch main.css. */}
      <style>{`
        @keyframes taskSearchShimmer {
          0%   { background-position: -100% 0; opacity: 0; }
          30%  { opacity: 1; }
          100% { background-position: 200% 0; opacity: 0; }
        }
      `}</style>
    </motion.div>
  );
}
