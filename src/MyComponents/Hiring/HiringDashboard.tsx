/**
 * HiringDashboard.tsx
 *
 * The real candidate inbox UI — replaces the mock CandidateProfileMock
 * pattern with live data from the public.candidates table. Reads what
 * the /apply form on takeover-B2B writes, runs Axon's parse_resume +
 * rate_candidate against it, and surfaces ranked results.
 *
 * Layout: two-pane.
 *   left  — candidate list (ranked by fit_score; filterable by role + status)
 *   right — detail drawer (parsed resume + Axon assessment + actions)
 *
 * Detail drawer actions:
 *   - Parse with Axon (only shown when parse_status='pending'|'failed')
 *   - Rate with Axon  (only shown when parsed but not yet scored, OR re-rate)
 *   - Schedule interview (opens Calendly in a new tab)
 *   - Status mover (applied → screening → interview → offer → hired / rejected)
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, ArrowRight, Briefcase, Calendar, CheckCircle2,
  ChevronRight, Eye, FileText, Github, Globe, Inbox, Linkedin,
  Loader2, Mail, MapPin, Phone, RefreshCw, Sparkles, Star, UserPlus, X,
} from "lucide-react";
import { DirectHireDialog } from "./DirectHireDialog";
import { ActiveUser } from "@/stores/query";
import {
  useCandidates,
  useCandidate,
  useJobPostings,
  useParseResume,
  useParseAllPending,
  useRateCandidate,
  useRateAllPending,
  useUpdateCandidateStatus,
  getResumeSignedUrl,
  TIER_COLORS,
  STATUS_COLORS,
  avatarGradient,
  initialsFromName,
  timeAgo,
  type CandidateRow,
  type CandidateStatus,
  type CandidateListFilters,
} from "./recruitingQueries";

const CALENDLY_URL = "https://calendly.com/codewithali/takeover-demo";

const STATUS_OPTIONS: Array<{ value: CandidateStatus | "all"; label: string }> = [
  { value: "all",        label: "All stages" },
  { value: "applied",    label: "Applied" },
  { value: "screening",  label: "Screening" },
  { value: "interview",  label: "Interview" },
  { value: "offer",      label: "Offer" },
  { value: "hired",      label: "Hired" },
  { value: "rejected",   label: "Rejected" },
  { value: "withdrawn",  label: "Withdrawn" },
];

// Direct Hire is gated to C-level only. Brings someone into
// takeover without going through candidates/offer letters — that's
// a privileged action, not a recruiter chore.
const DIRECT_HIRE_ROLES = new Set([
  "CEO",
  "COO",
  "CFO",
  "Admin",
]);

export function HiringDashboard() {
  const [filters, setFilters] = useState<CandidateListFilters>({ sortBy: "fit_score" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directHireOpen, setDirectHireOpen] = useState(false);

  const { data: activeUser } = ActiveUser();
  const operatorRole = (activeUser?.[0] as any)?.role ?? null;
  const canDirectHire = operatorRole
    ? DIRECT_HIRE_ROLES.has(operatorRole)
    : false;

  const candidatesQ = useCandidates(filters);
  const postingsQ = useJobPostings();
  const parseAllM = useParseAllPending();
  const rateAllM = useRateAllPending();

  const candidates = candidatesQ.data ?? [];
  const pendingParseCount = useMemo(
    () => candidates.filter((c) => c.parse_status === "pending").length,
    [candidates],
  );
  const unscoredCount = useMemo(
    () => candidates.filter((c) => c.parse_status === "done" && c.fit_score == null).length,
    [candidates],
  );

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] tracking-[0.12em] text-foreground/30 mb-0.5 uppercase">
            <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
            HIRING · PIPELINE
          </div>
          <h1 className="font-bold text-[22px] tracking-tight text-foreground leading-tight">
            {candidates.length} {candidates.length === 1 ? "candidate" : "candidates"}
            {filters.roleSlug && (
              <span className="text-foreground/40 font-normal text-base ml-2">
                · {postingsQ.data?.find((p) => p.slug === filters.roleSlug)?.title ?? filters.roleSlug}
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Role filter */}
          <select
            value={filters.roleSlug ?? ""}
            onChange={(e) =>
              setFilters((f) => ({ ...f, roleSlug: e.target.value || undefined }))
            }
            className="bg-muted/40 border border-border rounded-sm px-3 py-1.5 text-[12px] text-foreground/80 outline-none focus:border-red-500/40"
          >
            <option value="">All roles</option>
            {postingsQ.data?.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.title}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filters.status ?? "all"}
            onChange={(e) =>
              setFilters((f) => ({ ...f, status: e.target.value as CandidateStatus | "all" }))
            }
            className="bg-muted/40 border border-border rounded-sm px-3 py-1.5 text-[12px] text-foreground/80 outline-none focus:border-red-500/40"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          <div className="w-px h-5 bg-muted/60 mx-1" />

          {/* Axon batch buttons */}
          <button
            type="button"
            disabled={parseAllM.isPending || pendingParseCount === 0}
            onClick={() => parseAllM.mutate()}
            title={pendingParseCount === 0 ? "No pending resumes" : `Parse ${pendingParseCount} pending`}
            className="text-[11.5px] font-semibold px-3 py-1.5 rounded-sm bg-muted/40 border border-border text-primary-foreground/80 hover:border-red-500/30 hover:bg-red-500/[0.06] inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {parseAllM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            Parse pending {pendingParseCount > 0 && <span className="text-red-400">· {pendingParseCount}</span>}
          </button>

          <button
            type="button"
            disabled={rateAllM.isPending || unscoredCount === 0}
            onClick={() => rateAllM.mutate(filters.roleSlug)}
            title={unscoredCount === 0 ? "No parsed-but-unrated candidates" : `Rate ${unscoredCount} candidates`}
            className="text-[11.5px] font-semibold px-3 py-1.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/15 inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {rateAllM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}
            Rank with Axon {unscoredCount > 0 && <span>· {unscoredCount}</span>}
          </button>

          {/* Direct Hire — skip the application pipeline for known
              hires / internal referrals. C-level only. The button
              gets a tinted-primary treatment so it stands out from
              the batch-Axon buttons but doesn't shout. */}
          {canDirectHire && (
            <>
              <div className="w-px h-5 bg-muted/60 mx-1" />
              <button
                type="button"
                onClick={() => setDirectHireOpen(true)}
                title="Skip the offer letter — invite someone directly into takeover"
                className="text-[11.5px] font-semibold px-3 py-1.5 rounded-sm bg-primary/[0.10] border border-primary/30 text-primary hover:bg-primary/[0.15] hover:border-primary/45 inline-flex items-center gap-1.5"
              >
                <UserPlus size={11} />
                Direct Hire
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => candidatesQ.refetch()}
            title="Refresh"
            className="p-1.5 rounded-sm bg-muted/40 border border-border text-foreground/60 hover:text-foreground"
          >
            <RefreshCw size={12} className={candidatesQ.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Direct Hire dialog — controlled here so refetch can trigger
          on success to surface the new employee in any downstream
          list (Hiring dashboard itself doesn't show employees, but
          the Employees page does — and the candidate list won't
          flicker since direct hires never create a candidates row). */}
      <DirectHireDialog
        open={directHireOpen}
        onOpenChange={setDirectHireOpen}
        onCreated={() => {
          // No-op for now — direct hires don't appear in candidates,
          // so there's nothing on this page to refresh. Hook is kept
          // for future use (analytics ping, toast, etc.).
        }}
      />

      {/* Body */}
      <div
        className="flex-1 grid overflow-hidden transition-[grid-template-columns] duration-300"
        style={{ gridTemplateColumns: selectedId ? "minmax(0, 1fr) 540px" : "minmax(0, 1fr)" }}
      >
        {/* Candidate list */}
        <div className="overflow-y-auto">
          {candidatesQ.isLoading ? (
            <div className="flex items-center justify-center h-full text-foreground/40 text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading candidates…
            </div>
          ) : candidates.length === 0 ? (
            <EmptyState filters={filters} />
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {candidates.map((c) => (
                <CandidateRowItem
                  key={c.id}
                  candidate={c}
                  selected={c.id === selectedId}
                  onClick={() => setSelectedId(c.id)}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Detail drawer */}
        <AnimatePresence>
          {selectedId && (
            <motion.div
              key={selectedId}
              initial={{ x: 540, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 540, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="border-l border-border bg-[#0a0a0a] overflow-y-auto"
            >
              <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ════════════════════ List row ════════════════════ */

function CandidateRowItem({
  candidate: c,
  selected,
  onClick,
}: {
  candidate: CandidateRow;
  selected: boolean;
  onClick: () => void;
}) {
  const [from, to] = avatarGradient(c.id);
  const initials = initialsFromName(c.full_name);
  const tierColor = c.verdict_tier ? TIER_COLORS[c.verdict_tier] : null;

  return (
    <li
      onClick={onClick}
      className={
        "px-6 py-3.5 cursor-pointer transition-colors flex items-center gap-4 " +
        (selected ? "bg-white/[0.03]" : "hover:bg-white/[0.015]")
      }
    >
      {/* Avatar */}
      <div className={"w-10 h-10 rounded-full bg-gradient-to-br " + from + " " + to + " flex items-center justify-center text-foreground text-[11px] font-bold flex-shrink-0"}>
        {initials}
      </div>

      {/* Identity */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[13.5px] font-semibold text-foreground truncate">{c.full_name}</span>
          <span className={"text-[9.5px] font-bold tracking-wider px-1.5 py-0.5 rounded-full uppercase " + STATUS_COLORS[c.status]}>
            {c.status}
          </span>
        </div>
        <div className="text-[11.5px] text-foreground/50 truncate">
          {c.current_title ? `${c.current_title}${c.current_company ? ` · ${c.current_company}` : ""}` : "—"}
          <span className="text-foreground/30"> · applied {timeAgo(c.created_at)}</span>
        </div>
      </div>

      {/* Role */}
      <div className="hidden md:block text-[11px] text-foreground/40 max-w-[160px] truncate text-right">
        {c.role_slug.replace(/-/g, " ")}
      </div>

      {/* Score / parse-state pill */}
      <div className="flex-shrink-0 w-[130px] flex items-center justify-end gap-2">
        {c.parse_status === "pending" && (
          <span className="text-[10px] text-foreground/40 italic">awaiting parse</span>
        )}
        {c.parse_status === "processing" && (
          <span className="text-[10px] text-sky-400 inline-flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> parsing
          </span>
        )}
        {c.parse_status === "failed" && (
          <span className="text-[10px] text-red-400 inline-flex items-center gap-1">
            <AlertCircle size={10} /> parse failed
          </span>
        )}
        {c.parse_status === "done" && c.fit_score == null && (
          <span className="text-[10px] text-amber-400 italic">unrated</span>
        )}
        {c.fit_score != null && tierColor && (
          <>
            <span className={"text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded uppercase " + tierColor.bg + " " + tierColor.text + " " + tierColor.border + " border"}>
              {c.verdict_tier}
            </span>
            <span className="font-mono font-bold text-[16px] tabular-nums text-red-400 w-9 text-right">
              {c.fit_score}
            </span>
          </>
        )}
      </div>

      <ChevronRight size={14} className="text-foreground/20 flex-shrink-0" />
    </li>
  );
}

/* ════════════════════ Empty state ════════════════════ */

function EmptyState({ filters }: { filters: CandidateListFilters }) {
  const filtered = !!(filters.roleSlug || (filters.status && filters.status !== "all"));
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-muted/40 border border-border flex items-center justify-center mb-4">
        <Inbox size={20} className="text-foreground/40" />
      </div>
      <h2 className="text-[15px] font-semibold text-foreground mb-1.5">
        {filtered ? "No candidates match those filters." : "No applications yet."}
      </h2>
      <p className="text-[12.5px] text-foreground/40 max-w-sm leading-relaxed">
        {filtered
          ? "Clear the filters above to see everything, or try a different role."
          : "When someone applies via takeover.systems/careers, they'll appear here. Axon will parse their resume and rank them against the role automatically."}
      </p>
    </div>
  );
}

/* ════════════════════ Detail drawer ════════════════════ */

function DetailDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: candidate, isLoading } = useCandidate(id);
  const parseM = useParseResume();
  const rateM = useRateCandidate();
  const statusM = useUpdateCandidateStatus();

  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);

  async function toggleResume() {
    if (resumeOpen) {
      setResumeOpen(false);
      return;
    }
    if (candidate?.resume_storage_path) {
      const url = await getResumeSignedUrl(candidate.resume_storage_path);
      setResumeUrl(url);
      setResumeOpen(true);
    }
  }

  if (isLoading || !candidate) {
    return (
      <div className="p-8 flex items-center justify-center text-foreground/40">
        <Loader2 size={16} className="animate-spin mr-2" /> Loading…
      </div>
    );
  }

  const c = candidate;
  const [from, to] = avatarGradient(c.id);
  const initials = initialsFromName(c.full_name);
  const tierColor = c.verdict_tier ? TIER_COLORS[c.verdict_tier] : null;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#0a0a0a]/95 backdrop-blur border-b border-border px-5 py-4 flex items-start gap-3">
        <div className={"w-12 h-12 rounded-full bg-gradient-to-br " + from + " " + to + " flex items-center justify-center text-foreground text-[13px] font-bold flex-shrink-0"}>
          {initials}
          {c.fit_score != null && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-primary-foreground text-[9px] font-black flex items-center justify-center border-2 border-[#0a0a0a]">
              {c.fit_score}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[16px] font-bold text-foreground tracking-tight leading-tight truncate">{c.full_name}</h2>
          <div className="text-[11.5px] text-foreground/50 truncate">
            {c.role_slug.replace(/-/g, " ")} · applied {timeAgo(c.created_at)}
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-foreground/40">
            <a className="inline-flex items-center gap-1 hover:text-red-400" href={`mailto:${c.email}`}><Mail size={10} />{c.email}</a>
            {c.phone && <span className="inline-flex items-center gap-1"><Phone size={10} />{c.phone}</span>}
            {c.location && <span className="inline-flex items-center gap-1"><MapPin size={10} />{c.location}</span>}
            {c.linkedin_url && <a className="inline-flex items-center gap-1 hover:text-red-400" href={c.linkedin_url} target="_blank" rel="noreferrer"><Linkedin size={10} />LinkedIn</a>}
            {c.github_url && <a className="inline-flex items-center gap-1 hover:text-red-400" href={c.github_url} target="_blank" rel="noreferrer"><Github size={10} />GitHub</a>}
            {c.portfolio_url && <a className="inline-flex items-center gap-1 hover:text-red-400" href={c.portfolio_url} target="_blank" rel="noreferrer"><Globe size={10} />Site</a>}
          </div>
        </div>
        <button onClick={onClose} className="text-foreground/40 hover:text-foreground p-1 rounded-sm hover:bg-white/[0.05]" aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="p-5 space-y-5">
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          {(c.parse_status === "pending" || c.parse_status === "failed") && (
            <button
              type="button"
              disabled={parseM.isPending}
              onClick={() => parseM.mutate(c.id)}
              className="text-[11.5px] font-semibold px-3 py-1.5 rounded-sm bg-muted/40 border border-border text-foreground/80 hover:border-red-500/30 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {parseM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
              Parse resume
            </button>
          )}
          {c.parse_status === "done" && (
            <button
              type="button"
              disabled={rateM.isPending}
              onClick={() => rateM.mutate({ candidateId: c.id, force: c.fit_score != null })}
              className="text-[11.5px] font-semibold px-3 py-1.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/15 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {rateM.isPending ? <Loader2 size={11} className="animate-spin" /> : <Star size={11} />}
              {c.fit_score != null ? "Re-rate" : "Rate with Axon"}
            </button>
          )}
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noreferrer"
            className="text-[11.5px] font-semibold px-3 py-1.5 rounded-sm bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/15 inline-flex items-center gap-1.5"
          >
            <Calendar size={11} />
            Schedule interview
          </a>
          <select
            value={c.status}
            onChange={(e) =>
              statusM.mutate({ candidateId: c.id, status: e.target.value as CandidateStatus })
            }
            disabled={statusM.isPending}
            className="text-[11.5px] font-semibold px-3 py-1.5 rounded-sm bg-muted/40 border border-border text-foreground/80 outline-none focus:border-red-500/40 disabled:opacity-50"
          >
            {STATUS_OPTIONS.filter((s) => s.value !== "all").map((s) => (
              <option key={s.value} value={s.value}>Move to: {s.label}</option>
            ))}
          </select>
        </div>

        {/* Parse error banner */}
        {c.parse_status === "failed" && c.parse_error && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-sm border border-red-500/30 bg-red-500/[0.06] text-[12px] text-red-400">
            <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold mb-0.5">Parse failed</div>
              <div className="text-red-300/80 leading-relaxed">{c.parse_error}</div>
            </div>
          </div>
        )}

        {/* Axon verdict card */}
        {c.verdict_summary && tierColor ? (
          <div className={"rounded-sm border p-4 " + tierColor.border + " " + tierColor.bg}>
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center flex-shrink-0">
                <Sparkles size={11} className="text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-[11px] font-semibold text-foreground">AXON · verdict</span>
                  <span className={"text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase " + tierColor.bg + " " + tierColor.text}>
                    {c.verdict_tier}
                  </span>
                  {c.assessed_at && (
                    <span className="text-[10px] text-foreground/30 ml-auto">{timeAgo(c.assessed_at)}</span>
                  )}
                </div>
                <p className="text-[12.5px] text-foreground/80 leading-relaxed">{c.verdict_summary}</p>
              </div>
            </div>
          </div>
        ) : c.parse_status === "done" && c.fit_score == null ? (
          <div className="rounded-sm border border-border bg-white/[0.02] p-4 text-[12px] text-foreground/50">
            Resume parsed. Click <span className="text-red-400 font-semibold">Rate with Axon</span> above to score this candidate against the role.
          </div>
        ) : null}

        {/* Score breakdown */}
        {c.axon_assessment && c.axon_assessment.scores.length > 0 && (
          <section>
            <SectionLabel>SCORE BREAKDOWN</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {c.axon_assessment.scores.map((s) => (
                <ScoreCard key={s.label} {...s} />
              ))}
            </div>
          </section>
        )}

        {/* Strengths + concerns */}
        {c.axon_assessment && (c.axon_assessment.strengths.length > 0 || c.axon_assessment.concerns.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {c.axon_assessment.strengths.length > 0 && (
              <BulletPanel label="STRENGTHS" items={c.axon_assessment.strengths} accent="emerald" icon={<CheckCircle2 size={11} />} />
            )}
            {c.axon_assessment.concerns.length > 0 && (
              <BulletPanel label="CONCERNS" items={c.axon_assessment.concerns} accent="amber" icon={<AlertCircle size={11} />} />
            )}
          </div>
        )}

        {c.axon_assessment?.recommended_next_step && (
          <div className="rounded-sm border-l-2 border-red-500 bg-red-500/[0.04] px-4 py-3">
            <div className="text-[9.5px] tracking-[0.12em] text-foreground/40 uppercase mb-1">Recommended next step</div>
            <div className="text-[13px] text-foreground/85">{c.axon_assessment.recommended_next_step}</div>
          </div>
        )}

        {/* Why this role */}
        {c.why_role && (
          <section>
            <SectionLabel>WHY THIS ROLE · IN THEIR WORDS</SectionLabel>
            <blockquote className="rounded-sm border-l-2 border-white/[0.1] bg-white/[0.02] px-4 py-3 text-[12.5px] text-foreground/75 leading-relaxed italic">
              &ldquo;{c.why_role}&rdquo;
            </blockquote>
            {c.why_takeover && (
              <p className="mt-2 text-[11.5px] text-foreground/55 leading-relaxed">
                <span className="text-foreground/40 font-semibold">On Takeover:</span> {c.why_takeover}
              </p>
            )}
          </section>
        )}

        {/* Parsed resume */}
        {c.parsed_resume && (
          <>
            {c.parsed_resume.summary && (
              <section>
                <SectionLabel>SUMMARY</SectionLabel>
                <p className="text-[12.5px] text-foreground/75 leading-relaxed">{c.parsed_resume.summary}</p>
              </section>
            )}

            {c.parsed_resume.employment_history?.length > 0 && (
              <section>
                <SectionLabel>EXPERIENCE</SectionLabel>
                <ul className="space-y-3">
                  {c.parsed_resume.employment_history.map((job, i) => (
                    <li key={i} className="rounded-sm border border-border bg-white/[0.02] p-3">
                      <div className="flex items-baseline justify-between gap-3 mb-1">
                        <span className="text-[12.5px] font-semibold text-foreground">
                          {job.title} <span className="text-foreground/40 font-normal">· {job.company}</span>
                        </span>
                        <span className="text-[10.5px] font-mono text-foreground/40 whitespace-nowrap">
                          {job.start}—{job.end}
                        </span>
                      </div>
                      {job.highlights?.length > 0 && (
                        <ul className="text-[11.5px] text-foreground/60 leading-snug space-y-1 list-disc list-inside marker:text-red-500/60">
                          {job.highlights.map((h, j) => <li key={j}>{h}</li>)}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {c.parsed_resume.education?.length > 0 && (
              <section>
                <SectionLabel>EDUCATION</SectionLabel>
                <ul className="space-y-1.5 text-[12px] text-foreground/70">
                  {c.parsed_resume.education.map((e, i) => (
                    <li key={i}>
                      <span className="text-foreground">{e.institution}</span>
                      {e.degree && <span className="text-foreground/50"> · {e.degree}{e.field ? ` in ${e.field}` : ""}</span>}
                      {e.graduation && <span className="text-foreground/40"> ({e.graduation})</span>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {c.parsed_resume.skills?.length > 0 && (
              <section>
                <SectionLabel>SKILLS</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {c.parsed_resume.skills.map((s) => (
                    <span key={s} className="text-[11px] px-2 py-0.5 rounded-sm bg-muted/40 border border-border text-foreground/70">
                      {s}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {c.parsed_resume.notes && c.parsed_resume.notes.length > 0 && (
              <section>
                <SectionLabel>AXON NOTES</SectionLabel>
                <ul className="space-y-1 text-[11.5px] text-amber-400/80">
                  {c.parsed_resume.notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">·</span>
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {/* Resume PDF preview */}
        {c.resume_storage_path && (
          <section>
            <button
              type="button"
              onClick={toggleResume}
              className="w-full text-[11.5px] font-semibold px-3 py-2 rounded-sm bg-white/[0.03] border border-border text-foreground/70 hover:bg-white/[0.05] inline-flex items-center justify-between gap-2"
            >
              <span className="inline-flex items-center gap-2">
                <FileText size={12} />
                {c.resume_filename ?? "Resume.pdf"}
                {c.resume_size_bytes && (
                  <span className="text-foreground/30">· {Math.round(c.resume_size_bytes / 1024)} KB</span>
                )}
              </span>
              <span className="text-[10px] tracking-wider text-foreground/40">{resumeOpen ? "HIDE" : "OPEN PDF"}</span>
            </button>
            {resumeOpen && resumeUrl && (
              <div className="mt-2 rounded-sm overflow-hidden border border-border">
                <iframe src={resumeUrl} title="Resume preview" className="w-full h-[600px] bg-white" />
              </div>
            )}
            {resumeOpen && !resumeUrl && (
              <p className="mt-2 text-[11px] text-red-400">Could not generate signed URL for the resume.</p>
            )}
          </section>
        )}

        {/* Application meta */}
        <section>
          <SectionLabel>APPLICATION</SectionLabel>
          <dl className="text-[11.5px] grid grid-cols-[140px_1fr] gap-y-1.5 gap-x-3 text-foreground/60">
            <MetaRow label="Years experience" value={c.years_experience ?? "—"} />
            <MetaRow label="Expected comp" value={c.expected_compensation ?? "—"} />
            <MetaRow label="Earliest start" value={c.available_start_date ?? "—"} />
            <MetaRow label="Authorized to work" value={c.authorized_to_work === true ? "Yes" : c.authorized_to_work === false ? "No" : "—"} />
            <MetaRow label="Needs sponsorship" value={c.requires_sponsorship === true ? "Yes" : c.requires_sponsorship === false ? "No" : "—"} />
          </dl>
        </section>

        {/* Footer */}
        <div className="pt-3 border-t border-border text-[10.5px] text-foreground/30 inline-flex items-center gap-1.5">
          <Eye size={10} />
          ID: <span className="font-mono">{c.id.slice(0, 8)}</span> · Source: {c.source ?? "website"}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════ Atoms ════════════════════ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9.5px] tracking-[0.12em] text-foreground/30 mb-2 uppercase">
      <span className="inline-block w-1 h-1 rounded-full bg-red-500 mr-1.5 align-middle" />
      {children}
    </div>
  );
}

function ScoreCard({ label, score, note }: { label: string; score: number; note: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="rounded-sm border border-border bg-white/[0.02] p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11.5px] font-semibold text-foreground">{label}</span>
        <span className="text-[12px] font-bold tabular-nums text-red-400">{clamped}</span>
      </div>
      <div className="h-1 rounded-full bg-white/[0.05] overflow-hidden mb-1.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: clamped + "%" }}
          transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
          className="h-full bg-gradient-to-r from-red-500 to-red-400"
        />
      </div>
      <div className="text-[10.5px] text-foreground/45 leading-snug">{note}</div>
    </div>
  );
}

function BulletPanel({
  label,
  items,
  accent,
  icon,
}: {
  label: string;
  items: string[];
  accent: "emerald" | "amber";
  icon: React.ReactNode;
}) {
  const cls = accent === "emerald"
    ? "border-emerald-500/20 bg-emerald-500/[0.04] text-emerald-400/90"
    : "border-amber-500/20 bg-amber-500/[0.04] text-amber-400/90";
  return (
    <div className={"rounded-sm border p-3 " + cls}>
      <div className="text-[9.5px] tracking-[0.12em] uppercase mb-2 inline-flex items-center gap-1.5 opacity-80">
        {icon}
        {label}
      </div>
      <ul className="space-y-1.5 text-[11.5px] leading-snug">
        {items.map((s, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <ArrowRight size={9} className="mt-1 flex-shrink-0 opacity-60" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="text-foreground/35">{label}</dt>
      <dd className="text-foreground/75">{value}</dd>
    </>
  );
}
