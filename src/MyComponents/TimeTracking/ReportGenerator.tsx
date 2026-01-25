// ReportGenerator - PDF and CSV export functionality for time tracking
import { useState } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Calendar,
  Building2,
  FolderOpen,
  Eye,
  EyeOff,
  BarChart3,
  Link2,
  Copy,
  Check,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Document, Page, Text, View, StyleSheet, PDFDownloadLink, pdf } from "@react-pdf/renderer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { message } from "@tauri-apps/plugin-dialog";
import {
  COMPANIES,
  type TimeEntryWithRelations,
  type ReportConfig,
  type Company,
  formatDuration,
  formatHours,
} from "@/stores/timeTrackingTypes";
import { useTimeEntries, useCompanies, useProjects } from "@/stores/timeTrackingQueries";

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: 30,
    borderBottomWidth: 2,
    borderBottomColor: "#dc2626",
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  companyName: {
    fontSize: 14,
    color: "#dc2626",
    marginTop: 5,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 10,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statBox: {
    width: "23%",
    padding: 15,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#374151",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  tableCell: {
    fontSize: 9,
    color: "#4b5563",
  },
  dateCol: { width: "15%" },
  timeCol: { width: "12%" },
  durationCol: { width: "10%" },
  categoryCol: { width: "12%" },
  descCol: { width: "51%" },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 8,
    color: "#9ca3af",
  },
  summaryBox: {
    backgroundColor: "#fef2f2",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#6b7280",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1f2937",
  },
});

// PDF Document Component
interface TimeReportPDFProps {
  entries: TimeEntryWithRelations[];
  config: ReportConfig;
  company?: Company;
}

const TimeReportPDF = ({ entries, config, company }: TimeReportPDFProps) => {
  const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const billableMinutes = entries.filter((e) => e.is_billable).reduce((sum, e) => sum + e.duration_minutes, 0);
  const uniqueDays = new Set(entries.map((e) => e.date)).size;
  const dateRange = `${format(config.date_range.start, "MMM d, yyyy")} - ${format(config.date_range.end, "MMM d, yyyy")}`;
  const dayCount = differenceInDays(config.date_range.end, config.date_range.start) + 1;

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  entries.forEach((e) => {
    categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.duration_minutes;
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{config.title || "Time Tracking Report"}</Text>
          <Text style={styles.subtitle}>{dateRange}</Text>
          {company && <Text style={styles.companyName}>{company.name}</Text>}
        </View>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Hours</Text>
            <Text style={styles.statValue}>{formatHours(totalMinutes / 60)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Billable Hours</Text>
            <Text style={styles.statValue}>{formatHours(billableMinutes / 60)}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Days Worked</Text>
            <Text style={styles.statValue}>{uniqueDays}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Avg Hours/Day</Text>
            <Text style={styles.statValue}>{formatHours(totalMinutes / 60 / (uniqueDays || 1))}</Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>Hours by Category</Text>
          {Object.entries(categoryBreakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([category, minutes]) => (
              <View key={category} style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>{category}</Text>
                <Text style={styles.summaryValue}>
                  {formatHours(minutes / 60)} ({Math.round((minutes / totalMinutes) * 100)}%)
                </Text>
              </View>
            ))}
        </View>

        {/* Entries Table */}
        {config.include_detailed_entries && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Detailed Time Entries ({entries.length} entries)</Text>
            <View style={styles.table}>
              {/* Table Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, styles.dateCol]}>Date</Text>
                <Text style={[styles.tableHeaderText, styles.timeCol]}>Time</Text>
                <Text style={[styles.tableHeaderText, styles.durationCol]}>Duration</Text>
                <Text style={[styles.tableHeaderText, styles.categoryCol]}>Category</Text>
                <Text style={[styles.tableHeaderText, styles.descCol]}>Description</Text>
              </View>

              {/* Table Rows */}
              {entries.slice(0, 50).map((entry, index) => (
                <View key={entry.id} style={[styles.tableRow, ...(index % 2 === 1 ? [styles.tableRowAlt] : [])]}>
                  <Text style={[styles.tableCell, styles.dateCol]}>{format(parseISO(entry.date), "MMM d")}</Text>
                  <Text style={[styles.tableCell, styles.timeCol]}>
                    {format(parseISO(entry.start_time), "HH:mm")}
                  </Text>
                  <Text style={[styles.tableCell, styles.durationCol]}>{formatDuration(entry.duration_minutes)}</Text>
                  <Text style={[styles.tableCell, styles.categoryCol]}>{entry.category}</Text>
                  <Text style={[styles.tableCell, styles.descCol]}>
                    {config.redact_sensitive
                      ? entry.description.substring(0, 80) + (entry.description.length > 80 ? "..." : "")
                      : entry.description.substring(0, 100) + (entry.description.length > 100 ? "..." : "")}
                  </Text>
                </View>
              ))}

              {entries.length > 50 && (
                <View style={styles.tableRow}>
                  <Text style={[styles.tableCell, { width: "100%", textAlign: "center", color: "#9ca3af" }]}>
                    ... and {entries.length - 50} more entries
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}</Text>
          <Text style={styles.footerText}>Proof of Work Report - Confidential</Text>
        </View>
      </Page>
    </Document>
  );
};

// Main Report Generator Component
export const TimeReportGenerator = () => {
  const [dateFrom, setDateFrom] = useState(format(new Date(new Date().setDate(1)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [includeDescriptions, setIncludeDescriptions] = useState(true);
  const [redactSensitive, setRedactSensitive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: entries } = useTimeEntries({
    date_from: dateFrom,
    date_to: dateTo,
    company_id: selectedCompany || undefined,
  });

  const totalHours = entries.reduce((sum, e) => sum + e.duration_minutes, 0) / 60;
  const billableHours = entries.filter((e) => e.is_billable).reduce((sum, e) => sum + e.duration_minutes, 0) / 60;

  const reportConfig: ReportConfig = {
    title: selectedCompany
      ? `${COMPANIES.find((c) => c.id === selectedCompany)?.name || ""} - Time Report`
      : "Time Tracking Report",
    date_range: {
      start: parseISO(dateFrom),
      end: parseISO(dateTo),
    },
    company_id: selectedCompany || undefined,
    include_descriptions: includeDescriptions,
    include_charts: true,
    include_detailed_entries: true,
    redact_sensitive: redactSensitive,
    format: "pdf",
  };

  const selectedCompanyData = COMPANIES.find((c) => c.id === selectedCompany);

  const handleExportCSV = () => {
    const headers = ["Date", "Start Time", "End Time", "Duration (min)", "Category", "Company", "Billable", "Description"];
    const rows = entries.map((e) => [
      e.date,
      format(parseISO(e.start_time), "HH:mm"),
      format(parseISO(e.end_time), "HH:mm"),
      e.duration_minutes.toString(),
      e.category,
      e.company?.name || "",
      e.is_billable ? "Yes" : "No",
      redactSensitive ? e.description.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g, "[email]") : e.description,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `time-report-${dateFrom}-to-${dateTo}.csv`;
    link.click();
  };

  const inputClass =
    "w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors";
  const selectClass =
    "w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors appearance-none cursor-pointer";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Report Configuration */}
      <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-amber-50 flex items-center gap-2">
            <FileText className="h-5 w-5 text-red-500" />
            Report Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="text-amber-50/70 text-sm font-medium flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                className={inputClass}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <input
                type="date"
                className={inputClass}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* Company Filter */}
          <div className="space-y-2">
            <label className="text-amber-50/70 text-sm font-medium flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              Company
            </label>
            <select
              className={selectClass}
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
            >
              <option value="" className="bg-black">
                All Companies
              </option>
              {COMPANIES.map((c) => (
                <option key={c.id} value={c.id} className="bg-black">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeDescriptions}
                onChange={(e) => setIncludeDescriptions(e.target.checked)}
                className="w-4 h-4 rounded border-red-900/30 bg-black/40 text-red-500 focus:ring-red-500"
              />
              <span className="text-amber-50/70 text-sm group-hover:text-amber-50 transition-colors">
                Include detailed entries
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={redactSensitive}
                onChange={(e) => setRedactSensitive(e.target.checked)}
                className="w-4 h-4 rounded border-red-900/30 bg-black/40 text-red-500 focus:ring-red-500"
              />
              <span className="text-amber-50/70 text-sm group-hover:text-amber-50 transition-colors">
                Redact sensitive information
              </span>
            </label>
          </div>

          {/* Export Buttons */}
          <div className="pt-4 space-y-2">
            <PDFDownloadLink
              document={
                <TimeReportPDF
                  entries={entries}
                  config={reportConfig}
                  company={selectedCompanyData as Company | undefined}
                />
              }
              fileName={`time-report-${dateFrom}-to-${dateTo}.pdf`}
              className="block"
            >
              {({ loading }) => (
                <Button
                  disabled={loading || entries.length === 0}
                  className="w-full bg-red-900 hover:bg-red-800 text-amber-50 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF Report
                    </>
                  )}
                </Button>
              )}
            </PDFDownloadLink>

            <Button
              onClick={handleExportCSV}
              disabled={entries.length === 0}
              variant="outline"
              className="w-full border-red-900/30 text-amber-50/70 hover:bg-red-900/20 hover:text-amber-50 disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export as CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-amber-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-red-500" />
              Report Preview
            </div>
            <Badge className="bg-red-900/30 text-red-400">{entries.length} entries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="text-center py-12 text-amber-50/50">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No entries found for the selected date range</p>
              <p className="text-sm mt-1">Adjust your filters to see data</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-black/40 border border-red-900/30 rounded-lg p-4">
                  <p className="text-amber-50/60 text-xs">Total Hours</p>
                  <p className="text-amber-50 text-2xl font-bold">{formatHours(totalHours)}</p>
                </div>
                <div className="bg-black/40 border border-red-900/30 rounded-lg p-4">
                  <p className="text-amber-50/60 text-xs">Billable Hours</p>
                  <p className="text-green-400 text-2xl font-bold">{formatHours(billableHours)}</p>
                </div>
                <div className="bg-black/40 border border-red-900/30 rounded-lg p-4">
                  <p className="text-amber-50/60 text-xs">Days Worked</p>
                  <p className="text-amber-50 text-2xl font-bold">{new Set(entries.map((e) => e.date)).size}</p>
                </div>
                <div className="bg-black/40 border border-red-900/30 rounded-lg p-4">
                  <p className="text-amber-50/60 text-xs">Avg Hours/Day</p>
                  <p className="text-amber-50 text-2xl font-bold">
                    {formatHours(totalHours / (new Set(entries.map((e) => e.date)).size || 1))}
                  </p>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="bg-black/40 border border-red-900/30 rounded-lg p-4">
                <h4 className="text-amber-50 font-medium mb-3">Hours by Category</h4>
                <div className="space-y-2">
                  {Object.entries(
                    entries.reduce(
                      (acc, e) => {
                        acc[e.category] = (acc[e.category] || 0) + e.duration_minutes;
                        return acc;
                      },
                      {} as Record<string, number>
                    )
                  )
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, minutes]) => (
                      <div key={category} className="flex items-center gap-3">
                        <div className="flex-1 bg-black/40 rounded-full h-2 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(minutes / (totalHours * 60)) * 100}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                            className="h-full bg-red-500"
                          />
                        </div>
                        <span className="text-amber-50/70 text-sm min-w-[100px]">{category}</span>
                        <span className="text-amber-50 text-sm font-medium min-w-[60px] text-right">
                          {formatHours(minutes / 60)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Sample Entries Preview */}
              <div className="bg-black/40 border border-red-900/30 rounded-lg p-4">
                <h4 className="text-amber-50 font-medium mb-3">Recent Entries (Preview)</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {entries.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between py-2 border-b border-red-900/10">
                      <div className="flex items-center gap-3">
                        <span className="text-amber-50/50 text-xs">{format(parseISO(entry.date), "MMM d")}</span>
                        <span className="text-amber-50 text-sm truncate max-w-[300px]">{entry.description}</span>
                      </div>
                      <Badge className="bg-red-900/20 text-red-400">{formatDuration(entry.duration_minutes)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// Export buttons component for the header
export const ExportButtons = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const monthStart = format(new Date(new Date().setDate(1)), "yyyy-MM-dd");

  const { data: monthEntries } = useTimeEntries({
    date_from: monthStart,
    date_to: today,
  });

  const handleQuickCSV = () => {
    const headers = ["Date", "Start", "End", "Duration", "Category", "Company", "Billable", "Description"];
    const rows = monthEntries.map((e) => [
      e.date,
      format(parseISO(e.start_time), "HH:mm"),
      format(parseISO(e.end_time), "HH:mm"),
      e.duration_minutes.toString(),
      e.category,
      e.company?.name || "",
      e.is_billable ? "Yes" : "No",
      e.description,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `time-entries-${today}.csv`;
    link.click();
  };

  const reportConfig: ReportConfig = {
    title: "Monthly Time Report",
    date_range: {
      start: parseISO(monthStart),
      end: parseISO(today),
    },
    include_descriptions: true,
    include_charts: true,
    include_detailed_entries: true,
    redact_sensitive: false,
    format: "pdf",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-red-900/30 text-amber-50/70 hover:bg-red-900/20 hover:text-amber-50">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-black/90 border border-red-900/30 text-amber-50/70">
        <PDFDownloadLink
          document={<TimeReportPDF entries={monthEntries} config={reportConfig} />}
          fileName={`time-report-${today}.pdf`}
        >
          {({ loading }) => (
            <DropdownMenuItem
              disabled={loading}
              className="flex items-center hover:bg-red-900/30 hover:text-amber-50 cursor-pointer"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Export PDF (This Month)
            </DropdownMenuItem>
          )}
        </PDFDownloadLink>
        <DropdownMenuItem
          onClick={handleQuickCSV}
          className="flex items-center hover:bg-red-900/30 hover:text-amber-50 cursor-pointer"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV (This Month)
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-red-900/30" />
        <DropdownMenuItem className="flex items-center hover:bg-red-900/30 hover:text-amber-50 cursor-pointer text-amber-50/50">
          <ExternalLink className="h-4 w-4 mr-2" />
          Custom Report...
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default TimeReportGenerator;
