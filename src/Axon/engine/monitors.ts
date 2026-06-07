// ───────────────────────────────────────────────────────────────────
// Monitors — background checks that can proactively alert AXON.
// Register a monitor once; the provider polls the ones enabled in
// settings and routes alerts through the conversation channel.
//
// One working monitor is included (overdue tasks) as the pattern.
// Adding more is: append an entry to MONITORS.
// ───────────────────────────────────────────────────────────────────

import { takeOversupabase } from "@/MyComponents/supabase";
import type { Monitor } from "../types";
import {
  fetchUnifiedFinance,
  monthlyBurnCents,
  runwayDays,
  totalCashCents,
} from "@/lib/unified/finance";
import { fetchConnectorByKind } from "@/stores/connectors";
import { vercelListDeployments } from "@/lib/vercel";
import { slackPostMessage } from "@/lib/slack";

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
    // ── Dedupe rules ───────────────────────────────────────────────
    // 1. Same overdue count as last alert → silent. The user already
    //    heard it. Repeating the same number every 5 minutes is the
    //    bug behavior we're fixing.
    // 2. Count INCREASES (new overdue tasks appeared) → alert with
    //    the delta so the user knows something materially changed.
    // 3. Count DECREASES (user closed some) → silent. No need to
    //    interrupt with "good news, less work to do" updates.
    // 4. Same count for 6+ hours → re-surface once. Catches the case
    //    where the user heard it, did nothing, and we want one
    //    gentle nudge per shift rather than total silence forever.
    //
    // State is persisted to localStorage so a reload doesn't reset
    // the dedupe and start spamming again from scratch.
    check: (() => {
      const STORE_KEY = "axon:monitor:overdue-tasks:v1";
      const COOLDOWN_MS = 6 * 60 * 60 * 1000;

      type Persisted = { count: number; alertedAt: number };
      const load = (): Persisted | null => {
        try {
          const raw = localStorage.getItem(STORE_KEY);
          return raw ? (JSON.parse(raw) as Persisted) : null;
        } catch {
          return null;
        }
      };
      const save = (p: Persisted | null) => {
        try {
          if (p === null) localStorage.removeItem(STORE_KEY);
          else localStorage.setItem(STORE_KEY, JSON.stringify(p));
        } catch {
          /* ignore quota / private-mode errors */
        }
      };

      return async (ctx) => {
        const now = new Date().toISOString();
        let q = takeOversupabase
          .from("cwa_todos")
          .select("todo_id", { count: "exact", head: true })
          .neq("status", "done")
          .lt("deadline", now)
          .gt("deadline", "");
        if (ctx.activeCompany !== "all") q = q.eq("company", companyLabel(ctx.activeCompany));
        const { count, error } = await q;
        if (error) return null;
        const n = count ?? 0;

        const prev = load();

        // No overdue tasks: clear state so the next time tasks
        // appear we treat it as a fresh alert, not a "delta from
        // some stale old number".
        if (n === 0) {
          if (prev) save(null);
          return null;
        }

        // First time we've ever alerted, OR count went up.
        if (!prev || n > prev.count) {
          save({ count: n, alertedAt: Date.now() });
          const delta = prev ? n - prev.count : 0;
          if (delta > 0 && prev) {
            return `${n} overdue task${n === 1 ? "" : "s"} — ${delta} new since last alert.`;
          }
          return `${n} overdue task${n === 1 ? "" : "s"} require attention.`;
        }

        // Same count or fewer.
        // (a) Fewer → user closed some. Update the baseline silently
        //     so a future increase from THIS count is correctly
        //     reported as new, not measured against a stale max.
        if (n < prev.count) {
          save({ count: n, alertedAt: prev.alertedAt });
          return null;
        }

        // (b) Same count: only re-surface after the cooldown so we
        //     don't pester. 6h means it'll surface ~once per shift.
        const elapsed = Date.now() - prev.alertedAt;
        if (elapsed < COOLDOWN_MS) return null;

        save({ count: n, alertedAt: Date.now() });
        return `Still ${n} overdue task${n === 1 ? "" : "s"} sitting unhandled.`;
      };
    })(),
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

        let mq = takeOversupabase
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
          const { count: matches } = await takeOversupabase
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

        let q = takeOversupabase
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
        const { count, error } = await takeOversupabase
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
  // ─── runway-alarm ────────────────────────────────────────────────
  //
  // Fires when current runway (cash / burn) drops below 90 days, and
  // adds an urgency line if the upcoming round closes after the cash
  // runs out. Once per session — the user heard it once, they don't
  // need to hear it every 15 minutes.
  {
    id: "runway-alarm",
    label: "Runway alarm",
    description:
      "Reads cash from connected finance providers + burn from Capital Plan actuals. Fires when runway < 90 days. Once per session.",
    intervalMs: 15 * 60 * 1000,
    check: (() => {
      let fired = false;
      return async (_ctx) => {
        if (fired) return null;
        try {
          const fin = await fetchUnifiedFinance({ txLimit: 200 });
          const cash = totalCashCents(fin.balances);
          const burn = monthlyBurnCents(fin.transactions, 30);
          const days = runwayDays(cash, burn);
          if (days === null) return null;
          if (days >= 90) return null;

          // Look up the next planning/raising round to add the
          // "you'll be empty before close" urgency line.
          const { data: rounds } = await takeOversupabase
            .from("capital_rounds")
            .select("name, target_close_date, status")
            .in("status", ["planning", "raising"])
            .not("target_close_date", "is", null)
            .order("target_close_date", { ascending: true })
            .limit(1);
          const next = rounds?.[0] as
            | { name: string; target_close_date: string }
            | undefined;
          const daysToClose = next?.target_close_date
            ? Math.ceil(
                (new Date(next.target_close_date).getTime() - Date.now()) /
                  86_400_000,
              )
            : null;

          fired = true;
          if (next && daysToClose !== null && days < daysToClose) {
            return `${days} days of runway at current burn. Your ${next.name} closes in ${daysToClose} days — you'll be empty before then.`;
          }
          return `${days} days of runway at current burn. Worth a serious look.`;
        } catch {
          return null;
        }
      };
    })(),
  },

  // ─── investor-stale ──────────────────────────────────────────────
  //
  // Looks at capital_checks in active (non-final) statuses. Fires when
  // any check's last_touch_at is older than 14 days. Lists the top 3
  // names so the operator can act. Once per 6h.
  {
    id: "investor-stale",
    label: "Stale investors",
    description:
      "Watches the active investor pipeline. Fires when a check has gone quiet > 14 days. Once per 6 hours.",
    intervalMs: 60 * 60 * 1000,
    check: (() => {
      const STORE_KEY = "axon:monitor:investor-stale:v1";
      const COOLDOWN_MS = 6 * 60 * 60 * 1000;
      type Persisted = { firedAt: number; signature: string };
      const load = (): Persisted | null => {
        try {
          const raw = localStorage.getItem(STORE_KEY);
          return raw ? (JSON.parse(raw) as Persisted) : null;
        } catch {
          return null;
        }
      };
      const save = (p: Persisted) => {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(p));
        } catch {
          /* ignore */
        }
      };
      return async (_ctx) => {
        const STALE_DAYS = 14;
        const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000)
          .toISOString();

        // Active = pre-decision statuses where a follow-up matters.
        const ACTIVE = [
          "lead",
          "intro",
          "meeting",
          "diligence",
          "verbal",
          "term-sheet",
        ];
        const { data, error } = await takeOversupabase
          .from("capital_checks")
          .select("investor_name, last_touch_at, created_at")
          .in("status", ACTIVE)
          .or(
            `last_touch_at.lt.${cutoff},and(last_touch_at.is.null,created_at.lt.${cutoff})`,
          )
          .order("last_touch_at", { ascending: true, nullsFirst: true })
          .limit(10);
        if (error || !data || data.length === 0) return null;

        const names = data.map((r: any) => r.investor_name as string);
        const signature = names.join("|");

        const prev = load();
        if (prev && prev.signature === signature) {
          if (Date.now() - prev.firedAt < COOLDOWN_MS) return null;
        }
        save({ firedAt: Date.now(), signature });

        const top = names.slice(0, 3).join(", ");
        const more = names.length > 3 ? ` (+${names.length - 3} more)` : "";
        return names.length === 1
          ? `${top} hasn't heard from you in over ${STALE_DAYS} days. Worth a touch.`
          : `${names.length} investors are stale: ${top}${more}.`;
      };
    })(),
  },

  // ─── round-behind ────────────────────────────────────────────────
  //
  // Fires when a round is within 14 days of its target_close_date but
  // committed amount is under 60% of target. Once per round per
  // session.
  {
    id: "round-behind",
    label: "Round behind plan",
    description:
      "Alerts when a fundraising round is close to its target_close_date but under-committed.",
    intervalMs: 60 * 60 * 1000,
    check: (() => {
      const firedFor = new Set<string>();
      return async (_ctx) => {
        const WARNING_DAYS = 14;
        const MIN_PROGRESS = 0.6;

        const { data: rounds, error } = await takeOversupabase
          .from("capital_rounds")
          .select("id, name, status, target_amount, target_close_date")
          .in("status", ["planning", "raising"])
          .not("target_close_date", "is", null);
        if (error || !rounds || rounds.length === 0) return null;

        for (const r of rounds as any[]) {
          if (firedFor.has(r.id)) continue;
          const target = Number(r.target_amount) || 0;
          if (target <= 0) continue;
          const daysToClose = Math.ceil(
            (new Date(r.target_close_date).getTime() - Date.now()) /
              86_400_000,
          );
          if (daysToClose < 0 || daysToClose > WARNING_DAYS) continue;

          const { data: checks } = await takeOversupabase
            .from("capital_checks")
            .select("committed_amount")
            .eq("round_id", r.id);
          const committed = (checks ?? []).reduce(
            (s: number, c: any) => s + (Number(c.committed_amount) || 0),
            0,
          );
          const progress = committed / target;
          if (progress >= MIN_PROGRESS) continue;

          firedFor.add(r.id);
          const pct = Math.round(progress * 100);
          return `${r.name} closes in ${daysToClose} days but you're only at ${pct}% of target. Time to push hard.`;
        }
        return null;
      };
    })(),
  },
  // ─── vercel-prod-failure ─────────────────────────────────────────
  //
  // Watches Vercel deployments. Fires when a production deploy
  // transitions to ERROR. Speaks via AXON AND posts to Slack's
  // configured "default channel" if Slack is connected.
  //
  // Dedupe by deployment uid so a refresh-and-still-broken state
  // doesn't keep nagging. We persist seen uids per session (closure)
  // — fine because each session start does want to re-flag prod
  // failures that are still present.
  {
    id: "vercel-prod-failure",
    label: "Vercel production failure",
    description:
      "Watches Vercel deploys, fires when a production deploy errors. Speaks via AXON + posts to Slack if connected.",
    intervalMs: 2 * 60 * 1000,
    check: (() => {
      const announced = new Set<string>();
      return async (_ctx) => {
        try {
          const vercelConn = await fetchConnectorByKind("vercel");
          const vercelToken = (vercelConn?.credentials as any)?.token as
            | string
            | undefined;
          if (!vercelToken) return null;

          // Only inspect the last hour — older failures already had
          // their chance to nag.
          const deploys = await vercelListDeployments(vercelToken, {
            limit: 30,
            state: "ERROR",
          });
          const cutoff = Date.now() - 60 * 60 * 1000;
          const prodFails = deploys.filter(
            (d) => d.target === "production" && d.created >= cutoff,
          );
          const fresh = prodFails.find((d) => !announced.has(d.uid));
          if (!fresh) return null;
          announced.add(fresh.uid);

          // Compose the headline once — same text we'll speak and
          // post to Slack so the operator + team see the same thing.
          const commit =
            (fresh.meta?.githubCommitMessage as string | undefined) ||
            "no commit message";
          const branch =
            (fresh.meta?.githubCommitRef as string | undefined) || "main";
          const inspector =
            fresh.inspectorUrl ??
            `https://vercel.com/dashboard?proj=${fresh.name}`;
          const headline = `Vercel: ${fresh.name} production build failed on ${branch} — "${commit.slice(0, 80)}". ${inspector}`;

          // Best-effort Slack post. Silent on failure so we don't
          // spam the voice channel with proxy errors — the AXON
          // voice line still fires regardless.
          try {
            const slackConn = await fetchConnectorByKind("slack");
            const slackCreds =
              (slackConn?.credentials as any) ?? {};
            const channel = slackCreds.default_channel as string | undefined;
            if (slackConn && channel) {
              await slackPostMessage({
                channel,
                text: `:rotating_light: ${headline}`,
              });
            }
          } catch {
            // ignore — voice alert still goes out below
          }

          // Voice line — tighter than the Slack post since it's spoken.
          return `${fresh.name} production build just failed on ${branch}. Investigate?`;
        } catch {
          return null;
        }
      };
    })(),
  },

  // ─── meeting-just-ended ──────────────────────────────────────────
  //
  // The FIRST behavior-aware proactive trigger -- proof that the
  // proactive channel can do more than just state-change alerts.
  // Detects when a meeting on today's calendar appears to have just
  // wrapped (within the last 5 minutes) and asks the operator if they
  // want to log a quick recap before the context fades.
  //
  // Why this matters: meeting recaps are the highest-decay
  // information in an operator's day. If Axon doesn't catch it within
  // 5-10 minutes of the meeting ending, the operator has moved on and
  // the recap turns into a vague "I think we talked about..." log a
  // day later. Proactivity here is genuinely useful, not nagging.
  //
  // Inference: cwa_meetings has no explicit duration/end_time field,
  // so we default to 60 minutes. Operators with shorter syncs will get
  // a false-positive prompt 30 min after a 30-min meeting ended; the
  // urgency is "low" so it's gentle, and the dedupe means we don't
  // double-tap. Adding an actual duration column to cwa_meetings is
  // the proper long-term fix -- we'll catch it in the next schema
  // migration.
  //
  // Dedupe: localStorage-backed (not just in-memory) so a mid-meeting
  // app reload doesn't re-prompt after the meeting ends. Keyed on
  // meeting id, expires after 24h via a freshness check.
  {
    id: "meeting-just-ended",
    label: "Meeting recap prompt",
    description:
      "Asks if you want to log a recap right after a meeting wraps, while the context is still fresh. Once per meeting, never a re-prompt.",
    intervalMs: 2 * 60 * 1000,
    check: (() => {
      const STORE_KEY = "axon:monitor:meeting-just-ended:v1";
      const ASSUMED_DURATION_MS = 60 * 60 * 1000;
      const PROMPT_WINDOW_MS = 5 * 60 * 1000;

      type Persisted = Record<string, number>; // meetingId -> firedAt
      const load = (): Persisted => {
        try {
          const raw = localStorage.getItem(STORE_KEY);
          if (!raw) return {};
          const parsed = JSON.parse(raw) as Persisted;
          // Age out entries older than 24h so the store doesn't grow.
          const cutoff = Date.now() - 24 * 60 * 60 * 1000;
          const kept: Persisted = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (v >= cutoff) kept[k] = v;
          }
          return kept;
        } catch {
          return {};
        }
      };
      const save = (p: Persisted) => {
        try {
          localStorage.setItem(STORE_KEY, JSON.stringify(p));
        } catch {
          /* ignore */
        }
      };

      // Same free-text time parser as elsewhere -- handles 14:00,
      // 9:30, 2:30 pm, 9 am, 9:00am.
      const parseMeetingTime = (
        dateStr: string,
        timeStr: string | undefined,
      ): Date | null => {
        if (!timeStr) return null;
        const cleaned = timeStr.trim().toLowerCase();
        let m = cleaned.match(/^(\d{1,2}):(\d{2})\s*$/);
        if (m) {
          const h = parseInt(m[1], 10);
          const mm = parseInt(m[2], 10);
          const d = new Date(dateStr);
          d.setHours(h, mm, 0, 0);
          return isNaN(d.getTime()) ? null : d;
        }
        m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
        if (m) {
          let h = parseInt(m[1], 10);
          const mm = m[2] ? parseInt(m[2], 10) : 0;
          if (m[3].toLowerCase() === "pm" && h < 12) h += 12;
          if (m[3].toLowerCase() === "am" && h === 12) h = 0;
          const d = new Date(dateStr);
          d.setHours(h, mm, 0, 0);
          return isNaN(d.getTime()) ? null : d;
        }
        return null;
      };

      return async (ctx) => {
        const todayIso = new Date().toISOString().slice(0, 10);
        let q = takeOversupabase
          .from("cwa_meetings")
          .select("id, meeting_title, time, date")
          .eq("date", todayIso)
          .limit(20);
        if (ctx.activeCompany !== "all")
          q = q.eq("company", companyLabel(ctx.activeCompany));
        const { data, error } = await q;
        if (error || !data || data.length === 0) return null;

        const now = Date.now();
        const fired = load();

        for (const m of data as any[]) {
          const id = String(m.id);
          if (fired[id]) continue;
          const start = parseMeetingTime(m.date, m.time);
          if (!start) continue;
          const estimatedEnd = start.getTime() + ASSUMED_DURATION_MS;
          const sinceEnd = now - estimatedEnd;
          // Within the 5-minute post-meeting window: 0 < sinceEnd < 5min.
          if (sinceEnd <= 0 || sinceEnd > PROMPT_WINDOW_MS) continue;

          // Mark fired BEFORE returning so a slow speak path can't
          // double-trigger before the next poll updates state.
          fired[id] = now;
          save(fired);

          const title = (m.meeting_title as string) || "that meeting";
          return `Looks like ${title} just wrapped -- want me to log a quick recap while it's fresh?`;
        }
        return null;
      };
    })(),
  },

  // ─── meetings-soon ───────────────────────────────────────────────
  //
  // Fires when a meeting on today's calendar is about to start (within
  // a 10-minute window). Different from a calendar app's pop-up
  // notification in two ways:
  //   1. It speaks. Operator might be heads-down in another tab and
  //      miss a visual ping.
  //   2. It's once-per-meeting. The classic 5-min + 1-min "are you
  //      coming?" double-tap is exactly what we DON'T do.
  //
  // Dedupe is closure-scoped (Set keyed on meeting id) so reloading
  // the app resets it -- intentional. If you reload right before a
  // meeting and the announce hasn't fired yet, you want to hear it.
  //
  // The 10-minute window is wider than the typical 5-min calendar
  // ping so a slow-poll (60s) doesn't miss the alert when the meeting
  // sneaks up between checks.
  {
    id: "meetings-soon",
    label: "Meetings starting soon",
    description:
      "Fires once when a meeting is 10 minutes (or less) away. Voice-only — no double-tap, no nagging.",
    intervalMs: 60 * 1000,
    check: (() => {
      const announced = new Set<string>();
      // Parse the wide variety of free-text time formats that have
      // leaked into cwa_meetings.time over the months. Returns null
      // when the format isn't recognized -- we'd rather stay silent
      // than fire on a phantom 12:00 we guessed wrong about.
      const parseMeetingTime = (
        dateStr: string,
        timeStr: string | undefined,
      ): Date | null => {
        if (!timeStr) return null;
        const cleaned = timeStr.trim().toLowerCase();
        // "14:00", "9:30"
        let m = cleaned.match(/^(\d{1,2}):(\d{2})\s*$/);
        if (m) {
          const h = parseInt(m[1], 10);
          const mm = parseInt(m[2], 10);
          const d = new Date(dateStr);
          d.setHours(h, mm, 0, 0);
          return isNaN(d.getTime()) ? null : d;
        }
        // "2:30 pm", "9 am", "9:00am"
        m = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
        if (m) {
          let h = parseInt(m[1], 10);
          const mm = m[2] ? parseInt(m[2], 10) : 0;
          if (m[3].toLowerCase() === "pm" && h < 12) h += 12;
          if (m[3].toLowerCase() === "am" && h === 12) h = 0;
          const d = new Date(dateStr);
          d.setHours(h, mm, 0, 0);
          return isNaN(d.getTime()) ? null : d;
        }
        return null;
      };

      return async (ctx) => {
        const today = new Date();
        const todayIso = today.toISOString().slice(0, 10);

        let q = takeOversupabase
          .from("cwa_meetings")
          .select("id, meeting_title, time, date, location, meeting_type")
          .eq("date", todayIso)
          .limit(20);
        if (ctx.activeCompany !== "all")
          q = q.eq("company", companyLabel(ctx.activeCompany));
        const { data, error } = await q;
        if (error || !data || data.length === 0) return null;

        const now = Date.now();
        const WINDOW_MS = 10 * 60 * 1000;

        for (const m of data as any[]) {
          const id = String(m.id);
          if (announced.has(id)) continue;
          const start = parseMeetingTime(m.date, m.time);
          if (!start) continue;
          const delta = start.getTime() - now;
          // Within the 10-minute warning window AND not already
          // started (we don't surface "this started 3 minutes ago" --
          // by then the operator either joined or they're not joining).
          if (delta <= 0 || delta > WINDOW_MS) continue;
          announced.add(id);
          const minutes = Math.max(1, Math.round(delta / 60000));
          const title = (m.meeting_title as string) || "meeting";
          // Light location hint when it's clearly online/in-person.
          const where =
            m.meeting_type === "Online" || /zoom|meet|teams/i.test(m.location || "")
              ? " online"
              : m.location
                ? ` at ${m.location}`
                : "";
          return `${title} starts in ${minutes} minute${minutes === 1 ? "" : "s"}${where}.`;
        }
        return null;
      };
    })(),
  },
];

export function getMonitor(id: string): Monitor | undefined {
  return MONITORS.find((m) => m.id === id);
}
