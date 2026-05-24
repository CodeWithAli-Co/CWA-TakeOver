// ───────────────────────────────────────────────────────────────────
// Onboarding actions — what happens AFTER a candidate accepts the offer.
//
// Chain (manual or via start_full_onboarding):
//   1. update_candidate_status(hired)         already exists in recruiting.ts
//   2. generate_onboarding_plan               Claude → 30/60/90 plan jsonb
//   3. send_welcome_message                   posts in cwa_chat from the
//                                             recruiter to the team
//   4. schedule_onboarding_session            creates a candidate_meetings
//                                             row + Calendly URL
//   5. start_full_onboarding                  composite of 1-4 for one
//                                             "Hey Axon, onboard Sarah"
//                                             voice command
//
// + read-side:
//   list_upcoming_hiring_meetings              feeds the /schedule widget
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";
import { anthropicFetch } from "../engine/anthropicFetch";

const CALENDLY_BASE_URL = "https://calendly.com/codewithali/takeover-demo";

// ── Types (kept narrow; full schema mirrored in recruiting.ts) ────

interface CandidateLite {
  id: string;
  full_name: string;
  email: string;
  role_slug: string;
  job_posting_id: string | null;
  current_title: string | null;
  current_company: string | null;
  years_experience: number | null;
  parsed_resume: unknown;
  axon_assessment: unknown;
  status: string;
  onboarding_plan: OnboardingPlan | null;
  welcome_sent_at: string | null;
  onboarding_started_at: string | null;
}

interface JobPostingLite {
  id: string;
  slug: string;
  title: string;
  team: string;
  summary: string;
  responsibilities: string[];
  qualifications: string[];
}

export interface OnboardingPlan {
  summary: string;
  first_30_days: PlanItem[];
  first_60_days: PlanItem[];
  first_90_days: PlanItem[];
  key_metrics: string[];
  generated_for_role: string;
}

interface PlanItem {
  title: string;
  owner: "new_hire" | "manager" | "team";
  due_offset_days: number;
  detail: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function parseClaudeJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in Claude response");
  }
  return JSON.parse(body.slice(start, end + 1)) as T;
}

const ONBOARDING_PLAN_SYSTEM = [
  "You are AXON's onboarding planner. Given a newly-hired candidate's role + their parsed resume + Axon's prior assessment of them, generate a personalized 30/60/90-day plan.",
  "",
  "RULES:",
  "- Output VALID JSON only — no prose, no markdown, no fences.",
  "- Personalize: pull from the candidate's actual background. If they came from Stripe, day-one might be 'meet the Stripe-ex team members and compare payments architecture notes.' If they're junior, ramp differently than a senior. If Axon's assessment flagged a concern, address it in the plan.",
  "- Each item has title, owner ('new_hire' | 'manager' | 'team'), due_offset_days (integer days from start), detail (1-2 sentences).",
  "- 30-day section = onboarding + first ship. 60-day = first project owned. 90-day = first measurable impact.",
  "- Aim for 4-6 items per section. Quality > quantity.",
  "",
  "OUTPUT shape (must match exactly):",
  "{",
  '  "summary": "<1-2 sentence overview of the plan tone>",',
  '  "first_30_days":  [{ "title", "owner", "due_offset_days", "detail" }],',
  '  "first_60_days":  [{ "title", "owner", "due_offset_days", "detail" }],',
  '  "first_90_days":  [{ "title", "owner", "due_offset_days", "detail" }],',
  '  "key_metrics":    ["<3-5 short success metrics for the role>"],',
  '  "generated_for_role": "<role slug>"',
  "}",
].join("\n");

const WELCOME_MESSAGE_SYSTEM = [
  "You are AXON drafting a friendly, brief team welcome message announcing a new hire in the team chat.",
  "Output ONE short paragraph (3-4 sentences max). No greeting boilerplate, no markdown headers.",
  "Tone: warm but professional. Mention their name, role, where they're coming from if interesting, and one concrete reason they're a strong fit (pulled from Axon's assessment if available). End with a one-line nudge for the team to welcome them.",
  "Do NOT make up facts. If you don't know, omit. No emojis unless the input includes them.",
].join("\n");

// ── 1. generate_onboarding_plan ────────────────────────────────────

export const generateOnboardingPlanAction: AxonAction<
  { candidate_id: string; force?: boolean },
  { plan: OnboardingPlan }
> = {
  name: "generate_onboarding_plan",
  description:
    "Generate a personalized 30/60/90-day plan for a hired candidate using Claude. Pulls from their parsed resume + the role spec + Axon's earlier assessment. Saves to candidates.onboarding_plan. Use after a candidate is marked 'hired' (or pass force=true to regenerate).",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string" },
      force: { type: "boolean", description: "Regenerate even if a plan already exists." },
    },
    required: ["candidate_id"],
  },
  mutating: true,
  handler: async ({ candidate_id, force }, ctx) => {
    if (!ANTHROPIC_API_KEY) return { summary: "No Anthropic API key configured." };

    const { data: c, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidate_id)
      .maybeSingle();
    if (error) return { summary: `Lookup failed: ${error.message}` };
    if (!c) return { summary: `No candidate with id ${candidate_id}.` };

    const cand = c as CandidateLite;
    if (cand.onboarding_plan && !force) {
      return {
        summary: `${cand.full_name} already has a plan. Pass force=true to regenerate.`,
        data: { plan: cand.onboarding_plan },
      };
    }

    // Pull the role.
    let posting: JobPostingLite | null = null;
    if (cand.job_posting_id) {
      const { data } = await supabase
        .from("job_postings")
        .select("id, slug, title, team, summary, responsibilities, qualifications")
        .eq("id", cand.job_posting_id)
        .maybeSingle();
      posting = (data ?? null) as JobPostingLite | null;
    }
    if (!posting && cand.role_slug) {
      const { data } = await supabase
        .from("job_postings")
        .select("id, slug, title, team, summary, responsibilities, qualifications")
        .eq("slug", cand.role_slug)
        .maybeSingle();
      posting = (data ?? null) as JobPostingLite | null;
    }

    const userPayload = {
      candidate: {
        name: cand.full_name,
        current_title: cand.current_title,
        current_company: cand.current_company,
        years_experience: cand.years_experience,
        parsed_resume: cand.parsed_resume,
        axon_assessment: cand.axon_assessment,
      },
      role: posting
        ? {
            slug: posting.slug,
            title: posting.title,
            team: posting.team,
            summary: posting.summary,
            responsibilities: posting.responsibilities,
            qualifications: posting.qualifications,
          }
        : { slug: cand.role_slug, title: cand.role_slug, team: "", summary: "", responsibilities: [], qualifications: [] },
    };

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 2400,
      system: ONBOARDING_PLAN_SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(userPayload, null, 2) }],
    };

    const res = await anthropicFetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { summary: `Claude returned ${res.status}: ${t.slice(0, 200)}` };
    }
    const json = await res.json();
    const text = ((json?.content ?? []) as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === "text")
      .map((b) => String(b.text ?? ""))
      .join("\n");

    let plan: OnboardingPlan;
    try {
      plan = parseClaudeJson<OnboardingPlan>(text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { summary: `Could not parse Claude's plan: ${msg}` };
    }

    const { error: updErr } = await supabase
      .from("candidates")
      .update({
        onboarding_plan: plan,
        onboarding_plan_at: new Date().toISOString(),
      })
      .eq("id", candidate_id);
    if (updErr) return { summary: `Plan generated but failed to save: ${updErr.message}` };

    const summary = `Generated 30/60/90 plan for ${cand.full_name}. ${plan.summary ?? ""}`.trim();
    ctx.logActivity({
      actionName: "generate_onboarding_plan",
      params: { candidate_id, force },
      summary,
    });
    return { summary, data: { plan } };
  },
};

// ── 2. send_welcome_message ────────────────────────────────────────

export const sendWelcomeMessageAction: AxonAction<
  { candidate_id: string; channel?: string; confirm?: boolean },
  { message_id?: number; needs_confirmation?: boolean; concerns?: string[]; verdict_tier?: string; fit_score?: number }
> = {
  name: "send_welcome_message",
  description:
    "Post a warm welcome message to the team chat announcing a new hire. Axon drafts the message from the candidate's resume + assessment. SAFETY GATE: if Axon's verdict was OK / WEAK / MISMATCH, this action refuses the first call and returns the concerns so the operator can review. Pass confirm=true on the second call to post anyway. Default channel: 'General'.",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string" },
      channel: { type: "string", description: "Chat channel name. Default 'General'." },
      confirm: {
        type: "boolean",
        description:
          "Bypass the low-verdict safety gate. Set this only after the operator has reviewed Axon's concerns and explicitly decided to send anyway.",
      },
    },
    required: ["candidate_id"],
  },
  mutating: true,
  requiresConfirmation: false,
  handler: async ({ candidate_id, channel = "General", confirm }, ctx) => {
    const { data: c, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidate_id)
      .maybeSingle();
    if (error) return { summary: `Lookup failed: ${error.message}` };
    if (!c) return { summary: `No candidate with id ${candidate_id}.` };

    const cand = c as CandidateLite & {
      verdict_tier?: string | null;
      verdict_summary?: string | null;
      fit_score?: number | null;
      axon_assessment?: { concerns?: string[] } | null;
    };
    if (cand.welcome_sent_at) {
      return { summary: `Welcome message already sent for ${cand.full_name}.` };
    }

    // ── SAFETY GATE ────────────────────────────────────────
    // Don't broadcast a celebratory welcome to the whole team for a
    // hire Axon flagged as concerning. Force the operator to look
    // at the concerns and confirm before going public.
    const concerningTiers = new Set(["OK", "WEAK", "MISMATCH"]);
    const tier = cand.verdict_tier ?? null;
    const isConcerning = tier !== null && concerningTiers.has(tier);
    if (isConcerning && !confirm) {
      const score = cand.fit_score ?? null;
      const concerns = cand.axon_assessment?.concerns ?? [];
      const summary =
        `Hold up — I rated ${cand.full_name} ${score ?? "?"}/100 (${tier}). ` +
        `Broadcasting a public welcome to #General feels off given the concerns I flagged. ` +
        `Review the concerns below; click "Send anyway" if you want me to post it regardless.`;
      ctx.logActivity({
        actionName: "send_welcome_message",
        params: { candidate_id, channel, confirm: false },
        summary,
      });
      return {
        summary,
        silent: true,
        data: {
          needs_confirmation: true,
          concerns,
          verdict_tier: tier,
          fit_score: score ?? undefined,
        },
      };
    }

    let message: string;
    if (ANTHROPIC_API_KEY) {
      const userPayload = {
        full_name: cand.full_name,
        role_slug: cand.role_slug,
        current_title: cand.current_title,
        current_company: cand.current_company,
        axon_assessment: cand.axon_assessment,
      };
      try {
        const res = await anthropicFetch(ANTHROPIC_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 350,
            system: WELCOME_MESSAGE_SYSTEM,
            messages: [{ role: "user", content: JSON.stringify(userPayload, null, 2) }],
          }),
        });
        const json = await res.json().catch(() => null);
        const text = ((json?.content ?? []) as Array<{ type: string; text?: string }>)
          .filter((b) => b.type === "text")
          .map((b) => String(b.text ?? "").trim())
          .join(" ")
          .trim();
        message = text || fallbackWelcome(cand);
      } catch {
        message = fallbackWelcome(cand);
      }
    } else {
      message = fallbackWelcome(cand);
    }

    // Prefix so it reads as an announcement.
    const fullMsg = `📢 Welcome aboard — ${cand.full_name}\n\n${message}`;

    // cwa_chat IS the General channel — no group/channel column to set.
    // sent_by is always "AXON" for welcome messages — the content is
    // drafted by Axon, even though the operator clicked the button.
    // (DMs live in cwa_dm_chat with a dm_group column. If you want this
    //  posted as a DM thread instead, switch tables + use dm_group.)
    const insertPayload: Record<string, unknown> = {
      message: fullMsg,
      sent_by: "AXON",
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("cwa_chat")
      .insert(insertPayload)
      .select("msg_id")
      .maybeSingle();

    if (insertErr) {
      return { summary: `Failed to post welcome message: ${insertErr.message}` };
    }

    const msgId = (inserted as { msg_id?: number } | null)?.msg_id ?? 0;
    await supabase
      .from("candidates")
      .update({
        welcome_sent_at: new Date().toISOString(),
        welcome_message_id: msgId || null,
      })
      .eq("id", candidate_id);

    const summary = `Posted welcome for ${cand.full_name} in General.`;
    ctx.logActivity({
      actionName: "send_welcome_message",
      params: { candidate_id, channel },
      summary,
    });
    return { summary, data: { message_id: msgId } };
  },
};

function fallbackWelcome(c: CandidateLite): string {
  const from = c.current_company ? ` (from ${c.current_company})` : "";
  return `Please join me in welcoming ${c.full_name}${from} as our new ${c.role_slug.replace(/-/g, " ")}. They start soon — give them a warm hello!`;
}

// ── 3. schedule_onboarding_session ─────────────────────────────────

export const scheduleOnboardingSessionAction: AxonAction<
  {
    candidate_id: string;
    when?: string; // ISO datetime
    kind?: "interview" | "onboarding_kickoff" | "check_in" | "training";
    duration_min?: number;
    title?: string;
    description?: string;
    attendees?: string[];
  },
  { meeting_id: string; scheduled_at: string; calendly_url: string }
> = {
  name: "schedule_onboarding_session",
  description:
    "Schedule a meeting with a candidate (interview, onboarding kickoff, check-in, or training). Writes a candidate_meetings row + returns the Calendly booking URL the candidate should use. If `when` is omitted, schedules for 'tomorrow at 10am local'.",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string" },
      when: { type: "string", description: "ISO datetime. Default: tomorrow 10am local." },
      kind: {
        type: "string",
        description: "interview | onboarding_kickoff | check_in | training",
      },
      duration_min: { type: "number", description: "Default 30." },
      title: { type: "string" },
      description: { type: "string" },
      attendees: { type: "array", items: { type: "string" } },
    },
    required: ["candidate_id"],
  },
  mutating: true,
  handler: async (
    { candidate_id, when, kind = "onboarding_kickoff", duration_min = 30, title, description, attendees },
    ctx,
  ) => {
    const { data: c, error } = await supabase
      .from("candidates")
      .select("id, full_name, email, role_slug")
      .eq("id", candidate_id)
      .maybeSingle();
    if (error) return { summary: `Lookup failed: ${error.message}` };
    if (!c) return { summary: `No candidate with id ${candidate_id}.` };

    const cand = c as { id: string; full_name: string; email: string; role_slug: string };

    let scheduledAt: Date;
    if (when) {
      const parsed = new Date(when);
      if (isNaN(parsed.getTime())) {
        return { summary: `Could not parse "${when}" as a date.` };
      }
      scheduledAt = parsed;
    } else {
      // Default: tomorrow at 10am local
      scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 1);
      scheduledAt.setHours(10, 0, 0, 0);
    }

    const defaultTitle =
      kind === "interview"
        ? `Interview · ${cand.full_name}`
        : kind === "onboarding_kickoff"
        ? `Day-One Welcome · ${cand.full_name}`
        : kind === "check_in"
        ? `Check-in · ${cand.full_name}`
        : `Training · ${cand.full_name}`;

    const calendlyUrl = `${CALENDLY_BASE_URL}?prefill_name=${encodeURIComponent(cand.full_name)}&prefill_email=${encodeURIComponent(cand.email)}`;

    const row = {
      candidate_id,
      kind,
      title: title ?? defaultTitle,
      description: description ?? null,
      scheduled_at: scheduledAt.toISOString(),
      duration_min,
      calendly_event_url: calendlyUrl,
      attendees: attendees ?? [cand.email],
      organizer_email: ctx.operator?.username ?? null,
      status: "scheduled" as const,
      source: "app" as const,
      created_by: ctx.operator?.username ?? null,
    };

    const { data: created, error: insertErr } = await supabase
      .from("candidate_meetings")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (insertErr) return { summary: `Could not schedule: ${insertErr.message}` };

    const meetingId = (created as { id?: string } | null)?.id ?? "";

    // Mirror into the candidate's quick-access fields for the
    // interview-stage convention. Onboarding kickoff doesn't need
    // this — the meeting row is the source of truth.
    if (kind === "interview") {
      await supabase
        .from("candidates")
        .update({
          scheduled_interview_at: scheduledAt.toISOString(),
          calendly_event_url: calendlyUrl,
        })
        .eq("id", candidate_id);
    }

    const summary = `Scheduled ${kind.replace(/_/g, " ")} with ${cand.full_name} for ${scheduledAt.toLocaleString()}. Calendly URL ready.`;
    ctx.logActivity({
      actionName: "schedule_onboarding_session",
      params: { candidate_id, when, kind, duration_min },
      summary,
    });

    if (meetingId) {
      ctx.pushUndo({
        actionName: "schedule_onboarding_session",
        label: `Cancel ${kind.replace(/_/g, " ")} with ${cand.full_name}`,
        descriptor: {
          kind: "meeting.cancel",
          payload: { meeting_id: meetingId, reason: "undo" },
        },
      });
    }

    return {
      summary,
      data: { meeting_id: meetingId, scheduled_at: scheduledAt.toISOString(), calendly_url: calendlyUrl },
    };
  },
};

// ── 4. start_full_onboarding (composite) ───────────────────────────

export const startFullOnboardingAction: AxonAction<
  { candidate_id: string; kickoff_when?: string },
  { plan_ok: boolean; welcome_ok: boolean; meeting_id: string | null }
> = {
  name: "start_full_onboarding",
  description:
    "One-shot: mark a candidate hired, generate their 30/60/90 plan, post a welcome message in #General, and schedule the day-one kickoff. Use for 'Hey Axon, onboard Sarah' voice commands.",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string" },
      kickoff_when: { type: "string", description: "ISO datetime for kickoff. Default tomorrow 10am." },
    },
    required: ["candidate_id"],
  },
  mutating: true,
  handler: async ({ candidate_id, kickoff_when }, ctx) => {
    // 1. Mark hired (don't fail if already hired)
    await supabase
      .from("candidates")
      .update({ status: "hired", onboarding_started_at: new Date().toISOString() })
      .eq("id", candidate_id);

    // 2. Generate plan
    let planOk = false;
    try {
      const out = await generateOnboardingPlanAction.handler({ candidate_id }, ctx);
      planOk = !!out.data?.plan;
    } catch {
      planOk = false;
    }

    // 3. Send welcome
    let welcomeOk = false;
    try {
      const out = await sendWelcomeMessageAction.handler({ candidate_id }, ctx);
      welcomeOk = !!out.data?.message_id || out.summary.startsWith("Posted");
    } catch {
      welcomeOk = false;
    }

    // 4. Schedule kickoff
    let meetingId: string | null = null;
    try {
      const out = await scheduleOnboardingSessionAction.handler(
        { candidate_id, when: kickoff_when, kind: "onboarding_kickoff", duration_min: 45 },
        ctx,
      );
      meetingId = out.data?.meeting_id ?? null;
    } catch {
      meetingId = null;
    }

    const parts: string[] = [];
    if (planOk) parts.push("plan generated");
    if (welcomeOk) parts.push("welcome posted");
    if (meetingId) parts.push("kickoff scheduled");
    const summary =
      parts.length === 3
        ? `Onboarded fully: ${parts.join(", ")}.`
        : parts.length === 0
        ? "Onboarding kicked off but every sub-step failed — check the action log."
        : `Onboarded partially: ${parts.join(", ")}. Other steps failed (see log).`;

    ctx.logActivity({
      actionName: "start_full_onboarding",
      params: { candidate_id, kickoff_when },
      summary,
    });
    return {
      summary,
      data: { plan_ok: planOk, welcome_ok: welcomeOk, meeting_id: meetingId },
    };
  },
};

// ── 5. list_upcoming_hiring_meetings ───────────────────────────────

export const listUpcomingHiringMeetingsAction: AxonAction<
  { within_days?: number; kinds?: string[]; candidate_id?: string },
  { count: number; rows: unknown[] }
> = {
  name: "list_upcoming_hiring_meetings",
  description:
    "List scheduled candidate meetings (interviews + onboarding sessions + check-ins) within the next N days. Feeds the upcoming-meetings widget on the schedule page and quick-glance views.",
  input_schema: {
    type: "object",
    properties: {
      within_days: { type: "number", description: "Default 14." },
      kinds: { type: "array", items: { type: "string" } },
      candidate_id: { type: "string" },
    },
  },
  handler: async ({ within_days = 14, kinds, candidate_id }, ctx) => {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + within_days);

    let q = supabase
      .from("candidate_meetings")
      .select("id, candidate_id, kind, title, scheduled_at, duration_min, status, calendly_event_url, attendees, candidates ( full_name, role_slug, email )")
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", horizon.toISOString())
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true });

    if (kinds && kinds.length > 0) q = q.in("kind", kinds);
    if (candidate_id) q = q.eq("candidate_id", candidate_id);

    const { data, error } = await q;
    if (error) return { summary: `Query failed: ${error.message}` };

    const rows = data ?? [];
    const summary =
      rows.length === 0
        ? `No hiring meetings in the next ${within_days} days.`
        : `${rows.length} meeting${rows.length === 1 ? "" : "s"} in the next ${within_days} days.`;
    ctx.logActivity({
      actionName: "list_upcoming_hiring_meetings",
      params: { within_days, kinds, candidate_id },
      summary,
    });
    return { summary, data: { count: rows.length, rows } };
  },
};

// ── Registration ───────────────────────────────────────────────────

export function registerOnboardingActions(): void {
  registerAction(generateOnboardingPlanAction);
  registerAction(sendWelcomeMessageAction);
  registerAction(scheduleOnboardingSessionAction);
  registerAction(startFullOnboardingAction);
  registerAction(listUpcomingHiringMeetingsAction);
}
