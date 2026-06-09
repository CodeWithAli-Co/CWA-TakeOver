/**
 * useRecentSends.ts -- persistent recent-sends list for the
 * Outreach tab.
 *
 * Pulls the last N outbound emails from `crm_activities` (the same
 * table that's already used for deliverability stats). Joins:
 *   - `crm_contacts`        -- partner name + linked company_id
 *   - `crm_companies`       -- firm name (via nested select)
 *   - `app_users`           -- actor display name (separate query
 *                              keyed by actor_supa_id)
 *
 * This replaces the previous in-memory `RecentList` which only
 * showed sends from the current session and disappeared on reload.
 * Now sends are surfaced from the audit table, persistent forever,
 * with the operator who sent each row attributed.
 *
 * AUDIT GAP -- email BODY is not yet stored on the activity row.
 * The takeover-B2B /api/gmail/send route only writes the subject +
 * recipient + sender + pattern + tracking_id to metadata.body_md
 * is currently just "To: X". To close the audit gap, the server
 * route needs to also write the resolved body text. See server-side
 * TODO at the bottom of this file.
 *
 * Cached via TanStack Query (60s staleTime) so the tile doesn't
 * re-query on every tab switch.
 */

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";

export interface RecentSend {
  id: string;
  happened_at: string;
  contact_id: string | null;
  // Operator who sent it (audit trail).
  actor_supa_id: string | null;
  actor_username: string | null;
  actor_role: string | null;
  // Recipient details (from metadata + joined contact).
  partner_name: string | null;
  firm_name: string | null;
  to_email: string | null;
  // Email-specific.
  subject: string | null;
  pattern: string | null;
  thread_id: string | null;
  gmail_id: string | null;
  tracking_id: string | null;
  /** body_md from the activity row. Currently just "To: X" until
   *  the server route stores full body. Null when missing. */
  body: string | null;
  /** Optional: where this send sits in our send-status taxonomy.
   *  All historical rows are treated as "sent" (Gmail accepted) --
   *  we don't have bounce status surfaced here yet. */
  status: "sent";
}

export interface UseRecentSendsState {
  data: RecentSend[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface ActivityRow {
  id: string;
  happened_at: string;
  contact_id: string | null;
  actor_supa_id: string | null;
  body_md: string | null;
  metadata: {
    direction?: string;
    to?: string;
    subject?: string;
    pattern?: string;
    thread_id?: string;
    gmail_id?: string;
    tracking_id?: string;
    [k: string]: any;
  } | null;
  contact: {
    name: string | null;
    company_id: string | null;
    company: { name: string | null } | null;
  } | null;
}

interface UserRow {
  supa_id: string;
  username: string | null;
  role: string | null;
}

async function loadRecentSends(limit: number): Promise<RecentSend[]> {
  // 1. Pull the most recent N outbound emails. The nested select on
  //    `contact:crm_contacts` + nested `company:crm_companies`
  //    handles the partner + firm join in a single round-trip.
  const { data: actRows, error } = await companySupabase
    .from("crm_activities")
    .select(
      `
      id,
      happened_at,
      contact_id,
      actor_supa_id,
      body_md,
      metadata,
      contact:crm_contacts(name, company_id, company:crm_companies(name))
      `,
    )
    .eq("type", "email")
    .order("happened_at", { ascending: false })
    .limit(limit * 3); // overfetch since we filter direction client-side
  if (error) throw error;
  const rows = ((actRows ?? []) as unknown) as ActivityRow[];

  // 2. Filter to outbound only. Could be a server-side filter via
  //    metadata->>direction but PostgREST chaining gets ugly; the
  //    response set is small enough to filter in JS.
  const outbound = rows
    .filter((r) => r.metadata?.direction === "outbound")
    .slice(0, limit);

  // 3. Resolve actor names. One round-trip for the unique set of
  //    actor_supa_ids. We use the same app_users table the kudos /
  //    employee directory queries hit, so this respects whatever
  //    RLS is in place on it.
  const actorIds = Array.from(
    new Set(
      outbound
        .map((r) => r.actor_supa_id)
        .filter((id): id is string => !!id),
    ),
  );
  const actorMap = new Map<string, UserRow>();
  if (actorIds.length > 0) {
    const { data: userRows } = await companySupabase
      .from("app_users")
      .select("supa_id, username, role")
      .in("supa_id", actorIds);
    for (const u of (userRows ?? []) as UserRow[]) {
      actorMap.set(u.supa_id, u);
    }
  }

  // 4. Project into RecentSend shape.
  return outbound.map((r): RecentSend => {
    const actor = r.actor_supa_id
      ? actorMap.get(r.actor_supa_id) ?? null
      : null;
    return {
      id: r.id,
      happened_at: r.happened_at,
      contact_id: r.contact_id,
      actor_supa_id: r.actor_supa_id,
      actor_username: actor?.username ?? null,
      actor_role: actor?.role ?? null,
      partner_name: r.contact?.name ?? null,
      firm_name: r.contact?.company?.name ?? null,
      to_email: r.metadata?.to ?? null,
      subject: r.metadata?.subject ?? null,
      pattern: r.metadata?.pattern ?? null,
      thread_id: r.metadata?.thread_id ?? null,
      gmail_id: r.metadata?.gmail_id ?? null,
      tracking_id: r.metadata?.tracking_id ?? null,
      body: r.body_md ?? null,
      status: "sent",
    };
  });
}

export function useRecentSends(limit: number = 50): UseRecentSendsState {
  const qc = useQueryClient();
  const queryKey = useMemo(
    () => ["fundraise", "recent-sends", limit] as const,
    [limit],
  );
  const q = useQuery<RecentSend[], Error>({
    queryKey,
    queryFn: () => loadRecentSends(limit),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  return {
    data: q.data ?? [],
    loading: q.isLoading || q.isFetching,
    error: q.error ? q.error.message : null,
    refresh: async () => {
      await qc.invalidateQueries({ queryKey });
    },
  };
}

// ─── Server-side spec (takeover-B2B) ────────────────────────
//
// AUDIT GAP -- the email BODY is not yet stored on the activity
// row. Currently /api/gmail/send writes:
//
//   crm_activities {
//     type:           "email"
//     title:          "Sent email: {subject}"
//     body_md:        "To: {to}"           <- body NOT stored
//     actor_supa_id:  operator.supa_id
//     happened_at:    iso
//     metadata: {
//       direction:    "outbound"
//       to, subject, thread_id, gmail_id, pattern, tracking_id
//     }
//   }
//
// To make the audit trail complete (so the EmailBodyModal can show
// the actual email content for historical sends, not just live
// session ones), the server route should write the resolved body
// text into body_md (or a new dedicated column / table). Options:
//
//   1) Cheapest: replace body_md = "To: X" with body_md = <full
//      body markdown> and stash the recipient into metadata.to
//      (already done). This breaks no consumers since "To: X" is
//      already low-value boilerplate.
//
//   2) Safer: add a new column `email_body text` to crm_activities,
//      indexed only by id. Cleaner separation; body_md stays as
//      summary. Migration required.
//
//   3) New table `email_audit` keyed by activity_id with body +
//      headers + ip + ua. Best for compliance but most schema work.
//
// Pick (1) for speed, (2) or (3) if SOC2/ISO needs richer audit.
