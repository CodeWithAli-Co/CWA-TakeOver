/**
 * MeetingsPanel.tsx — Provider-neutral meetings surface on
 * /operations.
 *
 * Reads from `useUnifiedMeetings()` which merges every connected
 * meetings provider into a single chronological list. Each row
 * carries a `<SourceBadge>` so the operator can see where the
 * meeting lives at a glance. Filter chips at the top let the
 * operator narrow to one provider when they want to.
 *
 * Auto-hides when no meetings providers are connected — same
 * null-state contract as ConnectorsStrip and SlackPulsePanel,
 * so fresh installs don't see an empty card.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  Loader2,
  AlertCircle,
  Clock,
  ExternalLink,
  Users,
} from "lucide-react";
import { useUnifiedMeetings, type UnifiedMeeting } from "@/lib/unified/meetings";
import { SourceBadge } from "@/lib/unified/SourceBadge";
import { getSourceMeta } from "@/lib/unified/types";

const MAX_VISIBLE = 8;

export function MeetingsPanel() {
  const { meetings, providerStatus, isLoading, isError } = useUnifiedMeetings({
    limit: 50,
  });
  const [filter, setFilter] = useState<string | "all">("all");
  const [showAll, setShowAll] = useState(false);

  // Connected providers — filter chips only render for providers
  // that are actually wired up.
  const connectedProviders = useMemo(
    () => providerStatus.filter((p) => p.connected),
    [providerStatus],
  );

  // Apply the filter, then cap visible rows so the panel doesn't
  // dominate the page.
  const visible = useMemo(() => {
    const filtered =
      filter === "all"
        ? meetings
        : meetings.filter((m) => m.source === filter);
    return showAll ? filtered : filtered.slice(0, MAX_VISIBLE);
  }, [meetings, filter, showAll]);

  const filteredCount =
    filter === "all"
      ? meetings.length
      : meetings.filter((m) => m.source === filter).length;

  // Auto-hide when no providers connected. Single-provider tenants
  // (Cal.com only) still see the panel — the filter chips just
  // don't appear since there's only one source.
  if (connectedProviders.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl border-xs border-border-soft bg-foreground/[0.02] px-4 py-3"
    >
      <header className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/85">
            Meetings
          </span>
          <span className="text-[10px] font-semibold text-text-tertiary tabular-nums">
            · {filteredCount} upcoming
          </span>
        </div>

        {/* Filter chips — one per connected provider, plus "All".
         *  Hidden when there's only one provider connected (no
         *  filtering to do). */}
        {connectedProviders.length > 1 && (
          <div className="flex items-center gap-1">
            <FilterChip
              active={filter === "all"}
              onClick={() => setFilter("all")}
              label="All"
            />
            {connectedProviders.map((p) => (
              <FilterChip
                key={p.source}
                active={filter === p.source}
                onClick={() => setFilter(p.source)}
                label={getSourceMeta(p.source)?.name ?? p.source}
                source={p.source}
              />
            ))}
          </div>
        )}
      </header>

      {/* Body */}
      {isLoading && meetings.length === 0 ? (
        <div className="flex items-center gap-2 px-2 py-3 text-[11.5px] text-text-tertiary">
          <Loader2 className="h-3 w-3 animate-spin" />
          Reading your calendar…
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 px-2 py-2 text-[11.5px] text-warning">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Some calendars failed to load. Try reconnecting in Settings.</span>
        </div>
      ) : visible.length === 0 ? (
        <p className="text-[11.5px] text-text-tertiary italic px-2 py-3">
          Nothing on the calendar yet.
        </p>
      ) : (
        <ul className="divide-y divide-border/10">
          {visible.map((m) => (
            <MeetingRow key={m.id} meeting={m} />
          ))}
        </ul>
      )}

      {/* Show-more button when capped */}
      {!showAll && filteredCount > MAX_VISIBLE && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary hover:text-foreground transition-colors"
        >
          Show {filteredCount - MAX_VISIBLE} more →
        </button>
      )}
    </motion.section>
  );
}

// ────────────────────────────────────────────────
// MeetingRow — single meeting line in the list
// ────────────────────────────────────────────────

function MeetingRow({ meeting }: { meeting: UnifiedMeeting }) {
  const start = new Date(meeting.starts);
  const end = new Date(meeting.ends);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);

  const isToday =
    start.toDateString() === new Date().toDateString();
  const dayLabel = isToday
    ? "Today"
    : start.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const cancelled = meeting.status === "cancelled";
  const attendeeLabel =
    meeting.attendees.length === 0
      ? null
      : meeting.attendees.length === 1
        ? meeting.attendees[0]!.name || meeting.attendees[0]!.email
        : `${meeting.attendees[0]!.name || meeting.attendees[0]!.email} +${meeting.attendees.length - 1}`;

  return (
    <li
      className={`py-2 px-1 grid grid-cols-[auto_1fr_auto] items-center gap-3 ${
        cancelled ? "opacity-50" : ""
      }`}
    >
      {/* Left: when */}
      <div className="text-right shrink-0 min-w-[64px]">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
          {dayLabel}
        </p>
        <p className="text-[12.5px] font-semibold tabular-nums text-foreground">
          {timeLabel}
        </p>
      </div>

      {/* Middle: what + who */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p
            className={`text-[13px] font-semibold truncate ${
              cancelled ? "line-through text-text-tertiary" : "text-foreground"
            }`}
          >
            {meeting.title}
          </p>
          <SourceBadge source={meeting.source} size="xs" />
        </div>
        <div className="flex items-center gap-3 text-[10.5px] text-text-tertiary mt-0.5">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {minutes} min
          </span>
          {attendeeLabel && (
            <span className="inline-flex items-center gap-1 truncate">
              <Users className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{attendeeLabel}</span>
            </span>
          )}
        </div>
      </div>

      {/* Right: external link */}
      {meeting.url && (
        <a
          href={meeting.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-text-tertiary hover:text-foreground transition-colors shrink-0"
          title="Open in provider"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </li>
  );
}

// ────────────────────────────────────────────────
// FilterChip — provider filter at the top
// ────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  label,
  source,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  source?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10.5px] font-semibold transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-foreground/[0.04] text-text-secondary hover:text-foreground hover:bg-foreground/[0.08]"
      }`}
    >
      {source && <SourceBadge source={source} size="xs" variant="dot" />}
      {label}
    </button>
  );
}

export default MeetingsPanel;
