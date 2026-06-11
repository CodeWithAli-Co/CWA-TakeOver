/**
 * profile.ts — the "apply profile": the standard answers every ATS form needs.
 * Most fields are inferred from the master resume; the rest (work auth, salary,
 * sponsorship) the user sets once. Reused for every autonomous application.
 */
export interface ApplyProfile {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  workAuthorized: boolean;     // authorized to work in the US
  needsSponsorship: boolean;   // requires visa sponsorship
  salaryExpectation: string;   // e.g. "$160k–$200k"
  howHeard: string;            // "Company website" etc.
  eeoDecline: boolean;         // decline-to-self-identify on EEO questions
}

export const emptyProfile: ApplyProfile = {
  fullName: "", email: "", phone: "", location: "", linkedin: "", github: "", portfolio: "",
  workAuthorized: true, needsSponsorship: false, salaryExpectation: "", howHeard: "Company website", eeoDecline: true,
};

/** Pull what we can out of the master resume header. */
export function inferProfileFromResume(resume: string): Partial<ApplyProfile> {
  const r = resume || "";
  const firstLines = r.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6);
  const email = (r.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || "";
  const phone = (r.match(/\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/) || [])[0] || "";
  const linkedin = (r.match(/linkedin\.com\/in\/[\w-]+/i) || [])[0] || "";
  const github = (r.match(/github\.com\/[\w-]+/i) || [])[0] || "";
  // portfolio: first URL/domain that isn't linkedin/github/email
  const urls = (r.match(/[a-z0-9-]+\.[a-z]{2,}(?:\/[\w./-]*)?/gi) || [])
    .filter((u) => !/linkedin\.com|github\.com|@/.test(u) && !/\.(png|jpg|pdf)$/i.test(u));
  const portfolio = urls[0] || "";
  // name: first line, trimmed of role suffix
  const nameLine = firstLines[0] || "";
  const fullName = nameLine.split(/[—|·•]/)[0].replace(/\s{2,}/g, " ").trim().slice(0, 60);
  // location: "City, ST" pattern
  const location = (r.match(/[A-Z][a-zA-Z .]+,\s*[A-Z]{2}\b/) || [])[0] || "";
  return { fullName, email, phone, linkedin, github, portfolio, location };
}
