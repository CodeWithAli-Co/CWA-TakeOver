/**
 * UpcomingHiringMeetingsWidget.tsx
 *
 * A compact widget for the /schedule page that shows the next few
 * candidate meetings (interviews + onboarding sessions + check-ins)
 * pulled from the candidate_meetings table.
 *
 * Independent from the existing NewSchedule employee-calendar UI —
 * mounts above it as its own card so the user can see "what's
 * coming with candidates" at a glance without having to context-
 * switch into /hiring or /onboarding.
 */

import { useState } from "react";
import { Loader2, ChevronRight, Clock, ExternalLink, Calendar, CalendarPlus, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import supabase from "@/MyComponents/supabase";
import { ActiveUser } from "@/stores/query";
import { shiftKeys } from "@/stores/shifts";
import { useCompanyFilter } from "@/stores/store";
import {
  useUpcomingHiringMeetings,
  formatMeetingTime,
  KIND_LABELS,
  KIND_COLORS,
  type CandidateMeeting,
} from "./onboardingQueries";

export function UpcomingHiringMeetingsWidget({ days = 14 }: { days?: number } = {}) {
  const { data, isLoading } = useUpcomingHiringMeetings(days);
  const meetings = data ?? [];

  return (
    <div className="rounded-sm border border-border bg-[#0a0a0a] overflow-hidden">
      <header className="px-5 py-3 border-b border-border flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.12em] text-foreground/30 uppercase">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
            HIRING · UPCOMING MEETINGS
          </div>
          <h3 className="text-[13px] font-bold text-foreground mt-0.5">
            Next {days} days
            {!isLoading && (
              <span className="text-foreground/40 font-normal ml-2">
                · {meetings.length} {meetings.length === 1 ? "meeting" : "meetings"}
              </span>
            )}
          </h3>
        </div>
        <a
          href="/hiring"
          className="text-[11px] font-semibold text-red-400 hover:underline inline-flex items-center gap-1"
        >
          Hiring inbox <ChevronRight size={11} />
        </a>
      </header>

      {isLoading ? (
        <div className="p-6 flex items-center justify-center text-foreground/40 text-sm">
          <Loader2 size={14} className="animate-spin mr-2" /> Loading…
        </div>
      ) : meetings.length === 0 ? (
        <div className="p-6 text-center text-[12px] text-foreground/40 leading-relaxed">
          <Calendar size={18} className="mx-auto mb-2 opacity-50" />
          No hiring meetings scheduled in the next {days} days.
          <br />
          Schedule one from <a href="/hiring" className="text-red-400 hover:underline">/hiring</a> or <a href="/onboarding" className="text-red-400 hover:underline">/onboarding</a>.
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.04]">
          {meetings.slice(0, 8).map((m) => (
            <MeetingRow key={m.id} m={m} />
          ))}
          {meetings.length > 8 && (
            <li className="px-5 py-2 text-[11px] text-foreground/40 text-center">
              + {meetings.length - 8} more
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function MeetingRow({ m }: { m: CandidateMeeting }) {
  const name = m.candidates?.full_name ?? "Candidate";
  const role = m.candidates?.role_slug ?? "";
  const { data: meRows } = ActiveUser();
  const me = (meRows?.[0] as any) ?? null;
  const { activeCompany } = useCompanyFilter();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add this meeting to the operator's timesheet as a shift. The
  // shifts table already supports type="meeting"; we map the row
  // 1:1 — start = scheduled_at, end = scheduled_at + duration_min.
  // This is the manual bridge that closes the loop until Calendly
  // OAuth + webhook (task #12) auto-creates these.
  const handleAdd = async () => {
    if (!me?.supa_id) {
      setError("Sign in first.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const starts = new Date(m.scheduled_at);
      const ends = new Date(starts.getTime() + m.duration_min * 60_000);
      const company = activeCompany === "simplicityFunds" ? "simplicity" : "CodeWithAli";
      const { error: insErr } = await supabase.from("shifts").insert({
        user_supa_id: me.supa_id,
        username: me.username,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        type: "meeting",
        title: m.title || `Meeting with ${name}`,
        notes: m.description ?? null,
        location: m.meeting_url ?? m.calendly_event_url ?? null,
        status: "scheduled",
        is_billable: false,
        company,
        created_by: me.supa_id,
      });
      if (insErr) throw insErr;
      qc.invalidateQueries({ queryKey: shiftKeys.all });
      setAdded(true);
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <li className="px-5 py-3 hover:bg-white/[0.015] transition-colors flex items-center gap-3">
      <div className={"px-2 py-1 rounded-sm border text-[9.5px] font-bold uppercase tracking-wider flex-shrink-0 " + KIND_COLORS[m.kind]}>
        {KIND_LABELS[m.kind]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-foreground truncate">
          {name}
          {role && <span className="text-foreground/40 font-normal ml-1.5">· {role.replace(/-/g, " ")}</span>}
        </div>
        <div className="text-[11px] text-foreground/50 flex items-center gap-1.5 mt-0.5">
          <Clock size={10} />
          {formatMeetingTime(m.scheduled_at)} · {m.duration_min}m
          {m.attendees?.length > 0 && (
            <span className="text-foreground/35"> · {m.attendees.length} attendee{m.attendees.length === 1 ? "" : "s"}</span>
          )}
          {error && <span className="text-amber-400 ml-1">· {error}</span>}
        </div>
      </div>

      {added ? (
        <a
          href="/timesheet"
          className="text-[10.5px] font-semibold text-emerald-400 inline-flex items-center gap-1 flex-shrink-0"
          title="View in timesheet"
        >
          <Check size={10} /> Added
        </a>
      ) : (
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="text-[10.5px] font-semibold text-foreground/60 hover:text-red-400 inline-flex items-center gap-1 flex-shrink-0 disabled:opacity-40"
          title="Add this meeting to your timesheet"
        >
          {adding ? <Loader2 size={10} className="animate-spin" /> : <CalendarPlus size={10} />}
          To timesheet
        </button>
      )}

      {m.calendly_event_url && (
        <a
          href={m.calendly_event_url}
          target="_blank"
          rel="noreferrer"
          className="text-[10.5px] font-semibold text-foreground/60 hover:text-red-400 inline-flex items-center gap-1 flex-shrink-0"
        >
          Calendly <ExternalLink size={10} />
        </a>
      )}
    </li>
  );
}
