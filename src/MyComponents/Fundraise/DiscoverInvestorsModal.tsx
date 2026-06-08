/**
 * DiscoverInvestorsModal.tsx — Axon-driven investor research UI.
 *
 * Replaces the bulk-data-entry pain of the manual Add Investor
 * form. The operator types a free-text description of what they
 * want ("pre-seed AI infra investors in NY/SF who've done dev
 * tools"), Axon researches the web, returns 8-15 candidate firms
 * with thesis + portfolio + partner emails, and the operator
 * scans + ticks which ones to add.
 *
 * Three states:
 *   1. input    -- vibe textarea + example chips + Search button
 *   2. loading  -- skeleton + progress text (Axon may take 20-40s)
 *   3. review   -- candidate cards with checkboxes + Add Selected
 *
 * After successful bulk-insert, modal closes; the kanban realtime
 * subscription picks up the new rows.
 *
 * Why a separate modal (not the existing AddInvestorModal):
 *   · Totally different UX shape (one input → list output)
 *   · Different commit semantics (bulk insert vs single insert)
 *   · The existing modal stays as a fallback for warm intros or
 *     other "I already know exactly who" cases where research is
 *     wasted effort.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Sparkles,
  Search,
  AlertCircle,
  Mail,
  Linkedin,
  Globe,
  CheckCircle2,
  RefreshCcw,
} from "lucide-react";

import { useMyFundraiseSettings } from "@/stores/fundraiseSettings";
import { useCreateInvestorsBulk } from "@/stores/investors";
import {
  discoverInvestors,
  type DiscoveredInvestor,
} from "@/Fundraise/discoverInvestors";

interface Props {
  open: boolean;
  onClose: () => void;
}

type State = "input" | "loading" | "review" | "saving" | "done";

// Example chip prompts. Tappable to seed the textarea.
const EXAMPLE_VIBES: string[] = [
  "Pre-seed AI infra investors in NY/SF who've done dev tools deals",
  "Solo GP angels writing $25K-$100K checks in agent software",
  "Pre-seed funds that backed Cresta, Decagon, or Modal",
  "Female-founded pre-seed funds doing B2B AI",
];

export function DiscoverInvestorsModal({ open, onClose }: Props) {
  const { data: settings } = useMyFundraiseSettings();
  const bulkMut = useCreateInvestorsBulk();

  const [state, setState] = useState<State>("input");
  const [vibe, setVibe] = useState("");
  const [candidates, setCandidates] = useState<DiscoveredInvestor[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Reset everything on close so reopening lands cleanly.
  useEffect(() => {
    if (!open) return;
    setState("input");
    setVibe("");
    setCandidates([]);
    setSelected(new Set());
    setError(null);
    setSavedCount(0);
    setFailedCount(0);
  }, [open]);

  // ESC closes -- but only when we're not mid-save (otherwise the
  // operator could orphan half a bulk insert).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state !== "saving" && state !== "loading") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, state, onClose]);

  // ── Actions ───────────────────────────────────────────────────
  async function handleSearch() {
    if (!vibe.trim()) return;
    setState("loading");
    setError(null);
    const result = await discoverInvestors({
      vibe: vibe.trim(),
      settings: settings ?? null,
    });
    if (result.error) {
      setError(result.error);
      setState("input");
      return;
    }
    if (result.investors.length === 0) {
      setError(
        "Axon couldn't find any matches. Try a broader description or different keywords.",
      );
      setState("input");
      return;
    }
    setCandidates(result.investors);
    // Default to all checked -- operator opts OUT of anything that
    // doesn't fit, which is the dominant pattern for batch reviews.
    setSelected(new Set(result.investors.map((c) => c.firm_name)));
    setState("review");
  }

  async function handleAddSelected() {
    if (selected.size === 0) return;
    setState("saving");
    setError(null);

    // Build payloads from the (possibly operator-edited) candidates.
    const payloads = candidates
      .filter((c) => selected.has(c.firm_name))
      .map((c) => ({
        firm_name: c.firm_name,
        website: c.website ?? undefined,
        twitter_handle: c.twitter ?? undefined,
        hq_location: c.hq ?? undefined,
        thesis_md: c.thesis ?? undefined,
        portfolio_md: c.portfolio ?? undefined,
        stage_focus: c.stage_focus,
        source: "claude_research" as const,
        priority: 2 as const,
        fit_score: c.match_score,
        fit_score_notes_md: c.match_reason || undefined,
        partners: c.partners.map((p) => ({
          name: p.name,
          email: p.email ?? null,
          linkedin: p.linkedin ?? null,
          title: p.title ?? "Partner",
        })),
      }));

    try {
      const results = await bulkMut.mutateAsync(payloads);
      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      setSavedCount(ok);
      setFailedCount(failed);
      setState("done");
      // Auto-close after a short success delay if everything saved.
      if (failed === 0) {
        setTimeout(onClose, 1400);
      }
    } catch (e: any) {
      setError(e?.message ?? "Bulk insert failed.");
      setState("review");
    }
  }

  // ── Operator-edit handlers (review state) ─────────────────────
  function toggleSelect(firm: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(firm)) next.delete(firm);
      else next.add(firm);
      return next;
    });
  }

  function updateCandidate(firm: string, patch: Partial<DiscoveredInvestor>) {
    setCandidates((cur) =>
      cur.map((c) => (c.firm_name === firm ? { ...c, ...patch } : c)),
    );
  }

  function updatePartnerEmail(firm: string, partnerIdx: number, email: string) {
    setCandidates((cur) =>
      cur.map((c) =>
        c.firm_name === firm
          ? {
              ...c,
              partners: c.partners.map((p, i) =>
                i === partnerIdx ? { ...p, email: email.trim() || null } : p,
              ),
            }
          : c,
      ),
    );
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => state !== "saving" && state !== "loading" && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[820px] max-h-[92vh] overflow-hidden rounded-sm bg-card border border-border shadow-xl flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-3 p-5 border-b border-border/60">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-sm bg-primary/10 text-primary mt-0.5">
                  <Sparkles size={14} />
                </div>
                <div>
                  <h2 className="text-[15px] font-semibold text-foreground leading-tight m-0">
                    {state === "review" || state === "saving" || state === "done"
                      ? "Review Axon's picks"
                      : "Find investors with Axon"}
                  </h2>
                  <p className="text-[10.5px] text-foreground/45 mt-0.5 uppercase tracking-[0.14em] font-mono">
                    {state === "review" || state === "saving" || state === "done"
                      ? `${candidates.length} firms found · ${selected.size} selected`
                      : "Axon researches the web + your pitch"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                disabled={state === "saving" || state === "loading"}
                className="p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-40"
              >
                <X size={15} />
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5">
              {state === "input" && (
                <InputState
                  vibe={vibe}
                  setVibe={setVibe}
                  examples={EXAMPLE_VIBES}
                  onSearch={handleSearch}
                  error={error}
                  hasSettings={!!settings?.pitch_md?.trim()}
                />
              )}
              {state === "loading" && <LoadingState />}
              {(state === "review" || state === "saving") && (
                <ReviewState
                  candidates={candidates}
                  selected={selected}
                  toggleSelect={toggleSelect}
                  updateCandidate={updateCandidate}
                  updatePartnerEmail={updatePartnerEmail}
                  saving={state === "saving"}
                  error={error}
                />
              )}
              {state === "done" && (
                <DoneState
                  savedCount={savedCount}
                  failedCount={failedCount}
                />
              )}
            </div>

            {/* Footer */}
            {(state === "input" ||
              state === "review" ||
              state === "saving") && (
              <footer className="flex items-center justify-between gap-2 p-3 border-t border-border/60 bg-secondary/30">
                <div className="text-[10.5px] text-foreground/45 px-1">
                  {state === "input" &&
                    "Axon may take 20-40 seconds to research"}
                  {state === "review" &&
                    "Emails marked blank weren't verifiable — confirm before sending"}
                  {state === "saving" && "Inserting investors…"}
                </div>
                <div className="flex items-center gap-2">
                  {state === "review" && (
                    <button
                      type="button"
                      onClick={() => {
                        setState("input");
                        setError(null);
                      }}
                      disabled={bulkMut.isPending}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      <RefreshCcw size={11} />
                      New search
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={state === "saving"}
                    className="inline-flex items-center px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  {state === "input" && (
                    <button
                      type="button"
                      onClick={handleSearch}
                      disabled={!vibe.trim()}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <Search size={11} />
                      Search with Axon
                    </button>
                  )}
                  {(state === "review" || state === "saving") && (
                    <button
                      type="button"
                      onClick={handleAddSelected}
                      disabled={selected.size === 0 || state === "saving"}
                      className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      {state === "saving" ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={11} />
                      )}
                      Add {selected.size} selected
                    </button>
                  )}
                </div>
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sub-states
// ─────────────────────────────────────────────────────────────────

function InputState({
  vibe,
  setVibe,
  examples,
  onSearch,
  error,
  hasSettings,
}: {
  vibe: string;
  setVibe: (v: string) => void;
  examples: string[];
  onSearch: () => void;
  error: string | null;
  hasSettings: boolean;
}) {
  return (
    <div className="space-y-4">
      {!hasSettings && (
        <div className="flex items-start gap-2 rounded-sm border border-primary/30 bg-primary/[0.06] p-3">
          <AlertCircle
            size={13}
            className="text-primary mt-0.5 flex-shrink-0"
          />
          <p className="text-[11.5px] text-foreground/75 leading-snug m-0">
            <b>Configure your pitch first</b> (gear icon in the header).
            Without it, Axon can't tell which firms actually match your
            stage and sector — results will be generic.
          </p>
        </div>
      )}

      <div>
        <label className="block">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/55">
              Describe your ideal investor
            </span>
            <span className="text-[10px] text-foreground/35 italic">
              free text — be specific about stage, sector, geography
            </span>
          </div>
          <textarea
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            placeholder="Pre-seed funds + angels in AI infrastructure. Based in NY or SF preferred. $25K-$500K check. Bonus if they've backed dev-tools companies like Modal, Replicate, or Cresta."
            rows={5}
            autoFocus
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                onSearch();
              }
            }}
            className="w-full px-3 py-2.5 rounded-sm border border-border bg-background text-[13px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 transition-colors resize-vertical leading-relaxed"
          />
          <p className="mt-1 text-[10px] text-foreground/35">
            ⌘+Enter to search
          </p>
        </label>
      </div>

      <div>
        <p className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/55 mb-2 font-mono">
          Or try one of these
        </p>
        <div className="flex flex-wrap gap-1.5">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setVibe(ex)}
              className="px-2.5 h-7 rounded-full border border-border bg-secondary/60 text-[11px] text-foreground/70 hover:text-foreground hover:border-foreground/30 hover:bg-secondary transition-colors"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-[11.5px] text-destructive">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 text-primary">
          <Sparkles size={20} />
        </div>
      </div>
      <h3 className="text-[14px] font-semibold text-foreground mb-1 m-0">
        Axon is researching
      </h3>
      <p className="text-[11.5px] text-foreground/55 max-w-sm">
        Searching the web for current firm info, partner names, and recent
        portfolio. This usually takes 20-40 seconds.
      </p>
      <Loader2 size={16} className="animate-spin text-foreground/40 mt-4" />
    </div>
  );
}

function ReviewState({
  candidates,
  selected,
  toggleSelect,
  updateCandidate,
  updatePartnerEmail,
  saving,
  error,
}: {
  candidates: DiscoveredInvestor[];
  selected: Set<string>;
  toggleSelect: (firm: string) => void;
  updateCandidate: (
    firm: string,
    patch: Partial<DiscoveredInvestor>,
  ) => void;
  updatePartnerEmail: (firm: string, idx: number, email: string) => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-2">
      {error && (
        <div className="flex items-start gap-2 text-[11.5px] text-destructive mb-3">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {candidates.map((c) => {
        const isOn = selected.has(c.firm_name);
        return (
          <article
            key={c.firm_name}
            className={
              "rounded-sm border p-3 transition-colors " +
              (isOn
                ? "border-primary/30 bg-primary/[0.03]"
                : "border-border bg-card/40 opacity-60")
            }
          >
            {/* Top row: checkbox + firm + score */}
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={isOn}
                disabled={saving}
                onChange={() => toggleSelect(c.firm_name)}
                className="mt-1 w-3.5 h-3.5 accent-primary cursor-pointer"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h4 className="text-[13.5px] font-semibold text-foreground m-0">
                    {c.firm_name}
                  </h4>
                  {c.website && (
                    <a
                      href={
                        c.website.startsWith("http")
                          ? c.website
                          : `https://${c.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[10.5px] text-foreground/45 hover:text-primary transition-colors"
                    >
                      <Globe size={9} />
                      {c.website.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  )}
                  {c.hq && (
                    <span className="text-[10.5px] text-foreground/45">
                      · {c.hq}
                    </span>
                  )}
                  <span
                    className="ml-auto text-[10px] font-mono tabular-nums font-semibold text-primary"
                    title={`Match score: ${c.match_score}/100`}
                  >
                    {c.match_score}
                  </span>
                </div>
                {c.match_reason && (
                  <p className="text-[11px] text-foreground/65 italic mt-0.5 leading-snug">
                    {c.match_reason}
                  </p>
                )}
              </div>
            </div>

            {/* Thesis (editable) */}
            {isOn && (
              <div className="mt-2 ml-6">
                <label>
                  <span className="text-[9.5px] uppercase tracking-[0.12em] text-foreground/45 font-mono">
                    Thesis
                  </span>
                  <textarea
                    value={c.thesis ?? ""}
                    onChange={(e) =>
                      updateCandidate(c.firm_name, { thesis: e.target.value })
                    }
                    disabled={saving}
                    rows={2}
                    placeholder="(no thesis found)"
                    className="mt-1 w-full px-2 py-1.5 rounded-sm border border-border bg-background text-[11.5px] text-foreground/85 placeholder:text-foreground/30 outline-none focus:border-primary/40 transition-colors resize-vertical leading-snug"
                  />
                </label>

                {/* Partners */}
                {c.partners.length > 0 && (
                  <div className="mt-2">
                    <span className="text-[9.5px] uppercase tracking-[0.12em] text-foreground/45 font-mono">
                      Partners
                    </span>
                    <div className="mt-1 space-y-1.5">
                      {c.partners.map((p, idx) => (
                        <div
                          key={`${p.name}-${idx}`}
                          className="flex items-center gap-2 text-[11.5px]"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-foreground/85 font-medium">
                              {p.name}
                            </span>
                            {p.title && (
                              <span className="text-foreground/45 ml-1.5">
                                {p.title}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {p.linkedin && (
                              <a
                                href={
                                  p.linkedin.startsWith("http")
                                    ? p.linkedin
                                    : `https://${p.linkedin}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-foreground/40 hover:text-primary transition-colors"
                                title="LinkedIn"
                              >
                                <Linkedin size={10} />
                              </a>
                            )}
                            <div className="relative">
                              <Mail
                                size={10}
                                className={
                                  p.email
                                    ? "absolute left-1.5 top-1/2 -translate-y-1/2 text-foreground/40"
                                    : "absolute left-1.5 top-1/2 -translate-y-1/2 text-destructive"
                                }
                              />
                              <input
                                type="email"
                                value={p.email ?? ""}
                                onChange={(e) =>
                                  updatePartnerEmail(
                                    c.firm_name,
                                    idx,
                                    e.target.value,
                                  )
                                }
                                disabled={saving}
                                placeholder="not verified — add manually"
                                className={
                                  "w-[200px] px-2 pl-5 h-6 rounded-sm border bg-background text-[10.5px] outline-none transition-colors " +
                                  (p.email
                                    ? "border-border text-foreground/85 placeholder:text-foreground/30 focus:border-primary/40"
                                    : "border-destructive/30 text-destructive placeholder:text-destructive/60 focus:border-destructive/60")
                                }
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function DoneState({
  savedCount,
  failedCount,
}: {
  savedCount: number;
  failedCount: number;
}) {
  const allGood = failedCount === 0;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className={
          "inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 " +
          (allGood
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-primary/15 text-primary")
        }
      >
        <CheckCircle2 size={22} />
      </div>
      <h3 className="text-[14px] font-semibold text-foreground mb-1 m-0">
        Added {savedCount} {savedCount === 1 ? "investor" : "investors"}
      </h3>
      {failedCount > 0 && (
        <p className="text-[11.5px] text-foreground/55 max-w-sm">
          {failedCount} {failedCount === 1 ? "row" : "rows"} couldn't be saved.
          You can close this and try again, or add them manually.
        </p>
      )}
      {allGood && (
        <p className="text-[11.5px] text-foreground/55">
          They're in your kanban now.
        </p>
      )}
    </div>
  );
}
