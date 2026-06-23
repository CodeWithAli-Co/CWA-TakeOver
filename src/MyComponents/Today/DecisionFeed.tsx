// ───────────────────────────────────────────────────────────────────
// DecisionFeed — the center column. A short greeting, "N things need
// you today", the decision cards, and a quiet "handled today" strip
// showing what Axon did (real, from the audit log) without shouting.
// ───────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useDecisions, type DecisionAction } from "./decisionEngine";
import { DecisionCard } from "./DecisionCard";
import { listAudit, type AuditEntry } from "@/Axon/engine/auditLog";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export function DecisionFeed({
  username,
  runAxon,
}: {
  username: string;
  runAxon: (prompt: string) => void;
}) {
  const navigate = useNavigate();
  const { decisions, isLoading } = useDecisions();

  const handled = useMemo<AuditEntry[]>(() => {
    try {
      return listAudit({ limit: 6 });
    } catch {
      return [];
    }
  }, []);

  const live = decisions.filter((d) => d.severity !== "pending");
  const pending = decisions.filter((d) => d.severity === "pending");
  const needYou = live.length;

  const onAction = (a: DecisionAction) => {
    if (a.kind === "navigate" && a.to) navigate({ to: a.to as any });
    else if (a.kind === "axon" && a.prompt) runAxon(a.prompt);
  };

  return (
    <div className="h-full overflow-y-auto px-8 py-7" style={{ scrollbarWidth: "thin" }}>
      <div className="max-w-[640px] mx-auto">
        <header className="mb-7">
          <p className="text-[13px] text-zinc-500" style={{ fontFamily: "Hanken Grotesk, Inter, sans-serif" }}>
            {greeting()}, <span className="text-zinc-300">{username}</span>.
          </p>
          <h1
            className="mt-1 text-[26px] text-zinc-100 leading-tight"
            style={{ fontFamily: "Newsreader, Georgia, serif", fontWeight: 400 }}
          >
            {isLoading
              ? "Reading the operation…"
              : needYou === 0
                ? "Nothing needs you right now."
                : `${needYou} thing${needYou === 1 ? "" : "s"} need you today.`}
          </h1>
        </header>

        <div className="space-y-3">
          {live.map((d) => (
            <DecisionCard key={d.id} d={d} onAction={onAction} />
          ))}
        </div>

        {pending.length > 0 && (
          <div className="mt-7">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-2.5 flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-zinc-700" />
              Decision intelligence — pending the unified data spine
            </div>
            <div className="space-y-3">
              {pending.map((d) => (
                <DecisionCard key={d.id} d={d} onAction={onAction} />
              ))}
            </div>
          </div>
        )}

        {handled.length > 0 && (
          <div className="mt-9 pt-5 border-t border-white/[0.05]">
            <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 mb-3">
              Handled today
            </div>
            <ul className="space-y-1.5">
              {handled.map((h) => (
                <li key={h.id} className="flex items-start gap-2.5 text-[12px] text-zinc-500">
                  <Check size={13} className="mt-0.5 shrink-0 text-emerald-500/70" strokeWidth={2} />
                  <span className="[overflow-wrap:anywhere]">
                    {h.summary || h.actionName}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default DecisionFeed;
