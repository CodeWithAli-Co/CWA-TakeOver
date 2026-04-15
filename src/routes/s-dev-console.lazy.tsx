/**
 * s-dev-console.lazy.tsx — Simplicity Dev Console
 * Database browser and debugging tools for Simplicity Supabase.
 */

import { useState, useMemo } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Database,
  Search,
  ChevronRight,
  Copy,
  ChevronDown,
  ChevronUp,
  Code,
  MoreVertical,
} from "lucide-react";
import { simplicitySupabase } from "@/MyComponents/Simplicity/api/simplicityClient";

// ── Known Simplicity Tables ──────────────────────────────────────────
const KNOWN_TABLES = [
  "users",
  "expenses",
  "subscriptions",
  "income_source",
  "bank_accs",
  "cashflow",
  "financial_details",
  "user_feedbacks",
] as const;

// ── JSON Preview Component ──────────────────────────────────────────
interface JSONPreviewProps {
  data: any;
  expanded?: boolean;
  onToggle?: () => void;
}

function JSONPreview({ data, expanded = false, onToggle }: JSONPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(expanded);
  const jsonStr = JSON.stringify(data, null, 2);
  const isTruncated = jsonStr.length > 200;

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  return (
    <div className="font-mono text-xs text-muted-foreground bg-background/50 rounded-sm p-2 border border-border/30 hover:border-border/60 transition-colors group relative">
      {isTruncated && (
        <button
          onClick={toggleExpand}
          className="absolute right-2 top-2 p-1 rounded hover:bg-muted/50 transition-colors opacity-0 group-hover:opacity-100"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      )}
      <pre className={`whitespace-pre-wrap break-words ${isExpanded ? "" : "line-clamp-3"}`}>
        {isExpanded
          ? jsonStr
          : jsonStr.slice(0, 150) + (isTruncated ? "..." : "")}
      </pre>
    </div>
  );
}

// ── Main Dev Console Page ────────────────────────────────────────────
function SimplicityDevConsolePage() {
  const [activeTab, setActiveTab] = useState<"tables" | "cache">("tables");
  const [selectedTable, setSelectedTable] = useState<(typeof KNOWN_TABLES)[number] | null>(null);
  const [tableData, setTableData] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(0);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const loadTable = async (table: (typeof KNOWN_TABLES)[number]) => {
    setIsLoading(true);
    setError(null);
    setTableData(null);
    setCurrentPage(0);
    setExpandedRows(new Set());

    try {
      const { data, error: err } = await simplicitySupabase
        .from(table)
        .select("*")
        .limit(1000);

      if (err) throw err;
      setTableData(data || []);
      setSelectedTable(table);
    } catch (e: any) {
      setError(e.message || "Failed to load table");
    } finally {
      setIsLoading(false);
    }
  };

  // Filter data
  const filtered = useMemo(() => {
    if (!tableData) return [];
    if (!searchQuery) return tableData;

    const q = searchQuery.toLowerCase();
    return tableData.filter((row) =>
      Object.values(row).some((val) =>
        val?.toString().toLowerCase().includes(q)
      )
    );
  }, [tableData, searchQuery]);

  // Paginate
  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginatedData = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize
  );

  const toggleRowExpand = (rowIndex: number) => {
    const newSet = new Set(expandedRows);
    if (newSet.has(rowIndex)) {
      newSet.delete(rowIndex);
    } else {
      newSet.add(rowIndex);
    }
    setExpandedRows(newSet);
  };

  // Get column headers from first row
  const columns = useMemo(() => {
    if (paginatedData.length === 0) return [];
    return Object.keys(paginatedData[0]);
  }, [paginatedData]);

  return (
    <div className="min-h-screen bg-background p-6 transition-colors duration-500">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Dev Console
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                Database browser and debugging tools
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("tables")}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "tables"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Tables
        </button>
        <button
          onClick={() => setActiveTab("cache")}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "cache"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Cache Inspector
        </button>
      </div>

      {/* Content */}
      {activeTab === "tables" && (
        <div className="grid grid-cols-4 gap-6">
          {/* Tables Sidebar */}
          <div className="col-span-1">
            <div className="bg-card border border-border rounded-sm overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-xs text-muted-foreground uppercase tracking-[0.12em] font-medium">
                  Tables
                </h3>
              </div>
              <div className="divide-y divide-border/50">
                {KNOWN_TABLES.map((table) => (
                  <motion.button
                    key={table}
                    onClick={() => loadTable(table)}
                    whileHover={{ x: 4 }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedTable === table
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{table}</span>
                      {selectedTable === table && (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {/* Data View */}
          <div className="col-span-3 space-y-4">
            {selectedTable ? (
              <>
                {/* Search & Controls */}
                <div className="flex gap-3 items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <input
                      type="text"
                      placeholder="Search rows..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(0);
                      }}
                      className="pl-9 pr-4 py-2 w-full bg-card border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
                    />
                  </div>

                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(0);
                    }}
                    className="px-3 py-2 bg-card border border-border rounded-sm text-sm text-foreground focus:outline-none focus:border-primary/30"
                  >
                    <option value={5}>5 rows</option>
                    <option value={10}>10 rows</option>
                    <option value={25}>25 rows</option>
                    <option value={50}>50 rows</option>
                  </select>
                </div>

                {/* Table */}
                <div className="bg-card border border-border rounded-sm overflow-hidden">
                  {isLoading && (
                    <div className="p-12 text-center">
                      <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                    </div>
                  )}

                  {error && (
                    <div className="p-6 text-center">
                      <Code className="h-8 w-8 text-red-400/30 mx-auto mb-2" />
                      <p className="text-sm text-red-400/70">{error}</p>
                    </div>
                  )}

                  {!isLoading && !error && tableData && (
                    <>
                      {/* Info Bar */}
                      <div className="px-6 py-3 border-b border-border/50 bg-muted/20 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {filtered.length} rows
                          {filtered.length !== tableData.length &&
                            ` (filtered from ${tableData.length})`}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {columns.length} columns
                        </span>
                      </div>

                      {/* Rows */}
                      {paginatedData.length === 0 ? (
                        <div className="p-12 text-center">
                          <Database className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">
                            No data found
                          </p>
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {paginatedData.map((row, rowIdx) => (
                            <motion.div
                              key={rowIdx}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="p-4 space-y-2 hover:bg-muted/20 transition-colors"
                            >
                              {/* Row Header */}
                              <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                <div className="text-xs text-muted-foreground font-mono">
                                  Row {currentPage * pageSize + rowIdx + 1}
                                </div>
                                <button
                                  onClick={() => toggleRowExpand(rowIdx)}
                                  className="p-1 rounded hover:bg-muted/50 transition-colors"
                                >
                                  {expandedRows.has(rowIdx) ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </button>
                              </div>

                              {/* Row Data */}
                              {expandedRows.has(rowIdx) && (
                                <div className="space-y-2 mt-3 pt-3 border-t border-border/30">
                                  {columns.map((col) => (
                                    <div key={col} className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-[0.08em] font-medium">
                                          {col}
                                        </span>
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(
                                              JSON.stringify(row[col])
                                            );
                                          }}
                                          className="p-0.5 hover:bg-muted/50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                          title="Copy"
                                        >
                                          <Copy className="h-3 w-3 text-muted-foreground/50" />
                                        </button>
                                      </div>
                                      {typeof row[col] === "object" ? (
                                        <JSONPreview data={row[col]} />
                                      ) : (
                                        <div className="font-mono text-xs text-muted-foreground bg-background/50 rounded-sm p-2 border border-border/30 break-words">
                                          {String(row[col])}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between bg-muted/10">
                          <button
                            onClick={() =>
                              setCurrentPage(Math.max(0, currentPage - 1))
                            }
                            disabled={currentPage === 0}
                            className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Previous
                          </button>
                          <span className="text-[11px] text-muted-foreground">
                            Page {currentPage + 1} of {totalPages}
                          </span>
                          <button
                            onClick={() =>
                              setCurrentPage(
                                Math.min(totalPages - 1, currentPage + 1)
                              )
                            }
                            disabled={currentPage === totalPages - 1}
                            className="px-3 py-1 text-xs rounded bg-muted hover:bg-muted/70 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-card border border-border rounded-sm p-12 text-center">
                <Database className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Select a Table
                </h3>
                <p className="text-sm text-muted-foreground">
                  Choose a table from the left sidebar to view data
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "cache" && (
        <div className="bg-card border border-border rounded-sm p-12 text-center">
          <Code className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Cache Inspector
          </h3>
          <p className="text-sm text-muted-foreground">
            Redis cache integration coming soon. This will show cached queries
            and allow manual cache invalidation.
          </p>
        </div>
      )}
    </div>
  );
}

export const Route = createLazyFileRoute("/s-dev-console")({
  component: SimplicityDevConsolePage,
});
