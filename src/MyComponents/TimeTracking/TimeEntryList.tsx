// TimeEntryList - Date-grouped entry list with daily summary rollups.
//
// Originally rendered every entry as a flat tile, which got
// overwhelming once you had more than a day or two of data. New
// shape: groups by date, shows a daily summary header (total hours,
// entry count, company-mix dots, billable badge), and lets each day
// collapse independently. Today + yesterday default to expanded;
// older days default to collapsed so you don't see 30 cards on first
// load.
import { useMemo, useState } from "react";
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
  type TimeEntryWithRelations,
  type TimeEntryFilters,
  formatDuration,
  getCategoryColors,
} from "@/stores/timeTrackingTypes";
import {
  useTimeEntries,
  useDeleteTimeEntry,
  useCompanies,
} from "@/stores/timeTrackingQueries";

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
  // Per-date collapsed state. Populated lazily as the user toggles.
  // Default: today + yesterday expanded, everything else collapsed.
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());

  const { data: entries } = useTimeEntries(filters);
  const { data: companies } = useCompanies(); // live UUIDs, replaces hardcoded COMPANIES
  const deleteMutation = useDeleteTimeEntry();

  const displayEntries = maxEntries ? entries.slice(0, maxEntries) : entries;

  // ── Group entries by date — the consolidation core ──
  // In compact mode (used inside dashboard cards) we skip grouping
  // and render a flat list so it doesn't double-nest.
  const grouped = useMemo(() => {
    if (compact) return null;
    const map = new Map<string, TimeEntryWithRelations[]>();
    for (const e of displayEntries) {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    }
    // Most-recent date first; entries within a day ordered by start_time descending.
    const dates = [...map.keys()].sort((a, b) => (a < b ? 1 : -1));
    return dates.map((date) => ({
      date,
      entries: (map.get(date) ?? []).sort((a, b) => (a.start_time < b.start_time ? 1 : -1)),
    }));
  }, [displayEntries, compact]);

  const isDateCollapsed = (date: string): boolean => {
    if (collapsedDates.has(date)) return true;
    // Default: only today + yesterday are expanded.
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
    return date !== today && date !== yesterday && !collapsedDates.has(`!${date}`);
  };

  const toggleDate = (date: string) => {
    setCollapsedDates((prev) => {
      const next = new Set(prev);
      // Two markers: "<date>" = explicitly collapsed; "!<date>" = explicitly expanded.
      // Default behavior (today+yesterday expanded, rest collapsed) only applies
      // if neither marker is set for the date.
      if (next.has(date)) {
        next.delete(date);
        next.add(`!${date}`);
      } else if (next.has(`!${date}`)) {
        next.delete(`!${date}`);
      } else {
        const today = format(new Date(), "yyyy-MM-dd");
        const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
        const isDefaultExpanded = date === today || date === yesterday;
        if (isDefaultExpanded) next.add(date);
        else next.add(`!${date}`);
      }
      return next;
    });
  };

  const lookupCompany = (companyId: string) => companies.find((c) => c.id === companyId);

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
    "px-3 py-2 rounded-lg text-sm text-foreground placeholder:text-muted-foreground",
    "bg-muted/40 border border-border",
    "focus:border-white/20 focus:outline-none transition-all"
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground/70 uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Entries
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-muted-foreground/80">
            {displayEntries.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {totalMinutes > 0 && (
            <span className="text-sm text-muted-foreground/80">
              Total: <span className="text-foreground font-medium">{formatDuration(totalMinutes)}</span>
            </span>
          )}
          {showFilters && (
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all",
                showFilterPanel || hasActiveFilters
                  ? "bg-white/10 text-white"
                  : "text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.05]"
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
            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* Search */}
                <div className="col-span-2 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search..."
                    className={cn(inputStyles, "w-full pl-9")}
                    value={filters.search || ""}
                    onChange={(e) => handleFilterChange("search", e.target.value)}
                  />
                </div>

                {/* Company — live data, real UUIDs (no more hardcoded constant) */}
                <select
                  className={cn(inputStyles, "w-full appearance-none cursor-pointer [&>option]:bg-zinc-900")}
                  value={filters.company_id || ""}
                  onChange={(e) => handleFilterChange("company_id", e.target.value)}
                >
                  <option value="">All Companies</option>
                  {companies.map((c) => (
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
                  className="flex items-center gap-1.5 text-xs text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries List — date-grouped in default mode, flat in compact (dashboard card) mode */}
      <div className={cn("space-y-2", !compact && "max-h-[500px] overflow-y-auto pr-1")}>
        {displayEntries.length === 0 ? (
          <div className="py-12 text-center">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">No entries yet</p>
          </div>
        ) : compact ? (
          // ── Compact mode: flat list (used inside dashboard "Recent Entries" card) ──
          displayEntries.map((entry, index) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              index={index}
              isExpanded={expandedEntry === entry.id}
              onToggle={() => !compact && setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
              onEdit={onEditEntry}
              onDelete={handleDelete}
              compact={compact}
              lookupCompany={lookupCompany}
            />
          ))
        ) : (
          // ── Default mode: grouped by date, daily summary header + collapsible body ──
          grouped?.map((group, gIdx) => {
            const dailyTotal = group.entries.reduce((s, e) => s + e.duration_minutes, 0);
            const billable = group.entries.reduce((s, e) => s + (e.is_billable ? e.duration_minutes : 0), 0);
            // De-dupe colors for the company-mix dots
            const companyColors = [
              ...new Set(
                group.entries
                  .map((e) => lookupCompany(e.company_id)?.color)
                  .filter((c): c is string => Boolean(c)),
              ),
            ];
            const collapsed = isDateCollapsed(group.date);
            const parsedDate = parseISO(group.date);
            const today = format(new Date(), "yyyy-MM-dd");
            const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");
            const friendlyDate =
              group.date === today     ? "Today"     :
              group.date === yesterday ? "Yesterday" :
                                         format(parsedDate, "EEEE");

            return (
              <motion.div
                key={group.date}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gIdx * 0.02 }}
                className="rounded-xl border border-border bg-white/[0.01] overflow-hidden"
              >
                {/* ── Daily summary header (click to toggle) ── */}
                <button
                  onClick={() => toggleDate(group.date)}
                  className="w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                        collapsed && "-rotate-90"
                      )}
                    />
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-[15px] font-bold text-foreground tracking-tight">
                          {friendlyDate}
                        </span>
                        <span className="text-[11.5px] text-muted-foreground tabular-nums">
                          {format(parsedDate, "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {group.entries.length} {group.entries.length === 1 ? "entry" : "entries"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Company-mix dots */}
                    {companyColors.length > 0 && (
                      <div className="flex items-center -space-x-1.5">
                        {companyColors.slice(0, 4).map((color) => (
                          <span
                            key={color}
                            className="h-2.5 w-2.5 rounded-full border-2 border-background"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                    {/* Billable indicator */}
                    {billable > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-emerald-300 font-semibold uppercase tracking-wide">
                        <DollarSign className="h-3 w-3" />
                        {formatDuration(billable)}
                      </span>
                    )}
                    {/* Daily total — the headline number */}
                    <span className="text-[16px] font-bold text-foreground tabular-nums">
                      {formatDuration(dailyTotal)}
                    </span>
                  </div>
                </button>

                {/* ── Per-entry rows (collapsible) ── */}
                <AnimatePresence initial={false}>
                  {!collapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div className="p-2 space-y-1.5">
                        {group.entries.map((entry, idx) => (
                          <EntryRow
                            key={entry.id}
                            entry={entry}
                            index={idx}
                            isExpanded={expandedEntry === entry.id}
                            onToggle={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                            onEdit={onEditEntry}
                            onDelete={handleDelete}
                            compact={false}
                            lookupCompany={lookupCompany}
                            hideDate
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── Sub-component: single entry row ───────────────────────────────
// Used both for the flat compact list and for entries inside a date group.
interface EntryRowProps {
  entry: TimeEntryWithRelations;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit?: (entry: TimeEntryWithRelations) => void;
  onDelete: (id: string) => void;
  compact: boolean;
  hideDate?: boolean;
  lookupCompany: (id: string) => { name: string; color: string } | undefined;
}

function EntryRow({
  entry,
  index,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  compact,
  hideDate,
  lookupCompany,
}: EntryRowProps) {
  const company = lookupCompany(entry.company_id);
  const categoryColor = getCategoryColors(entry.category);
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="group"
    >
      <div
        onClick={() => !compact && onToggle()}
        className={cn(
          "p-3 rounded-lg border transition-all duration-200",
          "bg-white/[0.01] border-border/60",
          "hover:bg-muted/40 hover:border-white/[0.1]",
          !compact && "cursor-pointer",
          isExpanded && "bg-muted/40 border-white/[0.1]"
        )}
      >
        <div className="flex items-center gap-4">
          {/* Duration */}
          <div className="min-w-[70px]">
            <p className="text-[15px] font-semibold text-white tabular-nums">
              {formatDuration(entry.duration_minutes)}
            </p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider tabular-nums">
              {format(parseISO(entry.start_time), "HH:mm")} - {format(parseISO(entry.end_time), "HH:mm")}
            </p>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-white/[0.06]" />

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span
                className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${company?.color}15`,
                  color: company?.color,
                }}
              >
                {company?.name || "Unknown"}
              </span>
              <span
                className={cn(
                  "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md",
                  categoryColor.bg,
                  categoryColor.text
                )}
              >
                {entry.category}
              </span>
              {entry.is_billable && <DollarSign className="h-3.5 w-3.5 text-emerald-400" />}
              {entry.is_verified && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
            </div>

            <p
              className={cn(
                "text-[13px] text-foreground/80",
                !isExpanded && "line-clamp-1"
              )}
            >
              {entry.description}
            </p>

            {!compact && !hideDate && (
              <p className="text-[10px] text-muted-foreground mt-1">
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
                  className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-zinc-900/95 backdrop-blur-xl border-white/10">
                {onEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(entry);
                    }}
                    className="text-foreground/70 hover:text-foreground hover:bg-white/10 cursor-pointer"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(entry.id);
                  }}
                  className="text-primary hover:text-red-300 hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Expanded entry-level details */}
        <AnimatePresence>
          {isExpanded && !compact && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-border space-y-3">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[12.5px] text-foreground/70 whitespace-pre-wrap">
                    {entry.description}
                  </p>
                </div>
                {entry.tags && entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 rounded-md bg-white/[0.05] text-muted-foreground/80"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Created {format(parseISO(entry.created_at), "MMM d, h:mm a")}</span>
                  {entry.project && <span>Project: {entry.project.name}</span>}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default TimeEntryList;
