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
import { CWADashboard } from "@/MyComponents/Dashboard/CWADashboard";
import { SimplicityDashboard } from "@/MyComponents/Dashboard/SimplicityDashboard";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

  // Show the bento dashboards when a specific company is selected
  const showCWADashboard = activeCompany === "codeWithAli";
  const showSimplicityDashboard = activeCompany === "simplicityFunds";
  const showOverview = activeCompany === "all";

  return (
    <div className="min-h-screen bg-background overflow-y-auto transition-colors duration-500">
      {/* ── Page header — solid zinc-900 band with both a sharp zinc
            border AND a brand-accent gradient hairline at the very
            bottom for a real visible "title bar" feel. The accent line
            ties it to the rest of the app's red language without
            painting the whole strip red. */}
      <div className="px-8 py-7 bg-zinc-950/40 border-b border-zinc-700 relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-amber-500 to-transparent"
        />
        <div className="flex items-end justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[26px] font-bold text-foreground tracking-tight"
            >
              {getGreeting()},{" "}
              <span className="text-primary">{username}</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-[12px] text-muted-foreground mt-1 flex items-center gap-1.5"
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
              <QuickActionCard title="Invoicer" url="/invoicer" icon={File} />
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

      {/* ── Main Content ── */}
      <div className="px-8 pt-4 pb-10 space-y-4">
        {/* Schedule image */}
        <UserView userRole={[Role.CEO, Role.COO]}>
          <img
            src="/schedule.png"
            alt="Schedule"
            className={`${isShowing ? "w-full h-auto" : "h-0"} rounded-sm border border-border transition-all duration-300`}
          />
        </UserView>

        {/* ── Bento Dashboard: CWA ── */}
        {showCWADashboard && (
          <motion.div
            key="cwa-dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <CWADashboard />
          </motion.div>
        )}

        {/* ── Bento Dashboard: Simplicity ── */}
        {showSimplicityDashboard && (
          <motion.div
            key="simplicity-dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <SimplicityDashboard />
          </motion.div>
        )}

        {/* ── Overview: "All" company view (original layout) ── */}
        {showOverview && (
          <>
            {/* Company Cards */}
            <UserView userRole={[Role.CEO, Role.COO]}>
              <div className="grid grid-cols-2 gap-4">
                <CompanyCard name="CodeWithAli" description="Software agency & media" memberCount={7} projectCount={4} revenue="$671" status="active" accentPosition="left" companyKey="codeWithAli" />
                <CompanyCard name="Simplicity" description="Fintech budgeting platform" memberCount={3} projectCount={2} revenue="$0" status="growing" accentPosition="right" companyKey="simplicityFunds" />
              </div>
            </UserView>

            {/* Stats strip */}
            <UserView excludeRoles={[Role.Intern, Role.Member]}>
              <CompanyStats />
            </UserView>

            {/* Row: Activity+Team | Meetings */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-7">
                <div className="bg-card border border-border rounded-sm overflow-hidden h-full">
                  <div className="grid grid-cols-2 h-full">
                    <div className="border-r border-border">
                      <div className="px-5 pt-4 pb-2">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
                          Recent Activity
                        </span>
                      </div>
                      <div className="px-5 pb-5">
                        <ActivityFeed />
                      </div>
                    </div>
                    <div>
                      <div className="px-5 pt-4 pb-2">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
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

              <UserView userRole={[Role.CEO, Role.COO, Role.ProjectManager, Role.Marketing]}>
                <div className="col-span-12 lg:col-span-5">
                  <Meetings />
                </div>
              </UserView>
            </div>

            {/* Row: Tasks | Quotas */}
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-5">
                <TasksComponent />
              </div>
              <div className="col-span-12 lg:col-span-7">
                <Quotas />
              </div>
            </div>

            {/* Storage */}
            <UserView userRole={[Role.CEO, Role.COO]}>
              <div className="max-w-md">
                <StorageUsageChart />
              </div>
            </UserView>
          </>
        )}
      </div>
    </div>
  );
};

export const Route = createLazyFileRoute("/")({
  component: Index,
});

export default Index;
