/**
 * fetchJobsApi.ts — real job listings via the takeover_b2b /api/jobs proxy
 * (server-side, no CORS). Computes a local resume-match score so results still
 * rank against your experience without an extra LLM call.
 */
import type { JobPosting } from "./discoverJobs";

const SITE = import.meta.env.VITE_TAKEOVER_SITE_URL as string | undefined;
const proxyUrl = () => `${(SITE || "").replace(/\/$/, "")}/api/jobs`;

const STOP = new Set(["the","and","for","with","you","our","are","this","that","will","work","team","role","job","new","all","your","have","has","who","using","use","build","building","engineer","developer","senior","remote"]);

function scoreAgainstResume(job: { title: string; requirements: string[]; summary: string | null }, resumeLower: string): { score: number; reason: string } {
  if (!resumeLower) return { score: 60, reason: "Add your master resume to rank these against your experience." };
  const terms = new Set<string>();
  job.requirements.forEach((t) => terms.add(t.toLowerCase()));
  job.title.toLowerCase().split(/[^a-z0-9+#.]+/).forEach((w) => { if (w.length >= 3 && !STOP.has(w)) terms.add(w); });
  const matched: string[] = [];
  for (const t of terms) if (t.length >= 3 && resumeLower.includes(t)) matched.push(t);
  const score = Math.max(35, Math.min(96, 42 + matched.length * 9));
  const reason = matched.length
    ? `Matches your resume: ${matched.slice(0, 4).join(", ")}`
    : "Outside your current resume keywords — stretch role.";
  return { score, reason };
}

export async function fetchJobsApi(query: string, resume: string | null, limit = 24): Promise<{ jobs: JobPosting[]; error?: string }> {
  if (!SITE) return { jobs: [], error: "VITE_TAKEOVER_SITE_URL not set — can't reach the job proxy." };
  try {
    const res = await fetch(proxyUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "TakeOver-App": "true" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) return { jobs: [], error: `Job API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 160)}` };
    const data = (await res.json()) as { jobs?: any[] };
    const resumeLower = (resume || "").toLowerCase();
    const jobs: JobPosting[] = (data.jobs ?? [])
      .map((j) => {
        const { score, reason } = scoreAgainstResume(j, resumeLower);
        return {
          company: String(j.company ?? "—"),
          title: String(j.title ?? "—"),
          location: j.location ?? null,
          remote: !!j.remote,
          salary: j.salary ?? null,
          url: j.url ?? null,
          summary: j.summary ?? null,
          requirements: Array.isArray(j.requirements) ? j.requirements.map(String) : [],
          match_score: score,
          match_reason: reason,
        };
      })
      .sort((a, b) => b.match_score - a.match_score);
    return { jobs };
  } catch (e: any) {
    return { jobs: [], error: e?.message || "Job fetch failed." };
  }
}
