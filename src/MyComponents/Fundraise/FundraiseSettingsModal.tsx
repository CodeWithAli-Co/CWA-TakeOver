/**
 * FundraiseSettingsModal.tsx — operator-side settings for the
 * Fundraise module. Read by the Axon draft action when generating
 * cold emails so the pitch + signature don't have to be re-pasted
 * per investor.
 *
 * Sections:
 *   · Identity        — founder_name, founder_email_signature_md
 *   · Pitch           — pitch_md (elevator), one_pager_md (longer)
 *   · Send defaults   — default_send_alias (Gmail), default_call_link
 *   · Cadence         — followup_days_first / second / third
 *
 * Save behavior: upsert on Save, all fields optional. The "Pitch" +
 * "Founder name" fields are the only ones that meaningfully change
 * Axon's output; the rest tighten the result but aren't required.
 *
 * The modal renders a soft "set me up first" callout when the
 * operator hasn't filled in pitch_md yet, since drafting without it
 * produces noticeably more generic copy.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Save, Sparkles, AlertCircle } from "lucide-react";

import {
  useMyFundraiseSettings,
  useUpsertFundraiseSettings,
  type FundraiseSettingsPatch,
} from "@/stores/fundraiseSettings";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function FundraiseSettingsModal({ open, onClose }: Props) {
  const { data: settings, isLoading } = useMyFundraiseSettings();
  const upsertMut = useUpsertFundraiseSettings();
  const [error, setError] = useState<string | null>(null);

  // Form state — flat for simplicity. Initialized from the loaded
  // row whenever it changes; the user can override and save.
  const [founderName, setFounderName] = useState("");
  const [founderSig, setFounderSig] = useState("");
  const [pitch, setPitch] = useState("");
  const [onePager, setOnePager] = useState("");
  const [sendAlias, setSendAlias] = useState("");
  const [callLink, setCallLink] = useState("");
  const [followupFirst, setFollowupFirst] = useState(3);
  const [followupSecond, setFollowupSecond] = useState(7);
  const [followupThird, setFollowupThird] = useState(14);

  useEffect(() => {
    if (!open) return;
    setFounderName(settings?.founder_name ?? "");
    setFounderSig(settings?.founder_email_signature_md ?? "");
    setPitch(settings?.pitch_md ?? "");
    setOnePager(settings?.one_pager_md ?? "");
    setSendAlias(settings?.default_send_alias ?? "");
    setCallLink(settings?.default_call_link ?? "");
    setFollowupFirst(settings?.followup_days_first ?? 3);
    setFollowupSecond(settings?.followup_days_second ?? 7);
    setFollowupThird(settings?.followup_days_third ?? 14);
    setError(null);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !upsertMut.isPending) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, upsertMut.isPending, onClose]);

  // Show the "not configured yet" callout iff the user has neither
  // pitch nor founder name. We don't want to scold them after one
  // partial save.
  const isFresh =
    !settings || (!settings.pitch_md && !settings.founder_name);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const patch: FundraiseSettingsPatch = {
      founder_name: founderName.trim() || null,
      founder_email_signature_md: founderSig.trim() || null,
      pitch_md: pitch.trim() || null,
      one_pager_md: onePager.trim() || null,
      default_send_alias: sendAlias.trim() || null,
      default_call_link: callLink.trim() || null,
      followup_days_first: Math.max(1, Math.min(60, Math.round(followupFirst))),
      followup_days_second: Math.max(1, Math.min(60, Math.round(followupSecond))),
      followup_days_third: Math.max(1, Math.min(60, Math.round(followupThird))),
    };
    try {
      await upsertMut.mutateAsync(patch);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save settings.");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => !upsertMut.isPending && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[680px] max-h-[90vh] overflow-y-auto rounded-sm bg-card border border-border shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            <header className="flex items-center justify-between gap-3 p-5 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className="text-primary" />
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground leading-tight m-0">
                    Fundraise settings
                  </h2>
                  <p className="text-[10.5px] text-foreground/45 mt-0.5 uppercase tracking-[0.14em]">
                    Axon reads these when drafting cold emails
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                disabled={upsertMut.isPending}
                className="p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </header>

            {isLoading ? (
              <div className="p-8 flex items-center justify-center text-foreground/45 text-[12.5px]">
                <Loader2 size={14} className="animate-spin mr-2" />
                Loading your settings…
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-5 space-y-5">
                {isFresh && (
                  <div className="flex items-start gap-2 rounded-sm border border-primary/30 bg-primary/[0.06] p-3">
                    <AlertCircle
                      size={13}
                      className="text-primary mt-0.5 flex-shrink-0"
                    />
                    <div className="text-[12px] text-foreground/85 leading-snug">
                      <p className="font-semibold m-0">First time here.</p>
                      <p className="mt-1 text-foreground/65">
                        Fill in your <b>founder name</b> and <b>pitch</b> at
                        minimum. Axon will use them in every cold email draft.
                        Everything else is optional.
                      </p>
                    </div>
                  </div>
                )}

                {/* Identity */}
                <Section title="Identity">
                  <Field label="Founder name" required>
                    <input
                      type="text"
                      value={founderName}
                      onChange={(e) => setFounderName(e.target.value)}
                      placeholder="Ali Alibrahimi"
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="Email signature (markdown)"
                    hint="Block at the bottom of every draft. Include links."
                  >
                    <textarea
                      value={founderSig}
                      onChange={(e) => setFounderSig(e.target.value)}
                      placeholder={
                        "—\nAli Alibrahimi\nFounder, CodeWithAli\nhttps://codewithali.com"
                      }
                      rows={4}
                      className={textareaCls + " font-mono text-[11.5px]"}
                    />
                  </Field>
                </Section>

                {/* Pitch material */}
                <Section
                  title="Pitch material"
                  hint="The text Axon reads to personalize the email body."
                >
                  <Field label="Elevator pitch (1-2 paragraphs)" required>
                    <textarea
                      value={pitch}
                      onChange={(e) => setPitch(e.target.value)}
                      placeholder={
                        "Takeover is the native-desktop agent runtime for ops. We replace 12 SaaS tools with one app that takes actions across the company stack — bookkeeping, hiring, contracts, code. We're pre-revenue, 7 design partners onboarded, 30% MoM."
                      }
                      rows={5}
                      className={textareaCls}
                    />
                  </Field>
                  <Field
                    label="One-pager (longer narrative)"
                    hint="Used when the partner asks for more context."
                  >
                    <textarea
                      value={onePager}
                      onChange={(e) => setOnePager(e.target.value)}
                      placeholder={
                        "Vision: every operator runs the entire company from one keyboard. Today: agent-runtime layer with 6 sub-agents. Traction: 7 paying design partners, $120/mo ARR, 30% MoM. Round: pre-seed $500K-$1M for 12-18 months of runway."
                      }
                      rows={5}
                      className={textareaCls}
                    />
                  </Field>
                </Section>

                {/* Send defaults */}
                <Section title="Send defaults">
                  <Field
                    label="Default Gmail alias"
                    hint="Leave blank to send from your primary inbox."
                  >
                    <input
                      type="email"
                      value={sendAlias}
                      onChange={(e) => setSendAlias(e.target.value)}
                      placeholder="unfold@codewithali.com"
                      className={inputCls}
                    />
                  </Field>
                  <Field
                    label="Soft-ask CTA link"
                    hint='Appended as "could grab 15 min next week — {link}?"'
                  >
                    <input
                      type="text"
                      value={callLink}
                      onChange={(e) => setCallLink(e.target.value)}
                      placeholder="https://cal.com/ali/founder-chat"
                      className={inputCls}
                    />
                  </Field>
                </Section>

                {/* Cadence */}
                <Section
                  title="Follow-up cadence"
                  hint="Days after initial outreach. Phase 4 schedules these for you."
                >
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="1st nudge">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={followupFirst}
                        onChange={(e) =>
                          setFollowupFirst(Number(e.target.value))
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="2nd nudge">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={followupSecond}
                        onChange={(e) =>
                          setFollowupSecond(Number(e.target.value))
                        }
                        className={inputCls}
                      />
                    </Field>
                    <Field label="3rd nudge">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={followupThird}
                        onChange={(e) =>
                          setFollowupThird(Number(e.target.value))
                        }
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </Section>

                {error && (
                  <p className="text-[12px] text-destructive">{error}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={upsertMut.isPending}
                    className="inline-flex items-center px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={upsertMut.isPending}
                    className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {upsertMut.isPending ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Save size={11} />
                    )}
                    Save settings
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ──────────────────────────────────────────────────────────────────
// Form bits — same shapes as AddInvestorModal so they read familiar.
// ──────────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-2.5 h-9 rounded-sm border border-border bg-background text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 transition-colors";

const textareaCls =
  "w-full px-2.5 py-2 rounded-sm border border-border bg-background text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 transition-colors resize-vertical leading-relaxed";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-2">
        <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-foreground/45 m-0 font-mono">
          {title}
        </h3>
        {hint && (
          <p className="text-[10.5px] text-foreground/40 mt-0.5">{hint}</p>
        )}
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/55">
          {label}
          {required && <span className="text-primary ml-0.5">*</span>}
        </span>
        {hint && (
          <span className="text-[10px] text-foreground/35 italic">{hint}</span>
        )}
      </div>
      {children}
    </label>
  );
}
