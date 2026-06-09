/**
 * DeliverabilityPanel.tsx — operator-facing deliverability dashboard
 * for the Fundraise module.
 *
 * Shows at a glance:
 *   - Total cold sends in the last 30 days
 *   - Bounce count + delivery rate
 *   - Per-pattern accuracy table (verified, first@, first.last@, etc.)
 *     so the operator can see which pattern guesses are actually
 *     landing -- and decide whether to buy Hunter/Apollo later
 *   - Recent bounced addresses with reason snippets
 *
 * Mount once on the FundraisePage header strip. Manual refresh
 * button forces a fresh bounce-check round-trip; auto-loads on
 * mount.
 */

import { useState } from "react";
import {
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  TrendingUp,
} from "lucide-react";

import { useOutreachStats, type PatternStat } from "@/Fundraise/useOutreachStats";

export function DeliverabilityPanel() {
  const { data, loading, error, refresh } = useOutreachStats(30);
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="rounded-sm border border-border bg-card/60 px-4 py-3">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp size={12} className="text-primary" />
          <h3 className="text-[10.5px] uppercase tracking-[0.14em] font-mono font-semibold text-foreground/85 m-0">
            Deliverability (30d)
          </h3>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          title="Re-check Gmail for bounces and refresh stats"
          className="inline-flex items-center gap-1 px-2 h-6 rounded-sm border border-border bg-secondary text-[10px] uppercase tracking-[0.1em] font-bold text-foreground/65 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={9} className="animate-spin" />
          ) : (
            <RefreshCcw size={9} />
          )}
          Refresh
        </button>
      </header>

      {error && (
        <div className="flex items-start gap-1.5 text-[10.5px] text-destructive mb-2">
          <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!data && loading && (
        <div className="text-[11px] text-foreground/55 italic py-2">
          Loading outreach stats…
        </div>
      )}

      {data && (
        <>
          {/* Hero stats row */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat
              label="Sent"
              value={data.totalSent.toString()}
              tone="neutral"
            />
            <Stat
              label="Bounced"
              value={data.totalBounced.toString()}
              tone={data.totalBounced > 0 ? "warning" : "neutral"}
            />
            <Stat
              label="Delivered"
              value={
                data.totalSent === 0
                  ? "—"
                  : `${Math.round(data.deliveryRate * 100)}%`
              }
              tone={data.deliveryRate >= 0.7 ? "good" : data.deliveryRate >= 0.4 ? "warning" : "bad"}
            />
          </div>

          {data.totalSent === 0 ? (
            <div className="text-[10.5px] italic text-foreground/45 py-2 text-center">
              No outbound emails in the last 30 days. Stats will appear
              after you send some.
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full text-left text-[10.5px] uppercase tracking-[0.12em] font-mono text-foreground/55 hover:text-foreground transition-colors mb-1.5"
              >
                {expanded ? "↑ Hide" : "↓ Show"} pattern accuracy + recent bounces
              </button>

              {expanded && (
                <>
                  {/* Per-pattern accuracy table */}
                  {data.byPattern.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-foreground/45 mb-1.5">
                        Pattern accuracy
                      </div>
                      <div className="space-y-1">
                        {data.byPattern.map((p) => (
                          <PatternRow key={p.pattern} stat={p} />
                        ))}
                      </div>
                      <div className="text-[10px] text-foreground/40 italic mt-2 leading-snug">
                        Higher delivery % on a pattern means you can lean on
                        that pattern more confidently. Once you have a clear
                        winner, that's the signal to either skip the shotgun
                        or buy a verifier service.
                      </div>
                    </div>
                  )}

                  {/* Recent bounces list */}
                  {data.recentBounces.length > 0 && (
                    <div>
                      <div className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-foreground/45 mb-1.5">
                        Recent bounces ({data.recentBounces.length})
                      </div>
                      <div className="space-y-1.5">
                        {data.recentBounces.map((b) => (
                          <div
                            key={b.bounce_message_id}
                            className="rounded-sm border border-destructive/30 bg-destructive/[0.04] px-2.5 py-1.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <Mail
                                size={10}
                                className="text-destructive/80 flex-shrink-0"
                              />
                              <span className="text-[11px] font-mono text-foreground/85 truncate flex-1">
                                {b.failed_email}
                              </span>
                              <span className="text-[9.5px] font-mono tabular-nums text-foreground/40 flex-shrink-0">
                                {new Date(
                                  b.bounce_time_iso,
                                ).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                            {b.reason_snippet && (
                              <div className="text-[10px] text-foreground/45 line-clamp-1 mt-0.5">
                                {b.reason_snippet}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.byPattern.length === 0 &&
                    data.recentBounces.length === 0 && (
                      <div className="text-[10.5px] italic text-foreground/45 py-2 text-center">
                        No pattern data yet (shotgun mode hasn't run, or all
                        sends are pre-shotgun). Stats will populate as you
                        send.
                      </div>
                    )}
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "good" | "warning" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="text-center">
      <div className={"text-[20px] font-bold leading-none " + toneClass}>
        {value}
      </div>
      <div className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-foreground/45 mt-1">
        {label}
      </div>
    </div>
  );
}

function PatternRow({ stat }: { stat: PatternStat }) {
  const ratePct = Math.round(stat.rate * 100);
  const tone =
    stat.pattern === "verified"
      ? "text-emerald-400"
      : ratePct >= 70
        ? "text-emerald-400"
        : ratePct >= 40
          ? "text-amber-400"
          : "text-destructive";
  const barTone =
    stat.pattern === "verified"
      ? "bg-emerald-500/70"
      : ratePct >= 70
        ? "bg-emerald-500/55"
        : ratePct >= 40
          ? "bg-amber-500/55"
          : "bg-destructive/55";
  return (
    <div className="grid grid-cols-[110px_1fr_60px_50px] items-center gap-2">
      <span className="text-[10.5px] font-mono uppercase tracking-[0.1em] text-foreground/65 truncate">
        {stat.pattern}
      </span>
      <div className="h-[3px] rounded-full bg-foreground/10 overflow-hidden">
        <div
          className={"h-full transition-all " + barTone}
          style={{ width: `${Math.max(2, ratePct)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-foreground/55 text-right">
        {stat.sent - stat.bounced}/{stat.sent}
      </span>
      <span
        className={
          "text-[11px] font-bold tabular-nums text-right " + tone
        }
      >
        {ratePct}%
      </span>
    </div>
  );
}
