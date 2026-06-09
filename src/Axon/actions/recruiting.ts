// ───────────────────────────────────────────────────────────────────
// Recruiting actions — the pipeline that reads candidates submitted
// via the public /apply form on takeover-B2B, parses their resumes
// through Claude Vision, scores them against the role's ideal_profile,
// and surfaces structured results to both the operator UI and Axon's
// voice / chat interface.
//
// End-to-end flow:
//   candidate applies → row in `candidates` (parse_status='pending')
//   → Axon: parse_resume → parsed_resume jsonb populated
//   → Axon: rate_candidate → fit_score + verdict + axon_assessment
//   → recruiter UI ranks by fit_score, opens detail drawer
//   → schedule_interview / make_offer / update_status from detail view
//
// Actions exported:
//   - parse_resume({ candidate_id?, all_pending? })
//   - rate_candidate({ candidate_id })
//   - rate_all_pending({ role_slug? })
//   - list_candidates({ role_slug?, status?, min_score?, limit?, offset? })
//   - candidate_detail({ candidate_id })
//   - update_candidate_status({ candidate_id, status, reason? })
// ───────────────────────────────────────────────────────────────────

import { companySupabase } from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";
import { anthropicFetch } from "../engine/anthropicFetch";
import { Buffer } from "buffer";

// ── Types mirroring the candidates_init.sql schema ────────────────

interface JobPostingRow {
  id: string;
  slug: string;
  title: string;
  team: string;
  summary: string;
  responsibilities: string[];
  qualifications: string[];
  bonus: string[] | null;
  ideal_profile: IdealProfile | null;
  status: "draft" | "open" | "paused" | "closed";
}

interface IdealProfile {
  must_have?: string[];
  nice_to_have?: string[];
  disqualifiers?: string[];
  target_years_experience?: { min?: number; max?: number };
  weight?: {
    icp_fit?: number;
    experience?: number;
    cultural_signal?: number;
    compensation_alignment?: number;
  };
}

interface CandidateRow {
  id: string;
  full_name: string;
  email: string;
  role_slug: string;
  job_posting_id: string | null;
  current_title: string | null;
  current_company: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  why_role: string | null;
  why_takeover: string | null;
  expected_compensation: string | null;
  resume_storage_path: string | null;
  resume_filename: string | null;
  resume_content_type: string | null;
  parsed_resume: ParsedResume | null;
  parse_status: "pending" | "processing" | "done" | "failed";
  parse_error: string | null;
  fit_score: number | null;
  verdict_tier: VerdictTier | null;
  verdict_summary: string | null;
  axon_assessment: AxonAssessment | null;
  status: CandidateStatus;
}

type CandidateStatus =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected"
  | "withdrawn";

type VerdictTier = "TOP" | "STRONG" | "GOOD" | "OK" | "WEAK" | "MISMATCH";

interface ParsedResume {
  summary: string;
  current_title?: string;
  current_company?: string;
  years_experience?: number;
  employment_history: Array<{
    company: string;
    title: string;
    start: string; // YYYY-MM or YYYY
    end: string | "present";
    highlights: string[];
  }>;
  education: Array<{
    institution: string;
    degree?: string;
    field?: string;
    graduation?: string;
  }>;
  skills: string[];
  certifications?: string[];
  languages?: string[];
  /** Gaps or red flags Axon noticed (employment gaps, job-hopping, missing context, etc.) */
  notes?: string[];
}

interface AxonAssessment {
  scores: Array<{ label: string; score: number; note: string }>;
  strengths: string[];
  concerns: string[];
  recommended_next_step: string;
  /** Optional — names of past hires this candidate resembles. Empty for now (future feature). */
  comparable_hires?: string[];
}

// ── Helpers ────────────────────────────────────────────────────────

/** Download the candidate's resume from Supabase Storage as base64
 *  for sending to Claude. The bucket is private so we sign on demand
 *  rather than relying on a stored URL.
 *
 *  Returns the base64 payload + the media type. Claude's documents API
 *  needs both. */
async function downloadResumeAsBase64(
  storagePath: string,
  contentType: string,
): Promise<{ base64: string; mediaType: string }> {
  const { data, error } = await companySupabase.storage
    .from("resumes")
    .createSignedUrl(storagePath, 60); // 60s — plenty for one fetch
  if (error || !data?.signedUrl) {
    throw new Error(`Could not sign resume URL: ${error?.message ?? "unknown"}`);
  }

  const res = await fetch(data.signedUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch resume: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();

  // ArrayBuffer → base64. We avoid String.fromCharCode.apply on large
  // buffers (stack overflow risk) by chunking.
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 =
    typeof window !== "undefined" && typeof window.btoa === "function"
      ? window.btoa(binary)
      : Buffer.from(binary, "binary").toString("base64");

  return { base64, mediaType: contentType || "application/pdf" };
}

/** Strip ```json fences and parse. Claude often wraps JSON in fences
 *  despite the prompt asking for raw JSON, so we tolerate both. */
function parseClaudeJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : trimmed;
  // Sometimes Claude prefixes with prose. Find the first { and last }
  // to slice the JSON object out.
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in Claude response");
  }
  return JSON.parse(body.slice(start, end + 1)) as T;
}

const PARSE_RESUME_SYSTEM = [
  "You are AXON's resume parser. You receive a candidate's resume (PDF) and return a single JSON object that distills it into structured fields.",
  "",
  "RULES:",
  "- Output VALID JSON only — no prose, no markdown, no fences.",
  "- Required keys: summary, employment_history, education, skills.",
  "- summary: 2-3 sentences capturing seniority, domain, and standout signal.",
  "- employment_history: most recent first. Each entry has company, title, start, end ('present' if current), highlights (1-4 bullet strings).",
  "- education: each entry has institution, optionally degree/field/graduation.",
  "- skills: flat array of technologies/competencies (10-25 entries is typical).",
  "- Optional keys: current_title, current_company, years_experience (integer), certifications, languages, notes.",
  "- notes: an array of short strings flagging anything a recruiter should know (employment gaps, frequent job changes, missing context, possible level mismatch). Empty array if none.",
  "- Do NOT fabricate. If a field isn't on the resume, omit it (or empty array). Better empty than wrong.",
  "- years_experience: count from first professional role to most recent. Don't add internships or education.",
].join("\n");

const RATE_CANDIDATE_SYSTEM = [
  "You are AXON's candidate evaluator. You receive a parsed resume + the role's ideal profile and return a structured assessment.",
  "",
  "INPUT shape (you'll see it inline):",
  "  - role: { title, summary, responsibilities[], qualifications[] }",
  "  - ideal_profile: { must_have[], nice_to_have[], disqualifiers[], target_years_experience, weight }",
  "  - candidate: { parsed_resume, why_role, expected_compensation, ... }",
  "",
  "OUTPUT shape — return VALID JSON only, no prose:",
  "{",
  '  "fit_score": <integer 0-100>,',
  '  "verdict_tier": "TOP" | "STRONG" | "GOOD" | "OK" | "WEAK" | "MISMATCH",',
  '  "verdict_summary": "<1-2 sentences explaining the score>",',
  '  "scores": [',
  '    { "label": "Role fit",                "score": <0-100>, "note": "<short reason>" },',
  '    { "label": "Experience",              "score": <0-100>, "note": "<short reason>" },',
  '    { "label": "Cultural signal",         "score": <0-100>, "note": "<short reason>" },',
  '    { "label": "Compensation alignment",  "score": <0-100>, "note": "<short reason>" }',
  "  ],",
  '  "strengths":   ["<3 short bullet strings>"],',
  '  "concerns":    ["<1-3 short bullet strings, honest>"],',
  '  "recommended_next_step": "<one phrase: e.g. \'30-min intro with Sarah\', \'pass\', \'route to backend role\'>"',
  "}",
  "",
  "GUIDANCE:",
  "- Be HONEST. Investors and the team trust you to flag concerns, not just sell candidates.",
  "- Apply weight if provided; otherwise treat the four scores as equal.",
  "- If any disqualifier hits cleanly, fit_score should be <= 30 and verdict_tier MISMATCH.",
  "- TOP = top 5%, STRONG = clear hire, GOOD = worth interviewing, OK = borderline, WEAK = probably pass, MISMATCH = wrong role.",
  "- 'Cultural signal' = how their why_role + writing tone fits an editorial, fast-moving founder team.",
  "- 'Compensation alignment' = how their expected_compensation maps to the role's typical band (you don't know the exact band, but flag obvious mismatches like a $250k ask for a $140k role).",
].join("\n");

// ── Action 1: parse_resume ─────────────────────────────────────────

export const parseResumeAction: AxonAction<
  { candidate_id?: string; all_pending?: boolean; max_to_parse?: number },
  { parsed: number; failed: number; ids: string[] }
> = {
  name: "parse_resume",
  description:
    "Parse a candidate's resume PDF into structured fields (employment, education, skills) using Claude. Pass candidate_id to parse one, or all_pending=true to drain the queue of pending applications. Use after new applications arrive on the website.",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string", description: "UUID of a single candidate to parse." },
      all_pending: {
        type: "boolean",
        description: "If true, parses every candidate whose parse_status is 'pending'.",
      },
      max_to_parse: {
        type: "number",
        description: "Safety cap when all_pending=true. Default 10.",
      },
    },
  },
  mutating: true,
  handler: async ({ candidate_id, all_pending, max_to_parse = 10 }, ctx) => {
    if (!ANTHROPIC_API_KEY) {
      return { summary: "Cannot parse: no Anthropic API key configured." };
    }
    if (!candidate_id && !all_pending) {
      return { summary: "Pass either candidate_id or all_pending=true." };
    }

    // Find candidates to parse.
    let targets: CandidateRow[] = [];
    if (candidate_id) {
      const { data, error } = await companySupabase
  .from("candidates")
        .select("*")
        .eq("id", candidate_id)
        .maybeSingle();
      if (error) return { summary: `Lookup failed: ${error.message}` };
      if (!data) return { summary: `No candidate with id ${candidate_id}.` };
      targets = [data as CandidateRow];
    } else {
      const { data, error } = await companySupabase
  .from("candidates")
        .select("*")
        .eq("parse_status", "pending")
        .order("created_at", { ascending: true })
        .limit(Math.max(1, Math.min(max_to_parse, 50)));
      if (error) return { summary: `Queue lookup failed: ${error.message}` };
      targets = (data ?? []) as CandidateRow[];
    }

    if (targets.length === 0) {
      const summary = "No pending resumes to parse.";
      ctx.logActivity({ actionName: "parse_resume", params: { candidate_id, all_pending }, summary });
      return { summary, data: { parsed: 0, failed: 0, ids: [] } };
    }

    const succeeded: string[] = [];
    const failed: Array<{ id: string; name: string; err: string }> = [];

    for (const c of targets) {
      // Mark in-flight so concurrent operators don't double-parse.
      await companySupabase
  .from("candidates")
        .update({ parse_status: "processing", parse_error: null })
        .eq("id", c.id);

      try {
        if (!c.resume_storage_path) {
          throw new Error("No resume on file.");
        }
        const isPdf =
          (c.resume_content_type ?? "").toLowerCase() === "application/pdf" ||
          (c.resume_filename ?? "").toLowerCase().endsWith(".pdf");
        if (!isPdf) {
          throw new Error(
            `Unsupported resume format (${c.resume_content_type ?? "unknown"}). Only PDF parsing is wired today; DOC/DOCX coming.`,
          );
        }

        const { base64, mediaType } = await downloadResumeAsBase64(
          c.resume_storage_path,
          c.resume_content_type ?? "application/pdf",
        );

        const body = {
          model: CLAUDE_MODEL,
          max_tokens: 2000,
          system: PARSE_RESUME_SYSTEM,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: { type: "base64", media_type: mediaType, data: base64 },
                },
                {
                  type: "text",
                  text:
                    `Parse this resume for ${c.full_name}` +
                    (c.role_slug ? ` (applying for ${c.role_slug})` : "") +
                    ". Return JSON only.",
                },
              ],
            },
          ],
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
          const errText = await res.text().catch(() => "");
          throw new Error(`Claude returned ${res.status}: ${errText.slice(0, 200)}`);
        }

        const json = await res.json();
        const text = ((json?.content ?? []) as Array<{ type: string; text?: string }>)
          .filter((b) => b.type === "text")
          .map((b) => String(b.text ?? ""))
          .join("\n");

        const parsed = parseClaudeJson<ParsedResume>(text);

        await companySupabase
    .from("candidates")
          .update({
            parsed_resume: parsed,
            parse_status: "done",
            parse_error: null,
            parsed_at: new Date().toISOString(),
            // Backfill the form fields if missing — saves the recruiter
            // a column of "unknown" values when the candidate didn't
            // fill them in but the resume has them.
            current_title: c.current_title || parsed.current_title || null,
            current_company: c.current_company || parsed.current_company || null,
            years_experience: c.years_experience ?? parsed.years_experience ?? null,
          })
          .eq("id", c.id);

        succeeded.push(c.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ id: c.id, name: c.full_name, err: message });
        await companySupabase
    .from("candidates")
          .update({
            parse_status: "failed",
            parse_error: message.slice(0, 1000),
          })
          .eq("id", c.id);
      }
    }

    const summary =
      failed.length === 0
        ? `Parsed ${succeeded.length} resume${succeeded.length === 1 ? "" : "s"}.`
        : `Parsed ${succeeded.length}; ${failed.length} failed (${failed
            .slice(0, 2)
            .map((f) => f.name)
            .join(", ")}${failed.length > 2 ? "..." : ""}).`;

    ctx.logActivity({
      actionName: "parse_resume",
      params: { candidate_id, all_pending, max_to_parse },
      summary,
    });

    return {
      summary,
      data: { parsed: succeeded.length, failed: failed.length, ids: succeeded },
    };
  },
};

// ── Pure grading helper -- the single source of truth ─────────────
//
// Extracted from rate_candidate's handler so OTHER call sites (the
// new-candidate-graded monitor in particular) can grade a candidate
// without standing up an ActionContext. The action handler below is
// now a thin wrapper around this; both flows produce identical
// fit_score + verdict_tier + axon_assessment rows.
//
// Why a separate function instead of inlining the monitor's call to
// rateCandidateAction.handler: action handlers receive an
// ActionContext that monitors don't have (no operator, no
// logActivity wrapper, no router reference). Rather than stub all of
// that, we extract the pure DB + Claude work into a helper that takes
// only what it needs. Callers attach their own logging.
//
// Returns a discriminated result so monitors can decide whether to
// alert (ok=true) or surface a degraded state (ok=false with reason).

export interface GradeResult {
  ok: boolean;
  reason?: string;
  data?: {
    full_name: string;
    fit_score: number;
    verdict_tier: VerdictTier;
    verdict_summary: string;
  };
}

export async function gradeCandidatePure(
  candidate_id: string,
  force?: boolean,
): Promise<GradeResult> {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, reason: "no Anthropic API key configured" };
  }

  const { data: candidate, error: cErr } = await companySupabase
    .from("candidates")
    .select("*")
    .eq("id", candidate_id)
    .maybeSingle();
  if (cErr) return { ok: false, reason: `Lookup failed: ${cErr.message}` };
  if (!candidate) return { ok: false, reason: `No candidate with id ${candidate_id}` };

  const c = candidate as CandidateRow;
  if (!c.parsed_resume) {
    return {
      ok: false,
      reason: `${c.full_name} hasn't been parsed yet`,
    };
  }
  if (c.fit_score != null && !force) {
    return {
      ok: true,
      data: {
        full_name: c.full_name,
        fit_score: c.fit_score,
        verdict_tier: c.verdict_tier ?? "OK",
        verdict_summary: c.verdict_summary ?? "",
      },
    };
  }

  // Fetch the job posting.
  let posting: JobPostingRow | null = null;
  if (c.job_posting_id) {
    const { data } = await companySupabase
      .from("job_postings")
      .select("*")
      .eq("id", c.job_posting_id)
      .maybeSingle();
    posting = (data ?? null) as JobPostingRow | null;
  }
  if (!posting && c.role_slug) {
    const { data } = await companySupabase
      .from("job_postings")
      .select("*")
      .eq("slug", c.role_slug)
      .maybeSingle();
    posting = (data ?? null) as JobPostingRow | null;
  }
  if (!posting) {
    return {
      ok: false,
      reason: `No job_posting for role "${c.role_slug}"`,
    };
  }

  const userPayload = {
    role: {
      title: posting.title,
      team: posting.team,
      summary: posting.summary,
      responsibilities: posting.responsibilities,
      qualifications: posting.qualifications,
      bonus: posting.bonus ?? [],
    },
    ideal_profile: posting.ideal_profile ?? {},
    candidate: {
      full_name: c.full_name,
      current_title: c.current_title,
      current_company: c.current_company,
      years_experience: c.years_experience,
      linkedin_url: c.linkedin_url,
      github_url: c.github_url,
      portfolio_url: c.portfolio_url,
      why_role: c.why_role,
      why_takeover: c.why_takeover,
      expected_compensation: c.expected_compensation,
      parsed_resume: c.parsed_resume,
    },
  };

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
      max_tokens: 1500,
      system: RATE_CANDIDATE_SYSTEM,
      messages: [
        { role: "user", content: JSON.stringify(userPayload, null, 2) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return {
      ok: false,
      reason: `Claude ${res.status}: ${errText.slice(0, 200)}`,
    };
  }

  const json = await res.json();
  const text = ((json?.content ?? []) as Array<{ type: string; text?: string }>)
    .filter((b) => b.type === "text")
    .map((b) => String(b.text ?? ""))
    .join("\n");

  let result: {
    fit_score: number;
    verdict_tier: VerdictTier;
    verdict_summary: string;
    scores: AxonAssessment["scores"];
    strengths: string[];
    concerns: string[];
    recommended_next_step: string;
  };
  try {
    result = parseClaudeJson(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `Claude returned non-JSON: ${msg}` };
  }

  const score = Math.max(0, Math.min(100, Math.round(result.fit_score ?? 0)));
  const allowedTiers: VerdictTier[] = ["TOP", "STRONG", "GOOD", "OK", "WEAK", "MISMATCH"];
  const tier = allowedTiers.includes(result.verdict_tier) ? result.verdict_tier : "OK";

  const assessment: AxonAssessment = {
    scores: Array.isArray(result.scores) ? result.scores : [],
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    concerns: Array.isArray(result.concerns) ? result.concerns : [],
    recommended_next_step: result.recommended_next_step ?? "",
  };

  const { error: updateErr } = await companySupabase
    .from("candidates")
    .update({
      fit_score: score,
      verdict_tier: tier,
      verdict_summary: result.verdict_summary ?? "",
      axon_assessment: assessment,
      assessed_at: new Date().toISOString(),
      assessed_model: CLAUDE_MODEL,
    })
    .eq("id", candidate_id);

  if (updateErr) {
    return { ok: false, reason: `Scored but save failed: ${updateErr.message}` };
  }

  return {
    ok: true,
    data: {
      full_name: c.full_name,
      fit_score: score,
      verdict_tier: tier,
      verdict_summary: result.verdict_summary ?? "",
    },
  };
}

// ── Action 2: rate_candidate ───────────────────────────────────────

export const rateCandidateAction: AxonAction<
  { candidate_id: string; force?: boolean },
  { fit_score: number; verdict_tier: VerdictTier; verdict_summary: string }
> = {
  name: "rate_candidate",
  description:
    "Score a single parsed candidate against their applied-for role's ideal profile. Returns a 0-100 fit score, a verdict tier, and structured strengths/concerns. Skips candidates without parsed_resume (run parse_resume first). Pass force=true to re-score an already-scored candidate.",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string", description: "UUID of the candidate to rate." },
      force: {
        type: "boolean",
        description: "Re-rate even if fit_score is already set.",
      },
    },
    required: ["candidate_id"],
  },
  mutating: true,
  handler: async ({ candidate_id, force }, ctx) => {
    // Delegates to gradeCandidatePure -- the single source of truth.
    // This handler exists to (1) surface the result via the
    // action-result `summary` field, and (2) log to the activity feed.
    // The grading work itself is identical to what the
    // new-candidate-graded monitor does.
    const result = await gradeCandidatePure(candidate_id, force);
    if (!result.ok || !result.data) {
      return { summary: result.reason ?? "Rate failed for an unknown reason." };
    }
    const { full_name, fit_score, verdict_tier, verdict_summary } = result.data;
    const summary = `${full_name}: ${fit_score}/100 (${verdict_tier}). ${verdict_summary}`.trim();
    ctx.logActivity({
      actionName: "rate_candidate",
      params: { candidate_id, force },
      summary,
    });
    return {
      summary,
      data: { fit_score, verdict_tier, verdict_summary },
    };
  },
};

// ── Action 3: rate_all_pending ─────────────────────────────────────

export const rateAllPendingAction: AxonAction<
  { role_slug?: string; max_to_rate?: number },
  { rated: number; failed: number }
> = {
  name: "rate_all_pending",
  description:
    "Score every parsed candidate that doesn't yet have a fit_score. Optionally narrow to a single role by slug. Use after parse_resume to bring a fresh batch of applications into ranked order.",
  input_schema: {
    type: "object",
    properties: {
      role_slug: {
        type: "string",
        description: "Limit to one role (e.g. 'founding-engineer-applied-ai').",
      },
      max_to_rate: { type: "number", description: "Safety cap. Default 20." },
    },
  },
  mutating: true,
  handler: async ({ role_slug, max_to_rate = 20 }, ctx) => {
    let q = companySupabase
      .from("candidates")
      .select("id, full_name")
      .eq("parse_status", "done")
      .is("fit_score", null)
      .order("created_at", { ascending: true })
      .limit(Math.max(1, Math.min(max_to_rate, 50)));
    if (role_slug) q = q.eq("role_slug", role_slug);

    const { data, error } = await q;
    if (error) return { summary: `Queue lookup failed: ${error.message}` };
    const rows = (data ?? []) as Array<{ id: string; full_name: string }>;

    if (rows.length === 0) {
      return { summary: "No parsed-but-unscored candidates." };
    }

    let rated = 0;
    let failed = 0;
    for (const r of rows) {
      const out = await rateCandidateAction.handler({ candidate_id: r.id }, ctx);
      if (out.data?.fit_score != null) rated++;
      else failed++;
    }

    const summary = `Rated ${rated}${failed ? `, ${failed} failed` : ""}.`;
    ctx.logActivity({
      actionName: "rate_all_pending",
      params: { role_slug, max_to_rate },
      summary,
    });
    return { summary, data: { rated, failed } };
  },
};

// ── Action 4: list_candidates ──────────────────────────────────────

export const listCandidatesAction: AxonAction<
  {
    role_slug?: string;
    status?: CandidateStatus | "all";
    min_score?: number;
    sort_by?: "fit_score" | "created_at";
    limit?: number;
    offset?: number;
  },
  {
    count: number;
    rows: Array<{
      id: string;
      full_name: string;
      role_slug: string;
      fit_score: number | null;
      verdict_tier: VerdictTier | null;
      status: CandidateStatus;
      created_at: string;
    }>;
  }
> = {
  name: "list_candidates",
  description:
    "List candidates with optional filters by role and status, sorted by fit_score (default) or created_at. Use for 'who's at the top of the pipeline', 'show me everyone applying for senior frontend', 'how many candidates are in screening'.",
  input_schema: {
    type: "object",
    properties: {
      role_slug: { type: "string" },
      status: { type: "string", description: "applied | screening | interview | offer | hired | rejected | withdrawn | all" },
      min_score: { type: "number", description: "Drop candidates below this fit_score." },
      sort_by: { type: "string", description: "fit_score (default) or created_at" },
      limit: { type: "number", description: "Default 25, max 100." },
      offset: { type: "number" },
    },
  },
  handler: async ({ role_slug, status, min_score, sort_by = "fit_score", limit = 25, offset = 0 }, ctx) => {
    const cappedLimit = Math.max(1, Math.min(limit, 100));
    let q = companySupabase
      .from("candidates")
      .select("id, full_name, role_slug, fit_score, verdict_tier, status, created_at", { count: "exact" })
      .range(offset, offset + cappedLimit - 1);

    if (role_slug) q = q.eq("role_slug", role_slug);
    if (status && status !== "all") q = q.eq("status", status);
    if (typeof min_score === "number") q = q.gte("fit_score", min_score);

    if (sort_by === "fit_score") {
      q = q.order("fit_score", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
    } else {
      q = q.order("created_at", { ascending: false });
    }

    const { data, error, count } = await q;
    if (error) return { summary: `Query failed: ${error.message}` };

    const rows = (data ?? []) as Array<{
      id: string;
      full_name: string;
      role_slug: string;
      fit_score: number | null;
      verdict_tier: VerdictTier | null;
      status: CandidateStatus;
      created_at: string;
    }>;

    const summary =
      rows.length === 0
        ? "No candidates match those filters."
        : `${rows.length} of ${count ?? rows.length} candidates${role_slug ? ` for ${role_slug}` : ""}${status && status !== "all" ? ` in ${status}` : ""}. Top: ${rows
            .slice(0, 3)
            .map((r) => `${r.full_name} (${r.fit_score ?? "?"})`)
            .join(", ")}.`;

    ctx.logActivity({
      actionName: "list_candidates",
      params: { role_slug, status, min_score, sort_by, limit, offset },
      summary,
    });
    return { summary, data: { count: rows.length, rows } };
  },
};

// ── Action 5: candidate_detail ─────────────────────────────────────

export const candidateDetailAction: AxonAction<
  { candidate_id: string },
  { candidate: Partial<CandidateRow> }
> = {
  name: "candidate_detail",
  description:
    "Return the full record for one candidate — parsed resume, Axon assessment, contact info, status. Use after list_candidates when the operator asks about a specific person.",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string" },
    },
    required: ["candidate_id"],
  },
  handler: async ({ candidate_id }, ctx) => {
    const { data, error } = await companySupabase
.from("candidates")
      .select("*")
      .eq("id", candidate_id)
      .maybeSingle();
    if (error) return { summary: `Lookup failed: ${error.message}` };
    if (!data) return { summary: `No candidate with id ${candidate_id}.` };

    const c = data as CandidateRow;
    const verdict = c.fit_score != null
      ? `${c.fit_score}/100 (${c.verdict_tier})`
      : "not yet rated";
    const summary = `${c.full_name} — ${c.role_slug}. Status: ${c.status}. Verdict: ${verdict}.${c.verdict_summary ? " " + c.verdict_summary : ""}`;
    ctx.logActivity({ actionName: "candidate_detail", params: { candidate_id }, summary });
    return { summary, data: { candidate: c } };
  },
};

// ── Action 6: update_candidate_status ──────────────────────────────

export const updateCandidateStatusAction: AxonAction<
  { candidate_id: string; status: CandidateStatus; reason?: string },
  { id: string; status: CandidateStatus }
> = {
  name: "update_candidate_status",
  description:
    "Move a candidate to a new pipeline stage (applied/screening/interview/offer/hired/rejected/withdrawn). Optional reason for the audit trail.",
  input_schema: {
    type: "object",
    properties: {
      candidate_id: { type: "string" },
      status: {
        type: "string",
        enum: ["applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"],
      },
      reason: { type: "string" },
    },
    required: ["candidate_id", "status"],
  },
  mutating: true,
  requiresConfirmation: false, // status moves are cheap + undoable
  handler: async ({ candidate_id, status, reason }, ctx) => {
    // Snapshot previous status so undo can revert.
    const { data: prev } = await companySupabase
.from("candidates")
      .select("status, full_name")
      .eq("id", candidate_id)
      .maybeSingle();

    const { error } = await companySupabase
.from("candidates")
      .update({ status, status_reason: reason ?? null })
      .eq("id", candidate_id);
    if (error) return { summary: `Update failed: ${error.message}` };

    const name = (prev as { full_name?: string } | null)?.full_name ?? candidate_id.slice(0, 8);
    const summary = `Moved ${name} → ${status}${reason ? ` (${reason})` : ""}.`;

    if (prev && (prev as { status: CandidateStatus }).status !== status) {
      ctx.pushUndo({
        actionName: "update_candidate_status",
        label: `Revert ${name} back to ${(prev as { status: CandidateStatus }).status}`,
        descriptor: {
          kind: "candidate.restore-status",
          payload: {
            candidate_id,
            previous_status: (prev as { status: CandidateStatus }).status,
          },
        },
      });
    }

    ctx.logActivity({
      actionName: "update_candidate_status",
      params: { candidate_id, status, reason },
      summary,
    });
    return { summary, data: { id: candidate_id, status } };
  },
};

// ── Registration ───────────────────────────────────────────────────

export function registerRecruitingActions(): void {
  registerAction(parseResumeAction);
  registerAction(rateCandidateAction);
  registerAction(rateAllPendingAction);
  registerAction(listCandidatesAction);
  registerAction(candidateDetailAction);
  registerAction(updateCandidateStatusAction);
}
