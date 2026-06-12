/**
 * JobBento — the Job Hunt pipeline as a true bento grid. Variable spans, three
 * card tiers earned by score: a 6x2 hero (top unapplied), 3-col mediums (80+),
 * full-width compact rows (<80), plus a pipeline-stats panel. Layered elevation
 * (page -> surface -> surface-2), hairline borders, Newsreader display +
 * Hanken UI + JetBrains mono metadata, red-dot section labels.
 */
import { type ReactNode } from "react";
import { Wand2, ArrowRight } from "lucide-react";
import { JOB_STATUSES, type JobStatus, type SavedJob } from "./jobHuntStore";
import { detectAts } from "@/JobHunt/atsDetect";

const FONT_DISPLAY = 'Newsreader, Georgia, serif';
const FONT_UI = '"Hanken Grotesk", Inter, system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
const ACCENT = "#e0503c";

type FilterKey = JobStatus | "all" | "needs-you";

function tier(score: number) {
  if (score >= 85) return { ring: "#e0503c", text: "#f08a73" };
  if (score >= 75) return { ring: "#d6a567", text: "#e2bd8a" };
  return { ring: "#8a8a93", text: "#a6a6ae" };
}
const needsYou = (j: SavedJob) => j.applyResult?.status === "needs_human";

const PILL: Record<string, string> = {
  saved: "text-zinc-300 border-zinc-600/40 bg-zinc-500/10",
  applied: "text-sky-300 border-sky-600/40 bg-sky-500/10",
  interview: "text-amber-300 border-amber-600/40 bg-amber-500/10",
  offer: "text-emerald-300 border-emerald-600/40 bg-emerald-500/10",
  rejected: "text-red-300 border-red-600/40 bg-red-500/10",
  "needs-you": "text-amber-300 border-amber-600/40 bg-amber-500/10",
  tailored: "text-emerald-300 border-emerald-600/40 bg-emerald-500/10",
};
function Pill({ label, kind, icon }: { label: string; kind: string; icon?: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 h-5 px-2 rounded border text-[10px] uppercase tracking-wider ${PILL[kind] || PILL.saved}`} style={{ fontFamily: FONT_MONO }}>
      {icon}{label}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
      <span className="text-[10px] uppercase tracking-[0.2em] text-fg-subtle" style={{ fontFamily: FONT_MONO }}>{children}</span>
    </div>
  );
}

function ScoreRing({ score, size = 56, stroke = 4 }: { score: number; size?: number; stroke?: number }) {
  const t = tier(score);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, Math.max(0, score)) / 100);
  return (
    <div style={{ width: size, height: size, position: "relative" }} className="shrink-0">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={t.ring} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="tabular-nums" style={{ color: t.text, fontSize: size * 0.3, fontWeight: 600, fontFamily: FONT_MONO }}>{score}</span>
      </div>
    </div>
  );
}

function HeroCard({ job, onOpen }: { job: SavedJob; onOpen: () => void }) {
  const ats = job.url ? detectAts(job.url) : null;
  return (
    <button onClick={onOpen} className="col-span-12 lg:col-span-6 lg:row-span-2 group text-left bg-surface-2 border border-line rounded-xl p-5 flex flex-col gap-4 hover:border-foreground/25 transition-colors min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>Top match</SectionLabel>
          <h3 className="mt-2 text-[23px] leading-[1.1] text-foreground" style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }}>{job.title}</h3>
          <div className="text-[13px] text-fg-muted truncate mt-1" style={{ fontFamily: FONT_UI }}>{job.company}{job.location ? ` · ${job.location}` : ""}</div>
        </div>
        <ScoreRing score={job.match_score} size={74} stroke={5} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle" style={{ fontFamily: FONT_MONO }}>
        {job.remote && <span className="px-1.5 py-0.5 rounded border border-line">REMOTE</span>}
        {job.salary && <span style={{ color: "#7fd6a8" }}>{job.salary}</span>}
        {ats && <span className="px-1.5 py-0.5 rounded border border-line">{ats.canAutoApply ? "AUTO-APPLY" : "MANUAL"}</span>}
      </div>
      <p className="text-[13.5px] leading-relaxed text-fg-muted [overflow-wrap:anywhere] line-clamp-4" style={{ fontFamily: FONT_UI }}>{job.match_reason}</p>
      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <Pill label={needsYou(job) ? "Needs you" : job.status} kind={needsYou(job) ? "needs-you" : job.status} />
          {job.tailored && <Pill label="Tailored" kind="tailored" icon={<Wand2 size={10} />} />}
        </div>
        <span className="inline-flex items-center gap-1.5 h-9 px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold group-hover:opacity-90 transition-opacity" style={{ fontFamily: FONT_UI }}>
          Review &amp; apply <ArrowRight size={15} />
        </span>
      </div>
    </button>
  );
}

function MediumCard({ job, onOpen }: { job: SavedJob; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="col-span-12 sm:col-span-6 lg:col-span-3 group text-left bg-surface-2 border border-line rounded-lg p-4 flex flex-col gap-3 hover:border-foreground/25 transition-colors min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[15px] leading-tight text-foreground line-clamp-2" style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }}>{job.title}</h4>
          <div className="text-[12px] text-fg-muted truncate mt-0.5" style={{ fontFamily: FONT_UI }}>{job.company}</div>
        </div>
        <ScoreRing score={job.match_score} size={46} stroke={4} />
      </div>
      <p className="text-[11.5px] text-fg-subtle line-clamp-2 [overflow-wrap:anywhere]" style={{ fontFamily: FONT_UI }}>{job.match_reason}</p>
      <div className="mt-auto flex items-center justify-between gap-2">
        <Pill label={needsYou(job) ? "Needs you" : job.status} kind={needsYou(job) ? "needs-you" : job.status} />
        {job.salary ? <span className="text-[10.5px] text-fg-subtle truncate" style={{ fontFamily: FONT_MONO }}>{job.salary}</span> : job.tailored ? <Pill label="Tailored" kind="tailored" /> : null}
      </div>
    </button>
  );
}

function CompactRow({ job, onOpen }: { job: SavedJob; onOpen: () => void }) {
  const t = tier(job.match_score);
  return (
    <button onClick={onOpen} className="col-span-12 lg:col-span-6 group text-left bg-surface-2 border border-line rounded-lg px-3.5 py-2.5 flex items-center gap-3 hover:border-foreground/25 transition-colors min-w-0">
      <span className="shrink-0 w-9 text-center tabular-nums text-[14px] font-semibold" style={{ color: t.text, fontFamily: FONT_MONO }}>{job.match_score}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] text-foreground truncate" style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }}>{job.title}</div>
        <div className="text-[11px] text-fg-subtle truncate" style={{ fontFamily: FONT_UI }}>{job.company}{job.location ? ` · ${job.location}` : ""}</div>
      </div>
      {job.salary && <span className="hidden sm:inline shrink-0 text-[10.5px] text-fg-subtle" style={{ fontFamily: FONT_MONO }}>{job.salary}</span>}
      <Pill label={needsYou(job) ? "Needs you" : job.status} kind={needsYou(job) ? "needs-you" : job.status} />
    </button>
  );
}

function StatsCard({ counts, appliedToday, dailyCap }: { counts: Record<string, number>; appliedToday: number; dailyCap: number }) {
  const items: [string, string | number][] = [
    ["Total", counts.all ?? 0],
    ["Applied", counts.applied ?? 0],
    ["Needs you", counts["needs-you"] ?? 0],
    ["Today", `${appliedToday}/${dailyCap}`],
  ];
  return (
    <div className="col-span-12 sm:col-span-6 lg:col-span-3 bg-surface-2 border border-line rounded-lg p-4 flex flex-col">
      <SectionLabel>Pipeline</SectionLabel>
      <div className="mt-3 grid grid-cols-2 gap-y-3 gap-x-2 flex-1 content-center">
        {items.map(([k, v]) => (
          <div key={k}>
            <div className="text-[20px] text-foreground tabular-nums leading-none" style={{ fontFamily: FONT_MONO }}>{v}</div>
            <div className="text-[9.5px] uppercase tracking-wider text-fg-subtle mt-1" style={{ fontFamily: FONT_MONO }}>{k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function JobBento({
  jobs, counts, filter, setFilter, onOpen, appliedToday, dailyCap,
}: {
  jobs: SavedJob[];
  counts: Record<string, number>;
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  onOpen: (id: string) => void;
  appliedToday: number;
  dailyCap: number;
}) {
  const sorted = [...jobs].sort((a, b) => b.match_score - a.match_score);
  const heroIdx = sorted.findIndex((j) => j.status === "saved");
  const hero = sorted.length ? sorted[heroIdx >= 0 ? heroIdx : 0] : null;
  const rest = sorted.filter((j) => j !== hero);
  const mediums = rest.filter((j) => j.match_score >= 80);
  const compacts = rest.filter((j) => j.match_score < 80);

  return (
    <div className="bg-surface border border-line rounded-xl p-4 md:p-5" style={{ fontFamily: FONT_UI }}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <SectionLabel>Open roles</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {(["all", "needs-you", ...JOB_STATUSES] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] uppercase tracking-wider border transition-colors ${filter === s ? "border-foreground/40 bg-foreground/5 text-foreground" : "border-line text-fg-subtle hover:text-foreground"}`}
              style={{ fontFamily: FONT_MONO }}>
              {s === "needs-you" ? "Needs you" : s}<span className="text-[10px] text-fg-faint">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-12 text-center text-fg-subtle text-[13px]" style={{ fontFamily: FONT_UI }}>
          Nothing here yet — describe the roles you want above and discover.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-3 [grid-auto-flow:row_dense]">
          {hero && <HeroCard job={hero} onOpen={() => onOpen(hero.id)} />}
          <StatsCard counts={counts} appliedToday={appliedToday} dailyCap={dailyCap} />
          {mediums.map((j) => <MediumCard key={j.id} job={j} onOpen={() => onOpen(j.id)} />)}
          {compacts.map((j) => <CompactRow key={j.id} job={j} onOpen={() => onOpen(j.id)} />)}
        </div>
      )}
    </div>
  );
}

export default JobBento;
