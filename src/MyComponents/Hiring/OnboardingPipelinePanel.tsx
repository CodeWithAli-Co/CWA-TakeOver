/**
 * OnboardingPipelinePanel.tsx
 *
 * Editorial three-column workspace for hires that came through the
 * /apply pipeline. Reads candidates + candidate_meetings, no fake
 * data anywhere — every block is real or shows an honest empty hint.
 *
 *   ┌─────────────┬──────────────────────────────┬─────────────┐
 *   │ SIDEBAR     │  CENTER HERO                 │ RIGHT RAIL  │
 *   │             │                              │             │
 *   │ ALL HIRES   │  big avatar + score badge    │ action      │
 *   │ search      │  name + role + status pill   │ buttons     │
 *   │ chips       │  pill row (compact)          │             │
 *   │             │                              │ AXON        │
 *   │ list        │  AXON · STATUS VERDICT       │ TIMELINE    │
 *   │             │  WHY THIS ROLE quote         │ (deduped)   │
 *   │             │  30/60/90 (tight rows)       │             │
 *   │             │  MEETINGS                    │ AXON        │
 *   │             │                              │ SUGGESTS    │
 *   └─────────────┴──────────────────────────────┴─────────────┘
 *
 * Color system: theme tokens (bg-card / bg-muted / border-border)
 * so the page adapts to light + dark modes. Red brand accent on
 * rails + the verdict cards stays a literal hsl(var(--primary)).
 * Gives layered depth without the "floating in void" feel of pure
 * black + 4% white borders.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Calendar, Mail, Loader2,
  CheckCircle2, AlertCircle, Clock, Rocket, Search,
  ExternalLink, Target, User as UserIcon, Inbox, X,
  Github, Globe, Linkedin, MapPin, Phone, ChevronDown,
  ChevronRight, FileText,
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

type StatusFilter = "all" | "hired" | "offer";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "hired",  label: "ACTIVE" },
  { value: "offer",  label: "AWAITING" },
  { value: "all",    label: "ALL" },
];

/** Word-boundary truncation. Slices to the last space before `max`
 *  so we never split mid-word like "enteri…". */
function truncateAtWord(text: string, max: number): string {
  if (!text || text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace <= max * 0.5) return slice.trim() + "…"; // no good break point
  return slice.slice(0, lastSpace).trim() + "…";
}

/* ════════════════════════════════════════════════════════════════════
   MAIN PANEL
   ════════════════════════════════════════════════════════════════════ */

export function OnboardingPipelinePanel() {
  const { data: candidates, isLoading } = useOnboardingCandidates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const list = candidates ?? [];

  const filtered = useMemo(() => {
    let result = list;
    if (statusFilter !== "all") {
      result = result.filter((c) => c.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.role_slug || "").toLowerCase().includes(q) ||
        (c.current_company || "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [list, statusFilter, search]);

  useEffect(() => {
    if (filtered.length === 0) return;
    const stillThere = filtered.some((c) => c.id === selectedId);
    if (!stillThere) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = useMemo(
    () => list.find((c) => c.id === selectedId) ?? null,
    [list, selectedId],
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/40 text-foreground0 text-sm">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading onboarding pipeline…
      </div>
    );
  }

  if (list.length === 0) {
    return <FullEmptyState />;
  }

  return (
    <div className="h-full flex bg-muted/40 text-foreground">
      <Sidebar
        list={list}
        filtered={filtered}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
      />
      <main className="flex-1 flex overflow-hidden">
        {selected ? (
          <DetailView key={selected.id} candidate={selected} />
        ) : (
          <PickOneHint />
        )}
      </main>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   SIDEBAR
   ════════════════════════════════════════════════════════════════════ */

function Sidebar({
  list, filtered, selectedId, setSelectedId,
  search, setSearch, statusFilter, setStatusFilter,
}: {
  list: OnboardingCandidate[];
  filtered: OnboardingCandidate[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  search: string;
  setSearch: (s: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (s: StatusFilter) => void;
}) {
  const counts = {
    all:    list.length,
    hired:  list.filter((c) => c.status === "hired").length,
    offer:  list.filter((c) => c.status === "offer").length,
  };

  return (
    <aside className="w-[280px] flex-shrink-0 border-r border-border/70 flex flex-col bg-muted/40">
      {/* Sub-nav: §01 Instances / §02 Templates */}
      <div className="flex items-center gap-5 px-5 pt-4 pb-3 border-b border-border/70">
        <span className="text-[12px] tracking-tight">
          <span className="font-mono text-[10px] text-foreground0 mr-1.5">§01</span>
          <span className="font-bold text-foreground border-b-2 border-red-500 pb-1">Instances</span>
        </span>
        <span className="text-[12px] tracking-tight text-muted-foreground/70">
          <span className="font-mono text-[10px] text-muted-foreground/50 mr-1.5">§02</span>
          Templates
        </span>
      </div>

      <div className="px-5 pt-4 pb-2 text-[10px] tracking-[0.12em] text-foreground0 uppercase">
        <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
        ALL HIRES · {list.length}
      </div>

      <div className="px-5 pb-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted border border-border/70 focus-within:border-red-500/50">
          <Search size={11} className="text-foreground0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 bg-transparent text-[11.5px] outline-none placeholder:text-muted-foreground/70 text-foreground"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="text-foreground0 hover:text-foreground/90">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pb-3 flex items-center gap-3 text-[10px] tracking-[0.12em] uppercase">
        {STATUS_FILTERS.map((s) => {
          const count = counts[s.value];
          const active = statusFilter === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={
                "transition-colors " +
                (active
                  ? "text-red-400 border-b border-red-400 pb-0.5"
                  : "text-foreground0 hover:text-foreground/80")
              }
              title={`${count} hire${count === 1 ? "" : "s"}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11.5px] text-foreground0 leading-snug">
            No matches.
          </div>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((c) => (
              <SidebarRow
                key={c.id}
                candidate={c}
                selected={c.id === selectedId}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function SidebarRow({
  candidate: c,
  selected,
  onClick,
}: {
  candidate: OnboardingCandidate;
  selected: boolean;
  onClick: () => void;
}) {
  const statusLabel =
    c.welcome_sent_at && c.onboarding_plan
      ? "active"
      : c.status === "hired"
      ? "active"
      : "awaiting";

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={
          "w-full text-left px-3 py-2 rounded-md flex items-start gap-2.5 transition-colors group " +
          (selected
            ? "bg-red-500/[0.08] ring-1 ring-red-500/40"
            : "hover:bg-secondary/60")
        }
      >
        <span
          className={
            "w-1 h-1 rounded-full mt-2 flex-shrink-0 " +
            (selected ? "bg-red-400" : "bg-muted-foreground/30")
          }
        />
        <div className="flex-1 min-w-0">
          <div className={"text-[12.5px] font-semibold truncate " + (selected ? "text-red-400" : "text-foreground/90 group-hover:text-foreground")}>
            {c.full_name}
          </div>
          <div className="text-[10.5px] text-foreground0 truncate mt-0.5">
            {c.role_slug.replace(/-/g, " ")}
          </div>
        </div>
        <span className="text-[10px] tracking-wider text-foreground0 mt-0.5">· {statusLabel}</span>
      </button>
    </li>
  );
}

/* ════════════════════════════════════════════════════════════════════
   DETAIL VIEW (center + right rail)
   ════════════════════════════════════════════════════════════════════ */

function DetailView({ candidate: c }: { candidate: OnboardingCandidate }) {
  return (
    <>
      <CenterHero candidate={c} />
      <RightRail candidate={c} />
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════
   CENTER HERO
   ════════════════════════════════════════════════════════════════════ */

function CenterHero({ candidate: c }: { candidate: OnboardingCandidate }) {
  const [from, to] = avatarGradient(c.id);
  const initials = initialsFromName(c.full_name);
  const tier = c.verdict_tier ? TIER_COLORS[c.verdict_tier] : null;

  const planM = useGenerateOnboardingPlan();
  const welcomeM = useSendWelcomeMessage();
  const scheduleM = useScheduleOnboardingSession();
  const fullM = useStartFullOnboarding();

  const welcomeData = welcomeM.data?.data as
    | { needs_confirmation?: boolean; concerns?: string[]; verdict_tier?: string; fit_score?: number; message_id?: number }
    | undefined;
  const welcomeNeedsConfirm = welcomeData?.needs_confirmation === true;

  return (
    <section className="flex-1 overflow-y-auto px-8 lg:px-12 py-6">
      {/* Breadcrumb — identity only, no truncated role slugs */}
      <div className="text-[10px] tracking-[0.12em] text-foreground0 uppercase mb-5">
        <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
        ONBOARDING · {c.status === "hired" ? "ACTIVE" : "AWAITING"} · {c.full_name.toUpperCase()}
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-7 items-start">
        {/* Avatar with floating score badge */}
        <div className="relative">
          <div className={"w-[88px] h-[88px] rounded-full bg-gradient-to-br " + from + " " + to + " flex items-center justify-center text-white text-[24px] font-bold shadow-xl shadow-black/40 ring-1 ring-border"}>
            {initials}
          </div>
          {c.fit_score != null && (
            <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-red-500 text-white text-[12px] font-black flex items-center justify-center border-[3px] border-border">
              {c.fit_score}
            </div>
          )}
        </div>

        {/* Identity block */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={c.status} />
            {c.fit_score != null && tier && (
              <span className={"text-[10px] font-bold tracking-wider px-2 py-0.5 rounded uppercase " + tier.bg + " " + tier.text + " " + tier.border + " border"}>
                {c.verdict_tier} · {c.fit_score}
              </span>
            )}
          </div>
          <h1 className="font-display text-[40px] font-black tracking-tight text-foreground leading-[1.02] mb-1">
            {c.full_name}
          </h1>
          <div className="text-[13px] text-muted-foreground mb-3">
            {c.role_slug.replace(/-/g, " ")}
            {c.current_title && (
              <span className="text-foreground0"> · was {c.current_title}{c.current_company ? ` @ ${c.current_company}` : ""}</span>
            )}
          </div>

          {/* Compact pill row — only 2 pills now (timeline carries the rest) */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
            <MetaPill icon={<Clock size={9} />} text={`applied ${timeAgo(c.created_at)}`} />
            <MetaPill icon={<FileText size={9} />} text={`#${c.id.slice(0, 8)}`} mono />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-foreground0">
            <a className="inline-flex items-center gap-1 hover:text-red-400" href={`mailto:${c.email}`}>
              <Mail size={11} />{c.email}
            </a>
            {c.phone && <span className="inline-flex items-center gap-1"><Phone size={11} />{c.phone}</span>}
            {c.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{c.location}</span>}
            {c.linkedin_url && <a className="inline-flex items-center gap-1 hover:text-red-400" href={c.linkedin_url} target="_blank" rel="noreferrer"><Linkedin size={11} />LinkedIn</a>}
            {c.github_url && <a className="inline-flex items-center gap-1 hover:text-red-400" href={c.github_url} target="_blank" rel="noreferrer"><Github size={11} />GitHub</a>}
            {c.portfolio_url && <a className="inline-flex items-center gap-1 hover:text-red-400" href={c.portfolio_url} target="_blank" rel="noreferrer"><Globe size={11} />Site</a>}
          </div>
        </div>
      </div>

      <div className="mt-7 max-w-[920px]">
        <AxonVerdictCard candidate={c} />
      </div>

      {c.why_role && (
        <div className="mt-6 max-w-[920px]">
          <div className="text-[10px] tracking-[0.12em] text-foreground0 uppercase mb-2">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
            FIRST IMPRESSION · WHY THIS ROLE · {timeAgo(c.created_at).toUpperCase()}
          </div>
          <div className="rounded-md border border-border/70 border-l-2 border-l-red-500 bg-muted/40 px-5 py-4">
            <p className="text-[13.5px] text-foreground italic leading-relaxed">&ldquo;{c.why_role}&rdquo;</p>
            <div className="mt-2.5 text-[10px] tracking-[0.12em] text-foreground0 uppercase">
              — {c.full_name.split(" ")[0].toUpperCase()} · FROM THEIR APPLICATION
            </div>
          </div>
          {c.why_takeover && (
            <p className="mt-2.5 text-[11.5px] text-muted-foreground leading-relaxed">
              <span className="text-foreground0 font-semibold uppercase tracking-wider text-[9.5px]">On Takeover:</span> {c.why_takeover}
            </p>
          )}
        </div>
      )}

      <div className="mt-7 max-w-[920px]">
        <div className="text-[10px] tracking-[0.12em] text-foreground0 uppercase mb-3 flex items-center justify-between">
          <span>
            <span className="font-mono text-muted-foreground/70 mr-2">§02</span>
            30 / 60 / 90 PLAN
          </span>
          {c.onboarding_plan && (
            <button
              type="button"
              onClick={() => planM.mutate({ candidateId: c.id, force: true })}
              disabled={planM.isPending}
              className="text-[10px] tracking-wider text-foreground0 hover:text-foreground/90 inline-flex items-center gap-1 disabled:opacity-50"
            >
              {planM.isPending ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              REGENERATE
            </button>
          )}
        </div>
        <PlanSection candidate={c} planM={planM} />
      </div>

      <div className="mt-7 max-w-[920px]">
        <div className="text-[10px] tracking-[0.12em] text-foreground0 uppercase mb-3">
          <span className="font-mono text-muted-foreground/70 mr-2">§03</span>
          MEETINGS
        </div>
        <MeetingsBlock candidateId={c.id} />
      </div>

      {(planM.error || welcomeM.error || scheduleM.error || fullM.error) && (
        <div className="mt-5 flex items-center gap-2 text-[11px] text-red-400 max-w-[920px]">
          <AlertCircle size={11} />
          {String((planM.error || welcomeM.error || scheduleM.error || fullM.error) ?? "")}
        </div>
      )}

      {welcomeNeedsConfirm && !c.welcome_sent_at && (
        <div className="mt-5 max-w-[920px] rounded-md border border-amber-500/40 bg-amber-500/[0.06] p-4">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0">
              <Sparkles size={12} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-semibold text-amber-300">AXON · PRIVATE HEADS-UP</span>
                {welcomeData?.verdict_tier && (
                  <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {welcomeData.verdict_tier} · {welcomeData.fit_score ?? "?"}
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-amber-100/90 leading-relaxed mb-2">
                I rated this candidate weakly — broadcasting a public welcome to #General might be premature. Concerns I flagged:
              </p>
              {welcomeData?.concerns && welcomeData.concerns.length > 0 ? (
                <ul className="space-y-1 text-[11.5px] text-amber-100/80 leading-snug mb-3">
                  {welcomeData.concerns.map((c, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-400 mt-0.5">·</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={() => welcomeM.mutate({ candidateId: c.id, confirm: true })}
                disabled={welcomeM.isPending}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/25 inline-flex items-center gap-1.5"
              >
                {welcomeM.isPending ? <Loader2 size={11} className="animate-spin" /> : <AlertCircle size={11} />}
                Send anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════
   AXON · STATUS VERDICT
   ════════════════════════════════════════════════════════════════════ */

function AxonVerdictCard({ candidate: c }: { candidate: OnboardingCandidate }) {
  const [expanded, setExpanded] = useState(false);
  const tier = c.verdict_tier ? TIER_COLORS[c.verdict_tier] : null;

  if (!c.verdict_summary || !tier) {
    return (
      <div className="rounded-md border border-border/70 border-l-2 border-l-border bg-muted/60 px-5 py-4 text-[12px] text-foreground italic">
        No Axon verdict on file yet. Rate this candidate in /hiring.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/70 border-l-2 border-l-red-500 bg-muted/40 overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0">
          <Sparkles size={13} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold tracking-[0.12em] text-red-400 uppercase">AXON · STATUS VERDICT</span>
            <span className={"text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase " + tier.bg + " " + tier.text}>
              {c.verdict_tier}
            </span>
          </div>
          <p className="text-[13.5px] text-foreground leading-relaxed">{c.verdict_summary}</p>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-3 text-[11px] font-semibold text-red-400 hover:underline inline-flex items-center gap-1"
          >
            {expanded ? "Hide full reasoning" : "See full reasoning"}
            <ChevronRight size={11} className={"transition-transform " + (expanded ? "rotate-90" : "")} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-1 border-t border-border/70 space-y-3">
              {c.axon_assessment?.scores && c.axon_assessment.scores.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {c.axon_assessment.scores.map((s) => (
                    <div key={s.label} className="rounded-md border border-border/70 bg-muted/40/60 p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-foreground">{s.label}</span>
                        <span className="text-[12px] font-bold tabular-nums text-red-400">{s.score}</span>
                      </div>
                      <div className="h-0.5 rounded-full bg-secondary overflow-hidden mb-1">
                        <div
                          className="h-full bg-gradient-to-r from-red-500 to-red-400"
                          style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }}
                        />
                      </div>
                      <div className="text-[10.5px] text-muted-foreground leading-snug">{s.note}</div>
                    </div>
                  ))}
                </div>
              )}
              {c.axon_assessment?.recommended_next_step && (
                <div className="text-[11.5px] text-foreground/80">
                  <span className="text-foreground0 uppercase tracking-wider text-[9.5px] font-semibold">Recommended next:</span>{" "}
                  {c.axon_assessment.recommended_next_step}
                </div>
              )}
              {c.axon_assessment && (c.axon_assessment.strengths?.length > 0 || c.axon_assessment.concerns?.length > 0) && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {c.axon_assessment.strengths?.length > 0 && (
                    <BulletList label="STRENGTHS" items={c.axon_assessment.strengths} accent="emerald" />
                  )}
                  {c.axon_assessment.concerns?.length > 0 && (
                    <BulletList label="CONCERNS" items={c.axon_assessment.concerns} accent="amber" />
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function BulletList({
  label, items, accent,
}: {
  label: string;
  items: string[];
  accent: "emerald" | "amber";
}) {
  const cls = accent === "emerald"
    ? "border-emerald-500/30 bg-emerald-500/[0.05] text-emerald-300"
    : "border-amber-500/30 bg-amber-500/[0.05] text-amber-300";
  return (
    <div className={"rounded-md border p-2.5 " + cls}>
      <div className="text-[9.5px] tracking-[0.12em] uppercase mb-1.5 opacity-80">{label}</div>
      <ul className="space-y-1 text-[11px] leading-snug">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <span className="opacity-60 mt-0.5">·</span>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   30 / 60 / 90 PLAN — tightened rows
   ════════════════════════════════════════════════════════════════════ */

function PlanSection({
  candidate: c,
  planM,
}: {
  candidate: OnboardingCandidate;
  planM: ReturnType<typeof useGenerateOnboardingPlan>;
}) {
  const plan = c.onboarding_plan;

  if (!plan) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/40 px-5 py-6 text-center">
        <p className="text-[12.5px] text-muted-foreground leading-relaxed mb-3">
          No plan yet. Axon will draft a 30/60/90 tailored to {c.full_name.split(" ")[0]}'s resume + the role's ideal profile.
        </p>
        <button
          type="button"
          onClick={() => planM.mutate({ candidateId: c.id })}
          disabled={planM.isPending}
          className="text-[11.5px] font-semibold px-3 py-1.5 rounded-md bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/20 inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {planM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
          Generate 30/60/90
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {plan.summary && (
        <p className="text-[12.5px] text-muted-foreground leading-relaxed italic">{plan.summary}</p>
      )}
      <PlanPhase label="FIRST 30 DAYS" items={plan.first_30_days} accent="emerald" />
      <PlanPhase label="FIRST 60 DAYS" items={plan.first_60_days} accent="sky" />
      <PlanPhase label="FIRST 90 DAYS" items={plan.first_90_days} accent="violet" />
      {plan.key_metrics?.length > 0 && (
        <div className="mt-2 rounded-md border border-border/70 bg-muted/40 px-4 py-3">
          <div className="text-[9.5px] tracking-[0.12em] text-foreground0 uppercase mb-1.5">SUCCESS METRICS</div>
          <ul className="text-[11.5px] text-foreground/80 space-y-1">
            {plan.key_metrics.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <CheckCircle2 size={10} className="text-red-400 mt-1 flex-shrink-0" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PlanPhase({
  label,
  items,
  accent,
}: {
  label: string;
  items: Array<{ title: string; owner: string; due_offset_days: number; detail: string }>;
  accent: "emerald" | "sky" | "violet";
}) {
  const headerColor =
    accent === "emerald" ? "text-emerald-400" :
    accent === "sky"     ? "text-sky-400" :
                           "text-violet-400";

  return (
    <div className={"rounded-md border border-border/70 bg-muted/40 overflow-hidden"}>
      <div className={"px-4 py-2 border-b border-border/70 text-[10px] tracking-[0.12em] uppercase font-bold flex items-center justify-between " + headerColor}>
        <span>{label}</span>
        <span className="text-foreground0 normal-case font-normal tracking-normal">· {items.length}</span>
      </div>
      <ul className="list-none">
        {items.map((it, i) => (
          <PlanItem key={i} item={it} />
        ))}
      </ul>
    </div>
  );
}

function PlanItem({
  item,
}: {
  item: { title: string; owner: string; due_offset_days: number; detail: string };
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-t border-border/70 first:border-t-0 list-none">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-muted/60 transition-colors"
      >
        <span className="font-mono text-[10.5px] text-foreground0 tabular-nums w-9 text-right flex-shrink-0">+{item.due_offset_days}d</span>
        <span className="text-[12.5px] text-foreground truncate">{item.title}</span>
        <span className="text-[9px] tracking-wider text-foreground0 uppercase bg-secondary/60 px-1.5 py-0.5 rounded">{item.owner.replace("_", " ")}</span>
        <span className="flex-1" />
        <ChevronDown size={11} className={"text-foreground0 transition-transform " + (open ? "rotate-180" : "")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pl-[52px] text-[11.5px] text-muted-foreground leading-relaxed">
              {item.detail}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/* ════════════════════════════════════════════════════════════════════
   MEETINGS
   ════════════════════════════════════════════════════════════════════ */

function MeetingsBlock({ candidateId }: { candidateId: string }) {
  const meetingsQ = useCandidateMeetings(candidateId);
  const meetings = meetingsQ.data ?? [];

  if (meetingsQ.isLoading) {
    return <div className="text-[11px] text-foreground0">Loading…</div>;
  }
  if (meetings.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/70 bg-muted/40 px-4 py-4 text-[11.5px] text-foreground0 leading-relaxed">
        No meetings scheduled yet. Use <span className="text-red-400">Schedule kickoff</span> in the right rail.
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      {meetings.map((m) => (
        <MeetingRow key={m.id} m={m} />
      ))}
    </ul>
  );
}

function MeetingRow({ m }: { m: CandidateMeeting }) {
  const color = KIND_COLORS[m.kind];
  return (
    <li className={"rounded-md border border-border/70 bg-muted/40 px-3.5 py-2.5 flex items-center gap-3 " + color}>
      <Clock size={12} className="flex-shrink-0 opacity-70" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider">{KIND_LABELS[m.kind]}</span>
          <span className="text-[10.5px] opacity-40">·</span>
          <span className="text-[12px] text-foreground truncate">{m.title}</span>
        </div>
        <div className="text-[10.5px] text-muted-foreground">
          {formatMeetingTime(m.scheduled_at)} · {m.duration_min}m
        </div>
      </div>
      {m.calendly_event_url && (
        <a
          href={m.calendly_event_url}
          target="_blank"
          rel="noreferrer"
          className="text-[10.5px] font-semibold inline-flex items-center gap-1 opacity-80 hover:opacity-100 flex-shrink-0"
        >
          Open <ExternalLink size={10} />
        </a>
      )}
    </li>
  );
}

/* ════════════════════════════════════════════════════════════════════
   RIGHT RAIL
   ════════════════════════════════════════════════════════════════════ */

interface TimelineEvent {
  when: string;
  title: string;
  subtitle?: string;
}

function RightRail({ candidate: c }: { candidate: OnboardingCandidate }) {
  const meetingsQ = useCandidateMeetings(c.id);
  const meetings = meetingsQ.data ?? [];
  const events = buildTimeline(c, meetings);

  return (
    <aside className="w-[320px] flex-shrink-0 border-l border-border/70 bg-muted/40 overflow-y-auto">
      <div className="px-5 pt-5 pb-3 space-y-2">
        <ActionButtons candidate={c} />
      </div>

      <div className="px-5 py-4 border-t border-border/70">
        <div className="text-[10px] tracking-[0.12em] text-foreground0 uppercase mb-3">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
          AXON&apos;S TIMELINE WITH {c.full_name.split(" ")[0].toUpperCase()}
        </div>
        {events.length === 0 ? (
          <div className="text-[11.5px] text-foreground0 italic">No activity yet.</div>
        ) : (
          <ul className="space-y-3">
            {events.map((ev, i) => (
              <TimelineRow key={i} event={ev} />
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border/70">
        <div className="text-[10px] tracking-[0.12em] text-foreground0 uppercase mb-3">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
          AXON SUGGESTS
        </div>
        <Suggestions candidate={c} meetings={meetings} />
      </div>
    </aside>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  return (
    <li className="flex gap-2.5">
      <div className="w-5 h-5 rounded-md bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles size={9} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold text-red-400">
          AXON <span className="text-foreground0 font-normal">· {timeAgo(event.when)}</span>
        </div>
        <div className="text-[12px] text-foreground leading-snug">{event.title}</div>
        {event.subtitle && (
          <div className="text-[10.5px] text-foreground0 leading-snug">{event.subtitle}</div>
        )}
      </div>
    </li>
  );
}

/** Builds the timeline. Meetings of the same `kind` are collapsed
 *  to the most recent one so a triple-clicked "Schedule kickoff"
 *  doesn't pollute the feed with three identical entries. */
function buildTimeline(c: OnboardingCandidate, meetings: CandidateMeeting[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (c.welcome_sent_at) {
    events.push({
      when: c.welcome_sent_at,
      title: "Posted welcome message",
      subtitle: "broadcast in #General",
    });
  }
  if (c.onboarding_plan_at) {
    events.push({
      when: c.onboarding_plan_at,
      title: "Generated 30/60/90 plan",
      subtitle: c.onboarding_plan?.summary
        ? truncateAtWord(c.onboarding_plan.summary, 90)
        : "tailored to role",
    });
  }

  // Dedupe meetings by kind — show only the most recently created
  // meeting per kind. Keeps "Schedule kickoff" idempotent in the feed.
  const byKind = new Map<string, CandidateMeeting>();
  for (const m of meetings) {
    const existing = byKind.get(m.kind);
    const mTs = new Date(m.created_at ?? m.scheduled_at).getTime();
    const eTs = existing ? new Date(existing.created_at ?? existing.scheduled_at).getTime() : -Infinity;
    if (!existing || mTs > eTs) byKind.set(m.kind, m);
  }
  for (const m of byKind.values()) {
    events.push({
      when: m.created_at ?? m.scheduled_at,
      title: `Scheduled ${KIND_LABELS[m.kind].toLowerCase()}`,
      subtitle: `${formatMeetingTime(m.scheduled_at)} · ${m.duration_min}m`,
    });
  }

  if (c.assessed_at && c.fit_score != null) {
    events.push({
      when: c.assessed_at,
      title: `Scored ${c.full_name.split(" ")[0]} ${c.fit_score}/100`,
      subtitle: c.verdict_tier ? `verdict ${c.verdict_tier}` : undefined,
    });
  }
  events.push({
    when: c.created_at,
    title: "Application received",
    subtitle: c.role_slug.replace(/-/g, " "),
  });

  events.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  return events;
}

function Suggestions({
  candidate: c,
  meetings,
}: {
  candidate: OnboardingCandidate;
  meetings: CandidateMeeting[];
}) {
  const planM = useGenerateOnboardingPlan();
  const welcomeM = useSendWelcomeMessage();
  const scheduleM = useScheduleOnboardingSession();
  const fullM = useStartFullOnboarding();

  const planExists = !!c.onboarding_plan;
  const welcomeSent = !!c.welcome_sent_at;
  const hasKickoff = meetings.some((m) => m.kind === "onboarding_kickoff" && m.status === "scheduled");
  const hasCheckIn = meetings.some((m) => m.kind === "check_in" && m.status === "scheduled");

  const items: Array<{
    icon: React.ReactNode;
    text: string;
    cta: string;
    onClick: () => void;
    pending: boolean;
  }> = [];

  if (!planExists) {
    items.push({
      icon: <Sparkles size={11} />,
      text: `Draft a 30/60/90 plan for ${c.full_name.split(" ")[0]}`,
      cta: planM.isPending ? "…" : "DRAFT",
      onClick: () => planM.mutate({ candidateId: c.id }),
      pending: planM.isPending,
    });
  }
  if (!welcomeSent) {
    items.push({
      icon: <Mail size={11} />,
      text: "Send welcome message to #General",
      cta: welcomeM.isPending ? "…" : "SEND",
      onClick: () => welcomeM.mutate({ candidateId: c.id }),
      pending: welcomeM.isPending,
    });
  }
  if (!hasKickoff) {
    items.push({
      icon: <Calendar size={11} />,
      text: "Schedule day-one welcome session",
      cta: scheduleM.isPending ? "…" : "BOOK",
      onClick: () => scheduleM.mutate({ candidateId: c.id, kind: "onboarding_kickoff", duration_min: 45 }),
      pending: scheduleM.isPending,
    });
  }
  if (planExists && welcomeSent && hasKickoff && !hasCheckIn) {
    items.push({
      icon: <Calendar size={11} />,
      text: "Book 30-day check-in",
      cta: scheduleM.isPending ? "…" : "BOOK",
      onClick: () => {
        const when = new Date();
        when.setDate(when.getDate() + 30);
        when.setHours(14, 0, 0, 0);
        scheduleM.mutate({ candidateId: c.id, kind: "check_in", duration_min: 30, when: when.toISOString() });
      },
      pending: scheduleM.isPending,
    });
  }
  if (!planExists && !welcomeSent) {
    items.push({
      icon: <Rocket size={11} />,
      text: "Onboard fully in one shot",
      cta: fullM.isPending ? "…" : "RUN",
      onClick: () => fullM.mutate({ candidateId: c.id }),
      pending: fullM.isPending,
    });
  }

  if (items.length === 0) {
    return (
      <div className="text-[11.5px] text-foreground0 italic">All caught up — Axon has no pending suggestions.</div>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="rounded-md border border-border/70 bg-muted/60 px-3 py-2.5 flex items-center gap-3">
          <span className="text-red-400">{it.icon}</span>
          <span className="flex-1 text-[11.5px] text-foreground/80 leading-snug">{it.text}</span>
          <button
            type="button"
            disabled={it.pending}
            onClick={it.onClick}
            className="text-[10px] font-bold tracking-wider px-2.5 py-1 rounded bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 inline-flex items-center gap-1"
          >
            {it.pending && <Loader2 size={9} className="animate-spin" />}
            {it.cta}
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ════════════════════════════════════════════════════════════════════
   Action buttons (top of right rail)
   ════════════════════════════════════════════════════════════════════ */

function ActionButtons({ candidate: c }: { candidate: OnboardingCandidate }) {
  const scheduleM = useScheduleOnboardingSession();
  const welcomeM = useSendWelcomeMessage();
  const meetingsQ = useCandidateMeetings(c.id);
  const hasKickoff = (meetingsQ.data ?? []).some(
    (m) => m.kind === "onboarding_kickoff" && m.status === "scheduled",
  );

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={scheduleM.isPending || hasKickoff}
        onClick={() =>
          scheduleM.mutate({ candidateId: c.id, kind: "onboarding_kickoff", duration_min: 45 })
        }
        className={
          "w-full text-[11.5px] font-semibold px-3 py-2 rounded-md inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed " +
          (hasKickoff
            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            : "bg-red-500 text-white hover:bg-red-600")
        }
      >
        {scheduleM.isPending ? <Loader2 size={11} className="animate-spin" /> : hasKickoff ? <CheckCircle2 size={11} /> : <Calendar size={11} />}
        {hasKickoff ? "Kickoff scheduled" : "Schedule kickoff"}
      </button>
      {!c.welcome_sent_at && (
        <button
          type="button"
          disabled={welcomeM.isPending}
          onClick={() => welcomeM.mutate({ candidateId: c.id })}
          className="w-full text-[11.5px] font-semibold px-3 py-2 rounded-md bg-secondary border border-border text-foreground hover:bg-muted inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {welcomeM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Mail size={11} />}
          Send welcome
        </button>
      )}
      {c.welcome_sent_at && (
        <div className="w-full text-[11px] text-emerald-400 inline-flex items-center justify-center gap-1.5 px-3 py-2">
          <CheckCircle2 size={11} /> Welcome sent {timeAgo(c.welcome_sent_at)}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════
   ATOMS + EMPTY STATES
   ════════════════════════════════════════════════════════════════════ */

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "hired" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30" :
    status === "offer" ? "bg-violet-500/15 text-violet-300 border border-violet-500/30" :
                         "bg-secondary text-foreground/80 border border-border";
  return (
    <span className={"text-[10px] font-bold tracking-[0.12em] px-2 py-0.5 rounded uppercase " + cls}>
      <span className="inline-block w-1 h-1 rounded-full bg-current opacity-60 mr-1.5 align-middle" />
      {status === "hired" ? "ACTIVE" : status === "offer" ? "AWAITING" : status.toUpperCase()}
    </span>
  );
}

function MetaPill({
  icon, text, mono,
}: {
  icon: React.ReactNode;
  text: string;
  mono?: boolean;
}) {
  return (
    <span className={"inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border/70 bg-muted/60 text-muted-foreground " + (mono ? "font-mono" : "")}>
      <span className="text-foreground0">{icon}</span>
      {text}
    </span>
  );
}

function FullEmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-muted/40">
      <div className="max-w-md w-full px-8 py-10 text-center rounded-md border border-border/70 bg-muted">
        <div className="w-12 h-12 mx-auto rounded-full bg-secondary border border-border flex items-center justify-center mb-4">
          <Inbox size={18} className="text-foreground0" />
        </div>
        <div className="text-[10px] tracking-[0.12em] text-foreground0 mb-2 uppercase">
          <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
          ONBOARDING PIPELINE
        </div>
        <h3 className="text-[15px] font-semibold text-foreground mb-2">
          No one in onboarding yet.
        </h3>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          Move a candidate to <span className="text-foreground/90">offer</span> or <span className="text-foreground/90">hired</span> in <a href="/hiring" className="text-red-400 hover:underline">/hiring</a> and they'll show up here.
        </p>
      </div>
    </div>
  );
}

function PickOneHint() {
  return (
    <div className="h-full flex items-center justify-center text-[12.5px] text-foreground0 flex-1">
      <div className="flex items-center gap-2">
        <Target size={14} />
        Pick a candidate on the left to open their workspace.
      </div>
    </div>
  );
}
