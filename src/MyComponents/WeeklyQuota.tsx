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

const statusColors: Record<QuotaStatus, string> = {
  pending: "bg-amber-500/[0.08] text-amber-400 border-amber-500/15",
  "in-progress": "bg-blue-500/[0.08] text-blue-400 border-blue-500/15",
  completed: "bg-emerald-500/[0.08] text-emerald-400 border-emerald-500/15",
};

const priorityColors: Record<QuotaPriority, string> = {
  high: "bg-red-500/[0.08] text-red-400 border-red-500/15",
  medium: "bg-amber-500/[0.06] text-amber-400/80 border-amber-500/10",
  low: "bg-white/[0.04] text-white/40 border-white/[0.06]",
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="p-4 rounded-sm bg-white/[0.015] border border-white/[0.04] hover:border-red-500/10 transition-all duration-300 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <h3 className="text-[13px] font-medium text-white/80">{quota.title}</h3>
            <Badge variant="outline" className={`${statusColors[quota.status]} text-[10px]`}>
              {quota.status}
            </Badge>
            {quota.priority && (
              <Badge variant="outline" className={`${priorityColors[quota.priority]} text-[10px]`}>
                {quota.priority}
              </Badge>
            )}
            {quota.carried_from_week && (
              <span className="flex items-center gap-1 text-[10px] text-white/30 bg-white/[0.02] px-1.5 py-0.5 rounded-sm">
                <RotateCw className="h-2.5 w-2.5" /> carried over
              </span>
            )}
          </div>
          {quota.description && (
            <p className="text-[12px] text-white/40 mb-2 leading-snug">{quota.description}</p>
          )}
          {quota.deadline && (
            <div className="flex items-center gap-1 text-[11px] text-white/25">
              <Calendar className="h-3 w-3" />
              <span>Due: {quota.deadline}</span>
            </div>
          )}
        </div>

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-3 shrink-0">
          {quota.status !== "completed" && (
            <button
              onClick={() => onStatusChange(quota.id, "completed")}
              className="p-1.5 rounded-sm bg-emerald-500/[0.06] text-emerald-400/70 hover:text-emerald-400 transition-colors"
              title="Mark complete"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(quota)}
            className="p-1.5 rounded-sm bg-white/[0.04] text-white/30 hover:text-white/70 transition-colors"
            title="Edit"
          >
            <Edit className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(quota.id)}
            className="p-1.5 rounded-sm bg-red-500/[0.04] text-red-400/50 hover:text-red-400 transition-colors"
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="p-3 rounded-sm bg-white/[0.02] border border-white/[0.04] hover:border-red-500/10 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-[12px] font-medium text-white/80 flex-1 leading-snug">{quota.title}</h4>
        {quota.priority && (
          <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ml-1.5 ${priorityColors[quota.priority]}`}>
            {quota.priority}
          </span>
        )}
      </div>
      {quota.description && (
        <p className="text-[11px] text-white/30 leading-snug mb-2">{quota.description}</p>
      )}
      {quota.deadline && (
        <div className="flex items-center gap-1 text-[10px] text-white/25 mb-2">
          <Calendar className="h-2.5 w-2.5" /> {quota.deadline}
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.04] opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-1">
          <button onClick={() => onEdit(quota)} className="p-1 rounded-sm hover:bg-white/[0.04] text-white/30 hover:text-white/70" title="Edit">
            <Edit className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(quota.id)} className="p-1 rounded-sm hover:bg-red-500/[0.06] text-white/30 hover:text-red-400" title="Delete">
            <Trash className="h-3 w-3" />
          </button>
        </div>
        {nextStatus && (
          <button
            onClick={() => onStatusChange(quota.id, nextStatus)}
            className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5"
          >
            Move <ChevronRight className="h-2.5 w-2.5" />
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
            <label className="text-[11px] text-white/30 uppercase tracking-wider">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="bg-white/[0.02] border-white/[0.06] text-white rounded-sm placeholder:text-white/15 focus:border-red-500/20"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-white/30 uppercase tracking-wider">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white/[0.02] border-white/[0.06] text-white rounded-sm placeholder:text-white/15 focus:border-red-500/20"
              placeholder="Optional details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-[11px] text-white/30 uppercase tracking-wider">Status</label>
              <Select value={status} onValueChange={(v) => setStatus(v as QuotaStatus)}>
                <SelectTrigger className="bg-white/[0.02] border-white/[0.06] text-white rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-white/[0.06] text-white rounded-sm">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] text-white/30 uppercase tracking-wider">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as QuotaPriority)}>
                <SelectTrigger className="bg-white/[0.02] border-white/[0.06] text-white rounded-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] border-white/[0.06] text-white rounded-sm">
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[11px] text-white/30 uppercase tracking-wider">Deadline</label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-white/[0.02] border-white/[0.06] text-white rounded-sm focus:border-red-500/20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button className="bg-red-600 hover:bg-red-500 text-white rounded-sm" type="submit">
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
export const WeeklyQuotas = () => {
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

  return (
    <div className="min-h-screen bg-black overflow-y-auto">
      {/* Header */}
      <div className="px-8 pt-7 pb-2">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-red-500/[0.08] border border-red-500/15">
              <Target className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-[24px] font-bold text-white tracking-tight">Weekly Quotas</h1>
              <p className="text-[12px] text-white/20 mt-0.5">{dateRangeText}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Week nav */}
            <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-sm">
              <button
                onClick={() => setSelectedWeek(subWeeks(selectedWeek, 1))}
                className="p-2 text-white/30 hover:text-white/70 hover:bg-white/[0.04] rounded-sm"
                title="Previous week"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setSelectedWeek(new Date())}
                className="px-3 py-1.5 text-[11px] text-white/40 hover:text-white border-x border-white/[0.04]"
              >
                Today
              </button>
              <button
                onClick={() => setSelectedWeek(addWeeks(selectedWeek, 1))}
                className="p-2 text-white/30 hover:text-white/70 hover:bg-white/[0.04] rounded-sm"
                title="Next week"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* View toggle */}
            <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-sm p-0.5">
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded-sm transition-colors ${
                  view === "list" ? "bg-red-500/[0.1] text-red-400" : "text-white/25 hover:text-white/50"
                }`}
                title="List view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setView("kanban")}
                className={`p-1.5 rounded-sm transition-colors ${
                  view === "kanban" ? "bg-red-500/[0.1] text-red-400" : "text-white/25 hover:text-white/50"
                }`}
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/[0.1] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[11px] font-medium rounded-sm transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add Quota
                </button>
              </DialogTrigger>
              <QuotaFormDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSaveQuota} editingQuota={editingQuota} />
            </Dialog>
          </div>
        </div>
      </div>

      {/* Summary card with progress bar */}
      <div className="px-8 pt-5">
        <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
          <div className="flex">
            {/* Progress + main metric */}
            <div className="flex-1 px-5 py-4 border-r border-white/[0.04]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em] font-medium">
                  This Week's Progress
                </span>
                <span className="text-[18px] font-bold text-white tracking-tight">
                  {completionPct.toFixed(0)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full"
                />
              </div>
              <p className="text-[11px] text-white/30 mt-2">
                {completed} of {total} {total === 1 ? "quota" : "quotas"} completed
              </p>
            </div>

            {/* Status cells */}
            <div className="px-5 py-4 border-r border-white/[0.04] min-w-[100px]">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Pending</span>
              <p className="text-xl font-bold text-amber-400 tracking-tight mt-1">{pending}</p>
            </div>
            <div className="px-5 py-4 border-r border-white/[0.04] min-w-[100px]">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Active</span>
              <p className="text-xl font-bold text-blue-400 tracking-tight mt-1">{inProgress}</p>
            </div>
            <div className="px-5 py-4 border-r border-white/[0.04] min-w-[100px]">
              <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">Done</span>
              <p className="text-xl font-bold text-emerald-400 tracking-tight mt-1">{completed}</p>
            </div>

            {/* Week vs week */}
            <div className="px-5 py-4 min-w-[150px]">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-3 w-3 text-red-500/60" />
                <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">vs Last Week</span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className={`text-xl font-bold tracking-tight ${
                  pctDelta >= 0 ? "text-emerald-400" : "text-red-400"
                }`}>
                  {pctDelta >= 0 ? "+" : ""}{pctDelta.toFixed(0)}%
                </p>
              </div>
              <p className="text-[11px] text-white/30 mt-0.5">
                Last: {lastPct.toFixed(0)}% ({lastCompleted}/{lastTotal})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-8 pt-4">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status pills */}
          <div className="flex items-center bg-white/[0.02] border border-white/[0.04] rounded-sm p-0.5">
            {(["all", "pending", "in-progress", "completed"] as const).map((s) => {
              const counts: Record<string, number> = { all: total, pending, "in-progress": inProgress, completed };
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 rounded-sm text-[11px] font-medium transition-all ${
                    statusFilter === s
                      ? "bg-red-500/[0.1] text-red-400"
                      : "text-white/25 hover:text-white/50"
                  }`}
                >
                  {s === "all" ? "All" : s === "pending" ? "Pending" : s === "in-progress" ? "Active" : "Done"} ({counts[s]})
                </button>
              );
            })}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Search quotas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-xs px-3 py-1.5 bg-white/[0.02] border border-white/[0.04] rounded-sm text-[12px] text-white/60 placeholder:text-white/15 focus:outline-none focus:border-white/[0.08]"
          />

          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="p-1.5 rounded-sm bg-white/[0.02] text-white/30 hover:text-white/60">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Quotas display */}
      <div className="px-8 py-5 pb-10">
        {filtered.length === 0 ? (
          <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm py-16 text-center">
            <Target className="h-10 w-10 text-white/[0.05] mx-auto mb-3" />
            <p className="text-[14px] text-white/30 font-medium mb-1">
              {quotas.length === 0 ? "No quotas this week" : "No quotas match your filters"}
            </p>
            <p className="text-[12px] text-white/15">
              {quotas.length === 0 ? "Add a goal to get started" : "Try a different filter or search term"}
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
          // Kanban view — 3 columns
          <div className="grid grid-cols-3 gap-4">
            {(["pending", "in-progress", "completed"] as QuotaStatus[]).map((status) => {
              const colQuotas = filtered.filter((q) => q.status === status);
              const colColors = {
                pending: { dot: "bg-amber-400", text: "text-amber-400" },
                "in-progress": { dot: "bg-blue-400", text: "text-blue-400" },
                completed: { dot: "bg-emerald-400", text: "text-emerald-400" },
              };
              const c = colColors[status];
              return (
                <div key={status} className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-white/[0.04] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                      <span className={`text-[11px] uppercase tracking-wider font-medium ${c.text}`}>
                        {status === "in-progress" ? "Active" : status}
                      </span>
                    </div>
                    <span className="text-[11px] text-white/30">{colQuotas.length}</span>
                  </div>
                  <div className="p-2 space-y-1.5 min-h-[200px]">
                    <AnimatePresence>
                      {colQuotas.length === 0 ? (
                        <div className="text-[11px] text-white/15 text-center py-6">
                          No quotas
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

export default WeeklyQuotas;
