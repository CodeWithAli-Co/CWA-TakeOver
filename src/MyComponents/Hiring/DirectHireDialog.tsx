/**
 * DirectHireDialog.tsx
 *
 * Fast-track onboarding for known hires — internal referrals,
 * direct hires the operator already knows, anyone they want to
 * bring in without going through the candidate → offer letter
 * pipeline.
 *
 * What this dialog does:
 *   1. Collects minimal info (full name, email, role, brand).
 *   2. Invites the email via Supabase admin → email auto-sent.
 *   3. Inserts an app_users row with
 *        hire_source = 'direct_referral'
 *        referred_by = current operator's supa_id
 *   4. Spawns an onboarding instance + checklist via the same
 *      ensureOnboardingFor() entry point /auth uses on first
 *      sign-in. No offer_letters row, no candidates row.
 *   5. On success: shows the magic link with a Copy button +
 *      confirms the invite email was sent. Operator can share
 *      via Slack / DM / SMS too.
 *
 * The bottom line: the new employee gets an email and you also
 * get a copy-able link in case the email lands in spam or you'd
 * rather DM them directly.
 *
 * Gated to C-level only at the wiring site — this dialog itself
 * trusts whoever opens it.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcnComponents/dialog";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Label } from "@/components/ui/shadcnComponents/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
import { Button } from "@/components/ui/shadcnComponents/button";
import {
  UserPlus,
  Mail,
  Loader2,
  Check,
  Copy,
  AlertTriangle,
  Sparkles,
  Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { companySupabase } from "@/routes/index.lazy";
import { inviteUserViaTakeover } from "@/MyComponents/OfferLetters/inviteUserViaTakeover";
import { ensureOnboardingFor } from "@/MyComponents/Onboarding/ensureOnboarding";
import { ActiveUser } from "@/stores/query";
import { CEORolesList } from "@/MyComponents/Reusables/roleRanks";

// Slugify a name into a usable username — same rule the
// offer-letter convert path uses so direct hires are
// indistinguishable from application hires in the app_users table.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "user";
}

interface DirectHireDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type Step = "form" | "submitting" | "success";

interface SuccessPayload {
  username: string;
  email: string;
  /** Optional — may be undefined if the takeover server hasn't been
   *  updated to surface action_link. UI falls back gracefully. */
  inviteLink?: string;
  onboardingNote: string;
}

export function DirectHireDialog({
  open,
  onOpenChange,
  onCreated,
}: DirectHireDialogProps) {
  const { data: activeUser } = ActiveUser();
  const referrerSupaId = (activeUser?.[0] as any)?.supa_id ?? null;

  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Member");
  const [brand, setBrand] = useState<"CodeWithAli" | "simplicity">(
    "CodeWithAli",
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessPayload | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset state whenever the dialog closes — operator opens it
  // fresh next time, no leftover form values from the last hire.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Defer reset until after the close animation so the form
      // doesn't flicker visually.
      setTimeout(() => {
        setStep("form");
        setFullName("");
        setEmail("");
        setRole("Member");
        setBrand("CodeWithAli");
        setError(null);
        setSuccess(null);
        setCopied(false);
      }, 200);
    }
    onOpenChange(next);
  };

  // "Hire another" — reset form state but keep dialog open. Useful
  // when the operator is bulk-inviting a few people at once.
  const handleHireAnother = () => {
    setStep("form");
    setFullName("");
    setEmail("");
    setError(null);
    setSuccess(null);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!success?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(success.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API blocked — operator can manually select the
      // text in the readonly input. No harm done.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setError(null);

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName || !trimmedEmail) {
      setError("Name and email are both required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("That doesn't look like a valid email.");
      return;
    }

    setStep("submitting");

    // 1. Send invite via takeover (Supabase admin under the hood).
    //    Supabase auto-sends the set-password email; we also try
    //    to surface the action_link so the operator can share it.
    const invite = await inviteUserViaTakeover({
      email: trimmedEmail,
      candidateName: trimmedName,
    });

    if (!invite.ok && !invite.alreadyRegistered) {
      setError(
        `Invite failed: ${invite.error ?? "unknown error"}. The employee was not created — fix the invite pipeline and retry.`,
      );
      setStep("form");
      return;
    }

    const authUserId = invite.userId ?? null;

    // 2. Pick a unique username (slug on collision: jane-smith,
    //    jane-smith-2, jane-smith-3 …). Same logic as the offer
    //    letter convert flow so the two paths are interchangeable
    //    on the app_users side.
    const baseUsername = slugify(trimmedName);
    let username = baseUsername;
    let suffix = 2;
    while (true) {
      const probe = await companySupabase
  .from("employee")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (!probe.data) break;
      if (suffix > 20) break;
      username = `${baseUsername}-${suffix++}`;
    }

    // 3. Insert the employee row. hire_source + referred_by are the
    //    NEW columns from migrations/direct_hire.sql — this is what
    //    distinguishes a direct hire from an application hire in
    //    every downstream query.
    const avatar = `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(username)}`;
    const company =
      brand === "simplicity" ? "simplicity" : "CodeWithAli";

    // Build the insert payload incrementally so we can progressively
    // strip optional columns on retry. Different installs of
    // app_users have different column sets (some don't have
    // `company`, some don't have the new `hire_source` /
    // `referred_by` yet), so we attempt the full payload first and
    // fall back to a minimal one if the schema cache complains.
    const fullPayload: Record<string, any> = {
      username,
      role,
      company,
      avatar,
      email: trimmedEmail,
      hire_source: "direct_referral",
      ...(authUserId ? { supa_id: authUserId } : {}),
      ...(referrerSupaId ? { referred_by: referrerSupaId } : {}),
    };

    // Attempt 1: full payload.
    let userRes = await companySupabase
.from("employee")
      .insert(fullPayload)
      .select()
      .single();

    // Attempt 2: drop the new direct-hire columns. This covers the
    // case where the migration hasn't been run yet but the install
    // does have a `company` column.
    if (userRes.error) {
      const noNewCols = { ...fullPayload };
      delete noNewCols.hire_source;
      delete noNewCols.referred_by;
      userRes = await companySupabase
  .from("employee")
        .insert(noNewCols)
        .select()
        .single();
    }

    // Attempt 3: also drop `company`. Some installs of app_users
    // simply don't have a company column at all — the existing
    // offer-letter convert flow handles this the same way.
    if (userRes.error) {
      const minimal: Record<string, any> = {
        username,
        role,
        avatar,
        email: trimmedEmail,
        ...(authUserId ? { supa_id: authUserId } : {}),
      };
      userRes = await companySupabase
  .from("employee")
        .insert(minimal)
        .select()
        .single();
    }

    if (userRes.error) {
      setError(
        `Auth invite sent but employee row insert failed: ${userRes.error.message}. Resend the invite later once schema is fixed.`,
      );
      setStep("form");
      return;
    }

    // 4. Spawn the onboarding instance. ensureOnboardingFor handles
    //    template selection, fallback seeding, and writes
    //    offer_letter_id = NULL (which is fine for direct hires).
    let onboardingNote = "Onboarding will provision on first sign-in.";
    if (authUserId) {
      const onb = await ensureOnboardingFor(authUserId);
      onboardingNote = onb.message;
    }

    setSuccess({
      username,
      email: trimmedEmail,
      inviteLink: invite.actionLink,
      onboardingNote,
    });
    setStep("success");
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-7 pt-5 pb-4 border-b border-xs border-border-soft">
          <DialogTitle className="text-[14px] font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Direct Hire
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-tertiary">
            Skip the offer letter — invite someone you already know
            straight into takeover. They'll get a set-password email
            and you'll get a copy-able invite link.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait" initial={false}>
          {step !== "success" ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleSubmit}
            >
              <div className="px-7 pt-4 pb-5 space-y-4">
                {/* Full name */}
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="direct-hire-name"
                    className="text-[12px] font-medium text-foreground"
                  >
                    Full name
                  </Label>
                  <Input
                    id="direct-hire-name"
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="Jane Smith"
                    className="bg-background/40 border-border text-foreground placeholder:text-text-tertiary focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={step === "submitting"}
                  />
                </div>

                {/* Email */}
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="direct-hire-email"
                    className="text-[12px] font-medium text-foreground"
                  >
                    Email
                  </Label>
                  <Input
                    id="direct-hire-email"
                    type="email"
                    autoComplete="off"
                    required
                    placeholder="jane@example.com"
                    className="bg-background/40 border-border text-foreground placeholder:text-text-tertiary focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={step === "submitting"}
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-3">
                  {/* Role */}
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="direct-hire-role"
                      className="text-[12px] font-medium text-foreground"
                    >
                      Role
                    </Label>
                    <Select
                      value={role}
                      onValueChange={setRole}
                      disabled={step === "submitting"}
                    >
                      <SelectTrigger
                        id="direct-hire-role"
                        className="bg-background/40 border-border text-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                      >
                        <SelectValue placeholder="Member" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        {CEORolesList.map((r) => (
                          <SelectItem
                            key={r}
                            value={r}
                            className="text-foreground/80 focus:bg-primary/10 focus:text-primary"
                          >
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Brand / company */}
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="direct-hire-brand"
                      className="text-[12px] font-medium text-foreground"
                    >
                      Company
                    </Label>
                    <Select
                      value={brand}
                      onValueChange={(v) =>
                        setBrand(v as "CodeWithAli" | "simplicity")
                      }
                      disabled={step === "submitting"}
                    >
                      <SelectTrigger
                        id="direct-hire-brand"
                        className="bg-background/40 border-border text-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                      >
                        <SelectValue placeholder="CodeWithAli" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        <SelectItem
                          value="CodeWithAli"
                          className="text-foreground/80 focus:bg-primary/10 focus:text-primary"
                        >
                          CodeWithAli
                        </SelectItem>
                        <SelectItem
                          value="simplicity"
                          className="text-foreground/80 focus:bg-primary/10 focus:text-primary"
                        >
                          Simplicity
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-[11.5px] text-red-300">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <DialogFooter className="px-7 py-4 border-t border-xs border-border-soft bg-popover/30 flex justify-end items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={step === "submitting"}
                  className="text-text-secondary hover:text-foreground hover:bg-foreground/[0.05] h-8 px-3 text-[12px] font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={step === "submitting"}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed h-8 px-3 text-[12px] font-semibold inline-flex items-center gap-1.5"
                >
                  {step === "submitting" ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Inviting…
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-3.5 w-3.5" />
                      Send invite
                    </>
                  )}
                </Button>
              </DialogFooter>
            </motion.form>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <div className="px-7 pt-4 pb-5 space-y-4">
                <div className="flex items-start gap-3 rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-3">
                  <div className="h-7 w-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5 text-emerald-300" />
                  </div>
                  <div className="text-[12px] text-emerald-100/90 leading-relaxed">
                    <div className="font-semibold text-emerald-200">
                      Invite sent to {success?.email}
                    </div>
                    <div className="mt-0.5 text-emerald-100/70 text-[11.5px]">
                      Employee record created as{" "}
                      <span className="font-mono text-emerald-200">
                        @{success?.username}
                      </span>
                      . {success?.onboardingNote}
                    </div>
                  </div>
                </div>

                {/* Magic link — only shown when the takeover server
                    actually returned action_link. Falls back to a
                    note explaining the email is the only delivery
                    when it's missing. */}
                {success?.inviteLink ? (
                  <div className="grid gap-1.5">
                    <Label className="text-[12px] font-medium text-foreground flex items-center gap-1.5">
                      <Link2 className="h-3 w-3 text-primary" />
                      Invite link — share via DM / Slack / SMS too
                    </Label>
                    <div className="flex items-stretch gap-2">
                      <Input
                        readOnly
                        value={success.inviteLink}
                        className="bg-background/60 border-border text-foreground/80 text-[11.5px] font-mono"
                        onFocus={(e) => e.currentTarget.select()}
                      />
                      <Button
                        type="button"
                        onClick={handleCopy}
                        className="bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary h-9 px-3 text-[11.5px] font-semibold inline-flex items-center gap-1.5 shrink-0"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <p className="text-[10.5px] text-text-tertiary leading-relaxed">
                      The link lets them set a password and land in
                      takeover. Anyone with the link can claim the
                      account, so don't post it publicly.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-md bg-muted/40 border border-border px-3 py-2.5 text-[11.5px] text-text-tertiary">
                    <Mail className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Invite link not surfaced by the server. The
                      set-password email is the only delivery method
                      for now — update the takeover{" "}
                      <span className="font-mono">/api/auth/invite-user</span>{" "}
                      route to return{" "}
                      <span className="font-mono">action_link</span> to
                      enable copy-able links here.
                    </span>
                  </div>
                )}
              </div>

              <DialogFooter className="px-7 py-4 border-t border-xs border-border-soft bg-popover/30 flex justify-between items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleHireAnother}
                  className="text-text-secondary hover:text-foreground hover:bg-foreground/[0.05] h-8 px-3 text-[12px] font-medium inline-flex items-center gap-1.5"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Hire another
                </Button>
                <Button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 px-3 text-[12px] font-semibold"
                >
                  Done
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
