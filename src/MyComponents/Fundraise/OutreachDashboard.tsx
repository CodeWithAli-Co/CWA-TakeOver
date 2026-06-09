/**
 * OutreachDashboard.tsx — Phase 11.3.
 *
 * Dedicated "Deliverability" tab for the FundraisePage. Designed
 * for the operator to glance once a day and trust that automated
 * outreach (Axon-generated lists + sends) is running cleanly.
 *
 * What it surfaces:
 *
 *   1. Hero stats — sent / bounced / delivered % / reply count
 *      over the last 30 days. The headline numbers any operator
 *      cares about.
 *
 *   2. Sending health alert — a red banner up top when any
 *      ALARMING bounce category appears (account_suspended /
 *      policy_block / rate_limit / misconfigured). This is the
 *      "stop the line" signal: if the operator sees red here, they
 *      know to pause Axon's automation and investigate.
 *
 *   3. Per-pattern accuracy — sortable table showing which patterns
 *      ('first', 'first.last', 'flast', etc) actually deliver. Over
 *      enough sample size this tells the operator which patterns to
 *      lean on vs which to drop, and whether to pay for a verifier
 *      service like Hunter.
 *
 *   4. Bounce reason breakdown — categorized counts so the operator
 *      can see the SHAPE of failures, not just the count.
 *      Lots of recipient_invalid = healthy (shotgun working as
 *      designed). Any account_suspended = emergency.
 *
 *   5. Recent bounces detail — the actual bounce records so the
 *      operator can audit specific failures.
 *
 * Mount target: rendered as a tab from FundraisePage. NOT mounted
 * elsewhere -- the FundraisePage header has a tab toggle that swaps
 * between Pipeline (kanban/grid) and Deliverability (this).
 */

import {
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Mail,
  TrendingUp,
  Send,
  Shield,
  ShieldAlert,
} from "lucide-react";

import {
  useOutreachHealth,
  type BounceCategory,
  type CategoryStat,
} from "@/Fundraise/useOutreachHealth";
import type { PatternStat } from "@/Fundraise/useOutreachStats";

export function OutreachDashboard() {
  const health = useOutreachHealth(30);
  const { stats, classifications, categoryStats, hasAlarmingBounces, loading, error, refresh } = health;

  return (
    <div className="space-y-4">
      {/* ── HEADER ───────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-semibold text-foreground m-0 leading-tight">
            Outreach Deliverability
          </h2>
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-foreground/45 mt-1">
            Last 30 days · Updates on refresh
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border bg-secondary text-[11px] uppercase tracking-[0.1em] font-bold text-foreground/75 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
        >
          {loading ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <RefreshCcw size={11} />
          )}
          Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-sm border border-destructive/40 bg-destructive/[0.06] px-3 py-2 flex items-start gap-2 text-[11.5px] text-destructive">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── HEALTH ALERT ─────────────────────────────────────────── */}
      {hasAlarmingBounces && (
        <div className="rounded-sm border-2 border-destructive bg-destructive/[0.08] px-4 py-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert
              size={16}
              className="text-destructive mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <div className="text-[12.5px] font-bold text-destructive uppercase tracking-[0.1em]">
                Sending health alert
              </div>
              <div className="text-[12px] text-foreground/85 mt-1 leading-relaxed">
                One or more bounces look like host-level enforcement
                (suspension, policy block, rate limit, or alias auth break)
                — NOT just bad addresses. Pause Axon's automated sending,
                check your mail-host dashboard, and consider switching to a
                different from-alias before continuing.
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {categoryStats
                  .filter((c) => c.alarming)
                  .map((c) => (
                    <CategoryPill key={c.category} stat={c} prominent />
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!stats && loading && (
        <div className="flex items-center gap-2 text-[12px] text-foreground/55 italic py-6 justify-center">
          <Loader2 size={12} className="animate-spin" />
          Loading outreach stats…
        </div>
      )}

      {stats && (
        <>
          {/* ── HERO STATS ──────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            <HeroStat
              icon={<Send size={12} />}
              label="Sent"
              value={stats.totalSent.toLocaleString()}
              tone="neutral"
            />
            <HeroStat
              icon={<AlertCircle size={12} />}
              label="Bounced"
              value={stats.totalBounced.toLocaleString()}
              tone={stats.totalBounced > 0 ? "warning" : "neutral"}
            />
            <HeroStat
              icon={<CheckCircle2 size={12} />}
              label="Delivered"
              value={
                stats.totalSent === 0
                  ? "—"
                  : `${Math.round(stats.deliveryRate * 100)}%`
              }
              tone={
                stats.totalSent === 0
                  ? "neutral"
                  : stats.deliveryRate >= 0.7
                    ? "good"
                    : stats.deliveryRate >= 0.4
                      ? "warning"
                      : "bad"
              }
            />
            <HeroStat
              icon={<Shield size={12} />}
              label="Health"
              value={hasAlarmingBounces ? "Alert" : "OK"}
              tone={hasAlarmingBounces ? "bad" : "good"}
            />
          </div>

          {stats.totalSent === 0 ? (
            <div className="rounded-sm border border-dashed border-border bg-card/40 px-4 py-8 text-center">
              <div className="text-[12px] italic text-foreground/55">
                No outbound emails in the last 30 days. Send a few and
                stats will populate here.
              </div>
            </div>
          ) : (
            <>
              {/* ── PATTERN ACCURACY ─────────────────────────────── */}
              {stats.byPattern.length > 0 && (
                <section className="rounded-sm border border-border bg-card/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp size={11} className="text-primary" />
                    <h3 className="text-[10.5px] uppercase tracking-[0.14em] font-mono font-semibold text-foreground/85 m-0">
                      Pattern accuracy
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {stats.byPattern.map((p) => (
                      <PatternRow key={p.pattern} stat={p} />
                    ))}
                  </div>
                  <p className="text-[10.5px] text-foreground/45 italic mt-3 leading-snug">
                    Per-pattern delivery rate. The pattern with the highest
                    rate over a meaningful sample size (~50+) is your
                    firm-shape's true convention — that's the one to lean on
                    if you ever go back to single-send mode, and the
                    benchmark to compare a verifier service against.
                  </p>
                </section>
              )}

              {/* ── BOUNCE BREAKDOWN ─────────────────────────────── */}
              {categoryStats.length > 0 && (
                <section className="rounded-sm border border-border bg-card/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle size={11} className="text-amber-400" />
                    <h3 className="text-[10.5px] uppercase tracking-[0.14em] font-mono font-semibold text-foreground/85 m-0">
                      Bounce shape
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {categoryStats.map((c) => (
                      <CategoryPill key={c.category} stat={c} />
                    ))}
                  </div>
                  <p className="text-[10.5px] text-foreground/45 italic leading-snug">
                    Healthy shotgun outreach looks like lots of{" "}
                    <span className="text-foreground/65">Bad recipient</span> —
                    that just means the pattern was wrong. Anything in the
                    <span className="text-destructive/85"> Alarming </span>
                    bucket is host-side enforcement and needs your eyes on it.
                  </p>
                </section>
              )}

              {/* ── RECENT BOUNCES DETAIL ────────────────────────── */}
              {classifications.length > 0 && (
                <section className="rounded-sm border border-border bg-card/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Mail size={11} className="text-destructive/85" />
                    <h3 className="text-[10.5px] uppercase tracking-[0.14em] font-mono font-semibold text-foreground/85 m-0">
                      Recent bounces ({classifications.length})
                    </h3>
                  </div>
                  <div className="space-y-1.5">
                    {classifications.slice(0, 20).map((c) => (
                      <BounceRow key={c.bounce.bounce_message_id} c={c} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* ── AUTOMATION LOG PLACEHOLDER ─────────────────────────── */}
      <section className="rounded-sm border border-dashed border-border bg-card/40 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Loader2 size={11} className="text-foreground/40" />
          <h3 className="text-[10.5px] uppercase tracking-[0.14em] font-mono font-semibold text-foreground/55 m-0">
            Axon automation log (coming soon)
          </h3>
        </div>
        <p className="text-[11px] text-foreground/55 leading-snug">
          When Axon takes over list-generation and sending end-to-end, this
          panel will surface every autonomous action: list refreshes,
          batches sent, bounces handled, follow-ups scheduled. The intent is
          a one-glance trust check before you step away from the keyboard.
        </p>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────

function HeroStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "good" | "warning" | "bad" | "neutral";
}) {
  const toneText =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warning"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";
  const toneIcon =
    tone === "good"
      ? "text-emerald-400/85"
      : tone === "warning"
        ? "text-amber-400/85"
        : tone === "bad"
          ? "text-destructive/85"
          : "text-foreground/55";
  return (
    <div className="rounded-sm border border-border bg-card/70 px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className={toneIcon}>{icon}</span>
        <span className="text-[9.5px] uppercase tracking-[0.14em] font-mono text-foreground/45">
          {label}
        </span>
      </div>
      <div className={"text-[24px] font-bold leading-none mt-2 " + toneText}>
        {value}
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
    <div className="grid grid-cols-[120px_1fr_70px_55px] items-center gap-2.5">
      <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-foreground/65 truncate">
        {stat.pattern}
      </span>
      <div className="h-1 rounded-full bg-foreground/10 overflow-hidden">
        <div
          className={"h-full transition-all " + barTone}
          style={{ width: `${Math.max(2, ratePct)}%` }}
        />
      </div>
      <span className="text-[10.5px] font-mono tabular-nums text-foreground/55 text-right">
        {stat.sent - stat.bounced}/{stat.sent}
      </span>
      <span
        className={"text-[12px] font-bold tabular-nums text-right " + tone}
      >
        {ratePct}%
      </span>
    </div>
  );
}

function CategoryPill({
  stat,
  prominent = false,
}: {
  stat: CategoryStat;
  prominent?: boolean;
}) {
  const cls = stat.alarming
    ? prominent
      ? "border-destructive bg-destructive/[0.15] text-destructive"
      : "border-destructive/45 bg-destructive/[0.07] text-destructive/90"
    : "border-border bg-card/60 text-foreground/75";
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 px-2 h-6 rounded-sm border text-[10.5px] uppercase tracking-[0.1em] font-mono font-semibold " +
        cls
      }
    >
      {stat.label}
      <span className="opacity-75 tabular-nums">×{stat.count}</span>
    </span>
  );
}

function BounceRow({
  c,
}: {
  c: { category: BounceCategory; bounce: { failed_email: string; bounce_time_iso: string; reason_snippet: string; bounce_message_id: string } };
}) {
  const alarming =
    c.category === "account_suspended" ||
    c.category === "policy_block" ||
    c.category === "rate_limit" ||
    c.category === "misconfigured";
  const border = alarming
    ? "border-destructive/45 bg-destructive/[0.05]"
    : "border-border bg-card/50";
  return (
    <div className={"rounded-sm border px-3 py-2 " + border}>
      <div className="flex items-center gap-2">
        <Mail
          size={10}
          className={
            alarming
              ? "text-destructive/90 flex-shrink-0"
              : "text-foreground/45 flex-shrink-0"
          }
        />
        <span className="text-[11.5px] font-mono text-foreground/85 truncate flex-1">
          {c.bounce.failed_email}
        </span>
        <span
          className={
            alarming
              ? "text-[9.5px] uppercase tracking-[0.12em] font-mono font-bold text-destructive/90"
              : "text-[9.5px] uppercase tracking-[0.12em] font-mono text-foreground/45"
          }
        >
          {c.category.replace(/_/g, " ")}
        </span>
        <span className="text-[9.5px] font-mono tabular-nums text-foreground/35 flex-shrink-0">
          {new Date(c.bounce.bounce_time_iso).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </span>
      </div>
      {c.bounce.reason_snippet && (
        <div className="text-[10.5px] text-foreground/55 line-clamp-2 mt-1 ml-5 leading-snug">
          {c.bounce.reason_snippet}
        </div>
      )}
    </div>
  );
}
