/**
 * OnboardingPipelinePanel.tsx
 *
 * The bridge between the /hiring candidate pipeline and the
 * /onboarding page. Shows every candidate in offer + hired status
 * (i.e. people whose hiring decision has been made), with:
 *
 *   - Axon's earlier verdict + fit score
 *   - 30/60/90 plan (Axon-generated; button to generate if missing)
 *   - Welcome-message status (button to send if not sent)
 *   - Upcoming meetings (kickoff, check-ins, training) from
 *     candidate_meetings
 *   - "Schedule kickoff" button → opens Calendly + writes meeting row
 *   - "Onboard fully" composite button → plan + welcome + kickoff in
 *     one click (same as voice command "Hey Axon, onboard Sarah")
 *
 * Mounts at the top of /onboarding above the existing
 * OnboardingDashboard so the two flows coexist.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Calendar, Mail, Loader2, ChevronDown, ChevronRight,
  CheckCircle2, AlertCircle, Briefcase, Clock, Rocket, ArrowRight,
  ExternalLink, Target, User as UserIcon, Inbox,
} from "lucide-react";
import {
  useOnboardingCandidates,
  useCandidateMeetings,
  useGenerateOnboardingPlan,
  useSendWelcomeMessage,
  useScheduleOnboardingSession,
  useStartFullOnboarding,
  formatMeetingTime,
  KIND_LABELS,
  KIND_COLORS,
  type OnboardingCandidate,
  type CandidateMeeting,
} from "./onboardingQueries";
import {
  TIER_COLORS, avatarGradient, initialsFromName, timeAgo,
} from "./recruitingQueries";

export function OnboardingPipelinePanel() {
  const { data: candidates, isLoading } = useOnboardingCandidates();

  if (isLoading) {
    return (
      <div className="rounded-sm border border-white/[0.04] bg-[#0a0a0a] p-8 flex items-center justify-center text-white/40 text-sm">
        <Loader2 size={14} className="animate-spin mr-2" /> Loading onboarding pipeline…
      </div>
    );
  }

  const list = candidates ?? [];
  if (list.length === 0) {
    return (
      <div className="rounded-sm border border-white/[0.04] bg-[#0a0a0a] px-5 py-4 flex items-center gap-4">
        <div className="w-8 h-8 rounded-sm bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
          <Inbox size={14} className="text-white/40" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[10px] tracking-[0.12em] text-white/30 uppercase">
              <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
              ONBOARDING PIPELINE
            </span>
            <span className="text-[12px] text-white/60">— no one yet</span>
          </div>
          <p className="text-[11.5px] text-white/45 leading-snug">
            Move a candidate to <span className="text-white/70">offer</span> or <span className="text-white/70">hired</span> in <a href="/hiring" className="text-red-400 hover:underline">/hiring</a> and they'll appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-white/[0.04] bg-[#0a0a0a]">
      <header className="px-5 py-3.5 border-b border-white/[0.04] flex items-center justify-between">
        <div>
          <div className="text-[10px] tracking-[0.12em] text-white/30 uppercase">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
            ONBOARDING PIPELINE
          </div>
          <h2 className="text-[15px] font-bold text-white tracking-tight mt-0.5">
            {list.length} {list.length === 1 ? "hire" : "hires"} in flight
            <span className="text-white/30 font-normal ml-2">
              · {list.filter((c) => c.status === "hired").length} active · {list.filter((c) => c.status === "offer").length} pending acceptance
            </span>
          </h2>
        </div>
        <div className="text-[10.5px] text-white/40">
          Powered by AXON · onboarding actions
        </div>
      </header>
      <ul className="divide-y divide-white/[0.04]">
        {list.map((c) => (
          <CandidateOnboardingRow key={c.id} candidate={c} />
        ))}
      </ul>
    </div>
  );
}

/* ════════════════════ Row ════════════════════ */

function CandidateOnboardingRow({ candidate: c }: { candidate: OnboardingCandidate }) {
  const [expanded, setExpanded] = useState(false);
  const [from, to] = avatarGradient(c.id);
  const initials = initialsFromName(c.full_name);
  const tier = c.verdict_tier ? TIER_COLORS[c.verdict_tier] : null;
  const planExists = !!c.onboarding_plan;
  const welcomeSent = !!c.welcome_sent_at;

  const meetingsQ = useCandidateMeetings(expanded ? c.id : null);
  const upcomingMeeting = (meetingsQ.data ?? []).find((m) => m.status === "scheduled" && new Date(m.scheduled_at) > new Date());

  return (
    <li className="px-5 py-4">
      {/* Header strip — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-4 text-left"
      >
        <div className={"w-11 h-11 rounded-full bg-gradient-to-br " + from + " " + to + " flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0"}>
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[14px] font-semibold text-white truncate">{c.full_name}</span>
            <StatusPill status={c.status} />
            {c.fit_score != null && tier && (
              <span className={"text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase " + tier.bg + " " + tier.text + " " + tier.border + " border"}>
                {c.verdict_tier} · {c.fit_score}
              </span>
            )}
          </div>
          <div className="text-[11.5px] text-white/50 truncate">
            {c.role_slug.replace(/-/g, " ")} · {c.current_title ? `was ${c.current_title}` : "—"}{c.current_company ? ` @ ${c.current_company}` : ""}
          </div>
        </div>

        {/* Quick-status dots */}
        <div className="hidden md:flex items-center gap-2 text-[11px] text-white/40 flex-shrink-0">
          <Pip label="Plan"    on={planExists} />
          <Pip label="Welcome" on={welcomeSent} />
          <Pip label="Meeting" on={!!upcomingMeeting} />
        </div>

        {expanded ? <ChevronDown size={16} className="text-white/40" /> : <ChevronRight size={16} className="text-white/40" />}
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4 pl-[60px] space-y-4">
              <ActionStrip candidate={c} />
              {c.verdict_summary && tier && <VerdictBlock c={c} tier={tier} />}
              <PlanBlock candidate={c} />
              <MeetingsBlock candidateId={c.id} meetings={meetingsQ.data ?? []} loading={meetingsQ.isLoading} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/* ════════════════════ Action strip ════════════════════ */

function ActionStrip({ candidate: c }: { candidate: OnboardingCandidate }) {
  const planM = useGenerateOnboardingPlan();
  const welcomeM = useSendWelcomeMessage();
  const scheduleM = useScheduleOnboardingSession();
  const fullM = useStartFullOnboarding();

  const planExists = !!c.onboarding_plan;
  const welcomeSent = !!c.welcome_sent_at;

  return (
    <div className="flex flex-wrap gap-2">
      {!planExists ? (
        <ActionButton
          icon={planM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          label="Generate 30/60/90"
          variant="primary"
          disabled={planM.isPending}
          onClick={() => planM.mutate({ candidateId: c.id })}
        />
      ) : (
        <ActionButton
          icon={planM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          label="Regenerate plan"
          variant="ghost"
          disabled={planM.isPending}
          onClick={() => planM.mutate({ candidateId: c.id, force: true })}
        />
      )}

      {!welcomeSent ? (
        <ActionButton
          icon={welcomeM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
          label="Send welcome"
          variant="primary"
          disabled={welcomeM.isPending}
          onClick={() => welcomeM.mutate({ candidateId: c.id })}
        />
      ) : (
        <ActionButton
          icon={<CheckCircle2 size={11} />}
          label="Welcome sent"
          variant="done"
          disabled
        />
      )}

      <ActionButton
        icon={scheduleM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Calendar size={11} />}
        label="Schedule kickoff"
        variant="sky"
        disabled={scheduleM.isPending}
        onClick={() =>
          scheduleM.mutate({
            candidateId: c.id,
            kind: "onboarding_kickoff",
            duration_min: 45,
          })
        }
      />

      {!planExists && !welcomeSent && (
        <ActionButton
          icon={fullM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Rocket size={11} />}
          label="Onboard fully (one shot)"
          variant="brand"
          disabled={fullM.isPending}
          onClick={() => fullM.mutate({ candidateId: c.id })}
        />
      )}

      {(planM.error || welcomeM.error || scheduleM.error || fullM.error) && (
        <div className="basis-full flex items-center gap-2 text-[11px] text-red-400 mt-1">
          <AlertCircle size={11} />
          {String((planM.error || welcomeM.error || scheduleM.error || fullM.error) ?? "")}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon, label, onClick, disabled, variant = "ghost",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "done" | "sky" | "brand";
}) {
  const cls =
    variant === "primary" ? "bg-white/[0.04] border-white/[0.06] text-white/80 hover:border-red-500/30 hover:bg-red-500/[0.06]" :
    variant === "brand"   ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/15" :
    variant === "sky"     ? "bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/15" :
    variant === "done"    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 cursor-default" :
                            "bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "text-[11.5px] font-semibold px-3 py-1.5 rounded-sm border inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors " + cls
      }
    >
      {icon}
      {label}
    </button>
  );
}

/* ════════════════════ Verdict block ════════════════════ */

function VerdictBlock({
  c, tier,
}: {
  c: OnboardingCandidate;
  tier: { bg: string; text: string; border: string };
}) {
  return (
    <div className={"rounded-sm border p-3 " + tier.border + " " + tier.bg}>
      <div className="flex items-start gap-2.5">
        <Sparkles size={13} className={tier.text + " flex-shrink-0 mt-0.5"} />
        <div className="flex-1">
          <div className="text-[10px] tracking-wider text-white/40 mb-0.5">AXON · earlier verdict</div>
          <p className="text-[12.5px] text-white/80 leading-relaxed">{c.verdict_summary}</p>
          {c.axon_assessment?.recommended_next_step && (
            <div className="mt-1.5 text-[11px] text-white/55">
              <span className="text-white/40">Next step:</span> {c.axon_assessment.recommended_next_step}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Plan block ════════════════════ */

function PlanBlock({ candidate: c }: { candidate: OnboardingCandidate }) {
  const plan = c.onboarding_plan;
  if (!plan) {
    return (
      <div className="rounded-sm border border-dashed border-white/[0.08] bg-white/[0.015] p-3 text-[11.5px] text-white/40">
        <Target size={11} className="inline mr-1.5 align-middle" />
        No 30/60/90 plan yet. Click <span className="text-red-400 font-semibold">Generate 30/60/90</span> above and Axon will build one tailored to {c.full_name.split(" ")[0]}'s background.
      </div>
    );
  }

  return (
    <section>
      <div className="text-[10px] tracking-[0.12em] text-white/30 mb-2 uppercase">
        <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
        30 / 60 / 90 PLAN
      </div>
      {plan.summary && (
        <p className="text-[12px] text-white/65 leading-relaxed mb-3 italic">{plan.summary}</p>
      )}
      <div className="grid md:grid-cols-3 gap-3">
        <PlanColumn label="FIRST 30 DAYS" items={plan.first_30_days} hue="text-emerald-400 border-emerald-500/20" />
        <PlanColumn label="FIRST 60 DAYS" items={plan.first_60_days} hue="text-sky-400 border-sky-500/20" />
        <PlanColumn label="FIRST 90 DAYS" items={plan.first_90_days} hue="text-violet-400 border-violet-500/20" />
      </div>
      {plan.key_metrics?.length > 0 && (
        <div className="mt-3 rounded-sm border border-white/[0.06] bg-white/[0.02] p-3">
          <div className="text-[9.5px] tracking-[0.12em] text-white/40 uppercase mb-1.5">SUCCESS METRICS</div>
          <ul className="text-[11.5px] text-white/70 space-y-1">
            {plan.key_metrics.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 size={10} className="text-red-400 mt-1 flex-shrink-0" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PlanColumn({
  label, items, hue,
}: {
  label: string;
  items: Array<{ title: string; owner: string; due_offset_days: number; detail: string }>;
  hue: string;
}) {
  return (
    <div className={"rounded-sm border bg-white/[0.015] p-3 " + hue}>
      <div className="text-[9.5px] tracking-[0.12em] uppercase mb-2 font-bold">{label}</div>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="text-[11px] leading-snug">
            <div className="flex items-baseline justify-between gap-2 mb-0.5">
              <span className="text-white font-semibold">{it.title}</span>
              <span className="text-[9.5px] text-white/40 font-mono whitespace-nowrap">+{it.due_offset_days}d</span>
            </div>
            <div className="text-white/55">{it.detail}</div>
            <div className="mt-0.5 text-[9.5px] text-white/35 inline-flex items-center gap-1">
              <UserIcon size={9} /> {it.owner.replace("_", " ")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ════════════════════ Meetings block ════════════════════ */

function MeetingsBlock({
  candidateId,
  meetings,
  loading,
}: {
  candidateId: string;
  meetings: CandidateMeeting[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="text-[11px] text-white/40">Loading meetings…</div>;
  }
  if (meetings.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-white/[0.08] bg-white/[0.015] p-3 text-[11.5px] text-white/40">
        <Calendar size={11} className="inline mr-1.5 align-middle" />
        No meetings scheduled yet. The candidate appears on the schedule page the moment any meeting is created.
      </div>
    );
  }

  return (
    <section>
      <div className="text-[10px] tracking-[0.12em] text-white/30 mb-2 uppercase">
        <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
        MEETINGS · {meetings.length}
      </div>
      <ul className="space-y-1.5">
        {meetings.map((m) => (
          <MeetingRow key={m.id} m={m} />
        ))}
      </ul>
    </section>
  );
}

function MeetingRow({ m }: { m: CandidateMeeting }) {
  const color = KIND_COLORS[m.kind];
  return (
    <li className={"rounded-sm border px-3 py-2.5 bg-white/[0.015] flex items-center gap-3 " + color}>
      <Clock size={12} className="flex-shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[11px] font-bold uppercase tracking-wider">{KIND_LABELS[m.kind]}</span>
          <span className="text-[10.5px] text-white/40">·</span>
          <span className="text-[11.5px] text-white/85 truncate">{m.title}</span>
        </div>
        <div className="text-[10.5px] text-white/50">
          {formatMeetingTime(m.scheduled_at)} · {m.duration_min}m
          {m.attendees?.length > 0 && ` · ${m.attendees.length} attendee${m.attendees.length === 1 ? "" : "s"}`}
        </div>
      </div>
      {m.calendly_event_url && (
        <a
          href={m.calendly_event_url}
          target="_blank"
          rel="noreferrer"
          className="text-[10.5px] font-semibold inline-flex items-center gap-1 opacity-80 hover:opacity-100 flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          Open <ExternalLink size={10} />
        </a>
      )}
    </li>
  );
}

/* ════════════════════ Small atoms ════════════════════ */

function StatusPill({ status }: { status: string }) {
  const cls =
    status === "hired" ? "bg-emerald-500/15 text-emerald-400" :
    status === "offer" ? "bg-violet-500/15 text-violet-400" :
                         "bg-white/[0.06] text-white/60";
  return <span className={"text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase " + cls}>{status}</span>;
}

function Pip({ label, on }: { label: string; on: boolean }) {
  return (
    <span className={"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] uppercase tracking-wider " + (on ? "text-emerald-400" : "text-white/30")}>
      <span className={"w-1.5 h-1.5 rounded-full " + (on ? "bg-emerald-400" : "bg-white/15")} />
      {label}
    </span>
  );
}
