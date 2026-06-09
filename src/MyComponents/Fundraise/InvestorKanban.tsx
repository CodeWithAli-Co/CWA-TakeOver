/**
 * InvestorKanban.tsx — 9-column board view of investors by stage.
 *
 * Toggle target for the Grid/Kanban view switch in FundraisePage.
 * Renders a horizontally-scrollable strip of stage columns, each
 * with a compact KanbanInvestorCard for every investor at that
 * stage. Drag a card between columns to update pipeline_stage —
 * uses native HTML5 drag-drop (no new dep) so it works the same
 * way the CRM PipelineView does.
 *
 * Stage order matches the funnel left-to-right:
 *   prospected → researched → reaching_out → replied →
 *   meeting_scheduled → met → considering → closed
 * with `passed` dropped at the end (visually distinct dead-state).
 *
 * Why native DnD + not dnd-kit:
 *   · No new dependency
 *   · Matches the rest of the Takeover stack (CRM, Tasks)
 *   · Threshold is handled by the browser — a quick click on the
 *     card opens the drawer without firing a drag
 *
 * Drop semantics:
 *   · Drop ON a card → ignored (we don't sort within a column,
 *     since investors are sorted by priority + fit, not manual)
 *   · Drop ON a column body → moves investor to that stage if it
 *     wasn't already there; no-op otherwise
 *
 * Optimistic update: useMoveInvestorStage runs through TanStack
 * Query's invalidation — UI will look snappy because of cached
 * state, and any error rolls back on next refetch.
 */

import { useState, useMemo, useRef } from "react";

import {
  useMoveInvestorStage,
  type InvestorListEntry,
  type InvestorPipelineStage,
} from "@/stores/investors";

import { KanbanInvestorCard } from "./KanbanInvestorCard";
import { useQuickSendStore } from "./quickSendStore";
import { companySupabase } from "@/routes/index.lazy";
import {
  draftInvestorEmail,
  type DraftMode,
  type InvestorDetail,
} from "@/Fundraise/draftInvestorEmail";

// MIME-typed dataTransfer key keeps us from picking up unrelated
// drags (e.g. a drag from the CRM PipelineView in another window).
const DT_KEY = "application/x-fundraise-investor-id";

// Consolidated 5-stage funnel + Passed graveyard.
//
// The underlying `pipeline_stage` enum stays at 9 values so existing
// rows + the InvestorDrawer's fine-grained stage control still work.
// We just bucket pairs of stages into a single visual column on the
// kanban. Dropping a card into a column sets the row's stage to that
// column's DEFAULT (the FIRST stage in `stages`).
interface ColumnDef {
  key: string;
  label: string;
  /** Underlying stages this column shows. The first one is the
   *  default when something drops in. */
  stages: readonly InvestorPipelineStage[];
  /** Visual accents. */
  rail: string;
  total: string;
  /** Dim graveyards. */
  dim?: boolean;
}

const COLUMNS: readonly ColumnDef[] = [
  {
    key: "prospect",
    label: "Prospect",
    stages: ["prospected", "researched"],
    rail: "bg-foreground/20",
    total: "text-foreground/80",
  },
  {
    key: "conversation",
    label: "In conversation",
    stages: ["reaching_out", "replied"],
    rail: "bg-amber-500/60",
    total: "text-foreground",
  },
  {
    key: "meeting",
    label: "Meeting",
    stages: ["meeting_scheduled", "met"],
    rail: "bg-violet-500/65",
    total: "text-foreground",
  },
  {
    key: "considering",
    label: "Considering",
    stages: ["considering"],
    rail: "bg-blue-400/60",
    total: "text-foreground",
  },
  {
    key: "closed",
    label: "Closed",
    stages: ["closed"],
    rail: "bg-emerald-500/70",
    total: "text-emerald-400",
  },
  {
    key: "passed",
    label: "Passed",
    stages: ["passed"],
    rail: "bg-foreground/10",
    total: "text-foreground/40",
    dim: true,
  },
] as const;

// Map any pipeline_stage -> its visual column key. Built once.
const STAGE_TO_COLUMN: Record<InvestorPipelineStage, string> = (() => {
  const map = {} as Record<InvestorPipelineStage, string>;
  for (const col of COLUMNS) {
    for (const s of col.stages) map[s] = col.key;
  }
  return map;
})();

interface Props {
  investors: InvestorListEntry[];
  onOpen: (id: string) => void;
}

export function InvestorKanban({ investors, onOpen }: Props) {
  const moveMut = useMoveInvestorStage();
  // The column we're hovering over while dragging.
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragSourceId = useRef<string | null>(null);

  // Bucket investors by VISUAL column. Two underlying stages can
  // land in the same column (e.g. prospected + researched both go
  // under "Prospect").
  const byColumn = useMemo(() => {
    const map = new Map<string, InvestorListEntry[]>();
    for (const col of COLUMNS) map.set(col.key, []);
    for (const inv of investors) {
      const colKey = STAGE_TO_COLUMN[inv.pipeline_stage];
      if (colKey) map.get(colKey)?.push(inv);
    }
    return map;
  }, [investors]);

  function handleDrop(col: ColumnDef, e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOverCol(null);
    const id = e.dataTransfer.getData(DT_KEY);
    dragSourceId.current = null;
    if (!id) return;
    const inv = investors.find((i) => i.id === id);
    if (!inv) return;
    // No-op if the card already lives somewhere in this column.
    if (col.stages.includes(inv.pipeline_stage)) return;
    // Drop sets the row to the column's default (first) stage.
    moveMut.mutate({ id, stage: col.stages[0]! });
  }

  return (
    // Horizontal scroll on overflow — columns keep a min-width so
    // they don't crush on narrow viewports.
    <div
      className="overflow-x-auto -mx-2 px-2 pb-3"
      // Custom scrollbar styling: thin, brand-colored, only shows
      // when needed — same pattern as Tasks kanban.
      style={{ scrollbarWidth: "thin" }}
    >
      <div className="flex items-start gap-3 min-w-fit">
        {COLUMNS.map((col, colIdx) => {
          const cards = byColumn.get(col.key) ?? [];
          const isDropTarget = dragOverCol === col.key;
          return (
            <section
              key={col.key}
              className="w-[280px] flex-shrink-0 flex flex-col"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Don't highlight if the dragged card already lives
                // in this column.
                if (dragSourceId.current) {
                  const src = investors.find(
                    (i) => i.id === dragSourceId.current,
                  );
                  if (src && col.stages.includes(src.pipeline_stage)) {
                    return;
                  }
                }
                setDragOverCol(col.key);
              }}
              onDragLeave={(e) => {
                const related = e.relatedTarget as Node | null;
                if (related && (e.currentTarget as Node).contains(related)) {
                  return;
                }
                setDragOverCol((cur) => (cur === col.key ? null : cur));
              }}
              onDrop={(e) => handleDrop(col, e)}
            >
              {/* Column head */}
              <header className="flex items-center justify-between gap-2 px-2.5 pb-2.5 mb-2 border-b border-border/60">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={
                      "inline-block h-2 w-2 rounded-full " + col.rail
                    }
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="text-[8.5px] font-mono uppercase tracking-[0.24em] text-foreground/35 leading-none">
                      §{String(colIdx + 1).padStart(2, "0")}
                    </div>
                    <h3 className="text-[11px] uppercase tracking-[0.14em] font-mono font-semibold text-foreground/85 truncate m-0 mt-0.5 leading-none">
                      {col.label}
                    </h3>
                  </div>
                </div>
                <span
                  className={
                    "ed-serif text-[18px] tabular-nums tracking-tight leading-none " +
                    col.total
                  }
                >
                  {cards.length}
                </span>
              </header>

              {/* Column body */}
              <div
                className={
                  "flex-1 min-h-[120px] rounded-sm space-y-2 p-1 transition-colors " +
                  (isDropTarget
                    ? "bg-primary/[0.04] outline outline-1 outline-dashed outline-primary/40"
                    : col.dim
                      ? "opacity-65"
                      : "")
                }
              >
                {cards.length === 0 ? (
                  <EmptyColumn col={col} />
                ) : (
                  cards.map((inv) => (
                    <KanbanInvestorCard
                      key={inv.id}
                      investor={inv}
                      onOpen={() => onOpen(inv.id)}
                      onQuickSend={() => quickSendForInvestor(inv)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DT_KEY, inv.id);
                        e.dataTransfer.effectAllowed = "move";
                        dragSourceId.current = inv.id;
                      }}
                      onDragEnd={() => {
                        dragSourceId.current = null;
                        setDragOverCol(null);
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Empty per-column hint. Each stage has a different hint text so
// the operator knows what "should" be here — turns empty space
// into guidance.
// ─────────────────────────────────────────────────────────────────
function EmptyColumn({ col }: { col: ColumnDef }) {
  const hints: Record<string, string> = {
    prospect:
      "New leads land here. Drop a card or use Find with Axon.",
    conversation:
      "Cold email sent or inbound reply. Auto-bumps from outreach.",
    meeting: "Demo or chat is on the calendar (or has happened).",
    considering: "Diligence in progress.",
    closed: "Term sheet signed.",
    passed: "Not a fit. Keeps the funnel honest.",
  };
  return (
    <div className="px-2 py-3 text-[10.5px] italic text-foreground/35 leading-snug">
      {hints[col.key] ?? ""}
    </div>
  );
}

// Re-export visual column keys for Cmd+K verb wiring.
export const KANBAN_COLUMN_KEYS = COLUMNS.map((c) => c.key);

// ─────────────────────────────────────────────────────────────────
// Phase 9.2: Quick Send helper. Pulls the first partner with email
// from the investor's contacts, then enqueues a QuickSend entry.
// The QuickSendToast picks it up and runs the draft + send pipeline.
// ─────────────────────────────────────────────────────────────────
async function quickSendForInvestor(inv: InvestorListEntry) {
  // Phase 11.1: SHOTGUN MODE. For each partner at the firm:
  //   - If the partner has an email on file, send to that one.
  //   - If not, generate pattern candidates from the firm's domain
  //     (first@, first.last@, flast@, firstlast@, first_last@) and
  //     fire ALL of them simultaneously. The investor only sees the
  //     one that actually delivers; the rest bounce back to us.
  // One draft is generated per partner and fanned out across the N
  // candidate addresses, so every send for a given partner contains
  // the same email body (important when firms run catch-alls).
  try {
    const enqueue = useQuickSendStore.getState().enqueue;
    const setStatus = useQuickSendStore.getState().setStatus;

    // Resolve the firm's company_id (InvestorListEntry exposes the
    // joined name but not the id).
    const { data: profileRow } = await companySupabase
      .from("investor_profiles")
      .select("company_id")
      .eq("id", inv.id)
      .maybeSingle();
    const companyId = (profileRow as any)?.company_id;
    if (!companyId) {
      const id = enqueue({
        investor_id: inv.id,
        firm_name: inv.company_name,
        partner_id: "",
        partner_name: "(no firm row)",
        partner_email: "",
      });
      setStatus(id, "failed", "Investor has no linked company row.");
      return;
    }

    // Pull EVERY partner at the firm -- previously we capped to 1.
    // Operator can quickly send to all GPs in one click now.
    const { data: partnerRows } = await companySupabase
      .from("crm_contacts")
      .select("id, name, email")
      .eq("company_id", companyId);
    const partners = (partnerRows ?? []) as Array<{
      id: string;
      name: string | null;
      email: string | null;
    }>;
    if (partners.length === 0) {
      const id = enqueue({
        investor_id: inv.id,
        firm_name: inv.company_name,
        partner_id: "",
        partner_name: "(no partners on file)",
        partner_email: "",
      });
      setStatus(id, "failed", "No partners listed for this firm yet.");
      return;
    }

    // Resolve firm domain for pattern generation.
    const firmDomain =
      (inv as any).company_domain ?? cleanDomain((inv as any).website ?? "");

    // For each partner, fan out. We process partners sequentially so
    // the toast queue stays readable; sends within a partner fire in
    // parallel.
    for (const partner of partners) {
      await shotgunForPartner({
        inv,
        partner,
        firmDomain,
        enqueue,
        setStatus,
      });
    }
  } catch (e) {
    console.error("[quickSendForInvestor]", e);
  }
}

/** Per-partner shotgun. Either sends to the known email (single
 *  entry) or generates pattern candidates from the firm domain and
 *  fires N parallel entries with one shared draft. */
async function shotgunForPartner(args: {
  inv: InvestorListEntry;
  partner: { id: string; name: string | null; email: string | null };
  firmDomain: string;
  enqueue: (input: any) => string;
  setStatus: (id: string, status: any, error?: string) => void;
}): Promise<void> {
  const { inv, partner, firmDomain, enqueue, setStatus } = args;
  const partnerName = partner.name ?? "Unnamed partner";

  // CASE 1: partner has a real email on file. Single send, no
  // pattern guessing, no fan-out. precomputed_draft is unset so the
  // toast row drafts per its standard path.
  if (partner.email?.trim()) {
    enqueue({
      investor_id: inv.id,
      firm_name: inv.company_name,
      partner_id: partner.id,
      partner_name: partnerName,
      partner_email: partner.email.trim(),
      pattern: "verified",
    });
    return;
  }

  // CASE 2: no email + no firm domain -> can't pattern-guess. Fail
  // gracefully with a useful message.
  if (!firmDomain) {
    const id = enqueue({
      investor_id: inv.id,
      firm_name: inv.company_name,
      partner_id: partner.id,
      partner_name: partnerName,
      partner_email: "",
    });
    setStatus(
      id,
      "failed",
      "No email + no firm domain -- add a domain to enable shotgun.",
    );
    return;
  }

  // CASE 3: no email + we have firm domain -> SHOTGUN.
  //   1. Generate pattern candidates client-side (no server hit).
  //   2. Draft ONE email (we need partner_id resolved on
  //      investor_profiles -> partners). To minimize latency we draft
  //      via /api hit later in QuickSendToast -- but we want one
  //      shared draft, not N. So we run a single draft here, attach
  //      it as precomputed_draft to every enqueue.
  //   3. Enqueue N entries, each with a different target email and
  //      the SAME precomputed_draft.
  const candidates = generatePatternCandidates(partner.name ?? "", firmDomain);
  if (candidates.length === 0) {
    const id = enqueue({
      investor_id: inv.id,
      firm_name: inv.company_name,
      partner_id: partner.id,
      partner_name: partnerName,
      partner_email: "",
    });
    setStatus(
      id,
      "failed",
      "Couldn't generate patterns -- check the partner's name + firm domain.",
    );
    return;
  }

  // Draft once for this partner. Load investor detail + settings,
  // call draftInvestorEmail, surface a single combined error if it
  // fails (rather than N identical failure rows).
  const detail = await loadInvestorDetailMinimal(inv.id);
  if (!detail) {
    const id = enqueue({
      investor_id: inv.id,
      firm_name: inv.company_name,
      partner_id: partner.id,
      partner_name: partnerName,
      partner_email: "",
    });
    setStatus(id, "failed", "Couldn't load investor detail for the draft.");
    return;
  }
  const { data: settings } = await companySupabase
    .from("fundraise_settings")
    .select("*")
    .maybeSingle();

  const mode: DraftMode =
    ((detail as any).followup_count ?? 0) <= 0
      ? "cold"
      : (detail as any).followup_count === 1
        ? "followup_1"
        : (detail as any).followup_count === 2
          ? "followup_2"
          : "followup_3";

  const draft = await draftInvestorEmail({
    investor: detail,
    partnerId: partner.id,
    channel: "email",
    settings: settings ?? null,
    mode,
  });
  if (draft.error || !draft.body.trim()) {
    const id = enqueue({
      investor_id: inv.id,
      firm_name: inv.company_name,
      partner_id: partner.id,
      partner_name: partnerName,
      partner_email: "",
    });
    setStatus(
      id,
      "failed",
      draft.error ?? "Axon returned an empty draft.",
    );
    return;
  }

  // Fan out. Each candidate becomes its own toast row with the same
  // precomputed_draft attached -- the row skips the drafting phase
  // and jumps straight to sending.
  for (const c of candidates) {
    enqueue({
      investor_id: inv.id,
      firm_name: inv.company_name,
      partner_id: partner.id,
      partner_name: partnerName,
      partner_email: c.email,
      pattern: c.pattern,
      precomputed_draft: {
        subject: draft.subject,
        body: draft.body,
        hookUsed: draft.hookUsed,
      },
    });
  }
}

// ─────────────────────────────────────────────────────────────────
// Local helpers for shotgun mode -- mirror the server-side pattern
// generator + a minimal investor-detail load so we don't pull the
// BatchOutreachModal helper indirectly.
// ─────────────────────────────────────────────────────────────────

interface ShotgunCandidate {
  email: string;
  pattern: string;
}

function generatePatternCandidates(
  partnerName: string,
  firmDomain: string,
): ShotgunCandidate[] {
  if (!partnerName.trim() || !firmDomain.trim()) return [];
  const domain = cleanDomain(firmDomain);
  if (!domain.includes(".")) return [];
  const tokens = partnerName
    .trim()
    .split(/\s+/)
    .filter((t) => !/^(jr\.?|sr\.?|ii|iii|iv|md|phd)$/i.test(t));
  if (tokens.length === 0) return [];
  const first = cleanToken(tokens[0]);
  const last =
    tokens.length > 1 ? cleanToken(tokens[tokens.length - 1]) : "";
  if (!first) return [];

  const out: ShotgunCandidate[] = [];
  out.push({ email: `${first}@${domain}`, pattern: "first" });
  if (last) {
    out.push({
      email: `${first}.${last}@${domain}`,
      pattern: "first.last",
    });
    out.push({ email: `${first[0]}${last}@${domain}`, pattern: "flast" });
    out.push({ email: `${first}${last}@${domain}`, pattern: "firstlast" });
    out.push({
      email: `${first}_${last}@${domain}`,
      pattern: "first_last",
    });
  }
  return out;
}

function cleanToken(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function cleanDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/[^a-z0-9.\-]/g, "");
}

async function loadInvestorDetailMinimal(
  id: string,
): Promise<InvestorDetail | null> {
  const { data: profile, error } = await companySupabase
    .from("investor_profiles")
    .select(
      `*, company:crm_companies!inner (id, name, domain, linkedin_url, website)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !profile) return null;
  const company = (profile as any).company;
  const partnersRes = await companySupabase
    .from("crm_contacts")
    .select("*")
    .eq("company_id", company.id);
  return {
    ...(profile as any),
    company_name: company.name,
    company_domain: company.domain,
    company_linkedin: company.linkedin_url,
    partner_count: (partnersRes.data ?? []).length,
    company,
    partners: partnersRes.data ?? [],
    activities: [],
  } as InvestorDetail;
}
