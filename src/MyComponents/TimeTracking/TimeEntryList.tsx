// TimeEntryList - Modern minimal entry list
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Search,
  Filter,
  Trash2,
  Edit2,
  MoreHorizontal,
  DollarSign,
  ChevronDown,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
  getCategoryColors,
} from "@/stores/timeTrackingTypes";
import { useTimeEntries, useDeleteTimeEntry } from "@/stores/timeTrackingQueries";

interface TimeEntryListProps {
  filters?: TimeEntryFilters;
  onEditEntry?: (entry: TimeEntryWithRelations) => void;
  maxEntries?: number;
  showFilters?: boolean;
  compact?: boolean;
}

export const TimeEntryList = ({
  filters: initialFilters,
  onEditEntry,
  maxEntries,
  showFilters = true,
  compact = false,
}: TimeEntryListProps) => {
  const [filters, setFilters] = useState<TimeEntryFilters>(initialFilters || {});
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const { data: entries } = useTimeEntries(filters);
  const deleteMutation = useDeleteTimeEntry();

  const displayEntries = maxEntries ? entries.slice(0, maxEntries) : entries;

  const handleDelete = async (id: string) => {
    const confirmed = await confirm("Delete this entry?", {
      title: "Delete Entry",
      kind: "warning",
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(id);
        await message("Entry deleted", { title: "Success" });
      } catch (error: any) {
        await message(error.message || "Failed to delete", { title: "Error", kind: "error" });
      }
    }
  };

  const handleFilterChange = (key: keyof TimeEntryFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value === "" ? undefined : value }));
  };

  const clearFilters = () => setFilters({});
  const hasActiveFilters = Object.values(filters).some((v) => v !== undefined && v !== "");

  const totalMinutes = displayEntries.reduce((sum, e) => sum + e.duration_minutes, 0);

  const inputStyles = cn(
    "px-3 py-2 rounded-lg text-sm text-white placeholder:text-white/30",
    "bg-white/[0.03] border border-white/[0.08]",
    "focus:border-white/20 focus:outline-none transition-all"
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white/70 uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Entries
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/50">
            {displayEntries.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {totalMinutes > 0 && (
            <span className="text-sm text-white/50">
              Total: <span className="text-white font-medium">{formatDuration(totalMinutes)}</span>
            </span>
          )}
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
                showFilterPanel || hasActiveFilters
                  ? "bg-white/10 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/[0.05]"
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      <AnimatePresence>
        {showFilters && showFilterPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Search */}
                <div className="col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className={cn(inputStyles, "w-full pl-9")}
                    value={filters.search || ""}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                  />
                </div>

                {/* Company */}
                <select
                  className={cn(inputStyles, "w-full appearance-none cursor-pointer [&>option]:bg-zinc-900")}
                  value={filters.company_id || ""}
                  onChange={(e) => handleFilterChange("company_id", e.target.value)}
                >
                  <option value="">All Companies</option>
                  {COMPANIES.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>

                {/* Category */}
                <select
                  className={cn(inputStyles, "w-full appearance-none cursor-pointer [&>option]:bg-zinc-900")}
                  value={filters.category || ""}
                  onChange={(e) => handleFilterChange("category", e.target.value)}
                >
                  <option value="">All Categories</option>
                  {TIME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries List */}
      <div className={cn("space-y-2", !compact && "max-h-[500px] overflow-y-auto pr-1")}>
        {displayEntries.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="h-10 w-10 mx-auto text-white/10 mb-3" />
            <p className="text-white/30 text-sm">No entries yet</p>
          </div>
        ) : (
          displayEntries.map((entry, index) => {
            const isExpanded = expandedEntry === entry.id;
            const company = COMPANIES.find((c) => c.id === entry.company_id);
            const categoryColor = getCategoryColors(entry.category);

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="group"
              >
                <div
                  onClick={() => !compact && setExpandedEntry(isExpanded ? null : entry.id)}
                  className={cn(
                    "p-4 rounded-xl border transition-all duration-200",
                    "bg-white/[0.01] border-white/[0.06]",
                    "hover:bg-white/[0.03] hover:border-white/[0.1]",
                    !compact && "cursor-pointer",
                    isExpanded && "bg-white/[0.03] border-white/[0.1]"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Duration */}
                    <div className="min-w-[70px]">
                      <p className="text-lg font-semibold text-white">
                        {formatDuration(entry.duration_minutes)}
                      </p>
                      <p className="text-[10px] text-white/30 uppercase tracking-wider">
                        {format(parseISO(entry.start_time), "HH:mm")} - {format(parseISO(entry.end_time), "HH:mm")}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="h-8 w-px bg-white/[0.06]" />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {/* Company */}
                        <span
                          className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-md"
                          style={{
                            backgroundColor: `${company?.color}15`,
                            color: company?.color,
                          }}
                        >
                          {company?.name || "Unknown"}
                        </span>

                        {/* Category */}
                        <span className={cn(
                          "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md",
                          categoryColor.bg, categoryColor.text
                        )}>
                          {entry.category}
                        </span>

                        {/* Indicators */}
                        {entry.is_billable && (
                          <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                        {entry.is_verified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                        )}
                      </div>

                      <p className={cn(
                        "text-sm text-white/70",
                        !isExpanded && "line-clamp-1"
                      )}>
                        {entry.description}
                      </p>

                      {!compact && (
                        <p className="text-[10px] text-white/30 mt-1">
                          {format(parseISO(entry.date), "EEE, MMM d")}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                          {onEditEntry && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditEntry(entry);
                              }}
                              className="text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
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
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
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
                    {isExpanded && !compact && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
                          {/* Full Description */}
                          <div className="p-3 rounded-lg bg-white/[0.02]">
                            <p className="text-sm text-white/70 whitespace-pre-wrap">
                              {entry.description}
                            </p>
                          </div>

                          {/* Tags */}
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {entry.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-xs px-2 py-1 rounded-md bg-white/[0.05] text-white/50"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Meta */}
                          <div className="flex items-center justify-between text-[10px] text-white/30">
                            <span>Created {format(parseISO(entry.created_at), "MMM d, h:mm a")}</span>
                            {entry.project && (
                              <span>Project: {entry.project.name}</span>
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
    </div>
  );
};

export default TimeEntryList;
