// TimeEntryList - Display and manage time entries with filters
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Calendar,
  FolderOpen,
  Search,
  Filter,
  Trash2,
  Edit2,
  MoreVertical,
  DollarSign,
  Tag,
  ChevronDown,
  ChevronUp,
  CheckCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/shadcnComponents/card";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { message, confirm } from "@tauri-apps/plugin-dialog";
import {
  TIME_CATEGORIES,
  COMPANIES,
  type TimeEntryWithRelations,
  type TimeEntryFilters,
  formatDuration,
  formatTime,
  getCategoryColors,
} from "@/stores/timeTrackingTypes";
import { useTimeEntries, useDeleteTimeEntry } from "@/stores/timeTrackingQueries";

interface TimeEntryListProps {
  filters?: TimeEntryFilters;
  onEditEntry?: (entry: TimeEntryWithRelations) => void;
  maxEntries?: number;
  showFilters?: boolean;
}

export const TimeEntryList = ({
  filters: initialFilters,
  onEditEntry,
  maxEntries,
  showFilters = true,
}: TimeEntryListProps) => {
  const [filters, setFilters] = useState<TimeEntryFilters>(initialFilters || {});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const { data: entries, refetch } = useTimeEntries(filters);
  const deleteMutation = useDeleteTimeEntry();

  const displayEntries = maxEntries ? entries.slice(0, maxEntries) : entries;

  const handleDelete = async (id: string) => {
    const confirmed = await confirm("Are you sure you want to delete this time entry?", {
      title: "Delete Entry",
      kind: "warning",
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(id);
        await message("Time entry deleted", { title: "Success" });
      } catch (error: any) {
        await message(error.message || "Failed to delete entry", { title: "Error", kind: "error" });
      }
    }
  };

  const handleFilterChange = (key: keyof TimeEntryFilters, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === "" ? undefined : value,
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const totalMinutes = displayEntries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const billableMinutes = displayEntries.filter((e) => e.is_billable).reduce((sum, e) => sum + e.duration_minutes, 0);

  const inputClass =
    "w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors text-sm";
  const selectClass =
    "w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors text-sm appearance-none cursor-pointer";

  return (
    <Card className="bg-zinc-950 high-dpi:bg-zinc-950/20 border-red-900/30 rounded-xs">
      <CardHeader className="pb-4">
        <CardTitle className="text-amber-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-red-500" />
            Time Entries
            <Badge className="bg-red-900/30 text-red-400 ml-2">{displayEntries.length}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm font-normal text-amber-50/70">
              Total: <span className="text-amber-50 font-medium">{formatDuration(totalMinutes)}</span>
              {billableMinutes > 0 && (
                <span className="text-green-400 ml-2">({formatDuration(billableMinutes)} billable)</span>
              )}
            </div>
            {showFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className="text-amber-50/70 hover:text-amber-50 hover:bg-red-900/20"
              >
                <Filter className="h-4 w-4 mr-1" />
                {showFilterPanel ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </CardTitle>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && showFilterPanel && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Search */}
                <div className="col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-50/50" />
                    <input
                      type="text"
                      placeholder="Search descriptions..."
                      className={`${inputClass} pl-9`}
                      value={filters.search || ""}
                      onChange={(e) => handleFilterChange("search", e.target.value)}
                    />
                  </div>
                </div>

                {/* Company Filter */}
                <select
                  className={selectClass}
                  value={filters.company_id || ""}
                  onChange={(e) => handleFilterChange("company_id", e.target.value)}
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

                {/* Category Filter */}
                <select
                  className={selectClass}
                  value={filters.category || ""}
                  onChange={(e) => handleFilterChange("category", e.target.value)}
                >
                  <option value="" className="bg-black">
                    All Categories
                  </option>
                  {TIME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-black">
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Billable Filter */}
                <select
                  className={selectClass}
                  value={filters.is_billable === undefined ? "" : filters.is_billable.toString()}
                  onChange={(e) =>
                    handleFilterChange("is_billable", e.target.value === "" ? undefined : e.target.value === "true")
                  }
                >
                  <option value="" className="bg-black">
                    All Types
                  </option>
                  <option value="true" className="bg-black">
                    Billable
                  </option>
                  <option value="false" className="bg-black">
                    Non-billable
                  </option>
                </select>

                {/* Clear Filters */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearFilters}
                  className="text-amber-50/50 hover:text-amber-50 hover:bg-red-900/20"
                >
                  Clear Filters
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
          {displayEntries.length === 0 ? (
            <div className="text-center py-12 text-amber-50/50">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries found</p>
              <p className="text-sm mt-1">Start logging your work!</p>
            </div>
          ) : (
            displayEntries.map((entry, index) => {
              const categoryColors = getCategoryColors(entry.category);
              const isExpanded = expandedEntry === entry.id;
              const company = COMPANIES.find((c) => c.id === entry.company_id);

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="group"
                >
                  <div
                    className={`p-4 rounded-lg bg-black/60 border border-red-900/30 hover:border-red-900/50 transition-all cursor-pointer ${
                      isExpanded ? "border-red-900/50" : ""
                    }`}
                    onClick={() => setExpandedEntry(isExpanded ? null : entry.id)}
                  >
                    {/* Main Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Time Block */}
                        <div className="flex flex-col items-center min-w-[80px]">
                          <span className="text-amber-50 font-medium text-lg">
                            {formatDuration(entry.duration_minutes)}
                          </span>
                          <span className="text-amber-50/50 text-xs">
                            {formatTime(format(parseISO(entry.start_time), "HH:mm"))} -{" "}
                            {formatTime(format(parseISO(entry.end_time), "HH:mm"))}
                          </span>
                        </div>

                        {/* Divider */}
                        <div className="h-10 w-px bg-red-900/30" />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {/* Company Badge */}
                            <Badge
                              className="text-xs"
                              style={{ backgroundColor: `${company?.color}20`, color: company?.color }}
                            >
                              {company?.name || "Unknown"}
                            </Badge>

                            {/* Category Badge */}
                            <Badge className={`text-xs ${categoryColors.bg} ${categoryColors.text}`}>
                              {entry.category}
                            </Badge>

                            {/* Billable Indicator */}
                            {entry.is_billable && (
                              <span title="Billable">
                                <DollarSign className="h-3.5 w-3.5 text-green-500" />
                              </span>
                            )}

                            {/* Verified Indicator */}
                            {entry.is_verified && (
                              <span title="Verified">
                                <CheckCircle className="h-3.5 w-3.5 text-blue-500" />
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          <p className={`text-amber-50/80 text-sm ${isExpanded ? "" : "truncate"}`}>
                            {entry.description}
                          </p>

                          {/* Date */}
                          <div className="flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3 text-amber-50/40" />
                            <span className="text-amber-50/40 text-xs">
                              {format(parseISO(entry.date), "EEEE, MMMM d, yyyy")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-amber-50/50 hover:text-amber-50"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-black/90 border border-red-900/30 text-amber-50/70">
                            {onEditEntry && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditEntry(entry);
                                }}
                                className="flex items-center hover:bg-red-900/30 hover:text-amber-50 cursor-pointer"
                              >
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(entry.id);
                              }}
                              className="flex items-center hover:bg-red-900/30 hover:text-amber-50 cursor-pointer text-red-400"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-red-900/20">
                            {/* Tags */}
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex items-center gap-2 mb-3">
                                <Tag className="h-3.5 w-3.5 text-amber-50/50" />
                                <div className="flex flex-wrap gap-1">
                                  {entry.tags.map((tag) => (
                                    <Badge key={tag} className="bg-red-900/20 text-amber-50/70 text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Project */}
                            {entry.project && (
                              <div className="flex items-center gap-2 mb-3">
                                <FolderOpen className="h-3.5 w-3.5 text-amber-50/50" />
                                <span className="text-amber-50/70 text-sm">Project: {entry.project.name}</span>
                              </div>
                            )}

                            {/* Full Description */}
                            <div className="bg-black/40 rounded-lg p-3">
                              <p className="text-amber-50/80 text-sm whitespace-pre-wrap">{entry.description}</p>
                            </div>

                            {/* Timestamps */}
                            <div className="flex items-center justify-between mt-3 text-xs text-amber-50/40">
                              <span>Created: {format(parseISO(entry.created_at), "MMM d, yyyy h:mm a")}</span>
                              {entry.updated_at !== entry.created_at && (
                                <span>Updated: {format(parseISO(entry.updated_at), "MMM d, yyyy h:mm a")}</span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeEntryList;
