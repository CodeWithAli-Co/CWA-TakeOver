/**
 * useEmailOpens.ts -- query open events for outbound emails.
 *
 * Pixel-tracking architecture (desktop side):
 *
 *   1. QuickSendRunner generates a UUID `tracking_id` per send.
 *   2. The id is passed to /api/gmail/send. The server is expected
 *      to:
 *        a. Embed an invisible <img src="{base}/api/track/{id}.gif"
 *           width="1" height="1"> in the email body before sending.
 *        b. Stamp the tracking_id onto the activity row's metadata.
 *        c. Expose a route that records opens to an `email_opens`
 *           table when the pixel is fetched (IP, UA, opened_at).
 *   3. This hook reads aggregated open data for outbound activities
 *      in a window so the Outreach tab can show open rate.
 *
 * SERVER-SIDE TODO (takeover-B2B): the routes + email_opens table
 * don't exist yet. Until they do, this hook returns zero counts
 * gracefully (so the desktop UI doesn't break -- it just shows 0%).
 *
 * Honest caveat to surface in the UI: Apple Mail Privacy Protection
 * (iOS 15+) pre-fetches all tracking pixels on receipt, so opens
 * from Apple Mail are fake-positive. Treat open rate as a soft
 * directional signal, not a measure of actual engagement.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { companySupabase } from "@/MyComponents/supabase";

export interface OpenStats {
  /** Total outbound activities in window that had a tracking_id stamped. */
  trackedSends: number;
  /** Total outbound activities with at least one recorded open. */
  opened: number;
  /** opened / trackedSends. 0..1. Note: inflated by Apple Mail
   *  Privacy Protection pre-fetches; treat as directional. */
  openRate: number;
}

interface ActivityRow {
  id: string;
  metadata: {
    direction?: string;
    tracking_id?: string;
    [k: string]: any;
  } | null;
}

interface OpenRow {
  tracking_id: string;
}

async function loadOpenStats(windowDays: number): Promise<OpenStats> {
  const sinceIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - windowDays);
    return d.toISOString();
  })();

  // 1. Outbound activities in window WITH a tracking_id.
  const { data: actRows } = await companySupabase
    .from("crm_activities")
    .select("id, metadata")
    .eq("type", "email")
    .gte("happened_at", sinceIso);
  const tracked = ((actRows ?? []) as ActivityRow[]).filter(
    (r) => r.metadata?.direction === "outbound" && r.metadata?.tracking_id,
  );
  const trackedIds = new Set(
    tracked.map((r) => r.metadata!.tracking_id as string),
  );
  if (trackedIds.size === 0) {
    return { trackedSends: 0, opened: 0, openRate: 0 };
  }

  // 2. Open events for those tracking_ids.
  //    The `email_opens` table is created server-side; if it
  //    doesn't exist yet (PostgREST 42P01 or PGRST205), we
  //    swallow gracefully so the UI doesn't break.
  const idsArr = Array.from(trackedIds);
  const { data: openRows, error: openErr } = await companySupabase
    .from("email_opens")
    .select("tracking_id")
    .in("tracking_id", idsArr);
  if (openErr) {
    const code = (openErr as any).code;
    const msg = (openErr as any).message ?? "";
    const tableMissing =
      code === "42P01" ||
      code === "PGRST205" ||
      msg.includes("relation") ||
      msg.includes("does not exist");
    if (tableMissing) {
      return {
        trackedSends: trackedIds.size,
        opened: 0,
        openRate: 0,
      };
    }
    throw openErr;
  }
  const openedIds = new Set(
    ((openRows ?? []) as OpenRow[]).map((r) => r.tracking_id),
  );
  return {
    trackedSends: trackedIds.size,
    opened: openedIds.size,
    openRate: trackedIds.size === 0 ? 0 : openedIds.size / trackedIds.size,
  };
}

export function useEmailOpens(windowDays: number = 30) {
  const queryKey = useMemo(
    () => ["fundraise", "open-stats", windowDays] as const,
    [windowDays],
  );
  const q = useQuery<OpenStats, Error>({
    queryKey,
    queryFn: () => loadOpenStats(windowDays),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
  return {
    data: q.data ?? null,
    loading: q.isLoading || q.isFetching,
    error: q.error ? q.error.message : null,
  };
}

// ─── Server-side spec (for the takeover-B2B repo) ──────────

/**
 * What the takeover-B2B server needs to add to make pixel tracking
 * work end-to-end. The desktop is already passing tracking_id; once
 * the routes below ship, opens will flow back to the dashboard
 * automatically.
 *
 * 1) Migration -- `email_opens` table.
 *
 *    create table email_opens (
 *      id           uuid primary key default gen_random_uuid(),
 *      tracking_id  text not null,
 *      opened_at    timestamptz not null default now(),
 *      ip           text,
 *      user_agent   text,
 *      tenant       text
 *    );
 *    create index email_opens_tracking_id_idx on email_opens(tracking_id);
 *    -- RLS: tenant-scoped read; service-role insert from the
 *    -- public tracking route.
 *
 * 2) Modify /api/gmail/send -- accept tracking_id in the body.
 *    Before MIME-encoding the message, prepend or append:
 *      <img src="{PUBLIC_BASE_URL}/api/track/{tracking_id}.gif"
 *           width="1" height="1" style="display:none" alt="" />
 *    to the HTML body. Also write tracking_id into the
 *    activity row metadata.tracking_id.
 *
 * 3) New /api/track/[id].gif route -- public, no auth. Returns a
 *    1x1 transparent gif, ALWAYS, even on error. On the way, it
 *    inserts a row into email_opens. Cache-Control: no-store.
 *    Honors the resolver lookup of tenant from tracking_id ->
 *    activity row.
 *
 * 4) Surface a Privacy Protection caveat in the docs: Apple Mail
 *    pre-fetches all pixels, so opens from Apple recipients are
 *    fake-positive. Show the "directional only" caveat to the
 *    operator.
 */
