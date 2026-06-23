// ───────────────────────────────────────────────────────────────────
// DecisionCard — one thing that needs the operator. Title, the stake
// (dollar/count, crimson for critical, amber for medium), one line of
// context, and 1-2 actions. A thin left-border accent carries severity.
// Restrained and premium — elevation over bright borders.
// ───────────────────────────────────────────────────────────────────
import { ArrowRight, Sparkles, Lock } from "lucide-react";
import type { Decision, DecisionAction, Severity } from "./decisionEngine";

const ACCENT: Record<Severity, string> = {
  critical: "#E2435B",
  warning: "#EF9F27",
  info: "#6B7280",
  pending: "#3A3A42",
};

export function DecisionCard({
  d,
  onAction,
}: {
  d: Decision;
  onAction: (a: DecisionAction) => void;
}) {
  const accent = ACCENT[d.severity];
  const isPending = d.severity === "pending";

  return (
    <div
      className="group relative rounded-lg overflow-hidden transition-colors"
      style={{
        background: isPending ? "#141417" : "#1A1A1F",
        boxShadow: isPending ? "none" : "0 1px 0 rgba(255,255,255,0.02) inset",
        opacity: isPending ? 0.72 : 1,
      }}
    >
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: accent, opacity: isPending ? 0.5 : 1 }}
      />
      <div className="pl-5 pr-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {isPending && <Lock size={12} className="text-zinc-600 shrink-0" strokeWidth={1.75} />}
              <h3
                className="text-[15px] text-zinc-100 leading-snug truncate"
                style={{ fontFamily: "Hanken Grotesk, Inter, sans-serif", fontWeight: 500 }}
              >
                {d.title}
              </h3>
            </div>
            <p className="mt-1.5 text-[12.5px] text-zinc-400 leading-relaxed [overflow-wrap:anywhere]">
              {d.context}
            </p>
          </div>

          {d.stake && !isPending && (
            <div className="shrink-0 text-right">
              <div
                className="text-[19px] leading-none tabular-nums"
                style={{ fontFamily: "Newsreader, Georgia, serif", color: accent }}
              >
                {d.stake}
              </div>
            </div>
          )}
          {isPending && (
            <span className="shrink-0 text-[10px] uppercase tracking-[0.16em] text-zinc-600 font-medium">
              To build
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          {d.actions.map((a, i) => {
            const primary = i === 0 && !isPending;
            const isAxon = a.kind === "axon";
            return (
              <button
                key={i}
                type="button"
                disabled={a.kind === "noop"}
                onClick={() => onAction(a)}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[12px] font-medium transition-colors disabled:cursor-default"
                style={
                  primary
                    ? { background: "rgba(255,255,255,0.06)", color: "#F4F4F5" }
                    : { background: "transparent", color: isAxon ? "#C9B8F5" : "#A1A1AA" }
                }
              >
                {isAxon && <Sparkles size={12} strokeWidth={1.75} />}
                {a.label}
                {primary && <ArrowRight size={12} strokeWidth={1.75} className="opacity-60" />}
              </button>
            );
          })}
          <span className="ml-auto text-[10px] text-zinc-700 tracking-tight hidden sm:block">
            {d.source}
          </span>
        </div>
      </div>
    </div>
  );
}

export default DecisionCard;
