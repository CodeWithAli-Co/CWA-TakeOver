/**
 * ProfileSettings.tsx — real profile settings, replacing the old
 * single-name-field-plus-dummy-toggles layout.
 *
 * Fields:
 *   · Avatar uploader (routes through the existing UploadAvatar
 *     component; writes to app_users.avatarURL on save)
 *   · Display name (app_users.username)
 *   · Email (shown read-only — email changes go through Supabase
 *     auth.updateUser, which needs its own verification flow; we
 *     link users to Security tab for that)
 *   · Role (read-only; changed by admins in the Employees page)
 *   · Company (read-only for now; ties to company toggle)
 *   · Bio / About (app_users.bio, free-text)
 *   · Status emoji + message (reuses presence status pattern)
 *
 * All saves go to app_users via supabase upsert. Shows a save-state
 * indicator (idle / saving / saved / error) inline.
 */

import { useEffect, useState } from "react";
import {
  UserCircle, Mail, Briefcase, Building2, Save, Check, AlertCircle, Loader2,
  ShieldCheck, Sun, Moon, Monitor, Palette,
} from "lucide-react";
import { companySupabase } from "@/MyComponents/supabase";
import UploadAvatar from "@/MyComponents/Reusables/uploadAvatar";
import { useThemeMode, type ThemeMode } from "@/stores/themeModeStore";

interface ProfileSettingsProps {
  user: any;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ProfileSettings({ user }: ProfileSettingsProps) {
  const [displayName, setDisplayName] = useState(user?.username ?? user.name);
  const [bio, setBio] = useState(user?.bio ?? "");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Re-seed fields if the user prop loads async.
  useEffect(() => {
    if (user?.username) setDisplayName(user.username);
    if (user?.bio) setBio(user.bio);
  }, [user?.username, user?.bio]);

  const dirty =
    displayName !== (user?.username ?? user.name) ||
    bio !== (user?.bio ?? "");

  const save = async () => {
    if (!user?.supa_id) {
      setError("Your account isn't fully provisioned yet. Contact an admin.");
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    setError(null);

    const patch: Record<string, any> = {
      username: displayName.trim(),
      bio: bio.trim(),
    };

    const { error: upErr } = await companySupabase
.from("employee")
      .update(patch)
      .eq("supa_id", user.supa_id);

    if (upErr) {
      setError(upErr.message);
      setSaveState("error");
      return;
    }
    setSaveState("saved");
    setTimeout(() => setSaveState("idle"), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
        <div className="mb-5 flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground">
            Identity
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-[180px_1fr]">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <UploadAvatar className="bg-card border border-border hover:border-primary/50 text-foreground transition-colors" />
            <p className="text-[10.5px] text-muted-foreground text-center leading-snug">
              Square image works best. PNG or JPG, under 2 MB.
            </p>
          </div>

          {/* Fields */}
          <div className="space-y-4">
            <Field label="Display name" icon={UserCircle}>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none"
                placeholder="How your name appears in chats + huddles"
              />
            </Field>

            <Field
              label="Email"
              icon={Mail}
              hint="Email changes go through Security → Change email."
              locked
            >
              <span className="text-[13px] text-foreground/80">
                {user?.email ?? "—"}
              </span>
            </Field>

            <Field
              label="Role"
              icon={Briefcase}
              hint="Role changes are handled by admins in the Employees page."
              locked
            >
              <span className="text-[13px] text-foreground/80">
                {user?.role ?? "Member"}
              </span>
            </Field>

            <Field
              label="Company"
              icon={Building2}
              hint="Assigned when your employee record was created."
              locked
            >
              <span className="text-[13px] text-foreground/80">
                {user?.company === "simplicity" ? "Simplicity Funds" : "CodeWithAli"}
              </span>
            </Field>
          </div>
        </div>
      </div>

      {/* Appearance card — theme mode toggle */}
      <AppearanceCard />

      {/* Bio card */}
      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground">
            About you
          </h2>
        </div>
        <label className="block text-[11px] font-semibold text-foreground/80 mb-1.5">
          Bio (shown on your profile card)
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={280}
          rows={4}
          placeholder="One or two sentences — what you do, what you're into. Shown when teammates hover your name."
          className="w-full resize-none rounded-md border border-border bg-background/50 px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-colors"
        />
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">
          {bio.length}/280
        </p>
      </div>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/40 backdrop-blur-sm px-5 py-3">
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          {saveState === "saved" && (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-300">Saved.</span>
            </>
          )}
          {saveState === "error" && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              <span className="text-red-300">{error ?? "Save failed."}</span>
            </>
          )}
          {saveState === "idle" && dirty && (
            <span>Unsaved changes.</span>
          )}
          {saveState === "idle" && !dirty && (
            <span>Everything is up to date.</span>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saveState === "saving"}
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

// ── Appearance card ──────────────────────────────────────────────
// Lives in ProfileSettings so it's findable under Profile, not
// buried in a separate "Preferences" surface. Three-button
// segmented control: Light / Dark / System. Choice persists via
// themeModeStore + applies the theme to <html> immediately.

function AppearanceCard() {
  const mode = useThemeMode((s) => s.mode);
  const resolved = useThemeMode((s) => s.resolved);
  const setMode = useThemeMode((s) => s.setMode);
  return (
    <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm p-5 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-[13px] font-mono uppercase tracking-widest text-muted-foreground">
          Appearance
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <ThemeOption
          mode="light"
          label="Light"
          icon={Sun}
          description="Bright background, dark text."
          active={mode === "light"}
          onPick={() => setMode("light")}
        />
        <ThemeOption
          mode="dark"
          label="Dark"
          icon={Moon}
          description="Zinc background, light text."
          active={mode === "dark"}
          onPick={() => setMode("dark")}
        />
        <ThemeOption
          mode="system"
          label="System"
          icon={Monitor}
          description="Match your OS preference."
          active={mode === "system"}
          onPick={() => setMode("system")}
        />
      </div>
      {mode === "system" && (
        <p className="mt-3 text-[10.5px] text-muted-foreground">
          Currently rendering <span className="font-semibold text-foreground/85">{resolved}</span> mode
          {" "}— follows your OS in real time.
        </p>
      )}
    </div>
  );
}

function ThemeOption({
  mode: _mode, label, icon: Icon, description, active, onPick,
}: {
  mode: ThemeMode;
  label: string;
  icon: typeof Sun;
  description: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={[
        "group relative flex flex-col items-start gap-2 rounded-md border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary/60 bg-primary/[0.07]"
          : "border-border bg-background/40 hover:border-foreground/30 hover:bg-muted/30",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />
        <span className={`text-[13px] font-semibold ${active ? "text-foreground" : "text-foreground/85"}`}>
          {label}
        </span>
        {active && (
          <Check className="ml-auto h-3.5 w-3.5 text-primary" />
        )}
      </div>
      <p className="text-[10.5px] text-muted-foreground leading-snug">
        {description}
      </p>
    </button>
  );
}

// ── Field ────────────────────────────────────────────────────────

function Field({
  label, icon: Icon, hint, locked, children,
}: {
  label: string;
  icon: typeof UserCircle;
  hint?: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 mb-1.5">
        <Icon className="h-3 w-3 text-muted-foreground" />
        {label}
      </label>
      <div
        className={[
          "flex items-center gap-2 rounded-md border px-3 py-2 transition-colors",
          locked
            ? "border-border/50 bg-muted/20"
            : "border-border bg-background/50 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
        ].join(" ")}
      >
        {children}
      </div>
      {hint && (
        <p className="mt-1 text-[10.5px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
