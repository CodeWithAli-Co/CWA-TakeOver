import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  CircleDollarSign,
  BarChart3,
  DollarSign,
  File,
  FolderCode,
  Video,
} from "lucide-react";
import supabase from "../supabase";
import UserView, { Role } from "../Reusables/userView";
import { ActiveUser } from "@/stores/query";

// Single stat cell within the unified strip
const StatCell = ({
  icon: Icon,
  label,
  value,
  highlight = false,
  negative = false,
  borderRight = true,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  highlight?: boolean;
  negative?: boolean;
  borderRight?: boolean;
}) => (
  <div className={`flex-1 px-5 py-4 ${borderRight ? "border-r border-white/[0.04]" : ""} group/cell`}>
    <div className="flex items-center gap-1.5 mb-2">
      <Icon className={`h-3 w-3 ${negative ? "text-red-500/50" : highlight ? "text-emerald-500/50" : "text-white/15"}`} />
      <span className="text-[10px] text-white/20 uppercase tracking-[0.12em]">{label}</span>
    </div>
    <div className={`text-xl font-bold tracking-tight ${
      negative ? "text-red-400/90" : highlight ? "text-white" : "text-white/90"
    }`}>
      {value}
    </div>
  </div>
);

const CompanyStats = () => {
  const [initialCapital, setInitialCapital] = useState("0");
  const [appUsers, setAppUsers] = useState("0");
  const [subscription, setSubscription] = useState("0");
  const [expenses, setExpenses] = useState("0");
  const [meeting, setMeetings] = useState("0");
  const [accounts, setAccounts] = useState("0");
  const [userTasks, setUserTasks] = useState(0);
  const [completedTasks, setCompletedTasks] = useState(0);

  const { data: user } = ActiveUser();
  const userRole = user[0].role || Role.Member;

  useEffect(() => {
    async function fetchStats() {
      try {
        const { data: meeting } = await supabase.from("cwa_meetings").select("id");
        const { data: credentials } = await supabase.from("cwa_creds").select("id, folder");
        const { data: allTask } = await supabase.from("cwa_todos").select("todo_id, label, status").eq("label", userRole);
        const { data: expense } = await supabase.from("cwa_expenses").select("amount");
        const { data: revenue } = await supabase.from("cwa_calculatorProps").select("initialCapital").single();
        const { data: userCount } = await supabase.from("app_users").select("id");
        const { data: subscriptions } = await supabase.from("cwa_revenues").select("amount").eq("revenueType", "subscription");

        let totalExpense = 0;
        if (expense?.length) totalExpense = expense.reduce((total, e) => total - (e.amount || 0), 0);

        let totSubs = 0;
        if (subscriptions?.length) totSubs = subscriptions.reduce((total, s) => total + (s.amount || 0), 0);

        if (allTask) {
          setUserTasks(allTask.filter((t) => t.label === userRole).length);
          setCompletedTasks(allTask.filter((t) => t.status === "done").length);
        }

        if (credentials) {
          let show = 0;
          if (userRole === Role.CEO || userRole === Role.COO) show = credentials.length;
          else if (userRole === Role.Marketing || userRole === Role.AccManager)
            show = credentials.filter((c) => c.folder === "default").length;
          setAccounts(show.toString());
        }

        setMeetings(meeting?.length as unknown as string);
        setInitialCapital(revenue?.initialCapital);
        setAppUsers(userCount!.length as unknown as string);
        setSubscription(totSubs.toFixed(2));
        setExpenses(totalExpense.toFixed(2));
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    }
    fetchStats();
  }, [userRole]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden"
    >
      {/* Primary financial stats — single connected row */}
      <UserView userRole={[Role.CEO, Role.COO]}>
        <div className="flex border-b border-white/[0.04]">
          <StatCell icon={CircleDollarSign} label="Bank" value={`$${initialCapital}`} highlight />
          <StatCell icon={DollarSign} label="Expenses" value={`$${expenses}`} negative />
          <StatCell icon={BarChart3} label="Subscriptions" value={`$${subscription}`} />
          <StatCell icon={Users} label="Users" value={appUsers} borderRight={false} />
        </div>
      </UserView>

      {/* Secondary stats — connected row below */}
      <div className="flex">
        <StatCell icon={File} label="Tasks" value={userTasks - completedTasks} />
        <UserView userRole={[Role.CEO, Role.COO, Role.AccManager, Role.Marketing]}>
          <StatCell label="Accounts" value={accounts} icon={FolderCode} />
        </UserView>
        <StatCell label="Meetings" icon={Video} value={meeting} borderRight={false} />
      </div>
    </motion.div>
  );
};

export default CompanyStats;
