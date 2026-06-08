/**
 * InvestorDrawer.tsx — right-slide detail drawer for a single investor.
 *
 * Tabs:
 *   · Overview   — thesis + portfolio + check size + fit + stage
 *   · Partners   — list of crm_contacts where company_id = this firm
 *   · Activity   — every email/call/DM logged on any partner
 *   · Notes      — markdown notes (fit_score_notes_md)
 *
 * Phase 2 will add a "Draft email" button next to each partner.
 * Phase 3 makes the pipeline_stage editable inline (drag-from-kanban
 * already updates it, but the drawer should support manual override).
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Users,
  MessageSquare,
  StickyNote,
  Eye,
  ExternalLink,
  Mail,
  Linkedin,
  Twitter,
  Globe,
  Save,
  Sparkles,
} from "lucide-react";

import {
  useInvestor,
  useUpdateInvestor,
  formatCheckSize,
  PIPELINE_STAGE_LABEL,
  INVESTOR_PIPELINE_STAGES,
  type InvestorPipelineStage,
  type InvestorDetail,
  investorKeys,
} from "@/stores/investors";
import { DraftEmailModal } from "./DraftEmailModal";
import type { DraftChannel } from "@/Fundraise/draftInvestorEmail";
import { useMyFundraiseSettings } from "@/stores/fundraiseSettings";
import { useUpdateContact } from "@/stores/crm";
import { useAllEmployees } from "@/stores/query";
import {
  findPartnerEmail,
  type EmailCandidate,
} from "@/Fundraise/findPartnerEmail";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  investorId: string | null;
  onClose: () => void;
}

type TabId = "overview" | "partners" | "activity" | "notes";

export function InvestorDrawer({ investorId, onClose }: Props) {
  const { data: detail, isLoading } = useInvestor(investorId);
  const { data: settings } = useMyFundraiseSettings();
  const updateMut = useUpdateInvestor();
  const [tab, setTab] = useState<TabId>("overview");
  const open = !!investorId;

  // ── Phase 2: draft modal state ────────────────────────────────
  // The drawer is the natural owner because (a) it has the full
  // InvestorDetail loaded already and (b) it owns the pipeline
  // bump that happens after send.
  const [draftFor, setDraftFor] = useState<{
    partnerId: string;
    channel: DraftChannel;
  } | null>(null);

  // Phase 9.1: auto-open the draft modal when the drawer opens. As soon
  // as we have a loaded investor + settings + a partner with an email,
  // open the draft modal so Axon starts drafting in the background.
  // By the time the operator is done looking at the drawer header, the
  // draft is already ready (or close to it). Cuts ~10s + 1 click per
  // investor from the outreach flow.
  //
  // Guard: only auto-open ONCE per investor open -- otherwise closing
  // the modal would immediately re-open it. autoOpenedFor stores the
  // investor id we last auto-opened for; we reset it when the drawer
  // closes (investorId becomes null).
  const autoOpenedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!investorId) {
      // Drawer closed -- reset so next open re-arms the auto-open.
      autoOpenedFor.current = null;
      return;
    }
    if (autoOpenedFor.current === investorId) return;
    if (!detail || !settings) return;
    const partnerWithEmail = detail.partners.find((p) => p.email?.trim());
    if (!partnerWithEmail) return;
    autoOpenedFor.current = investorId;
    setDraftFor({ partnerId: partnerWithEmail.id, channel: "email" });
  }, [investorId, detail, settings]);

  /** Post-send hook. Three things happen here:
   *
   *  1. Bump pipeline_stage to "reaching_out" if the investor is
   *     still in "prospected" / "researched". Later stages stay.
   *  2. Set last_outreach_at = now() so the cadence math is honest.
   *  3. Phase 4 cadence: schedule next_followup_at based on the
   *     operator's saved cadence (followup_days_first / second /
   *     third). The followup_count tells us which delay to use:
   *
   *        prior count → next nudge → delay
   *        ────────────────────────────────
   *        0 (cold)    → 1st        → followup_days_first  (default 3)
   *        1           → 2nd        → followup_days_second (default 7)
   *        2           → 3rd        → followup_days_third  (default 14)
   *        3           → STOP       → next_followup_at = NULL
   *
   *  The activity row + reply-detection trigger handle everything
   *  inbound; this hook handles everything outbound. */
  function handleSent() {
    if (!detail) return;
    const now = new Date();
    const patch: {
      pipeline_stage?: InvestorPipelineStage;
      last_outreach_at?: string;
      next_followup_at?: string | null;
      followup_count?: number;
    } = { last_outreach_at: now.toISOString() };

    // Stage bump -- only for cold-funnel states.
    if (
      detail.pipeline_stage === "prospected" ||
      detail.pipeline_stage === "researched"
    ) {
      patch.pipeline_stage = "reaching_out";
    }

    // Cadence scheduling. The current followup_count reflects how
    // many nudges have been sent BEFORE this one; bumping it gives
    // us the new count, which we use to decide whether (and when)
    // to schedule the NEXT one.
    const newCount = (detail.followup_count ?? 0) + 1;
    patch.followup_count = Math.min(newCount, 3);

    // Pick the delay for the NEXT scheduled nudge based on what
    // count we'd be on after this send. If we already sent 3 nudges
    // (newCount > 3) we stop scheduling -- let the operator decide
    // whether to escalate manually.
    let nextDelayDays: number | null = null;
    if (newCount === 1) {
      nextDelayDays = settings?.followup_days_first ?? 3;
    } else if (newCount === 2) {
      nextDelayDays = settings?.followup_days_second ?? 7;
    } else if (newCount === 3) {
      nextDelayDays = settings?.followup_days_third ?? 14;
    } else {
      nextDelayDays = null; // Stop nagging after the 3rd nudge.
    }

    if (nextDelayDays != null) {
      const next = new Date(now);
      next.setDate(next.getDate() + nextDelayDays);
      patch.next_followup_at = next.toISOString();
    } else {
      patch.next_followup_at = null;
    }

    updateMut.mutate({ id: detail.id, patch });
  }

  // Esc closes.
  // (Component re-mounts per investor selection so this is fine.)
  if (typeof window !== "undefined" && open) {
    // No-op effect cost is acceptable here; the actual listener is
    // installed by the outer modal pattern in other surfaces. Keep
    // simple for the drawer.
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-40 bg-background/60 backdrop-blur-[2px]"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-full max-w-[560px] bg-card border-l border-border shadow-2xl flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            {/* ── Header ────────────────────────────────────── */}
            <header className="flex items-start justify-between gap-3 p-5 border-b border-border/60">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-foreground/40 mb-1">
                  Fundraise · Investor
                </p>
                <h2 className="text-[18px] font-semibold text-foreground leading-tight m-0 truncate">
                  {detail?.company_name ?? "Loading…"}
                </h2>
                {detail && (
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <StagePicker
                      value={detail.pipeline_stage}
                      onChange={(stage) =>
                        updateMut.mutate({
                          id: detail.id,
                          patch: { pipeline_stage: stage },
                        })
                      }
                      saving={updateMut.isPending}
                    />
                    <PriorityPicker
                      value={detail.priority}
                      onChange={(priority) =>
                        updateMut.mutate({
                          id: detail.id,
                          patch: { priority },
                        })
                      }
                      saving={updateMut.isPending}
                    />
                    <FitScoreEditor
                      value={detail.fit_score}
                      onCommit={(fit_score) =>
                        updateMut.mutate({
                          id: detail.id,
                          patch: { fit_score },
                        })
                      }
                      saving={updateMut.isPending}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors"
              >
                <X size={15} />
              </button>
            </header>

            {/* ── Tabs ──────────────────────────────────────── */}
            <nav
              role="tablist"
              className="flex items-center gap-0 px-5 border-b border-border/60"
            >
              <TabButton
                id="overview"
                label="Overview"
                icon={<Eye size={11} />}
                active={tab === "overview"}
                onClick={() => setTab("overview")}
              />
              <TabButton
                id="partners"
                label={`Partners${detail ? ` · ${detail.partners.length}` : ""}`}
                icon={<Users size={11} />}
                active={tab === "partners"}
                onClick={() => setTab("partners")}
              />
              <TabButton
                id="activity"
                label={`Activity${detail ? ` · ${detail.activities.length}` : ""}`}
                icon={<MessageSquare size={11} />}
                active={tab === "activity"}
                onClick={() => setTab("activity")}
              />
              <TabButton
                id="notes"
                label="Notes"
                icon={<StickyNote size={11} />}
                active={tab === "notes"}
                onClick={() => setTab("notes")}
              />
            </nav>

            {/* ── Body ──────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-5">
              {isLoading || !detail ? (
                <div className="flex items-center justify-center py-16 text-foreground/40 text-[12.5px]">
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Loading…
                </div>
              ) : tab === "overview" ? (
                <OverviewPanel detail={detail} />
              ) : tab === "partners" ? (
                <PartnersPanel
                  detail={detail}
                  onDraft={(partnerId, channel) =>
                    setDraftFor({ partnerId, channel })
                  }
                />
              ) : tab === "activity" ? (
                <ActivityPanel detail={detail} />
              ) : (
                <NotesPanel detail={detail} />
              )}
            </div>
          </motion.aside>

          {/* Draft modal lives at the drawer root so it overlays
            * the drawer scrim cleanly. */}
          <DraftEmailModal
            open={!!draftFor && !!detail}
            onClose={() => setDraftFor(null)}
            investor={detail ?? null}
            partnerId={draftFor?.partnerId ?? null}
            channel={draftFor?.channel ?? "email"}
            onSent={handleSent}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ──────────────────────────────────────────────────────────────────
// Panels
// ──────────────────────────────────────────────────────────────────

function OverviewPanel({ detail }: { detail: NonNullable<ReturnType<typeof useInvestor>["data"]> }) {
  return (
    <div className="space-y-5">
      <Block title="Thesis">
        {detail.thesis_md?.trim() ? (
          <p className="text-[12.5px] text-foreground/85 leading-relaxed whitespace-pre-wrap">
            {detail.thesis_md}
          </p>
        ) : (
          <Empty>No thesis recorded yet.</Empty>
        )}
      </Block>

      <Block title="Stage focus + check size">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {detail.stage_focus.length === 0 ? (
            <Empty>No stages set.</Empty>
          ) : (
            detail.stage_focus.map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-2 py-0.5 rounded-sm bg-foreground/[0.05] text-[10.5px] uppercase tracking-[0.12em] text-foreground/65"
              >
                {s.replace(/_/g, " ")}
              </span>
            ))
          )}
        </div>
        <p className="text-[12.5px] text-foreground/65 font-mono tabular-nums">
          Check size:{" "}
          {formatCheckSize(
            detail.check_size_min_cents,
            detail.check_size_max_cents,
          )}
        </p>
      </Block>

      <Block title="Portfolio">
        {detail.portfolio_md?.trim() ? (
          <pre className="text-[12px] text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">
            {detail.portfolio_md}
          </pre>
        ) : (
          <Empty>No portfolio info yet.</Empty>
        )}
      </Block>

      <Block title="Identity">
        <div className="space-y-1.5">
          {detail.company.domain && (
            <ContactLine
              icon={<Globe size={11} />}
              label="Website"
              value={detail.company.domain}
              href={`https://${detail.company.domain}`}
            />
          )}
          {detail.twitter_handle && (
            <ContactLine
              icon={<Twitter size={11} />}
              label="Twitter"
              value={detail.twitter_handle}
              href={`https://twitter.com/${detail.twitter_handle.replace(/^@/, "")}`}
            />
          )}
          {detail.hq_location && (
            <ContactLine
              icon={<Globe size={11} />}
              label="HQ"
              value={detail.hq_location}
            />
          )}
          {!detail.company.domain &&
            !detail.twitter_handle &&
            !detail.hq_location && <Empty>No identity links.</Empty>}
        </div>
      </Block>
    </div>
  );
}

function PartnersPanel({
  detail,
  onDraft,
}: {
  detail: InvestorDetail;
  /** Phase 2: opens the DraftEmailModal at the drawer root. */
  onDraft: (partnerId: string, channel: DraftChannel) => void;
}) {
  if (detail.partners.length === 0) {
    return <Empty>No partners added yet. Add one via the CRM contacts view.</Empty>;
  }
  // Pull the firm's domain so PartnerRow can use it when the
  // operator hits "Find email with Axon". Falls back to the
  // investor.website domain if the CRM company row doesn't have
  // one set.
  const firmDomain =
    detail.company.domain ?? extractDomain(detail.website) ?? null;
  // Firm name -- helps Axon's web_search disambiguate when the
  // partner has a common name. "Mike Vernal at Conviction" is
  // unambiguous; "Mike Vernal" alone is not.
  const firmName = detail.company_name ?? detail.company.name ?? "";
  return (
    <ul className="list-none p-0 m-0 space-y-2">
      {detail.partners.map((p) => (
        <PartnerRow
          key={p.id}
          partner={p}
          onDraft={onDraft}
          firmDomain={firmDomain}
          firmName={firmName}
        />
      ))}
    </ul>
  );
}

/** Best-effort URL -> bare domain. Returns null when the input is
 *  null or not parseable. */
function extractDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Single partner row. Split out because email editing is stateful
 *  and Axon often leaves email=null after discovery (web search
 *  couldn't verify it), so the row needs inline edit + reflect-on-
 *  save so the Draft email button re-enables immediately.
 *
 *  Phase 6: also handles the "Find email with Axon" flow -- when
 *  the firm has a domain on file, the operator can pattern-search
 *  for likely partner emails without leaving the drawer. */
function PartnerRow({
  partner,
  onDraft,
  firmDomain,
  firmName,
}: {
  partner: InvestorDetail["partners"][number];
  onDraft: (partnerId: string, channel: DraftChannel) => void;
  firmDomain: string | null;
  firmName: string;
}) {
  const updateContactMut = useUpdateContact();
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(partner.email ?? "");

  // Phase 6: Find email with Axon. State = "idle" | "searching" |
  // "results" -- when results show, the operator can click a
  // candidate to commit it via the same useUpdateContact mutation.
  const [findState, setFindState] = useState<
    "idle" | "searching" | "results"
  >("idle");
  const [findError, setFindError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<EmailCandidate[]>([]);
  const [domainHasMx, setDomainHasMx] = useState(true);

  // Sync the draft input if the row updates from realtime / refetch.
  useEffect(() => {
    setEmailDraft(partner.email ?? "");
  }, [partner.email]);

  async function commitEmail() {
    const trimmed = emailDraft.trim();
    setEditingEmail(false);
    if (trimmed === (partner.email ?? "")) return;
    // Light validation -- if it doesn't look like an email, revert.
    if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailDraft(partner.email ?? "");
      return;
    }
    try {
      await updateContactMut.mutateAsync({
        id: partner.id,
        patch: { email: trimmed || null },
      });
    } catch {
      setEmailDraft(partner.email ?? "");
    }
  }

  // Phase 6: ask the server for likely email candidates.
  async function runFindEmail() {
    if (!firmDomain) {
      setFindError("No firm domain on file -- add a website to the firm.");
      setFindState("results");
      return;
    }
    setFindState("searching");
    setFindError(null);
    const result = await findPartnerEmail({
      partner_name: partner.name ?? "",
      firm_domain: firmDomain,
      firm_name: firmName,
    });
    setCandidates(result.candidates);
    setDomainHasMx(result.domain_has_mx);
    setFindError(result.error ?? null);
    setFindState("results");
  }

  // QueryClient for invalidating the investor detail query after
  // we save a picked email. useUpdateContact only invalidates the
  // crm.contacts list, not the per-investor detail that powers this
  // drawer -- so without this, partner.email stays stale and the
  // Draft button keeps flipping into edit mode.
  const qc = useQueryClient();

  // Phase 6: commit a clicked candidate as the partner's email.
  async function pickCandidate(c: EmailCandidate) {
    setEmailDraft(c.email);
    setFindState("idle");
    try {
      await updateContactMut.mutateAsync({
        id: partner.id,
        patch: { email: c.email },
      });
      // Force the drawer's investor detail to refetch so partner.email
      // reflects the save -- otherwise hasEmail stays false and the
      // Draft Email click handler opens the editor again.
      qc.invalidateQueries({ queryKey: investorKeys.all });
    } catch (e: any) {
      setFindError(e?.message ?? "Save failed.");
    }
  }

  // hasEmail looks at BOTH the persisted partner.email AND the local
  // emailDraft -- pickCandidate sets emailDraft synchronously, so the
  // Draft button works even before the mutation/invalidation round-trip
  // finishes.
  const effectiveEmail = (partner.email ?? emailDraft)?.trim();
  const hasEmail = !!effectiveEmail;

  return (
    <li className="rounded-sm border border-border bg-card/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">
            {partner.name ?? "Unnamed"}
          </div>
          {partner.title && (
            <div className="text-[10.5px] text-foreground/55 uppercase tracking-[0.12em] mt-0.5">
              {partner.title}
            </div>
          )}
        </div>

        {/* Phase 2 actions: Draft email (primary) + Draft LinkedIn.
          * Phase 5.6: Email button stays enabled even with no email
          * -- clicking with no email flips the row into email-edit
          * mode so the operator can paste it in one click instead
          * of hunting for an "edit partner" surface. */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!hasEmail) {
                setEditingEmail(true);
                return;
              }
              onDraft(partner.id, "email");
            }}
            title={
              hasEmail
                ? "Draft a cold email with Axon"
                : "Click to add the partner's email, then draft"
            }
            className="inline-flex items-center gap-1 px-2 h-7 rounded-sm bg-primary text-primary-foreground text-[10.5px] font-bold uppercase tracking-[0.1em] hover:opacity-90 transition-opacity"
          >
            <Sparkles size={10} />
            Draft email
          </button>
          <button
            type="button"
            onClick={() => onDraft(partner.id, "linkedin")}
            title="Draft a LinkedIn DM (copies to clipboard)"
            className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-border bg-secondary text-foreground/65 hover:text-foreground hover:border-foreground/30 transition-colors"
            aria-label="Draft LinkedIn DM"
          >
            <Linkedin size={11} />
          </button>
        </div>
      </div>

      {/* Email row -- editable inline */}
      <div className="mt-2 space-y-1">
        {editingEmail ? (
          <div className="flex items-center gap-1.5">
            <Mail size={11} className="text-foreground/45 flex-shrink-0" />
            <span className="text-foreground/45 uppercase tracking-[0.1em] text-[10px] w-12 flex-shrink-0">
              Email
            </span>
            <input
              type="email"
              autoFocus
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onBlur={commitEmail}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitEmail();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setEmailDraft(partner.email ?? "");
                  setEditingEmail(false);
                }
              }}
              disabled={updateContactMut.isPending}
              placeholder="partner@firm.com"
              className="flex-1 px-2 h-6 rounded-sm border border-primary/40 bg-background text-[11px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary"
            />
          </div>
        ) : hasEmail ? (
          <button
            type="button"
            onClick={() => setEditingEmail(true)}
            title="Click to edit"
            className="flex items-center gap-2 text-[12px] text-foreground/85 hover:text-foreground transition-colors text-left w-full"
          >
            <span className="text-foreground/45">
              <Mail size={11} />
            </span>
            <span className="text-foreground/45 uppercase tracking-[0.1em] text-[10px] w-12 flex-shrink-0">
              Email
            </span>
            <span className="truncate flex-1">{partner.email}</span>
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] text-destructive/80 italic">
              <Mail size={11} />
              <span className="uppercase tracking-[0.1em] text-[10px] w-12 flex-shrink-0 not-italic">
                Email
              </span>
              <span>not on file</span>
              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditingEmail(true)}
                  className="px-2 h-6 rounded-sm border border-border bg-secondary text-[10px] uppercase tracking-[0.1em] font-mono text-foreground/65 hover:text-foreground hover:border-foreground/30 transition-colors not-italic"
                >
                  Type it
                </button>
                {firmDomain && (
                  <button
                    type="button"
                    onClick={runFindEmail}
                    disabled={findState === "searching"}
                    title={`Search likely emails at ${firmDomain}`}
                    className="inline-flex items-center gap-1 px-2 h-6 rounded-sm bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.1em] font-bold hover:opacity-90 transition-opacity disabled:opacity-40 not-italic"
                  >
                    {findState === "searching" ? (
                      <Loader2 size={9} className="animate-spin" />
                    ) : (
                      <Sparkles size={9} />
                    )}
                    Find with Axon
                  </button>
                )}
              </div>
            </div>

            {/* Phase 6: candidate list. Surfaces after runFindEmail
              * finishes. Operator clicks any row to commit it as
              * the partner's email via the same useUpdateContact
              * mutation. */}
            {findState === "results" && (
              <div className="ml-[60px] space-y-1">
                {findError && (
                  <div className="flex items-start gap-1.5 text-[10.5px] text-destructive">
                    <AlertCircle size={10} className="mt-0.5 flex-shrink-0" />
                    <span>{findError}</span>
                  </div>
                )}
                {!domainHasMx && candidates.length > 0 && (
                  <div className="text-[10px] italic text-amber-500/85">
                    Warning: {firmDomain} has no mail records -- these may bounce.
                  </div>
                )}
                {candidates.length === 0 && !findError && (
                  <div className="text-[10.5px] italic text-foreground/45">
                    No candidates generated.
                  </div>
                )}
                {candidates.length > 0 && (
                  <div className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-foreground/45">
                    {candidates[0]?.source === "web"
                      ? "Verified by Axon at top, pattern guesses below"
                      : "Best guesses -- click to use, top candidate first"}
                  </div>
                )}
                {candidates.map((c) => {
                  const isVerified = c.source === "web";
                  return (
                    <button
                      key={c.email}
                      type="button"
                      onClick={() => pickCandidate(c)}
                      disabled={updateContactMut.isPending}
                      title={
                        isVerified && c.source_url
                          ? `Verified at ${c.source_url}`
                          : undefined
                      }
                      className={
                        isVerified
                          ? "w-full flex items-center gap-2 px-2 py-1 rounded-sm border border-emerald-500/50 bg-emerald-500/[0.07] hover:bg-emerald-500/[0.12] hover:border-emerald-500/70 transition-colors text-left disabled:opacity-40"
                          : "w-full flex items-center gap-2 px-2 py-1 rounded-sm border border-border bg-card hover:bg-card/80 hover:border-foreground/25 transition-colors text-left disabled:opacity-40"
                      }
                    >
                      {isVerified ? (
                        <CheckCircle2
                          size={11}
                          className="text-emerald-400 flex-shrink-0"
                        />
                      ) : (
                        <ConfidenceDot confidence={c.confidence} />
                      )}
                      <span
                        className={
                          isVerified
                            ? "text-[11.5px] font-mono text-foreground truncate flex-1"
                            : "text-[11.5px] font-mono text-foreground/85 truncate flex-1"
                        }
                      >
                        {c.email}
                      </span>
                      {isVerified ? (
                        <span
                          className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-emerald-400/85 truncate max-w-[140px]"
                          title={c.source_url ?? undefined}
                        >
                          {c.source_label ?? "verified"}
                        </span>
                      ) : (
                        <span className="text-[9.5px] uppercase tracking-[0.12em] font-mono text-foreground/40">
                          {c.pattern}
                        </span>
                      )}
                      <span
                        className={
                          isVerified
                            ? "text-[10px] font-mono tabular-nums text-emerald-400/85 w-6 text-right"
                            : "text-[10px] font-mono tabular-nums text-foreground/55 w-6 text-right"
                        }
                      >
                        {c.confidence}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {partner.phone && (
          <ContactLine
            icon={<Linkedin size={11} />}
            label="Phone"
            value={partner.phone}
          />
        )}
      </div>
    </li>
  );
}

function ActivityPanel({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useInvestor>["data"]>;
}) {
  // Look up "who sent it" -- actor_supa_id is set server-side by
  // the Gmail send route. We resolve to the operator's username
  // via app_users. Falls back to "(system)" for rows with no
  // actor (rare -- mostly inbound emails from the reply trigger
  // which intentionally has no acting human).
  const { data: employees = [] } = useAllEmployees(false);
  const actorById = new Map(
    employees.map((e) => [e.supa_id, e.username]),
  );

  if (detail.activities.length === 0) {
    return (
      <Empty>
        No activity logged yet. Cold emails + replies will appear here
        once you send the first outreach.
      </Empty>
    );
  }
  return (
    <ul className="list-none p-0 m-0 space-y-2">
      {detail.activities.map((a) => {
        // Resolve who triggered this activity. For outbound emails
        // this is the operator who hit "Send via Gmail" -- the
        // Gmail send route writes actor_supa_id = the auth'd user
        // who initiated the send.
        const direction = (a.metadata as any)?.direction;
        const isInbound = direction === "inbound";
        const actorName = a.actor_supa_id
          ? actorById.get(a.actor_supa_id) ?? "Unknown operator"
          : isInbound
            ? "Investor reply"
            : "System";
        return (
        <li
          key={a.id}
          className="rounded-sm border border-border bg-card/60 px-3 py-2.5"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/55 font-mono">
              {a.type}
              {direction && (
                <span className="ml-1.5 text-foreground/35">
                  · {direction}
                </span>
              )}
            </span>
            <span className="text-[10px] text-foreground/40 font-mono tabular-nums">
              {new Date(a.happened_at ?? a.created_at).toLocaleDateString()}
            </span>
          </div>
          {/* Who triggered it -- shows on every activity row. For
            * outbound: operator name. For inbound: "Investor reply"
            * so the operator can scan and see who replied. */}
          <div className="mt-1 text-[10.5px] text-foreground/55">
            <span className="text-foreground/35">by</span>{" "}
            <span
              className={
                isInbound
                  ? "text-primary/85 font-semibold"
                  : "text-foreground/85 font-semibold"
              }
            >
              {actorName}
            </span>
          </div>
          {a.title && (
            <div className="text-[12.5px] text-foreground mt-1 font-medium">
              {a.title}
            </div>
          )}
          {a.body_md && (
            <p className="text-[11.5px] text-foreground/65 mt-1 line-clamp-4 whitespace-pre-wrap">
              {a.body_md}
            </p>
          )}
        </li>
        );
      })}
    </ul>
  );
}

function NotesPanel({
  detail,
}: {
  detail: NonNullable<ReturnType<typeof useInvestor>["data"]>;
}) {
  const updateMut = useUpdateInvestor();
  const [draft, setDraft] = useState(detail.fit_score_notes_md ?? "");
  const dirty = draft !== (detail.fit_score_notes_md ?? "");
  return (
    <div className="space-y-2">
      <p className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/45 font-mono">
        Your private notes about this investor
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={12}
        placeholder="Why are they a fit? Who introduced you? What angle should the cold email take?"
        className="w-full px-2.5 py-2 rounded-sm border border-border bg-background text-[12.5px] text-foreground placeholder:text-foreground/35 outline-none focus:border-primary/40 transition-colors leading-relaxed resize-vertical"
      />
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!dirty || updateMut.isPending}
          onClick={() =>
            updateMut.mutate({
              id: detail.id,
              patch: { fit_score_notes_md: draft },
            })
          }
          className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {updateMut.isPending ? (
            <Loader2 size={11} className="animate-spin" />
          ) : (
            <Save size={11} />
          )}
          Save notes
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────

function TabButton({
  id,
  label,
  icon,
  active,
  onClick,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      onClick={onClick}
      className={
        "relative px-3 h-9 inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.14em] font-semibold transition-colors " +
        (active
          ? "text-foreground"
          : "text-foreground/45 hover:text-foreground/70")
      }
    >
      {icon}
      {label}
      {active && (
        <span className="absolute left-0 right-0 bottom-[-1px] h-[2px] bg-primary" />
      )}
    </button>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="text-[10.5px] uppercase tracking-[0.14em] text-foreground/45 m-0 mb-2 font-mono">
        {title}
      </h3>
      {children}
    </section>
  );
}

function ContactLine({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
}) {
  const Tag = href ? "a" : "div";
  return (
    <Tag
      href={href}
      target={href ? "_blank" : undefined}
      rel={href ? "noopener noreferrer" : undefined}
      className={
        "flex items-center gap-2 text-[12px] text-foreground/85 " +
        (href ? "hover:text-primary transition-colors" : "")
      }
    >
      <span className="text-foreground/45">{icon}</span>
      <span className="text-foreground/45 uppercase tracking-[0.1em] text-[10px] w-12 flex-shrink-0">
        {label}
      </span>
      <span className="truncate flex-1">{value}</span>
      {href && <ExternalLink size={9} className="text-foreground/35 flex-shrink-0" />}
    </Tag>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] italic text-foreground/40">{children}</p>
  );
}

/** Confidence indicator for the Find-email candidate list. Color-
 *  graded so the operator can scan and pick the most-likely
 *  pattern at a glance. NOT a verification signal -- just how
 *  often the pattern is used at VC firms. */
function ConfidenceDot({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 70
      ? "bg-emerald-500"
      : confidence >= 50
        ? "bg-primary"
        : confidence >= 30
          ? "bg-amber-500"
          : "bg-foreground/25";
  return (
    <span
      className={"inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 " + tone}
      title={`Pattern confidence: ${confidence}/100 -- not a verification`}
    />
  );
}

function StagePicker({
  value,
  onChange,
  saving,
}: {
  value: InvestorPipelineStage;
  onChange: (stage: InvestorPipelineStage) => void;
  saving: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as InvestorPipelineStage)}
      disabled={saving}
      className="px-1.5 h-5 rounded-full border border-border bg-card text-[10px] uppercase tracking-[0.1em] font-semibold text-foreground/65 hover:text-foreground transition-colors outline-none cursor-pointer disabled:opacity-40"
    >
      {INVESTOR_PIPELINE_STAGES.map((s) => (
        <option key={s} value={s}>
          {PIPELINE_STAGE_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

/** Priority picker -- 4 levels. Mirrors StagePicker so the visual
 *  language stays consistent: same chip shape, same font, just a
 *  different value set. P0 stands out (primary tint) since it's
 *  the operator's dream-list signal. */
function PriorityPicker({
  value,
  onChange,
  saving,
}: {
  value: 0 | 1 | 2 | 3;
  onChange: (priority: 0 | 1 | 2 | 3) => void;
  saving: boolean;
}) {
  const tone =
    value === 0
      ? "border-primary/50 text-primary"
      : value === 1
        ? "border-amber-500/40 text-amber-400"
        : "border-border text-foreground/65";
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value) as 0 | 1 | 2 | 3)}
      disabled={saving}
      className={
        "px-1.5 h-5 rounded-full border bg-card text-[10px] uppercase tracking-[0.1em] font-semibold hover:text-foreground transition-colors outline-none cursor-pointer disabled:opacity-40 " +
        tone
      }
      title="Priority -- P0 is your dream list"
    >
      <option value={0}>P0 — dream</option>
      <option value={1}>P1 — strong</option>
      <option value={2}>P2 — standard</option>
      <option value={3}>P3 — cold</option>
    </select>
  );
}

/** Fit score editor -- click the pill to open an inline number
 *  input, edit, blur (or Enter) to commit. Escape cancels. The
 *  click target is intentionally small (matches the other chips
 *  in the header) so it stays unobtrusive when not being edited. */
function FitScoreEditor({
  value,
  onCommit,
  saving,
}: {
  value: number;
  onCommit: (fit: number) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  // Reset the draft if the underlying value changes (e.g. another
  // tab updated it via realtime). Without this the edit input
  // would stay stale across realtime updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(String(value)), [value]);

  function commit() {
    const n = Number(draft);
    setEditing(false);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(n)));
    setDraft(String(clamped));
    if (clamped !== value) onCommit(clamped);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={saving}
        className="px-1.5 h-5 rounded-full border border-border bg-card text-[10px] font-mono tabular-nums font-semibold text-foreground/65 hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-40"
        title="Click to edit fit score"
      >
        Fit {value}
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 h-5 rounded-full border border-primary/40 bg-card">
      <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-foreground/55">
        Fit
      </span>
      <input
        type="number"
        min={0}
        max={100}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="w-9 bg-transparent text-[10px] font-mono tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </span>
  );
}
