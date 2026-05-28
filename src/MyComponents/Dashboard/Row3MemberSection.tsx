/**
 * Row3MemberSection.tsx — Row 3 for non-leadership employees.
 *
 * Deliberately a different shape than the CEO/COO Strategic Intelligence
 * panel. This is not a watered-down exec view — it's purpose-built for
 * what an individual contributor actually needs at a glance:
 *
 *   · Team Activity (col-span-8) — what teammates are shipping, editing,
 *                                  and meeting about. Real data merged
 *                                  from tasks (done), workspace edits,
 *                                  and recent meetings. Helps members
 *                                  stay connected without scrolling
 *                                  three separate surfaces.
 *
 *   · Quick Actions (col-span-4) — one-click access to the actions
 *                                  members take most often: clock in,
 *                                  open schedule, jump to chat, start
 *                                  a workspace doc, file a bug report.
 *
 * No tabs. No mocked aspirational metrics. Just two focused panels.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Bug,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileEdit,
  FilePlus2,
  MessageSquare,
} from "lucide-react";
import { BentoCard } from "./BentoCard";
import { AllTodos, MeetingsQuery } from "@/stores/query";
import { useWorkspaceResources } from "@/stores/workspace";

type Tone = "primary" | "warning" | "destructive" | "success" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
  neutral: "text-text-tertiary",
};

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─────────────────────────────────────────────────────────────────
// Main export — renders the two member panels side-by-side as
// direct grid children of the dashboard grid (col-span-8 + col-span-4).
// ─────────────────────────────────────────────────────────────────

export function Row3MemberSection() {
  return (
    <>
      <ActivityFeed />
      <QuickActions />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Activity Feed — merges task ships, workspace edits, and recent
// meetings into a single time-ordered stream.
// ─────────────────────────────────────────────────────────────────

function ActivityFeed() {
  const navigate = useNavigate();
  const { data: all = [] } = AllTodos();
  const { data: items = [] } = useWorkspaceResources();
  const { data: meetings = [] } = MeetingsQuery();

  const feed = useMemo(() => {
    type Event = {
      key: string;
      ts: number;
      icon: typeof Activity;
      tone: Tone;
      actor?: string;
      verb: string;
      subject: string;
      onClick: () => void;
    };
    const events: Event[] = [];
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;

    // Task completions in the last 14 days
    for (const t of all) {
      if (t.status === "done" && t.created_at) {
        const ts = new Date(t.created_at).getTime();
        if (ts > cutoff) {
          events.push({
            key: `task-${t.todo_id}`,
            ts,
            icon: CheckCircle2,
            tone: "success",
            actor: t.assignee?.[0],
            verb: "shipped",
            subject: t.title,
            onClick: () => navigate({ to: "/task" }),
          });
        }
      }
    }

    // Workspace edits in the last 14 days
    for (const r of items as any[]) {
      if (!r.updated_at) continue;
      const ts = new Date(r.updated_at).getTime();
      if (ts > cutoff) {
        events.push({
          key: `ws-${r.kind}-${r.id}`,
          ts,
          icon: FileEdit,
          tone: "primary",
          actor: r.updated_by || r.owner,
          verb: r.kind === "document" ? "edited doc" : "edited sheet",
          subject: r.title || "Untitled",
          onClick: () => navigate({ to: "/workspace" }),
        });
      }
    }

    // Meetings that happened in the last 14 days (past, not future)
    for (const m of (meetings ?? []) as any[]) {
      if (!m.date) continue;
      const ts = new Date(m.date).getTime();
      if (ts > cutoff && ts < Date.now()) {
        events.push({
          key: `mtg-${m.meeting_id ?? m.meeting_title}`,
          ts,
          icon: CalendarClock,
          tone: "warning",
          verb: "meeting wrapped",
          subject: m.meeting_title ?? "Untitled meeting",
          onClick: () => navigate({ to: "/schedule" }),
        });
      }
    }

    return events.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [all, items, meetings, navigate]);

  return (
    <BentoCard span="col-span-8" delay={0.35} noPadding>
      <header className="flex items-center justify-between gap-3 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
            Team Activity
          </span>
          <span className="text-[10px] font-semibold tabular-nums text-text-tertiary/60">
            last 14 days
          </span>
        </div>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-text-tertiary/70">
          {feed.length} {feed.length === 1 ? "event" : "events"}
        </span>
      </header>

      <div className="p-3">
        {feed.length === 0 ? (
          <div className="text-[12px] text-text-tertiary italic py-8 text-center">
            No activity in the last 14 days. The team's been quiet.
          </div>
        ) : (
          <ul className="list-none p-0 m-0 space-y-0.5">
            {feed.map((e) => (
              <li key={e.key} className="list-none">
                <button
                  type="button"
                  onClick={e.onClick}
                  className="group/row w-full text-left flex items-center gap-2.5 px-2 py-1.5 -mx-1 rounded-md hover:bg-foreground/[0.05] transition-colors"
                >
                  <e.icon className={`h-3 w-3 flex-shrink-0 ${TONE_TEXT[e.tone]}`} />
                  <span className="text-[12px] text-foreground flex-1 truncate">
                    {e.actor ? (
                      <>
                        <span className="font-semibold">{e.actor}</span>{" "}
                        {e.verb}{" "}
                        <span className="text-foreground/85">{e.subject}</span>
                      </>
                    ) : (
                      <>
                        <span className="text-foreground/75">{e.verb}:</span>{" "}
                        {e.subject}
                      </>
                    )}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider tabular-nums text-text-tertiary flex-shrink-0">
                    {relTime(new Date(e.ts).toISOString())}
                  </span>
                  <ChevronRight className="h-3 w-3 text-text-tertiary opacity-0 group-hover/row:opacity-100 transition-opacity flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </BentoCard>
  );
}

// ─────────────────────────────────────────────────────────────────
// Quick Actions — 2×3 grid of common one-click jumps.
// ─────────────────────────────────────────────────────────────────

function QuickActions() {
  const navigate = useNavigate();

  // Six common actions. Tone is purely visual — each icon picks up
  // the same semantic color it carries everywhere else in the app
  // (Clock=success, Calendar=warning, Chat=primary, etc.).
  const actions: {
    label: string;
    icon: typeof Activity;
    tone: Tone;
    onClick: () => void;
  }[] = [
    {
      label: "Clock in/out",
      icon: Clock,
      tone: "success",
      onClick: () => navigate({ to: "/timesheet" as any }),
    },
    {
      label: "Schedule",
      icon: CalendarPlus,
      tone: "warning",
      onClick: () => navigate({ to: "/schedule" as any }),
    },
    {
      label: "New message",
      icon: MessageSquare,
      tone: "primary",
      onClick: () => navigate({ to: "/chat" as any }),
    },
    {
      label: "Workspace",
      icon: FilePlus2,
      tone: "primary",
      onClick: () => navigate({ to: "/workspace" as any }),
    },
    {
      label: "Report bug",
      icon: Bug,
      tone: "destructive",
      onClick: () => navigate({ to: "/reports/submit" as any }),
    },
    {
      label: "Tasks",
      icon: CheckCircle2,
      tone: "success",
      onClick: () => navigate({ to: "/task" as any }),
    },
  ];

  return (
    <BentoCard span="col-span-4" delay={0.4} noPadding>
      <header className="flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-xs border-border-soft">
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-tertiary">
          Quick Actions
        </span>
        <span className="text-[9.5px] uppercase tracking-[0.18em] text-text-tertiary/70 ml-auto">
          one click
        </span>
      </header>

      <div className="p-3 grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <motion.button
            key={a.label}
            type="button"
            onClick={a.onClick}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="group/qa flex flex-col items-center justify-center gap-1.5 rounded-lg bg-foreground/[0.025] border-xs border-border-soft px-2 py-3 hover:bg-foreground/[0.05] hover:border-foreground/15 transition-colors"
          >
            <a.icon
              className={`h-4 w-4 ${TONE_TEXT[a.tone]} group-hover/qa:scale-110 transition-transform`}
            />
            <span className="text-[10.5px] text-foreground font-semibold text-center leading-tight">
              {a.label}
            </span>
          </motion.button>
        ))}
      </div>
    </BentoCard>
  );
}
