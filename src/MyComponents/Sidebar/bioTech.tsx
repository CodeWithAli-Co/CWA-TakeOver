import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical,
  Microscope,
  Dna,
  FileSpreadsheet,
  BarChart3,
  Calendar,
  Settings,
  Beaker,
  PieChart,
  Atom,
  ThermometerSnowflake,
  Clipboard,
  AlarmClock,
  Search,
  Filter,
  Download,
  Plus,
  HelpCircle,
  Bookmark,
  Bell,
  Share2
} from "lucide-react";

import { Button } from "@/components/ui/shadcnComponents/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/shadcnComponents/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/shadcnComponents/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Separator } from "@/components/ui/shadcnComponents/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcnComponents/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
 } from "@/components/ui/tooltip";

import { createLazyFileRoute } from "@tanstack/react-router";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from "recharts";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/shadcnComponents/dropdown-menu";

// Sample data - in a real app, this would come from your API
const sampleExperiments = [
  { 
    id: "EXP-2025-001", 
    name: "CRISPR Efficiency Test", 
    startDate: "2025-02-15", 
    status: "In Progress", 
    type: "Gene Editing",
    completion: 65,
    assignee: "Dr. Sarah Chen"
  },
  { 
    id: "EXP-2025-002", 
    name: "Protein Folding Analysis", 
    startDate: "2025-02-10", 
    status: "Completed", 
    type: "Structural Biology",
    completion: 100,
    assignee: "Dr. Michael Rodriguez"
  },
  { 
    id: "EXP-2025-003", 
    name: "Antibody Binding Kinetics", 
    startDate: "2025-02-20", 
    status: "Pending", 
    type: "Immunology",
    completion: 0,
    assignee: "Dr. Emma Watson"
  },
  { 
    id: "EXP-2025-004", 
    name: "Cell Culture Optimization", 
    startDate: "2025-01-30", 
    status: "In Progress", 
    type: "Cell Biology",
    completion: 78,
    assignee: "Dr. James Liu"
  },
  { 
    id: "EXP-2025-005", 
    name: "Drug Delivery System", 
    startDate: "2025-02-05", 
    status: "In Review", 
    type: "Pharmaceutical",
    completion: 90,
    assignee: "Dr. Aisha Johnson"
  },
];

const sampleAssays = [
  { id: "ASY-001", name: "PCR Analysis", samples: 24, priority: "High", deadline: "2025-03-05", status: "In Progress" },
  { id: "ASY-002", name: "ELISA Screening", samples: 96, priority: "Medium", deadline: "2025-03-10", status: "Pending" },
  { id: "ASY-003", name: "Flow Cytometry", samples: 12, priority: "Low", deadline: "2025-03-15", status: "Completed" },
  { id: "ASY-004", name: "Western Blot", samples: 8, priority: "High", deadline: "2025-03-03", status: "In Progress" },
];

const sampleSamples = [
  { id: "SAM-2025-0123", type: "Cell Line", location: "Freezer B-12", temp: "-80°C", created: "2025-01-15", status: "Viable" },
  { id: "SAM-2025-0124", type: "Plasma", location: "Freezer A-05", temp: "-20°C", created: "2025-01-20", status: "Viable" },
  { id: "SAM-2025-0125", type: "Tissue", location: "Freezer C-08", temp: "-80°C", created: "2025-01-25", status: "Contaminated" },
  { id: "SAM-2025-0126", type: "Dna Extract", location: "Refrigerator 3", temp: "4°C", created: "2025-02-01", status: "Viable" },
  { id: "SAM-2025-0127", type: "Antibody", location: "Freezer D-02", temp: "-20°C", created: "2025-02-05", status: "Low Volume" },
];

const sampleHeatmapData = [
  { day: 'Day 1', viability: 98, growth: 5, metabolic: 45, protein: 33 },
  { day: 'Day 2', viability: 95, growth: 15, metabolic: 50, protein: 38 },
  { day: 'Day 3', viability: 92, growth: 25, metabolic: 60, protein: 43 },
  { day: 'Day 4', viability: 88, growth: 38, metabolic: 65, protein: 48 },
  { day: 'Day 5', viability: 85, growth: 45, metabolic: 70, protein: 53 },
  { day: 'Day 6', viability: 80, growth: 55, metabolic: 75, protein: 58 },
  { day: 'Day 7', viability: 76, growth: 62, metabolic: 80, protein: 65 },
];

// Dashboard component
export const Route = createLazyFileRoute("/bio")({
  component: BiotechDashboard,
});

function BiotechDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [experimentFilter, setExperimentFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Filter experiments based on search query and filter
  const filteredExperiments = sampleExperiments.filter(exp => {
    const matchesSearch = exp.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        exp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = experimentFilter === "all" || 
                         (experimentFilter === "inProgress" && exp.status === "In Progress") ||
                         (experimentFilter === "completed" && exp.status === "Completed") ||
                         (experimentFilter === "pending" && exp.status === "Pending");
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch(status) {
      case "In Progress": return "bg-yellow-600 text-yellow-100";
      case "Completed": return "bg-green-700 text-green-100";
      case "Pending": return "bg-blue-700 text-blue-100";
      case "In Review": return "bg-purple-700 text-purple-100";
      case "Viable": return "bg-green-700 text-green-100";
      case "Contaminated": return "bg-red-700 text-red-100";
      case "Low Volume": return "bg-yellow-600 text-yellow-100";
      default: return "bg-gray-600 text-gray-100";
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case "High": return "bg-red-700 text-red-100";
      case "Medium": return "bg-yellow-600 text-yellow-100";
      case "Low": return "bg-blue-700 text-blue-100";
      default: return "bg-gray-600 text-gray-100";
    }
  };

  // Handle window width for responsive design
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0
  );

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1024;

  return (
    <div className="min-h-screen bg-black/95 text-white">
      <div className="w-full max-w-[1400px] mx-auto p-4">
        {/* Header with title and actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Microscope className="h-6 w-6 text-red-500" />
              <span className="bg-gradient-to-r from-red-500 to-red-300 bg-clip-text text-transparent">
                BioTech Lab Suite
              </span>
            </h1>
            <p className="text-red-200/60 text-sm md:text-base">
              Your complete laboratory management system
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto justify-end">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    className="border-red-800/30 text-red-200 hover:bg-red-950/20 hover:text-red-100"
                  >
                    <Bell className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-black border-red-900">
                  Notifications
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    className="border-red-800/30 text-red-200 hover:bg-red-950/20 hover:text-red-100"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-black border-red-900">
                  Settings
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    className="border-red-800/30 text-red-200 hover:bg-red-950/20 hover:text-red-100"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="bg-black border-red-900">
                  Help & Resources
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              size={isMobile ? "sm" : "default"}
              className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                     text-white border border-red-800/30 shadow-lg shadow-red-950/20"
            >
              <Plus className="mr-2 h-4 w-4" />
              {!isMobile ? "New Experiment" : "New"}
            </Button>
          </div>
        </div>

        {/* Main content */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4 md:space-y-6"
        >
          <TabsList 
            className="h-12 w-full justify-start space-x-2 bg-black/40 p-1 text-red-200/60 border border-red-950/20 overflow-x-auto flex-nowrap"
          >
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
            >
              <BarChart3 className="h-4 w-4" />
              <span className={isTablet ? "hidden md:inline" : ""}>Dashboard</span>
            </TabsTrigger>
            <TabsTrigger
              value="experiments"
              className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
            >
              <FlaskConical className="h-4 w-4" />
              <span className={isTablet ? "hidden md:inline" : ""}>Experiments</span>
            </TabsTrigger>
            <TabsTrigger
              value="assays"
              className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
            >
              <Beaker className="h-4 w-4" />
              <span className={isTablet ? "hidden md:inline" : ""}>Assays</span>
            </TabsTrigger>
            <TabsTrigger
              value="samples"
              className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
            >
              <Clipboard className="h-4 w-4" />
              <span className={isTablet ? "hidden md:inline" : ""}>Sample Management</span>
            </TabsTrigger>
            <TabsTrigger
              value="sequencing"
              className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
            >
              <Dna className="h-4 w-4" />
              <span className={isTablet ? "hidden md:inline" : ""}>Sequencing</span>
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span className={isTablet ? "hidden md:inline" : ""}>Data Analysis</span>
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 
                hover:text-red-200 transition-colors duration-200 flex items-center space-x-2 px-3 py-2"
            >
              <Calendar className="h-4 w-4" />
              <span className={isTablet ? "hidden md:inline" : ""}>Schedule</span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Dashboard Tab */}
              <TabsContent value="dashboard" className="space-y-4">
                {isLoading ? (
                  <div className="flex justify-center items-center h-96">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1.5,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "linear",
                      }}
                      className="w-12 h-12 rounded-full border-4 border-red-200 border-t-transparent"
                    />
                  </div>
                ) : (
                  <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm hover:bg-black/70 transition-colors">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-red-400" />
                            Experiments
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-3xl font-bold text-white">{sampleExperiments.length}</p>
                              <p className="text-red-200/60 text-xs">Total Experiments</p>
                            </div>
                            <div className="text-right">
                              <p className="text-green-500 text-sm font-medium">
                                +2 this week
                              </p>
                              <p className="text-red-200/60 text-xs">3 In Progress</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm hover:bg-black/70 transition-colors">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <Beaker className="h-4 w-4 text-red-400" />
                            Assays
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-3xl font-bold text-white">{sampleAssays.length}</p>
                              <p className="text-red-200/60 text-xs">Total Assays</p>
                            </div>
                            <div className="text-right">
                              <p className="text-yellow-500 text-sm font-medium">
                                2 Due Today
                              </p>
                              <p className="text-red-200/60 text-xs">2 High Priority</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm hover:bg-black/70 transition-colors">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <Clipboard className="h-4 w-4 text-red-400" />
                            Samples
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-3xl font-bold text-white">{sampleSamples.length}</p>
                              <p className="text-red-200/60 text-xs">Total Samples</p>
                            </div>
                            <div className="text-right">
                              <p className="text-red-500 text-sm font-medium">
                                1 Contaminated
                              </p>
                              <p className="text-red-200/60 text-xs">1 Low Volume</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm hover:bg-black/70 transition-colors">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <AlarmClock className="h-4 w-4 text-red-400" />
                            Upcoming
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                          <div className="flex justify-between items-end">
                            <div>
                              <p className="text-3xl font-bold text-white">5</p>
                              <p className="text-red-200/60 text-xs">This Week</p>
                            </div>
                            <div className="text-right">
                              <p className="text-blue-500 text-sm font-medium">
                                2 Meetings
                              </p>
                              <p className="text-red-200/60 text-xs">3 Deadlines</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts & Activity */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Growth Chart */}
                      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm col-span-1 lg:col-span-2">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-red-400" />
                            Cell Growth Analysis
                          </CardTitle>
                          <CardDescription className="text-red-200/60 text-xs">
                            7-day monitoring of key metrics
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4">
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={sampleHeatmapData}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 5,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="day" stroke="#666" />
                                <YAxis stroke="#666" />
                                <RechartsTooltip 
                                  contentStyle={{ 
                                    backgroundColor: "rgba(0, 0, 0, 0.8)", 
                                    border: "1px solid #500" 
                                  }} 
                                />
                                <Legend />
                                <Line
                                  type="monotone"
                                  dataKey="viability"
                                  stroke="#ef4444"
                                  strokeWidth={2}
                                  activeDot={{ r: 8 }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="growth"
                                  stroke="#22c55e"
                                  strokeWidth={2}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="metabolic"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="protein"
                                  stroke="#a855f7"
                                  strokeWidth={2}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Recent Activity */}
                      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                        <CardHeader className="p-4 pb-2">
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <Atom className="h-4 w-4 text-red-400" />
                            Recent Activity
                          </CardTitle>
                          <CardDescription className="text-red-200/60 text-xs">
                            Latest lab updates
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2">
                          <div className="space-y-4">
                            <div className="border-l-2 border-red-700 pl-4 py-1">
                              <p className="text-white text-sm font-medium">PCR Results Uploaded</p>
                              <p className="text-red-200/60 text-xs">Today, 10:45 AM by Dr. Chen</p>
                            </div>
                            <div className="border-l-2 border-red-700 pl-4 py-1">
                              <p className="text-white text-sm font-medium">Sample Storage Alert</p>
                              <p className="text-red-200/60 text-xs">Today, 09:30 AM - Freezer B temperature</p>
                            </div>
                            <div className="border-l-2 border-red-700 pl-4 py-1">
                              <p className="text-white text-sm font-medium">Experiment Protocol Update</p>
                              <p className="text-red-200/60 text-xs">Yesterday, 4:15 PM by Dr. Rodriguez</p>
                            </div>
                            <div className="border-l-2 border-red-700 pl-4 py-1">
                              <p className="text-white text-sm font-medium">Cell Culture Started</p>
                              <p className="text-red-200/60 text-xs">Yesterday, 2:00 PM by Lab Technician</p>
                            </div>
                            <div className="border-l-2 border-red-700 pl-4 py-1">
                              <p className="text-white text-sm font-medium">Sequencing Results Available</p>
                              <p className="text-red-200/60 text-xs">Feb 26, 11:30 AM - 94% quality score</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Recent Experiments */}
                    <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-lg text-white flex items-center gap-2">
                            <FlaskConical className="h-4 w-4 text-red-400" />
                            Recent Experiments
                          </CardTitle>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs border-red-800/30 text-red-200 hover:bg-red-950/20"
                          >
                            View All
                          </Button>
                        </div>
                        <CardDescription className="text-red-200/60 text-xs">
                          Track your latest experimental progress
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-4 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-red-950/30 hover:bg-red-950/10">
                              <TableHead className="text-red-200">ID</TableHead>
                              <TableHead className="text-red-200">Name</TableHead>
                              <TableHead className="text-red-200">Type</TableHead>
                              <TableHead className="text-red-200">Started</TableHead>
                              <TableHead className="text-red-200">Status</TableHead>
                              <TableHead className="text-red-200">Progress</TableHead>
                              <TableHead className="text-red-200">Assignee</TableHead>
                              <TableHead className="text-red-200 text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sampleExperiments.slice(0, 3).map((exp) => (
                              <TableRow key={exp.id} className="border-red-950/30 hover:bg-red-950/10">
                                <TableCell className="text-red-200/80 font-mono">{exp.id}</TableCell>
                                <TableCell className="font-medium text-white">{exp.name}</TableCell>
                                <TableCell className="text-red-200/80">{exp.type}</TableCell>
                                <TableCell className="text-red-200/80">{exp.startDate}</TableCell>
                                <TableCell>
                                  <Badge className={getStatusColor(exp.status)}>
                                    {exp.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="w-full bg-red-950/30 rounded-full h-2">
                                    <div 
                                      className="bg-gradient-to-r from-red-800 to-red-500 h-2 rounded-full" 
                                      style={{ width: `${exp.completion}%` }}
                                    />
                                  </div>
                                  <div className="text-xs text-red-200/60 text-right mt-1">
                                    {exp.completion}%
                                  </div>
                                </TableCell>
                                <TableCell className="text-red-200/80">{exp.assignee}</TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="h-8 w-8 p-0 border-red-800/30 text-red-200 hover:bg-red-950/20"
                                      >
                                        <span className="sr-only">Open menu</span>
                                        <Filter className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-black/90 border-red-950/30 text-red-200">
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">View Details</DropdownMenuItem>
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Edit Experiment</DropdownMenuItem>
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Download Data</DropdownMenuItem>
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Share Results</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* Experiments Tab */}
              <TabsContent value="experiments" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex flex-col md:flex-row justify-between md:items-center">
                      <div>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-red-400" />
                          Experiment Management
                        </CardTitle>
                        <CardDescription className="text-red-200/60 text-xs">
                          Create, manage and track your experiments
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 mt-2 md:mt-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-red-800/30 text-red-200 hover:bg-red-950/20"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                        <Button
                          size="sm"
                          className="text-xs bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                                  text-white border border-red-800/30"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New Experiment
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-200/60" />
                        <Input
                          placeholder="Search experiments..."
                          className="pl-8 bg-black/40 border-red-950/30 text-white focus:border-red-500 focus:ring-red-500/20"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={experimentFilter} onValueChange={setExperimentFilter}>
                        <SelectTrigger className="w-full md:w-[180px] bg-black/40 border-red-950/30 text-white">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent className="bg-black/90 border-red-950/30 text-red-200">
                          <SelectItem value="all">All Experiments</SelectItem>
                          <SelectItem value="inProgress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-red-950/30 hover:bg-red-950/10">
                            <TableHead className="text-red-200">ID</TableHead>
                            <TableHead className="text-red-200">Name</TableHead>
                            <TableHead className="text-red-200">Type</TableHead>
                            <TableHead className="text-red-200">Started</TableHead>
                            <TableHead className="text-red-200">Status</TableHead>
                            <TableHead className="text-red-200">Progress</TableHead>
                            <TableHead className="text-red-200">Assignee</TableHead>
                            <TableHead className="text-red-200 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredExperiments.map((exp) => (
                            <TableRow key={exp.id} className="border-red-950/30 hover:bg-red-950/10">
                              <TableCell className="text-red-200/80 font-mono">{exp.id}</TableCell>
                              <TableCell className="font-medium text-white">{exp.name}</TableCell>
                              <TableCell className="text-red-200/80">{exp.type}</TableCell>
                              <TableCell className="text-red-200/80">{exp.startDate}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(exp.status)}>
                                  {exp.status}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="w-full bg-red-950/30 rounded-full h-2">
                                  <div 
                                    className="bg-gradient-to-r from-red-800 to-red-500 h-2 rounded-full" 
                                    style={{ width: `${exp.completion}%` }}
                                  />
                                </div>
                                <div className="text-xs text-red-200/60 text-right mt-1">
                                  {exp.completion}%
                                </div>
                              </TableCell>
                              <TableCell className="text-red-200/80">{exp.assignee}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 w-8 p-0 border-red-800/30 text-red-200 hover:bg-red-950/20"
                                        >
                                          <Bookmark className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-black border-red-900">Save</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 w-8 p-0 border-red-800/30 text-red-200 hover:bg-red-950/20"
                                        >
                                          <Share2 className="h-4 w-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent className="bg-black border-red-900">Share</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        className="h-8 w-8 p-0 border-red-800/30 text-red-200 hover:bg-red-950/20"
                                      >
                                        <span className="sr-only">Open menu</span>
                                        <Filter className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="bg-black/90 border-red-950/30 text-red-200">
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">View Details</DropdownMenuItem>
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Edit Experiment</DropdownMenuItem>
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Duplicate</DropdownMenuItem>
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Download Data</DropdownMenuItem>
                                      <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Archive</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Assays Tab */}
              <TabsContent value="assays" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex flex-col md:flex-row justify-between md:items-center">
                      <div>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                          <Beaker className="h-4 w-4 text-red-400" />
                          Assay Management
                        </CardTitle>
                        <CardDescription className="text-red-200/60 text-xs">
                          Track and manage laboratory assays
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 mt-2 md:mt-0">
                        <Button
                          size="sm"
                          className="text-xs bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                                  text-white border border-red-800/30"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          New Assay
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-red-950/30 hover:bg-red-950/10">
                            <TableHead className="text-red-200">ID</TableHead>
                            <TableHead className="text-red-200">Assay Name</TableHead>
                            <TableHead className="text-red-200"># Samples</TableHead>
                            <TableHead className="text-red-200">Priority</TableHead>
                            <TableHead className="text-red-200">Deadline</TableHead>
                            <TableHead className="text-red-200">Status</TableHead>
                            <TableHead className="text-red-200 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sampleAssays.map((assay) => (
                            <TableRow key={assay.id} className="border-red-950/30 hover:bg-red-950/10">
                              <TableCell className="text-red-200/80 font-mono">{assay.id}</TableCell>
                              <TableCell className="font-medium text-white">{assay.name}</TableCell>
                              <TableCell className="text-red-200/80">{assay.samples}</TableCell>
                              <TableCell>
                                <Badge className={getPriorityColor(assay.priority)}>
                                  {assay.priority}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-red-200/80">{assay.deadline}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(assay.status)}>
                                  {assay.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-8 w-8 p-0 border-red-800/30 text-red-200 hover:bg-red-950/20"
                                    >
                                      <span className="sr-only">Open menu</span>
                                      <Filter className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-black/90 border-red-950/30 text-red-200">
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">View Details</DropdownMenuItem>
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Edit Assay</DropdownMenuItem>
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Record Results</DropdownMenuItem>
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Generate Report</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sample Management Tab */}
              <TabsContent value="samples" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex flex-col md:flex-row justify-between md:items-center">
                      <div>
                        <CardTitle className="text-lg text-white flex items-center gap-2">
                          <Clipboard className="h-4 w-4 text-red-400" />
                          Sample Inventory
                        </CardTitle>
                        <CardDescription className="text-red-200/60 text-xs">
                          Track samples and storage locations
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 mt-2 md:mt-0">
                        <Button
                          size="sm"
                          className="text-xs bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                                  text-white border border-red-800/30"
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Sample
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                      <Card className="bg-black/40 border-red-950/30 p-3">
                        <div className="flex items-center gap-2">
                          <ThermometerSnowflake className="h-8 w-8 text-blue-400" />
                          <div>
                            <p className="text-white font-medium">Freezer Status</p>
                            <p className="text-xs text-blue-300">All units operational</p>
                          </div>
                        </div>
                      </Card>
                      
                      <Card className="bg-black/40 border-red-950/30 p-3">
                        <div className="flex items-center gap-2">
                          <Atom className="h-8 w-8 text-green-400" />
                          <div>
                            <p className="text-white font-medium">Cell Lines</p>
                            <p className="text-xs text-green-300">12 active cultures</p>
                          </div>
                        </div>
                      </Card>
                      
                      <Card className="bg-black/40 border-red-950/30 p-3">
                        <div className="flex items-center gap-2">
                          <PieChart className="h-8 w-8 text-yellow-400" />
                          <div>
                            <p className="text-white font-medium">Storage Capacity</p>
                            <p className="text-xs text-yellow-300">72% utilized</p>
                          </div>
                        </div>
                      </Card>
                      
                      <Card className="bg-black/40 border-red-950/30 p-3">
                        <div className="flex items-center gap-2">
                          <AlarmClock className="h-8 w-8 text-red-400" />
                          <div>
                            <p className="text-white font-medium">Expiring Soon</p>
                            <p className="text-xs text-red-300">3 samples this month</p>
                          </div>
                        </div>
                      </Card>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-red-950/30 hover:bg-red-950/10">
                            <TableHead className="text-red-200">ID</TableHead>
                            <TableHead className="text-red-200">Sample Type</TableHead>
                            <TableHead className="text-red-200">Storage Location</TableHead>
                            <TableHead className="text-red-200">Temperature</TableHead>
                            <TableHead className="text-red-200">Created Date</TableHead>
                            <TableHead className="text-red-200">Status</TableHead>
                            <TableHead className="text-red-200 text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sampleSamples.map((sample) => (
                            <TableRow key={sample.id} className="border-red-950/30 hover:bg-red-950/10">
                              <TableCell className="text-red-200/80 font-mono">{sample.id}</TableCell>
                              <TableCell className="font-medium text-white">{sample.type}</TableCell>
                              <TableCell className="text-red-200/80">{sample.location}</TableCell>
                              <TableCell className="text-red-200/80">{sample.temp}</TableCell>
                              <TableCell className="text-red-200/80">{sample.created}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(sample.status)}>
                                  {sample.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      className="h-8 w-8 p-0 border-red-800/30 text-red-200 hover:bg-red-950/20"
                                    >
                                      <span className="sr-only">Open menu</span>
                                      <Filter className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="bg-black/90 border-red-950/30 text-red-200">
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">View Details</DropdownMenuItem>
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Update Status</DropdownMenuItem>
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Move Location</DropdownMenuItem>
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Print Label</DropdownMenuItem>
                                    <DropdownMenuItem className="hover:bg-red-950/20 cursor-pointer">Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Sequencing Tab */}
              <TabsContent value="sequencing" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Dna className="h-4 w-4 text-red-400" />
                      Dna/RNA Sequencing
                    </CardTitle>
                    <CardDescription className="text-red-200/60 text-xs">
                      Manage sequencing requests and analyze results
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="text-center py-12">
                      <Dna className="h-16 w-16 mx-auto text-red-400 mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">Sequencing Module</h3>
                      <p className="text-red-200/60 max-w-md mx-auto mb-6">
                        Track sample preparation, manage sequencing runs, and analyze genomic data.
                      </p>
                      <Button
                        className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                                  text-white border border-red-800/30"
                      >
                        Set Up Sequencing
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Data Analysis Tab */}
              <TabsContent value="analysis" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-red-400" />
                      Data Analysis & Visualization
                    </CardTitle>
                    <CardDescription className="text-red-200/60 text-xs">
                      Process and visualize experimental data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="text-center py-12">
                      <FileSpreadsheet className="h-16 w-16 mx-auto text-red-400 mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">Analytics Module</h3>
                      <p className="text-red-200/60 max-w-md mx-auto mb-6">
                        Import data, run statistical analyses, and create custom visualizations for your research.
                      </p>
                      <Button
                        className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                                  text-white border border-red-800/30"
                      >
                        Import Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Schedule Tab */}
              <TabsContent value="calendar" className="space-y-4">
                <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-red-400" />
                      Lab Schedule
                    </CardTitle>
                    <CardDescription className="text-red-200/60 text-xs">
                      Equipment bookings and team calendar
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="text-center py-12">
                      <Calendar className="h-16 w-16 mx-auto text-red-400 mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">Calendar Module</h3>
                      <p className="text-red-200/60 max-w-md mx-auto mb-6">
                        Schedule equipment time, coordinate team activities, and set experiment reminders.
                      </p>
                      <Button
                        className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                                  text-white border border-red-800/30"
                      >
                        Book Equipment
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </div>
  );
}

export default BiotechDashboard;