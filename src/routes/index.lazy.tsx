import React from "react";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";
import { StorageUsageChart } from "@/MyComponents/HomeDashboard/storage";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Input } from "@/components/ui/shadcnComponents/input";

import { ActiveUser, Employees, Todos } from "@/stores/query";
import { Activity, MessageSquare, Users, Terminal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import supabase from "@/MyComponents/supabase";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "@/MyComponents/Sidebar/handlingTasking/addTodo";
import Quotas from "@/MyComponents/HomeDashboard/qoutas";
import CompanyStats from "@/MyComponents/HomeDashboard/companyStats";
import Meetings from "@/MyComponents/HomeDashboard/meetings";

// Enhanced Task Priority Badge with animation
const TaskPriorityBadge = ({ priority }: { priority: any }) => {
  const colors = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };
  return (
    <motion.div whileHover={{ scale: 1.05 }}>
      <Badge variant="outline" className={`${colors[priority]} text-xs ml-2`}>
        {priority}
      </Badge>
    </motion.div>
  );
};

// Enhanced Quick Action Card with animations
const QuickActionCard = ({
  title,
  icon: Icon,
  url,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  url: string;
}) => (
  <Link to={`${url}`} from="/" draggable={false}>
    <motion.div
      whileHover={{ scale: 1.0 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
      className="flex items-center justify-between p-4 bg-black/60 border border-red-900/30 rounded-lg hover:border-red-800/50 group"
    >
      <div className="flex items-center ">
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="p-2 rounded-lg bg-red-900/20"
        >
          <Icon className="h-5 w-5 text-red-500" />
        </motion.div>
        <div>
          <h3 className="text-sm font-medium text-amber-50 group-hover:text-amber-100">
            {title}
          </h3>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        whileHover={{ opacity: 1, x: 0 }}
        className="flex items-center gap-2"
      >
        {/* <ChevronRight className="h-4 w-4 text-red-500" /> */}
      </motion.div>
    </motion.div>
  </Link>
);

// Task Item Component with animations
const TaskItem = ({ task }: { task: any }) => {
  async function EditTask(todoStatus: string, todoID: number) {
    const { error } = await supabase
      .from("cwa_todos")
      .update({ status: todoStatus })
      .eq("todo_id", todoID);
    if (error) {
      await message(error.message, {
        title: "Error Editing Todo Status",
        kind: "error",
      });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ scale: 1.01 }}
      className="flex items-center justify-between p-3 rounded-lg hover:bg-red-900/10 
              transition-colors border border-transparent hover:border-red-900/30"
    >
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="p-2 rounded-lg bg-red-900/20"
        >
          <Activity className="h-4 w-4 text-red-500" />
        </motion.div>
        <div>
          <div className="flex items-center">
            <span className="text-sm font-medium text-amber-50">
              {task.title}
            </span>
            <TaskPriorityBadge priority={task.priority} />
          </div>
          <span className="text-xs text-amber-50/70">{task.deadline}</span>
        </div>
      </div>
      {task.status === "to-do" && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 px-3 py-1 rounded"
          onClick={() => EditTask("in-progress", task.todo_id)}
        >
          Start
        </motion.button>
      )}

      {task.status === "in-progress" && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 px-3 py-1 rounded"
          onClick={() => EditTask("done", task.todo_id)}
        >
          Finish
        </motion.button>
      )}
    </motion.div>
  );
};

// Enhanced Tasks Component with Tabs
const TasksComponent = () => {
  const [selectedTab, setSelectedTab] = useState("to-do");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: AllEmployees, error: EmployeesError } = Employees();
  if (EmployeesError) {
    console.log(
      "Error fetching Employees for ToDo in Home",
      EmployeesError.message
    );
  }

  // Get the active user
  const { data: user, error: activeUserError } = ActiveUser();
  if (activeUserError) {
    console.log(
      "Error fetching Active User for Tasks",
      activeUserError.message
    );
  }

  // Fetch todos for the active user
  const {
    data: todos,
    error: TodoError,
    refetch: refetchTodos,
  } = Todos(user?.[0]?.username);

  if (TodoError) {
    console.log("Error fetching Todos Data:", TodoError.message);
  }

  // Set up real-time subscription
  useEffect(() => {
    const subscription = supabase
      .channel("all-todos")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_todos" },
        () => refetchTodos()
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [refetchTodos]);

  // Fetch todos when tab changes
  useEffect(() => {
    if (user && user.length > 0) {
      refetchTodos();
    }
  }, [selectedTab, user]);

  // Filter tasks based on selected tab and search query
  const filteredTasks =
    todos?.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (task.description &&
          task.description.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = task.status === selectedTab;
      return matchesSearch && matchesStatus;
    }) || [];

  // Count tasks by status
  const todoCount =
    todos?.filter((task) => task.status === "to-do").length || 0;
  const inProgressCount =
    todos?.filter((task) => task.status === "in-progress").length || 0;
  const doneCount = todos?.filter((task) => task.status === "done").length || 0;
  const totalTasks = todos?.length || 0;

  return (
    <Card className="bg-black/40 border-red-900/30 ">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-amber-50">Tasks</CardTitle>
          <p className="text-sm text-amber-50/70 mt-1">
            {totalTasks} total tasks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[200px] bg-black/40 border-red-900/30 text-amber-50"
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <AddTodo Users={AllEmployees || []} />
          </motion.div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="to-do" className="mb-4">
          <TabsList className="bg-black/40 border border-red-900/30">
            <TabsTrigger
              value="to-do"
              onClick={() => setSelectedTab("to-do")}
              className="data-[state=active]:bg-red-900/20"
            >
              To Do ({todoCount})
            </TabsTrigger>
            <TabsTrigger
              value="in-progress"
              onClick={() => setSelectedTab("in-progress")}
              className="data-[state=active]:bg-red-900/20"
            >
              In Progress ({inProgressCount})
            </TabsTrigger>
            <TabsTrigger
              value="done"
              onClick={() => setSelectedTab("done")}
              className="data-[state=active]:bg-red-900/20"
            >
              Done ({doneCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <ScrollArea className="h-[300px] pr-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-3"
            >
              {filteredTasks.map((task) => (
                <TaskItem key={task.todo_id} task={task} />
              ))}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const Index = () => {
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
        <UserView userRole={[Role.CEO, Role.COO]}>
          <CompanyStats />
        </UserView>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Upcoming Meetings */}
          <UserView userRole={[Role.CEO, Role.COO]}>
            <Meetings />
          </UserView>

          {/* Quick Actions */}
          <Card className="bg-black/40 border-red-900/30 ">
            <CardHeader>
              <CardTitle className="text-amber-50">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="">
                <UserView userRole={[Role.CEO, Role.COO]}>
                  <div className="group flex flex-col ">
                    <QuickActionCard icon={Terminal} url="/details" title="" />
                    <span className="text-white text-sm m-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ">
                      Accounts
                    </span>
                  </div>
                </UserView>
                <div className="group flex flex-col">
                  <QuickActionCard title="" icon={MessageSquare} url="/chat" />
                  <span className="text-white text-sm m-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    Chat
                  </span>
                </div>

                <div className="group flex flex-col">
                  <UserView userRole={[Role.CEO, Role.COO]}>
                    <QuickActionCard title="" icon={Users} url="/employee" />
                    <span className="text-sm  m-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200  ">
                      Employees
                    </span>
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
