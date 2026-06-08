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
import { invoke } from "@tauri-apps/api/core";
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
  Loader2,
  AlertTriangle,
  User,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import { companySupabase } from "@/routes/index.lazy";
import {
  useMarkOnboarded,
  useUpdateOnboardingState,
} from "@/stores/onboarding";
import {
  FieldGroup,
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
import { takeOverSupabase } from "../supabase";

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

  // Company id, cached after the first ensureCompanyExists()
  // call. Lives in component state because both InviteStep
  // (creates pending_invites rows tied to a company_id) and the
  // Done commit need to reference the same id.
  const [companyId, setCompanyId] = useState<number | null>(null);

  /**
   * Idempotent — creates the takeover_companies row on first
   * call, returns the cached id on subsequent calls. Returns
   * null in debug mode or when company data isn't filled yet.
   */
  const ensureCompanyExists = async (): Promise<number | null> => {
    if (!supaId) return null;
    if (companyId) return companyId;
    if (!data.company?.name) return null;

    const { data: authData } = await companySupabase.auth.getUser();
    const founderEmail = authData?.user?.email ?? null;

    const { data: row, error } = await takeOverSupabase
.from("takeover_companies")
      .insert({
        company_name: data.company.name,
        founder_name: data.profile?.displayName ?? null,
        founder_email: founderEmail,
        // `components` is a Postgres TEXT[] — array of module ids.
        components: data.modules ?? [],
      })
      .select("id")
      .single();

    if (error) {
      console.error("[onboarding] company insert failed", error);
      return null;
    }
    const id = (row as { id: number } | null)?.id ?? null;
    if (id) setCompanyId(id);
    return id;
  };

  /**
   * Per-email invite token issuer. Called by InviteStep for each
   * pasted address. Ensures the company exists (lazy create on
   * first call), generates a UUID token, inserts a pending_invites
   * row, returns the token + the full join URL the email link
   * points at. Returns null on any failure so the caller can
   * surface the error per-row.
   */
  const createInviteToken = async (
    email: string,
  ): Promise<{ token: string; joinUrl: string } | null> => {
    if (!supaId) return null;
    const cid = await ensureCompanyExists();
    if (!cid) return null;

    // crypto.randomUUID() is 128 bits of entropy — plenty for an
    // invite link. Don't substitute Math.random() here.
    const token = crypto.randomUUID();

    const { error } = await companySupabase.from("pending_invites").insert({
      token,
      email,
      company_id: cid,
      // Default to "Member" since we don't ask per-invitee role
      // in this iteration. Easy to extend to per-row role pills.
      role: "Member",
      inviter_supa_id: supaId,
    });
    if (error) {
      console.error("[onboarding] pending_invites insert failed", error);
      return null;
    }

    // Where the recipient lands. Pulled from VITE_TAKEOVER_SITE_URL
    // so dev / staging / prod all work. Fallback is the prod URL.
    const base =
      (import.meta as any).env?.VITE_TAKEOVER_SITE_URL ??
      "https://takeover.app";
    const joinUrl = `${base.replace(/\/$/, "")}/join?token=${token}`;
    return { token, joinUrl };
  };

  /**
   * Done-step commit. Ensures the company row exists (idempotent
   * — may already have been created by the Invite step), patches
   * app_users with role + username, drops companyId into
   * onboarding_state, and stamps onboarded_at = now().
   */
  const commit = async () => {
    if (!supaId) {
      // Debug mode — skip all writes so previewing doesn't touch
      // real data.
      onComplete();
      return;
    }

    const finalCompanyId = await ensureCompanyExists();

    const onboardingStatePayload = { ...data, companyId: finalCompanyId };
    const { error: userErr } = await companySupabase
.from("employee")
      .update({
        role: data.profile?.roleTitle ?? null,
        username: data.profile?.displayName ?? undefined,
        onboarding_state: onboardingStatePayload,
        onboarded_at: new Date().toISOString(),
      })
      .eq("supa_id", supaId);
    if (userErr) {
      console.error("[onboarding] user update failed", userErr);
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
            createInviteToken={createInviteToken}
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
        eyebrow="Step 1 of 7"
        title="How many companies do you run?"
        subtitle="Just curious — you can add more later from Settings."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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

  // Layout intent:
  //   1. Hero card for "Identity" (company name) — single
  //      required field, gets its own card so it reads as the
  //      headline action.
  //   2. "Details" card groups the two optional pill pickers.
  //      Their grouping makes it obvious they're a pair and
  //      both feed module suggestions.
  return (
    <>
      <StepHeader
        eyebrow="Step 2 of 7"
        title="Tell us about your company."
        subtitle="The basics — name and a couple of details so modules can suggest themselves."
      />
      <div className="space-y-3.5">
        <FieldGroup title="Identity" icon={Building2}>
          <FormField label="Company name" required>
            <TextInput
              value={name}
              onChange={setName}
              placeholder="Acme Corp"
              autoFocus
            />
          </FormField>
        </FieldGroup>

        <FieldGroup title="Details" icon={Sparkles}>
          <FormField
            label="Industry"
            hint="Optional — helps us pre-pick modules."
          >
            <PillPicker
              options={INDUSTRIES}
              value={industry}
              onChange={setIndustry}
            />
          </FormField>
          <FormField
            label="Team size"
            hint="Optional — drives default modules."
          >
            <PillPicker
              options={TEAM_SIZES}
              value={teamSize}
              onChange={setTeamSize}
            />
          </FormField>
        </FieldGroup>
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
        eyebrow="Step 3 of 7"
        title="Set up your profile."
        subtitle="How you show up to your team."
      />
      <div className="space-y-3.5">
        <FieldGroup title="You" icon={User}>
          <FormField label="Display name" required>
            <TextInput
              value={displayName}
              onChange={setDisplayName}
              placeholder="Ali Alibrahimi"
              autoFocus
            />
          </FormField>
        </FieldGroup>

        <FieldGroup title="Role" icon={Briefcase}>
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
        </FieldGroup>
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

function InviteStep({
  data,
  onBack,
  onNext,
  createInviteToken,
}: StepProps & {
  /** Issued by the parent — generates a real pending_invites row
   *  per address and returns the join URL embedded with the
   *  token. Returns null in debug mode or on failure. */
  createInviteToken: (
    email: string,
  ) => Promise<{ token: string; joinUrl: string } | null>;
}) {
  const [input, setInput] = useState("");
  const [emails, setEmails] = useState<string[]>(data.invitedEmails ?? []);
  const [sending, setSending] = useState(false);
  // Per-email result so the UI can show ✓ / × tags after a send.
  const [sendResults, setSendResults] = useState<
    Record<string, "ok" | "error">
  >({});
  const [sendError, setSendError] = useState<string | null>(null);
  // Shareable link is generated on demand (Copy button). Uses a
  // separate generic invite token (recipient unknown) — the join
  // page on takeover-B2B prompts for email at the other end.
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);

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
    // Lazy: only mint a share token the first time the user
    // clicks Copy. Recipient is recorded as "share-link" so we
    // can tell email-driven vs link-driven invites apart later.
    setGeneratingLink(true);
    let link = shareLink;
    if (!link) {
      const minted = await createInviteToken("share-link@takeover.app");
      if (minted) {
        link = minted.joinUrl;
        setShareLink(link);
      }
    }
    setGeneratingLink(false);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore — clipboard blocked
    }
  };

  // Fire one Tauri Resend call per email. Sequential rather
  // than parallel so we don't hit Resend's 2 req/sec free-tier
  // limit. Each email gets its own pending_invites token + URL,
  // so we can revoke / track per recipient later.
  const sendAndContinue = async () => {
    if (emails.length === 0) {
      onNext({ invitedEmails: [] });
      return;
    }
    setSending(true);
    setSendError(null);
    const results: Record<string, "ok" | "error"> = {};
    const founderName = data.profile?.displayName ?? "your teammate";
    const companyName = data.company?.name ?? "the team";
    const subject = `${founderName} invited you to ${companyName} on Takeover`;

    for (const email of emails) {
      try {
        const minted = await createInviteToken(email);
        if (!minted) {
          throw new Error("Failed to mint invite token");
        }
        const html = renderInviteHtml({
          founderName,
          companyName,
          inviteLink: minted.joinUrl,
        });
        await invoke("send_invite", {
          toEmail: email,
          subjectMsg: subject,
          html,
        });
        results[email] = "ok";
      } catch (e: any) {
        console.error("[onboarding] send_invite failed", email, e);
        results[email] = "error";
        setSendError(
          typeof e === "string" ? e : (e?.message ?? "Send failed"),
        );
      }
      setSendResults({ ...results });
    }
    setSending(false);

    const okCount = Object.values(results).filter((r) => r === "ok").length;
    // Only advance if we got at least one through. If everything
    // bounced, leave the user on the step so they can fix and
    // retry — don't auto-skip past a failure.
    if (okCount > 0) {
      onNext({
        invitedEmails: emails.filter((e) => results[e] === "ok"),
      });
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
          {emails.map((e) => {
            const r = sendResults[e];
            const tone =
              r === "ok"
                ? "bg-success/15 border-success/40 text-success"
                : r === "error"
                  ? "bg-destructive/12 border-destructive/40 text-destructive"
                  : "bg-foreground/[0.06] border-border-soft text-foreground";
            return (
              <span
                key={e}
                className={`inline-flex items-center gap-1.5 pl-2.5 pr-1 h-6 rounded-full border text-[11px] ${tone}`}
              >
                {r === "ok" ? (
                  <Check size={10} strokeWidth={2.8} />
                ) : r === "error" ? (
                  <AlertTriangle size={10} strokeWidth={2.8} />
                ) : (
                  <Mail size={10} className="text-text-tertiary" />
                )}
                {e}
                <button
                  type="button"
                  onClick={() => removeEmail(e)}
                  disabled={sending}
                  className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-foreground/10 disabled:opacity-30"
                  aria-label={`Remove ${e}`}
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {sendError && (
        <p className="text-[11px] text-destructive mt-2">
          {sendError} — fix the failing rows or skip for now.
        </p>
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
        hint="Anyone with the link can claim a seat in this company. Token is minted on first copy."
      >
        <div className="flex items-center gap-2">
          <div className="flex-1 px-3 h-9 flex items-center bg-foreground/[0.03] border border-border-soft rounded-lg text-[12px] text-foreground/80 font-mono truncate">
            <Link2
              size={11}
              className="text-text-tertiary mr-2 shrink-0"
            />
            <span className="truncate">
              {shareLink ?? "Click Copy to generate a shareable invite link"}
            </span>
          </div>
          <button
            type="button"
            onClick={copyLink}
            disabled={generatingLink}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[11.5px] font-semibold bg-foreground/[0.05] text-foreground/85 border border-border-soft hover:border-foreground/30 hover:bg-foreground/[0.08] transition-colors disabled:opacity-50"
          >
            {generatingLink ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                Minting…
              </>
            ) : linkCopied ? (
              <>
                <Check size={11} className="text-success" />
                Copied
              </>
            ) : (
              <>
                <Copy size={11} />
                {shareLink ? "Copy again" : "Copy"}
              </>
            )}
          </button>
        </div>
      </FormField>

      <StepActions
        onBack={onBack}
        onNext={sendAndContinue}
        onSkip={() => onNext({ invitedEmails: [] })}
        nextLabel={
          sending
            ? "Sending…"
            : emails.length > 0
              ? `Send ${emails.length} invite${emails.length === 1 ? "" : "s"}`
              : "Continue"
        }
        nextDisabled={sending}
        loading={sending}
      />
    </>
  );
}

/** Render the invite email HTML. Inline styles only — most
 *  email clients strip <style> blocks. Kept narrow + readable.
 *  When the takeover-B2B invite-link backend exists we'll
 *  encode company id + role into the URL; for now the link is
 *  a stub the recipient can click to land on the welcome screen
 *  and sign up. */
function renderInviteHtml(args: {
  founderName: string;
  companyName: string;
  inviteLink: string;
}): string {
  const safeFounder = escapeHtml(args.founderName);
  const safeCompany = escapeHtml(args.companyName);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:32px 32px 24px;">
                <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.22em;color:#888;text-transform:uppercase;font-weight:700;">You're invited</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.2;color:#fff;letter-spacing:-0.02em;">
                  Join ${safeCompany} on Takeover<span style="color:hsl(0,72%,51%);">.</span>
                </h1>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.55;color:#bbb;">
                  ${safeFounder} added you to <strong style="color:#fff;">${safeCompany}</strong>'s workspace. Takeover is the single dashboard where your team runs tasks, projects, schedules, and the SaaS tools you already use.
                </p>
                <a href="${args.inviteLink}" style="display:inline-block;padding:12px 22px;background:hsl(0,72%,51%);color:#fff;text-decoration:none;border-radius:999px;font-size:13px;font-weight:600;letter-spacing:0.01em;">
                  Accept invite
                </a>
                <p style="margin:24px 0 0;font-size:11px;color:#777;line-height:1.5;">
                  If the button doesn't work, paste this URL into your browser:<br/>
                  <span style="color:#999;">${args.inviteLink}</span>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 32px;background:#0e0e0e;border-top:1px solid #2a2a2a;font-size:11px;color:#666;">
                Sent by ${safeFounder} via Takeover · <span style="color:#888;">If you weren't expecting this, you can safely ignore it.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
