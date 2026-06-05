/**
 * ComposeEmailModal — standalone compose window for sending an email
 * to anyone, untethered from any deal or contact.
 *
 * Distinct from DraftEmailModal in three ways:
 *   · No deal context — no Claude drafting, no activity logging.
 *   · To: starts empty (no contact to default from).
 *   · Mounts wherever the operator opens it from — Inbox page header,
 *     Cmd+K verb, etc. Single shared modal, single Send path.
 *
 * Same useSendEmail() hook as DealAiStrip, so token refresh + retry
 * logic on the server side applies identically.
 */

import { useState } from "react";
import { Send, Check, AlertCircle, X, Mail } from "lucide-react";
import { useSendEmail, useGmailConnection } from "@/stores/gmail";

const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";

interface ComposeEmailModalProps {
  /** Optional pre-filled "To" — handy if a future caller passes a
   *  contact's email through. Defaults to empty. */
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  /** Reply context. When set, this send routes through the same
   *  Gmail thread so replies group correctly on both ends.
   *  Server uses it as the Gmail `threadId` parameter. */
  threadId?: string;
  /** Optional — when present, log the reply against this deal so
   *  the activity timeline shows it next to the original inbound. */
  dealId?: string;
  contactId?: string;
  /** Label override for the modal header. Defaults to "New email";
   *  reply flow passes "Reply". */
  mode?: "compose" | "reply";
  onClose: () => void;
}

export const ComposeEmailModal: React.FC<ComposeEmailModalProps> = ({
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  threadId,
  dealId,
  contactId,
  mode = "compose",
  onClose,
}) => {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sentInfo, setSentInfo] = useState<{ gmail_id: string } | null>(null);

  const { data: connection } = useGmailConnection();
  const sendEmail = useSendEmail();

  const handleSend = async () => {
    setSendError(null);
    try {
      const result = await sendEmail.mutateAsync({
        to,
        subject,
        body,
        // Pass through reply context when present so the server logs
        // the activity against the deal/contact AND threads on Gmail.
        deal_id: dealId,
        contact_id: contactId,
        thread_id: threadId,
      });
      setSentInfo({ gmail_id: result.gmail_id });
      window.setTimeout(onClose, 1200);
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e));
    }
  };

  const canSend =
    !!connection &&
    to.includes("@") &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    !sendEmail.isPending &&
    !sentInfo;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[6vh] px-4">
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-[640px] max-h-[88vh] flex flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
          <div>
            <p className={eyebrow}>{mode === "reply" ? "Reply" : "Compose"}</p>
            <h2
              className="text-[20px] text-zinc-100 leading-tight mt-0.5"
              style={{ fontFamily: "Newsreader, Georgia, serif" }}
            >
              {mode === "reply" ? "Reply" : "New email"}
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
          {/* Not-connected callout — if Gmail isn't connected, the
              fields render but Send is locked. Surface a clear hint. */}
          {!connection && (
            <div className="border border-amber-500/30 bg-amber-500/[0.04] rounded-lg p-3 flex items-start gap-2 text-[12px] text-amber-200">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Connect Gmail in <strong>Settings → Connectors</strong> before
                you can send.
              </span>
            </div>
          )}

          {/* To */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
              To
            </p>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@company.com"
              className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-emerald-500/30 placeholder:text-zinc-600"
            />
          </div>

          {/* Subject */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
              Subject
            </p>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What's this about?"
              className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-emerald-500/30 placeholder:text-zinc-600"
            />
          </div>

          {/* Body */}
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
              Body
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              placeholder="Write your email here. Plain text only for v1 — formatting and attachments are on the roadmap."
              className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-emerald-500/30 leading-relaxed resize-none placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Error / success surfaces */}
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
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            <Mail className="h-3 w-3" />
            {connection ? `via ${connection.email}` : "Gmail not connected"}
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            title={
              !connection
                ? "Connect Gmail first"
                : !to.includes("@")
                ? "Enter a valid recipient"
                : !subject.trim()
                ? "Add a subject"
                : !body.trim()
                ? "Write a body"
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
  );
};

export default ComposeEmailModal;
