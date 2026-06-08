/**
 * InvestorCard.tsx — single tile in the Fundraise card grid.
 *
 * Visual hierarchy (top to bottom):
 *   · Priority rail (left edge tint — P0 brand red, P1 amber, etc)
 *   · Firm name + pipeline stage pill
 *   · Thesis preview (2-line clamp)
 *   · Stage focus chips + check size
 *   · Footer: fit score bar + partner count + last_outreach stamp
 *
 * Click the card → opens the right-slide detail drawer.
 */

import { Users, MapPin, Clock } from "lucide-react";

import {
  formatCheckSize,
  PIPELINE_STAGE_LABEL,
  type InvestorListEntry,
} from "@/stores/investors";

// Pipeline stage → tint pair. Stages further along the funnel get
// warmer / brighter colors so the grid reads as a soft progression.
const STAGE_TINT: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  prospected:        { bg: "bg-foreground/[0.04]", text: "text-foreground/55", border: "border-border/60" },
  researched:        { bg: "bg-sky-500/[0.10]",    text: "text-sky-400",       border: "border-sky-500/25" },
  reaching_out:      { bg: "bg-amber-500/[0.10]",  text: "text-amber-400",     border: "border-amber-500/25" },
  replied:           { bg: "bg-purple-500/[0.10]", text: "text-purple-400",    border: "border-purple-500/25" },
  meeting_scheduled: { bg: "bg-violet-500/[0.10]", text: "text-violet-400",    border: "border-violet-500/25" },
  met:               { bg: "bg-blue-500/[0.10]",   text: "text-blue-400",      border: "border-blue-500/25" },
  considering:       { bg: "bg-emerald-500/[0.10]",text: "text-emerald-400",   border: "border-emerald-500/25" },
  passed:            { bg: "bg-foreground/[0.04]", text: "text-foreground/40", border: "border-border/40" },
  closed:            { bg: "bg-emerald-500/[0.18]",text: "text-emerald-300",   border: "border-emerald-500/40" },
};

// Priority rail color (left edge). P0 = brand red, P3 = barely visible.
const PRIORITY_RAIL: Record<0 | 1 | 2 | 3, string> = {
  0: "bg-primary",
  1: "bg-amber-500/80",
  2: "bg-foreground/15",
  3: "bg-foreground/5",
};

interface Props {
  investor: InvestorListEntry;
  onOpen: () => void;
}

export function InvestorCard({ investor, onOpen }: Props) {
  const tint = STAGE_TINT[investor.pipeline_stage] ?? STAGE_TINT.prospected;
  const rail = PRIORITY_RAIL[investor.priority];

  // "12d ago" / "today" / "—" formatter. Used for last_outreach_at.
  const lastOutreach = (() => {
    if (!investor.last_outreach_at) return null;
    const ms = Date.now() - new Date(investor.last_outreach_at).getTime();
    if (ms < 0) return null;
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    if (days === 0) return "today";
    if (days === 1) return "1d ago";
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  })();

  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onOpen}
        className="group relative w-full text-left rounded-sm border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-colors p-3.5 min-h-[160px] flex flex-col gap-2 cursor-pointer"
      >
        {/* Priority rail on the left edge */}
        <span
          aria-hidden="true"
          className={`absolute left-0 top-0 bottom-0 w-[3px] ${rail} rounded-l-sm`}
        />

        {/* ── Row 1: firm name + stage pill ──────────────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-[13.5px] font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors m-0">
              {investor.company_name}
            </h3>
            {investor.hq_location && (
              <p className="text-[10.5px] text-foreground/45 mt-0.5 flex items-center gap-1">
                <MapPin size={9} />
                {investor.hq_location}
              </p>
            )}
          </div>
          <span
            className={`flex-shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full border text-[9.5px] uppercase tracking-[0.1em] font-semibold ${tint.bg} ${tint.text} ${tint.border}`}
          >
            {PIPELINE_STAGE_LABEL[investor.pipeline_stage]}
          </span>
        </div>

        {/* ── Row 2: thesis preview ──────────────────────── */}
        <p className="text-[11.5px] text-foreground/60 line-clamp-2 leading-snug">
          {investor.thesis_md?.trim()
            ? investor.thesis_md
            : (
              <span className="italic text-foreground/35">
                No thesis recorded yet.
              </span>
            )}
        </p>

        {/* ── Row 3: stage focus chips + check size ──────── */}
        <div className="flex flex-wrap items-center gap-1 min-h-[16px]">
          {investor.stage_focus.slice(0, 3).map((s) => (
            <span
              key={s}
              className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-foreground/[0.04] text-[9.5px] uppercase tracking-[0.1em] text-foreground/55"
            >
              {s.replace(/_/g, " ")}
            </span>
          ))}
          {investor.stage_focus.length > 3 && (
            <span className="text-[9.5px] text-foreground/35">
              +{investor.stage_focus.length - 3}
            </span>
          )}
          <span className="ml-auto text-[10.5px] font-mono tabular-nums text-foreground/50">
            {formatCheckSize(
              investor.check_size_min_cents,
              investor.check_size_max_cents,
            )}
          </span>
        </div>

        {/* ── Footer: fit + partners + last outreach ─────── */}
        <div className="mt-auto pt-2 border-t border-dashed border-border/60 flex items-center justify-between gap-2">
          <FitBar value={investor.fit_score} />
          <div className="flex items-center gap-2.5 text-[10.5px] text-foreground/45 font-mono tabular-nums">
            <span className="inline-flex items-center gap-1">
              <Users size={9} />
              {investor.partner_count}
            </span>
            {lastOutreach ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={9} />
                {lastOutreach}
              </span>
            ) : (
              <span className="text-foreground/30 italic">no outreach</span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

// Tiny horizontal fit-score bar. Color shifts from neutral → primary
// as the score climbs so a great-fit investor visually pops.
function FitBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const tone =
    pct >= 75
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-primary"
        : pct >= 25
          ? "bg-amber-500/80"
          : "bg-foreground/25";
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[9.5px] uppercase tracking-[0.1em] text-foreground/40 font-mono">
        Fit
      </span>
      <div className="w-12 h-1 bg-foreground/[0.08] rounded-full overflow-hidden">
        <div
          className={`h-full ${tone} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono tabular-nums text-foreground/50">
        {pct}
      </span>
    </div>
  );
}
