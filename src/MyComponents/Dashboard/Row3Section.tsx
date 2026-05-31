/**
 * Row3Section.tsx — Strategic Intelligence panel (CEO/COO only).
 *
 * Row 3 answers a fundamentally different question than Row 2 (execution)
 * or Row 4 (queue management). It's a strategic instrument with four tabs:
 *
 *     Intelligence · Revenue · Mission Control · Daily Briefing
 *
 * Non-leadership employees see a completely different component
 * (Row3MemberSection — Team Activity + Quick Actions). Role routing
 * happens in CWADashboard.tsx via UserView; this file is exec-only.
 *
 * Note on data: most strategic surfaces (clients, accounts, incidents,
 * pipeline, initiatives) don't yet have backing tables in takeOversupabase * The mock constants below are clearly labeled and each carries a
 * comment pointing to the production source it should be replaced
 * with. The UI is built first so the enterprise pitch demo is intact
 * and individual queries can be hooked up incrementally without
 * restructuring the layout.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Briefcase,
  Compass,
  DollarSign,
  Heart,
  Newspaper,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { BentoCard } from "./BentoCard";

type ExecTab = "intelligence" | "revenue" | "mission" | "briefing";
type Tone = "primary" | "warning" | "destructive" | "success" | "neutral";

// ─────────────────────────────────────────────────────────────────
// MOCK DATA — replace with real queries as schemas land.
// Each block annotates its intended production source.
// ─────────────────────────────────────────────────────────────────

// MOCK: cwa_revenue + cwa_forecasts table
const REVENUE = {
  arr: 8_240_000,
  mrrGrowthPct: 4.7,
  forecastNext: 720_000,
  forecastTarget: 750_000,
  nrrPct: 118,
  pipelineValue: 4_200_000,
  pipelineByStage: {
    discovery: 1_200_000,
    evaluation: 1_500_000,
    proposal: 900_000,
    closing: 600_000,
  },
  // 8-month MRR series — sparkline
  mrrSeries: [521, 547, 568, 591, 614, 637, 658, 686],
  cohortRetention: [100, 94, 89, 85, 83, 81, 80, 79],
  winRatePct: 32,
  winRateDelta: -3.1,
};

// MOCK: cwa_clients with health_score + last_interaction
const ACCOUNTS = [
  { name: "Northwind Industries", arr: 480_000, health: 92, status: "expanding" as const, lastTouch: "2d" },
  { name: "Acme Corp",             arr: 320_000, health: 78, status: "stable"   as const, lastTouch: "5d" },
  { name: "Globex Holdings",       arr: 290_000, health: 64, status: "at-risk"  as const, lastTouch: "14d" },
  { name: "Initech",               arr: 245_000, health: 81, status: "stable"   as const, lastTouch: "3d" },
  { name: "Hooli Systems",         arr: 198_000, health: 55, status: "at-risk"  as const, lastTouch: "21d" },
];

// MOCK: cwa_pipeline
const PIPELINE = { leads: 247, qualified: 89, proposals: 31, closed: 12 };

// MOCK: cwa_initiatives
const INITIATIVES = [
  { name: "Enterprise tier launch", progress: 67, owner: "Ali",   milestone: "Beta GA · Jun 14" },
  { name: "EU expansion",           progress: 34, owner: "Jane",  milestone: "First account · Q3" },
  { name: "SOC2 Type II",           progress: 89, owner: "Mike",  milestone: "Audit · Aug 12" },
];

// MOCK: external uptime + incident integration
const HEALTH = {
  uptimePct: 99.97,
  uptimeMinutesLost30d: 13,
  activeIncidents: 1,
  topIncident: "Elevated API latency · EU region",
  topIncidentOpenedHours: 3,
  capacityPct: 67,
  capacityTrend: "stable" as const,
  securityEvents24h: 0,
  npsScore: 64,
  npsDelta: 3,
  mentionsThisWeek: 12,
  mentionsDelta: 4,
};

// MOCK: Axon-generated daily briefing
const BRIEFING_TEXT =
  "MRR grew 0.4% to $686K overnight, driven by three enterprise expansions. Globex Holdings dropped to amber after a 14-day touchpoint gap — recommend an exec call within 48h. Hiring is pacing 12% behind target on engineering due to slow recruiter cycles. Strategic priority for the week: close the Northwind renewal before contract anniversary.";

const BRIEFING_MOVERS = [
  { label: "MRR",      value: "$686K", deltaPct: 0.4,  up: true,  hint: "vs yesterday" },
  { label: "Pipeline", value: "$4.2M", deltaPct: 8.2,  up: true,  hint: "this week" },
  { label: "Win rate", value: "32%",   deltaPct: -3.1, up: false, hint: "trailing 30d" },
];

const BRIEFING_RISKS = [
  { title: "Globex renewal at risk",       detail: "No exec touch in 14d · $290K ARR" },
  { title: "Recruiter cycle time slipping", detail: "Avg time-to-offer 24d vs 14d target" },
];


// ─────────────────────────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────────────────────────

function AnimatedNumber({ value, duration = 650 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = value;
    if (start === end) {
      setDisplay(end);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = end;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{display}</>;
}

function SectionLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
        {children}
      </span>
      {hint && (
        <span className="text-[10px] text-text-tertiary/60 normal-case tracking-normal">
          {hint}
        </span>
      )}
    </div>
  );
}

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  success: "text-success",
  neutral: "text-text-tertiary",
};
const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary",
  warning: "bg-warning",
  destructive: "bg-destructive",
  success: "bg-success",
  neutral: "bg-foreground/30",
};

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// Tiny inline sparkline — last N points → smoothed line + gradient fill
function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "hsl(var(--success))",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / span) * height;
    return [x, y] as const;
  });
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(" ");
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  const gradId = `spark-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <path d={path} stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Compact stat tile — used across multiple tabs
function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
  deltaText,
  deltaUp,
  sparkline,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  deltaText?: string;
  deltaUp?: boolean;
  sparkline?: number[];
}) {
  return (
    <div className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft px-3 py-2.5">
      <div className={`flex items-center justify-between gap-1.5 ${TONE_TEXT[tone]}`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-2.5 w-2.5 flex-shrink-0" />
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] truncate">
            {label}
          </span>
        </div>
        {sparkline && (
          <Sparkline
            data={sparkline}
            width={48}
            height={14}
            color={
              tone === "success"     ? "hsl(var(--success))"     :
              tone === "warning"     ? "hsl(var(--warning))"     :
              tone === "destructive" ? "hsl(var(--destructive))" :
                                       "hsl(var(--primary))"
            }
          />
        )}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-[20px] font-bold tabular-nums leading-none ${TONE_TEXT[tone]}`}>
          {value}
        </span>
        {deltaText && (
          <span
            className={`text-[10px] font-semibold tabular-nums inline-flex items-center gap-0.5 ${
              deltaUp ? "text-success" : "text-destructive"
            }`}
          >
            {deltaUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {deltaText}
          </span>
        )}
      </div>
      {hint && (
        <div className="mt-1 text-[10.5px] text-text-tertiary truncate">{hint}</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Tab bar
// ─────────────────────────────────────────────────────────────────

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  layoutId,
}: {
  tabs: { key: T; label: string; icon: typeof Activity }[];
  active: T;
  onChange: (next: T) => void;
  layoutId: string;
}) {
  return (
    <div className="flex items-center gap-0.5 relative">
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`relative inline-flex items-center gap-1.5 px-3 h-9 text-[10.5px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              isActive ? "text-foreground" : "text-text-tertiary hover:text-foreground"
            }`}
          >
            <Icon className="h-3 w-3" />
            {t.label}
            {isActive && (
              <motion.span
                layoutId={layoutId}
                className="absolute left-2 right-2 bottom-0 h-[2px] bg-primary rounded-full"
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main export — CEO/COO gating happens in CWADashboard.tsx via
// UserView, so this just renders the strategic exec view directly.
// ─────────────────────────────────────────────────────────────────

export function Row3Section() {
  return <ExecRow3 />;
}

// ─────────────────────────────────────────────────────────────────
// EXEC view — Intelligence · Revenue · Mission · Briefing
// ─────────────────────────────────────────────────────────────────

const EXEC_TABS: { key: ExecTab; label: string; icon: typeof Activity }[] = [
  { key: "intelligence", label: "Intelligence", icon: Compass },
  { key: "revenue",      label: "Revenue",      icon: DollarSign },
  { key: "mission",      label: "Mission Control", icon: Radar },
  { key: "briefing",     label: "Daily Briefing",  icon: Newspaper },
];

function ExecRow3() {
  const [tab, setTab] = useState<ExecTab>("intelligence");
  return (
    <BentoCard span="col-span-12" delay={0.35} noPadding>
      <div className="flex items-center justify-between gap-3 px-3 border-b border-xs border-border-soft">
        <TabBar tabs={EXEC_TABS} active={tab} onChange={setTab} layoutId="exec-tab-underline" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-text-tertiary pr-2">
          Strategic Intelligence
        </span>
      </div>
      <div className="p-4 min-h-[280px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {tab === "intelligence" && <IntelligenceTab />}
            {tab === "revenue" && <RevenueTab />}
            {tab === "mission" && <MissionControlTab />}
            {tab === "briefing" && <BriefingTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </BentoCard>
  );
}

// ─── Intelligence (2×2: revenue · accounts · funnel · initiatives) ───
function IntelligenceTab() {
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Top-left: Revenue ticker */}
      <div className="col-span-3">
        <SectionLabel hint="ARR · 8mo">Revenue</SectionLabel>
        <div className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft p-3 h-[calc(100%-26px)]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[24px] font-bold tabular-nums text-foreground leading-none">
              {fmtMoney(REVENUE.arr)}
            </span>
            <span className="text-[10.5px] font-semibold text-success inline-flex items-center gap-0.5">
              <TrendingUp className="h-2.5 w-2.5" />
              {REVENUE.mrrGrowthPct}%
            </span>
          </div>
          <div className="text-[9.5px] uppercase tracking-wider text-text-tertiary mt-1">
            ARR
          </div>
          <div className="mt-2">
            <Sparkline data={REVENUE.mrrSeries} width={150} height={32} color="hsl(var(--success))" />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px]">
            <span className="text-text-tertiary uppercase tracking-wider">Forecast</span>
            <span className="text-foreground font-semibold tabular-nums">
              {fmtMoney(REVENUE.forecastNext)} / {fmtMoney(REVENUE.forecastTarget)}
            </span>
          </div>
        </div>
      </div>

      {/* Top-right: Account portfolio */}
      <div className="col-span-5">
        <SectionLabel hint="by ARR">Top accounts</SectionLabel>
        <ul className="list-none p-0 m-0 space-y-1">
          {ACCOUNTS.map((a) => {
            const healthTone: Tone =
              a.health >= 80 ? "success" : a.health >= 60 ? "warning" : "destructive";
            return (
              <li key={a.name} className="list-none">
                <div className="flex items-center gap-2.5 py-1 px-2 -mx-2 rounded-md hover:bg-foreground/[0.04] transition-colors">
                  <span className="text-[12px] text-foreground flex-1 truncate font-medium">
                    {a.name}
                  </span>
                  <span className="text-[10.5px] tabular-nums text-text-tertiary w-12 text-right">
                    {fmtMoney(a.arr)}
                  </span>
                  <div className="w-16 h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden flex-shrink-0">
                    <div
                      className={`h-full rounded-full ${TONE_BG[healthTone]} transition-all duration-700`}
                      style={{ width: `${a.health}%` }}
                    />
                  </div>
                  <span
                    className={`text-[9.5px] font-semibold uppercase tracking-wider w-14 text-right ${TONE_TEXT[healthTone]}`}
                  >
                    {a.status}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom-left: Growth funnel */}
      <div className="col-span-4">
        <SectionLabel hint="quarterly">Pipeline funnel</SectionLabel>
        <div className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft p-3 space-y-2">
          {[
            { label: "Leads",      n: PIPELINE.leads,      tone: "neutral" as Tone, conv: null },
            { label: "Qualified",  n: PIPELINE.qualified,  tone: "primary" as Tone, conv: Math.round((PIPELINE.qualified / PIPELINE.leads) * 100) },
            { label: "Proposals",  n: PIPELINE.proposals,  tone: "warning" as Tone, conv: Math.round((PIPELINE.proposals / PIPELINE.qualified) * 100) },
            { label: "Closed",     n: PIPELINE.closed,     tone: "success" as Tone, conv: Math.round((PIPELINE.closed / PIPELINE.proposals) * 100) },
          ].map((s) => {
            const pct = (s.n / PIPELINE.leads) * 100;
            return (
              <div key={s.label}>
                <div className="flex items-baseline justify-between gap-2 mb-0.5">
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${TONE_TEXT[s.tone]}`}>
                    {s.label}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-foreground">
                    {s.n}
                  </span>
                  {s.conv !== null && (
                    <span className="text-[9px] tabular-nums text-text-tertiary">
                      {s.conv}%
                    </span>
                  )}
                </div>
                <div className="w-full h-1 bg-foreground/[0.06] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${TONE_BG[s.tone]}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full-width bottom strip: Strategic initiatives */}
      <div className="col-span-12">
        <SectionLabel hint={`${INITIATIVES.length} active bets`}>Strategic initiatives</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {INITIATIVES.map((i) => (
            <div
              key={i.name}
              className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-1.5 mb-1">
                <span className="text-[12px] font-bold text-foreground truncate">{i.name}</span>
                <span className="text-[11px] font-bold tabular-nums text-foreground">
                  <AnimatedNumber value={i.progress} />%
                </span>
              </div>
              <div className="w-full h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    i.progress >= 80 ? "bg-success" : i.progress >= 40 ? "bg-primary" : "bg-warning"
                  }`}
                  style={{ width: `${i.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-text-tertiary uppercase tracking-wider">
                  Lead · {i.owner}
                </span>
                <span className="text-foreground/70">{i.milestone}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Revenue & Customer ──────────────────────────────────────────
function RevenueTab() {
  const totalPipeline =
    REVENUE.pipelineByStage.discovery +
    REVENUE.pipelineByStage.evaluation +
    REVENUE.pipelineByStage.proposal +
    REVENUE.pipelineByStage.closing;

  const atRisk = ACCOUNTS.filter((a) => a.status === "at-risk");

  return (
    <div className="space-y-4">
      {/* 4 KPI tiles */}
      <div className="grid grid-cols-4 gap-3">
        <StatTile
          icon={DollarSign}
          label="ARR"
          value={fmtMoney(REVENUE.arr)}
          tone="success"
          deltaText={`${REVENUE.mrrGrowthPct}%`}
          deltaUp={true}
          hint="MoM growth"
          sparkline={REVENUE.mrrSeries}
        />
        <StatTile
          icon={TrendingUp}
          label="NRR"
          value={`${REVENUE.nrrPct}%`}
          tone="success"
          hint="expansion + retention"
        />
        <StatTile
          icon={Briefcase}
          label="Pipeline"
          value={fmtMoney(REVENUE.pipelineValue)}
          tone="primary"
          hint={`${PIPELINE.leads} leads in flight`}
        />
        <StatTile
          icon={Trophy}
          label="Win rate"
          value={`${REVENUE.winRatePct}%`}
          tone={REVENUE.winRateDelta >= 0 ? "success" : "warning"}
          deltaText={`${Math.abs(REVENUE.winRateDelta)}%`}
          deltaUp={REVENUE.winRateDelta >= 0}
          hint="trailing 30d"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pipeline by stage — horizontal stacked bar */}
        <div>
          <SectionLabel hint={`${fmtMoney(totalPipeline)} weighted`}>Pipeline by stage</SectionLabel>
          <div className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft p-3">
            <div className="flex h-3 rounded-full overflow-hidden bg-foreground/[0.06] gap-0.5 mb-2">
              {[
                { label: "Discovery",  v: REVENUE.pipelineByStage.discovery,  tone: "neutral" as Tone },
                { label: "Evaluation", v: REVENUE.pipelineByStage.evaluation, tone: "primary" as Tone },
                { label: "Proposal",   v: REVENUE.pipelineByStage.proposal,   tone: "warning" as Tone },
                { label: "Closing",    v: REVENUE.pipelineByStage.closing,    tone: "success" as Tone },
              ].map((s) => (
                <div
                  key={s.label}
                  className={`${TONE_BG[s.tone]} opacity-90`}
                  style={{ width: `${(s.v / totalPipeline) * 100}%` }}
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Discovery",  v: REVENUE.pipelineByStage.discovery,  tone: "neutral" as Tone },
                { label: "Evaluation", v: REVENUE.pipelineByStage.evaluation, tone: "primary" as Tone },
                { label: "Proposal",   v: REVENUE.pipelineByStage.proposal,   tone: "warning" as Tone },
                { label: "Closing",    v: REVENUE.pipelineByStage.closing,    tone: "success" as Tone },
              ].map((s) => (
                <div key={s.label} className="text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${TONE_BG[s.tone]}`} />
                    <span className="uppercase tracking-wider text-text-tertiary">
                      {s.label}
                    </span>
                  </div>
                  <div className="text-foreground font-bold tabular-nums mt-0.5">
                    {fmtMoney(s.v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* At-risk accounts */}
        <div>
          <SectionLabel hint={`${atRisk.length} flagged`}>At-risk accounts</SectionLabel>
          {atRisk.length === 0 ? (
            <div className="text-[12px] text-text-tertiary italic py-2">
              No at-risk accounts. Healthy book.
            </div>
          ) : (
            <ul className="list-none p-0 m-0 space-y-1">
              {atRisk.map((a) => (
                <li key={a.name} className="list-none">
                  <div className="rounded-md bg-destructive/[0.06] border-xs border-destructive/25 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] font-bold text-foreground truncate">
                        {a.name}
                      </span>
                      <span className="text-[10.5px] tabular-nums text-destructive font-semibold">
                        {fmtMoney(a.arr)}
                      </span>
                    </div>
                    <div className="text-[10px] text-text-tertiary uppercase tracking-wider mt-0.5">
                      Health {a.health} · Last touch {a.lastTouch}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mission Control ─────────────────────────────────────────────
function MissionControlTab() {
  const incidentTone: Tone =
    HEALTH.activeIncidents === 0 ? "success" : HEALTH.activeIncidents > 2 ? "destructive" : "warning";

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Uptime gauge */}
      <div className="col-span-3">
        <SectionLabel hint="30 days">Uptime</SectionLabel>
        <div className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft p-3 h-[calc(100%-26px)] flex flex-col items-center justify-center">
          <UptimeGauge value={HEALTH.uptimePct} />
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mt-2">
            {HEALTH.uptimeMinutesLost30d}m lost · 30d
          </div>
        </div>
      </div>

      {/* Active incidents */}
      <div className="col-span-3">
        <SectionLabel hint="open">Incidents</SectionLabel>
        <div
          className={`rounded-lg p-3 border-xs h-[calc(100%-26px)] ${
            HEALTH.activeIncidents === 0
              ? "bg-success/[0.05] border-success/25"
              : "bg-destructive/[0.05] border-destructive/25"
          }`}
        >
          <div className={`flex items-baseline justify-between gap-2 ${TONE_TEXT[incidentTone]}`}>
            <ShieldAlert className="h-4 w-4" />
            <span className="text-[28px] font-bold tabular-nums leading-none">
              <AnimatedNumber value={HEALTH.activeIncidents} />
            </span>
          </div>
          {HEALTH.activeIncidents > 0 ? (
            <div className="mt-2">
              <div className="text-[11.5px] text-foreground font-medium truncate">
                {HEALTH.topIncident}
              </div>
              <div className="text-[10px] text-text-tertiary uppercase tracking-wider mt-0.5">
                Open {HEALTH.topIncidentOpenedHours}h
              </div>
            </div>
          ) : (
            <div className="mt-2 text-[11.5px] text-success/80 italic">All systems nominal.</div>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="col-span-3">
        <SectionLabel hint="24 hours">Security</SectionLabel>
        <div className="rounded-lg bg-success/[0.05] border-xs border-success/25 p-3 h-[calc(100%-26px)]">
          <div className="flex items-baseline justify-between gap-2 text-success">
            <ShieldCheck className="h-4 w-4" />
            <span className="text-[28px] font-bold tabular-nums leading-none">
              <AnimatedNumber value={HEALTH.securityEvents24h} />
            </span>
          </div>
          <div className="mt-2 text-[11.5px] text-success/80">
            No threats detected.
          </div>
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mt-0.5">
            Last scan · 12m ago
          </div>
        </div>
      </div>

      {/* Capacity */}
      <div className="col-span-3">
        <SectionLabel hint="infra · 24h">Capacity</SectionLabel>
        <div className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft p-3 h-[calc(100%-26px)]">
          <div className="flex items-baseline justify-between gap-1.5">
            <span className="text-[28px] font-bold tabular-nums text-foreground leading-none">
              <AnimatedNumber value={HEALTH.capacityPct} />%
            </span>
            <span className="text-[10.5px] text-text-tertiary uppercase tracking-wider">
              {HEALTH.capacityTrend}
            </span>
          </div>
          <div className="mt-2 w-full h-1.5 bg-foreground/[0.06] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                HEALTH.capacityPct >= 85 ? "bg-destructive" :
                HEALTH.capacityPct >= 70 ? "bg-warning" :
                                           "bg-success"
              }`}
              style={{ width: `${HEALTH.capacityPct}%` }}
            />
          </div>
          <div className="text-[10px] text-text-tertiary uppercase tracking-wider mt-1.5">
            Headroom · {100 - HEALTH.capacityPct}%
          </div>
        </div>
      </div>

      {/* External signals — full width strip */}
      <div className="col-span-12">
        <SectionLabel hint="market presence">External signals</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            icon={Heart}
            label="NPS"
            value={String(HEALTH.npsScore)}
            tone="success"
            deltaText={String(HEALTH.npsDelta)}
            deltaUp={HEALTH.npsDelta > 0}
            hint="this quarter"
          />
          <StatTile
            icon={Newspaper}
            label="Mentions"
            value={String(HEALTH.mentionsThisWeek)}
            tone="primary"
            deltaText={String(HEALTH.mentionsDelta)}
            deltaUp={HEALTH.mentionsDelta > 0}
            hint="this week"
          />
          <StatTile
            icon={Activity}
            label="Status feed"
            value="Clear"
            tone="success"
            hint="no active alerts"
          />
        </div>
      </div>
    </div>
  );
}

function UptimeGauge({ value }: { value: number }) {
  // Semi-circular gauge: 180° arc, value as % of 180
  const angle = (value / 100) * 180;
  const radius = 36;
  const cx = 44;
  const cy = 42;
  const start = polar(cx, cy, radius, 180);
  const end = polar(cx, cy, radius, 180 + angle);
  const largeArc = angle > 180 ? 1 : 0;
  const bgPath = `M ${polar(cx, cy, radius, 180).x} ${polar(cx, cy, radius, 180).y} A ${radius} ${radius} 0 0 1 ${polar(cx, cy, radius, 360).x} ${polar(cx, cy, radius, 360).y}`;
  const fgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  return (
    <div className="relative" style={{ width: 88, height: 50 }}>
      <svg width={88} height={50}>
        <path d={bgPath} stroke="hsl(var(--foreground) / 0.08)" strokeWidth={6} fill="none" strokeLinecap="round" />
        <path d={fgPath} stroke="hsl(var(--success))" strokeWidth={6} fill="none" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center">
        <span className="text-[18px] font-bold tabular-nums text-foreground leading-none">
          {value.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── Daily Briefing ──────────────────────────────────────────────
function BriefingTab() {
  return (
    <div className="space-y-4">
      {/* AI brief — gradient hero */}
      <div className="rounded-lg p-3.5 border-xs border-border-soft bg-gradient-to-br from-primary/[0.05] to-background relative overflow-hidden">
        <div className="flex items-center gap-1.5 text-primary mb-1.5">
          <Sparkles className="h-3 w-3" />
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em]">
            Axon · Daily brief
          </span>
          <span className="text-[9.5px] text-text-tertiary/70 normal-case tracking-normal ml-1">
            generated 6 minutes ago
          </span>
        </div>
        <p className="text-[12.5px] text-foreground leading-relaxed">
          {BRIEFING_TEXT}
        </p>
      </div>

      {/* What moved */}
      <div>
        <SectionLabel hint="vs prior period">What moved</SectionLabel>
        <div className="grid grid-cols-3 gap-3">
          {BRIEFING_MOVERS.map((m) => (
            <div
              key={m.label}
              className="rounded-lg bg-foreground/[0.025] border-xs border-border-soft px-3 py-2.5"
            >
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-tertiary mb-1">
                {m.label}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-[18px] font-bold tabular-nums text-foreground leading-none">
                  {m.value}
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums inline-flex items-center gap-0.5 ${
                    m.up ? "text-success" : "text-destructive"
                  }`}
                >
                  {m.up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                  {Math.abs(m.deltaPct)}%
                </span>
              </div>
              <div className="text-[10px] text-text-tertiary mt-1 uppercase tracking-wider">
                {m.hint}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk callouts */}
      <div>
        <SectionLabel hint="needs leadership attention">Risk callouts</SectionLabel>
        <ul className="list-none p-0 m-0 space-y-1.5">
          {BRIEFING_RISKS.map((r) => (
            <li key={r.title} className="list-none">
              <div className="rounded-md bg-destructive/[0.06] border-xs border-destructive/25 px-3 py-2">
                <div className="text-[12px] font-semibold text-destructive">{r.title}</div>
                <div className="text-[10.5px] text-text-tertiary mt-0.5">{r.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
