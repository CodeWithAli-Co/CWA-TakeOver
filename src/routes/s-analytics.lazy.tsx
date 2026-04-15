/**
 * s-analytics.lazy.tsx — Simplicity Analytics & Surveys
 * View user feedback and survey data with filtering and analysis.
 */

import { useState } from "react";
import { createLazyFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/shadcnComponents/badge";
import {
  BarChart3,
  Search,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Lightbulb,
  MessageSquare,
  HelpCircle,
} from "lucide-react";
import { useSimplicityFeedbacks } from "@/MyComponents/Simplicity/api/simplicityQueries";

// ── Feedback type badge styling ──
const feedbackBadgeStyles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  bug: {
    bg: "bg-red-500/[0.08]",
    text: "text-red-400",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  feature: {
    bg: "bg-purple-500/[0.08]",
    text: "text-purple-400",
    icon: <Lightbulb className="h-3.5 w-3.5" />,
  },
  feedback: {
    bg: "bg-primary/[0.08]",
    text: "text-primary",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
  other: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: <HelpCircle className="h-3.5 w-3.5" />,
  },
};

const getFeedbackStyle = (type: string) =>
  feedbackBadgeStyles[type] ||
  feedbackBadgeStyles["other"];

// ── Main Analytics Page ──────────────────────────────────────────────
function SimplicityAnalyticsPage() {
  const { data: feedbacks = [], isLoading, isError } = useSimplicityFeedbacks();
  const [activeTab, setActiveTab] = useState<"feedback" | "surveys">(
    "feedback"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"date" | "type">("date");
  const [sortAsc, setSortAsc] = useState(false);

  // Filter feedback
  const filtered = feedbacks
    .filter((f) => {
      if (typeFilter !== "all" && f.type !== typeFilter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        f.message?.toLowerCase().includes(q) ||
        f.user_email?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortField === "date") {
        const aDate = new Date(a.id).getTime();
        const bDate = new Date(b.id).getTime();
        return sortAsc ? aDate - bDate : bDate - aDate;
      } else {
        const aType = (a.type || "other").toLowerCase();
        const bType = (b.type || "other").toLowerCase();
        return sortAsc ? aType.localeCompare(bType) : bType.localeCompare(aType);
      }
    });

  // Metrics
  const totalFeedback = feedbacks.length;
  const bugCount = feedbacks.filter((f) => f.type === "bug").length;
  const featureCount = feedbacks.filter((f) => f.type === "feature").length;
  const generalCount = feedbacks.filter((f) =>
    ["feedback", "other"].includes(f.type)
  ).length;

  const toggleSort = (field: "date" | "type") => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ field }: { field: "date" | "type" }) => {
    if (sortField !== field) return null;
    return sortAsc ? (
      <ChevronUp className="h-3 w-3 text-muted-foreground" />
    ) : (
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
    );
  };

  if (isError) {
    return (
      <div className="min-h-screen bg-background p-6 transition-colors duration-500 flex items-center justify-center">
        <div className="text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Error Loading Analytics
          </h2>
          <p className="text-sm text-muted-foreground">
            Could not fetch feedback data from Simplicity
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 transition-colors duration-500">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-sm bg-primary/[0.08] border border-primary/15">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Analytics & Feedback
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                User insights, surveys, and feedback
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search feedback..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 w-80 bg-card border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/30 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="mb-6">
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <div className="flex divide-x divide-border">
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Total Feedback
              </span>
              <p className="text-xl font-bold text-foreground tracking-tight mt-1">
                {totalFeedback}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Bugs Reported
              </span>
              <p className="text-xl font-bold text-red-400 tracking-tight mt-1">
                {bugCount}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                Feature Requests
              </span>
              <p className="text-xl font-bold text-purple-400 tracking-tight mt-1">
                {featureCount}
              </p>
            </div>
            <div className="px-5 py-3.5 flex-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.12em]">
                General
              </span>
              <p className="text-xl font-bold text-primary tracking-tight mt-1">
                {generalCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab("feedback")}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "feedback"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Feedback
        </button>
        <button
          onClick={() => setActiveTab("surveys")}
          className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "surveys"
              ? "text-foreground border-primary"
              : "text-muted-foreground border-transparent hover:text-foreground"
          }`}
        >
          Survey Results
        </button>
      </div>

      {/* Content */}
      {activeTab === "feedback" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            {["all", "bug", "feature", "feedback", "other"].map((type) => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-colors ${
                  typeFilter === type
                    ? "bg-primary text-background"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {type === "all"
                  ? "All Types"
                  : type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>

          {/* Feedback Table */}
          <div className="bg-card border border-border rounded-sm overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_1.5fr_3fr_1fr] gap-4 px-6 py-3.5 border-b border-border">
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
                User
              </span>
              <button
                onClick={() => toggleSort("type")}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-left"
              >
                Type <SortIcon field="type" />
              </button>
              <span className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium">
                Message
              </span>
              <button
                onClick={() => toggleSort("date")}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-medium hover:text-foreground transition-colors text-right"
              >
                Date <SortIcon field="date" />
              </button>
            </div>

            {/* Table body */}
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No feedback found
                </p>
              </div>
            ) : (
              <div>
                {filtered.map((feedback, i) => {
                  const style = getFeedbackStyle(feedback.type);
                  return (
                    <motion.div
                      key={feedback.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="grid grid-cols-[2fr_1.5fr_3fr_1fr] gap-4 items-start px-6 py-3.5 border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      {/* User */}
                      <span className="text-sm text-foreground/80 truncate">
                        {feedback.user_email || "Anonymous"}
                      </span>

                      {/* Type */}
                      <div className="flex items-center gap-2">
                        <div className={`${style.bg} p-1.5 rounded-sm`}>
                          <span className={`${style.text}`}>
                            {style.icon}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px] rounded-sm"
                        >
                          {feedback.type || "Other"}
                        </Badge>
                      </div>

                      {/* Message */}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {feedback.message || "—"}
                      </p>

                      {/* Date */}
                      <span className="text-xs text-muted-foreground text-right">
                        {feedback.created_at
                          ? new Date(feedback.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/10">
                <span className="text-[11px] text-muted-foreground">
                  {filtered.length} of {feedbacks.length} feedback items
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "surveys" && (
        <div className="bg-card border border-border rounded-sm p-12 text-center">
          <HelpCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground mb-1">
            Survey Results
          </h3>
          <p className="text-sm text-muted-foreground">
            Survey data will be displayed here once surveys are integrated.
          </p>
        </div>
      )}
    </div>
  );
}

export const Route = createLazyFileRoute("/s-analytics")({
  component: SimplicityAnalyticsPage,
});
