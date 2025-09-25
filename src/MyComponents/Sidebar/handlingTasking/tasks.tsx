import React, { useEffect, useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/shadcnComponents/card";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { Input } from "@/components/ui/shadcnComponents/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { ActiveUser, Employees, Todos, TodosInterface } from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "./addTodo";

//task types.ts


export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskStatus = 'to-do' | 'in-progress' | 'done';

export interface TaskComment {
  id: number;
  user: string;
  content: string;
  timestamp: string;
}

export interface TaskBlocker {
  id: number;
  description: string;
  severity: 'critical' | 'moderate' | 'minor';
  status: 'active' | 'resolved';
}

export interface TaskDependency {
  id: number;
  taskId: number;
  taskTitle: string;
  type: 'blocks' | 'blocked-by' | 'related';
}

export interface Task {
  id: number;
  title: string;
  priority: TaskPriority;
  dueDate: string;
  description: string;
  detailedDescription?: string;
  vision?: string;
  assignee: string;
  status: TaskStatus;
  progress: number;
  comments: TaskComment[];
  blockers: TaskBlocker[];
  dependencies: TaskDependency[];
  technicalNotes?: string;
  lastUpdated: string;
  watchers: string[];
  tags: string[];
  estimatedTime?: string;
  timeSpent?: string;
}


// Component for displaying task blockers
const TaskBlockerItem: React.FC<{ blocker: TaskBlocker }> = ({ blocker }) => (
  <div
    className={`p-3 rounded-lg border ${
      blocker.status === "active"
        ? "border-red-500/30 bg-red-950/10"
        : "border-green-500/30 bg-green-950/10"
    }`}
  >
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {blocker.status === "active" ? (
          <AlertTriangle className="h-4 w-4 text-red-400" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-green-400" />
        )}
        <span
          className={`text-sm ${blocker.status === "active" ? "text-red-200" : "text-green-200"}`}
        >
          {blocker.description}
        </span>
      </div>
      <Badge
        variant="outline"
        className={`
        ${
          blocker.severity === "critical"
            ? "bg-red-500/20 text-red-400"
            : blocker.severity === "moderate"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-blue-500/20 text-blue-400"
        }
      `}
      >
        {blocker.severity}
      </Badge>
    </div>
  </div>
);

// Component for displaying task dependencies
// const TaskDependencyItem: React.FC<{ dependency: TaskDependency }> = ({
//   dependency,
// }) => (
//   <div className="flex items-center gap-2 p-2 rounded-lg bg-red-950/10 border border-red-900/30">
//     <GitBranch className="h-4 w-4 text-red-400" />
//     <span className="text-sm text-red-200">{dependency.taskTitle}</span>
//     <Badge variant="outline" className="bg-red-900/20 text-red-400">
//       {dependency.type}
//     </Badge>
//   </div>
// );

// Task Priority Badge Component
const TaskPriorityBadge: React.FC<{ priority: TaskPriority }> = ({
  priority,
}) => {
  const colors: Record<TaskPriority, string> = {
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

// Task Item Component
const TaskItem: React.FC<{ task: TodosInterface }> = ({ task }) => {
  const [isExpanded, setIsExpanded] = useState(false);
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
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-lg bg-black/40 border border-red-950/20 
                 hover:bg-red-950/10 hover:border-red-900/30 transition-all duration-200"
    >
      {/* Task Header */}
      <div className="p-4 cursor-pointer">
        <div className="flex items-start gap-4 w-full">
          <div className="p-2 rounded-lg bg-zinc-900/20 mt-1">
            <Activity className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span
                  className="text-sm font-bold text-white"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {task.title}
                  
                </span>
                <TaskPriorityBadge priority={task.priority} />
              </div>
              <div className="flex items-center gap-3">
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

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-red-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-red-400" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Calendar className="h-3 w-3" />
                {task.deadline}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="h-3 w-3" />
                {task.status}
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <div className="w-4 h-4 rounded-full bg-red-900/30 flex items-center justify-center text-[10px]">
                  {/* Need to fix the name display */}
                  {/* {task.assignee} */}
                </div>
                {task.assignee}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-red-950/20 p-4 space-y-4"
          >
            {/* Description and Vision */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-red-200">
                  Description
                </h4>
                <p className="text-sm text-slate-400">{task.description}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Main TaskSettings Component
const TaskSettings: React.FC = () => {
  const { data: AllEmployees, error: EmployeesError } = Employees();
  if (EmployeesError) {
    console.log("Error fetching Employees for ToDo", EmployeesError.message);
  }
  const { data: user, error: activeUserError } = ActiveUser();
  if (activeUserError) {
    console.log(
      "Error fetching Active User for Tasks",
      activeUserError.message
    );
  }
  const {
    data: todos,
    error: TodoError,
    refetch: refetchTodos,
  } = Todos(user[0]?.username);
  if (TodoError) {
    console.log("Error fetching Todos Data:", TodoError.message);
  }

  const [selectedTab, setSelectedTab] = useState<TaskStatus>("to-do");
  const [searchQuery, setSearchQuery] = useState("");

  // Add null checks and defaults
  const todosList = todos || [];
  const todoCount = todosList.length > 0 ? todosList[0]?.todoCount || 0 : 0;
  const inProgressCount =
    todosList.length > 0 ? todosList[0]?.inProgressCount || 0 : 0;
  const doneCount = todosList.length > 0 ? todosList[0]?.doneCount || 0 : 0;
  const allCount = todosList.length > 0 ? todosList[0]?.allCount || 0 : 0;

  //updated it so thaat it filters using localtask rather than just normal task
  const filteredTasks = todos!.filter((task) => {
    const matchesSearch =
      task?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task?.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = task?.status === selectedTab;
    return matchesSearch && matchesStatus;
  });

  supabase
    .channel("all-todos")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cwa_todos" },
      () => refetchTodos()
    )
    .subscribe();

  useEffect(() => {
    refetchTodos();
  }, [selectedTab]);

  return (
    <div className="min-h-screen bg-black  py-6 px-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Tasks
        </h2>
        <p className="text-slate-200">{allCount} total tasks</p>
      </div>
      <div className="justify-self-end">

      <AddTodo Users={AllEmployees || []} />
      </div>
      {/* Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-zinc-950/20 rounded-xs border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <CheckCircle className="h-4 w-4 text-red-900" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">{doneCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950/20 rounded-xs border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <Clock className="h-4 w-4 text-blue-900" />
              <span className="text-sm">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">
              {inProgressCount}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950/20 rounded-xs border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <AlertCircle className="h-4 w-4 text-purple-900" />
              <span className="text-sm">To Do</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">{todoCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-zinc-950/20 rounded-xs border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <Activity className="h-4 w-4 text-green-900" />
              <span className="text-sm">Total Tasks</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">{allCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card className="bg-zinc-950/20 rounded-xs border-red-950/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-red-200">Task Management</CardTitle>
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[300px] bg-black/40 border-red-950/20 text-red-200 
                   placeholder:text-red-200/40 focus:border-red-900"
          />
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="to-do" className="mb-6">
            <TabsList className="bg-black/40 border border-red-950/20">
              <TabsTrigger
                value="to-do"
                onClick={() => setSelectedTab("to-do")}
                className="data-[state=active]:bg-red-900/20 data-[state=active]:text-red-200 data-[state=active]:border-red-800 data-[state=active]:border"
              >
                To Do ({todoCount})
              </TabsTrigger>
              <TabsTrigger
                value="in-progress"
                onClick={() => setSelectedTab("in-progress")}
                className="data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-400 data-[state=active]:border-blue-800 data-[state=active]:border"
              >
                In Progress ({inProgressCount})
              </TabsTrigger>
              <TabsTrigger
                value="done"
                onClick={() => setSelectedTab("done")}
                className="data-[state=active]:bg-green-900/20 data-[state=active]:text-green-600 data-[state=active]:border data-[status=active]:border-green-900"
              >
                Done ({doneCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <ScrollArea className="h-[600px] pr-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4"
              >
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task) => (
                    <TaskItem key={task.todo_id} task={task} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify center py-10">
                    <AlertCircle className="h-12 w-12 text-red-400/50 mb-4" />
                    <h3 className="text-lg font-medium text-red-200">
                      {" "}
                      No tasks found
                    </h3>
                    <p className="text-sm text-redd-200/60 mt-2">
                      {searchQuery
                        ? "Try a different search term"
                        : "Add a new task to get started"}
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskSettings;
