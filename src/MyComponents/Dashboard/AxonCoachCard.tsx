/**
 * AxonCoachCard.tsx — proper coaching widget.
 *
 * The original AxonCheckinCard was a stat counter: "you have 6
 * overdue tasks." This card answers the next question — "OK, so
 * what do I do about it?" — by offering 2-4 *different kinds* of
 * help on every observation:
 *
 *   · AUTONOMOUS   — "I'll do it for you."     (Axon takes over)
 *   · COLLABORATIVE — "Walk me through it."    (chat dialogue)
 *   · DEFER         — "Not today, snooze."     (defer with reason)
 *   · CONTEXT       — "Why this one? / Show me why" (explain)
 *
 * The right mix depends on the observation. A draft email gets
 * AUTONOMOUS + COLLABORATIVE + DEFER. A trend insight gets
 * CONTEXT + COLLABORATIVE. A check-in question gets ASK +
 * COLLABORATIVE.
 *
 * v1 observations are hard-coded templates that rotate. v2 will
 * wire to real queries (overdue tasks, upcoming meetings, revenue
 * trend, connector freshness, etc.) and pick the most pressing
 * one.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Wand2,
  MessageSquare,
  Clock,
  HelpCircle,
  ChevronRight,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useOptionalAxon } from "@/Axon/AxonProvider";
import {
  useAxonObservations,
  type Observation as RealObservation,
  type CoachAction as RealCoachAction,
} from "./useAxonObservations";

// ─────────────────────────────────────────────────────────────────
// Observation templates
// ─────────────────────────────────────────────────────────────────

type CoachActionFlavor =
  | "autonomous"
  | "collaborative"
  | "defer"
  | "context"
  | "ask";

interface CoachAction {
  flavor: CoachActionFlavor;
  label: string;
  /** Optional second-line subtext that explains what'll happen. */
  hint?: string;
  /** Sent to Axon as the prompt when clicked. v1 just logs +
   *  opens the Axon panel — wire real dispatch in v2. */
  prompt: string;
}

interface Observation {
  id: string;
  /** Short tag shown above the body (e.g. "FOCUS" / "TRENDING UP"). */
  kind: string;
  /** Two-three sentence read of the situation, written in
   *  Axon's voice. Should feel like a colleague's note, not a
   *  notification. */
  body: string;
  actions: CoachAction[];
}

const SAMPLE_OBSERVATIONS: Observation[] = [
  {
    id: "investor-followup",
    kind: "Focus",
    body: "You have 6 overdue tasks and a Friday meeting with Hanif. Four of the overdue ones are about the investor thread — they're knotted together. Probably worth one clean pass before Friday, otherwise the meeting gets messy.",
    actions: [
      {
        flavor: "autonomous",
        label: "Draft the follow-up",
        hint: "I'll write a tight one-pager from the demo notes.",
        prompt:
          "Draft a concise investor follow-up email based on my recent demo notes and pipeline status.",
      },
      {
        flavor: "collaborative",
        label: "Walk me through it",
        hint: "I'll prioritize the 6, you decide.",
        prompt:
          "Walk me through my 6 overdue tasks and help me decide which to tackle first.",
      },
      {
        flavor: "defer",
        label: "Snooze · tomorrow 9am",
        prompt:
          "Snooze this nudge until tomorrow 9am. Re-raise if more tasks go overdue overnight.",
      },
      {
        flavor: "context",
        label: "Why these matter",
        prompt:
          "Explain why these 6 overdue tasks are blocking my Friday meeting with Hanif.",
      },
    ],
  },
  {
    id: "revenue-trend",
    kind: "Trending up",
    body: "Revenue is up 42% vs. the prior half — best month was Apr at $850. The expense line stayed flat. If you want, I can sketch what would happen if we scaled the inputs that drove April.",
    actions: [
      {
        flavor: "autonomous",
        label: "Run the projection",
        hint: "I'll model 3 scenarios with the April delta.",
        prompt:
          "Project the next 6 months using April as the baseline scaling driver. Show 3 scenarios.",
      },
      {
        flavor: "collaborative",
        label: "Talk it through",
        hint: "I'll show you which inputs moved.",
        prompt: "Talk me through what changed in April vs. earlier months.",
      },
      {
        flavor: "context",
        label: "What drove April",
        prompt: "Explain what specifically drove the April revenue spike.",
      },
    ],
  },
  {
    id: "heads-down",
    kind: "Check in",
    body: "You've been heads-down on Tasks for 3 days running. Net Profit looks healthy, no fires in chat. Want me to clear your calendar after lunch so you can keep momentum, or are you due for a break?",
    actions: [
      {
        flavor: "autonomous",
        label: "Hold my afternoon",
        hint: "I'll move non-urgent meetings to next week.",
        prompt:
          "Block my afternoon for focus work. Reschedule non-urgent meetings to next week.",
      },
      {
        flavor: "ask",
        label: "Ask me something else",
        hint: "What I should actually be working on.",
        prompt:
          "Help me decide what I should actually be focused on this week given my goals.",
      },
      {
        flavor: "defer",
        label: "Snooze · 2 hours",
        prompt: "Snooze for 2 hours. I'm in flow.",
      },
    ],
  },
  {
    id: "stale-connector",
    kind: "Heads up",
    body: "Your HubSpot connector hasn't synced in 4 days. The pipeline numbers on the dashboard are technically stale. Quick fix — I can re-pull now, or schedule a daily 8am sync so this never happens.",
    actions: [
      {
        flavor: "autonomous",
        label: "Sync now",
        hint: "Pull deals + contacts + pipelines.",
        prompt:
          "Trigger a fresh HubSpot sync. Pull deals, contacts, and pipeline updates.",
      },
      {
        flavor: "autonomous",
        label: "Schedule daily sync",
        hint: "8am, automatic, every day.",
        prompt:
          "Set up a daily 8am scheduled HubSpot sync so this stays fresh.",
      },
      {
        flavor: "context",
        label: "What changed",
        prompt:
          "Show me what HubSpot data is likely stale vs. fresh on my dashboard.",
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

export function AxonCoachCard() {
  // v2: real observations sourced from the founder's workload via
  // useAxonObservations. The hook returns a priority-sorted list;
  // we render the top one with a refresh button that rotates
  // through the rest. Fallback to a single static "loading" line
  // while the first query resolves so the card never goes blank.
  const { data: liveObservations, isLoading, isFetching, refetch } =
    useAxonObservations();

  const observations: (RealObservation | Observation)[] = useMemo(() => {
    if (liveObservations && liveObservations.length > 0)
      return liveObservations;
    // Defensive fallback: the hook should always return at least
    // the all-clear observation, but if something goes sideways we
    // keep the static samples around so the card still renders.
    return SAMPLE_OBSERVATIONS;
  }, [liveObservations]);

  const [obsIdx, setObsIdx] = useState(0);
  // Reset rotation when the underlying list changes (e.g. a task
  // closed and overdue-cluster dropped out of the top spot).
  useEffect(() => {
    setObsIdx(0);
  }, [liveObservations]);
  const obs = observations[obsIdx % observations.length]!;

  // Friendly local time stamp in the header — feels like a
  // colleague's note rather than an auto-refresh widget.
  const [stamp, setStamp] = useState(formatStamp(new Date()));
  useEffect(() => {
    const t = setInterval(() => setStamp(formatStamp(new Date())), 60_000);
    return () => clearInterval(t);
  }, []);

  // Axon panel dispatch — openPanel + submitCommand handles the
  // brain wiring for us. Optional because the dashboard tree
  // sometimes mounts outside the AxonProvider — in that case we
  // fall back to a window-event Cmd+K dispatch so the card still
  // does *something* useful when clicked.
  const axon = useOptionalAxon();
  const dispatchPrompt = (prompt: string) => {
    if (axon) {
      axon.openPanel();
      axon.submitCommand(prompt);
      return;
    }
    // Fallback: nudge the command palette open. Not as good as
    // direct brain dispatch but keeps the click from being a no-op.
    try {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true }),
      );
    } catch {
      /* swallow — environments without window won't reach here */
    }
    // eslint-disable-next-line no-console
    console.warn(
      "[axon-coach] dispatched outside AxonProvider; opened palette as fallback. prompt:",
      prompt,
    );
  };

  const cycle = () => {
    // If we have >1 observation, rotate. Otherwise force a refetch
    // so the founder can pull a fresh read.
    if (observations.length > 1) {
      setObsIdx((i) => (i + 1) % observations.length);
    } else {
      refetch();
    }
  };

  const handleAction = (action: CoachAction | RealCoachAction) => {
    // v2: dispatch to the Axon brain via the panel. submitCommand
    // sends the prompt; openPanel surfaces the conversation.
    dispatchPrompt(action.prompt);
  };

  const askPrompt = (text: string) => {
    if (!text.trim()) return;
    dispatchPrompt(text);
  };

  return (
    <div className="h-full rounded-2xl border border-border-soft bg-foreground/[0.025] overflow-hidden flex flex-col">
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2.5 border-b border-border-soft">
        <AxonOrb />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[12.5px] font-bold text-foreground">
              Axon
            </span>
            <span className="text-[10.5px] text-text-tertiary">·</span>
            <span className="text-[10.5px] text-text-tertiary">{stamp}</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary">
            {obs.kind}
          </span>
        </div>
        <button
          type="button"
          onClick={cycle}
          className="p-1.5 rounded-full text-text-tertiary hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-50"
          title={observations.length > 1 ? "Next read" : "Refresh"}
          disabled={isLoading}
        >
          <RefreshCw
            size={12}
            strokeWidth={2.4}
            className={isFetching ? "animate-spin" : ""}
          />
        </button>
      </div>

      {/* ─── Body (observation) ───────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={obs.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          <div className="px-4 py-3.5">
            <p className="text-[12.5px] text-foreground/90 leading-relaxed">
              {obs.body}
            </p>
          </div>

          {/* ─── Actions ───────────────────────────────────── */}
          <div className="px-3 pb-3 space-y-1.5">
            {obs.actions.map((a, i) => (
              <CoachActionRow
                key={`${obs.id}-${i}`}
                action={a}
                onClick={() => handleAction(a)}
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ─── Ask anything ──────────────────────────────────── */}
      <div className="border-t border-border-soft px-3 py-2.5 bg-foreground/[0.02]">
        <AskAxonInput onSubmit={askPrompt} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function formatStamp(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function AxonOrb() {
  return (
    <motion.div
      className="relative w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.8), hsl(var(--primary) / 0.35) 60%, hsl(var(--primary) / 0.15))",
        boxShadow: "0 0 12px -2px hsl(var(--primary) / 0.5)",
      }}
      animate={{
        scale: [1, 1.04, 1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <Sparkles size={11} strokeWidth={2.4} className="text-white" />
    </motion.div>
  );
}

const FLAVOR_META: Record<
  CoachActionFlavor,
  { icon: LucideIcon; label: string; tone: string }
> = {
  autonomous: {
    icon: Wand2,
    label: "I'll do it",
    tone: "text-primary",
  },
  collaborative: {
    icon: MessageSquare,
    label: "With you",
    tone: "text-foreground/85",
  },
  defer: {
    icon: Clock,
    label: "Defer",
    tone: "text-text-tertiary",
  },
  context: {
    icon: HelpCircle,
    label: "Explain",
    tone: "text-foreground/85",
  },
  ask: {
    icon: HelpCircle,
    label: "Ask",
    tone: "text-foreground/85",
  },
};

function CoachActionRow({
  action,
  onClick,
}: {
  action: CoachAction;
  onClick: () => void;
}) {
  const meta = FLAVOR_META[action.flavor];
  const Icon = meta.icon;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.99 }}
      className="w-full text-left flex items-center gap-2.5 p-2.5 rounded-lg border border-border-soft bg-foreground/[0.025] hover:bg-foreground/[0.05] hover:border-foreground/25 transition-colors"
    >
      <div
        className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-foreground/[0.05] border border-border-soft ${meta.tone}`}
      >
        <Icon size={13} strokeWidth={2.3} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11.5px] font-bold text-foreground leading-tight">
            {action.label}
          </span>
          <span
            className={`text-[8.5px] font-bold uppercase tracking-[0.14em] px-1 py-px rounded bg-foreground/[0.06] ${meta.tone}`}
          >
            {meta.label}
          </span>
        </div>
        {action.hint && (
          <p className="text-[10.5px] text-text-tertiary mt-px leading-tight">
            {action.hint}
          </p>
        )}
      </div>
      <ChevronRight
        size={12}
        strokeWidth={2.2}
        className="text-text-tertiary shrink-0"
      />
    </motion.button>
  );
}

function AskAxonInput({
  onSubmit,
}: {
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
        setText("");
      }}
      className="flex items-center gap-1.5"
    >
      <Sparkles
        size={11}
        strokeWidth={2.4}
        className="text-primary shrink-0"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Or ask Axon anything…"
        className="flex-1 bg-transparent text-[11.5px] text-foreground placeholder:text-text-tertiary outline-none min-w-0"
      />
      <button
        type="submit"
        disabled={!text.trim()}
        className="inline-flex items-center gap-1 px-2 h-6 rounded-full text-[10px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        Ask
        <ChevronRight size={9} strokeWidth={2.8} />
      </button>
    </form>
  );
}
