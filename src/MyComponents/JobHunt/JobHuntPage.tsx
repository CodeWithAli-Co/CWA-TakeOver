import { useMemo, useState } from "react";
import { Sparkles, FileText, ExternalLink, Trash2, X, Wand2, Copy, Check, Loader2, Briefcase, Mail, Send, Download, IdCard } from "lucide-react";
import { discoverJobs } from "@/JobHunt/discoverJobs";
import { fetchJobsApi } from "@/JobHunt/fetchJobsApi";
import { tailorResume } from "@/JobHunt/tailorResume";
import { draftRecruiterEmail } from "@/JobHunt/draftRecruiterEmail";
import { findRecruiterEmail } from "@/JobHunt/findRecruiterEmail";
import { useSendEmail } from "@/stores/gmail";
import { useJobHunt, JOB_STATUSES, needsFollowUp, type JobStatus, type SavedJob } from "./jobHuntStore";
import { AutopilotPanel } from "./AutopilotPanel";
import { JobBento } from "./JobBento";
import { useAutopilot } from "./useAutopilot";
import { OutreachPanel } from "./OutreachPanel";
import { OutreachTab } from "./OutreachTab";
import { inferProfileFromResume, type ApplyProfile } from "@/JobHunt/profile";
import { detectAts, ATS_LABEL } from "@/JobHunt/atsDetect";
import { autoApply, type ApplyResult } from "@/JobHunt/autoApply";
import { open as openShell } from "@tauri-apps/plugin-shell";

const goExternal = (u?: string | null) => { if (u) openShell(u).catch(() => { try { window.open(u, "_blank"); } catch { /* noop */ } }); };

const STATUS_STYLE: Record<JobStatus, string> = {
  saved: "text-zinc-300 border-zinc-600/50 bg-zinc-500/10",
  applied: "text-sky-300 border-sky-600/50 bg-sky-500/10",
  interview: "text-amber-300 border-amber-600/50 bg-amber-500/10",
  offer: "text-emerald-300 border-emerald-600/50 bg-emerald-500/10",
  rejected: "text-red-300 border-red-600/50 bg-red-500/10",
};
const scoreColor = (n: number) => (n >= 80 ? "text-emerald-400" : n >= 60 ? "text-amber-400" : "text-zinc-400");

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1200); }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? "Copied" : "Copy"}
    </button>
  );
}

export function JobHuntPage() {
  const { masterResume, setMasterResume, jobs, addJobs, updateJob, removeJob, profile, setProfile } = useJobHunt();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobStatus | "all" | "needs-you">("all");
  const [source, setSource] = useState<"boards" | "axon">("boards");
  const [openId, setOpenId] = useState<string | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [tab, setTab] = useState<"pipeline" | "autopilot" | "outreach">("pipeline");
  const ap = useAutopilot();
  const dueCount = useJobHunt((s) => s.outreach.filter(needsFollowUp).length);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    JOB_STATUSES.forEach((s) => (c[s] = jobs.filter((j) => j.status === s).length));
    c["needs-you"] = jobs.filter((j) => j.applyResult?.status === "needs_human").length;
    return c;
  }, [jobs]);
  const visible =
    filter === "all" ? jobs
    : filter === "needs-you" ? jobs.filter((j) => j.applyResult?.status === "needs_human")
    : jobs.filter((j) => j.status === filter);
  const open = jobs.find((j) => j.id === openId) || null;
  const dailyCap = useJobHunt((s) => s.autopilot.dailyCap);
  const appliedObj = useJobHunt((s) => s.applied);
  const appliedTodayN = appliedObj.date === new Date().toISOString().slice(0, 10) ? appliedObj.count : 0;

  async function runDiscover() {
    if (!query.trim() || loading) return;
    setLoading(true); setError(null);
    const r = source === "boards"
      ? await fetchJobsApi(query, masterResume)
      : await discoverJobs({ query, resume: masterResume });
    setLoading(false);
    if (r.error) { setError(r.error); return; }
    const added = addJobs(r.jobs);
    setToast(added > 0 ? `Added ${added} new job${added === 1 ? "" : "s"}` : "No new jobs (all already in your pipeline)");
    setTimeout(() => setToast(null), 2600);
  }

  return (
    <div className="px-6 md:px-8 py-6 max-w-[1400px] mx-auto">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
            <Briefcase size={13} /> Job Hunt
          </div>
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Newsreader, Georgia, serif" }}>
            Find a role, tailor your resume, apply.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setProfileOpen(true)}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md border border-border bg-card hover:border-foreground/30 text-[13px] text-foreground transition-colors">
            <IdCard size={14} />
            {profile.email ? "Apply profile ✓" : "Apply profile"}
          </button>
          <button onClick={() => setResumeOpen(true)}
                  className="inline-flex items-center gap-2 h-9 px-3.5 rounded-md border border-border bg-card hover:border-foreground/30 text-[13px] text-foreground transition-colors">
            <FileText size={14} />
            {masterResume ? "Master resume ✓" : "Add master resume"}
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-2 mb-5">
        {([["pipeline", "Pipeline"], ["autopilot", "Autopilot"], ["outreach", "Outreach"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-md text-[13px] border transition-colors ${tab === k ? "border-foreground/40 bg-foreground/5 text-foreground" : "border-line text-fg-subtle hover:text-foreground"}`}
            style={{ fontFamily: '"Hanken Grotesk", Inter, sans-serif' }}>
            {k === "autopilot" && ap.continuous && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
            {label}
            {k === "outreach" && dueCount > 0 && <span className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300" style={{ fontFamily: '"JetBrains Mono", monospace' }}>{dueCount}</span>}
          </button>
        ))}
      </div>

      {tab === "autopilot" ? (
        <AutopilotPanel ap={ap} />
      ) : tab === "outreach" ? (
        <OutreachTab masterResume={masterResume} />
      ) : (
        <>
      {/* discover bar */}
      <div className="bg-card border border-border rounded-lg p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          {(["boards", "axon"] as const).map((sv) => (
            <button key={sv} onClick={() => setSource(sv)}
                    className={`h-7 px-3 rounded-md text-[11.5px] border transition-colors ${source === sv ? "border-foreground/40 bg-foreground/5 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {sv === "boards" ? "Job boards (real listings)" : "Axon web search (AI-curated)"}
            </button>
          ))}
        </div>
        <div className="flex items-start gap-3">
          <textarea
            value={query} onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") runDiscover(); }}
            placeholder="Describe the roles you want — e.g. 'remote senior React/TS, $130k+, fintech or dev-tools, US time zones'"
            rows={2}
            className="flex-1 resize-none bg-background border border-border rounded-md px-3 py-2 text-[13.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/50"
          />
          <button onClick={runDiscover} disabled={loading || !query.trim()}
                  className="inline-flex items-center gap-2 h-[42px] px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {loading ? "Searching…" : source === "boards" ? "Search" : "Discover"}
          </button>
        </div>
        {!masterResume && <p className="text-[11.5px] text-amber-400/80 mt-2">Tip: add your master resume so matches are ranked against your actual experience.</p>}
        {error && <p className="text-[12px] text-red-400 mt-2">{error}</p>}
        {toast && <p className="text-[12px] text-emerald-400 mt-2">{toast}</p>}
      </div>

      {/* pipeline — bento grid */}
      <JobBento
        jobs={visible}
        counts={counts}
        filter={filter}
        setFilter={setFilter}
        onOpen={setOpenId}
        appliedToday={appliedTodayN}
        dailyCap={dailyCap}
      />
        </>
      )}

      {open && <JobModal job={open} onClose={() => setOpenId(null)} masterResume={masterResume} profile={profile}
                         onUpdate={(p) => updateJob(open.id, p)} onRemove={() => { removeJob(open.id); setOpenId(null); }} />}
      {resumeOpen && <ResumeModal value={masterResume} onSave={(v) => { setMasterResume(v); setResumeOpen(false); }} onClose={() => setResumeOpen(false)} />}
      {profileOpen && <ProfileModal value={profile} resume={masterResume} onSave={(p) => { setProfile(p); setProfileOpen(false); }} onClose={() => setProfileOpen(false)} />}
    </div>
  );
}

function JobModal({ job, onClose, masterResume, profile, onUpdate, onRemove }: {
  job: SavedJob; onClose: () => void; masterResume: string; profile: ApplyProfile;
  onUpdate: (p: Partial<SavedJob>) => void; onRemove: () => void;
}) {
  const [tailoring, setTailoring] = useState(false);
  const [terr, setTerr] = useState<string | null>(null);
  const sendEmail = useSendEmail();
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [oerr, setOerr] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [sent, setSent] = useState(false);
  const [attachPdf, setAttachPdf] = useState(true);
  const ats = job.url ? detectAts(job.url) : null;
  const [applying, setApplying] = useState(false);
  const logActivity = useJobHunt((s) => s.log);
  const [applyMsg, setApplyMsg] = useState<ApplyResult | null>(null);
  async function doAutoApply() {
    if (applying) return;
    setApplying(true); setApplyMsg(null);
    logActivity("info", `Applying → ${job.title} @ ${job.company}`);
    const r = await autoApply({ url: job.url, company: job.company, tailored: job.tailored }, profile, masterResume);
    setApplying(false); setApplyMsg(r);
    const outcome = { status: r.status, reason: r.reason, at: Date.now(), applyUrl: r.applyUrl ?? job.url };
    onUpdate(r.status === "submitted" ? { status: "applied", applyResult: outcome } : { applyResult: outcome });
    logActivity(
      r.status === "submitted" ? "ok" : r.status === "error" ? "error" : "warn",
      `${r.status === "submitted" ? "✓ Submitted" : r.status === "needs_human" ? "⚠ Needs you" : r.status === "error" ? "✗ Error" : "Manual"} → ${job.title} @ ${job.company}${r.reason ? ": " + r.reason : ""}`,
    );
  }
  async function makeDraft() {
    if (drafting) return;
    setDrafting(true); setOerr(null); setSent(false);
    const r = await draftRecruiterEmail({ resume: masterResume, job: { company: job.company, title: job.title, summary: job.summary, requirements: job.requirements } });
    setDrafting(false);
    if (r.error) { setOerr(r.error); return; }
    setDraft({ subject: r.subject, body: r.body });
  }
  async function send() {
    if (!draft || !to.includes("@")) return;
    setOerr(null);
    try {
      let attachments: { filename: string; mimeType: string; contentBase64: string }[] | undefined;
      if (attachPdf && job.tailored?.tailored_resume) {
        const { renderResumePdf, blobToBase64, safeFile } = await import("@/JobHunt/resumePdf");
        const blob = await renderResumePdf(job.tailored.tailored_resume);
        attachments = [{ filename: safeFile(`Resume - ${job.company}`) + ".pdf", mimeType: "application/pdf", contentBase64: await blobToBase64(blob) }];
      }
      await sendEmail.mutateAsync({ to, subject: draft.subject, body: draft.body, attachments } as any);
      setSent(true);
    } catch (e: any) { setOerr(e?.message || "Send failed — is Gmail connected?"); }
  }
  const [finding, setFinding] = useState(false);
  const [emailNote, setEmailNote] = useState<string | null>(null);
  async function findEmail() {
    if (finding) return;
    setFinding(true); setEmailNote(null);
    const r = await findRecruiterEmail({ company: job.company, title: job.title });
    setFinding(false);
    if (r.error) { setEmailNote(r.error); return; }
    if (r.email) { setTo(r.email); setEmailNote(r.source_label ? `Found · ${r.source_label}` : "Found a verified address."); }
    else setEmailNote(r.note || "No verifiable email found — try the company careers page or LinkedIn.");
  }

  async function tailor() {
    if (tailoring) return;
    setTailoring(true); setTerr(null);
    const r = await tailorResume({ resume: masterResume, job: { company: job.company, title: job.title, summary: job.summary, requirements: job.requirements } });
    setTailoring(false);
    if (r.error) { setTerr(r.error); return; }
    const { error, ...keep } = r;
    onUpdate({ tailored: keep });
  }

  const t = job.tailored;
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="min-w-0">
            <div className="text-[18px] font-bold text-foreground">{job.title}</div>
            <div className="text-[13px] text-muted-foreground">{job.company}{job.location ? ` · ${job.location}` : ""}{job.salary ? ` · ${job.salary}` : ""}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[14px] font-bold ${scoreColor(job.match_score)}`}>{job.match_score}% match</span>
            <select value={job.status} onChange={(e) => onUpdate({ status: e.target.value as JobStatus })}
                    className="h-8 px-2 rounded-md bg-background border border-border text-[12px] text-foreground capitalize">
              {JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {job.url && <button onClick={() => goExternal(job.url)} className="inline-flex items-center gap-1 text-[12px] text-sky-400 hover:underline">Apply <ExternalLink size={12} /></button>}
            <button onClick={onRemove} className="ml-auto inline-flex items-center gap-1 text-[12px] text-red-400/80 hover:text-red-400"><Trash2 size={12} /> Remove</button>
          </div>

          {/* apply */}
          <div className="rounded-md border border-border bg-background p-3 flex flex-wrap items-center gap-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Apply</span>
            {ats && <span className="text-[12px] text-foreground">{ATS_LABEL[ats.kind]}{ats.canAutoApply ? " · auto" : " · manual"}</span>}
            <div className="ml-auto flex items-center gap-2">
              {ats?.canAutoApply && (
                <button onClick={doAutoApply} disabled={applying || !profile.email}
                        className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                  {applying ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}{applying ? "Applying…" : "Auto-apply"}
                </button>
              )}
              {job.url && (
                <button onClick={() => { goExternal(job.url); onUpdate({ status: "applied" }); }}
                        className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border text-[12px] text-foreground hover:border-foreground/30">
                  <ExternalLink size={13} /> Open & mark applied
                </button>
              )}
            </div>
            {!profile.email && <span className="w-full text-[11px] text-amber-400/80">Set your Apply profile first (top-right) so the bot can fill the form.</span>}
            {applyMsg && (
              <div className="w-full text-[11.5px]" style={{ color: applyMsg.status === "submitted" ? "#4ade80" : applyMsg.status === "error" ? "#f87171" : "#fbbf24" }}>
                {applyMsg.status === "submitted" ? "✓ " : applyMsg.status === "needs_human" ? "⚠ " : ""}{applyMsg.reason}
                {applyMsg.applyUrl && applyMsg.status !== "submitted" && <> <button onClick={() => goExternal(applyMsg.applyUrl)} className="text-sky-400 hover:underline">open to finish</button></>}
              </div>
            )}
            {!applyMsg && job.applyResult && (
              <div className="w-full text-[11.5px]" style={{ color: job.applyResult.status === "submitted" ? "#4ade80" : job.applyResult.status === "error" ? "#f87171" : job.applyResult.status === "needs_human" ? "#fbbf24" : "#a1a1aa" }}>
                <span className="uppercase tracking-wider text-[10px] text-muted-foreground mr-1.5">last attempt</span>
                {job.applyResult.status === "submitted" ? "✓ " : job.applyResult.status === "needs_human" ? "⚠ " : job.applyResult.status === "error" ? "✗ " : ""}{job.applyResult.reason}
                {job.applyResult.applyUrl && job.applyResult.status !== "submitted" && <> <button onClick={() => goExternal(job.applyResult!.applyUrl)} className="text-sky-400 hover:underline">open to finish</button></>}
                <span className="text-muted-foreground"> · {new Date(job.applyResult.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            )}
            <p className="w-full text-[11px] text-muted-foreground">Auto-apply drives a real browser via your apply-worker (Lever/Greenhouse/Ashby). Captcha'd or unusual forms fall back to "open to finish." Needs the worker running + APPLY_WORKER_URL set on takeover_b2b.</p>
          </div>

          {job.summary && <p className="text-[13px] text-muted-foreground leading-relaxed [overflow-wrap:anywhere]">{job.summary}</p>}
          {job.requirements.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Requirements</div>
              <ul className="list-disc list-inside text-[12.5px] text-foreground/85 space-y-0.5">{job.requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}

          {/* tailor */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-[13px] font-semibold text-foreground">Tailor your resume to this role</div>
              <button onClick={tailor} disabled={tailoring || !masterResume}
                      className="inline-flex items-center gap-2 h-8 px-3 rounded-md bg-primary/90 text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                {tailoring ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}{tailoring ? "Axon is writing…" : t ? "Re-tailor" : "Tailor with Axon"}
              </button>
            </div>
            {!masterResume && <p className="text-[12px] text-amber-400/80">Add your master resume first (top-right).</p>}
            {terr && <p className="text-[12px] text-red-400">{terr}</p>}
            {t && (
              <div className="space-y-4">
                {t.gaps.length > 0 && (
                  <div className="rounded-md border border-amber-600/30 bg-amber-500/[0.06] p-3">
                    <div className="text-[11px] uppercase tracking-wider text-amber-400 mb-1">Gaps to address ({t.gaps.length})</div>
                    <ul className="list-disc list-inside text-[12px] text-amber-100/80 space-y-0.5">{t.gaps.map((g, i) => <li key={i}>{g}</li>)}</ul>
                  </div>
                )}
                {t.keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">{t.keywords.map((k, i) => <span key={i} className="text-[10.5px] px-2 py-0.5 rounded border border-border text-muted-foreground">{k}</span>)}</div>
                )}
                <Section title="Tailored resume" text={t.tailored_resume} pdfName={`Resume - ${job.company}`} />
                <Section title="Cover letter" text={t.cover_letter} pdfName={`Cover Letter - ${job.company}`} />
              </div>
            )}
          </div>

          {/* outreach */}
          <OutreachPanel
            job={{ company: job.company, title: job.title, summary: job.summary, requirements: job.requirements }}
            masterResume={masterResume}
            jobId={job.id}
          />

          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Notes</div>
            <textarea value={job.notes ?? ""} onChange={(e) => onUpdate({ notes: e.target.value })} rows={2}
                      placeholder="Recruiter name, referral, follow-up date…"
                      className="w-full resize-none bg-background border border-border rounded-md px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, text, pdfName }: { title: string; text: string; pdfName?: string }) {
  const [busy, setBusy] = useState(false);
  async function dl() {
    if (busy || !pdfName) return;
    setBusy(true);
    try {
      const { renderResumePdf, downloadBlob, safeFile } = await import("@/JobHunt/resumePdf");
      downloadBlob(await renderResumePdf(text), safeFile(pdfName) + ".pdf");
    } finally { setBusy(false); }
  }
  return (
    <div className="rounded-md border border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{title}</span>
        <div className="flex items-center gap-3">
          {pdfName && (
            <button onClick={dl} disabled={busy} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
            </button>
          )}
          <CopyBtn text={text} />
        </div>
      </div>
      <pre className="px-3 py-3 text-[12px] text-foreground/90 whitespace-pre-wrap [overflow-wrap:anywhere] max-h-[320px] overflow-y-auto" style={{ fontFamily: "inherit" }}>{text}</pre>
    </div>
  );
}

function ResumeModal({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="text-[15px] font-semibold text-foreground">Master resume</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="p-5">
          <p className="text-[12px] text-muted-foreground mb-2">Paste your resume as plain text. Axon uses it to rank matches and to tailor per-job versions. Stored locally on this machine.</p>
          <textarea value={v} onChange={(e) => setV(e.target.value)} rows={16}
                    placeholder="Name · contact\n\nExperience\n- …\n\nSkills · Education"
                    className="w-full resize-none bg-background border border-border rounded-md px-3 py-2 text-[12.5px] text-foreground font-mono focus:outline-none focus:border-primary/50" />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={onClose} className="h-9 px-3 rounded-md border border-border text-[13px] text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={() => onSave(v)} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold">Save resume</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileModal({ value, resume, onSave, onClose }: { value: ApplyProfile; resume: string; onSave: (p: ApplyProfile) => void; onClose: () => void }) {
  const [p, setP] = useState<ApplyProfile>(value.email || value.fullName ? value : { ...value, ...inferProfileFromResume(resume) } as ApplyProfile);
  const set = (k: keyof ApplyProfile, v: any) => setP({ ...p, [k]: v });
  const Text = ({ label, k, ph }: { label: string; k: keyof ApplyProfile; ph?: string }) => (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <input value={String(p[k] ?? "")} onChange={(e) => set(k, e.target.value)} placeholder={ph}
             className="bg-background border border-border rounded-md px-2.5 py-1.5 text-[12.5px] text-foreground focus:outline-none focus:border-primary/50" />
    </label>
  );
  const Check = ({ label, k }: { label: string; k: keyof ApplyProfile }) => (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground cursor-pointer">
      <input type="checkbox" checked={!!p[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
    </label>
  );
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="text-[15px] font-semibold text-foreground">Apply profile</div>
          <div className="flex items-center gap-3">
            <button onClick={() => setP({ ...p, ...inferProfileFromResume(resume) })} className="text-[11.5px] text-sky-400 hover:underline">Prefill from resume</button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>
        </div>
        <div className="p-5">
          <p className="text-[12px] text-muted-foreground mb-3">These are the standard answers ATS forms ask for. Stored locally; reused for every auto-application.</p>
          <div className="grid grid-cols-2 gap-3">
            <Text label="Full name" k="fullName" /><Text label="Email" k="email" />
            <Text label="Phone" k="phone" /><Text label="Location" k="location" ph="San Jose, CA" />
            <Text label="LinkedIn" k="linkedin" /><Text label="GitHub" k="github" />
            <Text label="Portfolio" k="portfolio" /><Text label="Salary expectation" k="salaryExpectation" ph="$160k–$220k" />
            <Text label="How did you hear?" k="howHeard" />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
            <Check label="Authorized to work in the US" k="workAuthorized" />
            <Check label="Requires visa sponsorship" k="needsSponsorship" />
            <Check label="Decline EEO self-identification" k="eeoDecline" />
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="h-9 px-3 rounded-md border border-border text-[13px] text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={() => onSave(p)} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-[13px] font-semibold">Save profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobHuntPage;
