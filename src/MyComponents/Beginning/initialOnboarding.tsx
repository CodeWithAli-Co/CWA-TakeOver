/**
 * initialOnboarding.tsx — pre-login install-binder.
 *
 * Runs on first launch of a fresh install, gated by Zustand's
 * initial_launch flag (wired in routes/__root.tsx). The job is
 * NOT to onboard a user — it's to bind this desktop install to
 * a customer company's per-tenant Supabase DB.
 *
 * High-level flow:
 *
 *   step 1  Founder vs Employee
 *           If Employee: bounce to login.
 *
 *   step 2  Founder: bind to company
 *           founderEmail + companyName + companyEmail →
 *           SELECT from takeover_companies where all three
 *           match. On hit, persist company_name into Stronghold
 *           so future launches load the right tenant DB.
 *
 *   step 3  Founder: pick industry
 *
 *   step 3b Founder: pick TakeOver components (toggle)
 *           UPDATE takeover_companies SET components = …
 *
 *   step 4  Founder: connectors / import files (stub for now,
 *           real catalog wires in onboarding-handoff-6)
 *
 *   step 5  completeInitialLaunch() → drops user at login.
 *
 * Author note (Hanif): "The stronghold should be initialized
 * once and once alone." We use getStronghold() everywhere to
 * get the shared singleton.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "@tanstack/react-form";
import { useStore } from "@tanstack/react-store";
import {
  Building2,
  UserCircle2,
  Cpu,
  Banknote,
  Sparkles as SparklesIcon,
  Scale,
  HeartPulse,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";

import { companySupabase, takeOversupabase } from "../supabase";
import { getStronghold } from "@/stores/stronghold";
import {
  FieldGroup,
  FormField,
  OptionTile,
  StepActions,
  StepHeader,
  StepShell,
  TextInput,
} from "@/MyComponents/Onboarding/onboardingPrimitives";
import {
  CONNECTORS,
  Monogram,
  type CatalogEntry,
} from "@/MyComponents/SettingNavComponents/connectorCatalog";
import { ConnectorCredentialDialog } from "@/MyComponents/SettingNavComponents/ConnectorCredentialDialog";
import { useConnectors } from "@/stores/connectors";
import { MODULES } from "@/MyComponents/Onboarding/modulesCatalog";
// Onboarding uses the live-preview Builder; Settings keeps the
// flat ModulesPicker (imported there directly).
import { ModulesBuilder } from "@/MyComponents/Onboarding/ModulesBuilder";

// ─────────────────────────────────────────────────────────────
// Catalog
// ─────────────────────────────────────────────────────────────

const COMPANY_INDUSTRIES = {
  tech: {
    label: "Tech",
    desc: "Software, hardware, dev tools, internal platforms.",
    icon: Cpu as LucideIcon,
  },
  fintech: {
    label: "Fintech",
    desc: "Payments, lending, treasury, neobank.",
    icon: Banknote as LucideIcon,
  },
  ai: {
    label: "AI",
    desc: "ML platforms, agents, applied research.",
    icon: SparklesIcon as LucideIcon,
  },
  law: {
    label: "Law",
    desc: "Practice management, document review, compliance.",
    icon: Scale as LucideIcon,
  },
  healthcare: {
    label: "Healthcare",
    desc: "Clinical, biotech, devices, payer ops.",
    icon: HeartPulse as LucideIcon,
  },
} as const;
type CompanyIndustry = keyof typeof COMPANY_INDUSTRIES;

/**
 * Module catalog now lives in @/MyComponents/Onboarding/modulesCatalog
 * so the Settings → Modules page can render the exact same picker.
 * `TakeOverComponent` is therefore just `string` (module id).
 */
type TakeOverComponent = string;

// ─────────────────────────────────────────────────────────────
// Step machine
// ─────────────────────────────────────────────────────────────

type FounderStepId =
  | "identity"
  | "company"
  | "industry"
  | "components"
  | "connectors";

const FOUNDER_STEPS: FounderStepId[] = [
  "identity",
  "company",
  "industry",
  "components",
  "connectors",
];

interface Props {
  completeInitialLaunch: () => void;
  /** When true, all DB writes (Supabase + Stronghold) are
   *  skipped. Used by the dashboard's preview pill so an
   *  already-bound install can walk through the wizard without
   *  rebinding or corrupting the current company. */
  debugMode?: boolean;
}

const InitialOnboarding = ({
  completeInitialLaunch,
  debugMode = false,
}: Props) => {
  const [isFounder, setIsFounder] = useState<boolean | null>(null);
  const [stepId, setStepId] = useState<FounderStepId>("identity");

  const [companyId, setCompanyId] = useState<number | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const [industry, setIndustry] = useState<CompanyIndustry | null>(null);
  const [components, setComponents] = useState<TakeOverComponent[]>([]);
  const [bindError, setBindError] = useState<string | null>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);

  const stepIndex = FOUNDER_STEPS.indexOf(stepId);

  // Employee path: insta-finish with a tiny confirmation screen.
  useEffect(() => {
    if (isFounder === false) {
      const t = setTimeout(() => completeInitialLaunch(), 900);
      return () => clearTimeout(t);
    }
  }, [isFounder, completeInitialLaunch]);

  const founderForm = useForm({
    defaultValues: {
      founderEmail: "",
      companyName: "",
      companyEmail: "",
    },
    onSubmit: async ({ value }) => {
      setBindError(null);

      // Debug mode: skip the DB lookup + Stronghold write and
      // fake-advance. Lets the dashboard preview pill walk
      // through the entire wizard without touching real data.
      if (debugMode) {
        setCompanyId(0);
        setCompanyName(value.companyName || "Preview Co.");
        setStepId("industry");
        return;
      }
      console.log(value);

      const { data, error } = await takeOversupabase
        .from("takeover_companies")
        .select("id,initialized,companydb_url,companydb_key")
        .eq("company_name", value.companyName)
        .eq("founder_email", value.founderEmail)
        .eq("company_email", value.companyEmail)
        .eq("initialized", false)
        .single();

      if (!data || error) {
        setBindError(
          "We couldn't find a company matching those details. Double-check the founder email, company name, and company email - they must match exactly what was set up with us.",
        );
        return;
      }

      try {
        const sh = await getStronghold();
        await sh.insertRecord("company_name", value.companyName);
      } catch (err) {
        console.error("[onboarding] stronghold write failed:", err);
        setBindError(
          "Found your company, but failed to remember it locally. Restart the app and try again.",
        );
        return;
      }

      // *Check if connection to compnay DB was successful
      // ...

      setCompanyId((data as { id: number }).id);
      setCompanyName(value.companyName);
      setStepId("industry");
    },
  });

  const persistComponents = async (): Promise<boolean> => {
    if (!companyId) return true;
    // Debug mode: no-op. Still let user advance to the
    // connectors step so they can see the whole flow.
    if (debugMode) {
      if (import.meta.env.DEV) {
        console.log(
          "[onboarding][debug] would persist components:",
          components,
        );
      }
      return true;
    }
    setPersisting(true);
    setPersistError(null);

    if (import.meta.env.DEV) {
      console.log("[onboarding] persisting components:", components);
    }

    const { error } = await takeOversupabase
      .from("takeover_companies")
      .update({ components })
      .eq("id", companyId);

    setPersisting(false);

    if (error) {
      console.error("[onboarding] component update failed:", error);
      setPersistError(error.message);
      return false;
    }
    return true;
  };

  const goBack = () => {
    const i = FOUNDER_STEPS.indexOf(stepId);
    if (i <= 0) return;
    setStepId(FOUNDER_STEPS[i - 1]!);
  };

  const goToConnectors = async () => {
    const ok = await persistComponents();
    if (ok) setStepId("connectors");
  };

  const finish = async () => {
    const { error } = await takeOversupabase
      .from("takeover_companies")
      .update({ initialized: true })
      .eq("id", companyId);
    if (error) {
      console.error("Error initializing company.");
      setBindError("Failed to Initialize company");
      setStepId("company");
      return;
    }
    completeInitialLaunch();
  };

  if (isFounder === false) {
    return (
      <Shell>
        <EmployeeBouncer />
      </Shell>
    );
  }

  return (
    <Shell>
      <StepShell
        currentStep={Math.max(0, stepIndex)}
        totalSteps={FOUNDER_STEPS.length}
        width={
          stepId === "components" || stepId === "connectors" ? "grid" : "form"
        }
      >
        <AnimatePresence mode="wait">
          {stepId === "identity" && (
            <IdentityStep
              key="identity"
              onPick={(role) => {
                if (role === "founder") {
                  setIsFounder(true);
                  setStepId("company");
                } else {
                  setIsFounder(false);
                }
              }}
            />
          )}

          {stepId === "company" && (
            <CompanyBindingStep
              key="company"
              form={founderForm}
              bindError={bindError}
              onBack={goBack}
            />
          )}

          {stepId === "industry" && (
            <IndustryStep
              key="industry"
              value={industry}
              onChange={setIndustry}
              onBack={goBack}
              onNext={() => setStepId("components")}
            />
          )}

          {stepId === "components" && (
            <ComponentsStep
              key="components"
              value={components}
              onChange={setComponents}
              onBack={goBack}
              onNext={goToConnectors}
              loading={persisting}
              error={persistError}
            />
          )}

          {stepId === "connectors" && (
            <ConnectorsStep
              key="connectors"
              companyName={companyName}
              onBack={goBack}
              onFinish={finish}
              debugMode={debugMode}
            />
          )}
        </AnimatePresence>
      </StepShell>
    </Shell>
  );
};

export default InitialOnboarding;

// ═════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════

function Shell({ children }: { children: React.ReactNode }) {
  // h-screen (NOT min-h-screen) is what makes scroll actually work:
  // min-h-screen lets the container grow with content past the
  // viewport, so overflow-y-auto never has anything to trigger
  // against. h-screen pins the container at exactly viewport
  // height, and overflow-y-auto scrolls within it. items-start
  // anchors content to the top.
  return (
    <div className="relative w-full h-screen bg-background text-foreground flex items-start justify-center overflow-y-auto">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.05]"
        style={{
          background:
            "radial-gradient(60% 70% at 0% 0%, hsl(var(--primary)) 0%, transparent 60%)",
        }}
      />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

function IdentityStep({
  onPick,
}: {
  onPick: (role: "founder" | "employee") => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
    >
      <StepHeader
        eyebrow="Welcome to TakeOver"
        title="Which one are you?"
        subtitle="We'll set up your install based on who you are. You can change this later from Settings."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <OptionTile
          icon={Building2}
          label="Founder"
          description="You run the company. Bind this install to your TakeOver workspace."
          active={false}
          onClick={() => onPick("founder")}
        />
        <OptionTile
          icon={UserCircle2}
          label="Employee"
          description="You work at a company already on TakeOver. Take me to login."
          active={false}
          onClick={() => onPick("employee")}
        />
      </div>
    </motion.div>
  );
}

function EmployeeBouncer() {
  return (
    <div className="w-full max-w-md mx-auto px-6 py-10 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-14 h-14 rounded-2xl bg-primary/12 border border-primary/30 flex items-center justify-center mx-auto mb-5"
      >
        <UserCircle2 className="h-7 w-7 text-primary" strokeWidth={2.2} />
      </motion.div>
      <h2 className="text-[20px] font-bold text-foreground leading-tight mb-2">
        Heading to login
      </h2>
      <p className="text-[13px] text-text-tertiary leading-relaxed max-w-sm mx-auto">
        Sign in with the account your admin set up for you.
      </p>
      <div className="mt-6 inline-flex items-center gap-2 text-[12px] text-text-tertiary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        One moment...
      </div>
    </div>
  );
}

function CompanyBindingStep({
  form,
  bindError,
  onBack,
}: {
  form: any;
  bindError: string | null;
  onBack: () => void;
}) {
  const isSubmitting = useStore(form.store, (s: any) => s.isSubmitting);
  const canSubmit = useStore(
    form.store,
    (s: any) =>
      (s.values.founderEmail?.trim().length ?? 0) > 4 &&
      (s.values.companyName?.trim().length ?? 0) > 1 &&
      (s.values.companyEmail?.trim().length ?? 0) > 4,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
    >
      <StepHeader
        eyebrow="Step 2 of 5"
        title="Find your company."
        subtitle="We'll match these against your registered workspace. They must match exactly what we set up with you."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="space-y-3.5"
      >
        <FieldGroup title="Founder" icon={UserCircle2}>
          <form.Field
            name="founderEmail"
            children={(field: any) => (
              <FormField label="Founder email" required>
                <TextInput
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="you@company.com"
                  type="email"
                  autoFocus
                />
              </FormField>
            )}
          />
        </FieldGroup>

        <FieldGroup title="Company" icon={Building2}>
          <form.Field
            name="companyName"
            children={(field: any) => (
              <FormField label="Company name" required>
                <TextInput
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="Acme Corp"
                />
              </FormField>
            )}
          />
          <form.Field
            name="companyEmail"
            children={(field: any) => (
              <FormField label="Company email" required>
                <TextInput
                  value={field.state.value}
                  onChange={field.handleChange}
                  placeholder="hello@company.com"
                  type="email"
                />
              </FormField>
            )}
          />
        </FieldGroup>

        {bindError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2.5">
            <AlertTriangle
              className="h-4 w-4 text-destructive shrink-0 mt-px"
              strokeWidth={2.4}
            />
            <p className="text-[12px] text-destructive leading-relaxed">
              {bindError}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-7">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[12px] font-semibold text-text-tertiary hover:text-foreground transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[12.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.45)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Looking up...
              </>
            ) : (
              "Find my company"
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

function IndustryStep({
  value,
  onChange,
  onBack,
  onNext,
}: {
  value: CompanyIndustry | null;
  onChange: (v: CompanyIndustry) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
    >
      <StepHeader
        eyebrow="Step 3 of 5"
        title="What industry are you in?"
        subtitle="Drives sensible defaults - modules, dashboards, Axon prompts."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {(
          Object.entries(COMPANY_INDUSTRIES) as Array<
            [CompanyIndustry, (typeof COMPANY_INDUSTRIES)[CompanyIndustry]]
          >
        ).map(([key, det]) => (
          <OptionTile
            key={key}
            icon={det.icon}
            label={det.label}
            description={det.desc}
            active={value === key}
            onClick={() => onChange(key)}
          />
        ))}
      </div>
      <StepActions onBack={onBack} onNext={onNext} nextDisabled={!value} />
    </motion.div>
  );
}

function ComponentsStep({
  value,
  onChange,
  onBack,
  onNext,
  loading,
  error,
}: {
  value: TakeOverComponent[];
  onChange: (v: TakeOverComponent[]) => void;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
    >
      <StepHeader
        eyebrow="Step 4 of 5"
        title="Build your stack."
        subtitle={`Tap a module, watch it land in your dashboard. ${value.length} of ${MODULES.length} modules picked.`}
      />

      <ModulesBuilder value={value} onChange={onChange} />

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 flex items-start gap-2.5">
          <AlertTriangle
            className="h-4 w-4 text-destructive shrink-0 mt-px"
            strokeWidth={2.4}
          />
          <p className="text-[12px] text-destructive leading-relaxed">
            Failed to save: {error}
          </p>
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={onNext}
        nextDisabled={value.length === 0}
        loading={loading}
      />
    </motion.div>
  );
}

// Old inline ComponentCard removed — module rendering is now
// owned by `ModulesPicker` so onboarding + Settings render the
// same way.

/**
 * ConnectorsStep — Step 5 of 5.
 *
 * Reuses the existing Settings catalog + ConnectorCredentialDialog,
 * so every schema and verify wired up in Settings is automatically
 * available here. HubSpot is pinned first with a Recommended badge —
 * it's the headline connector for the current launch customer.
 *
 * `debugMode` disables the connect dialog so the preview pill can
 * walk through this screen without touching the real connectors
 * table.
 */
function ConnectorsStep({
  companyName,
  onBack,
  onFinish,
  debugMode,
}: {
  companyName: string;
  onBack: () => void;
  onFinish: () => void;
  debugMode: boolean;
}) {
  const { data: connectors = [] } = useConnectors();
  const [activeKind, setActiveKind] = useState<string | null>(null);

  // Curated subset. Order matters — HubSpot first since it's the
  // primary stack for the current launch customer. The full
  // 15-connector catalog is still available from Settings.
  const featuredIds = ["hubspot", "airtable", "stripe", "notion", "github"];
  const featured = featuredIds
    .map((id) => CONNECTORS.find((c) => c.id === id))
    .filter((c): c is CatalogEntry => !!c);

  const connectedKinds = new Set(connectors.map((c) => c.kind));
  const activeEntry = activeKind
    ? (CONNECTORS.find((c) => c.id === activeKind) ?? null)
    : null;
  const activeExisting = activeKind
    ? (connectors.find((c) => c.kind === activeKind) ?? null)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.25 }}
    >
      <StepHeader
        eyebrow="Step 5 of 5"
        title="Bring in your data."
        subtitle={`${companyName ? `${companyName} ` : ""}talks to other tools - wire one up now so the dashboard isn't empty on day one. You can always add more from Settings.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {featured.map((entry) => (
          <ConnectorCard
            key={entry.id}
            entry={entry}
            connected={connectedKinds.has(entry.id)}
            recommended={entry.id === "hubspot"}
            disabled={debugMode}
            onClick={() => {
              if (debugMode) return;
              setActiveKind(entry.id);
            }}
          />
        ))}
      </div>

      {debugMode && (
        <p className="text-[11px] text-text-tertiary text-center mt-3 italic">
          Preview mode - connect dialogs disabled.
        </p>
      )}

      <p className="text-[11.5px] text-text-tertiary text-center mt-4 max-w-md mx-auto leading-relaxed">
        Skip this and wire connectors up later from Settings - Connectors.
      </p>

      <StepActions
        onBack={onBack}
        onNext={onFinish}
        onSkip={onFinish}
        nextLabel="Take me to login"
      />

      {activeEntry && (
        <ConnectorCredentialDialog
          kind={activeEntry.id}
          name={activeEntry.name}
          existing={activeExisting}
          onClose={() => setActiveKind(null)}
        />
      )}
    </motion.div>
  );
}

/**
 * ConnectorCard — single tile inside ConnectorsStep. Mirrors the
 * Settings catalog tile but more compact so 5+ fit comfortably
 * in the wizard column. Uses the same Monogram component for
 * brand parity.
 */
function ConnectorCard({
  entry,
  connected,
  recommended,
  disabled,
  onClick,
}: {
  entry: CatalogEntry;
  connected: boolean;
  recommended: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={disabled ? undefined : { y: -1 }}
      disabled={disabled}
      className={`text-left rounded-2xl border p-4 transition-colors relative ${
        connected
          ? "border-primary/60 bg-primary/[0.06]"
          : "border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-foreground/20"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      {recommended && !connected && (
        <span className="absolute -top-2 left-3 px-2 h-4 rounded-full text-[9px] font-bold uppercase tracking-[0.16em] bg-primary text-primary-foreground flex items-center">
          Recommended
        </span>
      )}
      <div className="flex items-start gap-3">
        <Monogram letter={entry.monogram} color={entry.brand} size={40} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-bold text-foreground/90 leading-tight">
              {entry.name}
            </h3>
            {connected && (
              <span className="ml-auto inline-flex items-center gap-1 px-1.5 h-4 rounded-full bg-primary/15 border border-primary/30 text-primary text-[9px] font-bold uppercase tracking-[0.14em]">
                <CheckCircle2 size={9} strokeWidth={2.8} />
                Connected
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-text-tertiary mt-1 leading-relaxed">
            {entry.tagline}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
