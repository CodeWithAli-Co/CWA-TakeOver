/**
 * QuickSendToast.tsx — bottom-right status panel for ⚡ Quick Send.
 *
 * For each entry in quickSendStore, renders a small card showing live
 * status (drafting / sending / sent / failed). A per-entry effect
 * runs the actual draft + send pipeline when the entry first appears
 * with status: "drafting".
 *
 * Mount once at the FundraisePage root. The store survives across
 * tab/view switches inside Fundraise but resets on full route change
 * (zustand default behavior).
 */

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, XCircle, X, Send } from "lucide-react";

import {
  useQuickSendStore,
  type QuickSendEntry,
} from "./quickSendStore";
import { useSendEmail } from "@/stores/gmail";
import {
  useUpdateInvestor,
  type InvestorPipelineStage,
} from "@/stores/investors";
import { useMyFundraiseSettings } from "@/stores/fundraiseSettings";
import {
  draftInvestorEmail,
  type DraftMode,
  type InvestorDetail,
} from "@/Fundraise/draftInvestorEmail";
import { companySupabase } from "@/routes/index.lazy";

// How long a successful send card lingers before fading out.
// Failures stay until the operator dismisses them so they're not
// missed.
const AUTO_DISMISS_MS = 4000;

export function QuickSendToast() {
  const entries = useQuickSendStore((s) => s.entries);
  const list = Array.from(entries.values()).sort(
    (a, b) => a.startedAt - b.startedAt,
  );
  if (list.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 w-[320px] space-y-2 pointer-events-none">
      <AnimatePresence>
        {list.map((entry) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="pointer-events-auto"
          >
            <QuickSendEntryRow entry={entry} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function QuickSendEntryRow({ entry }: { entry: QuickSendEntry }) {
  const setStatus = useQuickSendStore((s) => s.setStatus);
  const remove = useQuickSendStore((s) => s.remove);
  const sendMut = useSendEmail();
  const updateInvestorMut = useUpdateInvestor();
  const { data: settings } = useMyFundraiseSettings();

  // Run the draft+send pipeline once per entry. Guard with a ref so
  // re-renders (e.g. status updates) don't trigger a second pass.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (entry.status !== "drafting") return;
    startedRef.current = true;

    (async () => {
      try {
        // 1. Load investor detail (needed for the draft prompt).
        const detail = await loadInvestorDetail(entry.investor_id);
        if (!detail) {
          setStatus(entry.id, "failed", "Couldn't load investor.");
          return;
        }
        // 2. Pick draft mode from followup_count -- same logic as the
        //    drawer's DraftEmailModal.
        const mode = deriveMode(detail);
        const draft = await draftInvestorEmail({
          investor: detail,
          partnerId: entry.partner_id,
          channel: "email",
          settings: settings ?? null,
          mode,
        });
        if (draft.error || !draft.body.trim()) {
          setStatus(
            entry.id,
            "failed",
            draft.error ?? "Axon returned an empty draft.",
          );
          return;
        }
        // 3. Send via Gmail using the same mutation as everywhere else.
        setStatus(entry.id, "sending");
        await sendMut.mutateAsync({
          to: entry.partner_email,
          subject: draft.subject,
          body: draft.body,
          contact_id: entry.partner_id,
          from_alias: settings?.default_send_alias ?? undefined,
          from_display_name: settings?.founder_name ?? undefined,
        });
        // 4. Post-send hook: pipeline bump + cadence schedule.
        try {
          await applyPostSendHook(detail, settings, updateInvestorMut);
        } catch {
          /* best-effort -- the send already succeeded */
        }
        setStatus(entry.id, "sent");
      } catch (e: any) {
        setStatus(
          entry.id,
          "failed",
          e?.message ?? "Something failed during quick send.",
        );
      }
    })();
    // We only want this effect to run when the entry first mounts
    // with status "drafting". Deps are intentionally minimal -- the
    // startedRef guards against duplicate runs anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  // Auto-dismiss successful sends after a few seconds. Failed entries
  // stay so the operator notices them.
  useEffect(() => {
    if (entry.status !== "sent") return;
    const t = setTimeout(() => remove(entry.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [entry.status, entry.id, remove]);

  return (
    <div className="rounded-sm border border-border bg-card shadow-xl p-3">
      <div className="flex items-start gap-2.5">
        <StatusIcon status={entry.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] font-semibold text-foreground truncate">
              {entry.firm_name}
            </span>
            <span className="text-[9.5px] font-mono text-foreground/40 uppercase tracking-[0.12em] flex-shrink-0">
              {entry.status}
            </span>
          </div>
          <div className="text-[10.5px] text-foreground/55 truncate mt-0.5">
            to {entry.partner_name}
            <span className="text-foreground/35">
              {" · "}
              {entry.partner_email}
            </span>
          </div>
          <div className="text-[10.5px] mt-1">
            {entry.status === "drafting" && (
              <span className="text-foreground/55">
                Axon is drafting your email…
              </span>
            )}
            {entry.status === "sending" && (
              <span className="text-foreground/55 inline-flex items-center gap-1">
                <Send size={9} /> Sending via Gmail…
              </span>
            )}
            {entry.status === "sent" && (
              <span className="text-emerald-400">
                Sent. Activity logged.
              </span>
            )}
            {entry.status === "failed" && (
              <span className="text-destructive">
                {entry.error ?? "Send failed."}
              </span>
            )}
          </div>
        </div>
        {(entry.status === "sent" || entry.status === "failed") && (
          <button
            type="button"
            onClick={() => remove(entry.id)}
            aria-label="Dismiss"
            className="p-0.5 text-foreground/35 hover:text-foreground/80 transition-colors flex-shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: QuickSendEntry["status"] }) {
  if (status === "sent") {
    return (
      <CheckCircle2 size={14} className="text-emerald-400 mt-0.5 flex-shrink-0" />
    );
  }
  if (status === "failed") {
    return (
      <XCircle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
    );
  }
  return (
    <Loader2
      size={14}
      className="text-primary animate-spin mt-0.5 flex-shrink-0"
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// Helpers (inlined rather than imported from BatchOutreachModal to
// avoid pulling the whole modal tree just for two utility functions)
// ─────────────────────────────────────────────────────────────────

async function loadInvestorDetail(
  id: string,
): Promise<InvestorDetail | null> {
  const { data: profile, error } = await companySupabase
    .from("investor_profiles")
    .select(
      `*, company:crm_companies!inner (id, name, domain, linkedin_url, website)`,
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
    .in(
      "contact_id",
      (partnersRes.data ?? []).map((p: any) => p.id),
    )
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

function deriveMode(detail: InvestorDetail): DraftMode {
  const count = (detail as any).followup_count ?? 0;
  if (count <= 0) return "cold";
  if (count === 1) return "followup_1";
  if (count === 2) return "followup_2";
  return "followup_3";
}

async function applyPostSendHook(
  detail: InvestorDetail,
  settings: any,
  updateMut: ReturnType<typeof useUpdateInvestor>,
): Promise<void> {
  const now = new Date();
  const patch: {
    pipeline_stage?: InvestorPipelineStage;
    last_outreach_at?: string;
    next_followup_at?: string | null;
    followup_count?: number;
  } = { last_outreach_at: now.toISOString() };

  if (
    detail.pipeline_stage === "prospected" ||
    detail.pipeline_stage === "researched"
  ) {
    patch.pipeline_stage = "reaching_out";
  }

  const newCount = ((detail as any).followup_count ?? 0) + 1;
  patch.followup_count = Math.min(newCount, 3);

  let nextDelayDays: number | null = null;
  if (newCount === 1) nextDelayDays = settings?.followup_days_first ?? 3;
  else if (newCount === 2) nextDelayDays = settings?.followup_days_second ?? 7;
  else if (newCount === 3) nextDelayDays = settings?.followup_days_third ?? 14;
  else nextDelayDays = null;

  if (nextDelayDays != null) {
    const next = new Date(now);
    next.setDate(next.getDate() + nextDelayDays);
    patch.next_followup_at = next.toISOString();
  } else {
    patch.next_followup_at = null;
  }

  await updateMut.mutateAsync({ id: detail.id, patch });
}
