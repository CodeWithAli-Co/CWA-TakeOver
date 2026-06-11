/**
 * autoApply.ts — client orchestration of an application: detect the ATS,
 * generate the tailored résumé PDF, and submit through the takeover_b2b proxy.
 * Lever can auto-submit; Greenhouse/Ashby/others return "manual" (open form).
 */
import { detectAts, ATS_LABEL, type AtsKind } from "./atsDetect";
import type { ApplyProfile } from "./profile";

const SITE = import.meta.env.VITE_TAKEOVER_SITE_URL as string | undefined;
const endpoint = () => `${(SITE || "").replace(/\/$/, "")}/api/jobs/apply`;

export interface ApplyJobInput {
  url: string | null;
  company: string;
  tailored?: { tailored_resume?: string } | undefined;
}
export interface ApplyResult { status: "submitted" | "manual" | "error"; reason: string; applyUrl?: string | null; ats: AtsKind }

export { detectAts, ATS_LABEL };

export async function autoApply(job: ApplyJobInput, profile: ApplyProfile, masterResume: string): Promise<ApplyResult> {
  if (!job.url) return { status: "manual", reason: "This listing has no apply URL.", ats: "unknown" };
  const ref = detectAts(job.url);
  if (ref.kind !== "lever" || !ref.canAutoApply) {
    return {
      status: "manual",
      reason: ref.canAutoApply ? `${ATS_LABEL[ref.kind]} auto-submit isn't supported yet — open the form.` : `${ATS_LABEL[ref.kind]} needs the human apply form.`,
      applyUrl: job.url, ats: ref.kind,
    };
  }
  if (!SITE) return { status: "error", reason: "VITE_TAKEOVER_SITE_URL not set — can't reach the apply proxy.", ats: ref.kind };

  const resumeText = job.tailored?.tailored_resume || masterResume;
  if (!resumeText) return { status: "error", reason: "Add your master resume (or tailor it) first.", ats: ref.kind };

  try {
    const { renderResumePdf, blobToBase64, safeFile } = await import("./resumePdf");
    const resumeBase64 = await blobToBase64(await renderResumePdf(resumeText));
    const res = await fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "TakeOver-App": "true" },
      body: JSON.stringify({
        mode: "submit", ats: ref.kind, board: ref.board, jobId: ref.jobId, applyUrl: job.url,
        profile, resumeBase64, resumeFilename: safeFile(`Resume - ${job.company}`) + ".pdf",
      }),
    });
    if (!res.ok) return { status: "error", reason: `Apply API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 140)}`, ats: ref.kind };
    const d = (await res.json()) as { status?: string; reason?: string; applyUrl?: string };
    return { status: (d.status as any) || "manual", reason: d.reason || "", applyUrl: d.applyUrl ?? job.url, ats: ref.kind };
  } catch (e: any) {
    return { status: "error", reason: e?.message || "Apply failed.", ats: ref.kind };
  }
}
