/**
 * company.tsx — dual-brand company settings.
 *
 * Takeover runs two companies out of the same tenant: CodeWithAli
 * (software agency + media) and Simplicity Funds (finance / ops).
 * The old company settings page was single-brand and hardcoded to
 * CWA. This rewrite shows both brands with a segmented toggle at
 * the top, each with its own full panel of legal info, branding,
 * contact details, and socials.
 *
 * Real facts baked in where I know them; placeholders with clear
 * "add this" hints elsewhere. Ali corrects anything wrong.
 *
 * Persistence: not yet wired to a DB table. This is presentational
 * state for now — when there's a `companies` table in Supabase we
 * swap the useState for supabase upsert, and all the fields + save
 * button logic is already in place.
 */

import { useState } from "react";
import {
  Building2, Globe, Mail, Phone, MapPin, Users,
  Linkedin, Facebook, Instagram, Twitter,
  Save, Check, Loader2, AlertCircle, Palette,
  FileText, Briefcase, Hash,
} from "lucide-react";

type BrandKey = "codewithali" | "simplicity";

interface CompanyData {
  legalName: string;
  doingBusinessAs: string;
  tagline: string;
  description: string;
  website: string;
  primaryEmail: string;
  phone: string;
  address: string;
  state: string;
  ein: string;
  yearFounded: string;
  employeeCount: string;
  signerName: string;
  signerTitle: string;
  accent: string;
  socials: {
    linkedin: string;
    twitter: string;
    instagram: string;
    facebook: string;
  };
}

// ── Seed data — known facts from prior work ────────────────────

const INITIAL_DATA: Record<BrandKey, CompanyData> = {
  codewithali: {
    legalName: "CodeWithAli LLC",
    doingBusinessAs: "CodeWithAli",
    tagline: "Software agency & media",
    description:
      "Custom web and desktop software end-to-end — design, frontend, backend, deployment, and the ongoing maintenance most agencies hand off to someone else.",
    website: "https://codewithali.com",
    primaryEmail: "hire@codewithali.com",
    phone: "",
    address: "",
    state: "",
    ein: "",
    yearFounded: "",
    employeeCount: "11-50",
    signerName: "Ali Alibrahimi",
    signerTitle: "Chief Executive Officer",
    accent: "#DC2626", // red-600
    socials: {
      linkedin: "https://www.linkedin.com/company/codewithali-co",
      twitter: "https://twitter.com/codewithali",
      instagram: "https://instagram.com/codewithali",
      facebook: "https://facebook.com/codewithali",
    },
  },
  simplicity: {
    legalName: "Simplicity Funds",
    doingBusinessAs: "Simplicity",
    tagline: "Finance & operations",
    description:
      "Financial operations, fund accounting, and back-office infrastructure — purpose-built for founders who want clean books without hiring a CFO.",
    website: "https://simplicityfunds.com",
    primaryEmail: "hire@simplicityfunds.com",
    phone: "",
    address: "",
    state: "",
    ein: "",
    yearFounded: "",
    employeeCount: "1-10",
    signerName: "Ali Alibrahimi",
    signerTitle: "Chief Executive Officer",
    accent: "#059669", // emerald-600
    socials: {
      linkedin: "",
      twitter: "",
      instagram: "",
      facebook: "",
    },
  },
};

// ── Component ──────────────────────────────────────────────────

type SaveState = "idle" | "saving" | "saved" | "error";

export function CompanySettings() {
  const [active, setActive] = useState<BrandKey>("codewithali");
  const [data, setData] = useState(INITIAL_DATA);
  const [originalData] = useState(INITIAL_DATA);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const current = data[active];
  const isDirty =
    JSON.stringify(current) !== JSON.stringify(originalData[active]);

  const patch = (updates: Partial<CompanyData>) => {
    setData((prev) => ({
      ...prev,
      [active]: { ...prev[active], ...updates },
    }));
  };

  const patchSocial = (platform: keyof CompanyData["socials"], value: string) => {
    setData((prev) => ({
      ...prev,
      [active]: {
        ...prev[active],
        socials: { ...prev[active].socials, [platform]: value },
      },
    }));
  };

  const save = async () => {
    setSaveState("saving");
    // Placeholder — swap for supabase upsert when companies table lands.
    await new Promise((r) => setTimeout(r, 600));
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Brand toggle */}
      <BrandToggle active={active} onChange={setActive} />

      {/* Legal / identity */}
      <Card icon={Building2} label="Legal & identity">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="Legal entity name"
            hint="As it appears on IRS filings + contracts."
            value={current.legalName}
            onChange={(v) => patch({ legalName: v })}
          />
          <InputField
            label="Doing business as"
            hint="Public-facing short name."
            value={current.doingBusinessAs}
            onChange={(v) => patch({ doingBusinessAs: v })}
          />
          <InputField
            label="Tagline"
            hint="One-liner that appears in emails + PDFs."
            value={current.tagline}
            onChange={(v) => patch({ tagline: v })}
          />
          <InputField
            label="Year founded"
            placeholder="e.g. 2023"
            value={current.yearFounded}
            onChange={(v) => patch({ yearFounded: v })}
          />
        </div>
        <TextareaField
          label="Description"
          hint="Used in outbound emails, onboarding docs, and the hiring pipeline."
          value={current.description}
          onChange={(v) => patch({ description: v })}
          rows={3}
        />
      </Card>

      {/* Contact */}
      <Card icon={Mail} label="Contact">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="Website"
            icon={Globe}
            placeholder="https://example.com"
            value={current.website}
            onChange={(v) => patch({ website: v })}
          />
          <InputField
            label="Primary email"
            icon={Mail}
            placeholder="hire@example.com"
            value={current.primaryEmail}
            onChange={(v) => patch({ primaryEmail: v })}
          />
          <InputField
            label="Phone"
            icon={Phone}
            placeholder="Optional"
            value={current.phone}
            onChange={(v) => patch({ phone: v })}
          />
          <InputField
            label="State of operation"
            hint="For tax + employment law defaults (at-will, WARN, etc.)."
            placeholder="CA, NY, TX, …"
            value={current.state}
            onChange={(v) => patch({ state: v })}
          />
        </div>
        <TextareaField
          label="Mailing address"
          icon={MapPin}
          placeholder={active === "codewithali"
            ? "CodeWithAli LLC, street, city, state, zip"
            : "Simplicity Funds, street, city, state, zip"}
          value={current.address}
          onChange={(v) => patch({ address: v })}
          rows={2}
        />
      </Card>

      {/* Legal filing info */}
      <Card icon={FileText} label="Legal filings">
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="EIN"
            icon={Hash}
            hint="Federal tax ID. Leave blank if not yet assigned."
            placeholder="XX-XXXXXXX"
            value={current.ein}
            onChange={(v) => patch({ ein: v })}
          />
          <InputField
            label="Team size"
            icon={Users}
            value={current.employeeCount}
            onChange={(v) => patch({ employeeCount: v })}
          />
        </div>
      </Card>

      {/* Authorized signer */}
      <Card icon={Briefcase} label="Authorized signer">
        <p className="mb-3 text-[11.5px] text-muted-foreground leading-snug">
          Name + title that appears on offer letters, contractor agreements, and
          companion docs. Used in both email and PDF signature blocks.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="Signer name"
            value={current.signerName}
            onChange={(v) => patch({ signerName: v })}
          />
          <InputField
            label="Signer title"
            value={current.signerTitle}
            onChange={(v) => patch({ signerTitle: v })}
          />
        </div>
      </Card>

      {/* Branding */}
      <Card icon={Palette} label="Branding">
        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
          <InputField
            label="Accent color"
            hint="Used in offer PDFs, emails, and accept/receipt pages."
            placeholder="#DC2626"
            value={current.accent}
            onChange={(v) => patch({ accent: v })}
          />
          <div className="flex items-center justify-center rounded-md border border-border bg-background/40 p-3">
            <div
              className="h-12 w-12 rounded-md shadow-sm"
              style={{ background: current.accent }}
              aria-label="Color preview"
            />
          </div>
        </div>
      </Card>

      {/* Socials */}
      <Card icon={Globe} label="Social links">
        <div className="grid gap-3 md:grid-cols-2">
          <SocialField
            icon={Linkedin}
            label="LinkedIn"
            value={current.socials.linkedin}
            onChange={(v) => patchSocial("linkedin", v)}
          />
          <SocialField
            icon={Twitter}
            label="X / Twitter"
            value={current.socials.twitter}
            onChange={(v) => patchSocial("twitter", v)}
          />
          <SocialField
            icon={Instagram}
            label="Instagram"
            value={current.socials.instagram}
            onChange={(v) => patchSocial("instagram", v)}
          />
          <SocialField
            icon={Facebook}
            label="Facebook"
            value={current.socials.facebook}
            onChange={(v) => patchSocial("facebook", v)}
          />
        </div>
      </Card>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 backdrop-blur-sm px-5 py-3">
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span>
            Editing <b className="text-foreground">{current.doingBusinessAs}</b>
            {isDirty && saveState !== "saved" && <span className="ml-2 text-amber-300">· unsaved</span>}
            {saveState === "saved" && (
              <span className="ml-2 text-emerald-300 inline-flex items-center gap-1">
                <Check className="h-3 w-3" /> saved
              </span>
            )}
            {saveState === "error" && (
              <span className="ml-2 text-red-300 inline-flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> error
              </span>
            )}
          </span>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || saveState === "saving"}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saveState === "saving" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {saveState === "saving" ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function BrandToggle({
  active, onChange,
}: {
  active: BrandKey;
  onChange: (b: BrandKey) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-border bg-card/40 p-1">
      <BrandButton
        brand="codewithali"
        label="CodeWithAli"
        accent="#DC2626"
        active={active === "codewithali"}
        onClick={() => onChange("codewithali")}
      />
      <BrandButton
        brand="simplicity"
        label="Simplicity Funds"
        accent="#059669"
        active={active === "simplicity"}
        onClick={() => onChange("simplicity")}
      />
    </div>
  );
}

function BrandButton({
  brand, label, accent, active, onClick,
}: {
  brand: BrandKey;
  label: string;
  accent: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-2 rounded-sm px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: accent }}
      />
      {label}
    </button>
  );
}

function Card({
  icon: Icon, label, children,
}: {
  icon: typeof Building2;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground">
          {label}
        </h2>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function InputField({
  label, hint, icon: Icon, placeholder, value, onChange,
}: {
  label: string;
  hint?: string;
  icon?: typeof Building2;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/50 px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
      </div>
      {hint && <p className="mt-1 text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TextareaField({
  label, hint, icon: Icon, placeholder, value, onChange, rows = 3,
}: {
  label: string;
  hint?: string;
  icon?: typeof Building2;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 mb-1.5">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        {label}
      </label>
      <textarea
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full resize-none rounded-md border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
      />
      {hint && <p className="mt-1 text-[10.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SocialField({
  icon: Icon, label, value, onChange,
}: {
  icon: typeof Linkedin;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 mb-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        {label}
      </label>
      <div className="rounded-md border border-border bg-background/50 px-3 py-2 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
        <input
          type="text"
          value={value}
          placeholder={`https://${label.toLowerCase().replace(/\s|\//g, "")}.com/…`}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
        />
      </div>
    </div>
  );
}
