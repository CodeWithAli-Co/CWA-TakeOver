/**
 * CompaniesView — accounts directory + detail drawer.
 *
 * Same editorial pattern as ContactsView: searchable list, click →
 * right-slide drawer with inline-edit form.
 *
 * What's different from contacts:
 *   · No lifecycle filter tabs (companies don't have stages)
 *   · Sort options: alphabetical (default), most-recent-touch,
 *     biggest-pipeline (sums open deals)
 *   · Per-row sidekick stats — open deal count + linked contact
 *     count, both computed client-side via maps so we don't fan
 *     out per-row queries
 *   · Drawer carries TWO sub-lists: "Contacts at this company" and
 *     "Open deals" — both rendered as quiet rows, clickable to
 *     navigate to the linked entity's drawer (cross-entity wiring
 *     comes in Day 10 + 11; for now we log to console)
 */

import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, X, Building2, Users, TrendingUp, Activity as ActivityIcon } from "lucide-react";
import { useLogActivityDialog } from "./logActivityStore";
import { useSalesDrawer } from "./salesDrawerStore";
import { InlineDeleteButton } from "./InlineDeleteButton";
import {
  useCrmCompanies,
  useCrmCompany,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useCrmContacts,
  useCrmDeals,
  formatCrmAmount,
  DEAL_OPEN_STAGES,
  type CrmCompany,
  type CrmDeal,
  type CrmContact,
} from "@/stores/crm";

// ────────────────────────────────────────────────
// Shared chrome
// ────────────────────────────────────────────────
const tile =
  "bg-gradient-to-b from-zinc-800/40 to-zinc-900/70 border border-white/[0.08] rounded-xl hover:border-white/[0.14] transition-colors";
const eyebrow =
  "text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-400 font-medium";
const monoNum = "font-mono tabular-nums";

type SortKey = "alpha" | "recent" | "pipeline";

// ════════════════════════════════════════════
// Main view
// ════════════════════════════════════════════
export const CompaniesView: React.FC = () => {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("alpha");
  // Drawer state lives on the shared salesDrawerStore.
  const openCompany = useSalesDrawer((s) => s.openCompany);

  const { data: companies = [], isLoading } = useCrmCompanies({ search });
  const { data: allContacts = [] } = useCrmContacts({});
  const { data: allDeals = [] } = useCrmDeals();
  const createCompany = useCreateCompany();

  // Per-company sidekick maps for the row stats. Iterated once
  // here so every row's render is O(1) instead of O(n).
  const stats = useMemo(() => {
    const out = new Map<string, {
      openDeals: number;
      pipelineCents: number;
      contactCount: number;
      lastTouchedAt: string | null;
    }>();
    for (const c of companies) {
      out.set(c.id, {
        openDeals: 0,
        pipelineCents: 0,
        contactCount: 0,
        lastTouchedAt: null,
      });
    }
    for (const d of allDeals) {
      if (!d.company_id) continue;
      const row = out.get(d.company_id);
      if (!row) continue;
      if (DEAL_OPEN_STAGES.includes(d.stage)) {
        row.openDeals += 1;
        row.pipelineCents += d.amount_cents;
      }
    }
    for (const p of allContacts) {
      if (!p.company_id) continue;
      const row = out.get(p.company_id);
      if (!row) continue;
      row.contactCount += 1;
      const t = p.last_contacted_at ?? p.first_touched_at;
      if (t && (!row.lastTouchedAt || t > row.lastTouchedAt)) {
        row.lastTouchedAt = t;
      }
    }
    return out;
  }, [companies, allDeals, allContacts]);

  // Apply sort. Search is already handled server-side via the
  // useCrmCompanies search arg.
  const sorted = useMemo(() => {
    const list = [...companies];
    if (sortBy === "alpha") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "recent") {
      list.sort((a, b) => {
        const ta = stats.get(a.id)?.lastTouchedAt ?? "";
        const tb = stats.get(b.id)?.lastTouchedAt ?? "";
        return tb.localeCompare(ta);  // descending
      });
    } else if (sortBy === "pipeline") {
      list.sort((a, b) => {
        const pa = stats.get(a.id)?.pipelineCents ?? 0;
        const pb = stats.get(b.id)?.pipelineCents ?? 0;
        return pb - pa;
      });
    }
    return list;
  }, [companies, sortBy, stats]);

  const handleAddCompany = () => {
    createCompany.mutate(
      { name: "New company" },
      { onSuccess: (row) => openCompany(row.id) },
    );
  };

  const sortTabs: Array<{ key: SortKey; label: string }> = [
    { key: "alpha",    label: "A–Z"        },
    { key: "recent",   label: "Recent"     },
    { key: "pipeline", label: "Pipeline $" },
  ];

  return (
    <div className="space-y-3">
      <div className={`${tile} overflow-hidden flex flex-col`}>
        <div className="px-5 pt-5 flex items-baseline gap-3 flex-wrap">
          <div>
            <p className={eyebrow}>Accounts</p>
            <h3 className="ed-serif text-[20px] mt-1.5 text-zinc-100">
              Companies
            </h3>
          </div>
          <span className={`ml-auto text-[14px] text-zinc-100 ${monoNum}`}>
            {companies.length}
          </span>
          <button
            onClick={handleAddCompany}
            disabled={createCompany.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10.5px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-lg transition-colors disabled:opacity-40"
          >
            <Plus className="h-3 w-3" />
            {createCompany.isPending ? "Adding…" : "New company"}
          </button>
        </div>

        {/* Sort tabs + search */}
        <div className="px-5 mt-4 flex items-end justify-between gap-4 border-b border-white/[0.07] flex-wrap">
          <div className="flex flex-wrap">
            {sortTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setSortBy(t.key)}
                className={`relative px-2.5 py-2 text-[10.5px] font-mono uppercase tracking-wider transition-colors ${
                  sortBy === t.key ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
                {sortBy === t.key && (
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
              placeholder="Search company name…"
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
          ) : sorted.length === 0 ? (
            <div className="py-12 text-center text-[11.5px] font-mono uppercase tracking-wider text-zinc-600">
              {search ? "No companies match" : "No companies yet"}
            </div>
          ) : (
            sorted.map((c) => (
              <CompanyRow
                key={c.id}
                company={c}
                stats={stats.get(c.id) ?? {
                  openDeals: 0,
                  pipelineCents: 0,
                  contactCount: 0,
                  lastTouchedAt: null,
                }}
                onClick={() => openCompany(c.id)}
              />
            ))
          )}
        </div>
      </div>
      {/* CompanyDetailDrawer used to be rendered here. It now lives at
          the SalesPage root so the drawer survives tab switches. */}
    </div>
  );
};

// ────────────────────────────────────────────────
// CompanyRow — single account row with sidekick stats.
// Mirrors the financial dashboard customer row layout: name + meta
// on the left, vertical stack of mono-numeric stats on the right.
// ────────────────────────────────────────────────
const CompanyRow: React.FC<{
  company: CrmCompany;
  stats: {
    openDeals: number;
    pipelineCents: number;
    contactCount: number;
    lastTouchedAt: string | null;
  };
  onClick: () => void;
}> = ({ company, stats, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-5 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors text-left"
  >
    <div className="p-1.5 rounded-md bg-white/[0.04] border border-white/[0.05] shrink-0">
      <Building2 className="h-3 w-3 text-zinc-300" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-[13.5px] font-semibold text-zinc-100 truncate">
        {company.name}
      </div>
      <div className="text-[11px] font-mono text-zinc-500 truncate">
        {company.domain ?? "no domain"}
        {company.industry && (
          <>
            {" · "}
            <span className="text-zinc-400">{company.industry}</span>
          </>
        )}
      </div>
    </div>
    <div className="flex items-baseline gap-4 shrink-0 pl-3">
      {/* Contact count */}
      <div className="text-right">
        <div className={`text-[11px] text-zinc-300 ${monoNum}`}>
          {stats.contactCount}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600">
          {stats.contactCount === 1 ? "contact" : "contacts"}
        </div>
      </div>
      {/* Pipeline $ — emerald when non-zero */}
      <div className="text-right">
        <div className={`text-[11px] ${stats.pipelineCents > 0 ? "text-emerald-400" : "text-zinc-500"} ${monoNum}`}>
          {stats.pipelineCents > 0
            ? formatCrmAmount(stats.pipelineCents, "usd", { compact: true })
            : "—"}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-wider text-zinc-600">
          {stats.openDeals} open
        </div>
      </div>
    </div>
  </button>
);

// ────────────────────────────────────────────────
// CompanyDetailDrawer
//
// Zero-prop now — sources activeCompanyId off the shared
// salesDrawerStore so SalesPage can mount it once globally.
// ────────────────────────────────────────────────
export const CompanyDetailDrawer: React.FC = () => {
  const companyId = useSalesDrawer((s) => s.activeCompanyId);
  const onClose = useSalesDrawer((s) => s.close);
  const isOpen = !!companyId;

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
        className={`fixed top-0 right-0 z-50 h-full w-full sm:w-[520px] bg-zinc-950 border-l border-white/[0.08] transition-transform duration-250 ease-out overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isOpen && <CompanyDrawerContent companyId={companyId} onClose={onClose} />}
      </aside>
    </>
  );
};

const CompanyDrawerContent: React.FC<{
  companyId: string;
  onClose: () => void;
}> = ({ companyId, onClose }) => {
  const { data: company, isLoading } = useCrmCompany(companyId);
  const { data: allContacts = [] } = useCrmContacts({});
  const { data: allDeals = [] } = useCrmDeals();
  const updateCompany = useUpdateCompany();
  const deleteCompany = useDeleteCompany();
  const openLogActivity = useLogActivityDialog((s) => s.openDialog);

  const [draft, setDraft] = useState<Partial<CrmCompany>>({});

  useEffect(() => {
    if (company) setDraft({});
  }, [company?.id]);

  // Linked rows — filtered client-side from already-cached queries
  // so we don't make per-drawer round trips.
  const linkedContacts = useMemo(
    () => allContacts.filter((c) => c.company_id === companyId),
    [allContacts, companyId],
  );
  const linkedDeals = useMemo(
    () => allDeals.filter((d) => d.company_id === companyId),
    [allDeals, companyId],
  );
  const openPipelineCents = useMemo(
    () =>
      linkedDeals
        .filter((d) => DEAL_OPEN_STAGES.includes(d.stage))
        .reduce((s, d) => s + d.amount_cents, 0),
    [linkedDeals],
  );

  if (isLoading || !company) {
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-3 bg-zinc-800 rounded w-24" />
        <div className="h-7 bg-zinc-800 rounded w-2/3" />
      </div>
    );
  }

  const current = { ...company, ...draft };

  const commit = (patch: Partial<CrmCompany>) => {
    const dirty: Partial<CrmCompany> = {};
    for (const k of Object.keys(patch) as Array<keyof CrmCompany>) {
      if (patch[k] !== company[k]) (dirty as any)[k] = patch[k];
    }
    if (Object.keys(dirty).length === 0) return;
    updateCompany.mutate({ id: company.id, patch: dirty });
  };

  return (
    <div className="px-5 py-6 space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={eyebrow}>Company</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openLogActivity({ companyId })}
              className="flex items-center gap-1.5 px-2.5 py-1 border border-white/[0.1] hover:border-emerald-500/40 hover:bg-emerald-500/[0.04] text-[10px] font-mono uppercase tracking-[0.16em] text-zinc-300 hover:text-emerald-300 rounded-md transition-colors"
              title="Log activity for this company"
            >
              <ActivityIcon className="h-3 w-3" />
              Log
            </button>
            <InlineDeleteButton
              label={`company "${current.name}"`}
              disabled={deleteCompany.isPending}
              onDelete={async () => {
                await deleteCompany.mutateAsync(company.id);
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
          placeholder="Company name"
          className="w-full bg-transparent ed-serif text-[28px] leading-tight text-zinc-100 outline-none focus:bg-white/[0.02] rounded px-1 -mx-1 placeholder:text-zinc-700"
          style={{ fontFamily: "Newsreader, Georgia, serif" }}
        />

        <div className="flex items-center gap-3 text-[12px] text-zinc-500">
          {current.domain && (
            <a
              href={`https://${current.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-emerald-400 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {current.domain} ↗
            </a>
          )}
          {updateCompany.isPending && (
            <span className="text-[10px] font-mono text-zinc-600 ml-auto">
              saving…
            </span>
          )}
        </div>
      </header>

      {/* Top stat strip — open pipeline + linked record counts. The
          three numbers anyone looking at a company first wants. */}
      <section className="grid grid-cols-3 gap-2">
        <Stat
          eyebrowLabel="Open pipeline"
          value={
            openPipelineCents > 0
              ? formatCrmAmount(openPipelineCents, "usd", { compact: true })
              : "—"
          }
          tone={openPipelineCents > 0 ? "emerald" : "neutral"}
        />
        <Stat
          eyebrowLabel="Deals"
          value={String(linkedDeals.length)}
        />
        <Stat
          eyebrowLabel="Contacts"
          value={String(linkedContacts.length)}
        />
      </section>

      {/* Edit form */}
      <section className="grid grid-cols-1 gap-3">
        <Field label="Domain">
          <input
            type="text"
            value={current.domain ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, domain: e.target.value || null }))
            }
            onBlur={() => commit({ domain: current.domain })}
            placeholder="acme.com"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Industry">
            <input
              type="text"
              value={current.industry ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, industry: e.target.value || null }))
              }
              onBlur={() => commit({ industry: current.industry })}
              placeholder="SaaS, Healthcare…"
              className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600"
            />
          </Field>
          <Field label="Size">
            <input
              type="number"
              value={current.size_employees ?? ""}
              onChange={(e) => {
                const n = e.target.value === "" ? null : Number(e.target.value);
                setDraft((d) => ({ ...d, size_employees: n }));
              }}
              onBlur={() => commit({ size_employees: current.size_employees })}
              placeholder="employees"
              className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </Field>
        </div>
        <Field label="Website">
          <input
            type="url"
            value={current.website ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, website: e.target.value || null }))
            }
            onBlur={() => commit({ website: current.website })}
            placeholder="https://…"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600"
          />
        </Field>
        <Field label="LinkedIn">
          <input
            type="url"
            value={current.linkedin_url ?? ""}
            onChange={(e) =>
              setDraft((d) => ({ ...d, linkedin_url: e.target.value || null }))
            }
            onBlur={() => commit({ linkedin_url: current.linkedin_url })}
            placeholder="https://linkedin.com/company/…"
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
            placeholder="Account notes — competitors, key contacts, history…"
            rows={3}
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1.5 text-[12px] text-zinc-100 outline-none focus:border-white/[0.15] placeholder:text-zinc-600 resize-none"
          />
        </Field>
      </section>

      {/* Linked contacts */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <Users className="h-3 w-3 text-zinc-500 self-center" />
            <p className={eyebrow}>People at {current.name}</p>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {linkedContacts.length}
          </span>
        </div>
        {linkedContacts.length === 0 ? (
          <p className="text-[11px] text-zinc-600 italic">No contacts linked yet.</p>
        ) : (
          <ul className="space-y-0 border border-white/[0.05] rounded-lg overflow-hidden">
            {linkedContacts.slice(0, 10).map((c) => (
              <LinkedContactRow key={c.id} contact={c} />
            ))}
          </ul>
        )}
      </section>

      {/* Linked deals */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <TrendingUp className="h-3 w-3 text-zinc-500 self-center" />
            <p className={eyebrow}>Deals</p>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {linkedDeals.length}
          </span>
        </div>
        {linkedDeals.length === 0 ? (
          <p className="text-[11px] text-zinc-600 italic">No deals linked yet.</p>
        ) : (
          <ul className="space-y-0 border border-white/[0.05] rounded-lg overflow-hidden">
            {linkedDeals.slice(0, 10).map((d) => (
              <LinkedDealRow key={d.id} deal={d} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

// ────────────────────────────────────────────────
// Stat — small 3-up cell used in the drawer's top strip.
// ────────────────────────────────────────────────
const Stat: React.FC<{
  eyebrowLabel: string;
  value: string;
  tone?: "emerald" | "neutral";
}> = ({ eyebrowLabel, value, tone = "neutral" }) => (
  <div className="border border-white/[0.05] rounded-lg p-3 flex flex-col gap-1">
    <p className={eyebrow}>{eyebrowLabel}</p>
    <p
      className={`text-[16px] tracking-tight ${monoNum} ${
        tone === "emerald" ? "text-emerald-400" : "text-zinc-100"
      }`}
    >
      {value}
    </p>
  </div>
);

// ────────────────────────────────────────────────
// LinkedContactRow / LinkedDealRow — clickable rows for the drawer's
// cross-entity lists. Clicking a row hot-swaps the drawer to the
// linked entity via salesDrawerStore.openContact / openDeal.
// ────────────────────────────────────────────────
const LinkedContactRow: React.FC<{ contact: CrmContact }> = ({ contact }) => {
  const openContact = useSalesDrawer((s) => s.openContact);
  return (
    <li className="border-b border-white/[0.04] last:border-b-0">
      <button
        type="button"
        onClick={() => openContact(contact.id)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors text-[11.5px] text-left"
      >
        <span className="text-zinc-200 font-medium truncate">
          {contact.name ?? <span className="italic text-zinc-600">No name</span>}
          {contact.title && (
            <span className="text-zinc-500 font-normal ml-1.5">· {contact.title}</span>
          )}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 shrink-0">
          {contact.lifecycle_stage}
        </span>
      </button>
    </li>
  );
};

const LinkedDealRow: React.FC<{ deal: CrmDeal }> = ({ deal }) => {
  const openDeal = useSalesDrawer((s) => s.openDeal);
  const isOpen = DEAL_OPEN_STAGES.includes(deal.stage);
  return (
    <li className="border-b border-white/[0.04] last:border-b-0">
      <button
        type="button"
        onClick={() => openDeal(deal.id)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/[0.02] transition-colors text-[11.5px] text-left"
      >
        <span className="text-zinc-200 font-medium truncate">{deal.name}</span>
        <div className="flex items-baseline gap-3 shrink-0">
          <span
            className={`${monoNum} ${
              deal.stage === "won"
                ? "text-emerald-400"
                : deal.stage === "lost"
                  ? "text-zinc-600"
                  : "text-zinc-300"
            }`}
          >
            {formatCrmAmount(deal.amount_cents, deal.currency, { compact: true })}
          </span>
          <span
            className={`text-[10px] font-mono uppercase tracking-wider ${
              isOpen ? "text-zinc-500" : "text-zinc-700"
            }`}
          >
            {deal.stage}
          </span>
        </div>
      </button>
    </li>
  );
};

// ────────────────────────────────────────────────
// Field — label + input wrapper.
// ────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <label className="block">
    <span className={`${eyebrow} block mb-1`}>{label}</span>
    {children}
  </label>
);

export default CompaniesView;
