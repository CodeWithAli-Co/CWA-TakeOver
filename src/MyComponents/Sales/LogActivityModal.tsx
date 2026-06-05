/**
 * LogActivityModal.tsx — Global activity composer.
 *
 * Single source of truth for creating a crm_activity row. The modal
 * floats above the app (z-60), reads its prefill payload from
 * useLogActivityDialog, and writes via useLogActivity().
 *
 * Why "global" instead of inline per drawer? Three reasons:
 *   1. The Cmd+K palette needs to open this from anywhere, so it
 *      has to live above the routed tree.
 *   2. Every drawer (deal / contact / company) calls it with a
 *      one-line prefill — DRY beats three nearly-identical inline
 *      forms.
 *   3. Mounting once at root means the modal's queries (lookups
 *      for contact/deal/company autocomplete) are warm whenever
 *      the operator opens it from anywhere.
 *
 * Composer shape:
 *   · Type row (icon pills) — call / email / meeting / note / task / demo / sms
 *   · Target row — if prefill set one, lock it; otherwise show
 *     three slim autocomplete pickers (contact / deal / company)
 *   · Title — short one-liner
 *   · Body — multi-line markdown notes
 *   · Outcome — optional ("Interested", "Voicemail", "No response"…)
 *   · Save / Cancel
 *
 * Keyboard:
 *   · Cmd+Enter to save
 *   · Esc to close (already handled at modal level)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Phone, Mail, Calendar as CalendarIcon, StickyNote, CheckCircle2,
  Video, MessageSquare, X, Send, Search,
} from "lucide-react";
import { useLogActivityDialog } from "./logActivityStore";
import {
  ACTIVITY_TYPES,
  useLogActivity,
  useCrmContacts,
  useCrmDeals,
  useCrmCompanies,
  type ActivityType,
  type CrmContact,
  type CrmDeal,
  type CrmCompany,
} from "@/stores/crm";

const TYPE_META: Record<ActivityType, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  call:    { label: "Call",    icon: Phone },
  email:   { label: "Email",   icon: Mail },
  meeting: { label: "Meeting", icon: CalendarIcon },
  note:    { label: "Note",    icon: StickyNote },
  task:    { label: "Task",    icon: CheckCircle2 },
  demo:    { label: "Demo",    icon: Video },
  sms:     { label: "SMS",     icon: MessageSquare },
};

// Common per-type outcome chips — clicking sets the outcome field.
// Empty list ⇒ field stays free-text only. Notes / tasks intentionally
// omitted (outcome doesn't really apply).
const OUTCOME_CHIPS: Partial<Record<ActivityType, string[]>> = {
  call:    ["Connected", "Voicemail", "No answer", "Interested", "Not interested"],
  email:   ["Sent", "Replied", "No response", "Bounced"],
  meeting: ["Held", "No-show", "Rescheduled"],
  demo:    ["Held", "Strong fit", "Weak fit", "No-show"],
  sms:     ["Sent", "Replied", "No response"],
};

export function LogActivityModal() {
  const { open, prefill, closeDialog } = useLogActivityDialog();
  const logActivity = useLogActivity();

  // Catalogs for the picker rows. We pull the FULL lists once and
  // filter client-side because per-keystroke server search would
  // feel laggier than fuzzy-matching ~hundreds of rows in memory.
  const { data: contacts = [] } = useCrmContacts({});
  const { data: deals = [] } = useCrmDeals();
  const { data: companies = [] } = useCrmCompanies();

  // Local form state
  const [type, setType] = useState<ActivityType>("call");
  const [contactId, setContactId] = useState<string | null>(null);
  const [dealId, setDealId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [outcome, setOutcome] = useState("");
  const [error, setError] = useState<string | null>(null);

  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Reset form whenever the modal opens — and seed it with whatever
  // prefill the caller passed in. We special-case "if no contact was
  // prefilled but a deal was, auto-route the contact picker to the
  // deal's primary_contact". Same for company. This keeps the form
  // unsurprising: opening "Log activity" from a deal drawer should
  // already know which contact + company it's about.
  useEffect(() => {
    if (!open) return;
    setType(prefill.type ?? "call");
    setTitle(prefill.title ?? "");
    setBody("");
    setOutcome("");
    setError(null);

    let resolvedContactId = prefill.contactId ?? null;
    let resolvedDealId    = prefill.dealId ?? null;
    let resolvedCompanyId = prefill.companyId ?? null;

    if (resolvedDealId && !resolvedContactId) {
      const d = deals.find((x) => x.id === resolvedDealId);
      if (d?.contact_id) resolvedContactId = d.contact_id;
      if (d?.company_id && !resolvedCompanyId) resolvedCompanyId = d.company_id;
    }
    if (resolvedContactId && !resolvedCompanyId) {
      const c = contacts.find((x) => x.id === resolvedContactId);
      if (c?.company_id) resolvedCompanyId = c.company_id;
    }

    setContactId(resolvedContactId);
    setDealId(resolvedDealId);
    setCompanyId(resolvedCompanyId);

    // Focus the title field after the modal animates in.
    requestAnimationFrame(() => titleRef.current?.focus());
  }, [open, prefill, deals, contacts]);

  // Esc + Cmd+Enter shortcuts. Cmd+Enter saves; Esc closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeDialog();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, contactId, dealId, companyId, title, body, outcome]);

  const hasTarget = !!(contactId || dealId || companyId);
  const canSave = hasTarget && !logActivity.isPending;

  const handleSave = async () => {
    if (!canSave) {
      setError("Pick at least one target (contact, deal, or company)");
      return;
    }
    setError(null);
    try {
      await logActivity.mutateAsync({
        type,
        contact_id: contactId,
        deal_id: dealId,
        company_id: companyId,
        title: title.trim() || null,
        body_md: body.trim() || null,
        outcome: outcome.trim() || null,
      });
      closeDialog();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to log activity");
    }
  };

  // Pre-compute lookup names so the locked-target chips and the
  // suggestion lists can render without an extra .find() per row.
  const contactById = useMemo(() => {
    const m = new Map<string, CrmContact>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);
  const dealById = useMemo(() => {
    const m = new Map<string, CrmDeal>();
    for (const d of deals) m.set(d.id, d);
    return m;
  }, [deals]);
  const companyById = useMemo(() => {
    const m = new Map<string, CrmCompany>();
    for (const c of companies) m.set(c.id, c);
    return m;
  }, [companies]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-[8vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
        >
          {/* Backdrop */}
          <div
            onClick={closeDialog}
            className="absolute inset-0 bg-black/55 backdrop-blur-sm"
          />
          {/* Sheet */}
          <motion.div
            className="relative w-full max-w-[560px] rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-zinc-950/95 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)] overflow-hidden"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            style={{ fontFamily: "Newsreader, Georgia, serif" }}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-white/[0.06]">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500 font-medium">
                  Sales · activity
                </p>
                <h2 className="ed-serif text-[20px] text-zinc-100 leading-tight mt-0.5">
                  Log an activity
                </h2>
              </div>
              <button
                onClick={closeDialog}
                className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Type row */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">
                  Type
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ACTIVITY_TYPES.map((t) => {
                    const meta = TYPE_META[t];
                    const Icon = meta.icon;
                    const active = t === type;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px] font-mono uppercase tracking-wider transition-colors ${
                          active
                            ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-200"
                            : "border-white/[0.07] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.14]"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Targets — 3 slim autocompletes */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">
                  Linked to
                  {!hasTarget && (
                    <span className="text-amber-400/80 ml-2 normal-case tracking-normal">
                      pick at least one
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  <TargetPicker
                    label="Contact"
                    placeholder="Search contacts…"
                    selected={contactId ? contactById.get(contactId) ?? null : null}
                    selectedLabel={(c: CrmContact) =>
                      c.name ?? c.email ?? "Untitled contact"
                    }
                    onClear={() => setContactId(null)}
                    options={contacts}
                    matchFn={(c, q) =>
                      `${c.name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q)
                    }
                    renderOption={(c: CrmContact) => (
                      <>
                        <span className="text-zinc-200">{c.name ?? "—"}</span>
                        {c.email && (
                          <span className="text-zinc-500 font-mono text-[10.5px] ml-2">
                            {c.email}
                          </span>
                        )}
                      </>
                    )}
                    onSelect={(c) => {
                      setContactId(c.id);
                      // Bubble up the company if we know it and the
                      // operator hasn't set one yet.
                      if (c.company_id && !companyId) setCompanyId(c.company_id);
                    }}
                  />
                  <TargetPicker
                    label="Deal"
                    placeholder="Search deals…"
                    selected={dealId ? dealById.get(dealId) ?? null : null}
                    selectedLabel={(d: CrmDeal) => d.name}
                    onClear={() => setDealId(null)}
                    options={deals}
                    matchFn={(d, q) => d.name.toLowerCase().includes(q)}
                    renderOption={(d: CrmDeal) => (
                      <>
                        <span className="text-zinc-200">{d.name}</span>
                        <span className="text-zinc-600 font-mono text-[10.5px] ml-2 uppercase tracking-wider">
                          {d.stage}
                        </span>
                      </>
                    )}
                    onSelect={(d) => {
                      setDealId(d.id);
                      if (d.contact_id && !contactId)
                        setContactId(d.contact_id);
                      if (d.company_id && !companyId)
                        setCompanyId(d.company_id);
                    }}
                  />
                  <TargetPicker
                    label="Company"
                    placeholder="Search companies…"
                    selected={companyId ? companyById.get(companyId) ?? null : null}
                    selectedLabel={(c: CrmCompany) => c.name}
                    onClear={() => setCompanyId(null)}
                    options={companies}
                    matchFn={(c, q) =>
                      `${c.name} ${c.domain ?? ""}`.toLowerCase().includes(q)
                    }
                    renderOption={(c: CrmCompany) => (
                      <>
                        <span className="text-zinc-200">{c.name}</span>
                        {c.domain && (
                          <span className="text-zinc-500 font-mono text-[10.5px] ml-2">
                            {c.domain}
                          </span>
                        )}
                      </>
                    )}
                    onSelect={(c) => setCompanyId(c.id)}
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
                  Title
                </p>
                <input
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g. ${
                    type === "call"   ? "Discovery call — pricing concerns"
                    : type === "email" ? "Sent follow-up with proposal"
                    : type === "meeting" ? "Q4 kickoff with stakeholders"
                    : type === "demo" ? "Product demo — main use cases"
                    : "Short summary"
                  }`}
                  className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[13px] text-zinc-100 outline-none focus:border-white/[0.18] placeholder:text-zinc-600"
                />
              </div>

              {/* Body */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
                  Notes
                </p>
                <textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  placeholder="What happened? Key takeaways, next steps…"
                  className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-white/[0.18] placeholder:text-zinc-600 resize-none leading-relaxed"
                />
              </div>

              {/* Outcome */}
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">
                  Outcome <span className="text-zinc-700 normal-case tracking-normal">optional</span>
                </p>
                <input
                  type="text"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  placeholder="Connected / Voicemail / Interested…"
                  className="w-full bg-zinc-900/60 border border-white/[0.08] rounded-md px-3 py-2 text-[12.5px] text-zinc-100 outline-none focus:border-white/[0.18] placeholder:text-zinc-600"
                />
                {OUTCOME_CHIPS[type] && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {OUTCOME_CHIPS[type]!.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setOutcome(chip)}
                        className={`px-2 py-0.5 rounded-full border text-[10.5px] font-mono uppercase tracking-wider transition-colors ${
                          outcome === chip
                            ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-200"
                            : "border-white/[0.07] text-zinc-500 hover:text-zinc-300 hover:border-white/[0.14]"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-[11.5px] text-amber-300/90 font-mono">
                  {error}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between gap-3 bg-black/30">
              <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                {logActivity.isPending ? "Saving…" : "Cmd+Enter to save"}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/[0.12] text-emerald-200 hover:bg-emerald-500/[0.18] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send className="h-3 w-3" />
                  Log activity
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ────────────────────────────────────────────────
// TargetPicker — generic single-select autocomplete.
//
// Two states:
//   · empty       → text input + dropdown of matches
//   · selected    → chip with × to clear
//
// Generic over the option type so the same component handles
// contacts, deals, and companies.
// ────────────────────────────────────────────────
interface TargetPickerProps<T> {
  label: string;
  placeholder: string;
  selected: T | null;
  selectedLabel: (item: T) => string;
  onClear: () => void;
  options: T[];
  matchFn: (item: T, query: string) => boolean;
  renderOption: (item: T) => React.ReactNode;
  onSelect: (item: T) => void;
}

function TargetPicker<T extends { id: string }>({
  label,
  placeholder,
  selected,
  selectedLabel,
  onClear,
  options,
  matchFn,
  renderOption,
  onSelect,
}: TargetPickerProps<T>) {
  const [query, setQuery] = useState("");
  const [showList, setShowList] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 8);
    return options.filter((o) => matchFn(o, q)).slice(0, 8);
  }, [options, query, matchFn]);

  if (selected) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 w-16 shrink-0">
          {label}
        </span>
        <span className="flex items-center gap-2 px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] text-[12px] text-zinc-100">
          {selectedLabel(selected)}
          <button
            type="button"
            onClick={onClear}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label={`Clear ${label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 relative">
      <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 w-16 shrink-0">
        {label}
      </span>
      <div className="flex-1 relative">
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-zinc-900/60 border border-white/[0.07] focus-within:border-white/[0.18]">
          <Search className="h-3 w-3 text-zinc-600" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowList(true);
            }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 150)}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-[12px] text-zinc-100 placeholder:text-zinc-600"
          />
        </div>
        {showList && matches.length > 0 && (
          <div className="absolute z-10 left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-md border border-white/[0.1] bg-zinc-950 shadow-xl">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(m);
                  setQuery("");
                  setShowList(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-white/[0.04] transition-colors"
              >
                {renderOption(m)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LogActivityModal;
