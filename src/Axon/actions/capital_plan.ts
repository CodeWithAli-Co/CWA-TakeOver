// ───────────────────────────────────────────────────────────────────
// Capital Plan actions — exposes the same advisor the Capital Plan
// AXON rail uses, but via voice. "Hey AXON, how's runway?" routes
// through the deterministic capitalAdvisor and AXON speaks back the
// headline + bullets.
//
// Read-only for now. Phase 4 keeps mutations gated behind UI clicks;
// the next pass can add safe writes (e.g. "log $50 to vercel" →
// capital_log_actual).
// ───────────────────────────────────────────────────────────────────

import { takeOversupabase } from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  generateBriefing, answerQuestion,
  type AdvisorInput,
} from "@/MyComponents/CapitalPlan/scenarios/capitalAdvisor";
import type { CapitalPlanData } from "@/MyComponents/CapitalPlan/CapitalPlan.queries";

const CASH_KEY = "cwa-capital-plan-cash-on-hand";

/** Read the full capital state from Supabase + cash from localStorage. */
async function loadAdvisorInput(): Promise<AdvisorInput> {
  const [r, c, t, a, l, ac, s] = await Promise.all([
    takeOversupabase.from("capital_rounds").select("*").order("position"),
    takeOversupabase.from("capital_checks").select("*").order("position"),
    takeOversupabase.from("capital_check_touchpoints").select("*").order("occurred_at", { ascending: false }),
    takeOversupabase.from("capital_allocations").select("*").order("position"),
    takeOversupabase.from("capital_line_items").select("*").order("position"),
    takeOversupabase.from("capital_actuals").select("*").order("occurred_on", { ascending: false }),
    takeOversupabase.from("capital_scenarios").select("*").order("created_at", { ascending: false }),
  ]);

  for (const res of [r, c, t, a, l, ac, s]) {
    if (res.error) throw new Error(res.error.message);
  }

  const plan: CapitalPlanData = {
    rounds:      (r.data ?? []) as any,
    checks:      (c.data ?? []) as any,
    touchpoints: (t.data ?? []) as any,
    allocations: (a.data ?? []) as any,
    lineItems:   (l.data ?? []) as any,
    actuals:     (ac.data ?? []) as any,
    scenarios:   (s.data ?? []) as any,
  };

  let cashOnHand = 0;
  try { cashOnHand = Number(window.localStorage.getItem(CASH_KEY)) || 0; } catch { /* ignore */ }

  return { plan, cashOnHand };
}

/** Format an AdvisorResponse for the voice / activity surface. */
function formatForSpeech(resp: ReturnType<typeof generateBriefing>): string {
  const parts: string[] = [resp.headline];
  if (resp.bullets.length > 0) {
    parts.push(resp.bullets.join(" "));
  }
  return parts.join(" ").replace(/[🟢🟠🔴🟡✓✗⚠]\s*/g, "").trim();
}

// ─── capital_briefing ─────────────────────────────────────────

export const capitalBriefingAction: AxonAction<
  Record<string, never>,
  { headline: string; tone: string; bullets: string[] }
> = {
  name: "capital_briefing",
  description: "Read the operator a situation report on Capital Plan: runway, next round progress, stale investors.",
  input_schema: { type: "object", properties: {} },
  handler: async (_input, ctx) => {
    const input = await loadAdvisorInput();
    const resp = generateBriefing(input);
    const speech = formatForSpeech(resp);
    ctx.speak(speech);
    return {
      summary: resp.headline,
      data: { headline: resp.headline, tone: resp.tone, bullets: resp.bullets },
      silent: true, // ctx.speak already handled narration
    };
  },
};

// ─── capital_advise ───────────────────────────────────────────

export const capitalAdviseAction: AxonAction<
  { question: string },
  { headline: string; tone: string; bullets: string[] }
> = {
  name: "capital_advise",
  description: "Ask the Capital Plan advisor a question (runway, hiring, delaying the raise, investor follow-ups, budget overspend, biggest risks).",
  input_schema: {
    type: "object",
    properties: {
      question: { type: "string", description: "The operator's question in their own words." },
    },
    required: ["question"],
  },
  handler: async (input, ctx) => {
    if (typeof input?.question !== "string" || !input.question.trim()) {
      throw new Error("capital_advise needs a non-empty question.");
    }
    const advisorInput = await loadAdvisorInput();
    const resp = answerQuestion(input.question, advisorInput);
    const speech = formatForSpeech(resp);
    ctx.speak(speech);
    return {
      summary: resp.headline,
      data: { headline: resp.headline, tone: resp.tone, bullets: resp.bullets },
      silent: true,
    };
  },
};

export function registerCapitalPlanActions() {
  registerAction(capitalBriefingAction);
  registerAction(capitalAdviseAction);
}
