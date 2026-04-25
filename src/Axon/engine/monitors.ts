// ───────────────────────────────────────────────────────────────────
// Monitors — background checks that can proactively alert AXON.
// Register a monitor once; the provider polls the ones enabled in
// settings and routes alerts through the conversation channel.
//
// One working monitor is included (overdue tasks) as the pattern.
// Adding more is: append an entry to MONITORS.
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import type { Monitor } from "../types";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

export const MONITORS: Monitor[] = [
  {
    id: "overdue-tasks",
    label: "Overdue tasks",
    description:
      "Alerts when any task is past its deadline and still open, scoped to the active company.",
    intervalMs: 5 * 60 * 1000,
    check: async (ctx) => {
      const now = new Date().toISOString();
      let q = supabase
        .from("cwa_todos")
        .select("todo_id", { count: "exact", head: true })
        .neq("status", "done")
        .lt("deadline", now)
        .gt("deadline", "");
      if (ctx.activeCompany !== "all") q = q.eq("company", companyLabel(ctx.activeCompany));
      const { count, error } = await q;
      if (error) return null;
      const n = count ?? 0;
      return n > 0 ? `${n} overdue task${n === 1 ? "" : "s"} require attention.` : null;
    },
  },
  {
    id: "stale-meetings",
    label: "Meetings without follow-up",
    description:
      "Alerts when a meeting from 2+ days ago has no task whose title overlaps the meeting title — a likely missed follow-up.",
    intervalMs: 30 * 60 * 1000,
    check: (() => {
      // Closure-keyed dedupe so the same meeting doesn't fire every
      // 30 minutes. Cleared on session reload.
      const alerted = new Set<string>();
      return async (ctx) => {
        const today = new Date();
        const twoDaysAgo = new Date(today);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        let mq = supabase
          .from("cwa_meetings")
          .select("id, meeting_title, date")
          .lte("date", twoDaysAgo.toISOString().slice(0, 10))
          .gte("date", fiveDaysAgo.toISOString().slice(0, 10))
          .limit(20);
        if (ctx.activeCompany !== "all")
          mq = mq.eq("company", companyLabel(ctx.activeCompany));
        const { data: meetings, error } = await mq;
        if (error || !meetings || meetings.length === 0) return null;

        for (const m of meetings) {
          const id = String((m as any).id);
          if (alerted.has(id)) continue;
          const title = ((m as any).meeting_title as string | undefined)?.trim();
          if (!title || title.length < 4) continue;
          const safeTitle = title.replace(/[%_]/g, "").slice(0, 40);
          const { count: matches } = await supabase
            .from("cwa_todos")
            .select("todo_id", { count: "exact", head: true })
            .ilike("title", `%${safeTitle}%`);
          if ((matches ?? 0) === 0) {
            alerted.add(id);
            return `That ${(m as any).date} meeting "${title}" has no follow-up task. Want me to create one?`;
          }
        }
        return null;
      };
    })(),
  },
  {
    id: "revenue-swing",
    label: "Revenue week-over-week swing",
    description:
      "Compares the last 7 days of invoice income to the prior 7 days. Alerts on >25% jumps or drops.",
    intervalMs: 60 * 60 * 1000,
    check: (() => {
      let lastReportedBucket: string | null = null;
      return async (ctx) => {
        const now = new Date();
        const cutoff7 = new Date(now);
        cutoff7.setDate(cutoff7.getDate() - 7);
        const cutoff14 = new Date(now);
        cutoff14.setDate(cutoff14.getDate() - 14);

        let q = supabase
          .from("cwa_invoices")
          .select("outcome, creation_date")
          .gte("creation_date", cutoff14.toISOString())
          .limit(500);
        if (ctx.activeCompany !== "all")
          q = q.eq("company", companyLabel(ctx.activeCompany));
        const { data, error } = await q;
        if (error || !data) return null;

        const cur = data
          .filter((r: any) => new Date(r.creation_date) >= cutoff7)
          .reduce((s: number, r: any) => s + (Number(r.outcome) || 0), 0);
        const prev = data
          .filter((r: any) => new Date(r.creation_date) < cutoff7)
          .reduce((s: number, r: any) => s + (Number(r.outcome) || 0), 0);

        if (prev <= 0) return null;
        const delta = ((cur - prev) / prev) * 100;
        // Bucket key combines the week boundary + rounded delta so the
        // alert only repeats when the situation materially changes.
        const bucket = `${cutoff7.toISOString().slice(0, 10)}-${Math.round(delta / 5) * 5}`;
        if (lastReportedBucket === bucket) return null;
        if (Math.abs(delta) < 25) return null;

        lastReportedBucket = bucket;
        const direction = delta > 0 ? "up" : "down";
        return `Revenue is ${direction} ${Math.abs(Math.round(delta))}% week-over-week. Want a breakdown?`;
      };
    })(),
  },
  {
    id: "new-signups",
    label: "New user signups",
    description: "Alerts when new users appear in `app_users` since the last check.",
    intervalMs: 60 * 1000,
    // Uses a closure-captured baseline so each poll is diff-based.
    check: (() => {
      let baseline: number | null = null;
      return async (_ctx) => {
        const { count, error } = await supabase
          .from("app_users")
          .select("supa_id", { count: "exact", head: true });
        if (error) return null;
        const now = count ?? 0;
        if (baseline === null) {
          baseline = now;
          return null;
        }
        if (now > baseline) {
          const delta = now - baseline;
          baseline = now;
          return `${delta} new signup${delta === 1 ? "" : "s"} detected.`;
        }
        return null;
      };
    })(),
  },
];

export function getMonitor(id: string): Monitor | undefined {
  return MONITORS.find((m) => m.id === id);
}
