/**
 * QuickSendRunner.tsx -- headless pipeline driver for QuickSend
 * entries.
 *
 * Previously the per-entry useEffect that waited for the queue slot
 * and ran loadInvestorDetail -> draftInvestorEmail -> sendMut lived
 * inside the bottom-right QuickSendToast row component. When we
 * moved queue visibility into the Outreach tab (and let the operator
 * switch tabs at will), that became a problem: if the operator was
 * on the Pipeline tab when an entry was enqueued, the row wasn't
 * mounted, so the pipeline never ran. Quick Sends stalled.
 *
 * Fix: split display from execution. This component mounts at the
 * FundraisePage root (regardless of tab) and renders one invisible
 * <Runner key={entry.id} /> per non-terminal entry. The Outreach
 * tab's QueueTile only reads + renders entry state.
 *
 * The pipeline logic below is the same one that lived in
 * QuickSendToast -- preserved verbatim aside from the new patch()
 * calls that capture resolvedSubject/resolvedBody/sentAsAlias for
 * the email-body modal.
 */

import { useEffect, useRef } from "react";
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

export function QuickSendRunner() {
  const entries = useQuickSendStore((s) => s.entries);
  // We only need a runner mounted for entries whose pipeline hasn't
  // resolved yet. Sent / failed rows are inert -- they live in the
  // store as session history and don't need to keep an effect alive.
  const active = Array.from(entries.values()).filter(
    (e) =>
      e.status === "queued" ||
      e.status === "drafting" ||
      e.status === "sending",
  );
  return (
    <>
      {active.map((entry) => (
        <Runner key={entry.id} entry={entry} />
      ))}
    </>
  );
}

function Runner({ entry }: { entry: QuickSendEntry }) {
  const setStatus = useQuickSendStore((s) => s.setStatus);
  const patch = useQuickSendStore((s) => s.patch);
  const sendMut = useSendEmail();
  const updateInvestorMut = useUpdateInvestor();
  const { data: settings } = useMyFundraiseSettings();

  // Same guard pattern as the old toast row: one IIFE per entry,
  // ref-gated against re-runs.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    if (
      entry.status !== "queued" &&
      entry.status !== "drafting" &&
      entry.status !== "sending"
    )
      return;
    startedRef.current = true;

    let waitTimer: ReturnType<typeof setTimeout> | null = null;
    let waitResolve: (() => void) | null = null;

    (async () => {
      try {
        // Wait for the row's queue slot. notBefore was stamped at
        // enqueue time using the rolling queue clock.
        const waitMs = entry.notBefore - Date.now();
        if (waitMs > 0) {
          await new Promise<void>((resolve) => {
            waitResolve = resolve;
            waitTimer = setTimeout(resolve, waitMs);
          });
          if (!useQuickSendStore.getState().entries.has(entry.id)) return;
          setStatus(
            entry.id,
            entry.precomputed_draft ? "sending" : "drafting",
          );
        }

        const detail = await loadInvestorDetail(entry.investor_id);
        if (!detail) {
          setStatus(entry.id, "failed", "Couldn't load investor.");
          patch(entry.id, { finishedAt: Date.now() });
          return;
        }

        let subject: string;
        let body: string;
        if (entry.precomputed_draft) {
          subject = entry.precomputed_draft.subject;
          body = entry.precomputed_draft.body;
        } else {
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
            patch(entry.id, { finishedAt: Date.now() });
            return;
          }
          subject = draft.subject;
          body = draft.body;
        }

        // Stamp the resolved subject + body so the Outreach tab body
        // modal can show what actually got sent per address. Also
        // stamp the "Sent as" alias info for the employee badge.
        patch(entry.id, {
          resolvedSubject: subject,
          resolvedBody: body,
          sentAsAlias: settings?.default_send_alias ?? undefined,
          sentAsDisplayName: settings?.founder_name ?? undefined,
        });

        setStatus(entry.id, "sending");
        await sendMut.mutateAsync({
          to: entry.partner_email,
          subject,
          body,
          contact_id: entry.partner_id,
          from_alias: settings?.default_send_alias ?? undefined,
          from_display_name: settings?.founder_name ?? undefined,
          pattern: entry.pattern ?? "unknown",
        });

        try {
          await applyPostSendHook(detail, settings, updateInvestorMut);
        } catch {
          /* best-effort -- the send already succeeded */
        }
        setStatus(entry.id, "sent");
        patch(entry.id, { finishedAt: Date.now() });
      } catch (e: any) {
        setStatus(
          entry.id,
          "failed",
          e?.message ?? "Something failed during quick send.",
        );
        patch(entry.id, { finishedAt: Date.now() });
      }
    })();

    return () => {
      const stillExists = useQuickSendStore
        .getState()
        .entries.has(entry.id);
      if (stillExists) return;
      if (waitTimer) clearTimeout(waitTimer);
      if (waitResolve) waitResolve();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id]);

  return null;
}

// ─── Helpers (inlined to avoid pulling BatchOutreachModal) ───

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
