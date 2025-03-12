import { useState } from "react";
import {
  BarChart,
  FileText,
  FileSpreadsheet,
  FilePieChart,
  Download,
  Plus,
  RefreshCw,
  Trash2,
  Settings,
  Shield,
  Activity,
  Search,
  Clipboard,
  LineChart,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
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
import { Checkbox } from "@/components/ui/shadcnComponents/checkbox";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Separator } from "@/components/ui/shadcnComponents/separator";
import { Switch } from "@/components/ui/shadcnComponents/switch";
import { motion, AnimatePresence } from "framer-motion";

// Define types
interface Report {
  id: string;
  name: string;
  type: "security" | "activity" | "performance" | "audit" | "custom";
  format: "pdf" | "csv" | "excel" | "json";
  schedule: "manual" | "daily" | "weekly" | "monthly";
  lastGenerated?: string;
  recipients?: string[];
  filters?: Record<string, any>;
  status?: "ready" | "generating" | "error";
}

interface ReportTemplate {
  id: string;
  name: string;
  type: "security" | "activity" | "performance" | "audit" | "custom";
  description: string;
  availableFormats: ("pdf" | "csv" | "excel" | "json")[];
}

// Sample data
const sampleReports: Report[] = [
  {
    id: "rep-001",
    name: "Monthly Security Summary",
    type: "security",
    format: "pdf",
    schedule: "monthly",
    lastGenerated: "2025-02-01T10:15:30Z",
    recipients: ["security@example.com", "admin@example.com"],
    status: "ready",
  },
  {
    id: "rep-002",
    name: "Weekly User Activity",
    type: "activity",
    format: "csv",
    schedule: "weekly",
    lastGenerated: "2025-02-18T14:22:10Z",
    recipients: ["analytics@example.com"],
    status: "ready",
  },
  {
    id: "rep-003",
    name: "System Performance Metrics",
    type: "performance",
    format: "excel",
    schedule: "daily",
    lastGenerated: "2025-02-24T23:50:00Z",
    status: "ready",
  },
  {
    id: "rep-004",
    name: "Failed Login Attempts",
    type: "security",
    format: "pdf",
    schedule: "daily",
    lastGenerated: "2025-02-24T23:55:12Z",
    recipients: ["security@example.com"],
    status: "ready",
  },
  {
    id: "rep-005",
    name: "Quarterly Compliance Audit",
    type: "audit",
    format: "pdf",
    schedule: "manual",
    lastGenerated: "2025-01-15T09:30:00Z",
    recipients: ["compliance@example.com", "legal@example.com"],
    status: "ready",
  },
];

const reportTemplates: ReportTemplate[] = [
  {
    id: "template-001",
    name: "Security Incidents Summary",
    type: "security",
    description:
      "Overview of security incidents, severity levels, and resolution status.",
    availableFormats: ["pdf", "excel"],
  },
  {
    id: "template-002",
    name: "User Activity Log",
    type: "activity",
    description: "Detailed log of user actions, logins, and resource access.",
    availableFormats: ["pdf", "csv", "excel"],
  },
  {
    id: "template-003",
    name: "System Performance Analysis",
    type: "performance",
    description:
      "Analysis of system performance metrics, response times, and resource usage.",
    availableFormats: ["pdf", "excel", "json"],
  },
  {
    id: "template-004",
    name: "Compliance Audit Report",
    type: "audit",
    description:
      "Comprehensive audit report for compliance with security policies and regulations.",
    availableFormats: ["pdf", "excel"],
  },
  {
    id: "template-005",
    name: "Custom Data Export",
    type: "custom",
    description:
      "Customizable report for exporting specific data based on selected filters.",
    availableFormats: ["csv", "excel", "json"],
  },
];

// Helper components
const ReportTypeIcon = ({ type }: { type: any }) => {
  switch (type) {
    case "security":
      return (
        <Badge
          variant="outline"
          className="bg-red-500/20 text-red-400 border-red-500/30 flex items-center gap-1"
        >
          <Shield className="h-3 w-3" />
          Security
        </Badge>
      );
    case "activity":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/20 text-blue-400 border-blue-500/30 flex items-center gap-1"
        >
          <Activity className="h-3 w-3" />
          Activity
        </Badge>
      );
    case "performance":
      return (
        <Badge
          variant="outline"
          className="bg-green-500/20 text-green-400 border-green-500/30 flex items-center gap-1"
        >
          <BarChart className="h-3 w-3" />
          Performance
        </Badge>
      );
    case "audit":
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/20 text-amber-400 border-amber-500/30 flex items-center gap-1"
        >
          <Clipboard className="h-3 w-3" />
          Audit
        </Badge>
      );
    case "custom":
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/20 text-purple-400 border-purple-500/30 flex items-center gap-1"
        >
          <Settings className="h-3 w-3" />
          Custom
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="bg-gray-500/20 text-gray-400 border-gray-500/30"
        >
          Unknown
        </Badge>
      );
  }
};

const ReportFormatIcon = ({ format }: { format: any }) => {
  switch (format) {
    case "pdf":
      return (
        <Badge
          variant="outline"
          className="bg-red-500/10 text-red-400 border-red-500/20 flex items-center gap-1"
        >
          <FileText className="h-3 w-3" />
          PDF
        </Badge>
      );
    case "csv":
      return (
        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-400 border-green-500/20 flex items-center gap-1"
        >
          <FileSpreadsheet className="h-3 w-3" />
          CSV
        </Badge>
      );
    case "excel":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1"
        >
          <FileSpreadsheet className="h-3 w-3" />
          Excel
        </Badge>
      );
    case "json":
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/10 text-amber-400 border-amber-500/20 flex items-center gap-1"
        >
          <FilePieChart className="h-3 w-3" />
          JSON
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="bg-gray-500/10 text-gray-400 border-gray-500/20"
        >
          Unknown
        </Badge>
      );
  }
};

const ScheduleBadge = ({ schedule }: { schedule: any }) => {
  switch (schedule) {
    case "manual":
      return (
        <Badge
          variant="outline"
          className="bg-gray-500/10 text-red-200 border-red-900/20"
        >
          Manual
        </Badge>
      );
    case "daily":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-red-200 border-red-900/20"
        >
          Daily
        </Badge>
      );
    case "weekly":
      return (
        <Badge
          variant="outline"
          className="bg-green-500/10 text-red-200 border-red-900/20"
        >
          Weekly
        </Badge>
      );
    case "monthly":
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/10 text-red-200 border-red-900/20"
        >
          Monthly
        </Badge>
      );
    default:
      return (
        <Badge
          variant="outline"
          className="bg-gray-500/10 text-gray-400 border-gray-500/20"
        >
          Unknown
        </Badge>
      );
  }
};

// New Report Dialog
const NewReportDialog = ({ templates, onSave }: { templates: any, onSave: any }) => {
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [reportName, setReportName] = useState("");
  const [reportFormat, setReportFormat] = useState("");
  const [schedule, setSchedule] = useState("manual");
  const [recipients, setRecipients] = useState("");
  const [open, setOpen] = useState(false);

  const selectedTemplateData = templates.find((t: any) => t.id === selectedTemplate);

  const handleSave = () => {
    if (!reportName || !selectedTemplate || !reportFormat) return;

    const newReport: Report = {
      id: `rep-${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0")}`,
      name: reportName,
      type: selectedTemplateData?.type || "custom",
      format: reportFormat as "pdf" | "csv" | "excel" | "json",
      schedule: schedule as "manual" | "daily" | "weekly" | "monthly",
      recipients: recipients ? recipients.split(",").map((r) => r.trim()) : [],
      status: "ready",
    };

    onSave(newReport);
    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedTemplate("");
    setReportName("");
    setReportFormat("");
    setSchedule("manual");
    setRecipients("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800 text-white border border-red-800/30 shadow-lg shadow-red-950/20">
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-black/95 border-red-950/30 text-red-200">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Report</DialogTitle>
          <DialogDescription className="text-red-200/60">
            Configure a new report from a template or create a custom report.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="template" className="text-red-200">
              Report Template
            </Label>
            <Select
              value={selectedTemplate}
              onValueChange={setSelectedTemplate}
            >
              <SelectTrigger
                id="template"
                className="bg-black/40 border-red-950/30 text-red-200"
              >
                <SelectValue placeholder="Select a report template" />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-red-950/30 text-red-200">
                {templates.map((template: any) => (
                  <SelectItem
                    key={template.id}
                    value={template.id}
                    className="text-red-200 hover:bg-red-950/30"
                  >
                    <div className="flex items-center gap-2">
                      <span>{template.name}</span>
                      <ReportTypeIcon type={template.type} />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTemplateData && (
            <div className="p-3 bg-black/40 border border-red-950/30 rounded-md text-sm text-red-200/70">
              {selectedTemplateData.description}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="report-name" className="text-red-200">
              Report Name
            </Label>
            <Input
              id="report-name"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Enter a descriptive name"
              className="bg-black/40 border-red-950/30 text-red-200 placeholder:text-red-200/40"
            />
          </div>

          {selectedTemplateData && (
            <div className="space-y-2">
              <Label htmlFor="format" className="text-red-200">
                Report Format
              </Label>
              <Select value={reportFormat} onValueChange={setReportFormat}>
                <SelectTrigger
                  id="format"
                  className="bg-black/40 border-red-950/30 text-red-200"
                >
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent className="bg-black/95 border-red-950/30 text-red-200">
                  {selectedTemplateData.availableFormats.map((format: any) => (
                    <SelectItem
                      key={format}
                      value={format}
                      className="text-red-200 hover:bg-red-950/30"
                    >
                      <div className="flex items-center gap-2">
                        {format === "pdf" && <FileText className="h-4 w-4" />}
                        {format === "csv" && (
                          <FileSpreadsheet className="h-4 w-4" />
                        )}
                        {format === "excel" && (
                          <FileSpreadsheet className="h-4 w-4" />
                        )}
                        {format === "json" && (
                          <FilePieChart className="h-4 w-4" />
                        )}
                        {format.toUpperCase()}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="schedule" className="text-red-200">
              Schedule
            </Label>
            <Select value={schedule} onValueChange={setSchedule}>
              <SelectTrigger
                id="schedule"
                className="bg-black/40 border-red-950/30 text-red-200"
              >
                <SelectValue placeholder="Select schedule" />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-red-950/30 text-red-200">
                <SelectItem
                  value="manual"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  Manual Generation
                </SelectItem>
                <SelectItem
                  value="daily"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  Daily
                </SelectItem>
                <SelectItem
                  value="weekly"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  Weekly
                </SelectItem>
                <SelectItem
                  value="monthly"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  Monthly
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recipients" className="text-red-200">
              Email Recipients (comma-separated)
            </Label>
            <Input
              id="recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="email1@example.com, email2@example.com"
              className="bg-black/40 border-red-950/30 text-red-200 placeholder:text-red-200/40"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="notify"
              className="data-[state=checked]:bg-red-900 data-[state=checked]:border-red-900"
            />
            <Label htmlFor="notify" className="text-red-200">
              Notify me when report is generated
            </Label>
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
            onClick={handleSave}
            disabled={!reportName || !selectedTemplate || !reportFormat}
            className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800 text-white border border-red-800/30 shadow-lg shadow-red-950/20"
          >
            Create Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Report cards for different report types
const ReportCard = ({ report, onGenerate, onDelete }: { report: any, onGenerate: any, onDelete: any }) => {
  return (
    <Card className="bg-black/40 border-red-900/30 overflow-hidden hover:border-red-900/50 transition-all duration-200">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-red-200 text-base font-medium">
              {report.name}
            </CardTitle>
            <CardDescription className="text-red-200/60 text-xs">
              Last generated:{" "}
              {report.lastGenerated
                ? new Date(report.lastGenerated).toLocaleString()
                : "Never"}
            </CardDescription>
          </div>
          <ReportTypeIcon type={report.type} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-2">
        <div className="flex flex-wrap gap-2 mt-2">
          <ReportFormatIcon format={report.format} />
          <ScheduleBadge schedule={report.schedule} />
        </div>

        {report.recipients && report.recipients.length > 0 && (
          <div className="mt-3 text-xs text-red-200/60">
            <span className="font-medium">Recipients:</span>{" "}
            {report.recipients.join(", ")}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 flex gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onGenerate(report.id)}
          disabled={report.status === "generating"}
          className="border-red-800/30 text-red-200 hover:bg-red-950/20"
        >
          {report.status === "generating" ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {report.status === "generating" ? "Generating..." : "Generate"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onDelete(report.id)}
          className="border-red-800/30 text-red-200 hover:bg-red-700/20"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

// Main Report Settings component
const ReportSettings = () => {
  const [reports, setReports] = useState<Report[]>(sampleReports);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredReports = reports.filter((report) => {
    if (
      searchQuery &&
      !report.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    if (activeTab !== "all" && report.type !== activeTab) {
      return false;
    }

    return true;
  });

  const handleAddReport = (newReport: Report) => {
    setReports([newReport, ...reports]);
  };

  const handleDeleteReport = (id: string) => {
    setReports(reports.filter((report) => report.id !== id));
  };

  const handleGenerateReport = (id: string) => {
    setReports(
      reports.map((report) =>
        report.id === id ? { ...report, status: "generating" } : report
      )
    );

    // Simulate report generation
    setTimeout(() => {
      setReports(
        reports.map((report) =>
          report.id === id
            ? {
                ...report,
                status: "ready",
                lastGenerated: new Date().toISOString(),
              }
            : report
        )
      );
    }, 2000);
  };

  // Report counts by type
  const reportCounts = {
    security: reports.filter((r) => r.type === "security").length,
    activity: reports.filter((r) => r.type === "activity").length,
    performance: reports.filter((r) => r.type === "performance").length,
    audit: reports.filter((r) => r.type === "audit").length,
    custom: reports.filter((r) => r.type === "custom").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-bold text-white">Report Management</h2>
        <NewReportDialog templates={reportTemplates} onSave={handleAddReport} />
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-red-200/60" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 w-full bg-black/40 border-red-950/30 text-red-200 placeholder:text-red-200/40"
          />
        </div>
      </div>

      {/* Report Type Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="h-12 justify-start space-x-2 bg-black/40 p-1 text-red-200/60 border border-red-950/20">
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200"
          >
            <LineChart className="h-4 w-4 mr-2" />
            All Reports ({reports.length})
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200"
          >
            <Shield className="h-4 w-4 mr-2" />
            Security ({reportCounts.security})
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200"
          >
            <Activity className="h-4 w-4 mr-2" />
            Activity ({reportCounts.activity})
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200"
          >
            <BarChart className="h-4 w-4 mr-2" />
            Performance ({reportCounts.performance})
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200"
          >
            <Clipboard className="h-4 w-4 mr-2" />
            Audit ({reportCounts.audit})
          </TabsTrigger>
          <TabsTrigger
            value="custom"
            className="data-[state=active]:bg-red-950/20 data-[state=active]:text-red-200 hover:text-red-200 transition-colors duration-200"
          >
            <Settings className="h-4 w-4 mr-2" />
            Custom ({reportCounts.custom})
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
            <TabsContent value="all" className="mt-4 space-y-4">
              <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">
                    All Reports
                  </CardTitle>
                  <CardDescription className="text-red-200/60">
                    View and manage all your configured reports
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredReports.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredReports.map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          onGenerate={handleGenerateReport}
                          onDelete={handleDeleteReport}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-10">
                      <FileText className="h-16 w-16 text-red-900/30 mb-4" />
                      <h3 className="text-lg font-medium text-red-200 mb-1">
                        No reports found
                      </h3>
                      <p className="text-sm text-red-200/60 mb-6">
                        {searchQuery
                          ? "Try adjusting your search"
                          : "Create your first report to get started"}
                      </p>
                      <NewReportDialog
                        templates={reportTemplates}
                        onSave={handleAddReport}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Performance tab */}
            <TabsContent value="performance" className="mt-4 space-y-4">
              <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">
                    Performance Reports
                  </CardTitle>
                  <CardDescription className="text-red-200/60">
                    Analyze system performance metrics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredReports.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredReports.map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          onGenerate={handleGenerateReport}
                          onDelete={handleDeleteReport}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-10">
                      <BarChart className="h-16 w-16 text-red-900/30 mb-4" />
                      <h3 className="text-lg font-medium text-red-200 mb-1">
                        No performance reports found
                      </h3>
                      <p className="text-sm text-red-200/60 mb-6">
                        Create performance reports to monitor system metrics and
                        resources
                      </p>
                      <NewReportDialog
                        templates={reportTemplates}
                        onSave={handleAddReport}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Audit tab */}
            <TabsContent value="audit" className="mt-4 space-y-4">
              <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">
                    Audit Reports
                  </CardTitle>
                  <CardDescription className="text-red-200/60">
                    Compliance and governance reporting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredReports.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredReports.map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          onGenerate={handleGenerateReport}
                          onDelete={handleDeleteReport}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-10">
                      <Clipboard className="h-16 w-16 text-red-900/30 mb-4" />
                      <h3 className="text-lg font-medium text-red-200 mb-1">
                        No audit reports found
                      </h3>
                      <p className="text-sm text-red-200/60 mb-6">
                        Create audit reports for compliance and governance
                        requirements
                      </p>
                      <NewReportDialog
                        templates={reportTemplates}
                        onSave={handleAddReport}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Custom tab */}
            <TabsContent value="custom" className="mt-4 space-y-4">
              <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-lg">
                    Custom Reports
                  </CardTitle>
                  <CardDescription className="text-red-200/60">
                    Customized reports for specific needs
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredReports.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredReports.map((report) => (
                        <ReportCard
                          key={report.id}
                          report={report}
                          onGenerate={handleGenerateReport}
                          onDelete={handleDeleteReport}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-10">
                      <Settings className="h-16 w-16 text-red-900/30 mb-4" />
                      <h3 className="text-lg font-medium text-red-200 mb-1">
                        No custom reports found
                      </h3>
                      <p className="text-sm text-red-200/60 mb-6">
                        Create custom reports tailored to your specific
                        requirements
                      </p>
                      <NewReportDialog
                        templates={reportTemplates}
                        onSave={handleAddReport}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </motion.div>
        </AnimatePresence>
      </Tabs>

      {/* Available Templates */}
      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Report Templates</CardTitle>
          <CardDescription className="text-red-200/60">
            Available templates for generating new reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTemplates.map((template) => (
              <Card
                key={template.id}
                className="bg-black/40 border-red-900/30 hover:border-red-900/50 transition-all duration-200"
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-red-200 text-base font-medium">
                      {template.name}
                    </CardTitle>
                    <ReportTypeIcon type={template.type} />
                  </div>
                </CardHeader>
                <CardContent className="py-2">
                  <p className="text-xs text-red-200/70 mb-3">
                    {template.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {template.availableFormats.map((format) => (
                      <ReportFormatIcon key={format} format={format} />
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-red-800/30 text-red-200 hover:bg-red-950/20"
                    onClick={() => {
                      // Would typically open New Report dialog pre-filled with this template
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Use Template
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Global Report Settings */}
      <Card className="bg-black/60 border-red-950/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Report Settings</CardTitle>
          <CardDescription className="text-red-200/60">
            Configure global reporting preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-red-200">
                Email Notifications
              </Label>
              <p className="text-sm text-red-200/60">
                Receive email notifications when reports are generated
              </p>
            </div>
            <Switch className="data-[state=checked]:bg-red-900" />
          </div>

          <Separator className="border-red-950/20" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-red-200">
                Default Report Format
              </Label>
              <p className="text-sm text-red-200/60">
                Set the default format for new reports
              </p>
            </div>
            <Select defaultValue="pdf">
              <SelectTrigger className="w-[180px] bg-black/40 border-red-950/30 text-red-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-red-950/30 text-red-200">
                <SelectItem
                  value="pdf"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  PDF Document
                </SelectItem>
                <SelectItem
                  value="csv"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  CSV Spreadsheet
                </SelectItem>
                <SelectItem
                  value="excel"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  Excel Workbook
                </SelectItem>
                <SelectItem
                  value="json"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  JSON Data
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="border-red-950/20" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-red-200">
                Report Retention Period
              </Label>
              <p className="text-sm text-red-200/60">
                How long to keep generated reports in the system
              </p>
            </div>
            <Select defaultValue="90">
              <SelectTrigger className="w-[180px] bg-black/40 border-red-950/30 text-red-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black/95 border-red-950/30 text-red-200">
                <SelectItem
                  value="30"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  30 Days
                </SelectItem>
                <SelectItem
                  value="60"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  60 Days
                </SelectItem>
                <SelectItem
                  value="90"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  90 Days
                </SelectItem>
                <SelectItem
                  value="180"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  180 Days
                </SelectItem>
                <SelectItem
                  value="365"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  1 Year
                </SelectItem>
                <SelectItem
                  value="forever"
                  className="text-red-200 hover:bg-red-950/30"
                >
                  Forever
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator className="border-red-950/20" />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base text-red-200">
                Automatic Report Generation
              </Label>
              <p className="text-sm text-red-200/60">
                Allow scheduled reports to generate automatically
              </p>
            </div>
            <Switch
              defaultChecked
              className="data-[state=checked]:bg-red-900"
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800 text-white border border-red-800/30 shadow-lg shadow-red-950/20">
            Save Settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ReportSettings;
