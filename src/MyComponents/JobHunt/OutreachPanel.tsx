/**
 * OutreachPanel — the high-yield channels in one place:
 *   1. WARM INTROS — people you've already corresponded with at the company
 *      (read from your Gmail, headers only). A referral converts ~10x a cold app.
 *   2. RIGHT PEOPLE — the hiring manager + leaders + recruiters, found via web.
 * Pick a person, draft a specific message, send via Gmail. Every send is logged
 * into the Outreach funnel for follow-up.
 */
import { useState } from "react";
import { Loader2, Sparkles, Send, Copy, Check, ExternalLink, Wand2, Mail, Users } from "lucide-react";
import { findHiringContacts, type HiringContact, type ContactKind } from "@/JobHunt/findHiringContacts";
import { draftWarmOutreach, type OutreachMode } from "@/JobHunt/draftWarmOutreach";
import { useSendEmail, useFindKnownContacts, type KnownContact } from "@/stores/gmail";
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
const guessDomain = (c: string) =>
  c.toLowerCase().replace(/\b(inc|llc|ltd|corp|co|company|the)\b/g, "").replace(/[^a-z0-9]/g, "") + ".com";
const daysAgo = (ms: number) => { const d = Math.floor((Date.now() - ms) / 86400000); return d <= 0 ? "today" : d === 1 ? "1d ago" : d < 60 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`; };

export function OutreachPanel({ job, masterResume, jobId }: {
  job: { company: string; title: string; summary?: string | null; requirements?: string[] };
  masterResume: string;
  jobId?: string;
}) {
  const sendEmail = useSendEmail();
  const addOutreach = useJobHunt((s) => s.addOutreach);
  const findKnown = useFindKnownContacts();

  // warm intros (gmail)
  const [domain, setDomain] = useState(guessDomain(job.company));
  const [known, setKnown] = useState<KnownContact[] | null>(null);
  const [knownErr, setKnownErr] = useState<string | null>(null);

  // hiring contacts (web)
  const [finding, setFinding] = useState(false);
  const [contacts, setContacts] = useState<HiringContact[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // shared composer
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [to, setTo] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [meta, setMeta] = useState<{ name: string | null; email: string; kind: string } | null>(null);

  async function searchKnown() {
    setKnownErr(null); setKnown(null);
    try { setKnown(await findKnown.mutateAsync(domain)); }
    catch (e: any) { setKnownErr(e?.message || "Gmail search failed — is Gmail connected?"); }
  }
  async function findPeople() {
    if (finding) return;
    setFinding(true); setErr(null); setNote(null); setContacts(null);
    const r = await findHiringContacts({ company: job.company, title: job.title });
    setFinding(false);
    if (r.error) { setErr(r.error); return; }
    setContacts(r.contacts);
    if (r.note || r.contacts.length === 0) setNote(r.note || "No concrete contacts found — try the company's leadership/about page or LinkedIn.");
  }

  async function startDraft(key: string, c: { name: string | null; title?: string | null; angle?: string | null; email?: string; kind: string }, mode: OutreachMode) {
    if (drafting) return;
    setActiveKey(key); setDrafting(true); setDraft(null); setSent(false); setErr(null);
    setTo(c.email ?? "");
    setMeta({ name: c.name, email: c.email ?? "", kind: c.kind });
    const r = await draftWarmOutreach({
      resume: masterResume,
      job: { company: job.company, title: job.title, summary: job.summary, requirements: job.requirements },
      contact: { name: c.name, title: c.title, angle: c.angle },
      mode,
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
      addOutreach({ jobId, company: job.company, role: job.title, contactName: meta?.name ?? null, contactEmail: to, contactKind: meta?.kind ?? "team", channel: "email", subject: draft.subject });
    } catch (e: any) { setErr(e?.message || "Send failed — is Gmail connected?"); }
  }

  function Composer({ k }: { k: string }) {
    if (activeKey !== k || !draft) return null;
    return (
      <div className="mt-3 space-y-2 border-t border-border pt-3">
        <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          className="w-full bg-card border border-border rounded-md px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/50" placeholder="Subject" />
        <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={7}
          className="w-full resize-none bg-card border border-border rounded-md px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/50" />
        <div className="flex flex-wrap items-center gap-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="their email"
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
        {sent && <p className="text-[12px] text-emerald-400">Sent ✓ — logged to your Outreach funnel.</p>}
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-4 space-y-5">
      {/* WARM INTROS */}
      <div>
        <div className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5 mb-1.5"><Users size={14} /> People you already know here</div>
        <p className="text-[11px] text-muted-foreground mb-2">Searches your Gmail for anyone you've corresponded with at this company. A warm intro beats a cold application many times over.</p>
        <div className="flex items-center gap-2 mb-2">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="company.com"
            className="w-44 bg-background border border-border rounded-md px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/50" style={{ fontFamily: FONT_MONO }} />
          <button onClick={searchKnown} disabled={findKnown.isPending || !domain.includes(".")}
            className="inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border text-[12px] text-foreground disabled:opacity-50 hover:border-foreground/30">
            {findKnown.isPending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Search my Gmail
          </button>
        </div>
        {knownErr && <p className="text-[12px] text-red-400">{knownErr}</p>}
        {known && known.length === 0 && <p className="text-[12px] text-amber-400/80">No contacts found at {domain}. Try a different domain, or check the “Right people” below.</p>}
        {known && known.length > 0 && (
          <div className="space-y-2">
            {known.map((c) => (
              <div key={c.email} className={`rounded-md border bg-background p-3 ${activeKey === `known:${c.email}` ? "border-foreground/30" : "border-border"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border text-emerald-300 border-emerald-600/40 bg-emerald-500/10" style={{ fontFamily: FONT_MONO }}>Warm</span>
                      <span className="text-[13px] font-semibold text-foreground truncate">{c.name || c.email}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5" style={{ fontFamily: FONT_MONO }}>{c.email} · {c.count} exchange{c.count === 1 ? "" : "s"} · last {daysAgo(c.lastDate)}</div>
                  </div>
                  <button onClick={() => startDraft(`known:${c.email}`, { name: c.name || null, email: c.email, kind: "team" }, "referral")} disabled={drafting || !masterResume}
                    className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary/90 text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                    {drafting && activeKey === `known:${c.email}` ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}Intro
                  </button>
                </div>
                <Composer k={`known:${c.email}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT PEOPLE */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="text-[13px] font-semibold text-foreground inline-flex items-center gap-1.5"><Mail size={14} /> Reach the right people</div>
          <button onClick={findPeople} disabled={finding}
            className="inline-flex items-center gap-2 h-8 px-3 rounded-md border border-border text-[12px] text-foreground disabled:opacity-50 hover:border-foreground/30">
            {finding ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}{finding ? "Searching…" : contacts ? "Re-find" : "Find contacts"}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-2">Finds the hiring manager + leaders + recruiters and drafts a specific note to each.</p>
        {err && <p className="text-[12px] text-red-400 mb-1">{err}</p>}
        {note && <p className="text-[12px] text-amber-400/80 mb-1">{note}</p>}
        {contacts && contacts.length > 0 && (
          <div className="space-y-2">
            {contacts.map((c, i) => (
              <div key={i} className={`rounded-md border bg-background p-3 ${activeKey === `hire:${i}` ? "border-foreground/30" : "border-border"}`}>
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
                  <button onClick={() => startDraft(`hire:${i}`, { name: c.name, title: c.title, angle: c.outreach_angle, email: c.email ?? undefined, kind: c.kind }, modeFor(c.kind))} disabled={drafting || !masterResume}
                    className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary/90 text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                    {drafting && activeKey === `hire:${i}` ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}Draft
                  </button>
                </div>
                <Composer k={`hire:${i}`} />
                {activeKey === `hire:${i}` && draft && !c.email && <p className="text-[10.5px] text-muted-foreground mt-1">No email for {c.name || "this person"} — grab it from LinkedIn / the company site, or send as a LinkedIn note.</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OutreachPanel;
