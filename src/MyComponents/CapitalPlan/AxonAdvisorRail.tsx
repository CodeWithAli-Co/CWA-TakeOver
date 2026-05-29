/**
 * AxonAdvisorRail.tsx — Persistent AXON advisor column.
 *
 * Phase 4: wired to the rule-based capitalAdvisor (deterministic
 * answers from the capital state). When the model-backed
 * capital_advise AXON action ships, this same rail will fall back to
 * it for questions the deterministic router doesn't cover.
 *
 * Surface:
 *   - Header with collapse + briefing button
 *   - On-mount auto-briefing (situation report)
 *   - Free-text question box (Enter submits)
 *   - Quick-question chips that route through the same advisor
 *   - Response feed with timestamped entries, color-toned by severity
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, X, Send, RotateCcw, AlertTriangle, AlertCircle, CheckCircle2, Info,
} from "lucide-react";
import type { CapitalPlanData } from "./CapitalPlan.queries";
import {
  generateBriefing, answerQuestion,
  type AdvisorResponse, type AdvisorTone,
} from "./scenarios/capitalAdvisor";

const CASH_KEY = "cwa-capital-plan-cash-on-hand";

interface FeedEntry {
  id: string;
  question?: string;       // null = unprompted briefing
  response: AdvisorResponse;
  timestamp: number;
}

export function AxonAdvisorRail({
  plan, activeTab, onClose,
}: {
  plan: CapitalPlanData;
  activeTab: string;
  onClose: () => void;
}) {
  const [cashOnHand, setCashOnHand] = useState<number>(() => {
    try { return Number(window.localStorage.getItem(CASH_KEY)) || 0; } catch { return 0; }
  });
  useEffect(() => {
    function reread() {
      try { setCashOnHand(Number(window.localStorage.getItem(CASH_KEY)) || 0); } catch { /* ignore */ }
    }
    window.addEventListener("storage", reread);
    const interval = setInterval(reread, 5000); // also poll, since same-tab edits don't fire storage event
    return () => { window.removeEventListener("storage", reread); clearInterval(interval); };
  }, []);

  const ctx = useMemo(() => ({ plan, cashOnHand }), [plan, cashOnHand]);

  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [input, setInput] = useState("");
  const briefingPushedRef = useRef(false);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-briefing on mount
  useEffect(() => {
    if (briefingPushedRef.current) return;
    briefingPushedRef.current = true;
    const briefing = generateBriefing(ctx);
    setFeed([{ id: `briefing-${Date.now()}`, response: briefing, timestamp: Date.now() }]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll feed
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length]);

  function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed) return;
    const response = answerQuestion(trimmed, ctx);
    setFeed((f) => [...f, { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, question: trimmed, response, timestamp: Date.now() }]);
    setInput("");
  }

  function refreshBriefing() {
    const briefing = generateBriefing(ctx);
    setFeed((f) => [...f, { id: `briefing-${Date.now()}`, response: briefing, timestamp: Date.now() }]);
  }

  function clearFeed() {
    setFeed([]);
    briefingPushedRef.current = false;
    // Re-push briefing so the rail never looks empty
    const briefing = generateBriefing(ctx);
    setFeed([{ id: `briefing-${Date.now()}`, response: briefing, timestamp: Date.now() }]);
  }

  const tabSpecificChips = QUICK_CHIPS[activeTab] ?? QUICK_CHIPS.default;

  return (
    <aside className="border-l border-teal-500/30 bg-gradient-to-b from-teal-950/30 via-card to-card min-h-[calc(100vh-64px)] flex flex-col shadow-[-4px_0_16px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-teal-500/[0.15] to-card backdrop-blur-sm border-b border-teal-500/30 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="h-4 w-4 text-teal-300" />
            <span className="absolute inset-0 animate-pulse">
              <Sparkles className="h-4 w-4 text-teal-300/40" />
            </span>
          </div>
          <span className="text-[12px] font-bold tracking-tight text-foreground">AXON Advisor</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={refreshBriefing}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            title="Refresh briefing"
            aria-label="Refresh briefing"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            aria-label="Close advisor"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <AnimatePresence initial={false}>
          {feed.map((entry) => (
            <FeedItem key={entry.id} entry={entry} />
          ))}
        </AnimatePresence>
        <div ref={feedEndRef} />
      </div>

      {/* Quick chips */}
      <div className="border-t border-border/60 px-3 pt-2.5 pb-1.5">
        <div className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/60 font-bold mb-1.5">
          Quick questions · {activeTab}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tabSpecificChips.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => ask(chip)}
              className="text-[10.5px] px-2 py-1 rounded-sm border border-border bg-background hover:bg-muted/30 hover:text-foreground text-muted-foreground transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border px-3 py-2.5">
        <div className="inline-flex items-stretch w-full border border-border rounded-sm overflow-hidden focus-within:border-primary/60 transition-colors">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") ask(input); }}
            placeholder="Ask anything…"
            className="flex-1 bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => ask(input)}
            disabled={!input.trim()}
            className="px-3 bg-teal-500/15 border-l border-border text-teal-200 hover:bg-teal-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="Ask AXON"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        {feed.length > 1 && (
          <button
            type="button"
            onClick={clearFeed}
            className="mt-1.5 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            Clear feed
          </button>
        )}
      </div>
    </aside>
  );
}

// ─── Feed item ────────────────────────────────────────────────

function FeedItem({ entry }: { entry: FeedEntry }) {
  const tone = entry.response.tone;
  const meta = TONE_META[tone];
  const Icon = meta.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="space-y-2"
    >
      {entry.question && (
        <div className="flex items-start justify-end gap-2">
          <div className="bg-primary/15 border border-primary/30 rounded-sm px-3 py-1.5 text-[11.5px] text-foreground max-w-[85%]">
            {entry.question}
          </div>
        </div>
      )}
      <div className={`border-l-2 ${meta.borderClass} pl-3 py-2`}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Icon className={`h-3 w-3 ${meta.iconClass}`} />
          <span className={`text-[12px] font-bold leading-tight ${meta.headlineClass}`}>
            {entry.response.headline}
          </span>
        </div>
        <ul className="space-y-1.5">
          {entry.response.bullets.map((b, i) => (
            <li key={i} className="text-[11.5px] text-foreground/85 leading-relaxed">
              {b}
            </li>
          ))}
        </ul>
        {entry.response.suggestedFollowups && entry.response.suggestedFollowups.length > 0 && (
          <div className="mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground/70 italic">
            Try: {entry.response.suggestedFollowups.join(" · ")}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Tone styling ────────────────────────────────────────────

const TONE_META: Record<AdvisorTone, {
  icon: typeof Sparkles;
  borderClass: string;
  iconClass: string;
  headlineClass: string;
}> = {
  ok:       { icon: CheckCircle2,   borderClass: "border-emerald-500/40", iconClass: "text-emerald-300", headlineClass: "text-emerald-200" },
  info:     { icon: Info,           borderClass: "border-teal-500/40",  iconClass: "text-teal-300",  headlineClass: "text-teal-200" },
  caution:  { icon: AlertCircle,    borderClass: "border-amber-500/40",   iconClass: "text-amber-300",   headlineClass: "text-amber-200" },
  warn:     { icon: AlertTriangle,  borderClass: "border-orange-500/50",  iconClass: "text-orange-300",  headlineClass: "text-orange-200" },
  critical: { icon: AlertTriangle,  borderClass: "border-red-500/60",     iconClass: "text-red-300",     headlineClass: "text-red-200" },
};

// ─── Tab-specific quick chips ────────────────────────────────

const QUICK_CHIPS: Record<string, string[]> = {
  default: [
    "How's runway?",
    "What's my biggest risk?",
    "Should I delay the raise?",
  ],
  rounds: [
    "Should I delay the next round?",
    "What's my biggest risk?",
    "Is the pipeline healthy?",
  ],
  checks: [
    "Which investors are stale?",
    "Who should I follow up with?",
    "What's my biggest risk?",
  ],
  allocation: [
    "Am I overspending anywhere?",
    "How's runway?",
    "Should I hire?",
  ],
  runway: [
    "How tight is runway?",
    "Should I delay the next round?",
    "Can I afford another hire?",
  ],
  scenarios: [
    "Should I hire?",
    "How's runway?",
    "What's my biggest risk?",
  ],
};
