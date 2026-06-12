/**
 * OutreachTab — the response funnel + follow-up engine. Turns "messages sent"
 * into "interviews landed": tracks every outreach, surfaces the ones that have
 * gone quiet past the window, drafts a nudge, and shows the conversion funnel
 * so you can see what actually gets replies.
 */
import { useState } from "react";
import { Loader2, Wand2, Send, Trash2, Mail } from "lucide-react";
import { useJobHunt, needsFollowUp, type OutreachRecord, type OutreachStatus } from "./jobHuntStore";
import { draftWarmOutreach } from "@/JobHunt/draftWarmOutreach";
import { useSendEmail } from "@/stores/gmail";

const FONT_DISPLAY = 'Newsreader, Georgia, serif';
const FONT_UI = '"Hanken Grotesk", Inter, system-ui, sans-serif';
const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';
const ACCENT = "#e0503c";

const STATUSES: OutreachStatus[] = ["sent", "followed_up", "replied", "interview", "no_response", "closed"];
const STATUS_LABEL: Record<OutreachStatus, string> = {
  sent: "Sent", followed_up: "Followed up", replied: "Replied", interview: "Interview", no_response: "No reply", closed: "Closed",
};
const STATUS_PILL: Record<OutreachStatus, string> = {
  sent: "text-zinc-300 border-zinc-600/40 bg-zinc-500/10",
  followed_up: "text-sky-300 border-sky-600/40 bg-sky-500/10",
  replied: "text-emerald-300 border-emerald-600/40 bg-emerald-500/10",
  interview: "text-amber-300 border-amber-600/40 bg-amber-500/10",
  no_response: "text-zinc-400 border-zinc-700/40 bg-zinc-500/5",
  closed: "text-zinc-400 border-zinc-700/40 bg-zinc-500/5",
};
const daysSince = (ts: number) => Math.floor((Date.now() - ts) / 86400000);

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT }} />
      <span className="text-[10px] uppercase tracking-[0.2em] text-fg-subtle" style={{ fontFamily: FONT_MONO }}>{children}</span>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-2 border border-line rounded-lg p-4">
      <div className="text-[24px] text-foreground tabular-nums leading-none" style={{ fontFamily: FONT_MONO }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle mt-1.5" style={{ fontFamily: FONT_MONO }}>{label}</div>
    </div>
  );
}

export function OutreachTab({ masterResume }: { masterResume: string }) {
  const outreach = useJobHunt((s) => s.outreach);
  const updateOutreach = useJobHunt((s) => s.updateOutreach);
  const removeOutreach = useJobHunt((s) => s.removeOutreach);
  const sendEmail = useSendEmail();

  const [draftId, setDraftId] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [to, setTo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  const replied = outreach.filter((o) => o.status === "replied" || o.status === "interview").length;
  const interviews = outreach.filter((o) => o.status === "interview").length;
  const replyRate = outreach.length ? Math.round((replied / outreach.length) * 100) : 0;
  const due = outreach.filter(needsFollowUp);

  async function startFollowUp(o: OutreachRecord) {
    setDraftId(o.id); setDrafting(true); setDraft(null); setErr(null); setSentId(null);
    setTo(o.contactEmail ?? "");
    const r = await draftWarmOutreach({
      resume: masterResume,
      job: { company: o.company, title: o.role || "" },
      contact: { name: o.contactName },
      mode: "follow_up",
    });
    setDrafting(false);
    if (r.error) { setErr(r.error); return; }
    setDraft({ subject: r.subject, body: r.body });
  }
  async function sendFollowUp(o: OutreachRecord) {
    if (!draft || !to.includes("@")) return;
    setErr(null);
    try {
      await sendEmail.mutateAsync({ to, subject: draft.subject, body: draft.body } as any);
      updateOutreach(o.id, { status: "followed_up", followUps: o.followUps + 1, lastTouchAt: Date.now() });
      setSentId(o.id); setDraftId(null); setDraft(null);
    } catch (e: any) { setErr(e?.message || "Send failed — is Gmail connected?"); }
  }

  return (
    <div className="space-y-5" style={{ fontFamily: FONT_UI }}>
      {/* funnel */}
      <div className="bg-surface border border-line rounded-xl p-4 md:p-5 space-y-4">
        <SectionLabel>Funnel</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Outreached" value={outreach.length} />
          <Stat label="Replied" value={replied} />
          <Stat label="Interviews" value={interviews} />
          <Stat label="Reply rate" value={`${replyRate}%`} />
        </div>
      </div>

      {/* needs follow-up */}
      <div className="bg-surface border border-line rounded-xl p-4 md:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <SectionLabel>Needs follow-up</SectionLabel>
          <span className="text-[11px] text-fg-subtle" style={{ fontFamily: FONT_MONO }}>{due.length} due</span>
        </div>
        {err && <p className="text-[12px] text-red-400">{err}</p>}
        {due.length === 0 ? (
          <p className="text-[12.5px] text-fg-subtle">Nothing waiting on a nudge. Replies and recent sends won't show here.</p>
        ) : (
          <div className="space-y-2">
            {due.map((o) => (
              <div key={o.id} className="bg-surface-2 border border-line rounded-lg p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] text-foreground" style={{ fontFamily: FONT_DISPLAY, fontWeight: 500 }}>{o.role || "—"}</div>
                    <div className="text-[12px] text-fg-muted truncate">{o.company}{o.contactName ? ` · ${o.contactName}` : ""}</div>
                    <div className="text-[10.5px] text-amber-400/80 mt-1" style={{ fontFamily: FONT_MONO }}>{daysSince(o.lastTouchAt)}d quiet · {o.followUps} follow-up{o.followUps === 1 ? "" : "s"} sent</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => startFollowUp(o)} disabled={drafting || !masterResume}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary/90 text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                      {drafting && draftId === o.id ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}Follow up
                    </button>
                    <button onClick={() => updateOutreach(o.id, { status: "replied", lastTouchAt: Date.now() })} title="Mark replied"
                      className="h-8 px-2.5 rounded-md border border-line text-[11px] text-emerald-300 hover:bg-emerald-500/10">Replied</button>
                    <button onClick={() => updateOutreach(o.id, { status: "no_response" })} title="Mark no reply"
                      className="h-8 px-2.5 rounded-md border border-line text-[11px] text-fg-subtle hover:text-foreground">No reply</button>
                  </div>
                </div>
                {draftId === o.id && draft && (
                  <div className="mt-3 space-y-2 border-t border-line pt-3">
                    <input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                      className="w-full bg-background border border-line rounded-md px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-foreground/30" placeholder="Subject" />
                    <textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={6}
                      className="w-full resize-none bg-background border border-line rounded-md px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-foreground/30" />
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="their email"
                        className="flex-1 min-w-[160px] bg-background border border-line rounded-md px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-foreground/30" style={{ fontFamily: FONT_MONO }} />
                      <button onClick={() => sendFollowUp(o)} disabled={!to.includes("@") || sendEmail.isPending}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold disabled:opacity-50">
                        {sendEmail.isPending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send follow-up
                      </button>
                    </div>
                  </div>
                )}
                {sentId === o.id && <p className="text-[12px] text-emerald-400 mt-2">Follow-up sent ✓</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* all outreach */}
      <div className="bg-surface border border-line rounded-xl p-4 md:p-5 space-y-3">
        <SectionLabel>All outreach</SectionLabel>
        {outreach.length === 0 ? (
          <p className="text-[12.5px] text-fg-subtle">No outreach yet. Open a role → “Reach the right people” → draft and send. It’ll show up here.</p>
        ) : (
          <div className="space-y-1.5">
            {outreach.map((o) => (
              <div key={o.id} className="flex items-center gap-3 bg-surface-2 border border-line rounded-lg px-3.5 py-2.5">
                <Mail size={14} className="text-fg-subtle shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-foreground truncate">{o.role || "—"} <span className="text-fg-subtle">· {o.company}</span></div>
                  <div className="text-[11px] text-fg-subtle truncate" style={{ fontFamily: FONT_MONO }}>{o.contactName || "—"} · {new Date(o.sentAt).toLocaleDateString([], { month: "short", day: "numeric" })}</div>
                </div>
                <span className={`hidden sm:inline text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_PILL[o.status]}`} style={{ fontFamily: FONT_MONO }}>{STATUS_LABEL[o.status]}</span>
                <select value={o.status} onChange={(e) => updateOutreach(o.id, { status: e.target.value as OutreachStatus, lastTouchAt: Date.now() })}
                  className="h-8 px-2 rounded-md bg-background border border-line text-[11.5px] text-foreground shrink-0">
                  {STATUSES.map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
                </select>
                <button onClick={() => removeOutreach(o.id)} className="text-fg-subtle hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default OutreachTab;
