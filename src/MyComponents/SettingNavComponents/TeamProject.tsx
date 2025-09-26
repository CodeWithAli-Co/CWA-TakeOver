import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users2,
  UserPlus,
  Briefcase,
  FolderPlus,
  Search,
  MoreHorizontal,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Trash,
  Plus,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/shadcnComponents/card";
import { Button } from "@/components/ui/shadcnComponents/button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/shadcnComponents/avatar";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/shadcnComponents/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";

// Sample data - replace with real data from your database
const teams = [
  {
    id: 1,
    name: "Development Team",
    members: 8,
    projects: 5,
    description: "Core product development and engineering",
    avatars: ["JD", "AK", "MR", "BL", "TS"],
  },
  {
    id: 2,
    name: "Marketing",
    members: 6,
    projects: 3,
    description: "Product marketing and growth strategies",
    avatars: ["EM", "JB", "KL"],
  },
  {
    id: 3,
    name: "Design",
    members: 4,
    projects: 7,
    description: "UI/UX design and product experience",
    avatars: ["PK", "RS", "LM", "JT"],
  },
  {
    id: 4,
    name: "Operations",
    members: 5,
    projects: 2,
    description: "Business operations and internal processes",
    avatars: ["AG", "BH"],
  },
];

const projects = [
  {
    id: 1,
    name: "Dashboard Redesign",
    team: "Design",
    status: "in-progress",
    deadline: "May 15, 2025",
    completion: 65,
    description: "Redesigning the main dashboard interface for better UX",
  },
  {
    id: 2,
    name: "API Integration",
    team: "Development Team",
    status: "to-do",
    deadline: "June 02, 2025",
    completion: 10,
    description: "Integrating third-party APIs for enhanced functionality",
  },
  {
    id: 3,
    name: "Marketing Campaign",
    team: "Marketing",
    status: "done",
    deadline: "April 30, 2025",
    completion: 100,
    description: "Q2 marketing campaign for new features",
  },
  {
    id: 4,
    name: "Database Optimization",
    team: "Development Team",
    status: "in-progress",
    deadline: "May 20, 2025",
    completion: 45,
    description: "Improving database performance and query optimization",
  },
  {
    id: 5,
    name: "User Onboarding Flow",
    team: "Design",
    status: "to-do",
    deadline: "June 10, 2025",
    completion: 5,
    description: "Designing new user onboarding experience",
  },
];

// Status badge component
const StatusBadge = ({ status }: { status: any }) => {
  const variants = {
    "to-do": "bg-blue-500/20 text-blue-400 border-blue-500/30",
    "in-progress": "bg-amber-500/20 text-amber-400 border-amber-500/30",
    done: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  };

  const icons = {
    "to-do": <Clock className="h-3 w-3 mr-1" />,
    "in-progress": <AlertCircle className="h-3 w-3 mr-1" />,
    done: <CheckCircle className="h-3 w-3 mr-1" />,
  };

  const labels = {
    "to-do": "To Do",
    "in-progress": "In Progress",
    done: "Completed",
  };

  return (
    <Badge
      variant="outline"
      className={`${variants[status]} flex items-center px-2 py-1`}
    >
      {icons[status]}
      {labels[status]}
    </Badge>
  );
};

// Team member avatars group
const TeamAvatars = ({ avatars, max = 4 }: { avatars: any; max?: number }) => {
  const displayedAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="flex -space-x-2">
      {displayedAvatars.map((avatar: any, idx: any) => (
        <Avatar
          key={idx}
          className="h-7 w-7 border-2 border-black/40 bg-red-900 text-red-200 text-xs"
        >
          <AvatarFallback>{avatar}</AvatarFallback>
        </Avatar>
      ))}
      {remaining > 0 && (
        <Avatar className="h-7 w-7 border-2 border-black/40 bg-red-950 text-red-200 text-xs">
          <AvatarFallback>+{remaining}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
};

// Team Card Component
const TeamCard = ({ team }: { team: any }) => (
  <motion.div
    whileHover={{ scale: 1.01 }}
    className="rounded-lg bg-black/40 border border-red-900/30 overflow-hidden hover:bg-red-950/10 hover:border-red-900/50 transition-all"
  >
    <div className="p-4">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-red-200">{team.name}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-200/60 hover:text-red-200 hover:bg-red-950/20"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-black/95 border-red-950/30 text-red-200">
            <DropdownMenuLabel>Team Actions</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-red-950/30" />
            <DropdownMenuItem className="hover:bg-red-950/30">
              <Edit className="h-4 w-4 mr-2" /> Edit Team
            </DropdownMenuItem>
            <DropdownMenuItem className="hover:bg-red-950/30">
              <UserPlus className="h-4 w-4 mr-2" /> Add Member
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-red-950/30" />
            <DropdownMenuItem className="text-red-400 hover:bg-red-950/40">
              <Trash className="h-4 w-4 mr-2" /> Delete Team
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="text-red-200/60 text-sm mb-4">{team.description}</p>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="flex items-center text-red-200/60 text-sm">
            <Users2 className="h-4 w-4 mr-1 text-red-400" />
            {team.members} Members
          </div>
          <div className="flex items-center text-red-200/60 text-sm">
            <Briefcase className="h-4 w-4 mr-1 text-red-400" />
            {team.projects} Projects
          </div>
        </div>
        <TeamAvatars avatars={team.avatars} />
      </div>
    </div>
  </motion.div>
);

// Project Card Component
const ProjectCard = ({ project }: { project: any }) => {
  const completionBarWidth = `${project.completion}%`;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="rounded-lg bg-black/40 border border-red-900/30 overflow-hidden hover:bg-red-950/10 hover:border-red-900/50 transition-all"
    >
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-red-200">{project.name}</h3>
          <StatusBadge status={project.status} />
        </div>
        <p className="text-red-200/60 text-sm mb-4">{project.description}</p>

        <div className="space-y-3">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-red-200/70">Team: {project.team}</span>
            <span className="text-red-200/70">
              Deadline: {project.deadline}
            </span>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-red-200/70">Completion</span>
              <span className="text-red-200">{project.completion}%</span>
            </div>
            <div className="h-2 bg-red-950/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: completionBarWidth }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className={`h-full ${
                  project.status === "done"
                    ? "bg-emerald-500/70"
                    : project.completion > 50
                      ? "bg-amber-500/70"
                      : "bg-red-500/70"
                }`}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Create Team Dialog
const CreateTeamDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="group relative overflow-hidden bg-gradient-to-r from-red-950 to-red-900 
          hover:from-red-900 hover:to-red-800 text-white border border-red-800/30 
          shadow-lg shadow-red-950/20 transition-all duration-300 
          hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="absolute inset-0 bg-red-700/10 opacity-0 group-hover:opacity-20 transition-opacity"></span>
          <UserPlus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-12" />
          Create Team
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-black/95 border-red-950/30 text-red-200">
        <DialogHeader>
          <DialogTitle className="text-red-200 text-xl">
            Create New Team
          </DialogTitle>
          <DialogDescription className="text-red-200/60">
            Create a new team and add members to collaborate on projects.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm text-red-200">Team Name</label>
            <Input
              className="bg-black/40 border-red-950/30 text-red-200"
              placeholder="Enter team name..."
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-red-200">Description</label>
            <Input
              className="bg-black/40 border-red-950/30 text-red-200"
              placeholder="Team description..."
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-red-200">Initial Members</label>
            <div className="flex items-center gap-2">
              <Input
                className="bg-black/40 border-red-950/30 text-red-200"
                placeholder="Search members..."
              />
              <Button
                size="icon"
                variant="outline"
                className="border-red-950/30 text-red-200 hover:bg-red-950/20"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-red-800/30 text-red-200 hover:bg-red-950/20"
          >
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800 
            text-white border border-red-800/30"
            onClick={() => setOpen(false)}
          >
            Create Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Create Project Dialog
const CreateProjectDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="group relative overflow-hidden bg-gradient-to-r from-red-950 to-red-900 
          hover:from-red-900 hover:to-red-800 text-white border border-red-800/30 
          shadow-lg shadow-red-950/20 transition-all duration-300 
          hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="absolute inset-0 bg-red-700/10 opacity-0 group-hover:opacity-20 transition-opacity"></span>
          <FolderPlus className="h-4 w-4 mr-2 transition-transform group-hover:rotate-12" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-black/95 border-red-950/30 text-red-200">
        <DialogHeader>
          <DialogTitle className="text-red-200 text-xl">
            Create New Project
          </DialogTitle>
          <DialogDescription className="text-red-200/60">
            Add a new project and assign it to a team.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label className="text-sm text-red-200">Project Name</label>
            <Input
              className="bg-black/40 border-red-950/30 text-red-200"
              placeholder="Enter project name..."
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-red-200">Description</label>
            <Input
              className="bg-black/40 border-red-950/30 text-red-200"
              placeholder="Project description..."
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-red-200">Assign Team</label>
            <Input
              className="bg-black/40 border-red-950/30 text-red-200"
              placeholder="Select team..."
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-red-200">Deadline</label>
            <Input
              className="bg-black/40 border-red-950/30 text-red-200"
              type="date"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-red-800/30 text-red-200 hover:bg-red-950/20"
          >
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800 
            text-white border border-red-800/30"
            onClick={() => setOpen(false)}
          >
            Create Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main Teams & Projects Component
const TeamsAndProjects = () => {
  const [activeTab, setActiveTab] = useState("teams");

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 rounded-xs border-red-950/30 backdrop-blur-sm">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-white flex items-center">
                <Users2 className="h-5 w-5 mr-2 text-red-500" />
                Teams & Projects
              </CardTitle>
              <CardDescription className="text-red-200/60">
                Manage your teams and project assignments
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === "teams" ? (
                <CreateTeamDialog />
              ) : (
                <CreateProjectDialog />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <TabsList className="bg-black/40 border border-red-950/20">
                <TabsTrigger
                  value="teams"
                  className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 text-red-200/60"
                >
                  <Users2 className="h-4 w-4 mr-2" />
                  Teams
                </TabsTrigger>
                <TabsTrigger
                  value="projects"
                  className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 text-red-200/60"
                >
                  <Briefcase className="h-4 w-4 mr-2" />
                  Projects
                </TabsTrigger>
              </TabsList>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-red-200/60" />
                <Input
                  placeholder={`Search ${activeTab}...`}
                  className="bg-black/40 border-red-950/30 text-red-200 pl-10 w-[250px]"
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <TabsContent value="teams" className="mt-4">
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {teams.map((team) => (
                        <TeamCard key={team.id} team={team} />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="projects" className="mt-4">
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamsAndProjects;
