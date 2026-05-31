/**
 * TaskDetailModal.tsx
 *
 * Read-rich detail view for a single task. Opens when the operator
 * clicks a task card in the dashboard Tasks widget. Surfaces every
 * field the row card can't fit:
 *   • Full title + description (no clamp)
 *   • Priority + status pills (visible)
 *   • Assignees with names + avatars
 *   • Who assigned the task (`assigned_by`)
 *   • Deadline (formatted with overdue badge)
 *   • Label + company chip
 *   • Created at timestamp
 *
 * Mirrors the editorial card aesthetic — same hairline borders,
 * subtle elevation, restrained colour. The modal IS the card, just
 * full-bleed.
 */

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/shadcnComponents/dialog";
import { Button } from "@/components/ui/button";
import {
  CalendarClock,
  Circle,
  PlayCircle,
  CheckCircle2,
  Tag,
  Users,
  Trash,
  Pencil,
  Building2,
  X,
} from "lucide-react";
import { AvatarStack, type AvatarUser } from "@/MyComponents/Reusables/AvatarStack";
import { useMemo } from "react";
import { takeOversupabase } from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";

// Mirror the same priority/status maps used by the card so the
// modal can't drift visually from the row.
const PRIORITY_STYLE: Record<string, { text: string; label: string }> = {
  high:   { text: "text-destructive", label: "High priority" },
  medium: { text: "text-warning",     label: "Medium priority" },
  low:    { text: "text-success",     label: "Low priority" },
};

const STATUS_STYLE: Record<
  string,
  { icon: typeof Circle; label: string; tint: string }
> = {
  "to-do":       { icon: Circle,       label: "To Do",       tint: "text-foreground/80" },
  "in-progress": { icon: PlayCircle,   label: "In Progress", tint: "text-warning" },
  "done":        { icon: CheckCircle2, label: "Done",        tint: "text-success" },
};

function companyLabel(co: string | undefined | null) {
  if (co === "simplicity") return { name: "Simplicity", dot: "bg-teal-400" };
  return { name: "CodeWithAli", dot: "bg-primary" };
}

// Same implausibility window as the dashboard card formatter — if
// a deadline parses to a date >5 years from now, the data is almost
// certainly free-text junk (e.g. "3 days" parsed as year 3 AD) and
// we surface it as-is so the operator sees what they typed, not
// "Overdue 9000 days".
const PLAUSIBLE_DEADLINE_MS = 5 * 365 * 24 * 60 * 60 * 1000;

function formatDeadline(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  if (Math.abs(diffMs) > PLAUSIBLE_DEADLINE_MS) return iso;
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round(diffMs / dayMs);
  const long = d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (diffDays === 0) return `Today · ${long}`;
  if (diffDays === 1) return `Tomorrow · ${long}`;
  if (diffDays === -1) return `Overdue yesterday · ${long}`;
  if (diffDays < -1) return `Overdue ${Math.abs(diffDays)} days · ${long}`;
  return long;
}

/** Mirrors isOverdue() in the tasks widget. Implausible parses are
 *  treated as not-overdue so bad data doesn't paint the modal red. */
function isPlausiblyOverdue(
  deadline: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (!deadline || status === "done") return false;
  const d = new Date(deadline);
  if (isNaN(d.getTime())) return false;
  const diffMs = d.getTime() - Date.now();
  if (Math.abs(diffMs) > PLAUSIBLE_DEADLINE_MS) return false;
  return d.getTime() < Date.now();
}

function formatCreated(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: any;
  /** username → AvatarUser. Used to resolve task.assignee names
   *  and the task.assigned_by username into rich avatar + name
   *  rows. Empty Map is fine — modal renders sensibly without it. */
  usersByName: Map<string, AvatarUser>;
  /** Called after a successful delete so the parent can refetch. */
  onDeleted?: () => void;
  /** Called after a status change. Used so the parent can refresh
   *  optimistically; the realtime subscription also covers this. */
  onChanged?: () => void;
}

export function TaskDetailModal({
  open,
  onOpenChange,
  task,
  usersByName,
  onDeleted,
  onChanged,
}: TaskDetailModalProps) {
  const prio =
    PRIORITY_STYLE[(task?.priority as keyof typeof PRIORITY_STYLE) ?? "low"] ??
    PRIORITY_STYLE.low;
  const stat = STATUS_STYLE[task?.status] ?? STATUS_STYLE["to-do"];
  const StatIcon = stat.icon;
  const co = companyLabel(task?.company);
  const overdue = isPlausiblyOverdue(task?.deadline, task?.status);

  // Resolve assignees to avatar+name rows.
  const assignees = useMemo<AvatarUser[]>(() => {
    const names: string[] = Array.isArray(task?.assignee) ? task.assignee : [];
    return names
      .map((n) => usersByName.get(n))
      .filter((u): u is AvatarUser => Boolean(u));
  }, [task?.assignee, usersByName]);

  // Resolve the assigner (single user). assigned_by is a username
  // stamped by AddTodo at create time. Falls back to the raw string
  // if the username doesn't resolve (legacy / deleted user).
  const assigner = useMemo<AvatarUser | { name: string } | null>(() => {
    if (!task?.assigned_by) return null;
    const u = usersByName.get(task.assigned_by);
    return u ?? { name: task.assigned_by };
  }, [task?.assigned_by, usersByName]);

  // True when the person who assigned the task is also among the
  // assignees — i.e. the operator created the task for themselves.
  // This is the common case for personal todos and we want to label
  // it explicitly so the operator doesn't read "Assigned by <me>"
  // as if a third party gave it to them.
  const isSelfAssigned = useMemo(() => {
    if (!assigner) return false;
    const assigneeNames: string[] = Array.isArray(task?.assignee)
      ? task.assignee
      : [];
    return assigneeNames.includes(assigner.name);
  }, [assigner, task?.assignee]);

  async function setStatus(next: string) {
    // Stamp completed_at on transition to done; clear on reopen.
    const { error } = await takeOversupabase
.from("cwa_todos")
      .update({
        status: next,
        completed_at: next === "done" ? new Date().toISOString() : null,
      })
      .eq("todo_id", task.todo_id);
    if (error) {
      await message(error.message, {
        title: "Error updating task",
        kind: "error",
      });
      return;
    }
    onChanged?.();
  }

  async function deleteTask() {
    const { error } = await takeOversupabase
.from("cwa_todos")
      .delete()
      .eq("todo_id", task.todo_id);
    if (error) {
      await message(error.message, {
        title: "Error deleting task",
        kind: "error",
      });
      return;
    }
    onDeleted?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card border-xs border-border-soft">
        {/* Header — priority + status pills on top so the operator
         *  knows what they're looking at before reading the title.
         *  Title gets its own row, large. */}
        <div className="px-6 pt-5 pb-4 border-b border-xs border-border-soft">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10.5px] font-semibold tracking-wide ${prio.text}`}>
              {prio.label.toUpperCase()}
            </span>
            <span className="text-text-tertiary/40 text-[10.5px]">·</span>
            <span
              className={`
                inline-flex items-center gap-1
                bg-foreground/[0.06] border border-xs border-border-soft
                rounded-md px-2 py-0.5 text-[10.5px] font-medium ${stat.tint}
              `}
            >
              <StatIcon className="h-2.5 w-2.5" />
              {stat.label}
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] text-text-tertiary">
              <span className={`w-1.5 h-1.5 rounded-full ${co.dot}`} />
              {co.name}
            </span>
          </div>

          <DialogTitle className="text-[16px] font-bold text-foreground leading-tight">
            {task?.title}
          </DialogTitle>

          {/* Who assigned this — lifted into the header so it's the
           *  first thing the operator reads after the title. Three
           *  states:
           *    1. Self-assigned   → assigner is one of the assignees.
           *                         Means the operator created the
           *                         task for themselves. Most common
           *                         personal-todo case.
           *    2. Assigned by X   → a third party gave the task to
           *                         the assignee(s). Shows avatar +
           *                         name.
           *    3. Unknown         → assigned_by is null. Almost
           *                         always legacy data from before
           *                         AddTodo started stamping it. We
           *                         deliberately do NOT say "Self-
           *                         assigned" here because that'd be
           *                         misleading — we just don't know.
           */}
          <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-text-tertiary">
            {isSelfAssigned ? (
              <>
                <span>Self-assigned by</span>
                <span className="inline-flex items-center gap-1.5">
                  {assigner && "avatarUrl" in assigner && assigner.avatarUrl ? (
                    <img
                      src={assigner.avatarUrl}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover ring-1 ring-border/40"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                  <span className="text-foreground/85 font-semibold">
                    {assigner!.name}
                  </span>
                </span>
              </>
            ) : assigner ? (
              <>
                <span>Assigned by</span>
                <span className="inline-flex items-center gap-1.5">
                  {"avatarUrl" in assigner && assigner.avatarUrl ? (
                    <img
                      src={assigner.avatarUrl}
                      alt=""
                      className="w-4 h-4 rounded-full object-cover ring-1 ring-border/40"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                  <span className="text-foreground/85 font-semibold">
                    {assigner.name}
                  </span>
                </span>
              </>
            ) : (
              <>
                <span>Assigned by</span>
                <span className="text-foreground/60 italic">Unknown</span>
              </>
            )}
          </div>

          {/* Optional description. Renders only when present so an
           *  empty task doesn't show a meaningless gap. */}
          {task?.description && (
            <p className="mt-3 text-[12.5px] text-foreground/75 leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          )}
        </div>

        {/* Body — metadata grid. Each row is label / value. Quiet
         *  visual treatment so nothing fights the title up top. */}
        <div className="px-6 py-5 space-y-4">
          {/* Assigned to */}
          <DetailRow icon={Users} label="Assigned to">
            {assignees.length > 0 ? (
              <div className="flex items-center gap-3 flex-wrap">
                <AvatarStack users={assignees} count={assignees.length} seed={`detail-${task?.todo_id}`} />
                <div className="text-[12px] text-foreground/85 flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
                  {assignees.map((a, i) => (
                    <span key={a.id} className="inline-flex items-center">
                      <span className="font-medium">{a.name}</span>
                      {i < assignees.length - 1 && (
                        <span className="text-text-tertiary/50 ml-1.5">·</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <span className="text-[12px] text-text-tertiary italic">Unassigned</span>
            )}
          </DetailRow>

          {/* Assigned-by row moved into the header above (under the
           *  title) so it's the first metadata the operator reads.
           *  Keeping a copy here would be redundant. */}

          {/* Deadline */}
          {task?.deadline && (
            <DetailRow icon={CalendarClock} label="Deadline">
              <span
                className={`text-[12px] ${overdue ? "text-destructive font-semibold" : "text-foreground/85"}`}
              >
                {formatDeadline(task.deadline)}
              </span>
            </DetailRow>
          )}

          {/* Label */}
          {task?.label && (
            <DetailRow icon={Tag} label="Label">
              <span
                className="
                  inline-flex items-center
                  bg-foreground/[0.06] border border-xs border-border-soft
                  rounded-md px-2 py-0.5
                  text-[11px] text-foreground/85 font-medium
                "
              >
                {task.label}
              </span>
            </DetailRow>
          )}

          {/* Created — small grey footnote-ish, but lives in the
           *  same grid as everything else for consistency. */}
          {task?.created_at && (
            <DetailRow icon={Building2} label="Created">
              <span className="text-[12px] text-text-tertiary">
                {formatCreated(task.created_at)}
              </span>
            </DetailRow>
          )}
        </div>

        {/* Footer — actions. Status cycle on the left (so the
         *  operator can mark a task done from this view), Edit /
         *  Delete on the right. Edit currently no-ops because we
         *  don't have a TodoEdit dialog yet — leaves room to wire
         *  it later. */}
        <div className="px-6 py-3.5 border-t border-xs border-border-soft bg-popover/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {task?.status === "to-do" && (
              <Button
                type="button"
                onClick={() => setStatus("in-progress")}
                className="bg-warning/15 hover:bg-warning/25 border border-warning/30 text-warning h-8 px-3 text-[11.5px] font-semibold uppercase tracking-wider"
              >
                Start
              </Button>
            )}
            {task?.status === "in-progress" && (
              <Button
                type="button"
                onClick={() => setStatus("done")}
                className="bg-success/15 hover:bg-success/25 border border-success/30 text-success h-8 px-3 text-[11.5px] font-semibold uppercase tracking-wider"
              >
                Mark done
              </Button>
            )}
            {task?.status === "done" && (
              <Button
                type="button"
                onClick={() => setStatus("to-do")}
                className="bg-foreground/[0.06] hover:bg-foreground/[0.10] border border-xs border-border-soft text-foreground/80 h-8 px-3 text-[11.5px] font-semibold uppercase tracking-wider"
              >
                Reopen
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              onClick={deleteTask}
              className="text-text-tertiary hover:text-destructive hover:bg-destructive/10 h-8 px-3 text-[11.5px] font-medium inline-flex items-center gap-1.5"
            >
              <Trash className="h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-text-secondary hover:text-foreground hover:bg-foreground/[0.05] h-8 px-3 text-[11.5px] font-medium"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small layout primitive used inside the modal body. icon left,
 *  label middle, value right. Keeps every metadata row aligned. */
function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarClock;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-start gap-3">
      <div className="flex items-center gap-1.5 text-[11px] text-text-tertiary font-medium pt-0.5">
        <Icon className="h-3 w-3 shrink-0" />
        {label}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
