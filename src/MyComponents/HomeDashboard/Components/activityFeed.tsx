import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  CheckCircle2,
  UserPlus,
  FileText,
  DollarSign,
  Calendar,
  AlertCircle,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { useCompanyFilter } from "@/stores/store";

interface ActivityItem {
  id: number;
  type: "task_done" | "meeting" | "message" | "expense" | "revenue" | "member" | "quota" | "general";
  description: string;
  timestamp: string;
  company: "codeWithAli" | "simplicityFunds" | "both";
}

const typeConfig = {
  task_done: { icon: CheckCircle2, color: "text-emerald-500/70" },
  meeting: { icon: Calendar, color: "text-red-400/70" },
  message: { icon: MessageSquare, color: "text-blue-400/70" },
  expense: { icon: DollarSign, color: "text-amber-400/70" },
  revenue: { icon: DollarSign, color: "text-emerald-400/70" },
  member: { icon: UserPlus, color: "text-purple-400/70" },
  quota: { icon: FileText, color: "text-red-400/70" },
  general: { icon: AlertCircle, color: "text-white/30" },
};

const companyBadge = {
  codeWithAli: { label: "CWA", dot: "bg-red-500" },
  simplicityFunds: { label: "SMP", dot: "bg-blue-500" },
  both: { label: "Both", dot: "bg-white/20" },
};

const formatTimeAgo = (timestamp: string) => {
  const now = new Date();
  const then = new Date(timestamp);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const ActivityFeed = () => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const { activeCompany } = useCompanyFilter();

  useEffect(() => {
    async function loadActivity() {
      const { data: doneTasks } = await supabase
        .from("cwa_todos")
        .select("todo_id, title, created_at")
        .eq("status", "done")
        .order("created_at", { ascending: false })
        .limit(3);

      const { data: meetings } = await supabase
        .from("cwa_meetings")
        .select("id, meeting_title, date")
        .order("id", { ascending: false })
        .limit(2);

      const { data: quotas } = await supabase
        .from("weekly_quotas")
        .select("id, title, updated_at")
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(2);

      const feed: ActivityItem[] = [];

      doneTasks?.forEach((t) =>
        feed.push({
          id: t.todo_id,
          type: "task_done",
          description: `Completed: ${t.title}`,
          timestamp: t.created_at,
          company: "both", // No company_id on tasks yet
        })
      );

      meetings?.forEach((m) =>
        feed.push({
          id: m.id + 1000,
          type: "meeting",
          description: `Meeting: ${m.meeting_title}`,
          timestamp: m.date || new Date().toISOString(),
          company: "both",
        })
      );

      quotas?.forEach((q) =>
        feed.push({
          id: q.id + 2000,
          type: "quota",
          description: `Quota done: ${q.title}`,
          timestamp: q.updated_at,
          company: "both",
        })
      );

      feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivities(feed.slice(0, 8));
    }
    loadActivity();
  }, []);

  // Filter by company when one is selected
  const filtered =
    activeCompany === "all"
      ? activities
      : activities.filter((a) => a.company === activeCompany || a.company === "both");

  return (
    <div className="space-y-0.5">
      <AnimatePresence>
        {filtered.length > 0 ? (
          filtered.map((activity, i) => {
            const config = typeConfig[activity.type];
            const Icon = config.icon;
            const badge = companyBadge[activity.company];
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-start gap-3 py-2.5 group"
              >
                <div className="flex flex-col items-center pt-0.5">
                  <div className={`p-1.5 rounded-sm bg-white/[0.02] ${config.color}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  {i < filtered.length - 1 && (
                    <div className="w-px h-full min-h-[16px] bg-white/[0.03] mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] text-white/50 leading-snug truncate group-hover:text-white/70 transition-colors flex-1">
                      {activity.description}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className={`h-1 w-1 rounded-full ${badge.dot}`} />
                      <span className="text-[9px] text-white/15 uppercase tracking-wider font-medium">
                        {badge.label}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-white/15 block">{formatTimeAgo(activity.timestamp)}</span>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="py-6 text-center">
            <p className="text-[12px] text-white/15">No recent activity</p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
