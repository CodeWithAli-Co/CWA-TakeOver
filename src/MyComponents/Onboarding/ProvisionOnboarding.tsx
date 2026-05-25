/**
 * ProvisionOnboarding.tsx — admin action to retroactively spawn an
 * onboarding instance for a user who didn't go through the
 * offer-letter "Convert to employee" flow.
 *
 * Why this exists: the only existing path to insert into
 * onboarding_instances is HiringActions.spawnOnboarding, which fires
 * exclusively from offer-letter conversion. Any user who self-signed
 * up, was hired before the onboarding system existed, or whose
 * brand/employmentType template was missing at conversion time, is
 * stranded without an active instance — and the WelcomeModal +
 * OnboardingBanner have nothing to show.
 *
 * This modal lets an admin pick any user + any template and create
 * the instance + items in one shot.
 */

import { useEffect, useState } from "react";
import { Loader2, Sparkles, X } from "lucide-react";
import supabase from "@/MyComponents/supabase";

interface UserRow {
  supa_id: string;
  username: string;
  role: string | null;
  email: string | null;
}

interface TemplateRow {
  id: string;
  name: string;
  brand: string | null;
  employment_type: string | null;
  item_list: Array<{
    title: string;
    description?: string;
    owner: "employer" | "employee";
    position?: number;
  }>;
}

export function ProvisionOnboarding({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Load users without an active onboarding instance + all templates.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // All users
        const usersRes = await supabase
          .from("app_users")
          .select("supa_id, username, role, email")
          .order("username", { ascending: true });
        if (cancelled) return;
        if (usersRes.error) throw usersRes.error;

        // Active instances — to filter out users who already have one
        const instRes = await supabase
          .from("onboarding_instances")
          .select("employee_user_id")
          .eq("status", "active");
        if (cancelled) return;
        const haveInstance = new Set(
          (instRes.data ?? [])
            .map((r: any) => r.employee_user_id)
            .filter(Boolean),
        );

        const eligible = (usersRes.data ?? []).filter(
          (u: any) => u.supa_id && !haveInstance.has(u.supa_id),
        );
        setUsers(eligible as UserRow[]);

        // Templates
        const tplRes = await supabase
          .from("onboarding_templates")
          .select("id, name, brand, employment_type, item_list")
          .order("name", { ascending: true });
        if (cancelled) return;
        if (tplRes.error) throw tplRes.error;
        setTemplates((tplRes.data ?? []) as TemplateRow[]);
      } catch (e) {
        setError((e as Error).message ?? "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProvision = async () => {
    if (!selectedUser || !selectedTemplate) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const tpl = templates.find((t) => t.id === selectedTemplate);
      if (!tpl) throw new Error("Template not found.");

      const inst = await supabase
        .from("onboarding_instances")
        .insert({
          offer_letter_id: null,
          employee_user_id: selectedUser,
          template_id: selectedTemplate,
          status: "active",
        })
        .select("id")
        .single();
      if (inst.error) throw inst.error;

      const items = (tpl.item_list ?? []).map((it, i) => ({
        instance_id: (inst.data as any).id,
        title: it.title,
        description: it.description ?? null,
        owner: it.owner,
        position: it.position ?? i + 1,
        status: "pending",
      }));
      if (items.length > 0) {
        const itemsRes = await supabase
          .from("onboarding_items")
          .insert(items);
        if (itemsRes.error) throw itemsRes.error;
      }

      const userLabel =
        users.find((u) => u.supa_id === selectedUser)?.username ?? selectedUser;
      setSuccess(
        `Created onboarding for ${userLabel}: ${items.length} task${items.length === 1 ? "" : "s"} from "${tpl.name}".`,
      );
      // Drop them from the dropdown so admin can't double-create.
      setUsers((arr) => arr.filter((u) => u.supa_id !== selectedUser));
      setSelectedUser("");
    } catch (e) {
      setError((e as Error).message ?? "Failed to provision");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] rounded-lg border border-border bg-card shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 rounded-sm p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="p-6 pb-4 border-b border-border/60">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary mb-3">
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-[18px] font-semibold tracking-tight">
            Provision onboarding
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Pick a user without an active onboarding and a template to spawn
            from. Creates the instance + copies the template's items.
          </p>
        </div>

        <div className="p-6 pt-5 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading users + templates…
            </div>
          ) : (
            <>
              <Field label="User">
                <select
                  className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-[12px]"
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                >
                  <option value="">— Pick a user —</option>
                  {users.map((u) => (
                    <option key={u.supa_id} value={u.supa_id}>
                      {u.username}
                      {u.role ? ` · ${u.role}` : ""}
                      {u.email ? ` · ${u.email}` : ""}
                    </option>
                  ))}
                </select>
                {users.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Every user already has an active onboarding (or there are no
                    users yet).
                  </p>
                )}
              </Field>

              <Field label="Template">
                <select
                  className="w-full rounded-sm border border-border bg-background px-2.5 py-1.5 text-[12px]"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                >
                  <option value="">— Pick a template —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.brand ? ` · ${t.brand}` : ""}
                      {t.employment_type ? ` · ${t.employment_type}` : ""}
                      {Array.isArray(t.item_list)
                        ? ` (${t.item_list.length} tasks)`
                        : ""}
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No templates exist. Create one first in the Onboarding
                    section before provisioning.
                  </p>
                )}
              </Field>
            </>
          )}

          {error && (
            <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-2 text-[12px] text-primary-foreground">
              {success}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-card/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-border bg-background px-3 py-1.5 text-[11.5px] font-medium hover:bg-muted/60"
          >
            Close
          </button>
          <button
            type="button"
            disabled={busy || !selectedUser || !selectedTemplate}
            onClick={handleProvision}
            className="inline-flex items-center gap-1.5 rounded-sm bg-foreground px-3.5 py-1.5 text-[11.5px] font-semibold text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Creating…" : "Create onboarding"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
