/**
 * atsDetect.ts — figure out which Applicant Tracking System a job's apply URL
 * belongs to, and pull the board + job identifiers needed to fetch the form
 * schema and submit. Pure + deterministic so it's easy to test.
 *
 * Auto-applyable today: Greenhouse, Lever, Ashby (public form/api shapes).
 * Not auto-applyable (account-gated / anti-bot): Workday, iCIMS, LinkedIn,
 * Indeed — these fall back to a one-click manual queue.
 */
export type AtsKind = "greenhouse" | "lever" | "ashby" | "workday" | "linkedin" | "indeed" | "unknown";

export interface AtsRef {
  kind: AtsKind;
  board: string | null;   // company/board token or Lever site or Ashby org
  jobId: string | null;
  canAutoApply: boolean;
  applyUrl: string;
}

const AUTO = new Set<AtsKind>(["greenhouse", "lever", "ashby"]);

export function detectAts(rawUrl: string | null | undefined): AtsRef {
  const applyUrl = (rawUrl || "").trim();
  const fail = (kind: AtsKind = "unknown"): AtsRef => ({ kind, board: null, jobId: null, canAutoApply: false, applyUrl });
  if (!applyUrl) return fail();

  let u: URL;
  try { u = new URL(applyUrl); } catch { return fail(); }
  const host = u.hostname.toLowerCase();
  const path = u.pathname.replace(/\/+$/, "");
  const seg = path.split("/").filter(Boolean);

  // ── Greenhouse ──────────────────────────────────────────────────
  if (host.includes("greenhouse.io")) {
    // boards.greenhouse.io/{board}/jobs/{id}  ·  job-boards.greenhouse.io/{board}/jobs/{id}
    const jobsIdx = seg.indexOf("jobs");
    if (jobsIdx > 0 && seg[jobsIdx + 1]) {
      return mk("greenhouse", seg[jobsIdx - 1], seg[jobsIdx + 1].replace(/\D/g, ""), applyUrl);
    }
    // embed/job_app?for={board}&token={id}  (or ?gh_jid=)
    const forParam = u.searchParams.get("for");
    const token = u.searchParams.get("token") || u.searchParams.get("gh_jid");
    if (forParam && token) return mk("greenhouse", forParam, token.replace(/\D/g, ""), applyUrl);
    // {board}.greenhouse.io with ?gh_jid
    const sub = host.split(".")[0];
    if (token && sub && sub !== "boards" && sub !== "job-boards") return mk("greenhouse", sub, token.replace(/\D/g, ""), applyUrl);
    return fail("greenhouse");
  }

  // ── Lever ───────────────────────────────────────────────────────
  if (host.endsWith("lever.co")) {
    // jobs.lever.co/{site}/{postingId}[/apply]
    if (seg[0]) {
      const id = seg[1] && seg[1] !== "apply" ? seg[1] : null;
      return mk("lever", seg[0], id, applyUrl);
    }
    return fail("lever");
  }

  // ── Ashby ───────────────────────────────────────────────────────
  if (host.includes("ashbyhq.com")) {
    // jobs.ashbyhq.com/{org}/{jobId}
    if (seg[0] && seg[1]) return mk("ashby", seg[0], seg[1], applyUrl);
    return fail("ashby");
  }

  // ── Not auto-applyable ──────────────────────────────────────────
  if (host.includes("myworkdayjobs.com") || host.includes("workday")) return fail("workday");
  if (host.includes("linkedin.com")) return fail("linkedin");
  if (host.includes("indeed.com")) return fail("indeed");

  return fail();
}

function mk(kind: AtsKind, board: string | null, jobId: string | null, applyUrl: string): AtsRef {
  return { kind, board: board || null, jobId: jobId || null, canAutoApply: AUTO.has(kind) && !!board && !!jobId, applyUrl };
}

export const ATS_LABEL: Record<AtsKind, string> = {
  greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", workday: "Workday",
  linkedin: "LinkedIn", indeed: "Indeed", unknown: "Unknown ATS",
};
