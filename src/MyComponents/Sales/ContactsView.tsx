/**
 * ContactsView — searchable contact list with lifecycle filters.
 *
 * Mirrors the editorial pattern from the financial dashboard's
 * Customers tab: mono-uppercase filter pills with emerald underline
 * on active, search input, scrollable row list, click → right-slide
 * detail drawer.
 *
 * Day 8 scope: list + filters + drawer shell. The drawer is fully
 * inline-editable for the same reason the deal drawer is — auto-save
 * on blur per field, no separate save button to click. Activity
 * timeline is live; the composer arrives Day 10.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, X, FileText } from "lucide-react";
import {
  useCrmContacts,
  useCrmContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useActivitiesForContact,
  useCrmCompanies,
  findCompanyByEmailDomain,
  LIFECYCLE_STAGES,
  type LifecycleStage,
  type CrmContact,
} from "@/stores/crm";
import { LifecyclePill } from "./LifecyclePill";
import { useLogActivityDialog } from "./logActivityStore";
import { useSalesDrawer } from "./salesDrawerStore";
import { InlineDeleteButton } from "./InlineDeleteButton";

// ────────────────────────────────────────────────
// Shared chrome
// ────────────────────────────────────────────────
const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const monoNum = "font-mono tabular-nums";

const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  lead:        "Lead",
  mql:         "MQL",
  sql:         "SQL",
  opportunity: "Opportunity",
  customer:    "Customer",
  churned:     "Churned",
};

// ════════════════════════════════════════════
// Main view
// ════════════════════════════════════════════
export const ContactsView: React.FC = () => {
  const [lifecycle, setLifecycle] = useState<LifecycleStage | "all">("all");
  const [search, setSearch] = useState("");
  // Drawer state lives on the shared salesDrawerStore so the contact
  // drawer (mounted at SalesPage root) can be opened from anywhere.
  const openContact = useSalesDrawer((s) => s.openContact);

  // Server-side filter — useCrmContacts already supports the
  // lifecycle + search args, no client-side filtering needed.
  const { data: contacts = [], isLoading } = useCrmContacts({
    lifecycle,
    search,
  });
  const { data: allContacts = [] } = useCrmContacts({});  // for filter counts
  const { data: companies = [] } = useCrmCompanies({});

  const createContact = useCreateContact();

  const companyMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of companies) m.set(c.id, c.name);
    return m;
  }, [companies]);

  // Per-lifecycle counts for the tab strip — computed from the
  // unfiltered fetch so each tab shows total available, not the
  // post-filter remainder.
  const counts = useMemo(() => {
    const acc: Record<LifecycleStage | "all", number> = {
      all: allContacts.length,
      lead: 0, mql: 0, sql: 0, opportunity: 0, customer: 0, churned: 0,
    };
    for (const c of allContacts) acc[c.lifecycle_stage] += 1;
    return acc;
  }, [allContacts]);

  const handleAddContact = () => {
    createContact.mutate(
      { name: null, lifecycle_stage: "lead" },
      {
        onSuccess: (row) => openContact(row.id),
      },
    );
  };

  const cTabs: Array<{
    key: LifecycleStage | "all";
    label: string;
    count: number;
  }> = [
    { key: "all",         label: "All",         count: counts.all         },
    { key: "lead",        label: "Lead",        count: counts.lead        },
    { key: "mql",         label: "MQL",         count: counts.mql         },
    { key: "sql",         label: "SQL",         count: counts.sql         },
    { key: "opportunity", label: "Opportunity", count: counts.opportunity },
    { key: "customer",    label: "Customer",    count: counts.customer    },
    { key: "churned",     label: "Churned",     count: counts.churned     },
  ];

  return (
    <div className="space-y-3">
      <div className={`${tile} overflow-hidden flex flex-col`}>
        {/* Header: eyebrow + serif title + total contacts + "+ Add" */}
        <div className="px-5 pt-5 flex items-baseline gap-3 flex-wrap">
          <div>
            <p className={eyebrow}>Directory</p>
            <h3 className="ed-serif text-[20px] mt-1.5 text-zinc-100">
              Contacts
            </h3>
          </div>
          <span className={`ml-auto text-[14px] text-zinc-100 ${monoNum}`}>
            {allContacts.length}
          </span>
          <button
            onClick={handleAddContact}
            disabled={createContact.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10.5px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-lg transition-colors disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {createContact.isPending ? "Adding…" : "New contact"}
          </button>
        </div>

        {/* Filter strip — same underline-tab pattern as the
            financial dashboard customers list. */}
        <div className="px-5 mt-4 flex items-end justify-between gap-4 border-b border-white/[0.07] flex-wrap">
          <div className="flex flex-wrap">
            {cTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setLifecycle(t.key)}
                className={`relative px-2.5 py-2 text-[10.5px] font-mono uppercase tracking-wider transition-colors ${
                  lifecycle === t.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}{" "}
                <span className={lifecycle === t.key ? "text-emerald-400 ml-1" : "text-zinc-700 ml-1"}>
                  {t.count}
                </span>
                {lifecycle === t.key && (
                  <span className="absolute -bottom-px left-2.5 right-2.5 h-0.5 bg-emerald-400" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 border border-white/[0.07] rounded-lg px-3 py-1.5 bg-black/30 w-64 mb-2">
            <Search className="h-3.5 w-3.5 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full bg-transparent outline-none text-[12px] text-zinc-100 placeholder:text-zinc-700"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-[calc(100vh-340px)] overflow-y-auto">
          {isLoading ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
              Loading…
            </div>
          ) : contacts.length === 0 ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
              {search ? "No contacts match" : "No contacts in this stage"}
            </div>
          ) : (
            contacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                companyName={c.company_id ? companyMap.get(c.company_id) ?? null : null}
                onClick={() => openContact(c.id)}
              />
            ))
          )}
        </div>
      </div>
      {/* ContactDetailDrawer used to be rendered here. It now lives at
          the SalesPage root so the drawer survives tab switches. */}
    </div>
  );
};

// ────────────────────────────────────────────────
// ContactRow — single row in the directory.
// Layout matches the financial dashboard customer rows:
//   · Name (semibold) + email (mono small)
//   · Right side: lifecycle pill + last-contacted relative date
// ────────────────────────────────────────────────
const ContactRow: React.FC<{
  contact: CrmContact;
  companyName: string | null;
  onClick: () => void;
}> = ({ contact, companyName, onClick }) => {
  const lastTouched = contact.last_contacted_at ?? contact.first_touched_at;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors text-left"
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-zinc-100 truncate">
          {contact.name ?? <span className="text-zinc-600 italic">No name</span>}
        </div>
        <div className="text-[11px] font-mono text-zinc-500 truncate">
          {contact.email ?? contact.phone ?? "—"}
          {companyName && (
            <>
              {" · "}
              <span className="text-zinc-400">{companyName}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0 pl-3">
        <LifecyclePill stage={contact.lifecycle_stage} size="sm" />
        <span className="text-[10px] font-mono text-zinc-600">
          {relTime(lastTouched)}
        </span>
      </div>
    </button>
  );
};

// ────────────────────────────────────────────────
// ContactDetailDrawer — same right-slide pattern as DealDetailDrawer.
// Inline edit form + activity timeline.
//
// Zero-prop now — sources activeContactId off the shared
// salesDrawerStore so SalesPage can mount it once globally.
// ────────────────────────────────────────────────
export const ContactDetailDrawer: React.FC = () => {
  const contactId = useSalesDrawer((s) => s.activeContactId);
  const onClose = useSalesDrawer((s) => s.close);
  const isOpen = !!contactId;

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
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden
      />
      <aside
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] bg-zinc-950 border-l border-white/[0.08] transition-transform duration-250 ease-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen && <ContactDrawerContent contactId={contactId} onClose={onClose} />}
      </aside>
    </>
  );
};

const ContactDrawerContent: React.FC<{
  contactId: string;
  onClose: () => void;
}> = ({ contactId, onClose }) => {
  const { data: contact, isLoading } = useCrmContact(contactId);
  const { data: activities = [] } = useActivitiesForContact(contactId);
  const { data: companies = [] } = useCrmCompanies({});
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const openLogActivity = useLogActivityDialog((s) => s.openDialog);

  const [draft, setDraft] = useState<Partial<CrmContact>>({});

  useEffect(() => {
    if (contact) setDraft({});
  }, [contact?.id]);

  if (isLoading || !contact) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-3 bg-zinc-800 rounded w-24" />
        <div className="h-7 bg-zinc-800 rounded w-2/3" />
      </div>
    );
  }

  const current = { ...contact, ...draft };

  const commit = (patch: Partial<CrmContact>) => {
    const dirty: Partial<CrmContact> = {};
    for (const k of Object.keys(patch) as Array<keyof CrmContact>) {
      if (patch[k] !== contact[k]) (dirty as any)[k] = patch[k];
    }
    if (Object.keys(dirty).length === 0) return;
    updateContact.mutate({ id: contact.id, patch: dirty });
  };

  return (
    <div className="px-5 py-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={eyebrow}>Contact</p>
          <div className="flex items-center gap-2">
            <InlineDeleteButton
              label={current.name ? `contact "${current.name}"` : "this contact"}
              disabled={deleteContact.isPending}
              onDelete={async () => {
                await deleteContact.mutateAsync(contact.id);
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
          value={current.name ?? ""}
          onChange={(e) =>
            setDraft((d) => ({ ...d, name: e.target.value || null }))
          }
          onBlur={() => commit({ name: current.name })}
          placeholder="Full name"
          className="w-full bg-transparent ed-serif text-[28px] leading-tight text-zinc-100 outline-none focus:bg-white/[0.02] rounded px-1 -mx-1 placeholder:text-zinc-700"
          style={{ fontFamily: "Newsreader, Georgia, serif" }}
        />

        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          <LifecyclePill stage={current.lifecycle_stage} size="sm" />
          {updateContact.isPending && (
            <span className="text-[10px] font-mono text-zinc-600 ml-auto">
              saving…
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-3">
        <Field label="Email">
          <input
            type="email"
            value={current.email ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, email: e.target.value || null }))
            }
            onBlur={() => {
              // On blur, save email + attempt auto-attribution: if
              // the contact has no company set yet and the email's
              // domain matches an existing crm_companies row, attach
              // them automatically. Saves the user a dropdown trip.
              const patch: Partial<CrmContact> = { email: current.email };
              if (!current.company_id) {
                const match = findCompanyByEmailDomain(current.email, companies);
                if (match) {
                  patch.company_id = match;
                  setDraft((d) => ({ ...d, company_id: match }));
                }
              }
              commit(patch);
            }}
            placeholder="name@company.com"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600"
          />
        </Field>
        <Field label="Phone">
          <input
            type="tel"
            value={current.phone ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, phone: e.target.value || null }))
            }
            onBlur={() => commit({ phone: current.phone })}
            placeholder="+1…"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600"
          />
        </Field>
        <Field label="Title">
          <input
            type="text"
            value={current.title ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, title: e.target.value || null }))
            }
            onBlur={() => commit({ title: current.title })}
            placeholder="Head of Engineering"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Lifecycle">
            <select
              value={current.lifecycle_stage}
              onChange={(e) => {
                const ls = e.target.value as LifecycleStage;
                setDraft((d) => ({ ...d, lifecycle_stage: ls }));
                commit({ lifecycle_stage: ls });
              }}
              className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15]"
            >
              {LIFECYCLE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {LIFECYCLE_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
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
        </div>

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

        <Field label="Notes">
          <textarea
            value={current.notes_md ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, notes_md: e.target.value || null }))
            }
            onBlur={() => commit({ notes_md: current.notes_md })}
            placeholder="Internal notes about this contact…"
            rows={3}
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600 resize-none"
          />
        </Field>
      </section>

      {/* Activity timeline */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <p className={eyebrow}>Timeline</p>
            <h3 className="ed-serif text-[18px] mt-0.5 text-zinc-100">
              Activity
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-zinc-500">
              {activities.length} {activities.length === 1 ? "event" : "events"}
            </span>
            <button
              onClick={() => openLogActivity({ contactId })}
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
            onClick={() => openLogActivity({ contactId })}
            className="w-full border border-dashed border-white/[0.06] rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-center hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-colors"
          >
            <FileText className="h-4 w-4 text-zinc-700" />
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
              <li
                key={a.id}
                className="flex items-start gap-3 py-3 border-b border-white/[0.04] last:border-b-0"
              >
                <div className="mt-0.5 p-1.5 rounded-md bg-white/[0.04] border border-white/[0.05] shrink-0">
                  <FileText className="h-3 w-3 text-zinc-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[12.5px] font-semibold text-zinc-100 truncate">
                      {a.title ?? a.type[0].toUpperCase() + a.type.slice(1)}
                    </p>
                    <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                      {relTime(a.happened_at)}
                    </span>
                  </div>
                  {a.body_md && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 whitespace-pre-wrap">
                      {a.body_md}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// ────────────────────────────────────────────────
// Field — label + input wrapper.
// ────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  /** Trailing action slot — used by the Company field to render a
   *  "→ View" link that jumps to the company drawer. */
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
// Local relTime — small inline copy to avoid pulling shared module
// across two files. Same shape as the dashboard helper.
// ────────────────────────────────────────────────
function relTime(iso: string): string {
  const t = Date.parse(iso);
  if (isNaN(t)) return "";
  const diffMs = Date.now() - t;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default ContactsView;
