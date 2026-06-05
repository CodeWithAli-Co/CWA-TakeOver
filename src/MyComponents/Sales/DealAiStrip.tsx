/**
 * DealAiStrip — two AI buttons that live inside the deal drawer.
 *
 *   · Summarize — single-shot Claude call. Reads the deal context
 *     + activity history and writes a one-paragraph status. Shows
 *     inline with copy + regenerate + dismiss controls.
 *
 *   · Draft email — opens DraftEmailModal where the operator types
 *     intent ("nudge them about legal review") and gets back a
 *     full subject + body Claude has drafted with the deal context
 *     as background. Editable; copy each or both; Send is a stub
 *     until the email-integration arc lands.
 *
 * Layout sits between the form fields and the activity timeline in
 * the deal drawer. Quiet by default — a single row of two pills.
 */

import { useState } from "react";
import {
  Sparkles, Mail, Copy, RefreshCw, X, AlertCircle, Send, Check,
} from "lucide-react";
import {
  summarizeDeal,
  draftDealEmail,
  type DraftEmailResult,
} from "./salesAi";
import type {
  CrmDeal,
  CrmActivity,
  CrmContact,
  CrmCompany,
} from "@/stores/crm";
import { useSendEmail, useGmailConnection } from "@/stores/gmail";

interface DealAiContext {
  deal: CrmDeal;
  activities: CrmActivity[];
  contact: CrmContact | null;
  company: CrmCompany | null;
}

const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";

export const DealAiStrip: React.FC<DealAiContext> = (ctx) => {
  const [summaryState, setSummaryState] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; text: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const [emailOpen, setEmailOpen] = useState(false);

  const runSummary = async () => {
    setSummaryState({ kind: "loading" });
    const res = await summarizeDeal(ctx);
    if (res.ok && res.summary) setSummaryState({ kind: "ok", text: res.summary });
    else setSummaryState({ kind: "error", message: res.error ?? "Failed." });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between mb-1">
        <div>
          <p className={eyebrow}>Assist</p>
          <h3 className="ed-serif text-[18px] mt-0.5 text-zinc-100">AI</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runSummary}
            disabled={summaryState.kind === "loading"}
            className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Generate a one-paragraph status for this deal"
          >
            <Sparkles className="h-3 w-3" />
            {summaryState.kind === "loading" ? "Summarizing…" : "Summarize"}
          </button>
          <button
            type="button"
            onClick={() => setEmailOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-md transition-colors"
            title="Draft an email for this deal with Claude"
          >
            <Mail className="h-3 w-3" />
            Draft email
          </button>
        </div>
      </div>

      {/* Summary card — only renders when there's something to show. */}
      {summaryState.kind === "loading" && (
        <div className="border border-white/[0.06] rounded-lg p-3 text-[12px] text-zinc-500 italic">
          Reading {ctx.activities.length} activit{ctx.activities.length === 1 ? "y" : "ies"} + deal context…
        </div>
      )}
      {summaryState.kind === "error" && (
        <div className="border border-amber-500/30 bg-amber-500/[0.04] rounded-lg p-3 flex items-start gap-2 text-[12px] text-amber-200">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="flex-1">{summaryState.message}</span>
          <button
            type="button"
            onClick={() => setSummaryState({ kind: "idle" })}
            className="text-amber-300/70 hover:text-amber-100 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {summaryState.kind === "ok" && (
        <SummaryCard
          text={summaryState.text}
          onRegenerate={runSummary}
          onDismiss={() => setSummaryState({ kind: "idle" })}
        />
      )}

      {emailOpen && (
        <DraftEmailModal
          ctx={ctx}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </section>
  );
};

// ────────────────────────────────────────────────
// SummaryCard — renders the Claude paragraph with copy / regenerate
// / dismiss controls. Kept small enough to live inline in the drawer
// without its own modal.
// ────────────────────────────────────────────────
const SummaryCard: React.FC<{
  text: string;
  onRegenerate: () => void;
  onDismiss: () => void;
}> = ({ text, onRegenerate, onDismiss }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.warn("[DealAiStrip] copy failed:", e);
    }
  };

  return (
    <div className="border border-emerald-500/20 bg-emerald-500/[0.02] rounded-lg p-3.5 space-y-2.5">
      <p className="text-[12.5px] text-zinc-200 leading-relaxed whitespace-pre-wrap">
        {text}
      </p>
      <div className="flex items-center justify-between border-t border-white/[0.04] pt-2">
        <span className="text-[9.5px] font-mono uppercase tracking-[0.16em] text-emerald-400/70">
          Claude · summary
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-emerald-300 transition-colors"
          >
            {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onRegenerate}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-emerald-300 transition-colors"
          >
            <RefreshCw className="h-2.5 w-2.5" />
            Regen
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-rose-300 transition-colors"
          >
            <X className="h-2.5 w-2.5" />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// DraftEmailModal — full-screen overlay with intent input, generate
// button, and editable subject + body once Claude returns.
//
// Copy buttons let the rep paste into Gmail/Outlook today. The
// "Send" button is stubbed and surfaces a disabled tooltip until
// the email-integration task lands a real send path.
// ────────────────────────────────────────────────
const DraftEmailModal: React.FC<{
  ctx: DealAiContext;
  onClose: () => void;
}> = ({ ctx, onClose }) => {
  const [intent, setIntent] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DraftEmailResult | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // Default the To: line to the contact attached to this deal. The
  // operator can still edit it (e.g. CC a champion's boss) before
  // sending. Some deals have no contact — in that case To: starts
  // empty and the operator types it in.
  const contactEmail = (ctx.contact as { email?: string } | null)?.email ?? "";
  const [to, setTo] = useState(contactEmail);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentInfo, setSentInfo] = useState<{ gmail_id: string } | null>(null);

  // Need the Gmail connection state to gate Send + show a friendly
  // message if the operator hasn't connected yet.
  const { data: connection } = useGmailConnection();
  const sendEmail = useSendEmail();

  const run = async () => {
    setBusy(true);
    const res = await draftDealEmail({ ...ctx, intent });
    setBusy(false);
    setResult(res);
    if (res.ok) {
      setSubject(res.subject ?? "");
      setBody(res.body ?? "");
    }
  };

  const handleSend = async () => {
    setSendError(null);
    try {
      const result = await sendEmail.mutateAsync({
        to,
        subject,
        body,
        deal_id: ctx.deal.id,
        contact_id: ctx.contact?.id,
      });
      setSentInfo({ gmail_id: result.gmail_id });
      // Brief delay so the operator sees the success state before
      // the modal evaporates.
      window.setTimeout(onClose, 1200);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    } catch (e) {
      console.warn("[DraftEmailModal] copy failed:", e);
    }
  };

  // Send button is enabled only when we have all the pieces: a
  // connection, a valid-looking To: address, and a drafted body.
  const canSend =
    !!connection &&
    to.includes("@") &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    !sendEmail.isPending &&
    !sentInfo;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[6vh] px-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-[640px] max-h-[88vh] flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
          <div>
            <p className={eyebrow}>Draft email</p>
            <h2
              className="text-[20px] text-zinc-100 leading-tight mt-0.5"
              style={{ fontFamily: "Newsreader, Georgia, serif" }}
            >
              {ctx.deal.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {/* To: recipient */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
              To
            </p>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder={contactEmail || "name@company.com"}
              className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-emerald-500/30 placeholder:text-zinc-600"
            />
          </div>

          {/* Intent input */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
              What should this email do?
            </p>
            <textarea
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              rows={3}
              placeholder="e.g. nudge them about the MSA redlines and confirm next-week close, or recap yesterday's call and send pricing"
              className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-emerald-500/30 placeholder:text-zinc-600 resize-none leading-relaxed"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                {ctx.activities.length} activit{ctx.activities.length === 1 ? "y" : "ies"} in context
              </span>
              <button
                type="button"
                onClick={run}
                disabled={!intent.trim() || busy}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] text-[11px] font-mono uppercase tracking-wider text-emerald-200 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-3 w-3" />
                {busy ? "Drafting…" : result?.ok ? "Regenerate" : "Generate"}
              </button>
            </div>
          </div>

          {/* Error */}
          {result && !result.ok && (
            <div className="border border-amber-500/30 bg-amber-500/[0.04] rounded-lg p-3 flex items-start gap-2 text-[12px] text-amber-200">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{result.error}</span>
            </div>
          )}

          {/* Drafted email — editable */}
          {result?.ok && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                    Subject
                  </p>
                  <FieldCopy text={subject} />
                </div>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-emerald-500/30"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                    Body
                  </p>
                  <FieldCopy text={body} />
                </div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-emerald-500/30 leading-relaxed resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Send error + success surfaces — render above the footer
            so the operator sees feedback inline. */}
        {sendError && (
          <div className="mx-5 mb-2 border border-amber-500/30 bg-amber-500/[0.04] rounded-lg p-3 flex items-start gap-2 text-[12px] text-amber-200">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="flex-1">{sendError}</span>
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="text-amber-300/70 hover:text-amber-100 transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {sentInfo && (
          <div className="mx-5 mb-2 border border-emerald-500/30 bg-emerald-500/[0.06] rounded-lg p-3 flex items-center gap-2 text-[12px] text-emerald-200">
            <Check className="h-3.5 w-3.5 shrink-0" />
            <span>Sent. Check your Gmail Sent folder to confirm.</span>
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3 bg-black/30">
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            {connection
              ? `via ${connection.email}`
              : "Connect Gmail in Settings → Connectors to send"}
          </span>
          <div className="flex items-center gap-2">
            {result?.ok && (
              <button
                type="button"
                onClick={copyAll}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.1] hover:border-white/[0.2] text-[11px] font-mono uppercase tracking-wider text-zinc-300 hover:text-zinc-100 rounded-md transition-colors"
              >
                <Copy className="h-3 w-3" />
                Copy email
              </button>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              title={
                !connection
                  ? "Connect Gmail first"
                  : !to.includes("@")
                  ? "Enter a valid To: email address"
                  : !subject.trim() || !body.trim()
                  ? "Generate a draft first"
                  : sendEmail.isPending
                  ? "Sending…"
                  : sentInfo
                  ? "Sent"
                  : "Send via Gmail"
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.16] text-emerald-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/[0.08]"
            >
              {sentInfo ? (
                <>
                  <Check className="h-3 w-3" />
                  Sent
                </>
              ) : sendEmail.isPending ? (
                <>
                  <Send className="h-3 w-3 animate-pulse" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────
// FieldCopy — tiny inline copy button used per field in the modal.
// ────────────────────────────────────────────────
const FieldCopy: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch { /* noop */ }
      }}
      className="flex items-center gap-1 text-[9.5px] font-mono uppercase tracking-wider text-zinc-500 hover:text-emerald-300 transition-colors"
    >
      {copied ? <Check className="h-2.5 w-2.5" /> : <Copy className="h-2.5 w-2.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
};
