import { message } from "@tauri-apps/plugin-dialog";
import { AddTodo } from "@/MyComponents/Sidebar/handlingTasking/addTodo";
import { useEffect, useState } from "react";
import supabase from "@/MyComponents/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { ActiveUser, Employees, Todos } from "@/stores/query";
import { Activity, ListTodo } from "lucide-react";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Input } from "@/components/ui/shadcnComponents/input";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/shadcnComponents/tabs";

const priorityColors = {
  high: "bg-red-500/[0.06] text-primary/70 border-red-500/10",
  medium: "bg-amber-500/[0.06] text-amber-400/70 border-amber-500/10",
  low: "bg-emerald-500/[0.06] text-emerald-400/70 border-emerald-500/10",
};

const TaskPriorityBadge = ({ priority }: { priority: keyof typeof priorityColors }) => (
  <Badge variant="outline" className={`${priorityColors[priority]} text-[10px] ml-2`}>
    {priority}
  </Badge>
);

const TaskItem = ({ task }: { task: any }) => {
  async function EditTask(todoStatus: string, todoID: number) {
    const { error } = await supabase.from("cwa_todos").update({ status: todoStatus }).eq("todo_id", todoID);
    if (error) await message(error.message, { title: "Error Editing Todo Status", kind: "error" });
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-center justify-between py-3 px-3 rounded-sm hover:bg-muted/30 transition-all duration-300 group"
    >
      <div className="flex items-center gap-3">
        <div className="p-1.5 rounded-sm bg-muted/40 group-hover:bg-red-500/[0.04] transition-colors">
          <Activity className="h-3.5 w-3.5 text-primary/50" />
        </div>
        <div>
          <div className="flex items-center">
            <span className="text-[13px] font-medium text-white/65 group-hover:text-foreground/85 transition-colors">
              {task.title}
            </span>
            <TaskPriorityBadge priority={task.priority} />
            {/* Company badge */}
            <span className="ml-2 text-[9px] text-muted-foreground/30 uppercase tracking-wider bg-muted/30 px-1.5 py-0.5 rounded-sm border border-white/[0.03]">
              Both
            </span>
          </div>
          {task.deadline && <span className="text-[11px] text-muted-foreground/40">{task.deadline}</span>}
        </div>
      </div>
      {task.status === "to-do" && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="text-[11px] text-muted-foreground/60 hover:text-foreground/60 bg-muted/40 hover:bg-primary/[0.06] border border-border hover:border-primary/10 px-3 py-1.5 rounded-sm transition-all duration-300 opacity-0 group-hover:opacity-100"
          onClick={() => EditTask("in-progress", task.todo_id)}
        >
          Start
        </motion.button>
      )}
      {task.status === "in-progress" && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="text-[11px] text-muted-foreground/60 hover:text-emerald-400/80 bg-muted/40 hover:bg-emerald-500/[0.06] border border-border hover:border-emerald-500/10 px-3 py-1.5 rounded-sm transition-all duration-300 opacity-0 group-hover:opacity-100"
          onClick={() => EditTask("done", task.todo_id)}
        >
          Finish
        </motion.button>
      )}
    </motion.div>
  );
};

export const TasksComponent = () => {
  const [selectedTab, setSelectedTab] = useState("to-do");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: AllEmployees, error: EmployeesError } = Employees();
  if (EmployeesError) console.log("Error fetching Employees:", EmployeesError.message);

  const { data: user, error: activeUserError } = ActiveUser();
  if (activeUserError) console.log("Error fetching Active User:", activeUserError.message);

  const { data: todos, error: TodoError, refetch: refetchTodos } = Todos(user?.[0]?.username);
  if (TodoError) console.log("Error fetching Todos:", TodoError.message);

  useEffect(() => {
    const subscription = supabase
      .channel("all-todos")
      .on("postgres_changes", { event: "*", schema: "public", table: "cwa_todos" }, () => refetchTodos())
      .subscribe();
    return () => { subscription.unsubscribe(); };
  }, [refetchTodos]);

  useEffect(() => {
    if (user && user.length > 0) refetchTodos();
  }, [selectedTab, user]);

  const filteredTasks = todos?.filter((task) => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch && task.status === selectedTab;
  }) || [];

  const todoCount = todos?.filter((t) => t.status === "to-do").length || 0;
  const inProgressCount = todos?.filter((t) => t.status === "in-progress").length || 0;
  const doneCount = todos?.filter((t) => t.status === "done").length || 0;
  const totalTasks = todos?.length || 0;

  return (
    <div className="bg-card border border-border rounded-sm h-full overflow-hidden">
      <div className="px-5 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-sm bg-muted/40 border border-border">
            <ListTodo className="h-4 w-4 text-primary/70" />
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground/60 uppercase tracking-[0.15em] font-medium">Tasks</span>
            <p className="text-[11px] text-muted-foreground/30 mt-0.5">{totalTasks} total</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[120px] h-7 text-[11px] bg-muted/30 border-border text-muted-foreground/80 placeholder:text-muted-foreground/30 rounded-sm focus:border-primary/15"
          />
          <AddTodo Users={AllEmployees || []} homeDash />
        </div>
      </div>

      <div className="px-5 pb-5">
        <Tabs defaultValue="to-do" className="mb-3">
          <TabsList className="bg-muted/30 border border-border rounded-sm h-7">
            <TabsTrigger value="to-do" onClick={() => setSelectedTab("to-do")} className="data-[state=active]:bg-primary/[0.08] data-[state=active]:text-primary/80 text-muted-foreground/60 rounded-sm text-[10px] h-5">
              To Do ({todoCount})
            </TabsTrigger>
            <TabsTrigger value="in-progress" onClick={() => setSelectedTab("in-progress")} className="data-[state=active]:bg-amber-500/[0.08] data-[state=active]:text-amber-400/80 text-muted-foreground/60 rounded-sm text-[10px] h-5">
              Active ({inProgressCount})
            </TabsTrigger>
            <TabsTrigger value="done" onClick={() => setSelectedTab("done")} className="data-[state=active]:bg-emerald-500/[0.08] data-[state=active]:text-emerald-400/80 text-muted-foreground/60 rounded-sm text-[10px] h-5">
              Done ({doneCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredTasks.length === 0 ? (
          <div className="text-center py-8">
            <ListTodo className="h-6 w-6 text-white/[0.05] mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground/40">No {selectedTab} tasks</p>
          </div>
        ) : (
          <ScrollArea className="h-[340px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedTab}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="space-y-0.5"
              >
                {filteredTasks.map((task) => (
                  <TaskItem key={task.todo_id} task={task} />
                ))}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};
