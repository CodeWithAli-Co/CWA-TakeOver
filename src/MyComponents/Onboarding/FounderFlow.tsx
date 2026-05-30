/**
 * FounderFlow.tsx — the 7-screen founder onboarding wizard.
 *
 * One step machine, seven screens, persists progress to
 * `app_users.onboarding_state` after each step so closing
 * mid-flow resumes from the last screen.
 *
 * Final step ("done") commits:
 *   · UPDATE app_users SET role = <picked role>, onboarded_at = NOW()
 *   · Persists company name + modules + connectors choices into
 *     onboarding_state JSONB (no companies table yet — that's a
 *     separate architectural pass).
 *
 * Why a single big file:
 *   · Each step is small (<60 lines on average) and shares the
 *     same data shape — splitting into 8 files added more
 *     navigation overhead than it saved.
 *   · Adding/reordering steps is one array edit + one switch
 *     branch — easier to reason about with everything in view.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Building2,
  Building,
  Users,
  Sparkles,
  Plug,
  Mail,
  Link2,
  PartyPopper,
  Plus,
  X,
  Check,
  Copy,
  type LucideIcon,
} from "lucide-react";
import supabase from "@/MyComponents/supabase";
import {
  useMarkOnboarded,
  useUpdateOnboardingState,
} from "@/stores/onboarding";
import {
  FormField,
  OptionTile,
  PillPicker,
  StepActions,
  StepHeader,
  StepShell,
  TextInput,
  type PillOption,
} from "./onboardingPrimitives";
import { MODULES, defaultModulesFor } from "./modulesCatalog";

// ─────────────────────────────────────────────────────────────────
// Step list + data shape
// ─────────────────────────────────────────────────────────────────

const STEPS = [
  "scope",
  "company",
  "profile",
  "modules",
  "connectors",
  "invite",
  "done",
] as const;
type FounderStep = (typeof STEPS)[number];

export interface FounderData {
  scope?: "single" | "multiple";
  company?: {
    name: string;
    industry?: string;
    teamSize?: string;
  };
  profile?: {
    displayName: string;
    roleTitle: string;
  };
  modules?: string[];
  // Connectors and invite are just acknowledgments — the actual
  // wiring uses existing Settings → Connectors / inviteUserViaTakeover.
  connectorsHandled?: boolean;
  invitedEmails?: string[];
}

// ─────────────────────────────────────────────────────────────────
// FounderFlow — orchestrator
// ─────────────────────────────────────────────────────────────────

export function FounderFlow({
  supaId,
  initialState,
  onBackToFork,
  onComplete,
}: {
  /** Auth user id — used to UPDATE app_users on commit. May be
   *  null if the user has no app_users row yet (new-user
   *  branch); in that case we INSERT instead. */
  supaId: string | null;
  /** Resumed wizard state from a prior session. */
  initialState?: FounderData;
  /** "Back" from the first step returns to the identity fork. */
  onBackToFork: () => void;
  /** Called after the final commit succeeds. Parent typically
   *  re-runs the onboarding branch check, which now reports
   *  `done` and redirects to the dashboard. */
  onComplete: () => void;
}) {
  const [step, setStep] = useState<FounderStep>(
    () => (initialState as any)?._lastStep ?? "scope",
  );
  const [data, setData] = useState<FounderData>(initialState ?? {});
  const updateState = useUpdateOnboardingState();
  const markOnboarded = useMarkOnboarded();

  const stepIndex = STEPS.indexOf(step);

  // Persist after every step change so a crash / close doesn't
  // lose progress. Fire-and-forget — slowness here shouldn't
  // hold up the UI.
  useEffect(() => {
    if (!supaId) return;
    updateState.mutate({
      supaId,
      patch: { ...data, _lastStep: step },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const goNext = (patch: Partial<FounderData>) => {
    setData((d) => ({ ...d, ...patch }));
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };
  const goBack = () => {
    if (stepIndex === 0) {
      onBackToFork();
      return;
    }
    setStep(STEPS[stepIndex - 1]!);
  };

  // Commit on Done — UPDATE app_users with picked role, mark
  // onboarded. Company name + modules go into onboarding_state
  // for now (no companies table yet).
  const commit = async () => {
    if (!supaId) {
      // New-user branch with no app_users row — we'd INSERT here.
      // Punt for now; the next iteration of signup flow creates
      // the row before onboarding even starts.
      onComplete();
      return;
    }
    const { error } = await supabase
      .from("app_users")
      .update({
        role: data.profile?.roleTitle ?? null,
        username: data.profile?.displayName ?? undefined,
        onboarding_state: data,
        onboarded_at: new Date().toISOString(),
      })
      .eq("supa_id", supaId);
    if (error) {
      console.error("[onboarding] commit failed", error);
      // Still call onComplete so the user isn't stuck on the
      // Done screen forever — they can re-onboard if needed.
    }
    markOnboarded.mutate(supaId);
    onComplete();
  };

  return (
    <StepShell currentStep={stepIndex} totalSteps={STEPS.length}>
      <AnimatePresence mode="wait">
        {step === "scope" && (
          <ScopeStep
            key="scope"
            data={data}
            onBack={goBack}
            onNext={goNext}
            isFirst
          />
        )}
        {step === "company" && (
          <CompanyStep
            key="company"
            data={data}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {step === "profile" && (
          <ProfileStep
            key="profile"
            data={data}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {step === "modules" && (
          <ModulesStep
            key="modules"
            data={data}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {step === "connectors" && (
          <ConnectorsStep
            key="connectors"
            data={data}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {step === "invite" && (
          <InviteStep
            key="invite"
            data={data}
            onBack={goBack}
            onNext={goNext}
          />
        )}
        {step === "done" && (
          <DoneStep
            key="done"
            data={data}
            onBack={goBack}
            onCommit={commit}
            committing={markOnboarded.isPending}
          />
        )}
      </AnimatePresence>
    </StepShell>
  );
}

// Shared per-step prop shape.
interface StepProps {
  data: FounderData;
  onBack: () => void;
  onNext: (patch: Partial<FounderData>) => void;
  isFirst?: boolean;
}

// ═════════════════════════════════════════════════════════════════
// Step 1 — Scope
// ═════════════════════════════════════════════════════════════════

function ScopeStep({ data, onBack, onNext, isFirst }: StepProps) {
  const [scope, setScope] = useState<FounderData["scope"]>(data.scope);
  return (
    <>
      <StepHeader
        eyebrow="About you"
        title="How many companies do you run?"
        subtitle="Just curious — you can add more later from Settings."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <OptionTile
          icon={Building2}
          label="Just one"
          description="One company. Clean and focused."
          active={scope === "single"}
          onClick={() => setScope("single")}
        />
        <OptionTile
          icon={Building}
          label="Multiple"
          description="Several companies — set up the first now, add more later."
          active={scope === "multiple"}
          onClick={() => setScope("multiple")}
        />
      </div>
      <StepActions
        onBack={onBack}
        onNext={() => scope && onNext({ scope })}
        nextDisabled={!scope}
        hideBack={isFirst}
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// Step 2 — Company
// ═════════════════════════════════════════════════════════════════

const INDUSTRIES: PillOption<string>[] = [
  { value: "tech", label: "Tech / SaaS" },
  { value: "saas", label: "B2B Services" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "retail", label: "Retail / E-comm" },
  { value: "realestate", label: "Real estate" },
  { value: "education", label: "Education" },
  { value: "other", label: "Other" },
];
const TEAM_SIZES: PillOption<string>[] = [
  { value: "just-me", label: "Just me" },
  { value: "small", label: "2–10" },
  { value: "mid", label: "11–50" },
  { value: "large", label: "51–200" },
  { value: "enterprise", label: "200+" },
];

function CompanyStep({ data, onBack, onNext }: StepProps) {
  const [name, setName] = useState(data.company?.name ?? "");
  const [industry, setIndustry] = useState(data.company?.industry);
  const [teamSize, setTeamSize] = useState(data.company?.teamSize);

  const canSubmit = name.trim().length >= 2;

  return (
    <>
      <StepHeader
        eyebrow="Step 2"
        title="Tell us about your company."
        subtitle="The basics — name and a couple of details so modules can suggest themselves."
      />
      <div className="space-y-5">
        <FormField label="Company name" required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Acme Corp"
            autoFocus
          />
        </FormField>
        <FormField label="Industry" hint="Optional — helps us pre-pick modules.">
          <PillPicker
            options={INDUSTRIES}
            value={industry}
            onChange={setIndustry}
          />
        </FormField>
        <FormField label="Team size" hint="Optional — drives default modules.">
          <PillPicker
            options={TEAM_SIZES}
            value={teamSize}
            onChange={setTeamSize}
          />
        </FormField>
      </div>
      <StepActions
        onBack={onBack}
        onNext={() =>
          canSubmit &&
          onNext({
            company: { name: name.trim(), industry, teamSize },
          })
        }
        nextDisabled={!canSubmit}
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// Step 3 — Profile
// ═════════════════════════════════════════════════════════════════

const ROLE_OPTIONS: PillOption<string>[] = [
  { value: "CEO", label: "CEO" },
  { value: "COO", label: "COO" },
  { value: "CFO", label: "CFO" },
  { value: "Founder", label: "Founder" },
  { value: "Owner", label: "Owner" },
  { value: "Admin", label: "Admin" },
];

function ProfileStep({ data, onBack, onNext }: StepProps) {
  const [displayName, setDisplayName] = useState(data.profile?.displayName ?? "");
  const [roleTitle, setRoleTitle] = useState(data.profile?.roleTitle);

  const canSubmit = displayName.trim().length >= 2 && !!roleTitle;

  return (
    <>
      <StepHeader
        eyebrow="Step 3"
        title="Set up your profile."
        subtitle="How you show up to your team."
      />
      <div className="space-y-5">
        <FormField label="Display name" required>
          <TextInput
            value={displayName}
            onChange={setDisplayName}
            placeholder="Ali Alibrahimi"
            autoFocus
          />
        </FormField>
        <FormField
          label="Your role"
          required
          hint="Drives what you can see and do across the app."
        >
          <PillPicker
            options={ROLE_OPTIONS}
            value={roleTitle}
            onChange={setRoleTitle}
          />
        </FormField>
      </div>
      <StepActions
        onBack={onBack}
        onNext={() =>
          canSubmit &&
          onNext({
            profile: {
              displayName: displayName.trim(),
              roleTitle: roleTitle!,
            },
          })
        }
        nextDisabled={!canSubmit}
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// Step 4 — Modules
// ═════════════════════════════════════════════════════════════════

function ModulesStep({ data, onBack, onNext }: StepProps) {
  // Initial pick: smart defaults if no prior choice, else
  // restore from saved state.
  const initialPicked = useMemo<Set<string>>(() => {
    if (data.modules && data.modules.length > 0) {
      return new Set(data.modules);
    }
    return defaultModulesFor({
      industry: data.company?.industry,
      teamSize: data.company?.teamSize,
    });
  }, [data]);
  const [picked, setPicked] = useState<Set<string>>(initialPicked);

  const toggle = (id: string) => {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      <StepHeader
        eyebrow="Step 4"
        title="Pick the modules you want."
        subtitle="Pre-selected based on your team size + industry. Toggle whatever you need. You can always change this later in Settings."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {MODULES.map((m) => (
          <ModuleCard
            key={m.id}
            icon={m.icon}
            name={m.name}
            description={m.description}
            active={picked.has(m.id)}
            locked={!!m.alwaysOn}
            onToggle={() => !m.alwaysOn && toggle(m.id)}
          />
        ))}
      </div>
      <StepActions
        onBack={onBack}
        onNext={() => onNext({ modules: Array.from(picked) })}
      />
    </>
  );
}

function ModuleCard({
  icon: Icon,
  name,
  description,
  active,
  locked,
  onToggle,
}: {
  icon: LucideIcon;
  name: string;
  description: string;
  active: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={locked}
      className={`text-left rounded-xl border p-3 transition-colors ${
        active
          ? "border-primary/50 bg-primary/[0.05]"
          : "border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05]"
      } ${locked ? "cursor-default" : ""}`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
            active
              ? "bg-primary/15 text-primary"
              : "bg-foreground/[0.05] text-foreground/70"
          }`}
        >
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[12.5px] font-bold text-foreground/90">
              {name}
            </span>
            {locked && (
              <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary px-1 py-px rounded bg-foreground/[0.06]">
                Required
              </span>
            )}
            {active && !locked && (
              <Check
                className="h-3 w-3 text-primary ml-auto"
                strokeWidth={2.8}
              />
            )}
          </div>
          <p className="text-[10.5px] text-text-tertiary mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </button>
  );
}

// ═════════════════════════════════════════════════════════════════
// Step 5 — Connectors (lightweight)
// ═════════════════════════════════════════════════════════════════

function ConnectorsStep({ onBack, onNext }: StepProps) {
  return (
    <>
      <StepHeader
        eyebrow="Step 5"
        title="Connect your tools (optional)."
        subtitle="Pull data from Stripe, GitHub, Notion, and 12 others into the dashboard. You can wire these up now or skip and add them later from Settings → Connectors."
      />
      <div className="rounded-2xl border-xs border-border-soft bg-foreground/[0.03] p-5 text-center">
        <div className="w-10 h-10 rounded-xl bg-primary/12 border border-primary/30 flex items-center justify-center mx-auto mb-3">
          <Plug className="h-5 w-5 text-primary" strokeWidth={2.2} />
        </div>
        <p className="text-[13px] text-foreground/85 mb-1">
          Connectors live in Settings.
        </p>
        <p className="text-[11.5px] text-text-tertiary leading-relaxed max-w-xs mx-auto">
          We kept this step optional so you can land in the dashboard fast.
          Once you're in, head to Settings → Connectors to wire up Stripe,
          GitHub, Notion, and more.
        </p>
      </div>
      <StepActions
        onBack={onBack}
        onNext={() => onNext({ connectorsHandled: true })}
        onSkip={() => onNext({ connectorsHandled: false })}
        nextLabel="Got it"
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// Step 6 — Invite team
// ═════════════════════════════════════════════════════════════════

function InviteStep({ data, onBack, onNext }: StepProps) {
  const [input, setInput] = useState("");
  const [emails, setEmails] = useState<string[]>(data.invitedEmails ?? []);
  const [linkCopied, setLinkCopied] = useState(false);

  // Placeholder for the share link — the real one is generated
  // by the invite system once company id is known. For now we
  // show a representative format.
  const inviteLink = "https://takeover.app/join/your-company";

  const addEmail = () => {
    const list = input
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
    if (list.length === 0) return;
    setEmails((cur) => Array.from(new Set([...cur, ...list])));
    setInput("");
  };

  const removeEmail = (e: string) =>
    setEmails((cur) => cur.filter((x) => x !== e));

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore — clipboard blocked
    }
  };

  return (
    <>
      <StepHeader
        eyebrow="Step 6"
        title="Bring in your team."
        subtitle="Paste their emails to send invites, or copy a link and share it however you want."
      />

      {/* Email invite block */}
      <FormField label="Email invites">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <TextInput
              value={input}
              onChange={setInput}
              placeholder="alex@acme.com, sam@acme.com"
              type="email"
            />
          </div>
          <button
            type="button"
            onClick={addEmail}
            disabled={!input.trim()}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[11.5px] font-semibold bg-foreground/[0.05] text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.08] transition-colors disabled:opacity-40"
          >
            <Plus size={11} />
            Add
          </button>
        </div>
      </FormField>

      {emails.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {emails.map((e) => (
            <span
              key={e}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1 h-6 rounded-full bg-foreground/[0.06] border border-border-soft text-[11px] text-foreground"
            >
              <Mail size={10} className="text-text-tertiary" />
              {e}
              <button
                type="button"
                onClick={() => removeEmail(e)}
                className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-foreground/10 text-text-tertiary"
                aria-label={`Remove ${e}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* OR divider */}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-border-soft" />
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
          or
        </span>
        <div className="flex-1 h-px bg-border-soft" />
      </div>

      {/* Share link block */}
      <FormField
        label="Share link"
        hint="Anyone with the link can request to join — admin approves."
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 h-9 flex items-center bg-foreground/[0.03] border border-border-soft rounded-lg text-[12px] text-foreground/80 font-mono truncate">
            <Link2
              size={11}
              className="text-text-tertiary mr-2 shrink-0"
            />
            {inviteLink}
          </div>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[11.5px] font-semibold bg-foreground/[0.05] text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.08] transition-colors"
          >
            {linkCopied ? (
              <>
                <Check size={11} className="text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy size={11} />
                Copy
              </>
            )}
          </button>
        </div>
      </FormField>

      <StepActions
        onBack={onBack}
        onNext={() => onNext({ invitedEmails: emails })}
        onSkip={() => onNext({ invitedEmails: [] })}
        nextLabel={emails.length > 0 ? `Send ${emails.length} invite${emails.length === 1 ? "" : "s"}` : "Continue"}
      />
    </>
  );
}

// ═════════════════════════════════════════════════════════════════
// Step 7 — Done
// ═════════════════════════════════════════════════════════════════

function DoneStep({
  data,
  onBack,
  onCommit,
  committing,
}: {
  data: FounderData;
  onBack: () => void;
  onCommit: () => void;
  committing: boolean;
}) {
  return (
    <>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-success/12 border border-success/30 flex items-center justify-center mx-auto mb-4">
          <PartyPopper className="h-7 w-7 text-success" strokeWidth={2.2} />
        </div>
        <h1
          className="font-bold text-foreground leading-tight tracking-[-0.02em] mb-2"
          style={{
            fontFamily: "var(--ed-font-display, Inter), system-ui, sans-serif",
            fontSize: "clamp(24px, 2vw, 30px)",
          }}
        >
          You're in<span className="text-primary">.</span>
        </h1>
        <p className="text-[13px] text-text-tertiary max-w-md mx-auto leading-relaxed">
          {data.company?.name ? (
            <>
              <span className="font-semibold text-foreground">{data.company.name}</span> is set up with{" "}
              <span className="font-semibold text-foreground">{data.modules?.length ?? 0} modules</span>
              {data.invitedEmails && data.invitedEmails.length > 0 ? (
                <>
                  {" "}and{" "}
                  <span className="font-semibold text-foreground">{data.invitedEmails.length} invites pending</span>
                </>
              ) : null}
              .
            </>
          ) : (
            "Your workspace is ready."
          )}
        </p>
      </div>

      {/* Summary chips */}
      <div className="rounded-2xl border-xs border-border-soft bg-foreground/[0.02] p-4 space-y-2.5">
        <SummaryRow label="You" value={data.profile?.displayName ?? "—"} sub={data.profile?.roleTitle} />
        <SummaryRow label="Company" value={data.company?.name ?? "—"} sub={data.company?.industry} />
        <SummaryRow
          label="Modules"
          value={`${data.modules?.length ?? 0} enabled`}
          sub={data.modules?.slice(0, 3).join(" · ")}
        />
      </div>

      <StepActions
        onBack={onBack}
        onNext={onCommit}
        nextLabel="Take me to the dashboard"
        loading={committing}
      />
    </>
  );
}

function SummaryRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary shrink-0">
        {label}
      </span>
      <div className="text-right min-w-0">
        <p className="text-[12.5px] font-semibold text-foreground truncate">
          {value}
        </p>
        {sub && (
          <p className="text-[10.5px] text-text-tertiary truncate capitalize">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
