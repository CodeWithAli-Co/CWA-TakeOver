import { createLazyFileRoute } from "@tanstack/react-router";
import { StorageUsageChart } from "@/MyComponents/HomeDashboard/storage";
import {
  MessageSquare,
  Users,
  Terminal,
  DollarSignIcon,
  File,
  CalendarSearch,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import Quotas from "@/MyComponents/HomeDashboard/qoutas";
import CompanyStats from "@/MyComponents/HomeDashboard/companyStats";
import Meetings from "@/MyComponents/HomeDashboard/meetings";
import { SchedImgStore, useCompanyFilter, type CompanyFilter } from "@/stores/store";
import { QuickActionCard } from "@/MyComponents/HomeDashboard/Components/quickActionCard";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import { ActiveUser } from "@/stores/query";
import { CompanyCard } from "@/MyComponents/HomeDashboard/Components/companyCard";
import { ActivityFeed } from "@/MyComponents/HomeDashboard/Components/activityFeed";
import { TeamPresence } from "@/MyComponents/HomeDashboard/Components/teamPresence";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// ── Company Selector Tabs ──
const CompanyTabs = () => {
  const { activeCompany, setActiveCompany } = useCompanyFilter();

  const tabs: { key: CompanyFilter; label: string; dot?: string }[] = [
    { key: "all", label: "All" },
    { key: "codeWithAli", label: "CodeWithAli", dot: "bg-red-500" },
    { key: "simplicityFunds", label: "Simplicity", dot: "bg-blue-500" },
  ];

  return (
    <div className="flex items-center gap-1 bg-white/[0.02] border border-white/[0.04] rounded-sm p-0.5 w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => setActiveCompany(tab.key)}
          className={`px-3 py-1 rounded-sm text-[11px] font-medium transition-all duration-200 ${
            activeCompany === tab.key
              ? "bg-red-500/[0.1] text-red-400"
              : "text-white/20 hover:text-white/40"
          }`}
        >
          {tab.dot && (
            <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${tab.dot}`} />
          )}
          {tab.label}
        </button>
      ))}
    </div>
  );
};

const Index = () => {
  const { isShowing } = SchedImgStore();
  const { data: user } = ActiveUser();
  const username = user?.[0]?.username || "there";
  const { activeCompany } = useCompanyFilter();

  const currentDate = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-black overflow-y-auto">
      {/* ── Header ── */}
      <div className="px-8 pt-7 pb-1">
        <div className="flex items-end justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[26px] font-bold text-white tracking-tight"
            >
              {getGreeting()},{" "}
              <span className="text-red-500">{username}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-[12px] text-white/20 mt-1 flex items-center gap-1.5"
            >
              <Clock className="h-3 w-3" />
              {currentDate}
            </motion.p>
          </div>

          {/* Quick nav */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-1.5"
          >
            <UserView userRole={[Role.CEO, Role.COO, Role.ProjectManager, Role.Marketing]}>
              <QuickActionCard icon={Terminal} url="/details" title="Accounts" />
            </UserView>
            <QuickActionCard title="Chat" icon={MessageSquare} url="/chat" />
            <UserView userRole={["CEO", "COO"]}>
              <QuickActionCard title="Finance" url="/financialDashboard" icon={DollarSignIcon} />
            </UserView>
            <UserView excludeRoles={"COO"}>
              <QuickActionCard title="Invoicer" url="/invoiceClients" icon={File} />
            </UserView>
            <UserView excludeRoles={["COO", "CEO"]}>
              <QuickActionCard title="Schedule" url="/schedule" icon={CalendarSearch} />
            </UserView>
            <UserView userRole={[Role.CEO, Role.COO]}>
              <QuickActionCard title="Employees" icon={Users} url="/employee" />
            </UserView>
          </motion.div>
        </div>
      </div>

      {/* ── Company Tabs ── */}
      <UserView userRole={[Role.CEO, Role.COO]}>
        <div className="px-8 pt-4">
          <CompanyTabs />
        </div>
      </UserView>

      {/* ── Main Grid ── */}
      <div className="px-8 pt-4 pb-10 space-y-4">
        {/* Schedule image */}
        <UserView userRole={[Role.CEO, Role.COO]}>
          <img
            src="/schedule.png"
            alt="Schedule"
            className={`${isShowing ? "w-full h-auto" : "h-0"} rounded-sm border border-white/[0.04] transition-all duration-300`}
          />
        </UserView>

        {/* ── Company Cards ── */}
        <UserView userRole={[Role.CEO, Role.COO]}>
          {activeCompany === "all" ? (
            <div className="grid grid-cols-2 gap-4">
              <CompanyCard name="CodeWithAli" description="Software agency & media" memberCount={7} projectCount={4} revenue="$671" status="active" accentPosition="left" companyKey="codeWithAli" />
              <CompanyCard name="Simplicity" description="Fintech budgeting platform" memberCount={3} projectCount={2} revenue="$0" status="growing" accentPosition="right" companyKey="simplicityFunds" />
            </div>
          ) : (
            <CompanyCard
              name={activeCompany === "codeWithAli" ? "CodeWithAli" : "Simplicity"}
              description={activeCompany === "codeWithAli" ? "Software agency & media" : "Fintech budgeting platform"}
              memberCount={activeCompany === "codeWithAli" ? 7 : 3}
              projectCount={activeCompany === "codeWithAli" ? 4 : 2}
              revenue={activeCompany === "codeWithAli" ? "$671" : "$0"}
              status={activeCompany === "codeWithAli" ? "active" : "growing"}
              accentPosition="left"
              companyKey={activeCompany}
            />
          )}
        </UserView>

        {/* ── Stats strip (one unified card) ── */}
        <UserView excludeRoles={[Role.Intern, Role.Member]}>
          <CompanyStats />
        </UserView>

        {/* ── Row: Activity+Team (connected) | Meetings (fills column) ── */}
        <div className="grid grid-cols-12 gap-4">
          {/* Activity + Team — single card with internal divider */}
          <div className="col-span-12 lg:col-span-7">
            <div className="bg-[#0a0a0a] border border-white/[0.04] rounded-sm overflow-hidden h-full">
              <div className="grid grid-cols-2 h-full">
                {/* Activity side */}
                <div className="border-r border-white/[0.04]">
                  <div className="px-5 pt-4 pb-2">
                    <span className="text-[11px] text-white/15 uppercase tracking-[0.15em] font-medium">
                      Recent Activity
                    </span>
                  </div>
                  <div className="px-5 pb-5">
                    <ActivityFeed />
                  </div>
                </div>
                {/* Team side */}
                <div>
                  <div className="px-5 pt-4 pb-2">
                    <span className="text-[11px] text-white/15 uppercase tracking-[0.15em] font-medium">
                      Team
                    </span>
                  </div>
                  <div className="px-5 pb-5">
                    <TeamPresence />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Meetings — fills remaining column, stretches to match */}
          <UserView userRole={[Role.CEO, Role.COO, Role.ProjectManager, Role.Marketing]}>
            <div className="col-span-12 lg:col-span-5 h-full">
              <Meetings />
            </div>
          </UserView>
        </div>

        {/* ── Row: Tasks | Quotas ── */}
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-5">
            <TasksComponent />
          </div>
          <div className="col-span-12 lg:col-span-7">
            <Quotas />
          </div>
        </div>

        {/* ── Storage ── */}
        <UserView userRole={[Role.CEO, Role.COO]}>
          <div className="max-w-md">
            <StorageUsageChart />
          </div>
        </UserView>
      </div>
    </div>
  );
};

export const Route = createLazyFileRoute("/")({
  component: Index,
});

export default Index;
