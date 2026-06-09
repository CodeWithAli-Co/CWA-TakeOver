/**
 * KanbanInvestorCard.tsx -- compact editorial card for the
 * InvestorKanban columns.
 *
 * Three jobs:
 *   1. Render the investor (firm, priority rail, partners, age, fit)
 *   2. Surface a Quick Send status on the card itself so the
 *      operator sees their click registered without needing to flip
 *      to the Outreach tab. The previous bottom-right toast was
 *      removed; this is the on-card replacement.
 *   3. Guard against spam-clicks: disable the Quick Send button
 *      while any entry for THIS investor is in flight (queued /
 *      drafting / sending). The operator can still click the card
 *      to open the drawer; only the bolt is gated.
 *
 * "Sent" indicator auto-fades from the card 60 seconds after the
 * final send completes so a row that fired five minutes ago doesn't
 * stay green forever. "Failed" sticks until the operator either
 * dismisses it from the Outreach tab or re-sends successfully.
 */

import { useEffect, useState } from "react";
import { Users, Zap, Clock, Loader2, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import type { InvestorListEntry } from "@/stores/investors";
import {
  useQuickSendStore,
  type QuickSendEntry,
} from "./quickSendStore";

interface Props {
  investor: InvestorListEntry;
  onOpen: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onQuickSend?: () => void;
}

const PRIORITY_RAIL: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-primary shadow-[0_0_8px_rgba(220,38,38,0.45)]",
  1: "bg-amber-500/85 shadow-[0_0_6px_rgba(245,158,11,0.4)]",
  2: "bg-foreground/20",
  3: "bg-foreground/8",
};

const PRIORITY_LABEL: Record<0 | 1 | 2 | 3, string> = {
  0: "P0",
  1: "P1",
  2: "P2",
  3: "P3",
};

const FRESH_SENT_WINDOW_MS = 60_000;

export function KanbanInvestorCard({
  investor,
  onOpen,
  onDragStart,
  onDragEnd,
  onQuickSend,
}: Props) {
  const rail = PRIORITY_RAIL[investor.priority];
  const ageDays =
    investor.last_outreach_at != null
      ? Math.floor(
          (Date.now() - new Date(investor.last_outreach_at).getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;

  // Most-relevant Quick Send entry for THIS investor. Priority:
  //   1. Any in-flight entry (queued / drafting / sending) -- guards
  //      the bolt button + shows live status.
  //   2. A "sent" entry within the last 60s -- shows the green
  //      confirmation that auto-fades.
  //   3. A "failed" entry -- shows persistently until dismissed
  //      elsewhere.
  const latest = useQuickSendStore((s) =>
    pickLatestForInvestor(s.entries, investor.id),
  );
  // Force a re-render every 1s so the queued countdown ticks down
  // smoothly + the relative "Sent · 12s ago" label updates + the
  // fresh-sent window can age out. 1s is cheap and matches the
  // resolution of "Sent just now -> Sent · 5s ago".
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  // Immediate click-pending state. quickSendForInvestor runs an
  // async Supabase lookup BEFORE enqueue() lands the entry in the
  // store -- between the click and the lookup completing, the card
  // would look frozen for a second or two and the operator might
  // spam-click. We flip `pendingClick` on the moment they click and
  // clear it either when the store entry shows up or after 8s as a
  // safety so a failed lookup doesn't leave the hint stuck.
  const [pendingClick, setPendingClick] = useState(false);
  useEffect(() => {
    if (latest) setPendingClick(false);
  }, [latest]);
  useEffect(() => {
    if (!pendingClick) return;
    const t = setTimeout(() => setPendingClick(false), 8_000);
    return () => clearTimeout(t);
  }, [pendingClick]);

  const isInFlight =
    latest != null &&
    (latest.status === "queued" ||
      latest.status === "drafting" ||
      latest.status === "sending");
  const isFreshSent =
    latest != null &&
    latest.status === "sent" &&
    latest.finishedAt != null &&
    Date.now() - latest.finishedAt < FRESH_SENT_WINDOW_MS;
  const isFailed = latest != null && latest.status === "failed";

  const showStatus = pendingClick || isInFlight || isFreshSent || isFailed;

  return (
    <article
      role="button"
      tabIndex={0}
      draggable
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={
        "relative cursor-grab active:cursor-grabbing rounded-md border bg-card hover:bg-card/90 transition-all p-2.5 pl-3.5 " +
        (isFreshSent
          ? "border-emerald-500/40 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"
          : isFailed
            ? "border-destructive/35"
            : isInFlight || pendingClick
              ? "border-primary/30"
              : "border-border hover:border-foreground/25")
      }
    >
      {/* Priority rail */}
      <span
        className={"absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r " + rail}
        aria-hidden
      />

      {/* Firm name + priority pip + bolt */}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[12.5px] font-semibold text-foreground leading-tight m-0 truncate flex-1 tracking-tight">
          {investor.company_name}
        </h4>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onQuickSend && (
            <button
              type="button"
              disabled={isInFlight || pendingClick}
              onClick={(e) => {
                e.stopPropagation();
                if (isInFlight || pendingClick) return;
                setPendingClick(true);
                onQuickSend();
              }}
              title={
                isInFlight
                  ? "Already in the send queue — see the Outreach tab"
                  : pendingClick
                    ? "Looking up partner…"
                    : isFreshSent
                      ? "Recently sent — bolt again to send another"
                      : "Quick send — Axon drafts + Gmail sends in the background"
              }
              aria-label="Quick send"
              aria-disabled={isInFlight || pendingClick}
              className={
                "inline-flex items-center justify-center w-5 h-5 rounded-sm transition-colors " +
                (isInFlight || pendingClick
                  ? "text-foreground/20 cursor-not-allowed"
                  : isFreshSent
                    ? "text-emerald-400/80 hover:bg-emerald-500/10"
                    : "text-foreground/40 hover:text-primary hover:bg-primary/10")
              }
            >
              {pendingClick ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <Zap size={11} />
              )}
            </button>
          )}
          <span className="text-[9.5px] font-mono uppercase tracking-[0.1em] text-foreground/45">
            {PRIORITY_LABEL[investor.priority]}
          </span>
        </div>
      </div>

      {/* Partner count + last-outreach age */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] font-mono text-foreground/45">
        <span className="inline-flex items-center gap-1">
          <Users size={9} />
          {investor.partner_count}
        </span>
        <span className="tabular-nums">
          {ageDays == null
            ? "—"
            : ageDays === 0
              ? "today"
              : `${ageDays}d ago`}
        </span>
      </div>

      {/* Fit bar -- tiny single-line gauge */}
      <FitBar value={investor.fit_score} />

      {/* Quick-Send status row -- appears only when there's
        * something to say. The fade-in is implicit via the conditional
        * render; the wrapper handles the layout shift smoothly via
        * mt-1.5 spacing that's only added when shown. */}
      {showStatus &&
        (pendingClick && !latest ? (
          <PendingClickRow />
        ) : latest ? (
          <SendStatusRow entry={latest} freshSent={isFreshSent} />
        ) : null)}
    </article>
  );
}

/** Immediate hint shown the moment the bolt is clicked, before
 *  quickSendForInvestor's Supabase lookup lands the entry in the
 *  store. Identical visual chrome to the real status row so the
 *  transition is seamless. */
function PendingClickRow() {
  return (
    <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center gap-1.5 text-[10px] font-mono tracking-[0.04em] text-primary/85">
      <Loader2 size={9} className="animate-spin" />
      <span className="truncate">Looking up partner…</span>
    </div>
  );
}

function SendStatusRow({
  entry,
  freshSent,
}: {
  entry: QuickSendEntry;
  freshSent: boolean;
}) {
  let icon: React.ReactNode = null;
  let label: React.ReactNode = null;
  let cls = "text-foreground/55";

  if (entry.status === "queued") {
    const s = Math.max(0, Math.ceil((entry.notBefore - Date.now()) / 1000));
    icon = <Clock size={9} />;
    label = `Queued · sends in ${fmt(s)}`;
  } else if (entry.status === "drafting") {
    icon = <Loader2 size={9} className="animate-spin" />;
    label = "Axon is drafting…";
    cls = "text-primary/85";
  } else if (entry.status === "sending") {
    icon = <Send size={9} />;
    label = "Sending via Gmail…";
    cls = "text-primary/85";
  } else if (freshSent) {
    icon = <CheckCircle2 size={9} />;
    const ago = entry.finishedAt
      ? Math.max(0, Math.floor((Date.now() - entry.finishedAt) / 1000))
      : 0;
    label = ago < 5 ? "Sent just now" : `Sent · ${ago}s ago`;
    cls = "text-emerald-400";
  } else if (entry.status === "failed") {
    icon = <AlertTriangle size={9} />;
    label = entry.error
      ? `Failed · ${entry.error.length > 32 ? entry.error.slice(0, 32) + "…" : entry.error}`
      : "Failed";
    cls = "text-destructive";
  }

  return (
    <div
      className={
        "mt-2 pt-1.5 border-t border-border/40 flex items-center gap-1.5 text-[10px] font-mono tracking-[0.04em] " +
        cls
      }
    >
      {icon}
      <span className="truncate">{label}</span>
    </div>
  );
}

function FitBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= 75
      ? "bg-emerald-500/75 shadow-[0_0_4px_rgba(16,185,129,0.3)]"
      : pct >= 50
        ? "bg-primary/75 shadow-[0_0_4px_rgba(220,38,38,0.25)]"
        : pct >= 25
          ? "bg-amber-500/70"
          : "bg-foreground/20";
  return (
    <div className="mt-2 h-[2px] rounded-full bg-foreground/8 overflow-hidden">
      <div
        className={"h-full transition-all " + tone}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────

function pickLatestForInvestor(
  entries: Map<string, QuickSendEntry>,
  investorId: string,
): QuickSendEntry | null {
  let bestInFlight: QuickSendEntry | null = null;
  let bestTerminal: QuickSendEntry | null = null;
  for (const e of entries.values()) {
    if (e.investor_id !== investorId) continue;
    const inFlight =
      e.status === "queued" ||
      e.status === "drafting" ||
      e.status === "sending";
    if (inFlight) {
      if (!bestInFlight || e.startedAt > bestInFlight.startedAt) {
        bestInFlight = e;
      }
    } else {
      const t = e.finishedAt ?? e.startedAt;
      const cur = bestTerminal
        ? bestTerminal.finishedAt ?? bestTerminal.startedAt
        : 0;
      if (t > cur) bestTerminal = e;
    }
  }
  return bestInFlight ?? bestTerminal;
}

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
