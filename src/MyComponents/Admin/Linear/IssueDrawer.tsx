/**
 * IssueDrawer.tsx — Right-side slide-in detail view for a single
 * Linear issue. Same pattern as Vercel's DeploymentDrawer.
 *
 * Surfaces:
 *   · Hero: identifier + state badge + priority + title
 *   · Description (markdown rendered as plain text for now)
 *   · Meta grid: assignee, team, cycle, project, due date, comments
 *   · Labels chips
 *   · Action row: Open in Linear (click-out)
 *
 * Esc + backdrop click close.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ExternalLink,
  User,
  Box,
  Calendar,
  Hash,
  MessageSquare,
  Folder,
} from "lucide-react";
import type { LinearIssue } from "@/lib/linear";

interface Props {
  issue: LinearIssue | null;
  onClose: () => void;
}

export function IssueDrawer({ issue, onClose }: Props) {
  useEffect(() => {
    if (!issue) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [issue, onClose]);

  return (
    <AnimatePresence>
      {issue && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40"
          />
          <motion.aside
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[500px] bg-card border-l border-border shadow-2xl overflow-y-auto"
          >
            <DrawerHeader issue={issue} onClose={onClose} />
            <DrawerBody issue={issue} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerHeader({
  issue,
  onClose,
}: {
  issue: LinearIssue;
  onClose: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border-soft px-5 py-4 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-text-tertiary">
            {issue.identifier}
          </span>
          <StateBadge issue={issue} />
          <PriorityBadge priority={issue.priority} label={issue.priorityLabel} />
        </div>
        <h2 className="text-[15px] font-bold text-foreground leading-tight">
          {issue.title}
        </h2>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-foreground/[0.06] text-text-tertiary hover:text-foreground transition-colors"
        aria-label="Close drawer"
      >
        <X size={14} />
      </button>
    </header>
  );
}

function DrawerBody({ issue }: { issue: LinearIssue }) {
  const labels = issue.labels?.nodes ?? [];
  const commentCount = issue.comments?.nodes?.length ?? 0;

  return (
    <div className="p-5 space-y-5">
      {issue.description && (
        <Section title="Description">
          <p className="text-[12.5px] text-foreground/85 whitespace-pre-wrap leading-relaxed">
            {issue.description}
          </p>
        </Section>
      )}

      <Section title="Details">
        <dl className="space-y-2 text-[12px]">
          {issue.assignee && (
            <Stat icon={User} label="Assignee" value={issue.assignee.name} />
          )}
          <Stat
            icon={Box}
            label="Team"
            value={`${issue.team.name} (${issue.team.key})`}
          />
          {issue.cycle && (
            <Stat
              icon={Hash}
              label="Cycle"
              value={`#${issue.cycle.number}${issue.cycle.name ? ` · ${issue.cycle.name}` : ""}`}
            />
          )}
          {issue.project && (
            <Stat icon={Folder} label="Project" value={issue.project.name} />
          )}
          {issue.dueDate && (
            <Stat
              icon={Calendar}
              label="Due"
              value={new Date(issue.dueDate).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            />
          )}
          {commentCount > 0 && (
            <Stat
              icon={MessageSquare}
              label="Comments"
              value={String(commentCount)}
            />
          )}
        </dl>
      </Section>

      {labels.length > 0 && (
        <Section title="Labels">
          <div className="flex flex-wrap gap-1.5">
            {labels.map((l) => (
              <span
                key={l.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold border"
                style={{
                  backgroundColor: `${l.color}14`,
                  borderColor: `${l.color}26`,
                  color: l.color,
                }}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                {l.name}
              </span>
            ))}
          </div>
        </Section>
      )}

      <div className="border-t border-border-soft pt-4">
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-md border border-border bg-foreground/[0.04] hover:bg-foreground/[0.08] text-[12.5px] font-semibold text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Open in Linear
        </a>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-text-tertiary mb-2">
        {title}
      </p>
      {children}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <dt className="flex items-center gap-1 text-[10px] text-text-tertiary uppercase tracking-[0.12em] font-semibold min-w-[80px]">
        <Icon size={10} />
        {label}
      </dt>
      <dd className="text-[12.5px] text-foreground/95 font-semibold truncate">
        {value}
      </dd>
    </div>
  );
}

function StateBadge({ issue }: { issue: LinearIssue }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-[0.12em] border"
      style={{
        backgroundColor: `${issue.state.color}14`,
        borderColor: `${issue.state.color}26`,
        color: issue.state.color,
      }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: issue.state.color }}
      />
      {issue.state.name}
    </span>
  );
}

function PriorityBadge({
  priority,
  label,
}: {
  priority: number;
  label: string;
}) {
  // Linear priority: 0 = none, 1 = urgent, 2 = high, 3 = medium, 4 = low
  const tone =
    priority === 1
      ? "text-destructive bg-destructive/12 border-destructive/30"
      : priority === 2
      ? "text-warning bg-warning/12 border-warning/30"
      : "text-text-tertiary bg-foreground/[0.05] border-border-soft";
  if (priority === 0) return null;
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-bold uppercase tracking-[0.12em] border ${tone}`}
    >
      {label}
    </span>
  );
}

export default IssueDrawer;
