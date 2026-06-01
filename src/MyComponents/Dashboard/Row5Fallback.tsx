/**
 * Row5Fallback.tsx — alternates for the Communication + Workspace
 * cards when both come back empty.
 *
 * The Comm + Workspace cards are great when there's activity, but
 * a fresh founder demoing the app sees Mentions: 0 / Co-editing: 0 /
 * Recent feedback: 0 — four zeros in a row. So Row5Section now
 * checks if both are empty and falls back to these two widgets:
 *
 *   1. DailySnapshotCard  — "your week so far": completed tasks,
 *                            focused hours, current streak, the
 *                            shape of your activity pattern
 *   2. QuickStartCard     — 6 large tap-to-do buttons for the most
 *                            common workflows (create task, new doc,
 *                            schedule a meeting, start a huddle, open
 *                            command palette, connect a tool)
 *
 * Both are self-contained — no external data hooks required. The
 * Snapshot uses lightweight props for now (later: real metrics from
 * cwa_todos / cwa_time_entries); the Quick Start uses sendPrompt-
 * style callbacks that the parent wires to navigate / open dialogs.
 */

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useDailySnapshot, type DailySnapshot } from "./useDailySnapshot";
import {
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  Plus,
  FileText,
  Calendar,
  Radio,
  Command,
  Plug,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { BentoCard } from "./BentoCard";

// ─────────────────────────────────────────────────────────────────
// Daily Snapshot
// ─────────────────────────────────────────────────────────────────

export function DailySnapshotCard() {
  const { data: snap, isLoading } = useDailySnapshot();

  // Skeleton while loading — same skeleton-only treatment so layout
  // doesn't shift when data arrives.
  if (isLoading || !snap) {
    return (
      <BentoCard span="col-span-6" delay={0.5} noPadding>
        <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-xs border-border/15">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
              Daily snapshot
            </span>
          </div>
        </header>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="h-[68px] rounded-xl bg-foreground/[0.04] animate-pulse" />
            <div className="h-[68px] rounded-xl bg-foreground/[0.04] animate-pulse" />
          </div>
          <div className="h-8 rounded-md bg-foreground/[0.04] animate-pulse" />
          <div className="h-16 rounded-md bg-foreground/[0.04] animate-pulse" />
        </div>
      </BentoCard>
    );
  }

  const { thisWeek, deltas } = snap;
  const completedThisWeek = thisWeek.doneCount;
  const hoursFocused = thisWeek.focusedHours;

  // 7 daily activity bars — height normalised against the peak
  // value across both completion + minute streams so empty days
  // never disappear if there's any meaningful activity elsewhere.
  const peakDone = Math.max(1, ...thisWeek.dailyDone);
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = thisWeek.dailyDone.map((n, i) => ({
    d: dayLabels[i]!,
    h: n / peakDone,
  }));

  // Streak — Pass 2 will pull from checkins. For now derive a soft
  // streak from "had at least one completion today"-style daily
  // signal. If today's bucket is non-zero, count contiguous prior
  // days that were also non-zero. Best-effort; explicit in Pass 2.
  const todayIdx = (() => {
    const wd = new Date().getDay();
    return wd === 0 ? 6 : wd - 1;
  })();
  let streak = 0;
  for (let i = todayIdx; i >= 0; i--) {
    if (thisWeek.dailyDone[i]! > 0) streak++;
    else break;
  }

  // Composition strip — total may be 0 (no time tracked); guard.
  const comp = thisWeek.composition;
  const total = Math.max(1, comp.total);
  const deepPct = Math.round((comp.deep / total) * 100);
  const meetingsPct = Math.round((comp.meetings / total) * 100);
  const adminPct = Math.round((comp.admin / total) * 100);

  return (
    <BentoCard span="col-span-6" delay={0.5} noPadding>
      <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-xs border-border/15">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Daily snapshot
          </span>
        </div>
        {streak > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 border border-warning/30 px-2 py-0.5 text-[10px] font-bold tabular-nums text-warning">
            <Flame size={10} strokeWidth={2.6} />
            {streak} day{streak === 1 ? "" : "s"}
          </span>
        )}
      </header>

      <div className="p-4 space-y-3.5">
        {/* ── Hero stats with deltas ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <SnapshotStat
            icon={CheckCircle2}
            label="Done this week"
            value={String(completedThisWeek)}
            sub="tasks"
            tone="text-success"
            delta={deltas.doneVsLastWeek}
            deltaLabel="vs last week"
          />
          <SnapshotStat
            icon={Clock}
            label="Focused"
            value={`${hoursFocused}h`}
            sub="tracked"
            tone="text-primary"
            delta={deltas.focusedVsAvg}
            deltaLabel="vs 4-wk avg"
          />
        </div>

        {/* ── Composition strip ── */}
        {comp.total > 0 ? (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
                Composition
              </span>
              <span className="text-[10px] text-text-tertiary tabular-nums">
                {deepPct}% deep · {meetingsPct}% meet · {adminPct}% admin
              </span>
            </div>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-foreground/[0.05]">
              {comp.deep > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${deepPct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-success/75"
                  title={`Deep: ${(comp.deep / 60).toFixed(1)}h`}
                />
              )}
              {comp.meetings > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${meetingsPct}%` }}
                  transition={{ duration: 0.6, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-warning/80"
                  title={`Meetings: ${(comp.meetings / 60).toFixed(1)}h`}
                />
              )}
              {comp.admin > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${adminPct}%` }}
                  transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-foreground/35"
                  title={`Admin: ${(comp.admin / 60).toFixed(1)}h`}
                />
              )}
            </div>
          </div>
        ) : null}

        {/* ── Weekly activity bars ── */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/80">
              This week
            </span>
            <span className="text-[10px] text-text-tertiary">
              tasks closed per day
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 items-end">
            {days.map((d, i) => (
              <div
                key={d.d}
                className="flex flex-col items-center gap-1"
              >
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(d.h * 48, 3)}px` }}
                  transition={{
                    duration: 0.5,
                    delay: 0.05 * i,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={`w-full rounded-sm ${
                    d.h > 0.6
                      ? "bg-primary/70"
                      : d.h > 0.25
                        ? "bg-primary/40"
                        : d.h > 0
                          ? "bg-primary/20"
                          : "bg-foreground/10"
                  }`}
                  style={{ minHeight: 3 }}
                />
                <span
                  className={`text-[9px] tabular-nums ${
                    i === todayIdx
                      ? "text-foreground font-bold"
                      : "text-text-tertiary"
                  }`}
                >
                  {d.d}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Narrative one-liner (Pass 2 will replace with Axon
         *  synthesis; for now a simple delta-driven template). ── */}
        <NarrativeInsight snap={snap} streak={streak} />
      </div>
    </BentoCard>
  );
}

/**
 * NarrativeInsight — Pass 1 placeholder. Picks a single observation
 * based on the most non-trivial signal and renders one sentence.
 * Pass 2 will hand this off to an Axon synthesis call.
 */
function NarrativeInsight({
  snap,
  streak,
}: {
  snap: DailySnapshot;
  streak: number;
}) {
  const { thisWeek, deltas } = snap;
  const focusDelta = deltas.focusedVsAvg.value;
  const doneDelta = deltas.doneVsLastWeek.value;
  const comp = thisWeek.composition;
  const meetingShare = comp.total > 0 ? comp.meetings / comp.total : 0;

  // Pick the most attention-worthy signal.
  let body: ReactNode;
  if (meetingShare > 0.4 && comp.total > 60) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Meetings ate {Math.round(meetingShare * 100)}% of your week.
        </span>{" "}
        Block a focus window tomorrow morning before they pile up again.
      </>
    );
  } else if (doneDelta >= 5) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Up {doneDelta} tasks vs. last week.
        </span>{" "}
        You're on a hot run — keep the same shape tomorrow.
      </>
    );
  } else if (doneDelta <= -3) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Down {Math.abs(doneDelta)} tasks vs. last week.
        </span>{" "}
        One quick close before EOD evens you out.
      </>
    );
  } else if (focusDelta < -2) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Focus time is {Math.abs(focusDelta).toFixed(1)}h below your 4-week average.
        </span>{" "}
        Worth checking what shifted.
      </>
    );
  } else if (streak >= 3) {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          {streak}-day streak.
        </span>{" "}
        One more close today extends it.
      </>
    );
  } else {
    body = (
      <>
        <span className="text-foreground/85 font-semibold">
          Steady week.
        </span>{" "}
        No alarms, no surprises.
      </>
    );
  }

  return (
    <div className="rounded-lg border border-border-soft bg-foreground/[0.03] px-3 py-2 text-[11px] text-text-tertiary leading-relaxed">
      {body}
    </div>
  );
}

function DeltaPill({
  direction,
  value,
  pct,
  label,
}: {
  direction: "up" | "down" | "flat";
  value: number;
  pct: number;
  label: string;
}) {
  // Color intent: "up" is good for done / focused; "down" is amber
  // for either. v2 can be smarter (e.g. up on meetings is bad).
  const tone =
    direction === "up"
      ? "text-success border-success/30 bg-success/10"
      : direction === "down"
        ? "text-warning border-warning/30 bg-warning/10"
        : "text-text-tertiary border-border-soft bg-foreground/[0.04]";
  const Icon =
    direction === "up" ? ArrowUp : direction === "down" ? ArrowDown : Minus;
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  const display = Number.isInteger(value)
    ? `${sign}${value}`
    : `${sign}${value.toFixed(1)}`;
  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 h-4 rounded-full border text-[9.5px] font-bold tabular-nums ${tone}`}
      title={`${label} (${pct >= 0 ? "+" : ""}${pct}%)`}
    >
      <Icon size={9} strokeWidth={2.8} />
      <span>{display}</span>
    </div>
  );
}

function SnapshotStat({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  delta,
  deltaLabel,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub: string;
  tone: string;
  delta?: { direction: "up" | "down" | "flat"; value: number; pct: number };
  deltaLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-border-soft bg-foreground/[0.03] p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`h-3 w-3 ${tone}`} strokeWidth={2.4} />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[20px] font-bold text-foreground leading-none tabular-nums">
          {value}
        </span>
        <span className="text-[10px] text-text-tertiary">{sub}</span>
        {delta && deltaLabel ? (
          <div className="ml-auto">
            <DeltaPill
              direction={delta.direction}
              value={delta.value}
              pct={delta.pct}
              label={deltaLabel}
            />
          </div>
        ) : null}
      </div>
      {delta && deltaLabel ? (
        <p className="text-[9.5px] text-text-tertiary mt-1">{deltaLabel}</p>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Quick Start — 6 large tap buttons
// ─────────────────────────────────────────────────────────────────

interface QuickAction {
  icon: LucideIcon;
  label: string;
  hint: string;
  /** Either a route to navigate to, or a custom handler. */
  to?: string;
  onClick?: () => void;
  tone?: string;
}

export function QuickStartCard() {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      icon: Plus,
      label: "New task",
      hint: "Quick capture",
      onClick: () => {
        // TODO: wire to the existing AddTodo modal via Cmd+K palette
        // or AddTodo dispatch when the imperative dialog hook lands.
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
        });
        window.dispatchEvent(event);
      },
      tone: "text-primary",
    },
    {
      icon: FileText,
      label: "New doc",
      hint: "Start writing",
      to: "/workspace",
      tone: "text-foreground/80",
    },
    {
      icon: Calendar,
      label: "Schedule meeting",
      hint: "Add to calendar",
      to: "/schedule",
      tone: "text-foreground/80",
    },
    {
      icon: Radio,
      label: "Start huddle",
      hint: "Spin up voice room",
      to: "/chat",
      tone: "text-foreground/80",
    },
    {
      icon: Command,
      label: "Command palette",
      hint: "Cmd+K · jump anywhere",
      onClick: () => {
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
        });
        window.dispatchEvent(event);
      },
      tone: "text-foreground/80",
    },
    {
      icon: Plug,
      label: "Connect a tool",
      hint: "HubSpot, Stripe, Notion…",
      to: "/settings",
      tone: "text-foreground/80",
    },
  ];

  const handleClick = (a: QuickAction) => {
    if (a.onClick) a.onClick();
    else if (a.to) navigate({ to: a.to as any });
  };

  return (
    <BentoCard span="col-span-6" delay={0.55} noPadding>
      <header className="flex items-center justify-between gap-2 px-5 py-3.5 border-b border-xs border-border/15">
        <div className="flex items-center gap-2 min-w-0">
          <Command className="h-3 w-3 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
            Quick start
          </span>
        </div>
        <span className="text-[10px] text-text-tertiary">
          one tap to get going
        </span>
      </header>

      <div className="p-3 grid grid-cols-3 gap-2">
        {actions.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.button
              key={a.label}
              type="button"
              onClick={() => handleClick(a)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: 0.04 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="group rounded-xl border border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.06] hover:border-foreground/25 transition-colors p-3 text-left flex flex-col gap-2 min-h-[88px]"
            >
              <div className="flex items-center justify-between">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center bg-foreground/[0.06] border border-border-soft ${a.tone ?? "text-foreground/80"}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.3} />
                </div>
                <ChevronRight
                  size={12}
                  strokeWidth={2.2}
                  className="text-text-tertiary/0 group-hover:text-text-tertiary transition-colors"
                />
              </div>
              <div>
                <p className="text-[11.5px] font-bold text-foreground leading-tight">
                  {a.label}
                </p>
                <p className="text-[10px] text-text-tertiary mt-0.5 leading-snug">
                  {a.hint}
                </p>
              </div>
            </motion.button>
          );
        })}
    