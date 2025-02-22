// "use client";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Activity, Bot, MessageSquare, Users, CreditCard, Settings, Search,
  ChevronRight, Bell, Folder, LineChart, Lock, FileText, Globe,
  CalendarDays, Shield, Boxes, BarChart3, CircleDollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

const NavItem = ({ icon: Icon, text }: { icon: React.ComponentType<{ className?: string }>, text: string }) => (
  <Button variant="ghost" className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 gap-2">
    <Icon className="h-4 w-4" />
    {text}
  </Button>
);

// Enhanced Task Priority Badge with animation
const TaskPriorityBadge = ({ priority }: { priority: TaskPriority }) => {
  const colors = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  };
  return (
    <motion.div whileHover={{ scale: 1.05 }}>
      <Badge variant="outline" className={`${colors[priority]} text-xs ml-2`}>
        {priority}
      </Badge>
    </motion.div>
  );
};

// Enhanced Stat Card with animations
const StatCard = ({ icon: Icon, label, value, change }: { icon: React.ComponentType<{ className?: string }>, label: string, value: string, change: number }) => (
  <motion.div
    whileHover={{ scale: 1.00 }}
    className="bg-black/40 border border-red-900/30 rounded-lg p-4 hover:border-red-800/50 transition-colors"
  >
    <div className="flex items-center justify-between">
      <motion.div 
        whileHover={{ scale: 1.1 }}
        className="p-2 rounded-lg bg-red-900/20"
      >
        <Icon className="h-4 w-4 text-red-500" />
      </motion.div>
      <span className={`text-xs ${change > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {change > 0 ? '+' : ''}{change}%
      </span>
    </div>
    <div className="mt-3">
      <div className="text-2xl font-bold text-amber-50">{value}</div>
      <div className="text-sm text-amber-50/70">{label}</div>
    </div>
  </motion.div>
);


// Enhanced Quick Action Card with animations
const QuickActionCard = ({ title, icon: Icon, count }: { title: string, icon: React.ComponentType<{ className?: string }>, count: string }) => (
  <motion.div
    whileHover={{ scale: 1.00 }}
    transition={{ type: "spring", stiffness: 400, damping: 10 }}
    className="flex items-center justify-between p-4 bg-black/60 border border-red-900/30 rounded-lg hover:border-red-800/50 group"
  >
    <div className="flex items-center gap-3">
      <motion.div 
        whileHover={{ scale: 1.1 }}
        className="p-2 rounded-lg bg-red-900/20"
      >
        <Icon className="h-5 w-5 text-red-500" />
      </motion.div>
      <div>
        <h3 className="text-sm font-medium text-amber-50 group-hover:text-amber-100">{title}</h3>
        <p className="text-xs text-amber-50/70 group-hover:text-amber-50">{count}</p>
      </div>
    </div>
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      whileHover={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2"
    >
      <ChevronRight className="h-4 w-4 text-red-500" />
    </motion.div>
  </motion.div>
);

// Task Item Component with animations
const TaskItem = ({ task }: { task: (typeof tasks)[0] }) => (
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
          <span className="text-sm font-medium text-amber-50">{task.title}</span>
          <TaskPriorityBadge priority={task.priority} />
        </div>
        <span className="text-xs text-amber-50/70">{task.dueDate}</span>
      </div>
    </div>
    <motion.button 
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20 px-3 py-1 rounded"
    >
      View
    </motion.button>
  </motion.div>
);


type TaskPriority = 'high' | 'medium' | 'low';
type TaskStatus = 'todo' | 'inProgress' | 'done';


const tasks: { id: number, title: string, priority: TaskPriority, dueDate: string }[] = [
  { id: 1, title: 'work on clerk auth 1', priority: 'high', dueDate: '2023-10-01' },
  { id: 2, title: 'fix the budgetary savings goal', priority: 'medium', dueDate: '2023-10-05' },
  { id: 3, title: 'fix the navigation bar', priority: 'low', dueDate: '2023-10-10' },
  { id: 4, title: 'implement new auth flow', priority: 'high', dueDate: '2023-10-10' },
  { id: 5, title: 'upddaate user document', priority: 'medium', dueDate: '2023-10-10' },
  { id: 6, title: 'setup monitoring alerts', priority: 'low', dueDate: '2023-10-10' },
  { id: 7, title: 'optimize data queries', priority: 'low', dueDate: '2023-10-10' },
  { id: 8, title: 'work on fixing the general chat to reroute with blaze', priority: 'low', dueDate: '2023-10-10' },
  { id: 9, title: 'change some mobile tweaks so the menu opens up', priority: 'low', dueDate: '2023-10-10' },
  { id: 10, title: 'fix the bot management style by addding maxwidth', priority: 'high', dueDate: '2023-10-10' },
  { id: 11, title: 'blaze gotta work on backendd logic for dashboardd', priority: 'low', dueDate: '2023-10-10' },
];

// Enhanced Tasks Component with Tabs
const TasksComponent = () => {
  const [selectedTab, setSelectedTab] = useState<TaskStatus>('todo');
  
  // Simulate task status for demonstration
  const getTaskStatus = (task: (typeof tasks)[0]): TaskStatus => {
    if (task.priority === 'high') return 'todo';
    if (task.priority === 'medium') return 'inProgress';
    return 'done';
  };

  const filteredTasks = tasks.filter(task => getTaskStatus(task) === selectedTab);

  return (
    <Card className="bg-black/40 border-red-900/30 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-amber-50">Tasks</CardTitle>
          <p className="text-sm text-amber-50/70 mt-1">{tasks.length} total tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            placeholder="Search tasks..."
            className="w-[200px] bg-black/40 border-red-900/30 text-amber-50"
          />
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" className="border-red-900/30 text-amber-50">
              Add Task
            </Button>
          </motion.div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="todo" className="mb-4">
          <TabsList className="bg-black/40 border border-red-900/30">
            <TabsTrigger 
              value="todo"
              onClick={() => setSelectedTab('todo')}
              className="data-[state=active]:bg-red-900/20"
            >
              To Do
            </TabsTrigger>
            <TabsTrigger 
              value="inProgress"
              onClick={() => setSelectedTab('inProgress')}
              className="data-[state=active]:bg-red-900/20"
            >
              In Progress
            </TabsTrigger>
            <TabsTrigger 
              value="done"
              onClick={() => setSelectedTab('done')}
              className="data-[state=active]:bg-red-900/20"
            >
              Done
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
                <TaskItem key={task.id} task={task} />
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
    <div className="min-h-screen bg-black">
      {/* Navigation Bar */}
      <nav className="border-b border-red-900/30 bg-black/40 sticky top-0 z-50">
        <div className="flex items-center justify-between h-14 px-6">
          <div className="flex items-center space-x-4">
            <h1 className="text-red-500 font-bold">Dashboard</h1>
            <div className="flex items-center space-x-2">
              <NavItem icon={FileText} text="Reports" />
              <NavItem icon={Users} text="Teams" />
              <NavItem icon={Globe} text="Resources" />
              <NavItem icon={Lock} text="Security" />
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Button variant="ghost" className="text-amber-50/70 hover:text-amber-50 relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
            </Button>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-red-900/20 text-amber-50">AD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </nav>
  
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 space-y-6"
      >
        {/* Stats Overview */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard icon={Users} label="Total Users" value="1,234" change={12} />
          <StatCard icon={CircleDollarSign} label="Revenue" value="$45.2k" change={-2.5} />
          <StatCard icon={BarChart3} label="Conversion" value="2.4%" change={8} />
          <StatCard icon={Boxes} label="Active Bots" value="23" change={15} />
        </motion.div>
  
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <Card className="bg-black/40 border-red-900/30 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-amber-50">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div className="grid grid-cols-2 gap-4">
                <QuickActionCard title="Bot Management" icon={Bot} count="3 Active" />
                <QuickActionCard title="Chat" icon={MessageSquare} count="12 Messages" />
                <QuickActionCard title="Members" icon={Users} count="24 Online" />
                <QuickActionCard title="Billing" icon={CreditCard} count="Premium" />
              </motion.div>
            </CardContent>
          </Card>
  
          {/* Calendar - Smaller Size */}
          <Card className="bg-black/40 border-red-900/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-amber-50">Schedule</CardTitle>
              <Button variant="ghost" size="sm" className="text-amber-50/70 hover:text-amber-50">
                <CalendarDays className="h-2 w-0" />
              </Button>
            </CardHeader>
            <CardContent>
              <Calendar 
              
                className="text-amber-50 pr-0 mr-0 border border-red-900/30 " 
                classNames={{
                  day_selected: "bg-red-900 text-amber-50 hover:bg-red-800",
                  day_today: "bg-red-900/20 text-amber-50 hover:bg-red-800/50",
                  day: "text-amber-50 hover:bg-red-900/20 text-sm p-1.5",
                  head_cell: "text-amber-50/70 text-sm p-1.5",
                  nav_button: "hover:bg-red-900/20 text-amber-50",
                  caption: "text-amber-50"
                }}
              />
            </CardContent>
          </Card>
  
          {/* Tasks */}
          <TasksComponent />
  
          {/* System Health */}
          <Card className="bg-black/40 border-red-900/30">
            <CardHeader>
              <CardTitle className="text-amber-50">System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-amber-50/70">Server Load</span>
                    <span className="text-amber-50">45%</span>
                  </div>
                  <motion.div 
                    className="h-2 rounded-full bg-red-900/20"
                    whileHover={{ scale: 1.01 }}
                  >
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "45%" }}
                      transition={{ duration: 1 }}
                      className="h-full rounded-full bg-gradient-to-r from-red-900 to-red-700"
                    />
                  </motion.div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-amber-50/70">Memory Usage</span>
                    <span className="text-amber-50">72%</span>
                  </div>
                  <motion.div 
                    className="h-2 rounded-full bg-red-900/20"
                    whileHover={{ scale: 1.01 }}
                  >
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "72%" }}
                      transition={{ duration: 1 }}
                      className="h-full rounded-full bg-gradient-to-r from-red-900 to-red-700"
                    />
                  </motion.div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-amber-50/70">Storage</span>
                    <span className="text-amber-50">28%</span>
                  </div>
                  <motion.div 
                    className="h-2 rounded-full bg-red-900/20"
                    whileHover={{ scale: 1.01 }}
                  >
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: "28%" }}
                      transition={{ duration: 1 }}
                      className="h-full rounded-full bg-gradient-to-r from-red-900 to-red-700"
                    />
                  </motion.div>
                </div>
              </div>
            </CardContent>
          </Card>
  
          {/* Security Overview */}
          <Card className="bg-black/40 border-red-900/30 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-amber-50">Security Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-lg bg-black/60 border border-red-900/30"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Shield className="h-5 w-5 text-red-500" />
                    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-400">
                      Secure
                    </Badge>
                  </div>
                  <h3 className="text-sm font-medium text-amber-50">Last Security Scan</h3>
                  <p className="text-xs text-amber-50/70 mt-1">2 hours ago</p>
                </motion.div>
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="p-4 rounded-lg bg-black/60 border border-red-900/30"
                >
                  <div className="flex items-center justify-between mb-4">
                    <Lock className="h-5 w-5 text-red-500" />
                    <Badge variant="outline" className="bg-red-500/20 text-red-400">
                      2 Issues
                    </Badge>
                  </div>
                  <h3 className="text-sm font-medium text-amber-50">Access Control</h3>
                  <p className="text-xs text-amber-50/70 mt-1">Review needed</p>
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>
    </div>
  );
};
  export const Route = createLazyFileRoute("/")({
    component: Index,
  });
  
  export default Index;