/**
 * OfferLettersDashboard.tsx — Polished three-pane offer-letter drafter.
 *
 *   · Left  — drafts list (quick switcher).
 *   · Middle — structured form grouped into labelled cards.
 *   · Right — Claude-generated preview (editable inline) + PDF export.
 *
 * Key design choices:
 *   · Gradient letterhead card at the top that previews the letterhead
 *     style (CWA red / Simplicity teal) — drives the PDF branding too.
 *   · Amber in-UI disclaimer ribbon pinned to the header.
 *   · Graceful "run this migration" banner when the table is missing.
 *   · TBD-commission toggle for first-hire commission-only cases.
 */

import { useEffect, useState } from "react";
import {
  AlertTriangle, FileText, Loader2, Save, Sparkles, Download,
  Plus, Building2, Clock, ChevronRight, CopyCheck, Calendar as CalIcon,
  User as UserIcon, Briefcase, CircleDollarSign, Gift, CheckCircle2,
  ShieldCheck, MessageSquareQuote,
} from "lucide-react";
import { motion } from "framer-motion";
import { ScrollArea } from "@/components/ui/shadcnComponents/scroll-area";
import { companySupabase } from "@/routes/index.lazy";
import { ActiveUser } from "@/stores/query";
import { draftOfferLetter, type OfferInput } from "./draftOffer";
import { OfferLetterPDF } from "./OfferLetterPDF";
import { pdf } from "@react-pdf/renderer";
import { HiringActions } from "./HiringActions";

// ── Defaults ───────────────────────────────────────────────────────

const EMPLOYER_DEFAULTS = {
  employerLegalName: "CodeWithAli LLC",
  employerAddress: "",
  employerState: "CA",
  employerSignerName: "Ali Alibrahimi",
  employerSignerTitle: "Chief Executive Officer",
};

const BRAND_STYLES = {
  codeWithAli: {
    label: "CodeWithAli",
    tagline: "Software agency & media",
    accent: "bg-red-600",
    accentText: "text-red-400",
    ring: "ring-red-500/40",
    border: "border-red-500/40",
    softBg: "from-red-500/20 to-red-500/5",
    logo: "/codewithali_logo.png",
  },
  simplicity: {
    label: "Simplicity",
    tagline: "Finance & operations",
    accent: "bg-teal-600",
    accentText: "text-teal-400",
    ring: "ring-teal-500/40",
    border: "border-teal-500/40",
    softBg: "from-teal-500/20 to-teal-500/5",
    logo: "/simplicity_logo.png",
  },
} as const;

const BENEFIT_OPTIONS = [
  "Healthcare", "Dental", "Vision", "401(k)", "Unlimited PTO",
  "Stock options / equity", "Home-office stipend", "Learning & development budget",
];

const CONTINGENCY_OPTIONS = [
  { key: "i9", label: "I-9 employment eligibility verification (required by law)" },
  { key: "background_check", label: "Background check" },
  { key: "references", label: "Reference check" },
  { key: "signed_nda", label: "Signed confidentiality agreement" },
  { key: "ip_assignment", label: "Signed IP assignment agreement" },
];

const MIGRATION_SQL_HINT = `-- In Supabase → SQL editor, paste migrations/offer_letters_init.sql and Run.`;

interface OfferRow extends OfferInput {
  id: string;
  status: "draft" | "sent" | "accepted" | "declined" | "withdrawn";
  generated_body?: string;
  created_at: string;
  candidate_email?: string;
}

const blankForm = (): OfferInput => ({
  brand: "codeWithAli",
  ...EMPLOYER_DEFAULTS,
  candidateName: "",
  candidateAddress: "",
  positionTitle: "",
  roleSummary: "",
  reportsTo: "Ali Alibrahimi",
  workLocation: "Remote",
  workArrangement: "remote",
  employmentType: "1099_contractor",
  exemptStatus: undefined,
  compMode: "commission_only",
  baseSalaryUsd: null,
  hourlyRateUsd: null,
  commissionRatePercent: 10,
  commissionBasis: "collected_revenue",
  commissionNotes: "",
  commissionTbd: false,
  paySchedule: "monthly",
  benefits: [],
  ptoDaysPerYear: null,
  startDate: "",
  offerExpiresAt: (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })(),
  contingencies: ["i9", "signed_nda", "ip_assignment"],
  additionalTerms: "",
});

// ── Component ──────────────────────────────────────────────────────

export function OfferLettersDashboard() {
  const { data: me } = ActiveUser();
  const operator = me?.[0]?.username ?? "";
  const [form, setForm] = useState<OfferInput>(blankForm());
  const [generated, setGenerated] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [past, setPast] = useState<OfferRow[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  // The saved row matching `currentId` — powers the HiringActions panel.
  const currentSaved = currentId
    ? (past.find((p: any) => p.id === currentId) as any) || null
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPast(true);
      const { data, error } = await companySupabase
  .from("offer_letters")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (cancelled) return;
      if (error) {
        const em = (error.message || "").toLowerCase();
        if (
          em.includes("relation") ||
          em.includes("does not exist") ||
          em.includes("offer_letters") ||
          (error as any).code === "42P01" ||
          (error as any).code === "PGRST205"
        ) {
          setTableMissing(true);
        }
        setPast([]);
      } else {
        setTableMissing(false);
        setPast((data ?? []) as any);
      }
      setLoadingPast(false);
    })();
    return () => { cancelled = true; };
  }, [currentId, refreshTick]);

  const update = <K extends keyof OfferInput>(key: K, value: OfferInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleBenefit = (b: string) => setForm((f) => {
    const has = (f.benefits ?? []).includes(b);
    return {
      ...f,
      benefits: has
        ? (f.benefits ?? []).filter((x) => x !== b)
        : [...(f.benefits ?? []), b],
    };
  });

  const toggleContingency = (c: string) => setForm((f) => {
    const has = (f.contingencies ?? []).includes(c);
    return {
      ...f,
      contingencies: has
        ? (f.contingencies ?? []).filter((x) => x !== c)
        : [...(f.contingencies ?? []), c],
    };
  });

  const generate = async () => {
    if (!form.candidateName.trim() || !form.positionTitle.trim()) {
      setGenerateError("Candidate name and position title are required.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    const res = await draftOfferLetter(form);
    setGenerating(false);
    if (res.ok) setGenerated(res.text);
    else setGenerateError(res.error);
  };

  const persist = async () => {
    if (!generated) return;
    setSaving(true);
    const payload = {
      created_by: operator,
      employer_legal_name: form.employerLegalName,
      employer_address: form.employerAddress || null,
      employer_state: form.employerState || null,
      employer_signer_name: form.employerSignerName || null,
      employer_signer_title: form.employerSignerTitle || null,
      candidate_name: form.candidateName,
      candidate_address: form.candidateAddress || null,
      position_title: form.positionTitle,
      role_summary: form.roleSummary || null,
      reports_to: form.reportsTo || null,
      work_location: form.workLocation || null,
      work_arrangement: form.workArrangement || null,
      employment_type: form.employmentType,
      exempt_status: form.exemptStatus || null,
      comp_mode: form.compMode,
      base_salary_usd: form.baseSalaryUsd ?? null,
      hourly_rate_usd: form.hourlyRateUsd ?? null,
      commission_rate_percent: form.commissionRatePercent ?? null,
      commission_basis: form.commissionBasis || null,
      commission_notes: form.commissionNotes || null,
      pay_schedule: form.paySchedule || null,
      benefits: form.benefits ?? [],
      pto_days_per_year: form.ptoDaysPerYear ?? null,
      start_date: form.startDate || null,
      offer_expires_at: form.offerExpiresAt || null,
      contingencies: form.contingencies ?? [],
      additional_terms: form.additionalTerms || null,
      generated_body: generated,
    };
    let res;
    if (currentId) {
      res = await companySupabase.from("offer_letters").update(payload).eq("id", currentId).select().single();
    } else {
      res = await companySupabase.from("offer_letters").insert(payload).select().single();
    }
    setSaving(false);
    if (res.error) {
      const em = (res.error.message || "").toLowerCase();
      if (
        em.includes("relation") ||
        em.includes("does not exist") ||
        (res.error as any).code === "42P01"
      ) {
        setTableMissing(true);
        setGenerateError(
          "Can't save — the offer_letters table doesn't exist yet. Run migrations/offer_letters_init.sql in companySupabase.",
        );
      } else {
        setGenerateError(`Save failed: ${res.error.message}`);
      }
      return;
    }
    setCurrentId((res.data as any)?.id ?? null);
  };

  const loadPast = (row: OfferRow) => {
    setForm({
      brand: "codeWithAli",
      employerLegalName: (row as any).employer_legal_name ?? EMPLOYER_DEFAULTS.employerLegalName,
      employerAddress: (row as any).employer_address ?? "",
      employerState: (row as any).employer_state ?? "CA",
      employerSignerName: (row as any).employer_signer_name ?? "",
      employerSignerTitle: (row as any).employer_signer_title ?? "",
      candidateName: (row as any).candidate_name ?? "",
      candidateAddress: (row as any).candidate_address ?? "",
      positionTitle: (row as any).position_title ?? "",
      roleSummary: (row as any).role_summary ?? "",
      reportsTo: (row as any).reports_to ?? "",
      workLocation: (row as any).work_location ?? "",
      workArrangement: (row as any).work_arrangement ?? "remote",
      employmentType: (row as any).employment_type ?? "1099_contractor",
      exemptStatus: (row as any).exempt_status ?? undefined,
      compMode: (row as any).comp_mode ?? "commission_only",
      baseSalaryUsd: (row as any).base_salary_usd ?? null,
      hourlyRateUsd: (row as any).hourly_rate_usd ?? null,
      commissionRatePercent: (row as any).commission_rate_percent ?? null,
      commissionBasis: (row as any).commission_basis ?? undefined,
      commissionNotes: (row as any).commission_notes ?? "",
      commissionTbd: (row as any).commission_rate_percent == null,
      paySchedule: (row as any).pay_schedule ?? "monthly",
      benefits: (row as any).benefits ?? [],
      ptoDaysPerYear: (row as any).pto_days_per_year ?? null,
      startDate: (row as any).start_date ?? "",
      offerExpiresAt: (row as any).offer_expires_at ?? "",
      contingencies: (row as any).contingencies ?? [],
      additionalTerms: (row as any).additional_terms ?? "",
    });
    setGenerated((row as any).generated_body ?? "");
    setCurrentId(row.id);
  };

  const resetForm = () => {
    setForm(blankForm());
    setGenerated("");
    setCurrentId(null);
    setGenerateError(null);
  };

  const exportPdf = async () => {
    if (!generated) return;
    setExporting(true);
    try {
      const blob = await pdf(
        <OfferLetterPDF
          brand={form.brand}
          employerLegalName={form.employerLegalName}
          employerAddress={form.employerAddress}
          employerSignerName={form.employerSignerName}
          employerSignerTitle={form.employerSignerTitle}
          candidateName={form.candidateName}
          body={generated}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Offer letter - ${form.candidateName || "candidate"}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } finally {
      setExporting(false);
    }
  };

  const brandTokens = BRAND_STYLES[form.brand ?? "codeWithAli"];

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background">
      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="relative border-b border-border px-6 py-4 bg-gradient-to-b from-card/50 to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="h-8 w-8 rounded-md bg-primary/15 border border-primary/25 flex items-center justify-center">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-[18px] font-semibold tracking-tight leading-none">
                  Offer letters
                </h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Draft, sign-ready, exported as PDF
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200 max-w-[480px]">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>
              Drafting tool — not legal advice. Have an employment attorney in
              your state review before sending, especially commission terms.
            </span>
          </div>
        </div>
      </header>

      {/* ── Migration banner ─────────────────────────────────────── */}
      {tableMissing && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-6 py-3 text-[11.5px] text-red-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-300 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold mb-0.5">Run the migration to enable saving</div>
              <p className="text-red-200/80 leading-relaxed">
                The <code className="rounded bg-background/30 px-1">offer_letters</code> table isn't set up yet.
                Open Supabase → SQL editor, paste{" "}
                <code className="rounded bg-background/30 px-1">migrations/offer_letters_init.sql</code>, and Run.
                You can still generate drafts — they just won't save until the table exists.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* ── Left — drafts list ──────────────────────────────────── */}
        <aside className="w-[260px] shrink-0 border-r border-border flex flex-col bg-card/30">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
              Drafts {past.length > 0 && `· ${past.length}`}
            </span>
            <button
              type="button"
              onClick={resetForm}
              className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="flex flex-col p-2 gap-1">
              {loadingPast && (
                <div className="flex items-center gap-2 p-3 text-[11.5px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> loading…
                </div>
              )}
              {!loadingPast && past.length === 0 && !tableMissing && (
                <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                  <FileText className="h-5 w-5 text-muted-foreground/40" />
                  <p className="text-[11.5px] text-muted-foreground">
                    No drafts yet. Fill the form on the right and click
                    Generate → Save.
                  </p>
                </div>
              )}
              {past.map((o: any) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => loadPast(o)}
                  className={`flex flex-col gap-1 rounded-lg border px-2.5 py-2 text-left transition-all ${
                    currentId === o.id
                      ? "border-primary/50 bg-primary/10 shadow-sm"
                      : "border-border/40 hover:border-primary/30 hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium text-foreground">
                      {o.candidate_name}
                    </span>
                    <StatusChip status={o.status} />
                  </div>
                  <span className="truncate text-[10.5px] text-muted-foreground">
                    {o.position_title}
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                    {new Date(o.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        {/* ── Middle — form ───────────────────────────────────────── */}
        <div className="w-[480px] shrink-0 border-r border-border overflow-y-auto bg-card/20">
          <div className="p-5 space-y-4">

            {/* Brand letterhead preview + picker */}
            <div
              className={`
                relative overflow-hidden rounded-xl border ${brandTokens.border}
                bg-gradient-to-br ${brandTokens.softBg} p-4
              `}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-lg bg-background/40 border border-white/10 flex items-center justify-center overflow-hidden">
                  <img
                    src={brandTokens.logo}
                    alt={brandTokens.label}
                    className="h-9 w-9 object-contain"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                </div>
                <div className="flex-1">
                  <div className={`text-[15px] font-bold tracking-tight ${brandTokens.accentText}`}>
                    {brandTokens.label}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {brandTokens.tagline}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(["codeWithAli", "simplicity"] as const).map((k) => {
                  const t = BRAND_STYLES[k];
                  const active = form.brand === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => update("brand", k)}
                      className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11.5px] transition-all ${
                        active
                          ? `${t.border} bg-background text-foreground shadow-sm`
                          : "border-border/40 bg-background/30 text-muted-foreground hover:bg-background/50"
                      }`}
                    >
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${t.accent}`} />
                      {t.label}
                      {active && <CheckCircle2 className={`h-3 w-3 ml-auto ${t.accentText}`} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Employer */}
            <Card icon={Building2} title="Employer (LLC)">
              <Field label="Legal name" value={form.employerLegalName} onChange={(v) => update("employerLegalName", v)} required />
              <Field label="Address" value={form.employerAddress ?? ""} onChange={(v) => update("employerAddress", v)} placeholder="123 Main St, City, ST ZIP" />
              <div className="grid grid-cols-2 gap-2">
                <Field label="State" value={form.employerState ?? ""} onChange={(v) => update("employerState", v.toUpperCase().slice(0, 2))} placeholder="CA" />
                <Field label="Signer title" value={form.employerSignerTitle ?? ""} onChange={(v) => update("employerSignerTitle", v)} />
              </div>
              <Field label="Signer name" value={form.employerSignerName ?? ""} onChange={(v) => update("employerSignerName", v)} />
            </Card>

            {/* Candidate */}
            <Card icon={UserIcon} title="Candidate">
              <Field label="Full legal name" value={form.candidateName} onChange={(v) => update("candidateName", v)} required placeholder="Jane Q. Public" />
              <Field label="Address" value={form.candidateAddress ?? ""} onChange={(v) => update("candidateAddress", v)} />
            </Card>

            {/* Position */}
            <Card icon={Briefcase} title="Position">
              <Field label="Title" value={form.positionTitle} onChange={(v) => update("positionTitle", v)} required placeholder="Sales Associate" />
              <Field label="Role summary" value={form.roleSummary ?? ""} onChange={(v) => update("roleSummary", v)} placeholder="Own the outbound pipeline…" multiline />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Reports to" value={form.reportsTo ?? ""} onChange={(v) => update("reportsTo", v)} />
                <Select
                  label="Arrangement"
                  value={form.workArrangement ?? "remote"}
                  options={[
                    { v: "remote", label: "Remote" },
                    { v: "hybrid", label: "Hybrid" },
                    { v: "onsite", label: "Onsite" },
                  ]}
                  onChange={(v) => update("workArrangement", v as any)}
                />
              </div>
              <Field label="Work location" value={form.workLocation ?? ""} onChange={(v) => update("workLocation", v)} placeholder="Remote / City, ST" />
            </Card>

            {/* Classification */}
            <Card icon={ShieldCheck} title="Classification">
              <Select
                label="Employment type"
                value={form.employmentType}
                options={[
                  { v: "w2_full_time", label: "W-2 Employee · Full time" },
                  { v: "w2_part_time", label: "W-2 Employee · Part time" },
                  { v: "1099_contractor", label: "1099 Independent Contractor" },
                  { v: "intern", label: "Intern" },
                ]}
                onChange={(v) => update("employmentType", v as any)}
              />
              {form.employmentType.startsWith("w2_") && (
                <Select
                  label="FLSA status"
                  value={form.exemptStatus ?? "non_exempt"}
                  options={[
                    { v: "non_exempt", label: "Non-exempt (overtime eligible)" },
                    { v: "exempt", label: "Exempt (salaried, no overtime)" },
                  ]}
                  onChange={(v) => update("exemptStatus", v as any)}
                />
              )}
              {form.employmentType === "1099_contractor" && (
                <Callout tone="amber">
                  Contractor status has strict IRS + state criteria. The worker
                  must control their own hours, tools, and methods. California's
                  ABC test is particularly restrictive — default is employee.
                </Callout>
              )}
            </Card>

            {/* Compensation */}
            <Card icon={CircleDollarSign} title="Compensation">
              <Select
                label="Comp mode"
                value={form.compMode}
                options={[
                  { v: "salary", label: "Annual salary" },
                  { v: "hourly", label: "Hourly rate" },
                  { v: "commission_only", label: "Commission only" },
                  { v: "base_plus_commission", label: "Base + commission" },
                ]}
                onChange={(v) => update("compMode", v as any)}
              />
              {(form.compMode === "salary" || form.compMode === "base_plus_commission") && (
                <NumField label="Annual base ($)" value={form.baseSalaryUsd ?? ""} onChange={(v) => update("baseSalaryUsd", v)} />
              )}
              {form.compMode === "hourly" && (
                <NumField label="Hourly rate ($/hr)" value={form.hourlyRateUsd ?? ""} onChange={(v) => update("hourlyRateUsd", v)} />
              )}

              {(form.compMode === "commission_only" || form.compMode === "base_plus_commission") && (
                <>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 bg-background/40 p-2.5 hover:border-primary/30 transition-colors">
                    <input
                      type="checkbox"
                      checked={!!form.commissionTbd}
                      onChange={(e) => update("commissionTbd", e.target.checked)}
                      className="mt-0.5 h-3.5 w-3.5 accent-primary"
                    />
                    <div className="flex flex-col gap-0.5 flex-1">
                      <span className="text-[12px] font-medium text-foreground">
                        Commission rate to be determined
                      </span>
                      <span className="text-[10.5px] text-muted-foreground">
                        The letter includes an addendum clause — rate, basis, and
                        timing finalized in a signed follow-up.
                      </span>
                    </div>
                  </label>

                  {!form.commissionTbd && (
                    <div className="grid grid-cols-2 gap-2">
                      <NumField
                        label="Rate (%)"
                        value={form.commissionRatePercent ?? ""}
                        onChange={(v) => update("commissionRatePercent", v)}
                      />
                      <Select
                        label="Basis"
                        value={form.commissionBasis ?? "collected_revenue"}
                        options={[
                          { v: "gross_revenue", label: "Gross revenue" },
                          { v: "collected_revenue", label: "Collected (when paid)" },
                          { v: "net_revenue", label: "Net (after refunds)" },
                          { v: "gross_profit", label: "Gross profit" },
                        ]}
                        onChange={(v) => update("commissionBasis", v as any)}
                      />
                    </div>
                  )}
                  {!form.commissionTbd && (
                    <Field
                      label="Commission notes"
                      value={form.commissionNotes ?? ""}
                      onChange={(v) => update("commissionNotes", v)}
                      multiline
                      placeholder="Earned when customer pays invoice. Paid monthly. No commission on deals closed within 30 days of departure."
                    />
                  )}

                  {form.commissionTbd && (
                    <Callout tone="amber">
                      Good for first hires where you're still figuring out revenue
                      economics. The letter says the commission structure is
                      pending an addendum — no made-up number you'd have to
                      renegotiate later.
                    </Callout>
                  )}

                  {form.compMode === "commission_only" && form.employmentType.startsWith("w2_") && (
                    <Callout tone="red">
                      W-2 commission-only: state minimum wage still applies when
                      averaged over each pay period. Most states also require a{" "}
                      <em>written</em> commission agreement signed by both
                      parties (CA Labor Code §2751, similar in NY / IL).
                    </Callout>
                  )}
                </>
              )}

              <Select
                label="Pay schedule"
                value={form.paySchedule ?? "monthly"}
                options={[
                  { v: "weekly", label: "Weekly" },
                  { v: "biweekly", label: "Bi-weekly" },
                  { v: "semimonthly", label: "Semi-monthly (1st + 15th)" },
                  { v: "monthly", label: "Monthly" },
                ]}
                onChange={(v) => update("paySchedule", v as any)}
              />
            </Card>

            {/* Benefits */}
            <Card icon={Gift} title="Benefits & time off">
              <div className="flex flex-wrap gap-1.5">
                {BENEFIT_OPTIONS.map((b) => {
                  const active = (form.benefits ?? []).includes(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggleBenefit(b)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] transition-all ${
                        active
                          ? "border-primary/50 bg-primary/15 text-primary shadow-sm"
                          : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
              <NumField
                label="PTO days / year (blank = none)"
                value={form.ptoDaysPerYear ?? ""}
                onChange={(v) => update("ptoDaysPerYear", v)}
              />
            </Card>

            {/* Dates */}
            <Card icon={CalIcon} title="Dates">
              <div className="grid grid-cols-2 gap-2">
                <Field label="Start date" type="date" value={form.startDate ?? ""} onChange={(v) => update("startDate", v)} />
                <Field label="Offer expires" type="date" value={form.offerExpiresAt ?? ""} onChange={(v) => update("offerExpiresAt", v)} />
              </div>
            </Card>

            {/* Contingencies */}
            <Card icon={CopyCheck} title="Contingencies">
              <div className="flex flex-col gap-1">
                {CONTINGENCY_OPTIONS.map((c) => (
                  <label key={c.key} className="flex items-start gap-2 text-[12px] cursor-pointer rounded-md px-1.5 py-1 hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={(form.contingencies ?? []).includes(c.key)}
                      onChange={() => toggleContingency(c.key)}
                      className="mt-0.5 h-3.5 w-3.5 accent-primary"
                    />
                    <span className="leading-snug">{c.label}</span>
                  </label>
                ))}
              </div>
            </Card>

            {/* Additional terms */}
            <Card icon={MessageSquareQuote} title="Additional terms (optional)">
              <Field
                label=""
                value={form.additionalTerms ?? ""}
                onChange={(v) => update("additionalTerms", v)}
                multiline
                placeholder="Any custom clauses to include…"
              />
            </Card>

            {/* Actions — sticky at bottom of form column */}
            <div className="sticky bottom-0 -mx-5 border-t border-border bg-background/95 px-5 py-3 flex items-center gap-2 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={generate}
                disabled={generating}
                className="flex h-9 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 shadow-sm"
              >
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {generated ? "Regenerate" : "Generate draft"}
              </button>
              <button
                type="button"
                onClick={persist}
                disabled={!generated || saving}
                className="flex h-9 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-[12px] font-semibold text-foreground hover:border-primary/40 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {currentId ? "Update" : "Save draft"}
              </button>
            </div>

            {generateError && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-[11.5px] text-red-200">
                {generateError}
              </div>
            )}
          </div>
        </div>

        {/* ── Right — preview ─────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-muted/10">
          <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-card/40">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                Preview
              </span>
              {generated && (
                <span className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground/60">
                  · click to edit
                </span>
              )}
            </div>
            {generated && (
              <button
                type="button"
                onClick={exportPdf}
                disabled={exporting}
                className={`flex h-8 items-center gap-2 rounded-md border px-3 text-[11px] font-semibold transition-colors ${brandTokens.border} bg-card hover:brightness-110 ${brandTokens.accentText}`}
              >
                {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                Export PDF
              </button>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="mx-auto max-w-[760px] p-8 space-y-5">
              {/* Hiring actions panel — shown once the offer has an id */}
              {currentId && (
                <HiringActions
                  current={currentSaved}
                  form={form}
                  generatedBody={generated}
                  onMutated={() => setRefreshTick((x) => x + 1)}
                />
              )}
              {!generated ? (
                <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground">
                  <div className="h-14 w-14 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center mb-4">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-[14px] font-medium text-foreground mb-1">
                    No draft yet
                  </p>
                  <p className="text-[11.5px] max-w-sm">
                    Fill in the form and click <b>Generate draft</b>. Claude
                    produces a complete first-draft offer letter from your
                    structured inputs.
                  </p>
                </div>
              ) : (
                <motion.article
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="relative rounded-lg overflow-hidden shadow-2xl"
                >
                  {/* Brand accent strip */}
                  <div className={`h-1.5 ${brandTokens.accent}`} />
                  {/* Letterhead */}
                  <div className={`bg-gradient-to-br ${brandTokens.softBg} px-10 pt-8 pb-5 border-b border-border/60`}>
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-md bg-background/30 border border-white/10 flex items-center justify-center overflow-hidden">
                        <img
                          src={brandTokens.logo}
                          alt=""
                          className="h-9 w-9 object-contain"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                      </div>
                      <div>
                        <div className={`text-[17px] font-bold tracking-tight ${brandTokens.accentText}`}>
                          {form.employerLegalName}
                        </div>
                        <div className="font-mono text-[9.5px] uppercase tracking-widest text-muted-foreground">
                          {brandTokens.label} · {brandTokens.tagline}
                        </div>
                        {form.employerAddress && (
                          <div className="text-[10.5px] text-muted-foreground mt-1">
                            {form.employerAddress}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Body */}
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setGenerated(e.currentTarget.textContent || "")}
                    className="bg-card px-10 py-9 font-serif text-[13px] leading-[1.65] text-foreground/95 whitespace-pre-wrap focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    {generated}
                  </div>
                  {/* Footer */}
                  <div className="bg-card px-10 py-4 border-t border-border/60 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    <span>{form.employerLegalName} · Confidential</span>
                    <span className={brandTokens.accentText}>{brandTokens.label}</span>
                  </div>
                </motion.article>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// ── Primitives ─────────────────────────────────────────────────────

function Card({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-2.5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h3 className="font-mono text-[9.5px] uppercase tracking-widest text-foreground/80">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted/40 text-muted-foreground border-border/60",
    sent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    accepted: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    declined: "bg-red-500/15 text-red-300 border-red-500/30",
    withdrawn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  return (
    <span className={`rounded-full border px-1.5 py-0 font-mono text-[8.5px] uppercase tracking-widest ${map[status] || map.draft}`}>
      {status}
    </span>
  );
}

function Callout({
  tone, children,
}: {
  tone: "amber" | "red" | "emerald";
  children: React.ReactNode;
}) {
  const tones = {
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-200/90",
    red: "border-red-500/30 bg-red-500/10 text-red-200/90",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200/90",
  };
  return (
    <p className={`rounded-md border p-2 text-[10.5px] leading-relaxed ${tones[tone]}`}>
      {children}
    </p>
  );
}

function Field({
  label, value, onChange, placeholder, required, multiline, type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
  type?: string;
}) {
  const inputCls =
    "w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-[12.5px] text-foreground/95 placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors";
  return (
    <label className="flex flex-col gap-1">
      {label && (
        <span className="text-[10.5px] text-muted-foreground">
          {label}
          {required && <span className="text-red-400 ml-0.5">*</span>}
        </span>
      )}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={inputCls}
        />
      ) : (
        <input
          type={type || "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
      )}
    </label>
  );
}

function NumField({
  label, value, onChange,
}: {
  label: string;
  value: number | string;
  onChange: (v: number | null) => void;
}) {
  return (
    <Field
      label={label}
      type="number"
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(v) => {
        if (!v.trim()) onChange(null);
        else {
          const n = parseFloat(v);
          onChange(Number.isFinite(n) ? n : null);
        }
      }}
    />
  );
}

function Select({
  label, value, options, onChange,
}: {
  label: string;
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-[12.5px] text-foreground/95 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
