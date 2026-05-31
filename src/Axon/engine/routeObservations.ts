// ───────────────────────────────────────────────────────────────────
// Route observations.
// When the operator navigates, AXON can emit ONE short contextual
// line. Preset observations per route keep this instant and offline;
// unknown routes get no observation (we don't want to burn an API
// call on every navigation).
// ───────────────────────────────────────────────────────────────────

import { takeOversupabase } from "@/MyComponents/supabase";
import type { CompanyFilter } from "@/stores/store";

function companyLabel(active: string): "CodeWithAli" | "simplicity" {
  return active === "simplicityFunds" ? "simplicity" : "CodeWithAli";
}

async function overdueCount(active: CompanyFilter): Promise<number> {
  const now = new Date().toISOString();
  let q = takeOversupabase
    .from("cwa_todos")
    .select("todo_id", { count: "exact", head: true })
    .neq("status", "done")
    .lt("deadline", now)
    .gt("deadline", "");
  if (active !== "all") q = q.eq("company", companyLabel(active));
  const { count } = await q;
  return count ?? 0;
}

async function upcomingMeetingCount(active: CompanyFilter): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  let q = takeOversupabase
    .from("cwa_meetings")
    .select("id", { count: "exact", head: true })
    .gte("date", today)
    .lte("date", in7.toISOString().slice(0, 10));
  if (active !== "all") q = q.eq("company", companyLabel(active));
  const { count } = await q;
  return count ?? 0;
}

/** Returns a short observation line, or null when there's nothing useful to say. */
export async function observeRoute(
  path: string,
  active: CompanyFilter
): Promise<string | null> {
  // Normalize
  const p = path.replace(/\/+$/, "") || "/";

  // Tasks page — call out overdue if any.
  if (p === "/task") {
    const n = await overdueCount(active).catch(() => 0);
    if (n > 0) return `${n} overdue task${n === 1 ? "" : "s"} here.`;
    return "Tasks list — nothing overdue.";
  }

  // Schedule / meetings.
  if (p === "/schedule") {
    const n = await upcomingMeetingCount(active).catch(() => 0);
    if (n > 0) return `${n} meeting${n === 1 ? "" : "s"} in the next week.`;
    return "Nothing on the calendar this week.";
  }

  // Finance.
  if (p === "/financialDashboard") {
    return "Finance dashboard open. Ask me for the biggest line items.";
  }

  // Employees.
  if (p === "/employee") {
    return "Employee roster up.";
  }

  // Invoicer.
  if (p === "/invoicer") {
    return "Invoicer — say the word to draft one.";
  }

  // Broadcast.
  if (p === "/broadcast" || p === "/s-broadcast") {
    return "Broadcast stage. Drafts stay unsent until you confirm.";
  }

  // Simplicity screens.
  if (p === "/s-users") return "Simplicity users.";
  if (p === "/s-analytics") return "Simplicity analytics.";
  if (p === "/s-finance-ops") return "Simplicity finance ops.";
  if (p === "/s-dev-console") return "Simplicity dev console — careful in here.";

  // Home / index.
  if (p === "/") {
    const n = await overdueCount(active).catch(() => 0);
    if (n > 0) return `Home. ${n} overdue task${n === 1 ? "" : "s"} waiting.`;
    return null; // nothing notable → stay quiet
  }

  // Settings / chat / others — don't narrate.
  return null;
}
