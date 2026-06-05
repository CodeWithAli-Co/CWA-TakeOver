// ───────────────────────────────────────────────────────────────────
// CRM actions for Axon — voice/text control over the sales surface.
//
// The operator can say things like:
//
//   "Axon, what's in my pipeline?"
//   "Axon, summarize the pipeline."
//   "Axon, find the contact for Acme."
//   "Axon, create a deal — Acme renewal, fifty thousand, proposal stage."
//   "Axon, move the Acme deal to negotiation."
//   "Axon, log a call with Jordan at Acme — they're interested but want
//    pricing on the enterprise tier."
//
// All actions read/write the same crm_contacts / crm_deals /
// crm_activities tables the UI uses. Mutating actions push descriptor-
// style undo entries so "Axon, undo that" survives a reload.
//
// Why a separate file from the existing `data.ts` / `briefing.ts`:
// CRM is its own domain (sales pipeline + activity timeline). Keeping
// it isolated lets the actions surface in Settings → Capabilities
// under a coherent "Sales" group.
// ───────────────────────────────────────────────────────────────────

import { takeOversupabase } from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { registerUndoHandler } from "../engine/undoStack";
import {
  DEAL_STAGES,
  DEAL_OPEN_STAGES,
  ACTIVITY_TYPES,
  weightedForecastCents,
  bookedRevenueCents,
  formatCrmAmount,
  type DealStage,
  type ActivityType,
} from "@/stores/crm";

const CONTACTS = "crm_contacts";
const DEALS = "crm_deals";
const ACTIVITIES = "crm_activities";

// ── Undo handlers — registered once at module load ──────────────

registerUndoHandler<{ dealId: string; name: string }>(
  "crm.delete-deal",
  async ({ dealId, name }) => {
    const { error } = await takeOversupabase.from(DEALS).delete().eq("id", dealId);
    if (error) throw new Error(error.message);
    return `Reverted — deleted deal "${name}".`;
  },
);

registerUndoHandler<{
  dealId: string;
  name: string;
  previousStage: DealStage;
  previousPosition: number;
}>("crm.restore-stage", async ({ dealId, name, previousStage, previousPosition }) => {
  const { error } = await takeOversupabase
    .from(DEALS)
    .update({ stage: previousStage, position: previousPosition })
    .eq("id", dealId);
  if (error) throw new Error(error.message);
  return `Moved "${name}" back to ${previousStage}.`;
});

registerUndoHandler<{ activityId: string; title: string }>(
  "crm.delete-activity",
  async ({ activityId, title }) => {
    const { error } = await takeOversupabase
      .from(ACTIVITIES)
      .delete()
      .eq("id", activityId);
    if (error) throw new Error(error.message);
    return `Reverted — deleted activity "${title}".`;
  },
);

// ── Helpers ─────────────────────────────────────────────────────

/** Parse a free-text amount like "$50k", "50000", "twelve thousand" into
 *  cents. Defensive — returns null on anything weird so the caller can
 *  reject the action rather than persist garbage. */
function parseAmountCents(raw: string | number | undefined | null): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? Math.round(raw * 100) : null;
  }
  const cleaned = raw.trim().toLowerCase().replace(/[\s,$]/g, "");
  if (!cleaned) return null;
  // Handle "50k", "1.2m", etc.
  const suffixMatch = cleaned.match(/^([\d.]+)([km])?$/);
  if (suffixMatch) {
    const n = Number(suffixMatch[1]);
    if (!Number.isFinite(n)) return null;
    const mult = suffixMatch[2] === "m" ? 1_000_000 : suffixMatch[2] === "k" ? 1_000 : 1;
    return Math.round(n * mult * 100);
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Loose stage match — accepts "proposal" / "proposals" / "proposing"
 *  by prefix-checking the canonical set. */
function resolveStage(raw: string | undefined): DealStage | null {
  if (!raw) return null;
  const q = raw.toLowerCase().trim().replace(/\s+/g, "");
  for (const s of DEAL_STAGES) {
    if (q === s || q.startsWith(s) || s.startsWith(q)) return s;
  }
  // A few common synonyms.
  if (q.startsWith("close") || q === "closedwon") return "won";
  if (q.startsWith("dead") || q === "closedlost") return "lost";
  if (q.startsWith("eval") || q.startsWith("trial")) return "demo";
  return null;
}

function resolveActivityType(raw: string | undefined): ActivityType | null {
  if (!raw) return null;
  const q = raw.toLowerCase().trim();
  for (const t of ACTIVITY_TYPES) {
    if (q === t || q.startsWith(t)) return t;
  }
  if (q === "phone")    return "call";
  if (q === "text")     return "sms";
  if (q === "sync")     return "meeting";
  return null;
}

/** Find one deal by free-text name. Uses ilike + length-asc so a
 *  query for "Acme" matches "Acme renewal" rather than the longest
 *  unrelated row containing the letters. */
async function findDealByName(name: string): Promise<{ id: string; name: string; stage: DealStage; position: number; amount_cents: number; currency: string } | null> {
  const { data, error } = await takeOversupabase
    .from(DEALS)
    .select("id, name, stage, position, amount_cents, currency")
    .ilike("name", `%${name}%`)
    .limit(5);
  if (error || !data || data.length === 0) return null;
  // Exact match wins, then shortest name (likely the most specific).
  const lower = name.toLowerCase();
  const exact = data.find((d: any) => d.name.toLowerCase() === lower);
  if (exact) return exact as any;
  const sorted = [...data].sort((a: any, b: any) => a.name.length - b.name.length);
  return sorted[0] as any;
}

async function findContactByQuery(q: string): Promise<{ id: string; name: string | null; email: string | null; lifecycle_stage: string; company_id: string | null } | null> {
  const { data, error } = await takeOversupabase
    .from(CONTACTS)
    .select("id, name, email, lifecycle_stage, company_id")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
    .limit(5);
  if (error || !data || data.length === 0) return null;
  const lower = q.toLowerCase();
  const exact = data.find(
    (c: any) =>
      (c.email ?? "").toLowerCase() === lower ||
      (c.name  ?? "").toLowerCase() === lower,
  );
  return (exact ?? data[0]) as any;
}

// ============================================================
// list_deals — pipeline snapshot
// ============================================================
export const listDealsAction: AxonAction<
  { stage?: string; owner?: "me" | "all"; limit?: number },
  { count: number; deals: Array<{ id: string; name: string; stage: DealStage; amount: string }> }
> = {
  name: "list_deals",
  description:
    "List CRM deals in the pipeline. Optionally filter by stage (interested / demo / proposal / negotiation / won / lost) or owner (me/all). Default: open stages only.",
  input_schema: {
    type: "object",
    properties: {
      stage: { type: "string", description: "Optional pipeline stage filter." },
      owner: { type: "string", enum: ["me", "all"], description: "Restrict to the operator's deals." },
      limit: { type: "number", description: "Max rows to return (default 10, max 50)." },
    },
  },
  handler: async (input, ctx) => {
    const limit = Math.max(1, Math.min(50, input.limit ?? 10));
    const stage = resolveStage(input.stage);

    let q = takeOversupabase
      .from(DEALS)
      .select("id, name, stage, amount_cents, currency, owner_supa_id, company_id, contact_id")
      .order("position", { ascending: true })
      .limit(limit);
    if (stage) {
      q = q.eq("stage", stage);
    } else {
      q = q.in("stage", DEAL_OPEN_STAGES as readonly string[]);
    }
    if (input.owner === "me" && (ctx.operator as any)?.supaId) {
      q = q.eq("owner_supa_id", (ctx.operator as any).supaId);
    }

    const { data, error } = await q;
    if (error) return { summary: `Couldn't list deals: ${error.message}` };

    const rows = (data ?? []) as any[];
    if (rows.length === 0) {
      return {
        summary: stage
          ? `No deals in the ${stage} stage.`
          : "No open deals in the pipeline.",
        data: { count: 0, deals: [] },
      };
    }

    const summary = rows.length === 1
      ? `One deal${stage ? ` in ${stage}` : ""}: ${rows[0].name}.`
      : `${rows.length} deal${rows.length === 1 ? "" : "s"}${stage ? ` in ${stage}` : ""}.`;

    return {
      summary,
      data: {
        count: rows.length,
        deals: rows.map((d) => ({
          id: d.id,
          name: d.name,
          stage: d.stage,
          amount: formatCrmAmount(d.amount_cents, d.currency, { compact: true }),
        })),
      },
    };
  },
};

// ============================================================
// create_deal
// ============================================================
export const createDealAction: AxonAction<
  {
    name: string;
    amount?: string | number;
    stage?: string;
    company?: string;
    contact?: string;
    close_date?: string;
    source?: string;
    probability?: number;
  },
  { deal_id: string }
> = {
  name: "create_deal",
  description:
    "Create a new CRM deal. Amount accepts shorthand like '50k' or '$1.2M'. Stage defaults to 'interested'. Optionally attach to a company or primary contact by free-text name.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Deal name, e.g. 'Acme renewal'." },
      amount: { type: "string", description: "Deal amount — accepts $50,000, 50k, 1.2M, etc." },
      stage: { type: "string", enum: [...DEAL_STAGES] },
      company: { type: "string", description: "Company name to attach. Fuzzy-matched." },
      contact: { type: "string", description: "Primary contact — name or email." },
      close_date: { type: "string", description: "Expected close date — ISO or natural phrase." },
      source: { type: "string", description: "Lead source, e.g. 'inbound', 'referral', 'outbound'." },
      probability: { type: "number", description: "Win probability 0-100." },
    },
    required: ["name"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const stage = resolveStage(input.stage) ?? "interested";
    const amountCents = parseAmountCents(input.amount);

    // Best-effort lookups for company + contact.
    let companyId: string | null = null;
    if (input.company) {
      const { data } = await takeOversupabase
        .from("crm_companies")
        .select("id, name")
        .ilike("name", `%${input.company}%`)
        .limit(1);
      companyId = (data?.[0] as any)?.id ?? null;
    }
    let contactId: string | null = null;
    if (input.contact) {
      const c = await findContactByQuery(input.contact);
      contactId = c?.id ?? null;
      if (c?.company_id && !companyId) companyId = c.company_id;
    }

    const closeDate = (() => {
      if (!input.close_date) return null;
      const d = new Date(input.close_date);
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    })();

    if (ctx.dryRun) {
      const amountStr = amountCents != null ? formatCrmAmount(amountCents, "usd") : "—";
      return {
        summary: `[dry-run] Would create deal "${input.name}" (${stage}, ${amountStr}).`,
        data: { deal_id: "" },
      };
    }

    const { data, error } = await takeOversupabase
      .from(DEALS)
      .insert({
        name: input.name,
        amount_cents: amountCents ?? 0,
        currency: "usd",
        stage,
        position: Date.now(),  // Push to bottom of column.
        company_id: companyId,
        contact_id: contactId,
        source: input.source ?? null,
        close_date_expected: closeDate,
        probability: input.probability ?? null,
        owner_supa_id: (ctx.operator as any)?.supaId ?? null,
      })
      .select("id, name")
      .single();
    if (error) return { summary: `Couldn't create deal: ${error.message}` };

    ctx.pushUndo({
      actionName: "create_deal",
      label: `create of deal "${input.name}"`,
      descriptor: {
        kind: "crm.delete-deal",
        payload: { dealId: data.id, name: data.name },
      },
    });

    const amountStr = amountCents != null ? formatCrmAmount(amountCents, "usd") : "no amount";
    return {
      summary: `Created deal "${data.name}" — ${stage}, ${amountStr}.`,
      data: { deal_id: data.id },
    };
  },
};

// ============================================================
// move_deal — move a deal to a different stage
// ============================================================
export const moveDealAction: AxonAction<
  { name: string; stage: string },
  { deal_id: string; from: DealStage; to: DealStage }
> = {
  name: "move_deal",
  description:
    "Move a deal to a different pipeline stage. Looks the deal up by free-text name match.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Deal name — fuzzy-matched against the pipeline." },
      stage: { type: "string", description: "Target stage." },
    },
    required: ["name", "stage"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const targetStage = resolveStage(input.stage);
    if (!targetStage) {
      return { summary: `"${input.stage}" isn't a valid stage. Try: ${DEAL_STAGES.join(", ")}.` };
    }
    const deal = await findDealByName(input.name);
    if (!deal) {
      return { summary: `No deal matched "${input.name}".` };
    }
    if (deal.stage === targetStage) {
      return { summary: `"${deal.name}" is already in ${targetStage}.` };
    }

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would move "${deal.name}" from ${deal.stage} to ${targetStage}.`,
        data: { deal_id: deal.id, from: deal.stage, to: targetStage },
      };
    }

    const { error } = await takeOversupabase
      .from(DEALS)
      .update({ stage: targetStage, position: Date.now() })
      .eq("id", deal.id);
    if (error) return { summary: `Couldn't move deal: ${error.message}` };

    ctx.pushUndo({
      actionName: "move_deal",
      label: `move of "${deal.name}" to ${targetStage}`,
      descriptor: {
        kind: "crm.restore-stage",
        payload: {
          dealId: deal.id,
          name: deal.name,
          previousStage: deal.stage,
          previousPosition: deal.position,
        },
      },
    });

    return {
      summary: `Moved "${deal.name}" → ${targetStage}.`,
      data: { deal_id: deal.id, from: deal.stage, to: targetStage },
    };
  },
};

// ============================================================
// find_contact
// ============================================================
export const findContactAction: AxonAction<
  { query: string },
  { id: string; name: string | null; email: string | null; lifecycle_stage: string } | null
> = {
  name: "find_contact",
  description:
    "Find a CRM contact by name or email. Returns the best match's name, email, lifecycle stage, and id.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Name or email to search for." },
    },
    required: ["query"],
  },
  handler: async ({ query }) => {
    const hit = await findContactByQuery(query);
    if (!hit) return { summary: `No contact matched "${query}".`, data: null };
    return {
      summary: `${hit.name ?? hit.email ?? "Untitled"} — ${hit.lifecycle_stage}.`,
      data: {
        id: hit.id,
        name: hit.name,
        email: hit.email,
        lifecycle_stage: hit.lifecycle_stage,
      },
    };
  },
};

// ============================================================
// log_crm_activity — call/email/meeting/note attached to contact, deal,
// or company. Named `log_crm_activity` (not `log_activity`) to avoid
// colliding with any future generic activity-log action.
// ============================================================
export const logCrmActivityAction: AxonAction<
  {
    type: string;
    contact?: string;     // free-text contact name/email
    deal?: string;        // free-text deal name
    company?: string;     // free-text company name
    title?: string;
    notes?: string;
    outcome?: string;
  },
  { activity_id: string }
> = {
  name: "log_crm_activity",
  description:
    "Log a sales activity (call / email / meeting / note / task / demo / sms) attached to a contact, deal, or company. At least one target must be provided.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: [...ACTIVITY_TYPES] },
      contact: { type: "string", description: "Free-text contact name or email." },
      deal:    { type: "string", description: "Free-text deal name." },
      company: { type: "string", description: "Free-text company name." },
      title:   { type: "string", description: "Short headline, e.g. 'Discovery call'." },
      notes:   { type: "string", description: "Longer body — markdown is fine." },
      outcome: { type: "string", description: "E.g. 'Connected', 'Voicemail', 'Interested'." },
    },
    required: ["type"],
  },
  mutating: true,
  handler: async (input, ctx) => {
    const type = resolveActivityType(input.type);
    if (!type) return { summary: `"${input.type}" isn't a recognized activity type.` };

    let contactId: string | null = null;
    let dealId: string | null = null;
    let companyId: string | null = null;
    if (input.contact) {
      const c = await findContactByQuery(input.contact);
      contactId = c?.id ?? null;
      if (c?.company_id) companyId = c.company_id;
    }
    if (input.deal) {
      const d = await findDealByName(input.deal);
      dealId = d?.id ?? null;
    }
    if (input.company) {
      const { data } = await takeOversupabase
        .from("crm_companies")
        .select("id")
        .ilike("name", `%${input.company}%`)
        .limit(1);
      const found = (data?.[0] as any)?.id ?? null;
      if (found) companyId = found;
    }

    if (!contactId && !dealId && !companyId) {
      return {
        summary:
          "Need a contact, deal, or company to attach the activity to. Try naming one in the request.",
      };
    }

    if (ctx.dryRun) {
      return {
        summary: `[dry-run] Would log ${type}${input.title ? `: "${input.title}"` : ""}.`,
        data: { activity_id: "" },
      };
    }

    const { data, error } = await takeOversupabase
      .from(ACTIVITIES)
      .insert({
        type,
        title:           input.title ?? null,
        body_md:         input.notes ?? null,
        outcome:         input.outcome ?? null,
        contact_id:      contactId,
        deal_id:         dealId,
        company_id:      companyId,
        actor_supa_id:   (ctx.operator as any)?.supaId ?? null,
        happened_at:     new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) return { summary: `Couldn't log activity: ${error.message}` };

    ctx.pushUndo({
      actionName: "log_crm_activity",
      label: `log of ${type}${input.title ? ` "${input.title}"` : ""}`,
      descriptor: {
        kind: "crm.delete-activity",
        payload: { activityId: data.id, title: input.title ?? type },
      },
    });

    return {
      summary: `Logged ${type}${input.title ? ` "${input.title}"` : ""}.`,
      data: { activity_id: data.id },
    };
  },
};

// ============================================================
// summarize_pipeline — quick spoken KPI snapshot
// ============================================================
export const summarizePipelineAction: AxonAction<
  Record<string, never>,
  {
    open_deals: number;
    weighted_forecast: string;
    booked_mtd: string;
    leading_stage: DealStage | null;
  }
> = {
  name: "summarize_pipeline",
  description:
    "Speak a one-sentence pipeline summary: open deal count, weighted forecast, MTD booked revenue, and which stage holds the most pipeline.",
  input_schema: { type: "object", properties: {} },
  handler: async () => {
    const { data, error } = await takeOversupabase
      .from(DEALS)
      .select("stage, amount_cents, probability, currency, close_date_actual, close_date_expected");
    if (error) return { summary: `Couldn't load deals: ${error.message}` };
    const deals = (data ?? []) as any[];

    if (deals.length === 0) {
      return {
        summary: "No deals in the pipeline yet.",
        data: {
          open_deals: 0,
          weighted_forecast: "$0",
          booked_mtd: "$0",
          leading_stage: null,
        },
      };
    }

    const open = deals.filter((d) => DEAL_OPEN_STAGES.includes(d.stage));
    const forecastCents = weightedForecastCents(deals as any);

    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const bookedCents = bookedRevenueCents(deals as any, startMonth, now);

    // Leading open stage by $ — same logic as the dashboard widget.
    let leadingStage: DealStage | null = null;
    let leadingCents = 0;
    for (const s of DEAL_OPEN_STAGES) {
      const cents = open
        .filter((d) => d.stage === s)
        .reduce((acc, d) => acc + (d.amount_cents ?? 0), 0);
      if (cents > leadingCents) {
        leadingCents = cents;
        leadingStage = s;
      }
    }

    const forecast = formatCrmAmount(forecastCents, "usd", { compact: true });
    const booked = formatCrmAmount(bookedCents, "usd", { compact: true });
    const lead = leadingStage ? `, mostly in ${leadingStage}` : "";

    return {
      summary: `${open.length} open deal${open.length === 1 ? "" : "s"}, ${forecast} weighted forecast${lead}. ${booked} booked this month.`,
      data: {
        open_deals: open.length,
        weighted_forecast: forecast,
        booked_mtd: booked,
        leading_stage: leadingStage,
      },
    };
  },
};

// ============================================================
// Registration
// ============================================================
export function registerCrmActions() {
  registerAction(listDealsAction);
  registerAction(createDealAction);
  registerAction(moveDealAction);
  registerAction(findContactAction);
  registerAction(logCrmActivityAction);
  registerAction(summarizePipelineAction);
}
