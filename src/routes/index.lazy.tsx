import { createLazyFileRoute } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { StorageUsageChart } from "@/MyComponents/HomeDashboard/storage";

import { MessageSquare, Users, Terminal, GitGraph, DollarSign, DollarSignIcon, File, CalendarSearch } from "lucide-react";
import { motion } from "framer-motion";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import Quotas from "@/MyComponents/HomeDashboard/qoutas";
import CompanyStats from "@/MyComponents/HomeDashboard/companyStats";
import Meetings from "@/MyComponents/HomeDashboard/meetings";
import { SchedImgStore } from "@/stores/store";
import { QuickActionCard } from "@/MyComponents/HomeDashboard/Components/quickActionCard";
import { TasksComponent } from "@/MyComponents/HomeDashboard/tasks";
import { pdf } from "@react-pdf/renderer";

const Index = () => {
  const { isShowing } = SchedImgStore();
  return (
    <div className="min-h-screen bg-black overflow-y-auto">
      {/* Navigation Bar */}
      <nav className="border-b border-red-900/30 bg-black/40 sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-6">
          <div className="flex items-center space-x-4">
            <h1 className="bg-gradient-to-r from-red-500 to-red-900 bg-clip-text text-transparent font-bold">
              Dashboard
            </h1>
          </div>
        </div>
      </nav>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-6"
      >
        {/* Company Stats */}
        <UserView excludeRoles={[Role.Intern, Role.Member]}>
          <CompanyStats />
        </UserView>

        <UserView userRole={[Role.CEO, Role.COO]}>
          {/* Set a pop-up function/component to it */}
          <img
            src="/schedule.png"
            alt="Schedule"
            className={`${isShowing ? "w-full h-auto" : "h-0 w-[1000px]"} flex justify-self-center border-2 border-red-700/50 rounded-xl shadow-md shadow-red-600/40 hover:brightness-110 transition-all duration-300`}
          />
        </UserView>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Upcoming Meetings */}
          <UserView userRole={[Role.CEO, Role.COO, Role.ProjectManager, Role.Marketing]}>
            <Meetings />
          </UserView>

          {/* Quick Actions */}
          <Card className="bg-zinc-950/20 border-red-900/30 rounded-xs">
            <CardHeader>
              <CardTitle className="text-amber-50">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="">
                <UserView
                  userRole={[
                    Role.CEO,
                    Role.COO,
                    Role.ProjectManager,
                    Role.Marketing,
                  ]}
                >
                  <div className="group flex flex-col ">
                    <QuickActionCard
                      icon={Terminal}
                      url="/details"
                      title="Accounts"
                    />
                    {/* <span className="text-white text-sm m-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ">
                      Accounts
                    </span> */}
                  </div>
                </UserView>
                <div className="group flex flex-col ">
                  <QuickActionCard
                    title="Chat"
                    icon={MessageSquare}
                    url="/chat"
                  />
                  {/* <span className="text-white text-sm m-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Chat
                  </span> */}
                </div>
                <div className="group flex flex-col">
                  <UserView userRole= {[ "CEO", "COO"]}>

                  <QuickActionCard 
                    title="FinancePrince"
                    url="/financialDashboard"
                    icon={DollarSignIcon}
                  />
                  </UserView>
                </div>
                <div className="group flex flex-col">
                  <UserView excludeRoles={"COO"}>

                  <QuickActionCard 
                   title="Invoicer"
                   url="/invoiceClients"
                   icon={File}
                  />
                  </UserView>
                </div>

                <div className="group flex flex-col">
                  <UserView excludeRoles={["COO", "CEO"]}>
                      <QuickActionCard 
                        title="Schedule"
                        url="/schedule"
                        icon={CalendarSearch}
                      />
                  </UserView>
                </div>

                <div className="group flex flex-col">
                  <UserView userRole={[Role.CEO, Role.COO]}>
                    <QuickActionCard
                      title="Employees"
                      icon={Users}
                      url="/employee"
                    />
                    {/* <span className="text-sm  m-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200  ">
                      Employees
                    </span> */}
                  </UserView>
                </div>
              </motion.div>
            </CardContent>
          </Card>

          {/* Weekly Quota */}
          <Quotas />

          {/* Tasks */}
          <TasksComponent />

          {/* storage graph */}
          <UserView userRole={[Role.CEO, Role.COO]}>
            <StorageUsageChart />
          </UserView>

          {/* Api & Webhooks View */}
          {/* <UserView userRole={[Role.CEO, Role.COO]}>
            <ApiWebhooks />
          </UserView> */}
        </div>
      </motion.div>
    </div>
  );
};
export const Route = createLazyFileRoute("/")({
  component: Index,
});

export default Index;
