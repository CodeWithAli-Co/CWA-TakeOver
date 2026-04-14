import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Textarea } from "@/components/ui/shadcnComponents/textarea";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { CheckCircle, Edit, Plus, Calendar, Target, Trash } from "lucide-react";
import { ActiveUser } from "@/stores/query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
import supabase from "@/MyComponents/supabase";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from "date-fns";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";

type QuotaStatus = "pending" | "in-progress" | "completed";

export const QuotaItem = ({
  quota,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  quota: { id: number; status: QuotaStatus; title: string; description?: string; deadline?: string };
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
  onEdit: (quota: any) => void;
}) => {
  const statusColors: Record<QuotaStatus, string> = {
    pending: "bg-amber-500/[0.06] text-amber-400/70 border-amber-500/10",
    "in-progress": "bg-blue-500/[0.06] text-blue-400/70 border-blue-500/10",
    completed: "bg-emerald-500/[0.06] text-emerald-400/70 border-emerald-500/10",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 rounded-sm bg-card border border-white/[0.03] hover:border-primary/10 transition-all duration-400 mb-2.5 group"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-[13px] font-medium text-foreground/70">{quota.title}</h3>
            <Badge variant="outline" className={`${statusColors[quota.status]} text-[10px]`}>
              {quota.status}
            </Badge>
          </div>
          {quota.description && (
            <p className="text-[11px] text-muted-foreground/60 mb-1.5">{quota.description}</p>
          )}
          {quota.deadline && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground/40">
              <Calendar className="h-2.5 w-2.5" />
              <span>Due: {quota.deadline}</span>
            </div>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {quota.status !== "completed" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => onStatusChange(quota.id, "completed")}
              className="p-1.5 rounded-lg bg-emerald-500/[0.06] text-emerald-400/60 hover:text-emerald-400 transition-colors"
            >
              <CheckCircle className="h-3 w-3" />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onEdit(quota)}
            className="p-1.5 rounded-lg bg-muted/40 text-muted-foreground/60 hover:text-foreground/60 transition-colors"
          >
            <Edit className="h-3 w-3" />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(quota.id)}
            className="p-1.5 rounded-lg bg-red-500/[0.04] text-primary/40 hover:text-primary transition-colors"
          >
            <Trash className="h-3 w-3" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export const QuotaFormDialog = ({
  isOpen,
  onOpenChange,
  onSave,
  editingQuota,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (quota: any) => void;
  editingQuota: any | null;
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("pending");
  const [deadline, setDeadline] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (editingQuota) {
        setTitle(editingQuota.title || "");
        setDescription(editingQuota.description || "");
        setStatus(editingQuota.status || "pending");
        setDeadline(editingQuota.deadline || "");
      } else {
        setTitle("");
        setDescription("");
        setStatus("pending");
        setDeadline("");
      }
    }
  }, [isOpen, editingQuota]);

  const handleSubmit = (e: any) => {
    e.preventDefault();
    onSave({ id: editingQuota?.id, title, status, description, deadline });
    onOpenChange(false);
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="text-foreground">
          {editingQuota ? "Edit Quota" : "Add Weekly Quota"}
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter Quota Title"
              className="bg-muted/30 border-border text-foreground placeholder:text-muted-foreground/40 rounded-sm focus:border-primary/20"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-muted-foreground">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted/30 border-border text-foreground placeholder:text-muted-foreground/40 rounded-sm focus:border-primary/20"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-muted-foreground">Status</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="bg-muted/30 border-border text-foreground rounded-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#0f0f0f] border-border text-foreground rounded-sm">
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in-progress">In-progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-muted-foreground">Deadline</label>
            <Input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-muted/30 border-border text-foreground rounded-sm focus:border-primary/20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button className="bg-primary hover:bg-primary/80 text-foreground rounded-sm" type="submit">
            {editingQuota ? "Update" : "Add"} Quota
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export default function Quotas() {
  const [quotas, setQuotas] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuota, setEditingQuota] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [selectedStatus, setSelectedStatus] = useState<string>("pending");

  const { data: activeUser } = ActiveUser();
  const currentUser = activeUser?.[0];

  const startDate = startOfWeek(selectedWeek, { weekStartsOn: 1 });
  const endDate = endOfWeek(selectedWeek, { weekStartsOn: 1 });
  const dateRangeText = `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`;

  useEffect(() => {
    const loadQuotas = async () => {
      if (!currentUser) return;
      const { data, error } = await supabase
        .from("weekly_quotas")
        .select("*")
        .gte("week_start", format(startDate, "yyyy-MM-dd"))
        .lte("week_end", format(endDate, "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      if (error) { console.error("Error loading Quotas", error); return; }
      setQuotas(data || []);
    };
    loadQuotas();

    const subscription = supabase
      .channel("weekly_quotas_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "weekly_quotas" }, () => loadQuotas())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [currentUser, selectedWeek]);

  const previousWeek = () => setSelectedWeek(subWeeks(selectedWeek, 1));
  const nextWeek = () => setSelectedWeek(addWeeks(selectedWeek, 1));
  const currentWeek = () => setSelectedWeek(new Date());

  const handleSaveQuota = async (quotaData: any) => {
    if (!currentUser) return;
    const week_start = format(startDate, "yyyy-MM-dd");
    const week_end = format(endDate, "yyyy-MM-dd");

    if (quotaData.id) {
      await supabase
        .from("weekly_quotas")
        .update({ title: quotaData.title, description: quotaData.description, status: quotaData.status, deadline: quotaData.deadline, updated_at: new Date().toISOString() })
        .eq("id", quotaData.id);
    } else {
      await supabase.from("weekly_quotas").insert({
        title: quotaData.title, description: quotaData.description, status: quotaData.status,
        deadline: quotaData.deadline, user_id: currentUser.supa_id, week_start, week_end,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
    }
  };

  const handleStatusChange = async (id: any, newStatus: any) => {
    await supabase.from("weekly_quotas").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
  };

  const handleDeleteQuota = async (id: any) => {
    await supabase.from("weekly_quotas").delete().eq("id", id);
  };

  const handleEditQuota = (quota: any) => { setEditingQuota(quota); setDialogOpen(true); };

  const filteredQuotas = quotas.filter((q) => {
    const matchesSearch = q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.description && q.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && q.status === selectedStatus;
  });

  const pendingQuotas = quotas.filter((q) => q.status === "pending").length;
  const inProgressQuotas = quotas.filter((q) => q.status === "in-progress").length;
  const completedQuotas = quotas.filter((q) => q.status === "completed").length;

  return (
    <div className="bg-card border border-border rounded-sm h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-muted/40 border border-border">
            <Target className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.15em] font-medium">
              Weekly Quotas
            </span>
            <p className="text-[11px] text-muted-foreground/30 mt-0.5">{dateRangeText}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <div className="h-1 w-1 rounded-full bg-white/15" />
              <span className="text-[9px] text-muted-foreground/30 uppercase tracking-wider">Both companies</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {["Prev", "Current", "Next"].map((label, i) => (
            <Button
              key={label}
              onClick={[previousWeek, currentWeek, nextWeek][i]}
              variant="outline"
              size="sm"
              className="bg-muted/30 border-border text-muted-foreground/60 hover:text-muted-foreground/80 hover:bg-muted/50 rounded-lg text-[11px] h-7 px-2.5"
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="px-6 pb-6">
        <div className="flex justify-between items-center mb-4">
          <Input
            placeholder="Search quotas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px] h-7 text-[12px] bg-muted/30 border-border text-foreground/60 placeholder:text-muted-foreground/40 rounded-lg focus:border-primary/15"
          />
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setEditingQuota(null)}
                className="bg-primary hover:bg-primary/80 text-foreground rounded-sm h-7 text-[11px] px-3"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </DialogTrigger>
            <QuotaFormDialog isOpen={dialogOpen} onOpenChange={setDialogOpen} onSave={handleSaveQuota} editingQuota={editingQuota} />
          </Dialog>
        </div>

        <Tabs defaultValue="pending" value={selectedStatus} onValueChange={setSelectedStatus} className="mb-4">
          <TabsList className="bg-muted/30 border border-border rounded-sm h-8">
            <TabsTrigger value="pending" className="data-[state=active]:bg-amber-500/[0.08] data-[state=active]:text-amber-400/80 text-muted-foreground/60 rounded-lg text-[11px] h-6">
              Pending ({pendingQuotas})
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="data-[state=active]:bg-blue-500/[0.08] data-[state=active]:text-blue-400/80 text-muted-foreground/60 rounded-lg text-[11px] h-6">
              Active ({inProgressQuotas})
            </TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-emerald-500/[0.08] data-[state=active]:text-emerald-400/80 text-muted-foreground/60 rounded-lg text-[11px] h-6">
              Done ({completedQuotas})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <ScrollArea className="h-[350px]">
          <AnimatePresence>
            {filteredQuotas.length > 0 ? (
              filteredQuotas.map((quota) => (
                <QuotaItem key={quota.id} quota={quota} onStatusChange={handleStatusChange} onDelete={handleDeleteQuota} onEdit={handleEditQuota} />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16">
                <Target className="h-8 w-8 text-white/[0.06] mb-3" />
                <p className="text-[13px] text-muted-foreground/40">No {selectedStatus} quotas this week</p>
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>
      </div>

      <div className="px-6 py-3 border-t border-white/[0.03]">
        <p className="text-[11px] text-muted-foreground/30">Track weekly goals across both companies.</p>
      </div>
    </div>
  );
}
