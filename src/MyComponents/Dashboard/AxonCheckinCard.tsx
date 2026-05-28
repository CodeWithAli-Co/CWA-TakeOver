/**
 * AxonCheckinCard.tsx — Row 4 left zone (60% width, full row height).
 *
 * v1 SHELL: this is the layout skeleton. Demo data is rendered
 * unconditionally so we can review proportions and visual structure
 * before wiring the engine, Supabase, voice input, or the expand
 * modal. Day 2 turns this into a functional component:
 *
 *   · prompt + acknowledgement generated via the Axon personality
 *     engine, persisted to axon_checkins as a pending row per day
 *   · voice button feeds the existing voice-input pipeline
 *   · reflection chips expand into a modal
 *   · empty state for first-time users + onboarding copy
 *
 * Privacy invariant — content is owner-only at the RLS layer (see
 * migrations/row4_redux_baseline.sql). The lock chip in the header
 * is the user-visible promise of that invariant.
 */

import { Lock, Mic, Send, Sparkles, Sun, Moon, SkipForward } from "lucide-react";
import { BentoCard } from "./BentoCard";
import { ActiveUser } from "@/stores/query";
import { DEMO_CHECKINS } from "@/stores/demoMode";

function timeOfDayBand(): "morning" | "midday" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 11) return "morning";
  if (h < 14) return "midday";
  if (h < 18) return "afternoon";
  return "evening";
}

function promptForBand(band: ReturnType<typeof timeOfDayBand>, firstName: string) {
  const name = firstName ? `, ${firstName}` : "";
  switch (band) {
    case "morning":
      return `Good morning${name}. What are you focused on today?`;
    case "midday":
      return `How's the day going so far${name}?`;
    case "afternoon":
      return `What are you working on this afternoon${name}?`;
    case "evening":
      return `How did today go${name}? Anything carrying over to tomorrow?`;
  }
}

function relativeDayLabel(daysAgo: number): string {
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toLocaleDateString(undefined, { weekday: "short" });
  }
  return `${daysAgo}d ago`;
}

export function AxonCheckinCard() {
  const { data: meRows } = ActiveUser();
  const username: string =
    (meRows?.[0] as any)?.username ?? "";
  const firstName = username.split(/[ ._-]/)[0] ?? "";

  const band = timeOfDayBand();
  const prompt = promptForBand(band, firstName);

  // SHELL: always use demo reflections. Day 2 swaps to live data.
  const reflections = DEMO_CHECKINS;

  return (
    <BentoCard
      label="DAILY CHECK-IN"
      withHeaderBar
      className="h-full"
    >
      <div className="flex flex-col h-full gap-3">
        {/* Privacy banner */}
        <div className="flex items-center gap-1.5 text-text-tertiary">
          <Lock className="h-3 w-3" />
          <span className="text-[10.5px] tracking-wide">
            Private — only you and Axon see this
          </span>
        </div>

        {/* Prompt + composer */}
        <div className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft p-3">
          <div className="flex items-start gap-2 mb-2">
            <div className="mt-0.5 flex items-center justify-center h-5 w-5 rounded-md bg-primary/15 text-primary shrink-0">
              <Sparkles className="h-3 w-3" />
            </div>
            <p className="text-[13px] text-foreground/90 leading-snug">
              {prompt}
            </p>
          </div>

          <textarea
            placeholder="Type your reflection…"
            rows={3}
            disabled
            className="w-full bg-transparent text-[12.5px] text-foreground placeholder:text-text-tertiary border-xs border-border-soft rounded-md p-2 outline-none focus:border-primary/40 resize-none"
          />

          <div className="flex items-center justify-between mt-2">
            <button
              type="button"
              disabled
              className="flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-foreground/70 transition-colors"
            >
              <SkipForward className="h-3 w-3" />
              Skip today
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 text-[11px] text-foreground/80 border-xs border-border-soft rounded-md px-2.5 py-1 hover:bg-foreground/5 transition-colors"
              >
                <Mic className="h-3 w-3" />
                Voice
              </button>
              <button
                type="button"
                disabled
                className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-primary rounded-md px-3 py-1 hover:bg-primary/90 transition-colors"
              >
                <Send className="h-3 w-3" />
                Reply
              </button>
            </div>
          </div>
        </div>

        {/* Recent reflections — chips */}
        <div className="flex-1 min-h-0">
          <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
            Recent reflections
          </div>
          <div className="space-y-1.5">
            {reflections.map((r) => {
              const Icon = r.time_of_day === "evening" ? Moon : Sun;
              const preview = r.entry
                .split(/\s+/)
                .slice(0, 10)
                .join(" ")
                .concat(r.entry.split(/\s+/).length > 10 ? "…" : "");
              return (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left flex items-center gap-2 rounded-md border-xs border-border-soft bg-foreground/[0.015] hover:bg-foreground/[0.04] px-2 py-1.5 transition-colors"
                >
                  <Icon className="h-3 w-3 text-text-tertiary shrink-0" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary w-[64px] shrink-0">
                    {relativeDayLabel(r.days_ago)}
                  </span>
                  <span className="text-[11.5px] text-foreground/80 truncate">
                    {preview}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
