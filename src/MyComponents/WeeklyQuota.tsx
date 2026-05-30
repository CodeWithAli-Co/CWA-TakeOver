/**
 * WeeklyQuota.tsx — Full-page Weekly Quotas with Void theme.
 *
 * Sections:
 *   1. Header                — page title + week navigation + add button
 *   2. Week summary card     — progress bar + counts + week-vs-week mini stats
 *   3. View toggle           — List | Kanban
 *   4. Search + filter pills — pending / active / done / all
 *   5. Quotas display        — list rows OR 3-column kanban depending on view
 *
 * New features beyond the dashboard widget:
 *   - Priority levels (low/medium/high) with color-coded badges
 *   - View toggle (list ↔ kanban board)
 *   - Weekly progress bar with completion %
 *   - Carryover indicator for quotas brought from previous week
 *   - Week-over-week comparison summary
 *   - Empty state with helpful CTA
 */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Textarea } from "@/components/ui/shadcnComponents/textarea";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  CheckCircle, Edit, Plus, Calendar, Target, Trash, X,
  ChevronLeft, ChevronRight, List, LayoutGrid, TrendingUp, RotateCw,
} from "lucide-react";
import { ActiveUser } from "@/stores/query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/shadcnComponents/select";
import supabase from "@/MyComponents/supabase";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";

type QuotaStatus = "pending" | "in-progress" | "completed";
type QuotaPriority = "low" | "medium" | "high";

interface Quota {
  id: number;
  status: QuotaStatus;
  title: string;
  description?: string;
  deadline?: string;
  priority?: QuotaPriority;
  carried_from_week?: string;
  user_id?: string;
  week_start?: string;
  week_end?: string;
  created_at?: string;
  updated_at?: string;
}

// Editorial chip styles — semantic-token based so theme switches
// automatically light/dark. Each chip pairs a 10%-alpha tinted bg
// with the matching foreground text + a hairline border at 20% alpha.
const statusColors: Record<QuotaStatus, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  "in-progress": "bg-primary/10 text-primary border-primary/20",
  completed: "bg-success/10 text-success border-success/20",
};

const priorityColors: Record<QuotaPriority, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-foreground/[0.06] text-text-tertiary border-border-soft",
};

// ════════════════════════════════════════
// QuotaItem — single row (used in list view)
// ════════════════════════════════════════
const QuotaItem: React.FC<{
  quota: Quota;
  onStatusChange: (id: number, status: QuotaStatus) => void;
  onDelete: (id: number) => void;
  onEdit: (quota: Quota) => void;
}> = ({ quota, onStatusChange, onDelete, onEdit }) => {
  // Status drives the left rail color so each row reads its tone at
  // a glance before you ever look at the chip. Hairline rail in the
  // matching semantic token.
  const railTone =
    quota.status === "completed"
      ? "bg-success"
      : quota.status === "in-progress"
        ? "bg-primary"
        : "bg-warning";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="relative overflow-hidden rounded-lg bg-foreground/[0.03] hover:bg-foreground/[0.05] border-xs border-border-soft hover:border-border/25 transition-colors group"
    >
      {/* Tone rail — 2.5px stripe on the left edge, status-colored. */}
      <span
        aria-hidden
        className={`absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full ${railTone}`}
      />

      <div className="pl-4 pr-3 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <h3 className="text-[13px] font-semibold text-foreground leading-tight">
              {quota.title}
            </h3>
            <span
              className={`text-[9.5px] font-bold uppercase tracking-[0.10em] px-1.5 py-0.5 rounded-md border-xs ${statusColors[quota.status]}`}
            >
              {quota.status === "in-progress" ? "Active" : quota.status}
            </span>
            {quota.priority && (
              <span
                className={`text-[9.5px] font-bold uppercase tracking-[0.10em] px-1.5 py-0.5 rounded-md border-xs ${priorityColors[quota.priority]}`}
              >
                {quota.priority}
              </span>
            )}
            {quota.carried_from_week && (
              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-[0.10em] text-text-tertiary bg-foreground/[0.06] px-1.5 py-0.5 rounded-md">
                <RotateCw className="h-2.5 w-2.5" /> carried
              </span>
            )}
          </div>
          {quota.description && (
            <p className="text-[12px] text-text-tertiary mb-1.5 leading-snug line-clamp-2">
              {quota.description}
            </p>
          )}
          {quota.deadline && (
            <div className="inline-flex items-center gap-1 text-[10.5px] text-text-tertiary">
              <Calendar className="h-3 w-3" />
              <span className="tabular-nums">Due {quota.deadline}</span>
            </div>
          )}
        </div>

        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {quota.status !== "completed" && (
            <button
              onClick={() => onStatusChange(quota.id, "completed")}
              className="p-1.5 rounded-md text-success/70 hover:text-success hover:bg-success/10 transition-colors"
              title="Mark complete"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(quota)}
            className="p-1.5 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            title="Edit"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(quota.id)}
            className="p-1.5 rounded-md text-text-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════
// KanbanCard — compact card for kanban view
// ════════════════════════════════════════
const KanbanCard: React.FC<{
  quota: Quota;
  onStatusChange: (id: number, status: QuotaStatus) => void;
  onDelete: (id: number) => void;
  onEdit: (quota: Quota) => void;
}> = ({ quota, onStatusChange, onDelete, onEdit }) => {
  const nextStatus: QuotaStatus | null =
    quota.status === "pending" ? "in-progress" :
    quota.status === "in-progress" ? "completed" : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="p-3 rounded-lg bg-foreground/[0.03] hover:bg-foreground/[0.05] border-xs border-border-soft hover:border-border/25 transition-colors group"
    >
      <div className="flex items-start justify-between mb-1.5 gap-1.5">
        <h4 className="text-[12px] font-semibold text-foreground flex-1 leading-snug">
          {quota.title}
        </h4>
        {quota.priority && (
          <span
            className={`text-[9px] font-bold uppercase tracking-[0.10em] px-1.5 py-0.5 rounded-md border-xs shrink-0 ${priorityColors[quota.priority]}`}
          >
            {quota.priority}
          </span>
        )}
      </div>
      {quota.description && (
        <p className="text-[11px] text-text-tertiary leading-snug mb-2 line-clamp-2">
          {quota.description}
        </p>
      )}
      {quota.deadline && (
        <div className="inline-flex items-center gap-1 text-[10px] text-text-tertiary mb-2 tabular-nums">
          <Calendar className="h-2.5 w-2.5" /> {quota.deadline}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-xs border-border/15 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-0.5">
          <button
            onClick={() => onEdit(quota)}
            className="p-1 rounded-md text-text-tertiary hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
            title="Edit"
          >
            <Edit className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(quota.id)}
            className="p-1 rounded-md text-text-tertiary hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete"
          >
            <Trash className="h-3 w-3" />
          </button>
        </div>
        {nextStatus && (
          <button
            onClick={() => onStatusChange(quota.id, nextStatus)}
            className="text-[10px] font-bold uppercase tracking-[0.10em] text-primary hover:text-primary/80 inline-flex items-center gap-0.5 transition-colors"
          >
            Move <ChevronRight className="h-2.5 w-2.5" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ════════════════════════════════════════
// QuotaFormDialog
// ════════════════════════════════════════
export const QuotaFormDialog: React.FC<{
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quota: any) => void;
  editingQuota: Quota | null;
}> = ({ isOpen, onOpenChange, onSave, editingQuota }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<QuotaStatus>("pending");
  const [priority, setPriority] = useState<QuotaPriority>("medium");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (editingQuota) {
        setTitle(editingQuota.title || "");
        setDescription(editingQuota.description || "");
        setStatus(editingQuota.status || "pending");
        setPriority(editingQuota.priority || "medium");
        setDeadline(editingQuota.deadline || "");
      } else {
        setTitle("");
        setDescription("");
        setStatus("pending");
        setPriority("medium");
        setDeadline("");
      }
    }
  }, [isOpen, editingQuota]);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-white/85">
          {editingQuota ? "Edit Quota" : "Add Weekly Quota"}
        </DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ id: editingQuota?.id, title, status, priority, description, deadline });
          onOpenChange(false);
        }}
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="bg-muted/30 border-border text-foreground rounded-sm placeholder:text-muted-foreground/40 focus:border-primary/20"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted/30 border-border text-foreground rounded-sm placeholder:text-muted-foreground/40 focus:border-primary/20"
              placeholder="Optional details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as QuotaStatus)}>
                <SelectTrigger className="bg-muted/30 border-border text-foreground rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-border text-foreground rounded-sm">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as QuotaPriority)}>
                <SelectTrigger className="bg-muted/30 border-border text-foreground rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-border text-foreground rounded-sm">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Deadline</label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-muted/30 border-border text-foreground rounded-sm focus:border-primary/20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button className="bg-primary hover:bg-primary/80 text-primary-foreground rounded-sm" type="submit">
            {editingQuota ? "Update" : "Add"} Quota
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

// ════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════
/**
 * Weekly Quotas page.
 *
 * When `embedded` is true (from OperationsHub), the big page header
 * is dropped — only the editorial toolbar (week nav, view toggle,
 * Add) remains. When standalone (legacy /quota route), the original
 * hero header still renders.
 */
interface WeeklyQuotasProps {
  embedded?: boolean;
}

export const WeeklyQuotas = ({ embedded = false }: WeeklyQuotasProps = {}) => {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [lastWeekQuotas, setLastWeekQuotas] = useState<Quota[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuota, setEditingQuota] = useState<Quota | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<"all" | QuotaStatus>("all");
  const [view, setView] = useState<"list" | "kanban">("list");

  const { data: activeUser } = ActiveUser();
  const currentUser = activeUser?.[0];

  const startDate = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const endDate = endOfWeek(selectedWeek, { weekStartsOn: 1 });
  const lastStart = startOfWeek(subWeeks(selectedWeek, 1), { weekStartsOn: 1 });
  const lastEnd = endOfWeek(subWeeks(selectedWeek, 1), { weekStartsOn: 1 });

  const dateRangeText = `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`;

  // Load current week
  useEffect(() => {
    const loadQuotas = async () => {
      if (!currentUser) return;
      const { data, error } = await supabase
        .from("weekly_quotas")
        .select("*")
        .gte("week_start", format(startDate, "yyyy-MM-dd"))
        .lte("week_end", format(endDate, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error loading Quotas", error);
        return;
      }
      setQuotas(data || []);
    };

    const loadLastWeek = async () => {
      if (!currentUser) return;
      const { data } = await supabase
        .from("weekly_quotas")
        .select("*")
        .gte("week_start", format(lastStart, "yyyy-MM-dd"))
        .lte("week_end", format(lastEnd, "yyyy-MM-dd"));
      setLastWeekQuotas(data || []);
    };

    loadQuotas();
    loadLastWeek();

    const subscription = supabase
      .channel("weekly_quotas_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_quotas" }, () => loadQuotas())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [currentUser, selectedWeek]);

  const handleSaveQuota = async (data: any) => {
    if (!currentUser) return;
    const week_start = format(startDate, "yyyy-MM-dd");
    const week_end = format(endDate, "yyyy-MM-dd");

    if (data.id) {
      await supabase.from("weekly_quotas").update({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        deadline: data.deadline,
        updated_at: new Date().toISOString(),
      }).eq("id", data.id);
    } else {
      await supabase.from("weekly_quotas").insert({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        deadline: data.deadline,
        user_id: currentUser.supa_id,
        week_start, week_end,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  };

  const handleStatusChange = async (id: number, status: QuotaStatus) => {
    await supabase.from("weekly_quotas").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  };
  const handleDelete = async (id: number) => {
    await supabase.from("weekly_quotas").delete().eq("id", id);
  };
  const handleEdit = (q: Quota) => { setEditingQuota(q); setDialogOpen(true); };

  const filtered = quotas.filter((q) => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.description && q.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === "all" || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const total = quotas.length;
  const completed = quotas.filter((q) => q.status === "completed").length;
  const inProgress = quotas.filter((q) => q.status === "in-progress").length;
  const pending = quotas.filter((q) => q.status === "pending").length;
  const completionPct = total > 0 ? (completed / total) * 100 : 0;

  // Last week comparison
  const lastTotal = lastWeekQuotas.length;
  const lastCompleted = lastWeekQuotas.filter((q) => q.status === "completed").length;
  const lastPct = lastTotal > 0 ? (lastCompleted / lastTotal) * 100 : 0;
  const pctDelta = completionPct - lastPct;

  // Shared toolbar fragment used by both embedded and standalone
  // header variants. Keeps the week nav / view toggle / add button
  // visually identical between modes.
  const ToolbarControls = (
    <div className="flex items-center gap-2">
      {/* Week nav — editorial pill group */}
      <div className="inline-flex items-center bg-foreground/[0.04] border-xs border-border-soft rounded-md overflow-hidden">
        <button
          onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
          className="p-1.5 text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
          title="Previous week"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setSelectedWeek(new Date())}
          className="px-2.5 py-1.5 text-[11px] font-semibold text-text-tertiary hover:text-foreground border-x border-xs border-border-soft transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
          className="p-1.5 text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
          title="Next week"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* View toggle */}
      <div className="inline-flex items-center bg-foreground/[0.04] border-xs border-border-soft rounded-md p-0.5">
        <button
          onClick={() => setView("list")}
          data-active={view === "list"}
          className="p-1.5 rounded transition-colors text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
          title="List view"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setView("kanban")}
          data-active={view === "kanban"}
          className="p-1.5 rounded transition-colors text-text-tertiary hover:text-foreground data-[active=true]:bg-foreground data-[active=true]:text-background"
          title="Kanban view"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Add */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <button
            onClick={() => setEditingQuota(null)}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground text-[11.5px] font-bold px-3 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3 w-3" /> Add Quota
          </button>
        </DialogTrigger>
        <QuotaFormDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSaveQuota} editingQuota={editingQuota} />
      </Dialog>
    </div>
  );

  return (
    <div
      className={
        embedded
          ? "h-full bg-background overflow-y-auto"
          : "min-h-screen bg-background overflow-y-auto"
      }
    >
      {/* Header — editorial toolbar when embedded, full hero when standalone */}
      {embedded ? (
        <div className="px-6 py-3 border-b border-xs border-border/15 bg-background/95 flex items-center justify-between gap-4 flex-wrap">
          {/* Stat row — quiet week date + completion summary */}
          <div className="flex items-center gap-4 min-w-0 text-[11.5px]">
            <span className="inline-flex items-center gap-1.5">
              <Target className="h-3 w-3 text-primary" />
              <span className="font-bold uppercase tracking-[0.14em] text-foreground/80">
                {dateRangeText}
              </span>
            </span>
            <span className="h-3 w-px bg-border-soft" />
            <span className="inline-flex items-baseline gap-1.5">
              <span className="font-bold text-foreground tabular-nums text-[14px]">
                {completed}
              </span>
              <span className="text-text-tertiary">of {total} done</span>
            </span>
            {Number.isFinite(pctDelta) && total > 0 && lastTotal > 0 && (
              <span className="inline-flex items-baseline gap-1 text-[11px]">
                <TrendingUp className="h-3 w-3 text-text-tertiary" />
                <span
                  className={
                    pctDelta > 0
                      ? "text-success font-semibold tabular-nums"
                      : pctDelta < 0
                        ? "text-destructive font-semibold tabular-nums"
                        : "text-text-tertiary tabular-nums"
                  }
                >
                  {pctDelta > 0 ? "+" : ""}
                  {pctDelta.toFixed(0)}%
                </span>
                <span className="text-text-tertiary">vs last week</span>
              </span>
            )}
          </div>
          {ToolbarControls}
        </div>
      ) : (
        // Standalone /quota route — original hero header kept.
        <div className="px-8 pt-7 pb-2">
          <div className="flex items-end justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-[24px] font-bold text-foreground tracking-tight">Weekly Quotas</h1>
                <p className="text-[12px] text-muted-foreground/60 mt-0.5">{dateRangeText}</p>
              </div>
            </div>
            {ToolbarControls}
          </div>
        </div>
      )}

      {/* ── Summary card — editorial split with progress + cells ─── */}
      <div className="px-6 pt-5">
        <div className="bg-foreground/[0.02] border-xs border-border/15 rounded-xl overflow-hidden">
          <div className="flex flex-wrap">
            {/* Progress + main metric — leads the row. */}
            <div className="flex-1 min-w-[260px] px-5 py-4 border-r border-xs border-border/15">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                  This week's progress
                </span>
                <span className="inline-flex items-baseline gap-0.5 tabular-nums">
                  <span className="text-[22px] font-bold text-foreground leading-none">
                    {completionPct.toFixed(0)}
                  </span>
                  <span className="text-[12px] font-semibold text-foreground/50">%</span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-foreground/[0.06] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-primary"
                />
              </div>
              <p className="text-[11px] text-text-tertiary mt-2">
                <span className="font-semibold tabular-nums text-foreground/80">{completed}</span>{" "}
                of{" "}
                <span className="font-semibold tabular-nums text-foreground/80">{total}</span>{" "}
                {total === 1 ? "quota" : "quotas"} completed
              </p>
            </div>

            {/* Status cells — quiet stat blocks. Hairline dividers,
             *  bold tabular hero number, lowercase caps label. */}
            <SummaryStat label="Pending" value={pending} tone="warning" />
            <SummaryStat label="Active" value={inProgress} tone="primary" />
            <SummaryStat label="Done" value={completed} tone="success" />

            {/* Week vs week */}
            <div className="px-5 py-4 min-w-[160px]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <TrendingUp className="h-3 w-3 text-text-tertiary" />
                <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
                  vs last week
                </span>
              </div>
              <p
                className={`text-[22px] font-bold tabular-nums leading-none ${
                  pctDelta > 0
                    ? "text-success"
                    : pctDelta < 0
                      ? "text-destructive"
                      : "text-foreground/70"
                }`}
              >
                {pctDelta >= 0 ? "+" : ""}
                {pctDelta.toFixed(0)}%
              </p>
              <p className="text-[10.5px] text-text-tertiary mt-1">
                Last: {lastPct.toFixed(0)}% ({lastCompleted}/{lastTotal})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filter bar — editorial pill row ───────────────────────── */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center bg-foreground/[0.04] border-xs border-border-soft rounded-md p-0.5">
            {(["all", "pending", "in-progress", "completed"] as const).map((s) => {
              const counts: Record<string, number> = {
                all: total,
                pending,
                "in-progress": inProgress,
                completed,
              };
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  data-active={isActive}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-[0.10em] transition-colors ${
                    isActive
                      ? "bg-foreground text-background"
                      : "text-text-tertiary hover:text-foreground"
                  }`}
                >
                  {s === "all"
                    ? "All"
                    : s === "pending"
                      ? "Pending"
                      : s === "in-progress"
                        ? "Active"
                        : "Done"}
                  <span className="ml-1 opacity-70 tabular-nums">{counts[s]}</span>
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search quotas…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-foreground/[0.04] border-xs border-border-soft rounded-md text-[12px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded text-text-tertiary hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Quotas display ────────────────────────────────────────── */}
      <div className="px-6 py-5 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-foreground/[0.02] border-xs border-border/15 rounded-xl py-16 text-center">
            <div className="mx-auto mb-3 h-10 w-10 rounded-lg bg-foreground/[0.04] border-xs border-border-soft flex items-center justify-center">
              <Target className="h-4 w-4 text-text-tertiary" />
            </div>
            <p className="text-[13px] text-foreground font-semibold mb-1">
              {quotas.length === 0 ? "No quotas this week." : "No quotas match your filters."}
            </p>
            <p className="text-[11.5px] text-text-tertiary">
              {quotas.length === 0
                ? "Add a goal to get started."
                : "Try a different filter or search term."}
            </p>
          </div>
        ) : view === "list" ? (
          <div className="space-y-2">
            <AnimatePresence>
              {filtered.map((q) => (
                <QuotaItem
                  key={q.id}
                  quota={q}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onEdit={handleEdit}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          // Kanban view — 3 editorial columns
          <div className="grid grid-cols-3 gap-4">
            {(["pending", "in-progress", "completed"] as QuotaStatus[]).map((status) => {
              const colQuotas = filtered.filter((q) => q.status === status);
              const meta = {
                pending: { dot: "bg-warning", text: "text-warning", label: "Pending" },
                "in-progress": { dot: "bg-primary", text: "text-primary", label: "Active" },
                completed: { dot: "bg-success", text: "text-success", label: "Done" },
              }[status];
              return (
                <div
                  key={status}
                  className="bg-foreground/[0.02] border-xs border-border/15 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-xs border-border/15 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      <span
                        className={`text-[10.5px] font-bold uppercase tracking-[0.16em] ${meta.text}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-[10.5px] font-bold tabular-nums text-text-tertiary">
                      {colQuotas.length}
                    </span>
                  </div>
                  <div className="p-2.5 space-y-2 min-h-[220px]">
                    <AnimatePresence>
                      {colQuotas.length === 0 ? (
                        <div className="text-[11px] text-text-tertiary italic text-center py-8">
                          Nothing here.
                        </div>
                      ) : (
                        colQuotas.map((q) => (
                          <KanbanCard
                            key={q.id}
                            quota={q}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                            onEdit={handleEdit}
                          />
                        ))
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * SummaryStat — single stat cell in the WeeklyQuotas summary card.
 * Tone-driven (warning/primary/success) so the numbers read at a
 * glance without an icon or extra chrome.
 */
function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "primary" | "success";
}) {
  const toneCls = {
    warning: "text-warning",
    primary: "text-primary",
    success: "text-success",
  }[tone];
  return (
    <div className="px-5 py-4 border-r border-xs border-border/15 min-w-[100px]">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
        {label}
      </span>
      <p className={`text-[22px] font-bold tabular-nums leading-none mt-1.5 ${toneCls}`}>
        {value}
      </p>
    </div>
  );
}

export default WeeklyQuotas;
