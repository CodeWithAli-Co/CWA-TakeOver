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
import { Textarea } from "@/components/ui/shadcnComponents/textarea";
// import {CreateTaskModal } "@/MyComponents/handlingTasking/CreateTaskModal"
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  History,
  Users,
  GitBranch,
  Link,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  Task,
  TaskBlocker,
  TaskDependency,
  TaskPriority,
  TaskStatus,
  tasks,
} from "./taskTypes";
import { ActiveUser, Employees, Todos, TodosInterface } from "@/stores/query";
import { AddTodo } from "./addTodo";
import supabase from "@/MyComponents/supabase";

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
const TaskDependencyItem: React.FC<{ dependency: TaskDependency }> = ({
  dependency,
}) => (
  <div className="flex items-center gap-2 p-2 rounded-lg bg-red-950/10 border border-red-900/30">
    <GitBranch className="h-4 w-4 text-red-400" />
    <span className="text-sm text-red-200">{dependency.taskTitle}</span>
    <Badge variant="outline" className="bg-red-900/20 text-red-400">
      {dependency.type}
    </Badge>
  </div>
);

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
      <div
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-4 w-full">
          <div className="p-2 rounded-lg bg-red-900/20 mt-1">
            <Activity className="h-4 w-4 text-red-500" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="text-sm font-medium text-red-200">
                  {task.title}
                </span>
                <TaskPriorityBadge priority={task.priority} />
              </div>
              <div className="flex items-center gap-3">
                {/* <Badge variant="outline" className="bg-red-900/20 text-red-400">
                  {task.progress}%
                </Badge> */}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-red-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-red-400" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-xs text-red-200/60">
                <Calendar className="h-3 w-3" />
                {task.deadline}
              </div>
              <div className="flex items-center gap-1 text-xs text-red-200/60">
                <Clock className="h-3 w-3" />
                {task.status}
              </div>
              <div className="flex items-center gap-1 text-xs text-red-200/60">
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
                <p className="text-sm text-red-200/60">{task.description}</p>
                {/* {task.detailedDescription && (
                  <div className="mt-2">
                    <h5 className="text-sm font-medium text-red-200">Detailed Notes</h5>
                    <p className="text-sm text-red-200/60">{task.detailedDescription}</p>
                  </div>
                )} */}
              </div>
              {/* {task.vision && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-red-200">Vision & Goals</h4>
                  <p className="text-sm text-red-200/60">{task.vision}</p>
                </div>
              )} */}
            </div>

            {/* Progress and Time */}
            {/* <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-red-200 mb-2">Progress</h4>
                <div className="h-2 bg-red-950/20 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-red-900 to-red-700"
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-red-200/60">
                  <span>Est: {task.estimatedTime || 'N/A'}</span>
                  <span>Spent: {task.timeSpent || 'N/A'}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-red-200/60">Last updated: {task.lastUpdated}</span>
                </div>
              </div>
            </div> */}

            {/* Blockers */}
            {/* {task.blockers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-200 mb-2">Blockers & Issues</h4>
                <div className="space-y-2">
                  {task.blockers.map(blocker => (
                    <TaskBlockerItem key={blocker.id} blocker={blocker} />
                  ))}
                </div>
              </div>
            )} */}

            {/* Dependencies */}
            {/* {task.dependencies.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-200 mb-2">Dependencies</h4>
                <div className="grid grid-cols-2 gap-2">
                  {task.dependencies.map(dependency => (
                    <TaskDependencyItem key={dependency.id} dependency={dependency} />
                  ))}
                </div>
              </div>
            )} */}

            {/* Comments */}
            {/* <div>
              <h4 className="text-sm font-medium text-red-200 mb-2">Discussion</h4>
              <div className="space-y-3">
                {task.comments.map(comment => (
                  <div key={comment.id} className="p-3 rounded-lg bg-black/40 border border-red-950/20">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-red-900/30 flex items-center justify-center text-xs">
                        {comment.user[0]}
                      </div>
                      <span className="text-sm text-red-200">{comment.user}</span>
                      <span className="text-xs text-red-200/60">{comment.timestamp}</span>
                    </div>
                    <p className="text-sm text-red-200/80">{comment.content}</p>
                  </div>
                ))}
                <div className="mt-2">
                  <Textarea 
                    placeholder="Add a comment..."
                    className="bg-black/40 border-red-950/20 text-red-200 min-h-[80px]"
                  />
                </div>
              </div>
            </div> */}

            {/* Watchers */}
            {/* {task.watchers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-200 mb-2">Watchers</h4>
                <div className="flex items-center gap-2">
                  {task.watchers.map((watcher, index) => (
                    <div key={index} className="flex items-center gap-1 text-xs text-red-200/60">
                      <div className="w-6 h-6 rounded-full bg-red-900/30 flex items-center justify-center">
                        {watcher[0]}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )} */}

            {/* Tags */}
            {/* {task.tags.length > 0 && (
              <div className="flex items-center gap-2">
                {task.tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="bg-red-900/20 text-red-400">
                    {tag}
                  </Badge>
                ))}
              </div>
            )} */}
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
    console.log("Erro fetching Employees for ToDo", EmployeesError.message);
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
  } = Todos(user[0].username);
  if (TodoError) {
    console.log("Error fetching Todos Data:", TodoError.message);
  }

  const [selectedTab, setSelectedTab] = useState<TaskStatus>("to-do");
  const [searchQuery, setSearchQuery] = useState("");

  //updated it so thaat it filters using localtask rather than just normal task
  const filteredTasks = todos!.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = task.status === selectedTab;
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
    <div key={todos![0].todo_id} className="min-h-screen bg-black/95 py-6 px-8">
      <div className="mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-red-200">
          Tasks
        </h2>
        <p className="text-red-200/60">{todos![0].allCount} total tasks</p>
      </div>
      <AddTodo Users={AllEmployees || []} />
      {/* Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-black/40 border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">Completed</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">
              {todos![0].doneCount}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-black/40 border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <Clock className="h-4 w-4" />
              <span className="text-sm">In Progress</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">
              {todos![0].inProgressCount}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-black/40 border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">To Do</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">
              {todos![0].todoCount}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-black/40 border-red-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-200/60">
              <Activity className="h-4 w-4" />
              <span className="text-sm">Total Tasks</span>
            </div>
            <p className="text-2xl font-bold text-red-200 mt-2">
              {todos![0].allCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Task List */}
      <Card className="bg-black/40 border-red-950/20">
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
                className="data-[state=active]:bg-red-900/20 data-[state=active]:text-red-200"
              >
                To Do ({todos![0].todoCount})
              </TabsTrigger>
              <TabsTrigger
                value="in-progress"
                onClick={() => setSelectedTab("in-progress")}
                className="data-[state=active]:bg-red-900/20 data-[state=active]:text-red-200"
              >
                In Progress ({todos![0].inProgressCount})
              </TabsTrigger>
              <TabsTrigger
                value="done"
                onClick={() => setSelectedTab("done")}
                className="data-[state=active]:bg-red-900/20 data-[state=active]:text-red-200"
              >
                Done ({todos![0].doneCount})
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
                {filteredTasks.map((task) => (
                  <TaskItem key={task.todo_id} task={task} />
                ))}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaskSettings;
