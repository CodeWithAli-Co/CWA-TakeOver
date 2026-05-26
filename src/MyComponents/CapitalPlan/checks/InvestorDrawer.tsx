/**
 * InvestorDrawer.tsx — Slide-in detail surface for one investor.
 *
 * Contains:
 *   - Contact info form (name, firm, email, LinkedIn, phone, intro source)
 *   - Status + priority + check amount controls
 *   - Next step + due date
 *   - Notes (free text)
 *   - Touchpoint log (chronological) + composer
 *   - AXON-drafted follow-up email button (Phase 4 will hook this
 *     to the real AXON action; for now uses the template generator)
 *   - "Send via Gmail" and "Add to Calendly" buttons — visible but
 *     disabled until those MCP connectors are wired
 *
 * Used by ChecksTab.tsx. Handles its own create/update via the
 * mutations from CapitalPlan.queries.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  X, Save, Trash2, Sparkles, Copy, Check, Send, Calendar,
  Mail, Linkedin, Phone, Plus, MessageSquare, Video,
  PhoneCall, FileText, Star, AlertTriangle,
} from "lucide-react";
import {
  useUpsertCheck, useDeleteCheck, useAddTouchpoint, useDeleteTouchpoint,
  type CapitalCheck, type CapitalCheckStatus, type CapitalCheckTouchpoint,
  type CapitalRound, type CapitalTouchpointKind,
} from "../CapitalPlan.queries";
import { draftFollowUp, type DraftedEmail } from "./draftFollowUp";

const STATUS_OPTIONS: { value: CapitalCheckStatus; label: string; tone: string }[] = [
  { value: "lead",        label: "Lead",         tone: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"     },
  { value: "intro",       label: "Intro",        tone: "bg-blue-500/15 text-blue-300 border-blue-500/30"     },
  { value: "meeting",     label: "Meeting",      tone: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30" },
  { value: "diligence",   label: "Diligence",    tone: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  { value: "verbal",      label: "Verbal",       tone: "bg-amber-500/15 text-amber-300 border-amber-500/30"   },
  { value: "term-sheet",  label: "Term Sheet",   tone: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  { value: "signed",      label: "Signed",       tone: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { value: "wired",       label: "Wired",        tone: "bg-emerald-600/25 text-emerald-200 border-emerald-500/40 font-bold" },
  { value: "passed",      label: "Passed",       tone: "bg-red-500/10 text-red-300/80 border-red-500/30"     },
  { value: "ghosted",     label: "Ghosted",      tone: "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"     },
];

const TOUCHPOINT_KINDS: { value: CapitalTouchpointKind; label: string; icon: typeof Mail }[] = [
  { value: "email",    label: "Email",   icon: Mail        },
  { value: "meeting",  label: "Meeting", icon: Video       },
  { value: "call",     label: "Call",    icon: PhoneCall   },
  { value: "demo",     label: "Demo",    icon: Sparkles    },
  { value: "note",     label: "Note",    icon: FileText    },
];

export interface InvestorDrawerProps {
  check: CapitalCheck | null;          // null when isNew
  isNew: boolean;
  round: CapitalRound | null;          // round this check belongs to
  rounds: CapitalRound[];              // for round picker when creating
  touchpoints: CapitalCheckTouchpoint[]; // pre-filtered to this check
  defaultRoundId?: string | null;
  onClose: () => void;
}

export function InvestorDrawer({
  check, isNew, round, rounds, touchpoints, defaultRoundId, onClose,
}: InvestorDrawerProps) {
  const upsert = useUpsertCheck();
  const remove = useDeleteCheck();
  const addTouchpoint = useAddTouchpoint();
  const deleteTouchpoint = useDeleteTouchpoint();

  const [form, setForm] = useState<Partial<CapitalCheck>>(() => check ?? {
    round_id: defaultRoundId ?? rounds[0]?.id ?? "",
    investor_name: "",
    firm: null,
    status: "lead",
    check_amount: 50_000,
    committed_amount: null,
    wired_amount: null,
    intro_source: null,
    contact_email: null,
    contact_linkedin: null,
    contact_phone: null,
    next_step: null,
    next_step_due: null,
    meeting_count: 0,
    priority: 0,
    notes: null,
    position: 0,
  });
  const [dirty, setDirty] = useState(false);
  const [showDraft, setShowDraft] = useState(false);
  const [drafted, setDrafted] = useState<DraftedEmail | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Reset state when the drawer's target check changes
  useEffect(() => {
    setForm(check ?? {
      round_id: defaultRoundId ?? rounds[0]?.id ?? "",
      investor_name: "", status: "lead", check_amount: 50_000,
      meeting_count: 0, priority: 0, position: 0,
    });
    setDirty(false);
    setShowDraft(false);
    setDrafted(null);
    setDeleteConfirm(false);
  }, [check?.id, isNew, defaultRoundId]);

  function patch<K extends keyof CapitalCheck>(key: K, value: CapitalCheck[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  async function save() {
    if (!form.investor_name?.trim() || !form.round_id) return;
    await upsert.mutateAsync(form as any);
    setDirty(false);
    if (isNew) onClose();
  }

  async function handleDelete() {
    if (!check) return;
    await remove.mutateAsync(check.id);
    onClose();
  }

  function generateDraft() {
    if (!check && !isNew) return;
    const draftCheck = (check ?? form) as CapitalCheck;
    const lastTouch = touchpoints[0] ?? null; // already sorted desc by query
    const d = draftFollowUp({
      investor: draftCheck,
      round,
      lastTouchpoint: lastTouch,
    });
    setDrafted(d);
    setShowDraft(true);
  }

  async function copyDraft() {
    if (!drafted) return;
    const text = `Subject: ${drafted.subject}\n\n${drafted.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  async function logDraftAsTouchpoint() {
    if (!drafted || !check) return;
    await addTouchpoint.mutateAsync({
      check_id: check.id,
      kind: "email",
      summary: `Sent: "${drafted.subject}"\n\n${drafted.body}`,
      drafted_by_axon: true,
      occurred_at: new Date().toISOString(),
    });
    setShowDraft(false);
    setDrafted(null);
  }

  const investorTouchpoints = useMemo(
    () => touchpoints.filter((t) => t.check_id === check?.id),
    [touchpoints, check?.id],
  );

  const canSave = !!form.investor_name?.trim() && !!form.round_id;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-background border-l border-border overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between z-20">
          <div className="min-w-0">
            <h3 className="text-[14px] font-bold tracking-tight text-foreground truncate">
              {isNew ? "Add investor" : form.investor_name || "(no name)"}
              {form.firm && !isNew && (
                <span className="text-muted-foreground font-normal ml-2">· {form.firm}</span>
              )}
            </h3>
            {!isNew && round && (
              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                In {round.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {!isNew && (
              deleteConfirm ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="px-2 h-7 rounded-sm border border-red-500/40 bg-red-500/15 text-[10.5px] uppercase tracking-[0.16em] font-bold text-red-200 hover:bg-red-500/25 transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(false)}
                    className="px-2 h-7 rounded-sm border border-border text-[10.5px] uppercase tracking-[0.16em] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(true)}
                  className="p-1.5 rounded-sm text-muted-foreground hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  title="Delete investor"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-5 space-y-5">
          {/* Round picker (only when creating) */}
          {isNew && (
            <Field label="Round">
              <select
                value={form.round_id ?? ""}
                onChange={(e) => patch("round_id", e.target.value)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              >
                {rounds.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name">
              <input
                type="text"
                value={form.investor_name ?? ""}
                onChange={(e) => patch("investor_name", e.target.value)}
                placeholder="e.g. Gokul Rajaram"
                autoFocus={isNew}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </Field>
            <Field label="Firm (optional)">
              <input
                type="text"
                value={form.firm ?? ""}
                onChange={(e) => patch("firm", e.target.value || null)}
                placeholder="e.g. Marketplace Capital"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </Field>
          </div>

          {/* Status + priority */}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Status">
              <select
                value={form.status ?? "lead"}
                onChange={(e) => patch("status", e.target.value as CapitalCheckStatus)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <div className="inline-flex items-stretch border border-border rounded-sm overflow-hidden">
                {[0, 1, 2].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch("priority", p)}
                    className={`px-3 h-[34px] text-[12px] font-semibold transition-colors ${
                      form.priority === p
                        ? p === 2 ? "bg-red-500/20 text-red-200"
                        : p === 1 ? "bg-amber-500/20 text-amber-200"
                        : "bg-muted/40 text-foreground"
                        : "text-muted-foreground/60 hover:bg-muted/30"
                    }`}
                    title={p === 0 ? "Normal" : p === 1 ? "High" : "Critical"}
                  >
                    <Star className="h-3 w-3" fill={form.priority !== undefined && form.priority >= p && p > 0 ? "currentColor" : "none"} />
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Amounts */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Check ($)">
              <input
                type="number"
                value={form.check_amount ?? 0}
                onChange={(e) => patch("check_amount", Number(e.target.value))}
                step="5000"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </Field>
            <Field label="Committed ($)">
              <input
                type="number"
                value={form.committed_amount ?? ""}
                onChange={(e) => patch("committed_amount", e.target.value === "" ? null : Number(e.target.value))}
                step="5000"
                placeholder="—"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </Field>
            <Field label="Wired ($)">
              <input
                type="number"
                value={form.wired_amount ?? ""}
                onChange={(e) => patch("wired_amount", e.target.value === "" ? null : Number(e.target.value))}
                step="5000"
                placeholder="—"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground tabular-nums focus:outline-none focus:border-primary/60"
              />
            </Field>
          </div>

          {/* Contact info */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-1.5">
              Contact
            </div>
            <ContactInput
              icon={<Mail className="h-3 w-3" />}
              type="email"
              placeholder="email@example.com"
              value={form.contact_email ?? ""}
              onChange={(v) => patch("contact_email", v || null)}
            />
            <ContactInput
              icon={<Linkedin className="h-3 w-3" />}
              type="url"
              placeholder="linkedin.com/in/…"
              value={form.contact_linkedin ?? ""}
              onChange={(v) => patch("contact_linkedin", v || null)}
            />
            <ContactInput
              icon={<Phone className="h-3 w-3" />}
              type="tel"
              placeholder="+1 555 …"
              value={form.contact_phone ?? ""}
              onChange={(v) => patch("contact_phone", v || null)}
            />
          </div>

          {/* Intro source */}
          <Field label="Intro source (optional)">
            <input
              type="text"
              value={form.intro_source ?? ""}
              onChange={(e) => patch("intro_source", e.target.value || null)}
              placeholder='e.g. "Gokul intro" or "Cold via Twitter DM"'
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
            />
          </Field>

          {/* Next step + due */}
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Next step">
              <input
                type="text"
                value={form.next_step ?? ""}
                onChange={(e) => patch("next_step", e.target.value || null)}
                placeholder="e.g. Send data room link"
                className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </Field>
            <Field label="Due">
              <input
                type="date"
                value={form.next_step_due ?? ""}
                onChange={(e) => patch("next_step_due", e.target.value || null)}
                className="bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60"
              />
            </Field>
          </div>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              value={form.notes ?? ""}
              onChange={(e) => patch("notes", e.target.value || null)}
              rows={3}
              placeholder="Diligence questions, themes, personal notes…"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-[12.5px] text-foreground focus:outline-none focus:border-primary/60 resize-y"
            />
          </Field>

          {/* AXON-drafted follow-up */}
          {!isNew && (
            <div className="border border-violet-500/20 bg-violet-500/[0.04] rounded-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                  <span className="text-[11px] uppercase tracking-[0.16em] text-violet-200 font-bold">
                    AXON follow-up draft
                  </span>
                </div>
                <button
                  type="button"
                  onClick={generateDraft}
                  className="px-3 h-7 rounded-sm border border-violet-500/40 bg-violet-500/15 text-[10.5px] uppercase tracking-[0.16em] font-bold text-violet-200 hover:bg-violet-500/25 transition-colors"
                >
                  Generate
                </button>
              </div>
              {!drafted && !showDraft && (
                <p className="text-[11.5px] text-muted-foreground/80 leading-relaxed">
                  Click Generate to produce a follow-up draft tuned to this investor's current status
                  {touchpoints.length > 0 ? " and the latest touchpoint." : "."}
                  {" "}Phase 4 wires this to the live AXON capital_advise action.
                </p>
              )}
              {showDraft && drafted && (
                <div className="space-y-2.5">
                  <div className="border border-border bg-background rounded-sm">
                    <div className="px-3 py-1.5 border-b border-border/60 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold">
                      Subject
                    </div>
                    <div className="px-3 py-2 text-[13px] text-foreground font-medium">
                      {drafted.subject}
                    </div>
                  </div>
                  <div className="border border-border bg-background rounded-sm">
                    <div className="px-3 py-1.5 border-b border-border/60 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold">
                      Body
                    </div>
                    <pre className="px-3 py-2 text-[12px] text-foreground font-sans whitespace-pre-wrap leading-relaxed">
                      {drafted.body}
                    </pre>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground/80 italic flex items-start gap-1.5">
                    <Sparkles className="h-2.5 w-2.5 mt-0.5 text-violet-400/70 shrink-0" />
                    {drafted.rationale}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={copyDraft}
                      className="inline-flex items-center gap-1.5 px-3 h-7 rounded-sm border border-border text-[10.5px] uppercase tracking-[0.16em] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      type="button"
                      onClick={logDraftAsTouchpoint}
                      className="inline-flex items-center gap-1.5 px-3 h-7 rounded-sm border border-emerald-500/40 bg-emerald-500/10 text-[10.5px] uppercase tracking-[0.16em] font-bold text-emerald-200 hover:bg-emerald-500/20 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Log as sent
                    </button>
                    <button
                      type="button"
                      disabled
                      className="inline-flex items-center gap-1.5 px-3 h-7 rounded-sm border border-border text-[10.5px] uppercase tracking-[0.16em] font-bold text-muted-foreground opacity-40 cursor-not-allowed"
                      title="Send via Gmail — wired via MCP in a follow-up"
                    >
                      <Send className="h-3 w-3" />
                      Send via Gmail
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Touchpoint log */}
          {!isNew && (
            <TouchpointLog
              checkId={check!.id}
              touchpoints={investorTouchpoints}
              onAdd={(payload) => addTouchpoint.mutateAsync({ check_id: check!.id, ...payload })}
              onDelete={(id) => deleteTouchpoint.mutateAsync(id)}
            />
          )}

          {/* MCP-deferred shortcuts */}
          {!isNew && (
            <div className="flex items-center gap-2 pt-2 text-[10.5px] text-muted-foreground/70 border-t border-border/60">
              <span className="font-semibold">Coming via MCP:</span>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 px-2 h-6 rounded-sm border border-border opacity-40 cursor-not-allowed"
                title="Auto-capture Calendly meetings"
              >
                <Calendar className="h-2.5 w-2.5" />
                Calendly
              </button>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1 px-2 h-6 rounded-sm border border-border opacity-40 cursor-not-allowed"
                title="Sync Gmail thread history"
              >
                <Mail className="h-2.5 w-2.5" />
                Gmail
              </button>
            </div>
          )}
        </div>

        {/* Footer save bar */}
        <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border px-5 py-3 flex items-center justify-between gap-2 z-10">
          <div className="text-[10.5px] text-muted-foreground">
            {dirty && (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <AlertTriangle className="h-3 w-3" />
                Unsaved changes
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-8 rounded-sm border border-border text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
            >
              {dirty ? "Discard" : "Close"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave || (!dirty && !isNew)}
              className="inline-flex items-center gap-1.5 px-4 h-8 rounded-sm bg-primary text-primary-foreground text-[11px] uppercase tracking-[0.16em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-3 w-3" />
              {isNew ? "Add investor" : "Save"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Touchpoint log ─────────────────────────────────────────────

function TouchpointLog({
  checkId: _checkId, touchpoints, onAdd, onDelete,
}: {
  checkId: string;
  touchpoints: CapitalCheckTouchpoint[];
  onAdd: (payload: { kind: CapitalTouchpointKind; summary: string; sentiment?: "positive" | "neutral" | "negative" }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}) {
  const [composing, setComposing] = useState(false);
  const [kind, setKind] = useState<CapitalTouchpointKind>("meeting");
  const [summary, setSummary] = useState("");
  const [sentiment, setSentiment] = useState<"positive" | "neutral" | "negative">("neutral");

  async function submit() {
    if (!summary.trim()) return;
    await onAdd({ kind, summary, sentiment });
    setSummary("");
    setSentiment("neutral");
    setComposing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold">
          Touchpoints ({touchpoints.length})
        </div>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            className="inline-flex items-center gap-1 px-2 h-6 rounded-sm border border-border text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          >
            <Plus className="h-2.5 w-2.5" />
            Log
          </button>
        )}
      </div>

      {composing && (
        <div className="border border-border rounded-sm bg-card/40 p-3 mb-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            {TOUCHPOINT_KINDS.map((k) => {
              const Icon = k.icon;
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setKind(k.value)}
                  className={`inline-flex items-center gap-1.5 px-2 h-6 rounded-sm border text-[10.5px] font-semibold transition-colors ${
                    kind === k.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  }`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {k.label}
                </button>
              );
            })}
          </div>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
            placeholder="What happened? Key points, sentiment, follow-ups…"
            autoFocus
            className="w-full bg-background border border-border rounded-sm px-2 py-1.5 text-[12px] text-foreground focus:outline-none focus:border-primary/60 resize-y"
          />
          <div className="flex items-center justify-between">
            <div className="inline-flex items-stretch border border-border rounded-sm overflow-hidden">
              {(["positive", "neutral", "negative"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSentiment(s)}
                  className={`px-2 h-6 text-[10px] uppercase tracking-[0.14em] font-semibold transition-colors ${
                    sentiment === s
                      ? s === "positive" ? "bg-emerald-500/15 text-emerald-300"
                      : s === "negative" ? "bg-red-500/15 text-red-300"
                      : "bg-muted/40 text-foreground"
                      : "text-muted-foreground/60 hover:bg-muted/30"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setComposing(false); setSummary(""); }}
                className="px-2 h-6 text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!summary.trim()}
                className="px-3 h-6 rounded-sm bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.14em] font-bold hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Log
              </button>
            </div>
          </div>
        </div>
      )}

      {touchpoints.length === 0 && !composing && (
        <p className="text-[11.5px] text-muted-foreground/60 italic">
          No touchpoints logged yet.
        </p>
      )}

      <div className="space-y-2">
        {touchpoints.map((tp) => {
          const meta = TOUCHPOINT_KINDS.find((k) => k.value === tp.kind);
          const Icon = meta?.icon ?? MessageSquare;
          const isOld = (Date.now() - new Date(tp.occurred_at).getTime()) > 30 * 24 * 60 * 60 * 1000;
          return (
            <div
              key={tp.id}
              className={`group border-l-2 pl-3 py-2 ${
                tp.sentiment === "positive" ? "border-emerald-500/40" :
                tp.sentiment === "negative" ? "border-red-500/40" :
                "border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 text-[10.5px] text-muted-foreground">
                <Icon className="h-3 w-3" />
                <span className="font-semibold uppercase tracking-wide">{meta?.label ?? tp.kind}</span>
                <span className="text-muted-foreground/60">·</span>
                <span className={isOld ? "italic" : ""}>
                  {new Date(tp.occurred_at).toLocaleDateString(undefined, {
                    month: "short", day: "numeric", year: isOld ? "2-digit" : undefined,
                  })}
                </span>
                {tp.drafted_by_axon && (
                  <span className="inline-flex items-center gap-0.5 text-violet-300 ml-1">
                    <Sparkles className="h-2 w-2" />
                    AXON
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onDelete(tp.id)}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-red-300 transition-all"
                  title="Delete touchpoint"
                  aria-label="Delete touchpoint"
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
              <pre className="text-[12px] text-foreground/85 font-sans whitespace-pre-wrap leading-relaxed">
                {tp.summary}
              </pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Small primitives ───────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80 font-semibold mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function ContactInput({
  icon, type, placeholder, value, onChange,
}: {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-stretch w-full border border-border rounded-sm overflow-hidden focus-within:border-primary/60 transition-colors">
      <div className="flex items-center justify-center w-9 text-muted-foreground/70 bg-card/40 border-r border-border">
        {icon}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-background px-3 py-2 text-[12.5px] text-foreground focus:outline-none"
      />
    </div>
  );
}

// Re-exports for convenience
export { STATUS_OPTIONS };
