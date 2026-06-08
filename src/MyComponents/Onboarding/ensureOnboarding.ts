/**
 * ensureOnboarding.ts — idempotent post-sign-in hook that guarantees
 * every user has an active onboarding_instance. Self-heals the gap
 * where HiringActions.spawnOnboarding silently failed because no
 * template matched the hire\'s brand/employment type combo (or
 * because the account was created some other way).
 *
 * Strategy:
 *   1. If user already has an active instance, no-op.
 *   2. Try to match template by app_users.role → brand/type, with
 *      relaxed matching: exact match first, then any template for
 *      the same brand, then any active template anywhere.
 *   3. If `onboarding_templates` is empty, seed a built-in default
 *      template so the very first user provisions something useful
 *      instead of nothing.
 *   4. Insert the instance + copy items.
 *
 * Safe to call on every sign-in. Race-safe-ish: a duplicate call in
 * a race only creates a second instance, which is a tiny
 * inconvenience; if you need strict uniqueness add a partial unique
 * index on (employee_user_id) WHERE status = \'active\'.
 */

import { companySupabase } from "@/routes/index.lazy";

interface AppUserShape {
  supa_id: string;
  username?: string | null;
  email?: string | null;
  role?: string | null;
  company?: string | null;       // "CodeWithAli" | "simplicity" or similar
  employment_type?: string | null; // "w2_employee" | "1099_contractor" | "intern"
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
  }> | null;
}

export interface EnsureResult {
  outcome:
    | "already_active"
    | "provisioned"
    | "no_templates_default_seeded"
    | "skipped_no_user"
    | "error";
  message: string;
  instanceId?: string;
}

/** Built-in fallback template — used when onboarding_templates is empty.
 *  Ships generic "welcome / read handbook / set up profile" tasks so
 *  the very first user has SOMETHING to do instead of nothing. */
const FALLBACK_TEMPLATE = {
  name: "Default Welcome — Auto-seeded",
  brand: null as string | null,
  employment_type: null as string | null,
  item_list: [
    {
      title: "Read the company handbook",
      description: "Find it in the docs section. ~15 minutes.",
      owner: "employee" as const,
      position: 1,
    },
    {
      title: "Complete your profile",
      description: "Add an avatar and a one-line bio in Settings → Profile.",
      owner: "employee" as const,
      position: 2,
    },
    {
      title: "Set up your tooling access",
      description:
        "Make sure you can sign in to email, chat, and any project-specific tools.",
      owner: "employee" as const,
      position: 3,
    },
    {
      title: "Send introductions to the team",
      description: "Drop a hello in the relevant channels — say what you\'ll be working on.",
      owner: "employee" as const,
      position: 4,
    },
    {
      title: "Issue laptop / equipment (if applicable)",
      description: "Confirm hardware delivered + signed for.",
      owner: "employer" as const,
      position: 5,
    },
    {
      title: "Add to payroll / contractor system",
      description: "Gusto / Rippling / direct setup, depending on employment type.",
      owner: "employer" as const,
      position: 6,
    },
    {
      title: "Schedule a 1:1 with the hiring manager",
      description: "Within the first week.",
      owner: "employer" as const,
      position: 7,
    },
  ],
};

/**
 * Make sure the given user has an active onboarding_instance. Safe
 * to call on every sign-in — does nothing when one already exists.
 */
export async function ensureOnboardingFor(
  supaId: string,
): Promise<EnsureResult> {
  if (!supaId) {
    return { outcome: "skipped_no_user", message: "No supaId given." };
  }

  // (1) Already active? Done.
  const existingInst = await companySupabase    .from("onboarding_instances")
    .select("id")
    .eq("employee_user_id", supaId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (existingInst.data) {
    return {
      outcome: "already_active",
      message: "User already has an active onboarding instance.",
      instanceId: (existingInst.data as any).id,
    };
  }

  // (2) Pull the user\'s row so we can match templates by brand/type.
  // Use SELECT * because app_users column names vary across environments
  // (some installs have brand/employment_type columns, some don\'t).
  // Read fields off the resulting record only if they exist.
  const userRes = await companySupabase    .from("employee")
    .select("*")
    .eq("supa_id", supaId)
    .maybeSingle();
  const userRow = (userRes.data as Record<string, unknown> | null) ?? null;
  const user: AppUserShape | null = userRow
    ? {
        supa_id: String(userRow.supa_id ?? supaId),
        username: (userRow.username as string | null | undefined) ?? null,
        email: (userRow.email as string | null | undefined) ?? null,
        role: (userRow.role as string | null | undefined) ?? null,
        // brand may be stored as `company` OR `brand`; check both.
        company:
          (userRow.company as string | null | undefined) ??
          (userRow.brand as string | null | undefined) ??
          null,
        employment_type:
          (userRow.employment_type as string | null | undefined) ?? null,
      }
    : null;

  // (3) Look for a matching template — relaxed waterfall.
  const tplRes = await companySupabase    .from("onboarding_templates")
    .select("id, name, brand, employment_type, item_list");
  const allTemplates = ((tplRes.data ?? []) as TemplateRow[]).filter(
    (t) => Array.isArray(t.item_list) && t.item_list.length > 0,
  );

  let template: TemplateRow | null = null;

  if (user) {
    // exact match
    template = allTemplates.find(
      (t) =>
        eq(t.brand, user.company) &&
        eq(t.employment_type, user.employment_type),
    ) ?? null;

    // brand-only match
    if (!template) {
      template = allTemplates.find((t) => eq(t.brand, user.company)) ?? null;
    }
  }

  // any active template
  if (!template && allTemplates.length > 0) {
    template = allTemplates[0]!;
  }

  // (4) No templates AT ALL — seed the built-in fallback.
  if (!template) {
    const seed = await companySupabase
.from("onboarding_templates")
      .insert({
        name: FALLBACK_TEMPLATE.name,
        brand: FALLBACK_TEMPLATE.brand,
        employment_type: FALLBACK_TEMPLATE.employment_type,
        item_list: FALLBACK_TEMPLATE.item_list,
      })
      .select("id, name, brand, employment_type, item_list")
      .single();
    if (seed.error) {
      return {
        outcome: "error",
        message: `No templates exist and seeding the default failed: ${seed.error.message}`,
      };
    }
    template = seed.data as TemplateRow;
  }

  // (5) Create the instance + copy items.
  const inst = await companySupabase    .from("onboarding_instances")
    .insert({
      offer_letter_id: null,
      employee_user_id: supaId,
      template_id: template.id,
      status: "active",
    })
    .select("id")
    .single();
  if (inst.error) {
    return {
      outcome: "error",
      message: `Could not insert onboarding instance: ${inst.error.message}`,
    };
  }
  const instanceId = (inst.data as any).id as string;

  const items = (template.item_list ?? []).map((it, i) => ({
    instance_id: instanceId,
    title: it.title,
    description: it.description ?? null,
    owner: it.owner,
    position: it.position ?? i + 1,
    status: "pending",
  }));
  if (items.length > 0) {
    const itemsRes = await companySupabase.from("onboarding_items").insert(items);
    if (itemsRes.error) {
      return {
        outcome: "error",
        message: `Instance created but items failed: ${itemsRes.error.message}`,
        instanceId,
      };
    }
  }

  return {
    outcome:
      template.name === FALLBACK_TEMPLATE.name
        ? "no_templates_default_seeded"
        : "provisioned",
    message: `Onboarding provisioned (${items.length} task${items.length === 1 ? "" : "s"} from "${template.name}").`,
    instanceId,
  };
}

function eq(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return a.toString().toLowerCase() === b.toString().toLowerCase();
}
