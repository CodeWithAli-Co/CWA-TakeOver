/**
 * AddInvestorModal.tsx — manual entry for a single investor firm.
 *
 * Defaults baked for pre-seed: stage_focus includes "pre_seed" + "seed",
 * check size range $25K-$500K, priority P2 (default). Operator can
 * override anything before saving.
 *
 * Optional initial partner — common case: you found the firm via a
 * specific partner (cold email back-channel, Twitter intro, warm intro).
 * One field set, both records get created in a single transaction.
 *
 * Phase 2 will add a "Find with Axon" button at the top that pre-fills
 * the form from a single firm name. For now it's purely manual.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, PiggyBank } from "lucide-react";

import {
  useCreateInvestor,
  INVESTOR_SOURCES,
  type CreateInvestorInput,
  type InvestorSource,
} from "@/stores/investors";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Stage focus quick-picks. Operator can type any string; this is the
// fast-path checklist. Pre-seed defaults checked because that's the
// fundraise the user is running today.
const STAGE_FOCUS_OPTIONS = [
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B+" },
  { value: "angel", label: "Angel" },
];

// $ → cents helper. Returns null for empty input. Strips $ and commas.
function dollarsToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,]/g, "");
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function AddInvestorModal({ open, onClose }: Props) {
  const createMut = useCreateInvestor();
  const [error, setError] = useState<string | null>(null);

  // Form state — flat for simplicity. Reset whenever modal reopens.
  const [firmName, setFirmName] = useState("");
  const [website, setWebsite] = useState("");
  const [hqLocation, setHqLocation] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [thesisMd, setThesisMd] = useState("");
  const [portfolioMd, setPortfolioMd] = useState("");
  const [stageFocus, setStageFocus] = useState<string[]>(["pre_seed"]);
  const [checkMin, setCheckMin] = useState("25000");
  const [checkMax, setCheckMax] = useState("500000");
  const [source, setSource] = useState<InvestorSource>("manual");
  const [priority, setPriority] = useState<0 | 1 | 2 | 3>(2);
  const [fitScore, setFitScore] = useState(50);
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [partnerTitle, setPartnerTitle] = useState("Partner");
  const [partnerLinkedin, setPartnerLinkedin] = useState("");

  useEffect(() => {
    if (open) {
      setFirmName("");
      setWebsite("");
      setHqLocation("");
      setTwitterHandle("");
      setThesisMd("");
      setPortfolioMd("");
      setStageFocus(["pre_seed"]);
      setCheckMin("25000");
      setCheckMax("500000");
      setSource("manual");
      setPriority(2);
      setFitScore(50);
      setPartnerName("");
      setPartnerEmail("");
      setPartnerTitle("Partner");
      setPartnerLinkedin("");
      setError(null);
    }
  }, [open]);

  // Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !createMut.isPending) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, createMut.isPending, onClose]);

  function toggleStage(v: string) {
    setStageFocus((cur) =>
      cur.includes(v) ? cur.filter((s) => s !== v) : [...cur, v],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firmName.trim()) {
      setError("Firm name is required.");
      return;
    }
    const min = dollarsToCents(checkMin);
    const max = dollarsToCents(checkMax);
    if (min != null && max != null && max < min) {
      setError("Check size max can't be less than min.");
      return;
    }

    const input: CreateInvestorInput = {
      firm_name: firmName.trim(),
      website: website.trim() || undefined,
      hq_location: hqLocation.trim() || undefined,
      twitter_handle: twitterHandle.trim() || undefined,
      thesis_md: thesisMd.trim() || undefined,
      portfolio_md: portfolioMd.trim() || undefined,
      stage_focus: stageFocus,
      check_size_min_cents: min ?? undefined,
      check_size_max_cents: max ?? undefined,
      source,
      priority,
      fit_score: fitScore,
    };
    if (partnerName.trim() || partnerEmail.trim()) {
      input.partner_name = partnerName.trim() || undefined;
      input.partner_email = partnerEmail.trim() || undefined;
      input.partner_linkedin = partnerLinkedin.trim() || undefined;
      input.partner_title = partnerTitle.trim() || undefined;
    }

    try {
      await createMut.mutateAsync(input);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to save investor.");
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
          onClick={() => !createMut.isPending && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-sm bg-card border border-border shadow-xl"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 p-5 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <PiggyBank size={16} className="text-primary" />
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground leading-tight m-0">
                    Add investor
                  </h2>
                  <p className="text-[10.5px] text-foreground/45 mt-0.5 uppercase tracking-[0.14em]">
                    Manual entry
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                disabled={createMut.isPending}
                className="p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </header>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-5">
              {/* Firm + identity */}
              <Section title="Firm">
                <Field label="Firm name" required>
                  <input
                    autoFocus
                    type="text"
                    value={firmName}
                    onChange={(e) => setFirmName(e.target.value)}
                    placeholder="e.g. Boldstart Ventures"
                    className={inputCls}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Website">
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="boldstart.vc"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="HQ">
                    <input
                      type="text"
                      value={hqLocation}
                      onChange={(e) => setHqLocation(e.target.value)}
                      placeholder="New York"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Twitter / X handle">
                  <input
                    type="text"
                    value={twitterHandle}
                    onChange={(e) => setTwitterHandle(e.target.value)}
                    placeholder="@boldstart"
                    className={inputCls}
                  />
                </Field>
              </Section>

              {/* Their thesis */}
              <Section title="Investment focus">
                <Field label="Thesis (free text)">
                  <textarea
                    value={thesisMd}
                    onChange={(e) => setThesisMd(e.target.value)}
                    placeholder="e.g. Pre-seed + seed enterprise SaaS. Loves dev tools and AI infra. Avoids consumer."
                    rows={3}
                    className={textareaCls}
                  />
                </Field>
                <Field label="Stage focus">
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {STAGE_FOCUS_OPTIONS.map((opt) => {
                      const on = stageFocus.includes(opt.value);
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => toggleStage(opt.value)}
                          className={
                            "px-2.5 h-7 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.12em] border transition-colors " +
                            (on
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-transparent text-foreground/65 border-border hover:border-foreground/30")
                          }
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check size min ($)">
                    <input
                      type="text"
                      value={checkMin}
                      onChange={(e) => setCheckMin(e.target.value)}
                      placeholder="25000"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Check size max ($)">
                    <input
                      type="text"
                      value={checkMax}
                      onChange={(e) => setCheckMax(e.target.value)}
                      placeholder="500000"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Portfolio (notable companies)">
                  <textarea
                    value={portfolioMd}
                    onChange={(e) => setPortfolioMd(e.target.value)}
                    placeholder={
                      "Notable bets:\n- Snyk\n- BigID\n- Workato"
                    }
                    rows={3}
                    className={textareaCls + " font-mono text-[11px]"}
                  />
                </Field>
              </Section>

              {/* Our tracking */}
              <Section title="Our pipeline">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Source">
                    <select
                      value={source}
                      onChange={(e) =>
                        setSource(e.target.value as InvestorSource)
                      }
                      className={inputCls}
                    >
                      {INVESTOR_SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Priority">
                    <select
                      value={priority}
                      onChange={(e) =>
                        setPriority(Number(e.target.value) as 0 | 1 | 2 | 3)
                      }
                      className={inputCls}
                    >
                      <option value={0}>P0 — dream investor</option>
                      <option value={1}>P1 — high priority</option>
                      <option value={2}>P2 — standard</option>
                      <option value={3}>P3 — long tail</option>
                    </select>
                  </Field>
                </div>
                <Field
                  label={`Fit score · ${fitScore} / 100`}
                  hint="How aligned with our company / vision / morals"
                >
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={fitScore}
                    onChange={(e) => setFitScore(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </Field>
              </Section>

              {/* Initial partner */}
              <Section
                title="Initial partner"
                hint="Optional. If you know who you're reaching out to."
              >
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name">
                    <input
                      type="text"
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="Ed Sim"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Title">
                    <input
                      type="text"
                      value={partnerTitle}
                      onChange={(e) => setPartnerTitle(e.target.value)}
                      placeholder="Partner"
                      className={inputCls}
                    />
                  </Field>
                </div>
                <Field label="Email">
                  <input
                    type="email"
                    value={partnerEmail}
                    onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder="ed@boldstart.vc"
                    className={inputCls}
                  />
                </Field>
                <Field label="LinkedIn URL">
                  <input
                    type="text"
                    value={partnerLinkedin}
                    onChange={(e) => setPartnerLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/edsim"
                    className={inputCls}
                  />
                </Field>
              </Section>

              {error && (
                <p className="text-[12px] text-destructive">{error}</p>
              )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={createMut.isPending}
                  className="inline-flex items-center px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMut.isPending || !firmName.trim()}
                  className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {createMut.isPending ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : null}
                  Save investor
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ──────────────────────────────────────────────────────────────────
// Form bits (kept local; small enough not to extract)
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
          <p className="text-[10.5px] text-foreground/40 mt-0.5">
            {hint}
          </p>
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
          <span className="text-[10px] text-foreground/35 italic">
            {hint}
          </span>
        )}
      </div>
      {children}
    </label>
  );
}
