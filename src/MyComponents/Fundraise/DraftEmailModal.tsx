/**
 * DraftEmailModal.tsx — Phase 2's central piece.
 *
 * Opens from a partner row in the InvestorDrawer's Partners tab.
 * Calls Axon to draft a cold outreach, lets the operator edit, and
 * sends via Gmail (or copies to clipboard for LinkedIn).
 *
 * Flow:
 *   1. Mounts with a loading skeleton + immediately fires
 *      draftInvestorEmail() with the chosen channel + angle.
 *   2. Renders the draft in editable fields (subject + body for
 *      email, body-only for LinkedIn).
 *   3. Right rail shows: hook Axon used, angle, regenerate-with-
 *      different-angle picker. Operator can sanity-check Axon's
 *      reasoning before sending.
 *   4. Send / Copy CTA at bottom. On email send: Gmail thread id +
 *      activity row are created server-side; we trigger pipeline-
 *      bump via the onSent callback (drawer wires it).
 *
 * Architectural notes:
 *   · We don't store the draft anywhere persistent. Regenerate +
 *     send-or-discard is the only flow. This is intentional — saved
 *     drafts in CRMs become a graveyard that the operator never
 *     revisits.
 *   · For LinkedIn we cap the body at 300 chars (LinkedIn's invite
 *     limit) in the prompt; the modal also shows a live char count
 *     so the operator knows if they edit past it.
 *   · Voice settings (from fundraise_settings) are read here, not
 *     inside the draft action, so the action stays pure.
 */

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Send,
  Copy,
  RefreshCcw,
  Sparkles,
  AlertCircle,
  Check,
  Mail,
  Linkedin,
} from "lucide-react";

import { useMyFundraiseSettings } from "@/stores/fundraiseSettings";
import { useSendEmail, useGmailAliases } from "@/stores/gmail";
import type { InvestorDetail } from "@/stores/investors";
import {
  draftInvestorEmail,
  type DraftAngle,
  type DraftChannel,
  type DraftInvestorEmailResult,
} from "@/Fundraise/draftInvestorEmail";

// ─────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  /** Full investor detail (we need partners + thesis + portfolio
   *  to draft well; the drawer already has this loaded). */
  investor: InvestorDetail | null;
  /** Which partner to address. */
  partnerId: string | null;
  /** Email or LinkedIn DM. */
  channel: DraftChannel;
  /** Called with the result after a successful send / copy. The
   *  drawer uses this to bump pipeline_stage + last_outreach_at. */
  onSent?: (info: {
    channel: DraftChannel;
    partnerId: string;
    subject: string;
    body: string;
    threadId?: string;
  }) => void;
}

const ANGLE_OPTIONS: { value: DraftAngle; label: string; hint: string }[] = [
  { value: "thesis", label: "Thesis", hint: "Open by quoting their thesis back" },
  { value: "portfolio", label: "Portfolio", hint: "Reference a portfolio company" },
  { value: "warm_intro", label: "Warm intro", hint: "Lean on a mutual or referral" },
  { value: "generic", label: "Generic", hint: "Pitch-led, no specific hook" },
];

// ─────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────
export function DraftEmailModal({
  open,
  onClose,
  investor,
  partnerId,
  channel,
  onSent,
}: Props) {
  const { data: settings } = useMyFundraiseSettings();
  const { data: aliases = [] } = useGmailAliases();
  const sendMut = useSendEmail();

  // The current draft. null = loading / regenerating.
  const [draft, setDraft] = useState<DraftInvestorEmailResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Operator edits. Mirror the draft on first load; subsequent
  // regenerate-clicks replace them.
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Right-rail controls.
  const [angle, setAngle] = useState<DraftAngle>("thesis");
  const [warmNote, setWarmNote] = useState("");
  const [fromAlias, setFromAlias] = useState<string>("");

  // Send-side UX.
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  const partner = investor?.partners.find((p) => p.id === partnerId);
  const partnerEmail = partner?.email ?? "";

  // ── Reset when modal opens ─────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setSubject("");
    setBody("");
    setError(null);
    setCopied(false);
    setSent(false);
    setAngle("thesis");
    setWarmNote("");
    // Pick the operator's default send alias if set, else primary.
    const def = settings?.default_send_alias?.trim();
    if (def) {
      setFromAlias(def);
    } else {
      const primary = aliases.find((a) => a.is_primary)?.email ?? aliases[0]?.email ?? "";
      setFromAlias(primary);
    }
  }, [open, settings?.default_send_alias, aliases]);

  // ── Kick off the initial draft on mount ────────────────────────
  useEffect(() => {
    if (!open || !investor || !partnerId) return;
    void runDraft("thesis", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, investor?.id, partnerId, channel]);

  async function runDraft(useAngle: DraftAngle, useWarm: string) {
    if (!investor || !partnerId) return;
    setLoading(true);
    setError(null);
    const result = await draftInvestorEmail({
      investor,
      partnerId,
      settings: settings ?? null,
      channel,
      angle: useAngle,
      warmIntroNote: useWarm.trim() || undefined,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDraft(result);
    setAngle(result.angle); // Axon may have downgraded the angle
    setSubject(result.subject);
    setBody(result.body);
  }

  // ── Send / copy actions ───────────────────────────────────────
  async function handleSend() {
    if (!investor || !partner || !partnerEmail) return;
    setError(null);
    try {
      const res = await sendMut.mutateAsync({
        to: partnerEmail,
        subject,
        body,
        contact_id: partnerId ?? undefined,
        from_alias: fromAlias || undefined,
        from_display_name: settings?.founder_name ?? undefined,
      });
      setSent(true);
      onSent?.({
        channel: "email",
        partnerId: partnerId!,
        subject,
        body,
        threadId: res.thread_id,
      });
      setTimeout(onClose, 900);
    } catch (e: any) {
      setError(e?.message ?? "Send failed.");
    }
  }

  async function handleCopyLinkedIn() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      onSent?.({
        channel: "linkedin",
        partnerId: partnerId!,
        subject: "",
        body,
      });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't access clipboard.");
    }
  }

  // ── Derived UI bits ────────────────────────────────────────────
  const liChars = body.length;
  const liOver = channel === "linkedin" && liChars > 300;

  const canSend = useMemo(() => {
    if (loading || sendMut.isPending) return false;
    if (!body.trim()) return false;
    if (channel === "email") return !!subject.trim() && !!partnerEmail;
    return !liOver;
  }, [loading, sendMut.isPending, body, subject, channel, partnerEmail, liOver]);

  const ChannelIcon = channel === "email" ? Mail : Linkedin;

  // ── ESC to close ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sendMut.isPending) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, sendMut.isPending, onClose]);

  if (!investor || !partner) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          // stopPropagation: this modal renders inside the
          // InvestorDrawer's scrim — without it, a backdrop click
          // here would bubble up and close the drawer too.
          onClick={(e) => {
            e.stopPropagation();
            if (!sendMut.isPending) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[1000px] max-h-[92vh] overflow-hidden rounded-sm bg-card border border-border shadow-xl flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-3 p-4 border-b border-border/60">
              <div className="flex items-start gap-3 min-w-0">
                <div className="p-1.5 rounded-sm bg-primary/10 text-primary mt-0.5">
                  <ChannelIcon size={14} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[14px] font-semibold text-foreground leading-tight m-0 truncate">
                    {channel === "email" ? "Draft cold email" : "Draft LinkedIn DM"}
                  </h2>
                  <p className="text-[11px] text-foreground/55 truncate mt-0.5">
                    To <b className="text-foreground/80">{partner.name || "(unnamed)"}</b>
                    {partner.title ? ` · ${partner.title}` : ""} ·{" "}
                    <b className="text-foreground/80">{investor.company.name}</b>
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                disabled={sendMut.isPending}
                className="p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-40"
              >
                <X size={14} />
              </button>
            </header>

            {/* Body: two-column. Left = editable draft. Right = controls. */}
            <div className="flex-1 grid grid-cols-[1fr_280px] min-h-0">
              {/* ── LEFT: the draft ── */}
              <div className="flex flex-col min-h-0 overflow-y-auto p-5">
                {loading ? (
                  <DraftSkeleton />
                ) : error && !draft ? (
                  <ErrorState message={error} onRetry={() => runDraft(angle, warmNote)} />
                ) : (
                  <div className="space-y-4">
                    {/* From: picker (email only) */}
                    {channel === "email" && aliases.length > 1 && (
                      <FieldRow label="From">
                        <select
                          value={fromAlias}
                          onChange={(e) => setFromAlias(e.target.value)}
                          className={inputCls}
                        >
                          {aliases.map((a) => (
                            <option key={a.email} value={a.email}>
                              {a.display_name
                                ? `${a.display_name} <${a.email}>`
                                : a.email}
                              {a.is_primary ? " · primary" : ""}
                            </option>
                          ))}
                        </select>
                      </FieldRow>
                    )}

                    {/* To: (read-only) */}
                    <FieldRow label="To">
                      <div className="px-2.5 h-9 flex items-center rounded-sm border border-border bg-secondary text-[12.5px] text-foreground/70">
                        {channel === "email"
                          ? partnerEmail || "(no email on file — add to partner first)"
                          : partner.name}
                      </div>
                    </FieldRow>

                    {/* Subject (email only) */}
                    {channel === "email" && (
                      <FieldRow label="Subject">
                        <input
                          type="text"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          className={inputCls}
                        />
                      </FieldRow>
                    )}

                    {/* Body */}
                    <FieldRow
                      label={channel === "linkedin" ? "Message" : "Body"}
                      hint={
                        channel === "linkedin"
                          ? `${liChars}/300 chars${liOver ? " — over limit" : ""}`
                          : undefined
                      }
                      hintTone={liOver ? "destructive" : "muted"}
                    >
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={channel === "linkedin" ? 6 : 12}
                        className={
                          textareaCls +
                          (liOver ? " border-destructive/60" : "")
                        }
                      />
                    </FieldRow>

                    {error && (
                      <div className="flex items-start gap-2 text-[11.5px] text-destructive">
                        <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ── RIGHT: controls / sanity panel ── */}
              <aside className="border-l border-border/60 bg-secondary/40 p-4 overflow-y-auto flex flex-col gap-4">
                {/* What Axon used */}
                <section>
                  <h3 className="text-[10px] uppercase tracking-[0.16em] font-mono text-foreground/45 m-0 mb-2">
                    What Axon used
                  </h3>
                  <div className="rounded-sm border border-border bg-background p-2.5">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={11} className="text-primary" />
                      <span className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/50">
                        Hook
                      </span>
                    </div>
                    <p className="text-[11.5px] text-foreground/80 leading-snug m-0">
                      {loading
                        ? "…"
                        : draft?.hookUsed || "(no hook returned)"}
                    </p>
                  </div>
                </section>

                {/* Angle picker */}
                <section>
                  <h3 className="text-[10px] uppercase tracking-[0.16em] font-mono text-foreground/45 m-0 mb-2">
                    Angle
                  </h3>
                  <div className="space-y-1">
                    {ANGLE_OPTIONS.map((a) => (
                      <button
                        key={a.value}
                        type="button"
                        onClick={() => setAngle(a.value)}
                        disabled={loading || sendMut.isPending}
                        className={
                          "w-full text-left px-2.5 py-1.5 rounded-sm border text-[11.5px] transition-colors " +
                          (angle === a.value
                            ? "border-primary/40 bg-primary/[0.08] text-foreground"
                            : "border-border bg-background text-foreground/70 hover:text-foreground hover:border-foreground/30")
                        }
                      >
                        <div className="font-semibold">{a.label}</div>
                        <div className="text-[10px] text-foreground/45 mt-0.5">
                          {a.hint}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Warm-intro note */}
                {angle === "warm_intro" && (
                  <section>
                    <h3 className="text-[10px] uppercase tracking-[0.16em] font-mono text-foreground/45 m-0 mb-2">
                      Warm-intro note
                    </h3>
                    <textarea
                      value={warmNote}
                      onChange={(e) => setWarmNote(e.target.value)}
                      placeholder="Met at YC office hours via Jane Doe last week"
                      rows={3}
                      className={textareaCls + " text-[11.5px]"}
                    />
                  </section>
                )}

                {/* Regenerate */}
                <button
                  type="button"
                  onClick={() => runDraft(angle, warmNote)}
                  disabled={loading || sendMut.isPending}
                  className="mt-auto inline-flex items-center justify-center gap-1.5 h-9 rounded-sm border border-border bg-background text-[11.5px] font-bold uppercase tracking-wider text-foreground/80 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
                >
                  {loading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCcw size={12} />
                  )}
                  Regenerate
                </button>
              </aside>
            </div>

            {/* Footer */}
            <footer className="flex items-center justify-between gap-2 p-3 border-t border-border/60 bg-secondary/30">
              <div className="text-[10.5px] text-foreground/45 px-1">
                {channel === "email"
                  ? sendMut.isPending
                    ? "Sending via Gmail…"
                    : sent
                      ? "Sent. Activity logged."
                      : "Activity is logged automatically on send."
                  : copied
                    ? "Copied — paste into LinkedIn."
                    : "Paste into LinkedIn's connect request modal."}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sendMut.isPending}
                  className="inline-flex items-center px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                {channel === "email" ? (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {sendMut.isPending ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : sent ? (
                      <Check size={11} />
                    ) : (
                      <Send size={11} />
                    )}
                    {sent ? "Sent" : "Send via Gmail"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyLinkedIn}
                    disabled={!canSend}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? "Copied" : "Copy + mark sent"}
                  </button>
                )}
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────
// Bits
// ─────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-2.5 h-9 rounded-sm border border-border bg-background text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 transition-colors";

const textareaCls =
  "w-full px-2.5 py-2 rounded-sm border border-border bg-background text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 transition-colors resize-vertical leading-relaxed";

function FieldRow({
  label,
  hint,
  hintTone = "muted",
  children,
}: {
  label: string;
  hint?: string;
  hintTone?: "muted" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/55">
          {label}
        </span>
        {hint && (
          <span
            className={
              "text-[10px] italic " +
              (hintTone === "destructive"
                ? "text-destructive"
                : "text-foreground/35")
            }
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}

function DraftSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-9 rounded-sm bg-foreground/[0.05]" />
      <div className="h-9 rounded-sm bg-foreground/[0.05]" />
      <div className="h-[280px] rounded-sm bg-foreground/[0.05]" />
      <div className="flex items-center gap-2 text-[11px] text-foreground/45 pt-1">
        <Loader2 size={11} className="animate-spin" />
        Axon is drafting…
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <AlertCircle size={18} className="text-destructive mb-2" />
      <p className="text-[12.5px] text-foreground/80 mb-3 max-w-sm">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/80 hover:text-foreground hover:border-foreground/30 transition-colors"
      >
        <RefreshCcw size={11} />
        Try again
      </button>
    </div>
  );
}
