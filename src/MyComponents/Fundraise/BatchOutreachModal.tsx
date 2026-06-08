/**
 * BatchOutreachModal.tsx — multi-investor cold-email drafting +
 * approve-and-send.
 *
 * The flow operators have been asking for since Phase 2:
 *
 *   PICKER   Choose N investors (default: all eligible, untick
 *            the ones to skip)
 *   DRAFTING Axon drafts all in parallel (~10-15s for 10 firms)
 *   REVIEW   Scrollable list of N draft cards. Each is editable
 *            inline + has an approved toggle. Regenerate any row.
 *   SENDING  Sequential Gmail sends with 2.5s spacing. Progress
 *            bar + per-row status (sending → sent / failed).
 *   DONE     Summary count.
 *
 * Eligibility filter for the picker:
 *   - Investor must have at least one partner with a non-null email
 *   - Investor must NOT be in "passed" or "closed" stages
 *   - Investor's pipeline_stage drives mode picking: "prospected"
 *     and "researched" -> cold-email mode; "reaching_out" or
 *     "replied" -> follow-up mode (count auto-increments)
 *
 * Send safety rails:
 *   - Confirm modal if approved count > 10
 *   - 2.5s spacing between sends (Gmail accepts ~100/sec but
 *     real-world deliverability suffers if you blast)
 *   - Kill switch ("Stop remaining") sets store.aborted=true
 *     between rows
 *   - Each row uses the same useSendEmail mutation as the single-
 *     send flow, so post-send hooks (activity log, pipeline bump,
 *     cadence schedule) all fire per row.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Loader2,
  Sparkles,
  Send,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  XCircle,
  StopCircle,
  Mail,
} from "lucide-react";

import {
  useInvestors,
  useUpdateInvestor,
  type InvestorListEntry,
  type InvestorPipelineStage,
} from "@/stores/investors";
import { useSendEmail } from "@/stores/gmail";
import { useMyFundraiseSettings } from "@/stores/fundraiseSettings";
import { companySupabase } from "@/routes/index.lazy";
import {
  draftInvestorEmail,
  type DraftMode,
  type InvestorDetail,
} from "@/Fundraise/draftInvestorEmail";

import {
  useBatchOutreachStore,
  makeBatchDraft,
  type BatchDraft,
} from "./batchOutreachStore";

// Spacing between sequential sends. 2.5s feels natural to the
// recipients (they don't all land in the same minute) and stays
// far under Gmail's API quota.
const SEND_SPACING_MS = 2500;

// If the operator tries to send more than this in one batch, we
// require a confirm step. Just a guard rail to prevent accidental
// blasts.
const CONFIRM_THRESHOLD = 10;

// ─────────────────────────────────────────────────────────────────
// Modal shell
// ─────────────────────────────────────────────────────────────────
export function BatchOutreachModal() {
  const open = useBatchOutreachStore((s) => s.open);
  const stage = useBatchOutreachStore((s) => s.stage);
  const reset = useBatchOutreachStore((s) => s.reset);
  const closeModal = useBatchOutreachStore((s) => s.closeModal);

  // ESC to close, but not mid-send (we don't want to orphan
  // half a batch by hitting escape).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "sending" && stage !== "drafting") {
        e.preventDefault();
        closeModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stage, closeModal]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4"
          onClick={() => stage !== "sending" && stage !== "drafting" && closeModal()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="relative w-full max-w-[1100px] max-h-[92vh] overflow-hidden rounded-sm bg-card border border-border shadow-xl flex flex-col"
            role="dialog"
            aria-modal="true"
          >
            <Header />
            <div className="flex-1 overflow-y-auto p-5">
              {stage === "picker" && <PickerState />}
              {stage === "drafting" && <DraftingState />}
              {stage === "review" && <ReviewState />}
              {stage === "sending" && <SendingState />}
              {stage === "done" && <DoneState onClose={() => reset()} />}
            </div>
            <Footer />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Header() {
  const stage = useBatchOutreachStore((s) => s.stage);
  const reset = useBatchOutreachStore((s) => s.reset);
  const selectedCount = useBatchOutreachStore((s) => s.selectedIds.size);
  const draftCount = useBatchOutreachStore((s) => s.drafts.size);
  const approvedCount = useBatchOutreachStore(
    (s) => Array.from(s.drafts.values()).filter((d) => d.approved).length,
  );

  const title =
    stage === "picker"
      ? "Pick investors for batch outreach"
      : stage === "drafting"
        ? "Axon is drafting"
        : stage === "review"
          ? "Review batch drafts"
          : stage === "sending"
            ? "Sending"
            : "Done";

  const subtitle =
    stage === "picker"
      ? `${selectedCount} selected`
      : stage === "drafting"
        ? "Parallel draft pass — should take 10-30 seconds"
        : stage === "review"
          ? `${draftCount} drafts · ${approvedCount} approved`
          : stage === "sending"
            ? "Sequential send with 2.5s spacing"
            : "Activity logged automatically";

  return (
    <header className="flex items-start justify-between gap-3 p-4 border-b border-border/60">
      <div className="flex items-start gap-3">
        <div className="p-1.5 rounded-sm bg-primary/10 text-primary mt-0.5">
          <Sparkles size={14} />
        </div>
        <div>
          <h2 className="text-[15px] font-semibold text-foreground leading-tight m-0">
            {title}
          </h2>
          <p className="text-[10.5px] text-foreground/45 mt-0.5 uppercase tracking-[0.14em] font-mono">
            {subtitle}
          </p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Close"
        onClick={() => reset()}
        disabled={stage === "sending" || stage === "drafting"}
        className="p-1.5 rounded-sm text-foreground/40 hover:text-foreground hover:bg-foreground/[0.05] transition-colors disabled:opacity-40"
      >
        <X size={15} />
      </button>
    </header>
  );
}

function Footer() {
  const stage = useBatchOutreachStore((s) => s.stage);
  const setStage = useBatchOutreachStore((s) => s.setStage);
  const reset = useBatchOutreachStore((s) => s.reset);
  const closeModal = useBatchOutreachStore((s) => s.closeModal);
  const abort = useBatchOutreachStore((s) => s.abort);
  const aborted = useBatchOutreachStore((s) => s.aborted);
  const selectedCount = useBatchOutreachStore((s) => s.selectedIds.size);
  const approvedCount = useBatchOutreachStore(
    (s) => Array.from(s.drafts.values()).filter((d) => d.approved).length,
  );

  const { data: settings } = useMyFundraiseSettings();
  const sendMut = useSendEmail();
  const updateInvestorMut = useUpdateInvestor();
  const drafts = useBatchOutreachStore((s) => s.drafts);
  const setProgress = useBatchOutreachStore((s) => s.setProgress);
  const patchDraft = useBatchOutreachStore((s) => s.patchDraft);

  const [confirmSend, setConfirmSend] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  if (stage === "done") return null;

  return (
    <footer className="flex items-center justify-between gap-2 p-3 border-t border-border/60 bg-secondary/30">
      <div className="text-[10.5px] text-foreground/45 px-1">
        {stage === "picker" && `${selectedCount} investors will be drafted`}
        {stage === "drafting" && "Axon is calling Claude for each row"}
        {stage === "review" &&
          (approvedCount === 0
            ? "Approve at least one row to send"
            : `${approvedCount} ready to send · ~${Math.ceil((approvedCount * SEND_SPACING_MS) / 1000)}s total`)}
        {stage === "sending" &&
          (aborted ? "Aborting after current row…" : "Sending. Don't close this window.")}
      </div>
      <div className="flex items-center gap-2">
        {stage === "picker" && (
          <>
            <button
              type="button"
              onClick={closeModal}
              className="inline-flex items-center px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() =>
                runParallelDraft({
                  setStage,
                  setDraftError,
                  setProgress,
                })
              }
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Sparkles size={11} />
              Draft {selectedCount}
            </button>
          </>
        )}
        {stage === "review" && (
          <>
            <button
              type="button"
              onClick={() => setStage("picker")}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors"
            >
              ← Picker
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex items-center px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={approvedCount === 0}
              onClick={() => {
                if (approvedCount > CONFIRM_THRESHOLD) {
                  setConfirmSend(true);
                  return;
                }
                runSequentialSend({
                  drafts,
                  patchDraft,
                  setProgress,
                  setStage,
                  sendMut,
                  updateInvestorMut,
                  settings: settings ?? null,
                });
              }}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              <Send size={11} />
              Send {approvedCount}
            </button>
          </>
        )}
        {stage === "sending" && (
          <button
            type="button"
            disabled={aborted}
            onClick={abort}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm border border-destructive/40 bg-destructive/[0.08] text-[11.5px] font-bold uppercase tracking-wider text-destructive hover:bg-destructive/[0.15] transition-colors disabled:opacity-40"
          >
            <StopCircle size={11} />
            {aborted ? "Stopping…" : "Stop remaining"}
          </button>
        )}
      </div>

      {draftError && (
        <div className="absolute bottom-14 left-4 right-4 flex items-start gap-2 text-[11.5px] text-destructive">
          <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{draftError}</span>
        </div>
      )}

      {confirmSend && (
        <ConfirmSendModal
          count={approvedCount}
          onCancel={() => setConfirmSend(false)}
          onConfirm={() => {
            setConfirmSend(false);
            runSequentialSend({
              drafts,
              patchDraft,
              setProgress,
              setStage,
              sendMut,
              updateInvestorMut,
              settings: settings ?? null,
            });
          }}
        />
      )}
    </footer>
  );
}

function ConfirmSendModal({
  count,
  onCancel,
  onConfirm,
}: {
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-sm bg-card border border-border shadow-xl p-5"
      >
        <h3 className="text-[14px] font-semibold text-foreground m-0 mb-1">
          Send {count} emails?
        </h3>
        <p className="text-[12px] text-foreground/65 mb-4">
          That's above the safety threshold. They'll go out spaced ~2.5s
          apart. Make sure you've reviewed each draft before continuing —
          you can't recall them.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center px-3 h-8 rounded-sm border border-border text-[11.5px] text-foreground/70 hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
          >
            <Send size={11} />
            Send {count}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// State: PICKER
// ─────────────────────────────────────────────────────────────────
function PickerState() {
  const { data: investors = [] } = useInvestors();
  const selectedIds = useBatchOutreachStore((s) => s.selectedIds);
  const toggle = useBatchOutreachStore((s) => s.toggleSelected);
  const selectAll = useBatchOutreachStore((s) => s.selectAll);
  const clearSelection = useBatchOutreachStore((s) => s.clearSelection);

  const [stageFilter, setStageFilter] = useState<InvestorPipelineStage | "all">(
    "all",
  );

  // Eligibility: must have partner_count > 0 (some partner exists)
  // and stage isn't passed/closed. We can't check email presence
  // here without loading every detail; trust the partner_count
  // signal as a proxy and verify per-row at draft time.
  const eligible = useMemo(() => {
    return investors.filter((i) => {
      if (i.partner_count === 0) return false;
      if (i.pipeline_stage === "passed" || i.pipeline_stage === "closed")
        return false;
      if (stageFilter !== "all" && i.pipeline_stage !== stageFilter)
        return false;
      return true;
    });
  }, [investors, stageFilter]);

  // Default-select on mount if nothing is selected yet.
  useEffect(() => {
    if (selectedIds.size === 0 && eligible.length > 0) {
      selectAll(eligible.map((i) => i.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allSelected =
    eligible.length > 0 && eligible.every((i) => selectedIds.has(i.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] uppercase tracking-[0.12em] text-foreground/55 font-mono">
          Filter by stage:
        </span>
        {(["all", "prospected", "researched", "reaching_out", "replied"] as const).map(
          (s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStageFilter(s)}
              className={
                "px-2 h-6 rounded-full border text-[10.5px] uppercase tracking-[0.1em] font-semibold transition-colors " +
                (stageFilter === s
                  ? "border-primary/40 bg-primary/[0.08] text-foreground"
                  : "border-border bg-secondary text-foreground/65 hover:text-foreground")
              }
            >
              {s === "all" ? "All" : s.replace(/_/g, " ")}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() =>
            allSelected ? clearSelection() : selectAll(eligible.map((i) => i.id))
          }
          className="ml-auto text-[10.5px] uppercase tracking-[0.12em] font-mono text-foreground/55 hover:text-foreground transition-colors"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      {eligible.length === 0 ? (
        <div className="rounded-sm border border-dashed border-border p-8 text-center">
          <p className="text-[12.5px] text-foreground/55 m-0">
            No eligible investors. Each needs at least one partner attached.
          </p>
        </div>
      ) : (
        <ul className="list-none p-0 m-0 space-y-1.5">
          {eligible.map((inv) => (
            <PickerRow
              key={inv.id}
              investor={inv}
              checked={selectedIds.has(inv.id)}
              onToggle={() => toggle(inv.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PickerRow({
  investor,
  checked,
  onToggle,
}: {
  investor: InvestorListEntry;
  checked: boolean;
  onToggle: () => void;
}) {
  const PRIORITY_LABEL: Record<number, string> = {
    0: "P0",
    1: "P1",
    2: "P2",
    3: "P3",
  };
  return (
    <li>
      <label
        className={
          "flex items-center gap-3 px-3 py-2 rounded-sm border cursor-pointer transition-colors " +
          (checked
            ? "border-primary/30 bg-primary/[0.04]"
            : "border-border bg-card/40 hover:bg-card/70")
        }
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="w-3.5 h-3.5 accent-primary cursor-pointer"
        />
        <span className="text-[13px] font-semibold text-foreground flex-1 truncate">
          {investor.company_name}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-foreground/45">
          {investor.pipeline_stage.replace(/_/g, " ")}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-foreground/55 w-6 text-right">
          {PRIORITY_LABEL[investor.priority]}
        </span>
        <span className="text-[10px] font-mono tabular-nums text-foreground/45 w-8 text-right">
          {investor.partner_count}p
        </span>
      </label>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────
// State: DRAFTING
// ─────────────────────────────────────────────────────────────────
function DraftingState() {
  const total = useBatchOutreachStore((s) => s.selectedIds.size);
  const progress = useBatchOutreachStore((s) => s.progress);
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 text-primary">
          <Sparkles size={20} />
        </div>
      </div>
      <h3 className="text-[14px] font-semibold text-foreground mb-1 m-0">
        Drafting {total} emails
      </h3>
      <p className="text-[11.5px] text-foreground/55 max-w-sm mb-4">
        Each one is a separate Claude call. Total time scales with the slowest
        request, not the sum -- usually 10-30 seconds.
      </p>
      <div className="w-64 h-1 rounded-full bg-foreground/[0.08] overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{
            width: `${total > 0 ? Math.round((progress.current / total) * 100) : 0}%`,
          }}
        />
      </div>
      <p className="text-[10.5px] text-foreground/45 mt-2 font-mono tabular-nums">
        {progress.current} / {total}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// State: REVIEW
// ─────────────────────────────────────────────────────────────────
function ReviewState() {
  const drafts = useBatchOutreachStore((s) => s.drafts);
  const draftList = useMemo(() => Array.from(drafts.values()), [drafts]);

  if (draftList.length === 0) {
    return (
      <div className="py-12 text-center text-foreground/55 text-[12.5px]">
        No drafts were produced.
      </div>
    );
  }
  return (
    <ul className="list-none p-0 m-0 space-y-3">
      {draftList.map((d) => (
        <ReviewRow key={d.investor_id} draft={d} />
      ))}
    </ul>
  );
}

function ReviewRow({ draft }: { draft: BatchDraft }) {
  const patch = useBatchOutreachStore((s) => s.patchDraft);
  return (
    <li
      className={
        "rounded-sm border p-3 transition-colors " +
        (draft.approved
          ? "border-primary/30 bg-primary/[0.03]"
          : "border-border bg-card/40 opacity-60")
      }
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={draft.approved}
          onChange={(e) =>
            patch(draft.investor_id, { approved: e.target.checked })
          }
          className="mt-1 w-3.5 h-3.5 accent-primary cursor-pointer"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-foreground">
              {draft.firm_name}
            </span>
            <span className="text-[10.5px] text-foreground/55">
              → {draft.partner_name}
            </span>
            <span className="text-[10px] font-mono text-foreground/40">
              ({draft.partner_email})
            </span>
            {draft.hook_used && (
              <span className="ml-auto text-[10px] italic text-foreground/55 max-w-[40%] truncate">
                {draft.hook_used}
              </span>
            )}
          </div>
          <input
            type="text"
            value={draft.subject}
            onChange={(e) =>
              patch(draft.investor_id, { subject: e.target.value })
            }
            placeholder="Subject"
            className="w-full px-2.5 h-8 rounded-sm border border-border bg-background text-[12.5px] text-foreground outline-none focus:border-primary/40 transition-colors"
          />
          <textarea
            value={draft.body}
            onChange={(e) => patch(draft.investor_id, { body: e.target.value })}
            rows={7}
            className="w-full px-2.5 py-2 rounded-sm border border-border bg-background text-[12.5px] text-foreground outline-none focus:border-primary/40 transition-colors resize-vertical leading-relaxed"
          />
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────
// State: SENDING
// ─────────────────────────────────────────────────────────────────
function SendingState() {
  const drafts = useBatchOutreachStore((s) => s.drafts);
  const progress = useBatchOutreachStore((s) => s.progress);
  const draftList = useMemo(
    () => Array.from(drafts.values()).filter((d) => d.approved),
    [drafts],
  );
  return (
    <div className="space-y-3">
      <div className="rounded-sm border border-border bg-card/40 px-3 py-2">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10.5px] uppercase tracking-[0.14em] font-mono text-foreground/55">
            Progress
          </span>
          <span className="ml-auto text-[12px] font-mono tabular-nums text-foreground">
            {progress.current} / {progress.total}
          </span>
        </div>
        <div className="h-1 rounded-full bg-foreground/[0.08] overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      <ul className="list-none p-0 m-0 space-y-1.5">
        {draftList.map((d) => (
          <li
            key={d.investor_id}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-sm border border-border bg-card/40"
          >
            <StatusIcon status={d.status} />
            <span className="text-[12px] font-semibold text-foreground truncate flex-1">
              {d.firm_name}
            </span>
            <span className="text-[10.5px] text-foreground/55 truncate">
              → {d.partner_email}
            </span>
            {d.error && (
              <span
                className="text-[10.5px] text-destructive truncate max-w-[30%]"
                title={d.error}
              >
                {d.error}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusIcon({ status }: { status: BatchDraft["status"] }) {
  if (status === "sent")
    return <CheckCircle2 size={12} className="text-emerald-500 flex-shrink-0" />;
  if (status === "sending")
    return (
      <Loader2
        size={12}
        className="animate-spin text-primary flex-shrink-0"
      />
    );
  if (status === "failed")
    return <XCircle size={12} className="text-destructive flex-shrink-0" />;
  if (status === "skipped")
    return <X size={12} className="text-foreground/40 flex-shrink-0" />;
  return <Mail size={12} className="text-foreground/40 flex-shrink-0" />;
}

// ─────────────────────────────────────────────────────────────────
// State: DONE
// ─────────────────────────────────────────────────────────────────
function DoneState({ onClose }: { onClose: () => void }) {
  const drafts = useBatchOutreachStore((s) => s.drafts);
  const list = Array.from(drafts.values());
  const sent = list.filter((d) => d.status === "sent").length;
  const failed = list.filter((d) => d.status === "failed").length;
  const skipped = list.filter((d) => d.status === "skipped").length;
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div
        className={
          "inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 " +
          (failed === 0 && skipped === 0
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-primary/15 text-primary")
        }
      >
        <CheckCircle2 size={22} />
      </div>
      <h3 className="text-[14px] font-semibold text-foreground mb-1 m-0">
        Sent {sent} emails
      </h3>
      {(failed > 0 || skipped > 0) && (
        <p className="text-[11.5px] text-foreground/55 max-w-sm">
          {failed > 0 && `${failed} failed. `}
          {skipped > 0 && `${skipped} skipped (aborted).`}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 inline-flex items-center gap-1.5 px-3 h-8 rounded-sm bg-primary text-primary-foreground text-[11.5px] font-bold uppercase tracking-wider hover:opacity-90 transition-opacity"
      >
        Close
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Draft + send pipelines (extracted so the footer button handlers
// stay readable)
// ─────────────────────────────────────────────────────────────────

/** Parallel draft pass. For each selected investor, load the
 *  detail (we need partners + activities for the prompt) then
 *  call Axon. Promise.allSettled so one failure doesn't tank
 *  the rest. */
async function runParallelDraft(args: {
  setStage: (s: any) => void;
  setDraftError: (s: string | null) => void;
  setProgress: (c: number, t: number) => void;
}) {
  const { selectedIds, drafts: _existing } =
    useBatchOutreachStore.getState();
  const ids = Array.from(selectedIds);
  if (ids.length === 0) return;

  args.setStage("drafting");
  args.setDraftError(null);
  args.setProgress(0, ids.length);

  // We need the operator's settings + each investor's detail.
  const { data: sessionRes } =
    await companySupabase.auth.getSession();
  if (!sessionRes.session) {
    args.setDraftError("Not signed in.");
    args.setStage("picker");
    return;
  }

  // Load operator settings once.
  const settingsRes = await companySupabase
    .from("fundraise_settings")
    .select("*")
    .maybeSingle();
  const settings = settingsRes.data ?? null;

  let completed = 0;
  const results = await Promise.allSettled(
    ids.map(async (investor_id) => {
      const detail = await loadInvestorDetailForBatch(investor_id);
      if (!detail) throw new Error("Investor detail load failed.");
      const partner = detail.partners.find((p) => p.email);
      if (!partner) throw new Error("No partner with email.");
      const mode: DraftMode = deriveMode(detail);
      const result = await draftInvestorEmail({
        investor: detail,
        partnerId: partner.id,
        settings,
        channel: "email",
        angle: "thesis",
        mode,
      });
      if (result.error) throw new Error(result.error);
      completed += 1;
      args.setProgress(completed, ids.length);
      return makeBatchDraft({
        investor_id: detail.id,
        firm_name: detail.company.name,
        partner_id: partner.id,
        partner_name: partner.name ?? "Unnamed",
        partner_email: partner.email!,
        result,
      });
    }),
  );

  const successful: BatchDraft[] = [];
  let failedCount = 0;
  for (const r of results) {
    if (r.status === "fulfilled") successful.push(r.value);
    else failedCount += 1;
  }

  if (successful.length === 0) {
    args.setDraftError(
      `All ${failedCount} drafts failed. Check pitch settings + partner emails.`,
    );
    args.setStage("picker");
    return;
  }

  useBatchOutreachStore.getState().setDrafts(successful);
  args.setStage("review");
}

/** Sequential send with 2.5s spacing. Per-row state + abort check
 *  between rows. */
async function runSequentialSend(args: {
  drafts: Map<string, BatchDraft>;
  patchDraft: (id: string, patch: Partial<BatchDraft>) => void;
  setProgress: (c: number, t: number) => void;
  setStage: (s: any) => void;
  sendMut: ReturnType<typeof useSendEmail>;
  updateInvestorMut: ReturnType<typeof useUpdateInvestor>;
  settings: any;
}) {
  const approved = Array.from(args.drafts.values()).filter((d) => d.approved);
  if (approved.length === 0) return;

  args.setStage("sending");
  args.setProgress(0, approved.length);

  for (let i = 0; i < approved.length; i++) {
    const draft = approved[i]!;

    // Abort check between rows.
    if (useBatchOutreachStore.getState().aborted) {
      // Mark the rest as skipped.
      for (let j = i; j < approved.length; j++) {
        args.patchDraft(approved[j]!.investor_id, { status: "skipped" });
      }
      break;
    }

    args.patchDraft(draft.investor_id, { status: "sending" });

    try {
      const res = await args.sendMut.mutateAsync({
        to: draft.partner_email,
        subject: draft.subject,
        body: draft.body,
        contact_id: draft.partner_id,
        from_alias: args.settings?.default_send_alias ?? undefined,
        from_display_name: args.settings?.founder_name ?? undefined,
      });
      args.patchDraft(draft.investor_id, {
        status: "sent",
        thread_id: res.thread_id,
      });
      // Same post-send hook as single-send: bump pipeline + schedule
      // next followup. Best-effort -- a failure here doesn't undo
      // the send.
      try {
        await applyPostSendHook(
          draft.investor_id,
          args.updateInvestorMut,
          args.settings,
        );
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      args.patchDraft(draft.investor_id, {
        status: "failed",
        error: e?.message ?? "Send failed",
      });
    }

    args.setProgress(i + 1, approved.length);

    // Spacing between sends, except after the last one.
    if (i < approved.length - 1) {
      await new Promise<void>((r) => setTimeout(r, SEND_SPACING_MS));
    }
  }

  args.setStage("done");
}

// ─────────────────────────────────────────────────────────────────
// Helpers (extracted for testability)
// ─────────────────────────────────────────────────────────────────

/** Load enough of an InvestorDetail for draftInvestorEmail. We
 *  inline the query rather than calling useInvestor because hooks
 *  can't run in a Promise.allSettled loop. */
async function loadInvestorDetailForBatch(
  id: string,
): Promise<InvestorDetail | null> {
  const { data: profile, error } = await companySupabase
    .from("investor_profiles")
    .select(
      `
      *,
      company:crm_companies!inner (id, name, domain, linkedin_url, website)
    `,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !profile) return null;
  const company = (profile as any).company;
  const partnersRes = await companySupabase
    .from("crm_contacts")
    .select("*")
    .eq("company_id", company.id);
  const activitiesRes = await companySupabase
    .from("crm_activities")
    .select("*")
    .in("contact_id", (partnersRes.data ?? []).map((p: any) => p.id))
    .order("happened_at", { ascending: false })
    .limit(20);
  return {
    ...(profile as any),
    company_name: company.name,
    company_domain: company.domain,
    company_linkedin: company.linkedin_url,
    partner_count: (partnersRes.data ?? []).length,
    company,
    partners: partnersRes.data ?? [],
    activities: activitiesRes.data ?? [],
  } as InvestorDetail;
}

/** Same mode-derivation logic as DraftEmailModal -- repeated here
 *  rather than imported to avoid a circular dep. */
function deriveMode(detail: InvestorDetail): DraftMode {
  const count = (detail as any).followup_count ?? 0;
  if (count <= 0) return "cold";
  if (count === 1) return "followup_1";
  if (count === 2) return "followup_2";
  return "followup_3";
}

/** Bump pipeline + schedule next followup. Mirrors the post-send
 *  hook in InvestorDrawer.handleSent. */
async function applyPostSendHook(
  investor_id: string,
  updateMut: ReturnType<typeof useUpdateInvestor>,
  settings: any,
) {
  const now = new Date();
  // Re-read current row to get the actual followup_count + stage
  // (the cached list may be stale).
  const { data: profile } = await companySupabase
    .from("investor_profiles")
    .select("pipeline_stage, followup_count")
    .eq("id", investor_id)
    .maybeSingle();
  if (!profile) return;

  const patch: any = { last_outreach_at: now.toISOString() };
  if (
    profile.pipeline_stage === "prospected" ||
    profile.pipeline_stage === "researched"
  ) {
    patch.pipeline_stage = "reaching_out";
  }
  const newCount = (profile.followup_count ?? 0) + 1;
  patch.followup_count = Math.min(newCount, 3);

  let nextDays: number | null = null;
  if (newCount === 1) nextDays = settings?.followup_days_first ?? 3;
  else if (newCount === 2) nextDays = settings?.followup_days_second ?? 7;
  else if (newCount === 3) nextDays = settings?.followup_days_third ?? 14;
  if (nextDays != null) {
    const next = new Date(now);
    next.setDate(next.getDate() + nextDays);
    patch.next_followup_at = next.toISOString();
  } else {
    patch.next_followup_at = null;
  }

  updateMut.mutate({ id: investor_id, patch });
}
