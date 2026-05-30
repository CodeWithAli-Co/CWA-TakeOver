import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "@/MyComponents/Sidebar/handlingTasking/addTodo";
import { useEffect, useMemo, useRef, useState } from "react";
import supabase from "@/MyComponents/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ActiveUser, Employees, Todos } from "@/stores/query";
import {
  ListTodo,
  Circle,
  PlayCircle,
  CheckCircle2,
  CalendarClock,
  Search,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";
import {
  AvatarStack,
  type AvatarUser,
} from "@/MyComponents/Reusables/AvatarStack";
import { TaskDetailModal } from "./TaskDetailModal";

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

// ── Priority — takes the "category" slot on each card.
// Same role + same visual weight as the meeting-type label on a
// MeetingCard: tiny coloured text at the top-left of the card.
// One accent per row, picked by priority. The text colour does
// all the work — no rails, no chips, no shouting.
const PRIORITY_STYLE: Record<
  "high" | "medium" | "low",
  { text: string; label: string }
> = {
  high:   { text: "text-destructive",                       label: "High" },
  medium: { text: "text-warning",                           label: "Medium" },
  low:    { text: "text-success",                           label: "Low" },
};

// ── Status — pill at the bottom-left of the card (mirrors the
// location pill on a MeetingCard). Background + text colour tuned
// per status; same hairline border as the meeting pill so the two
// widgets feel like siblings.
const STATUS_STYLE: Record<
  string,
  { icon: typeof Circle; label: string; pill: string }
> = {
  "to-do": {
    icon: Circle,
    label: "To Do",
    pill: "text-foreground/80",
  },
  "in-progress": {
    icon: PlayCircle,
    label: "In Progress",
    pill: "text-warning",
  },
  "done": {
    icon: CheckCircle2,
    label: "Done",
    pill: "text-success",
  },
};

// ── Deadline helper ────────────────────────────────────────────
// Implausibility guard: AddTodo currently accepts free text for
// deadlines ("3 days", "Tomorrow", etc) — when that ends up in the
// DB, `new Date()` either gives Invalid Date (fine, we return the
// raw string) OR latches onto a leading digit like "3" and parses
// it as the year 3 AD. That's where the "Overdue by 25 years" bug
// came from. We treat anything more than 5 years off the current
// date as bad data and return the raw input so the user at least
// sees what they typed instead of nonsense.
const PLAUSIBLE_DEADLINE_MS = 5 * 365 * 24 * 60 * 60 * 1000;

function formatDeadline(iso: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  // Bad data — show raw input rather than a misleading day count.
  if (Math.abs(diffMs) > PLAUSIBLE_DEADLINE_MS) return iso;
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(diffMs / dayMs);
  if (diffDays < -1) return `Overdue · ${Math.abs(diffDays)}d`;
  if (diffDays === -1) return "Overdue · yesterday";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Returns true only when the deadline is in the past AND parses to
 *  a plausible date — implausible parses (year 3 AD, year 2999) get
 *  treated as "not overdue" so a bad input string doesn't flag every
 *  task red. */
function isOverdue(deadline: string | null | undefined, status: string): boolean {
  if (!deadline || status === "done") return false;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return false;
  const diffMs = d.getTime() - Date.now();
  if (Math.abs(diffMs) > PLAUSIBLE_DEADLINE_MS) return false;
  return d.getTime() < Date.now();
}

// ── Single task card ────────────────────────────────────────────
// Editorial-card pattern, identical bones to MeetingCard:
//   • subtle elevated surface (foreground/[0.03])
//   • hairline border (border-soft → border on hover)
//   • category label at top (priority — colored text-only, no chip)
//   • bold title underneath
//   • bottom row: status pill + deadline + (hover) action + avatars
//   • company dot in the top-right corner as a quiet marker
function TaskItem({
  task,
  usersByName,
  onOpen,
}: {
  task: any;
  /** username → AvatarUser. Used to render assignee avatars from
   *  the task.assignee array (which stores usernames, not supa_ids). */
  usersByName: Map<string, AvatarUser>;
  /** Called when the card is clicked (outside an interactive child)
   *  so the parent can open the TaskDetailModal. */
  onOpen: (task: any) => void;
}) {
  const co = companyStyle(task.company);
  const prio = PRIORITY_STYLE[(task.priority as keyof typeof PRIORITY_STYLE) ?? "low"] ?? PRIORITY_STYLE.low;
  const stat = STATUS_STYLE[task.status] ?? STATUS_STYLE["to-do"];
  const StatIcon = stat.icon;

  const overdue = isOverdue(task.deadline, task.status);

  // Resolve task.assignee usernames → AvatarUser objects. Names
  // that don't match an employee row (legacy / typo) are dropped
  // silently rather than rendered as ghost avatars.
  const resolvedAssignees = useMemo<AvatarUser[]>(() => {
    const names: string[] = Array.isArray(task?.assignee) ? task.assignee : [];
    return names
      .map((n) => usersByName.get(n))
      .filter((u): u is AvatarUser => Boolean(u));
  }, [task?.assignee, usersByName]);

  async function setStatus(next: string) {
    // Stamp completed_at on transition to done; clear on reopen.
    const { error } = await supabase
      .from("cwa_todos")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("todo_id", task.todo_id);
    if (error) {
      await message(error.message, { title: "Error updating task", kind: "error" });
    }
  }

  /**
   * Card click → open detail modal. Ignores clicks that originated
   * from interactive children (action buttons, future link icons)
   * so they don't accidentally pop the modal open.
   */
  function handleCardClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("a, button, [role='menuitem']")) return;
    onOpen(task);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task);
        }
      }}
      // Same surface as MeetingCard so the two widgets read as
      // siblings on the dashboard. Vertical padding is one notch
      // tighter than meeting cards (py-4 vs py-5) because the task
      // card has an extra description line — matching py-5 here
      // would make tasks look noticeably taller than meetings.
      className="
        group relative cursor-pointer
        bg-foreground/[0.03] hover:bg-foreground/[0.05]
        border border-xs border-border-soft hover:border-border
        rounded-lg px-4 py-4
        transition-colors
        focus-visible:outline-none focus-visible:border-primary/40
      "
    >
      {/* Company dot — tiny corner indicator, mirrors MeetingCard. */}
      <span
        className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full ${co.dot} opacity-60`}
        title={task.company === "simplicity" ? "Simplicity" : "CodeWithAli"}
      />

      {/* Category — the priority label takes this slot. Coloured
       *  text-only; no chip, no rail. The one accent on the card. */}
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`text-[10.5px] font-semibold tracking-wide ${prio.text}`}>
          {prio.label}
        </span>
      </div>

      {/* Title — same size + weight as MeetingCard. Two-line clamp
       *  so long titles don't blow out the card. */}
      <h3 className="text-[13.5px] font-bold text-foreground leading-snug line-clamp-2 pr-5">
        {task.title}
      </h3>

      {/* Description — fills the visual gap that made the cards
       *  feel airy. Single-line clamp keeps card height predictable;
       *  the full text shows in the detail modal when clicked. Only
       *  renders when present so tasks without descriptions don't
       *  show a weird empty row. mt-1 sits close to the title so
       *  the two read as one stacked block. */}
      {task.description && (
        <p className="mt-1 text-[11.5px] text-text-tertiary leading-snug line-clamp-1 pr-5">
          {task.description}
        </p>
      )}

      {/* Bottom row — status pill on the left, deadline inline,
       *  hover-reveal action between deadline and avatars,
       *  avatar stack pinned right via ml-auto. mt-2.5 instead of
       *  mt-3 trims a few px so the card height tracks meeting
       *  cards more closely. */}
      <div className="flex items-center gap-2 mt-2.5">
        {/* Status pill — mirrors MeetingCard's location pill. */}
        <span
          className={`
            inline-flex items-center gap-1
            bg-foreground/[0.06]
            border border-xs border-border-soft
            rounded-md px-2 py-0.5
            text-[10.5px] font-medium ${stat.pill}
          `}
        >
          <StatIcon className="h-2.5 w-2.5 shrink-0" />
          <span>{stat.label}</span>
        </span>

        {/* Deadline — tabular-nums so dates align across cards.
         *  Overdue escalates to destructive + bold + icon. */}
        {task.deadline && (
          <span
            className={`
              inline-flex items-center gap-1 text-[10.5px] tabular-nums whitespace-nowrap
              ${overdue ? "text-destructive font-semibold" : "text-foreground/85 font-semibold"}
            `}
          >
            <CalendarClock className="h-2.5 w-2.5" />
            {formatDeadline(task.deadline)}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Hover-revealed cycle action. Compact, no fill, lights
           *  up its target colour on hover so the click affordance
           *  reads at a glance. */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
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
                className="text-[10px] px-2 h-6 rounded-md hover:bg-foreground/[0.06] text-text-tertiary hover:text-foreground uppercase tracking-wider font-semibold transition-colors"
                onClick={() => setStatus("to-do")}
              >
                Reopen
              </button>
            )}
          </div>

          {/* Assignee stack. Falls back to a single placeholder
           *  circle when the row has no assignees (matches the
           *  meeting-card behavior for an empty roster). */}
          <AvatarStack
            users={resolvedAssignees}
            count={resolvedAssignees.length || 1}
            seed={String(task.todo_id ?? task.title ?? "x")}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Main widget ─────────────────────────────────────────────────
export const TasksComponent = () => {
  const [selectedTab, setSelectedTab] = useState<"to-do" | "in-progress" | "done">("to-do");
  const [searchQuery, setSearchQuery] = useState("");
  // Held task drives the detail modal. null = modal closed. Holding
  // a snapshot of the task (rather than just an id) lets the modal
  // render even after the row was filtered out of the visible list.
  const [openTask, setOpenTask] = useState<any | null>(null);

  const { data: AllEmployees } = Employees();
  const { data: user } = ActiveUser();

  // Resolve avatar URLs once and stash by username. Tasks store
  // assignees as usernames (not supa_ids), so the card-level
  // resolution lookup keys off `username`. Same avatar-URL logic
  // as the meetings widget — supports both bucket filenames and
  // full URLs (e.g. DiceBear from Direct Hire).
  const usersByName = useMemo(() => {
    const map = new Map<string, AvatarUser>();
    for (const e of (AllEmployees as any[] | undefined) ?? []) {
      if (!e?.username) continue;
      let avatarUrl: string | undefined;
      if (typeof e.avatar === "string" && e.avatar.startsWith("http")) {
        avatarUrl = e.avatar;
      } else if (e.avatar) {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(e.avatar);
        avatarUrl = data?.publicUrl;
      }
      map.set(e.username, {
        id: e.supa_id ?? e.username,
        name: e.username,
        avatarUrl,
      });
    }
    return map;
  }, [AllEmployees]);

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
    <div className="bg-card border-xs border-border-soft rounded-xl h-full overflow-hidden flex flex-col">
      {/* Editorial-style header — same surface as the body, separated
       *  only by a whisper-thin hairline. Decorative top gradient
       *  removed; the chrome it added fought the calmer card design.
       *  Padding bumped to py-3.5 so the title has breathing room
       *  without making the header feel like its own region. */}
      <div className="px-5 py-3.5 flex items-center gap-3 border-b border-xs border-border/15">
        {/* Left: title + total. Company breakdown dots removed —
         *  the per-card company indicator already conveys which
         *  org each task belongs to. Surfacing both was visual
         *  noise without adding info the operator could act on. */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <span className="text-[11px] text-foreground uppercase tracking-[0.14em] font-bold">
            Tasks
          </span>
          <span className="text-[11px] text-text-tertiary tabular-nums font-medium">
            {totalTasks}
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
          <ScrollArea className="h-[540px]">
            {/* Same padding + spacing as the meetings card grid so
             *  the two widgets read with identical rhythm. */}
            <div className="px-3 py-3 space-y-2">
              <AnimatePresence mode="popLayout">
                <motion.div
                  key={selectedTab}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="space-y-2"
                >
                  {filteredTasks.map((task: any) => (
                    <TaskItem
                      key={task.todo_id}
                      task={task}
                      usersByName={usersByName}
                      onOpen={setOpenTask}
                    />
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Detail modal — controlled at the widget level so a card
       *  click can open it for any task. Held as a snapshot so the
       *  modal stays mounted even if the underlying row vanishes
       *  from the visible filter (e.g. status changes done). */}
      {openTask && (
        <TaskDetailModal
          open={!!openTask}
          onOpenChange={(o) => !o && setOpenTask(null)}
          task={openTask}
          usersByName={usersByName}
          onDeleted={() => {
            setOpenTask(null);
            refetchTodos();
          }}
          onChanged={() => {
            refetchTodos();
          }}
        />
      )}
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
