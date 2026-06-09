/**
 * useSuccessStats.ts -- the metrics that ACTUALLY matter for a
 * fundraise.
 *
 * "Delivery rate" tells you whether Gmail accepted your envelope.
 * It doesn't tell you whether anyone read it, replied, or moved
 * down the funnel. This hook computes the success ladder:
 *
 *   Sent       (envelope accepted)
 *   ↓
 *   Delivered  (didn't bounce -- already in useOutreachStats)
 *   ↓
 *   Opened     (pixel ping -- noisy on Apple Mail; see useEmailOpens)
 *   ↓
 *   Replied    ← gold-standard signal that a human cared
 *   ↓
 *   Meeting    ← they moved from "reaching_out / replied" to
 *               "meeting_scheduled / met"
 *   ↓
 *   Considering  ← diligence in progress
 *   ↓
 *   Closed     ← term sheet signed (the only metric LPs care about)
 *
 * Data sources:
 *   - crm_activities (direction=outbound)  -- sends
 *   - crm_activities (direction=inbound)   -- replies, matched by
 *                                              thread_id OR contact_id
 *   - investor_profiles.pipeline_stage     -- current funnel state
 *   - investor_profiles.last_outreach_at   -- date of last cold touch
 *
 * Backed by TanStack Query (60s staleTime) so tab-switching doesn't
 * thrash. Refresh button calls invalidateQueries.
 */

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";

export interface SuccessStats {
  /** Total cold/follow-up sends in the window. Same number as
   *  useOutreachStats.totalSent -- duplicated here so this hook is
   *  self-contained. */
  sendsInWindow: number;
  /** Distinct investors contacted in the window. Can be smaller
   *  than sendsInWindow if shotgun mode sent 5 addresses per
   *  partner; we collapse them. */
  investorsContacted: number;
  /** Investors who replied to anything you sent. */
  investorsReplied: number;
  /** Reply rate = investorsReplied / investorsContacted. 0..1. */
  replyRate: number;
  /** Investors whose pipeline_stage is meeting_scheduled or later. */
  investorsAtMeetingOrFurther: number;
  /** Meeting rate = investorsAtMeetingOrFurther / investorsContacted. */
  meetingRate: number;
  /** Investors at "closed". */
  investorsClosed: number;
  closeRate: number;
  /** Average days between first outbound and first inbound reply
   *  for investors who DID reply. Median would be better for tail
   *  resistance but mean is fine at fundraise scale. Null if no
   *  replies. */
  avgReplyLatencyDays: number | null;
  /** Current distribution across pipeline stages, for the
   *  progression bar. Only counts investors with at least one
   *  recorded outreach. */
  funnel: FunnelBucket[];
  /** Hot leads -- replied but no follow-up sent since their reply.
   *  These are the highest-value action items. Sorted by reply
   *  date desc (most recent first). */
  hotLeads: HotLead[];
}

export interface FunnelBucket {
  label: string;
  count: number;
  /** 0..1 -- count / total */
  share: number;
  /** Visual tone for the bar. */
  tone: "neutral" | "amber" | "primary" | "violet" | "blue" | "emerald";
}

export interface HotLead {
  investor_id: string;
  firm_name: string;
  partner_name: string | null;
  replied_at: string;
  days_since_reply: number;
}

export interface UseSuccessStatsState {
  data: SuccessStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface OutboundRow {
  contact_id: string | null;
  deal_id: string | null;
  happened_at: string;
  metadata: {
    direction?: string;
    thread_id?: string;
    [k: string]: any;
  } | null;
}

interface InboundRow {
  contact_id: string | null;
  deal_id: string | null;
  happened_at: string;
  metadata: {
    direction?: string;
    thread_id?: string;
    [k: string]: any;
  } | null;
}

interface InvestorRow {
  id: string;
  company_id: string;
  pipeline_stage: string;
  last_outreach_at: string | null;
}

interface CompanyRow {
  id: string;
  name: string;
}

interface ContactRow {
  id: string;
  company_id: string;
  name: string | null;
}

const MEETING_OR_FURTHER = new Set([
  "meeting_scheduled",
  "met",
  "considering",
  "closed",
]);

async function loadSuccessStats(windowDays: number): Promise<SuccessStats> {
  const sinceIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - windowDays);
    return d.toISOString();
  })();

  // 1. All outbound emails in the window.
  const { data: outRows, error: outErr } = await companySupabase
    .from("crm_activities")
    .select("contact_id, deal_id, happened_at, metadata")
    .eq("type", "email")
    .gte("happened_at", sinceIso)
    .order("happened_at", { ascending: true });
  if (outErr) throw outErr;
  const outbound = ((outRows ?? []) as OutboundRow[]).filter(
    (r) => r.metadata?.direction === "outbound",
  );

  // 2. All inbound emails ever -- replies can land long after the
  //    initial send, even when the send was in the window. We don't
  //    cap by sinceIso because a reply from 31 days ago to a send
  //    35 days ago shouldn't count, but we filter that in step 5.
  const { data: inRows, error: inErr } = await companySupabase
    .from("crm_activities")
    .select("contact_id, deal_id, happened_at, metadata")
    .eq("type", "email")
    .order("happened_at", { ascending: true });
  if (inErr) throw inErr;
  const inbound = ((inRows ?? []) as InboundRow[]).filter(
    (r) => r.metadata?.direction === "inbound",
  );

  // 3. Investor profiles + companies + contacts (for the hot-leads
  //    list which needs firm + partner names).
  const { data: invRows, error: invErr } = await companySupabase
    .from("investor_profiles")
    .select("id, company_id, pipeline_stage, last_outreach_at");
  if (invErr) throw invErr;
  const investors = (invRows ?? []) as InvestorRow[];

  const { data: coRows } = await companySupabase
    .from("crm_companies")
    .select("id, name");
  const companiesById = new Map<string, CompanyRow>(
    ((coRows ?? []) as CompanyRow[]).map((c) => [c.id, c]),
  );

  const { data: ctRows } = await companySupabase
    .from("crm_contacts")
    .select("id, company_id, name");
  const contactsByCompany = new Map<string, ContactRow[]>();
  for (const ct of ((ctRows ?? []) as ContactRow[])) {
    const list = contactsByCompany.get(ct.company_id) ?? [];
    list.push(ct);
    contactsByCompany.set(ct.company_id, list);
  }

  // 4. Map contact_id -> investor (company_id -> investor).
  const investorByContact = new Map<string, InvestorRow>();
  const investorByCompany = new Map<string, InvestorRow>();
  for (const inv of investors) investorByCompany.set(inv.company_id, inv);
  for (const [companyId, contacts] of contactsByCompany) {
    const inv = investorByCompany.get(companyId);
    if (!inv) continue;
    for (const ct of contacts) investorByContact.set(ct.id, inv);
  }

  // 5. Compute "investors contacted in window" + their first send
  //    time per investor.
  const firstOutboundPerInvestor = new Map<string, string>();
  for (const row of outbound) {
    if (!row.contact_id) continue;
    const inv = investorByContact.get(row.contact_id);
    if (!inv) continue;
    if (!firstOutboundPerInvestor.has(inv.id)) {
      firstOutboundPerInvestor.set(inv.id, row.happened_at);
    }
  }
  const contactedInvestors = new Set(firstOutboundPerInvestor.keys());

  // 6. Compute "investors who replied" -- match inbound to a prior
  //    outbound by contact_id (more reliable than thread_id since
  //    the inbound row may not have it filled). Reply must be AFTER
  //    the first outbound to that investor and within 60 days of
  //    it (anything further out is unrelated).
  const REPLY_WINDOW_MS = 60 * 86_400_000;
  const repliedInvestors = new Map<string, string>(); // investor_id -> first reply iso
  for (const row of inbound) {
    if (!row.contact_id) continue;
    const inv = investorByContact.get(row.contact_id);
    if (!inv) continue;
    const firstOutIso = firstOutboundPerInvestor.get(inv.id);
    if (!firstOutIso) continue;
    const firstOut = new Date(firstOutIso).getTime();
    const inAt = new Date(row.happened_at).getTime();
    if (inAt < firstOut) continue;
    if (inAt - firstOut > REPLY_WINDOW_MS) continue;
    if (!repliedInvestors.has(inv.id)) {
      repliedInvestors.set(inv.id, row.happened_at);
    }
  }

  // 7. Reply latency.
  let latencySumDays = 0;
  let latencyCount = 0;
  for (const [invId, replyIso] of repliedInvestors) {
    const outIso = firstOutboundPerInvestor.get(invId);
    if (!outIso) continue;
    const days =
      (new Date(replyIso).getTime() - new Date(outIso).getTime()) /
      86_400_000;
    if (days >= 0) {
      latencySumDays += days;
      latencyCount += 1;
    }
  }
  const avgReplyLatencyDays =
    latencyCount > 0 ? latencySumDays / latencyCount : null;

  // 8. Meeting + close counts. Includes only investors contacted in
  //    window (rate denominator is consistent across rows).
  let meetingCount = 0;
  let closedCount = 0;
  for (const invId of contactedInvestors) {
    const real = investors.find((i) => i.id === invId);
    if (!real) continue;
    if (MEETING_OR_FURTHER.has(real.pipeline_stage)) meetingCount += 1;
    if (real.pipeline_stage === "closed") closedCount += 1;
  }

  // 9. Funnel buckets -- whole investor base, where everyone is RIGHT
  //    now. Drives the progression bar.
  const FUNNEL: { stages: string[]; label: string; tone: FunnelBucket["tone"] }[] = [
    { stages: ["prospected", "researched"], label: "Prospect", tone: "neutral" },
    { stages: ["reaching_out", "replied"], label: "In conversation", tone: "amber" },
    { stages: ["meeting_scheduled", "met"], label: "Meeting", tone: "violet" },
    { stages: ["considering"], label: "Considering", tone: "blue" },
    { stages: ["closed"], label: "Closed", tone: "emerald" },
    { stages: ["passed"], label: "Passed", tone: "neutral" },
  ];
  const stageCounts = new Map<string, number>();
  for (const inv of investors) {
    stageCounts.set(
      inv.pipeline_stage,
      (stageCounts.get(inv.pipeline_stage) ?? 0) + 1,
    );
  }
  const fTotal = investors.length || 1;
  const funnel: FunnelBucket[] = FUNNEL.map((b) => {
    const count = b.stages.reduce(
      (sum, s) => sum + (stageCounts.get(s) ?? 0),
      0,
    );
    return {
      label: b.label,
      count,
      share: count / fTotal,
      tone: b.tone,
    };
  });

  // 10. Hot leads: investors who replied but no subsequent outbound
  //     was logged after their reply. These are the ones rotting in
  //     your inbox.
  const lastOutboundPerInvestor = new Map<string, string>();
  for (const row of outbound) {
    if (!row.contact_id) continue;
    const inv = investorByContact.get(row.contact_id);
    if (!inv) continue;
    const cur = lastOutboundPerInvestor.get(inv.id);
    if (!cur || row.happened_at > cur) {
      lastOutboundPerInvestor.set(inv.id, row.happened_at);
    }
  }
  const hotLeads: HotLead[] = [];
  for (const [invId, replyIso] of repliedInvestors) {
    const lastOut = lastOutboundPerInvestor.get(invId);
    if (lastOut && lastOut >= replyIso) continue; // already bumped
    const inv = investors.find((i) => i.id === invId);
    if (!inv) continue;
    const company = companiesById.get(inv.company_id);
    if (!company) continue;
    const contacts = contactsByCompany.get(inv.company_id) ?? [];
    const partnerName = contacts[0]?.name ?? null;
    const days = Math.floor(
      (Date.now() - new Date(replyIso).getTime()) / 86_400_000,
    );
    hotLeads.push({
      investor_id: invId,
      firm_name: company.name,
      partner_name: partnerName,
      replied_at: replyIso,
      days_since_reply: days,
    });
  }
  hotLeads.sort((a, b) => b.replied_at.localeCompare(a.replied_at));

  const investorsContacted = contactedInvestors.size;
  const investorsReplied = repliedInvestors.size;
  return {
    sendsInWindow: outbound.length,
    investorsContacted,
    investorsReplied,
    replyRate:
      investorsContacted === 0 ? 0 : investorsReplied / investorsContacted,
    investorsAtMeetingOrFurther: meetingCount,
    meetingRate:
      investorsContacted === 0 ? 0 : meetingCount / investorsContacted,
    investorsClosed: closedCount,
    closeRate:
      investorsContacted === 0 ? 0 : closedCount / investorsContacted,
    avgReplyLatencyDays,
    funnel,
    hotLeads: hotLeads.slice(0, 8),
  };
}

export function useSuccessStats(
  windowDays: number = 30,
): UseSuccessStatsState {
  const qc = useQueryClient();
  const queryKey = useMemo(
    () => ["fundraise", "success-stats", windowDays] as const,
    [windowDays],
  );
  const q = useQuery<SuccessStats, Error>({
    queryKey,
    queryFn: () => loadSuccessStats(windowDays),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  return {
    data: q.data ?? null,
    loading: q.isLoading || q.isFetching,
    error: q.error ? q.error.message : null,
    refresh: async () => {
      await qc.invalidateQueries({ queryKey });
    },
  };
}
