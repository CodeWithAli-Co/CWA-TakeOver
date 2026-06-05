/**
 * DealDetailDrawer — right-slide panel for editing a deal + viewing
 * its activity timeline.
 *
 * Day 7 scope:
 *   · Slide-in animation (Tailwind transitions, no framer)
 *   · Editable fields: name, amount, probability, close date, stage,
 *     source, lost reason (only when stage === 'lost')
 *   · Activity timeline read-only — Day 10 wires the composer here
 *   · Saves via useUpdateDeal; auto-saves on blur per field so users
 *     don't lose changes when clicking away
 *
 * Controlled: parent passes `dealId | null` + `onClose`. We re-fetch
 * fresh data inside via useCrmDeal so changes coming in over realtime
 * land in the drawer immediately.
 *
 * Backdrop click + Escape close the drawer; clicks inside don't.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  Phone,
  Mail,
  Calendar as CalendarIcon,
  FileText,
  CheckCircle2,
  MessageSquare,
  Video,
  StickyNote,
  Sparkles,
  Plus,
} from "lucide-react";
import { useLogActivityDialog } from "./logActivityStore";
import { useSalesDrawer } from "./salesDrawerStore";
import { InlineDeleteButton } from "./InlineDeleteButton";
import { DealAiStrip } from "./DealAiStrip";
import {
  useCrmDeal,
  useUpdateDeal,
  useDeleteDeal,
  useActivitiesForDeal,
  useCrmCompanies,
  useCrmContacts,
  DEAL_STAGES,
  formatCrmAmount,
  type CrmDeal,
  type CrmActivity,
  type DealStage,
  type ActivityType,
} from "@/stores/crm";

// ────────────────────────────────────────────────
// Shared chrome
// ────────────────────────────────────────────────
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const monoNum = "font-mono tabular-nums";

const STAGE_LABEL: Record<DealStage, string> = {
  interested:  "Interested",
  demo:        "Demo",
  proposal:    "Proposal",
  negotiation: "Negotiation",
  won:         "Won",
  lost:        "Lost",
};

const STAGE_PILL: Record<DealStage, string> = {
  interested:  "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
  demo:        "bg-blue-500/10 text-blue-300 border-blue-500/20",
  proposal:    "bg-blue-500/15 text-blue-200 border-blue-500/25",
  negotiation: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  won:         "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  lost:        "bg-zinc-500/[0.06] text-zinc-500 border-zinc-500/15",
};

const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  call:    Phone,
  email:   Mail,
  meeting: CalendarIcon,
  note:    StickyNote,
  task:    CheckCircle2,
  demo:    Video,
  sms:     MessageSquare,
};

/** Same relTime helper used by the dashboard activity feed. */
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ════════════════════════════════════════════
// Drawer
//
// Zero-prop component now — pulls active deal id from the shared
// salesDrawerStore so cross-drawer navigation works (a link from
// the deal drawer to a company drawer can clear `activeDealId` and
// set `activeCompanyId` in one call, and both drawers update).
// ════════════════════════════════════════════
export const DealDetailDrawer: React.FC = () => {
  const dealId = useSalesDrawer((s) => s.activeDealId);
  const closeStoreDrawer = useSalesDrawer((s) => s.close);
  const onClose = closeStoreDrawer;
  const isOpen = !!dealId;

  // Escape key closes. Listener only mounts while open so we don't
  // intercept Esc on the rest of the app.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop. Click-anywhere-outside closes. */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />

      {/* Panel. Slides in from the right; max-width caps it on wide
          monitors so the rest of the page stays peripherally visible. */}
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-zinc-950 border-l border-white/[0.08] transition-transform duration-250 ease-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen && <DealDrawerContent dealId={dealId} onClose={onClose} />}
      </aside>
    </>
  );
};

// ────────────────────────────────────────────────
// DealDrawerContent — mounted only when the drawer is open, so the
// query hooks don't fire on every other deal in the kanban.
// ────────────────────────────────────────────────
const DealDrawerContent: React.FC<{
  dealId: string;
  onClose: () => void;
}> = ({ dealId, onClose }) => {
  const { data: deal, isLoading } = useCrmDeal(dealId);
  const { data: activities = [] } = useActivitiesForDeal(dealId);
  const { data: companies = [] } = useCrmCompanies({});
  const { data: contacts = [] } = useCrmContacts({});
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const openLogActivity = useLogActivityDialog((s) => s.openDialog);

  // Local draft state — synced from the server row on first load,
  // then maintained locally so typing doesn't re-render against
  // server data on every keystroke. Save fires on blur (per field)
  // OR via explicit save buttons we add later.
  const [draft, setDraft] = useState<Partial<CrmDeal>>({});

  // Reset draft when the deal id changes or fresh data arrives.
  useEffect(() => {
    if (deal) setDraft({});
  }, [deal?.id]);

  // Companies + contacts maps for the dropdowns and the linked-record
  // labels in the header subtitle. These MUST be declared before the
  // early loading return — otherwise the hook count differs between
  // the loading and loaded render passes and React throws "Rendered
  // more hooks than during the previous render."
  //
  // We read company_id off (draft → deal → null) directly so this
  // hook doesn't need the merged `current` value, which lives below
  // the early return.
  const effectiveCompanyId = draft.company_id ?? deal?.company_id ?? null;
  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.id, c.name);
    return m;
  }, [companies]);
  const contactsForCompany = useMemo(() => {
    if (!effectiveCompanyId) return contacts;
    return contacts.filter((c) => c.company_id === effectiveCompanyId);
  }, [contacts, effectiveCompanyId]);

  if (isLoading || !deal) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-3 bg-zinc-800 rounded w-24" />
        <div className="h-7 bg-zinc-800 rounded w-2/3" />
        <div className="h-3 bg-zinc-800 rounded w-32 mt-6" />
        <div className="h-12 bg-zinc-800 rounded" />
      </div>
    );
  }

  // Merge draft over server data so the form reflects in-flight edits.
  const current = { ...deal, ...draft };

  // Save helper — only fires the mutation if the field actually
  // changed against the server value. Cleared local draft on success.
  const commit = (patch: Partial<CrmDeal>) => {
    const changedKeys = Object.keys(patch) as Array<keyof CrmDeal>;
    const dirty: Partial<CrmDeal> = {};
    for (const k of changedKeys) {
      if (patch[k] !== deal[k]) dirty[k] = patch[k] as any;
    }
    if (Object.keys(dirty).length === 0) return;
    updateDeal.mutate({ id: deal.id, patch: dirty });
  };

  const lostMode = current.stage === "lost";

  return (
    <div className="px-5 py-6 space-y-6">
      {/* Header — eyebrow + close button on top, serif deal title
          underneath. Same shape as the financial dashboard masthead. */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={eyebrow}>Deal</p>
          <div className="flex items-center gap-2">
            <InlineDeleteButton
              label={`deal "${current.name}"`}
              disabled={deleteDeal.isPending}
              onDelete={async () => {
                await deleteDeal.mutateAsync(deal.id);
                onClose();
              }}
            />
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <input
          type="text"
          value={current.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          onBlur={() => commit({ name: current.name })}
          className="w-full bg-transparent ed-serif text-[28px] leading-tight text-zinc-100 outline-none focus:bg-white/[0.02] rounded px-1 -mx-1"
          style={{ fontFamily: "Newsreader, Georgia, serif" }}
        />

        {/* Subtitle line — linked company (clickable → company drawer)
            + current stage pill. */}
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          {current.company_id && companyMap.get(current.company_id) ? (
            <button
              type="button"
              onClick={() => useSalesDrawer.getState().openCompany(current.company_id!)}
              className="text-zinc-400 hover:text-emerald-300 transition-colors underline-offset-2 hover:underline"
              title="Open company"
            >
              {companyMap.get(current.company_id)}
            </button>
          ) : (
            <span className="italic text-zinc-600">No company</span>
          )}
          <span>·</span>
          <span
            className={`inline-flex items-center px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wider rounded border ${STAGE_PILL[current.stage]}`}
          >
            {STAGE_LABEL[current.stage]}
          </span>
          {updateDeal.isPending && (
            <span className="text-[10px] font-mono text-zinc-600 ml-auto">
              saving…
            </span>
          )}
        </div>
      </header>

      {/* Top-line metrics. Amount + probability + close date are the
          numbers anyone forecasting cares about; weighted forecast is
          shown live so editing prob updates it without a save. */}
      <section className="grid grid-cols-2 gap-3">
        <Field label="Amount">
          <NumericInput
            value={(current.amount_cents ?? 0) / 100}
            onChange={(n) =>
              setDraft((d) => ({ ...d, amount_cents: Math.round(n * 100) }))
            }
            onCommit={() => commit({ amount_cents: current.amount_cents })}
            prefix="$"
          />
        </Field>
        <Field label="Probability">
          <NumericInput
            value={current.probability}
            onChange={(n) =>
              setDraft((d) => ({ ...d, probability: Math.max(0, Math.min(100, Math.round(n))) }))
            }
            onCommit={() => commit({ probability: current.probability })}
            suffix="%"
            max={100}
          />
        </Field>
        <Field label="Stage">
          <select
            value={current.stage}
            onChange={(e) => {
              const stage = e.target.value as DealStage;
              setDraft((d) => ({ ...d, stage }));
              commit({ stage });
            }}
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15]"
          >
            {DEAL_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Close date">
          <input
            type="date"
            value={current.close_date_expected ?? ""}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                close_date_expected: e.target.value || null,
              }))
            }
            onBlur={() =>
              commit({ close_date_expected: current.close_date_expected })
            }
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] [color-scheme:dark]"
          />
        </Field>
      </section>

      {/* Weighted forecast strip — the "what's this deal worth in
          expectation right now" callout. Updates live as the user
          changes amount/probability. */}
      <div className="flex items-baseline justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
        <span className={eyebrow}>Weighted</span>
        <span className={`text-[18px] text-emerald-400 ${monoNum}`}>
          {formatCrmAmount(
            Math.round(((current.amount_cents ?? 0) * (current.probability ?? 0)) / 100),
            current.currency ?? "usd",
          )}
        </span>
      </div>

      {/* Linkage — company + contact dropdowns. Contact list narrows
          to people at the chosen company when one is set. Each picker
          gets a sibling "→ view" arrow when a value is set so the
          operator can jump straight to that linked drawer. */}
      <section className="grid grid-cols-1 gap-3">
        <Field
          label="Company"
          action={
            current.company_id ? (
              <button
                type="button"
                onClick={() => useSalesDrawer.getState().openCompany(current.company_id!)}
                className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-emerald-300 transition-colors"
                title="Open company drawer"
              >
                → View
              </button>
            ) : null
          }
        >
          <select
            value={current.company_id ?? ""}
            onChange={(e) => {
              const val = e.target.value || null;
              setDraft((d) => ({ ...d, company_id: val }));
              commit({ company_id: val });
            }}
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15]"
          >
            <option value="">— none —</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Contact"
          action={
            current.contact_id ? (
              <button
                type="button"
                onClick={() => useSalesDrawer.getState().openContact(current.contact_id!)}
                className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 hover:text-emerald-300 transition-colors"
                title="Open contact drawer"
              >
                → View
              </button>
            ) : null
          }
        >
          <select
            value={current.contact_id ?? ""}
            onChange={(e) => {
              const val = e.target.value || null;
              setDraft((d) => ({ ...d, contact_id: val }));
              commit({ contact_id: val });
            }}
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15]"
          >
            <option value="">— none —</option>
            {contactsForCompany.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name ?? c.email ?? "unnamed contact"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Source">
          <input
            type="text"
            value={current.source ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, source: e.target.value || null }))
            }
            onBlur={() => commit({ source: current.source })}
            placeholder="referral, waitlist, cold outreach…"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600"
          />
        </Field>

        {/* Lost-reason — only visible when the deal is marked lost.
            Captures why so the team can review patterns later. */}
        {lostMode && (
          <Field label="Lost reason">
            <textarea
              value={current.lost_reason ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, lost_reason: e.target.value || null }))
              }
              onBlur={() => commit({ lost_reason: current.lost_reason })}
              placeholder="Pricing, timing, lost to competitor…"
              rows={2}
              className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600 resize-none"
            />
          </Field>
        )}
      </section>

      {/* AI assist strip — two buttons that talk to Claude with the
          deal context + activity history. Summarize is single-call
          and renders an inline paragraph; Draft email pops a small
          modal where the rep types intent + gets back subject/body. */}
      <DealAiStrip
        deal={deal}
        activities={activities}
        contact={contacts.find((c) => c.id === current.contact_id) ?? null}
        company={companies.find((c) => c.id === current.company_id) ?? null}
      />

      {/* Activity timeline. "+ Log" opens the global composer
          pre-routed to this deal (and its contact/company, since
          the modal auto-resolves them from the deal). */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className={eyebrow}>Timeline</p>
            <h3 className="ed-serif text-[18px] mt-0.5 text-zinc-100">
              Recent activity
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-500">
              {activities.length} {activities.length === 1 ? "event" : "events"}
            </span>
            <button
              onClick={() => openLogActivity({ dealId })}
              className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-md transition-colors"
            >
              <Plus className="h-3 w-3" />
              Log
            </button>
          </div>
        </div>

        {activities.length === 0 ? (
          <button
            type="button"
            onClick={() => openLogActivity({ dealId })}
            className="w-full border border-dashed border-white/[0.06] rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-center hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-colors"
          >
            <Sparkles className="h-4 w-4 text-zinc-700" />
            <p className="text-[10.5px] font-mono uppercase tracking-wider text-zinc-600">
              No activity logged yet
            </p>
            <p className="text-[11px] text-zinc-600 mt-1">
              Click to log a call, email, or meeting · or use Cmd+K.
            </p>
          </button>
        ) : (
          <ul className="space-y-0">
            {activities.slice(0, 30).map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// ────────────────────────────────────────────────
// ActivityRow — single timeline entry. Lighter chrome than the
// kanban card so the timeline reads as a quiet list, not loud cards.
// ────────────────────────────────────────────────
const ActivityRow: React.FC<{ activity: CrmActivity }> = ({ activity }) => {
  const Icon = ACTIVITY_ICON[activity.type] ?? FileText;
  return (
    <li className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-b-0">
      <div className="mt-0.5 p-1.5 rounded-md bg-white/[0.04] border border-white/[0.05] shrink-0">
        <Icon className="h-3 w-3 text-zinc-300" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12.5px] font-semibold text-zinc-100 truncate">
            {activity.title ?? activity.type[0].toUpperCase() + activity.type.slice(1)}
          </p>
          <span className="text-[10px] font-mono text-zinc-500 shrink-0">
            {relTime(activity.happened_at)}
          </span>
        </div>
        {activity.body_md && (
          <p className="text-[11px] text-zinc-500 mt-0.5 whitespace-pre-wrap">
            {activity.body_md}
          </p>
        )}
        {activity.outcome && (
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mt-1">
            {activity.outcome}
          </p>
        )}
      </div>
    </li>
  );
};

// ────────────────────────────────────────────────
// Field — label + input wrapper used by the form section. Keeps the
// label / input vertical rhythm consistent.
// ────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  /** Optional trailing element placed to the right of the label —
   *  used by the company / contact rows to render the "→ View" link
   *  that jumps to the linked entity's drawer. */
  action?: React.ReactNode;
}> = ({ label, children, action }) => (
  <label className="block">
    <span className={`${eyebrow} flex items-center justify-between mb-1`}>
      <span>{label}</span>
      {action}
    </span>
    {children}
  </label>
);

// ────────────────────────────────────────────────
// NumericInput — controlled number input with optional prefix /
// suffix and a separate onCommit callback so the parent can save
// only when the user finishes editing.
// ────────────────────────────────────────────────
const NumericInput: React.FC<{
  value: number;
  onChange: (n: number) => void;
  onCommit: () => void;
  prefix?: string;
  suffix?: string;
  max?: number;
}> = ({ value, onChange, onCommit, prefix, suffix, max }) => (
  <div className="flex items-center bg-zinc-900 border border-white/[0.08] rounded-md focus-within:border-white/[0.15] transition-colors">
    {prefix && (
      <span className="pl-2 text-[12px] text-zinc-600 font-mono">{prefix}</span>
    )}
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => {
        const n = e.target.value === "" ? 0 : Number(e.target.value);
        if (!Number.isNaN(n)) onChange(n);
      }}
      onBlur={onCommit}
      max={max}
      className={`flex-1 bg-transparent px-2 py-1.5 text-[12px] text-zinc-100 outline-none ${monoNum} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
    />
    {suffix && (
      <span className="pr-2 text-[12px] text-zinc-600 font-mono">{suffix}</span>
    )}
  </div>
);

export default DealDetailDrawer;
