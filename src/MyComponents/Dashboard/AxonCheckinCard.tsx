/**
 * AxonCheckinCard.tsx — Row 4 left zone (60% width, full row height).
 *
 * Reads the current user's `axon_checkins` history via RLS-scoped
 * query. Owner-only — RLS at the DB layer ensures no other user
 * (including managers) ever sees content here.
 *
 * What works today:
 *   · Submit a reflection (Reply) — writes to axon_checkins with
 *     the time-of-day band, the prompt that was shown, and the
 *     user's entry. Axon acknowledgement stays null until the
 *     engine integration lands.
 *   · Skip today — writes a row with skipped=true so we don't keep
 *     asking on subsequent reloads the same day.
 *   · See your 3 most recent reflections inline.
 *
 * Deferred to a later pass:
 *   · Engine-generated prompts (today: hardcoded by time-of-day band)
 *   · Engine-generated acknowledgement (today: stays null on submit)
 *   · Voice input via the existing voice pipeline
 *   · Reflection chip → expand-modal
 *
 * Privacy invariant — see migrations/row4_redux_baseline.sql. The
 * lock chip in the header is the user-visible promise.
 */

import { useMemo, useState } from "react";
import { Lock, Mic, Send, Sparkles, Sun, Moon, SkipForward } from "lucide-react";
import { BentoCard } from "./BentoCard";
import {
  ActiveUser,
  useMyAxonCheckins,
  type AxonCheckinRow,
} from "@/stores/query";
import supabase from "@/MyComponents/supabase";
import { useQueryClient } from "@tanstack/react-query";

type TimeOfDay = "morning" | "midday" | "afternoon" | "evening";

function timeOfDayBand(): TimeOfDay {
  const h = new Date().getHours();
  if (h < 11) return "morning";
  if (h < 14) return "midday";
  if (h < 18) return "afternoon";
  return "evening";
}

function promptForBand(band: TimeOfDay, firstName: string) {
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

function relativeDayLabel(createdAt: string): string {
  const created = new Date(createdAt);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const ageMs =
    startOfToday -
    new Date(
      created.getFullYear(),
      created.getMonth(),
      created.getDate(),
    ).getTime();
  const daysAgo = Math.round(ageMs / (1000 * 60 * 60 * 24));
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) {
    return created.toLocaleDateString(undefined, { weekday: "short" });
  }
  return `${daysAgo}d ago`;
}

function previewText(entry: string | null): string {
  if (!entry) return "";
  const words = entry.split(/\s+/).filter(Boolean);
  return words.slice(0, 10).join(" ") + (words.length > 10 ? "…" : "");
}

/** Empty state shown when the user has no checkins yet — soft
 *  onboarding card per spec. */
function OnboardingCard() {
  return (
    <div className="rounded-lg bg-gradient-to-br from-primary/[0.06] via-transparent to-primary/[0.04] border-xs border-border-soft p-4">
      <div className="flex items-start gap-2 mb-2">
        <div className="mt-0.5 flex items-center justify-center h-6 w-6 rounded-md bg-primary/15 text-primary shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="text-[12.5px] text-foreground/90 leading-snug space-y-1.5">
          <p className="font-semibold text-foreground">
            Hey, I'm Axon. This space is just between us.
          </p>
          <p className="text-foreground/75">
            Every day, I'll ask what's on your mind. Your answers
            help me understand you and coach you better over time.
          </p>
          <p className="text-foreground/75">
            Anything you share here is private — your manager
            doesn't see it.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-[10.5px] text-text-tertiary pt-1 border-t border-border-soft/40">
        <Lock className="h-3 w-3" />
        Try replying to today's prompt above — your reflection is saved
        privately.
      </div>
    </div>
  );
}

export function AxonCheckinCard() {
  const { data: meRows } = ActiveUser();
  const username: string = (meRows?.[0] as any)?.username ?? "";
  const firstName = username.split(/[ ._-]/)[0] ?? "";
  const queryClient = useQueryClient();

  const { data: checkins = [], isLoading } = useMyAxonCheckins(10);

  // Submitted reflections only (skip pending + skipped rows).
  const submitted: AxonCheckinRow[] = useMemo(
    () =>
      checkins.filter((c) => c.entry && c.entry.trim().length > 0 && !c.skipped),
    [checkins],
  );
  const recent = submitted.slice(0, 3);
  const hasAnyHistory = submitted.length > 0;

  // "Did I already submit / skip today?" — used to lock the composer
  // after a reply so the user doesn't accidentally double-post.
  const todayBand = useMemo<TimeOfDay>(() => timeOfDayBand(), []);
  const todayPrompt = useMemo(
    () => promptForBand(todayBand, firstName),
    [todayBand, firstName],
  );
  const todaysCheckin = useMemo<AxonCheckinRow | undefined>(() => {
    const now = new Date();
    return checkins.find((c) => {
      const t = new Date(c.created_at);
      return (
        t.getFullYear() === now.getFullYear() &&
        t.getMonth() === now.getMonth() &&
        t.getDate() === now.getDate()
      );
    });
  }, [checkins]);

  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = body.trim();
  const alreadyDone = !!todaysCheckin;
  const canSubmit = trimmed.length > 0 && !submitting && !alreadyDone;

  async function getMyAuthId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id ?? null;
  }

  async function submitReply() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const userId = await getMyAuthId();
    if (!userId) {
      setError("Not signed in.");
      setSubmitting(false);
      return;
    }
    const { error: err } = await supabase.from("axon_checkins").insert({
      user_id: userId,
      prompt: todayPrompt,
      entry: trimmed,
      time_of_day: todayBand,
      skipped: false,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    setBody("");
    setSubmitting(false);
    void queryClient.invalidateQueries({ queryKey: ["axon_checkins"] });
  }

  async function submitSkip() {
    if (submitting || alreadyDone) return;
    setSubmitting(true);
    setError(null);
    const userId = await getMyAuthId();
    if (!userId) {
      setError("Not signed in.");
      setSubmitting(false);
      return;
    }
    const { error: err } = await supabase.from("axon_checkins").insert({
      user_id: userId,
      prompt: todayPrompt,
      entry: null,
      time_of_day: todayBand,
      skipped: true,
    });
    if (err) {
      setError(err.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    void queryClient.invalidateQueries({ queryKey: ["axon_checkins"] });
  }

  return (
    <BentoCard label="DAILY CHECK-IN" withHeaderBar className="h-full">
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
              {alreadyDone
                ? todaysCheckin?.skipped
                  ? "You skipped today's check-in. See you tomorrow."
                  : "You already replied today. Saved privately."
                : todayPrompt}
            </p>
          </div>

          {!alreadyDone && (
            <>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your reflection…"
                rows={3}
                disabled={submitting}
                className="w-full bg-transparent text-[12.5px] text-foreground placeholder:text-text-tertiary border-xs border-border-soft rounded-md p-2 outline-none focus:border-primary/40 resize-none"
              />

              {error && (
                <div className="mt-2 text-[11px] text-destructive bg-destructive/10 border-xs border-destructive/30 rounded-md px-2 py-1">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between mt-2">
                <button
                  type="button"
                  onClick={submitSkip}
                  disabled={submitting}
                  className="flex items-center gap-1.5 text-[11px] text-text-tertiary hover:text-foreground/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <SkipForward className="h-3 w-3" />
                  Skip today
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled
                    title="Voice comes online with the engine wiring"
                    className="flex items-center gap-1.5 text-[11px] text-foreground/60 border-xs border-border-soft rounded-md px-2.5 py-1 cursor-not-allowed opacity-60"
                  >
                    <Mic className="h-3 w-3" />
                    Voice
                  </button>
                  <button
                    type="button"
                    onClick={submitReply}
                    disabled={!canSubmit}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-md px-3 py-1 transition-colors ${
                      canSubmit
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-primary/40 text-white/70 cursor-not-allowed"
                    }`}
                  >
                    <Send className="h-3 w-3" />
                    {submitting ? "Saving…" : "Reply"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Onboarding (no history yet) or recent reflections list */}
        <div className="flex-1 min-h-0">
          {isLoading ? (
            <div className="text-[11px] text-text-tertiary italic">
              Loading reflections…
            </div>
          ) : !hasAnyHistory ? (
            <OnboardingCard />
          ) : (
            <>
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
                Recent reflections
              </div>
              <div className="space-y-1.5">
                {recent.map((r) => {
                  const Icon = r.time_of_day === "evening" ? Moon : Sun;
                  return (
                    <div
                      key={r.id}
                      className="w-full text-left flex items-center gap-2 rounded-md border-xs border-border-soft bg-foreground/[0.015] px-2 py-1.5"
                    >
                      <Icon className="h-3 w-3 text-text-tertiary shrink-0" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary w-[64px] shrink-0">
                        {relativeDayLabel(r.created_at)}
                      </span>
                      <span className="text-[11.5px] text-foreground/80 truncate">
                        {previewText(r.entry)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </BentoCard>
  );
}
