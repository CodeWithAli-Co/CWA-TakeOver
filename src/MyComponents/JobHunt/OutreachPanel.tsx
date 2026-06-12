/**
 * OutreachPanel — the high-yield channel: reach the people who actually decide.
 * Finds the hiring manager + leaders + recruiters for a role, then drafts a
 * short, specific message per contact (direct note, referral ask, or recruiter
 * note) and sends it via Gmail. Replaces the old recruiter-only outreach block.
 */
import { useState } from "react";
import { Loader2, Sparkles, Send, Copy, Check, ExternalLink, Wand2, Mail } from "lucide-react";
import { findHiringContacts, type HiringContact, type ContactKind } from "@/JobHunt/findHiringContacts";
import { draftWarmOutreach, type OutreachMode } from "@/JobHunt/draftWarmOutreach";
import { useSendEmail } from "@/stores/gmail";
import { useJobHunt } from "./jobHuntStore";
import { open as openShell } from "@tauri-apps/plugin-shell";

const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
const goExternal = (u?: string | null) => { if (u) openShell(u).catch(() => { try { window.open(u, "_blank"); } catch { /* */ } }); };

const KIND_LABEL: Record<ContactKind, string> = { hiring_manager: "Hiring manager", leadership: "Leadership", recruiter: "Recruiter", team: "Team" };
const KIND_PILL: Record<ContactKind, string> = {
  hiring_manager: "text-amber-300 border-amber-600/40 bg-amber-500/10",
  leadership: "text-purple-300 border-purple-600/40 bg-purple-500/10",
  recruiter: "text-sky-300 border-sky-600/40 bg-sky-500/10",
  team: "text-zinc-300 border-zinc-600/40 bg-zinc-500/10",
};
const modeFor = (k: ContactKind): OutreachMode => k === "recruiter" ? "recruiter" : k === "team" ? "referral" : "hiring_manager";

export function OutreachPanel({ job, masterResume, jobId }: {
  job: { company: string; title: string; summary?: string | null; requirements?: string[] };
  masterResume: string;
  jobId?: string;
}) {
  const sendEmail = useSendEmail();
  const addOutreach = useJobHunt((s) => s.addOutreach);
  const [finding, setFinding] = useState(false);
  const [contacts, setContacts] = useState<HiringContact[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [to, setTo] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  async function find() {
    if (finding) return;
    setFinding(true); setErr(null); setNote(null); setContacts(null);
    const r = await findHiringContacts({ company: job.company, title: job.title });
    setFinding(false);
    if (r.error) { setErr(r.error); return; }
    setContacts(r.contacts);
    if (r.note) setNote(r.note);
    if (r.contacts.length === 0 && !r.note) setNote("No concrete contacts found — try the company's leadership/about page or LinkedIn.");
  }

  async function draftFor(c: HiringContact, idx: number) {
    if (drafting) return;
    setActiveIdx(idx); setDrafting(true); setDraft(null); setSent(false); setErr(null);
    setTo(c.email ?? "");
    const r = await draftWarmOutreach({
      resume: masterResume,
      job: { company: job.company, title: job.title, summary: job.summary, requirements: job.requirements },
      contact: { name: c.name, title: c.title, angle: c.outreach_angle },
      mode: modeFor(c.kind),
    });
    setDrafting(false);
    if (r.error) { setErr(r.error); return; }
    setDraft({ subject: r.subject, body: r.body });
  }

  async function send() {
    if (!draft || !to.includes("@")) return;
    setErr(null);
    try {
      await sendEmail.mutateAsync({ to, subject: draft.subject, body: draft.body } as any);
      setSent(true);
      const c = activeIdx != null && contacts ? contacts[activeIdx] : null;
      addOutreach({ jobId, company: job.company, role: job.title, contactName: c?.name ?? null, contactEmail: to, contactKind: c?.kind ?? "team", channel: "email", subject: draft.subject });
    } catch (e: any) { setErr(e?.message || "Send failed — is Gmail connected?"); }
  }

  return (
    <div className="border-t border-border pt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5"><Mail size={14} /> Reach the right people</div>
        <button onClick={find} disabled={finding}
          className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border text-[12px] text-foreground disabled:opacity-50 hover:border-foreground/30">
          {finding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}{finding ? "Searching…" : contacts ? "Re-find" : "Find contacts"}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Referrals and direct hiring-manager notes convert far better than cold applications. This finds the decision-makers and drafts a specific message.</p>

      {err && <p className="text-[12px] text-red-400 mb-2">{err}</p>}
      {note && <p className="text-[12px] text-amber-400/80 mb-2">{note}</p>}

      {contacts && contacts.length > 0 && (
        <div className="space-y-2">
          {contacts.map((c, i) => (
            <div key={i} className={`rounded-md border bg-background p-3 ${activeIdx === i ? "border-foreground/30" : "border-border"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${KIND_PILL[c.kind]}`} style={{ fontFamily: FONT_MONO }}>{KIND_LABEL[c.kind]}</span>
                    <span className="text-[13px] font-semibold text-foreground truncate">{c.name || "—"}</span>
                    {c.title && <span className="text-[11.5px] text-muted-foreground truncate">· {c.title}</span>}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground mt-1 [overflow-wrap:anywhere]">{c.rationale}</div>
                  {c.outreach_angle && <div className="text-[11px] text-emerald-400/80 mt-1 [overflow-wrap:anywhere]">↳ {c.outreach_angle}</div>}
                  <div className="flex items-center gap-3 mt-1.5">
                    {c.email && <span className="text-[11px] text-sky-400" style={{ fontFamily: FONT_MONO }}>{c.email}</span>}
                    {c.linkedin && <button onClick={() => goExternal(c.linkedin)} className="text-[11px] text-sky-400 hover:underline inline-flex items-center gap-1">LinkedIn <ExternalLink size={10} /></button>}
                    {c.source_label && <span className="text-[10.5px] text-muted-foreground">{c.source_label}</span>}
                  </div>
                </div>
                <button onClick={() => draftFor(c, i)} disabled={drafting || !masterResume}
                  className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary/90 text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                  {drafting && activeIdx === i ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}Draft
                </button>
              </div>

              {activeIdx === i && draft && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    className="w-full bg-card border border-border rounded-md px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/50" placeholder="Subject" />
                  <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={7}
                    className="w-full resize-none bg-card border border-border rounded-md px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/50" />
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={c.email ? "" : "their email (find on LinkedIn / company site)"}
                      className="flex-1 min-w-[160px] bg-card border border-border rounded-md px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/50" />
                    <button onClick={() => { navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-md border border-border text-[12px] text-muted-foreground hover:text-foreground">
                      {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
                    </button>
                    <button onClick={send} disabled={!to.includes("@") || sendEmail.isPending}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                      {sendEmail.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send via Gmail
                    </button>
                  </div>
                  {sent && <p className="text-[12px] text-emerald-400">Sent ✓</p>}
                  {!c.email && <p className="text-[10.5px] text-muted-foreground">No email found for {c.name || "this person"} — grab it from their LinkedIn / the company site, or send the message as a LinkedIn note.</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OutreachPanel;
