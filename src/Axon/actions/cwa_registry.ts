// ───────────────────────────────────────────────────────────────────
// CWA Registry actions for Axon — voice control over the component /
// template store. The CEO can say things like:
//
//   "Axon, what components do we have?"
//   "Axon, search for anything with 'nav' in the name."
//   "Axon, tell me about cwa-sidebar."
//   "Axon, how many components are in the registry?"
//   "Axon, delete the table component."      (reversible via undo)
//   "Axon, copy the install command for DataTable."
//
// The read-only actions query registry_items_with_latest directly.
// Mutating actions push inverse closures onto the undo stack so
// "Axon, undo that" can put things back.
// ───────────────────────────────────────────────────────────────────

import supabase from "@/MyComponents/supabase";
import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { pushUndo } from "../engine/undoStack";

type RegistryKind = "component" | "template";
type RegistryCompany = "cwa" | "simplicity" | "shared";

// ── Helpers ─────────────────────────────────────────────────────────

/** Turn a raw name string into the registry's kebab-case form.
 *  Accepts "CWA Sidebar" / "cwa sidebar" / "cwa-sidebar" → "cwa-sidebar".
 *  The CLI publish flow already normalizes, but voice input won't,
 *  so we handle the variations here. */
function kebab(s: string): string {
  return s
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
}

/** Fuzzy-look up one item by free-text name. Tries exact kebab
 *  match first, then substring match. Returns the first hit. */
async function findItem(
  nameRaw: string,
  kind?: RegistryKind,
): Promise<{ id: string; name: string; kind: RegistryKind; company: string; latest_version: string | null; description: string | null } | null> {
  const kebabName = kebab(nameRaw);
  let q = supabase
    .from("registry_items")
    .select("id, name, kind, company, latest_version, description")
    .limit(5);
  if (kind) q = q.eq("kind", kind);
  q = q.or(`name.eq.${kebabName},name.ilike.%${kebabName}%`);

  const { data, error } = await q;
  if (error || !data || data.length === 0) return null;

  // Prefer exact kebab match over substring.
  const exact = data.find((r: any) => r.name === kebabName);
  return (exact ?? data[0]) as any;
}

// ── Read-only actions ───────────────────────────────────────────────

/** Count + top-popular + recent-activity summary. Great opener. */
export const registryStatsAction: AxonAction<
  Record<string, never>,
  { components: number; templates: number; topPopular: string[]; recent: string[] }
> = {
  name: "get_registry_stats",
  description:
    "Summarize the state of the CWA component/template registry — total counts, most-installed items, recently-published items. Use when the operator asks general questions like 'how's the registry', 'what's in the registry', 'how many components do we have'.",
  input_schema: {
    type: "object",
    properties: {},
  },
  handler: async () => {
    const { data, error } = await supabase
      .from("registry_items_with_latest")
      .select("name, kind, company, install_count, latest_published_at")
      .limit(200);
    if (error || !data) {
      return { summary: "Couldn't read the registry right now." };
    }
    const components = data.filter((r: any) => r.kind === "component");
    const templates  = data.filter((r: any) => r.kind === "template");

    const topPopular = [...data]
      .sort((a: any, b: any) => (b.install_count ?? 0) - (a.install_count ?? 0))
      .slice(0, 3)
      .map((r: any) => r.name);

    const recent = [...data]
      .filter((r: any) => r.latest_published_at)
      .sort((a: any, b: any) =>
        new Date(b.latest_published_at).getTime() - new Date(a.latest_published_at).getTime()
      )
      .slice(0, 3)
      .map((r: any) => r.name);

    const humanSummary =
      `Registry: ${components.length} component${components.length === 1 ? "" : "s"} and ${templates.length} template${templates.length === 1 ? "" : "s"}. ` +
      (topPopular.length > 0 ? `Most-installed: ${topPopular.join(", ")}. ` : "") +
      (recent.length > 0 ? `Recent: ${recent.join(", ")}.` : "");

    return {
      summary: humanSummary,
      data: { components: components.length, templates: templates.length, topPopular, recent },
    };
  },
};

/** Search by substring across name + description. */
export const registrySearchAction: AxonAction<
  { query: string; kind?: RegistryKind; company?: RegistryCompany },
  { hits: Array<{ name: string; kind: string; company: string; version: string | null; description: string | null }> }
> = {
  name: "search_registry",
  description:
    "Search the component/template registry by text. Matches names and descriptions. Optional kind and company filters. Use when the operator asks 'search for X in the registry' / 'find components matching X' / 'what do we have related to X'.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for in names and descriptions." },
      kind: { type: "string", enum: ["component", "template"], description: "Optional — limit to components or templates." },
      company: { type: "string", enum: ["cwa", "simplicity", "shared"], description: "Optional — scope by company." },
    },
    required: ["query"],
  },
  handler: async ({ query, kind, company }) => {
    const q = (query || "").trim();
    if (q.length < 2) return { summary: "Search query must be at least 2 characters." };
    let sb = supabase
      .from("registry_items_with_latest")
      .select("name, kind, company, latest_version_str, description")
      .order("install_count", { ascending: false })
      .limit(15);
    if (kind)    sb = sb.eq("kind", kind);
    if (company) sb = sb.eq("company", company);
    const safe = q.replace(/[%_]/g, "");
    sb = sb.or(`name.ilike.%${safe}%,description.ilike.%${safe}%`);

    const { data, error } = await sb;
    if (error || !data) return { summary: `Search failed: ${error?.message ?? "unknown"}` };
    if (data.length === 0) return { summary: `No registry items match "${q}".` };

    const hits = data.map((r: any) => ({
      name: r.name,
      kind: r.kind,
      company: r.company,
      version: r.latest_version_str ?? null,
      description: r.description ?? null,
    }));
    const top3 = hits.slice(0, 3).map((h) => h.name).join(", ");
    return {
      summary: `Found ${hits.length} match${hits.length === 1 ? "" : "es"} for "${q}"${hits.length > 3 ? ` — top: ${top3}.` : `: ${top3}.`}`,
      data: { hits },
    };
  },
};

/** Deep info for one item — description, version, installs, created_by. */
export const registryInfoAction: AxonAction<
  { name: string; kind?: RegistryKind },
  { name: string; kind: string; company: string; description: string | null; latestVersion: string | null; installCount: number; createdBy: string }
> = {
  name: "get_registry_item_info",
  description:
    "Get detailed info about one component or template by name. Returns description, latest version, install count, creator. Use when the operator asks 'tell me about X' / 'what's in X' / 'who made X' regarding a registry item.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Component/template name. Accepts loose input — will fuzzy match." },
      kind: { type: "string", enum: ["component", "template"], description: "Optional — narrow the lookup." },
    },
    required: ["name"],
  },
  handler: async ({ name, kind }) => {
    const item = await findItem(name, kind);
    if (!item) return { summary: `No registry item matching "${name}" ${kind ? `(${kind})` : ""}.` };

    // Second query to pull install_count — findItem query was narrow.
    const { data } = await supabase
      .from("registry_items")
      .select("install_count, created_by")
      .eq("id", item.id)
      .maybeSingle();

    const installCount = data?.install_count ?? 0;
    const createdBy = data?.created_by ?? "unknown";

    const v = item.latest_version ? `v${item.latest_version}` : "unpublished";
    const verb = item.description ? ` — ${item.description}` : "";
    return {
      summary: `${item.name} is a ${item.kind} (${item.company}), ${v}${verb}. ${installCount} install${installCount === 1 ? "" : "s"}, created by ${createdBy}.`,
      data: {
        name: item.name,
        kind: item.kind,
        company: item.company,
        description: item.description,
        latestVersion: item.latest_version,
        installCount,
        createdBy,
      },
    };
  },
};

// ── Mutating (with undo) ────────────────────────────────────────────

/** Delete a registry item (and cascade its versions + storage files).
 *  Pushes a re-insert closure onto the undo stack so "undo that"
 *  restores the item row — versions + storage CAN'T be recovered once
 *  the tarballs are gone, so we warn the operator. */
export const registryDeleteAction: AxonAction<
  { name: string; kind?: RegistryKind },
  { deleted: boolean; name: string; kind: string }
> = {
  name: "delete_registry_item",
  description:
    "Delete a component or template from the registry. Removes the item row, cascades all versions, and purges stored tarballs. DESTRUCTIVE — the item row can be restored via 'undo that' but the tarballs CANNOT. Use only when the operator is explicit about deleting.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      kind: { type: "string", enum: ["component", "template"] },
    },
    required: ["name"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ name, kind }) => {
    const item = await findItem(name, kind);
    if (!item) return { summary: `No registry item matching "${name}".` };

    // requiresConfirmation: true on the action makes the executor
    // handle the prompt dance when autoApprove is off. We don't
    // re-prompt inside the handler.

    // Snapshot for undo — just the item row. Version rows are recoverable
    // in theory but their tarballs are gone, so we don't bother restoring
    // them (an undo would re-insert an orphan item with no installable
    // version, and we surface that in the undo label).
    const { data: snapshot } = await supabase
      .from("registry_items")
      .select("*")
      .eq("id", item.id)
      .maybeSingle();

    // Grab storage paths to purge.
    const { data: versions } = await supabase
      .from("registry_versions")
      .select("storage_path")
      .eq("item_id", item.id);
    const paths = (versions ?? []).map((v: any) => v.storage_path);
    paths.push(
      `covers/${item.id}.png`,
      `covers/${item.id}.jpg`,
      `covers/${item.id}.webp`,
    );
    if (paths.length > 0) {
      try { await supabase.storage.from("registry").remove(paths); } catch { /* noop */ }
    }

    const { error } = await supabase.from("registry_items").delete().eq("id", item.id);
    if (error) return { summary: `Delete failed: ${error.message}` };

    if (snapshot) {
      pushUndo({
        actionName: "delete_registry_item",
        label: `restore ${item.kind} ${item.name} (metadata only — tarballs gone)`,
        undo: async () => {
          const restorePayload = { ...snapshot };
          delete (restorePayload as any).id;  // let DB assign new id
          const { error } = await supabase.from("registry_items").insert(restorePayload);
          return error ? `Restore failed: ${error.message}` : `Restored ${item.name} metadata (republish to make it installable).`;
        },
      });
    }

    return {
      summary: `Deleted ${item.kind} ${item.name}.${snapshot ? " Metadata recoverable via 'undo that' — but tarballs are gone for good." : ""}`,
      data: { deleted: true, name: item.name, kind: item.kind },
    };
  },
};

/** Yank a specific version — hides from installs but keeps the row
 *  (and tarball) for audit. Reversible. */
export const registryYankVersionAction: AxonAction<
  { name: string; version: string; kind?: RegistryKind },
  { yanked: boolean; name: string; version: string }
> = {
  name: "yank_registry_version",
  description:
    "Yank a specific published version of a registry item — hides it from installs but keeps it in history. Reversible via undo. Use when a bad version was published and should be pulled.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      version: { type: "string", description: "Semver string like 1.2.3." },
      kind: { type: "string", enum: ["component", "template"] },
    },
    required: ["name", "version"],
  },
  mutating: true,
  requiresConfirmation: true,
  handler: async ({ name, version, kind }) => {
    const item = await findItem(name, kind);
    if (!item) return { summary: `No registry item matching "${name}".` };

    const { data: verRow } = await supabase
      .from("registry_versions")
      .select("id, yanked")
      .eq("item_id", item.id)
      .eq("version", version)
      .maybeSingle();
    if (!verRow) return { summary: `${item.name} has no version ${version}.` };
    if (verRow.yanked) return { summary: `${item.name} v${version} is already yanked.` };

    // Executor handles the confirm prompt based on requiresConfirmation.
    const { error } = await supabase
      .from("registry_versions")
      .update({ yanked: true })
      .eq("id", verRow.id);
    if (error) return { summary: `Yank failed: ${error.message}` };

    pushUndo({
      actionName: "yank_registry_version",
      label: `un-yank ${item.name} v${version}`,
      undo: async () => {
        const { error } = await supabase
          .from("registry_versions")
          .update({ yanked: false })
          .eq("id", verRow.id);
        return error ? `Un-yank failed: ${error.message}` : `Restored ${item.name} v${version}.`;
      },
    });

    return {
      summary: `Yanked ${item.name} v${version}. Say 'undo that' to restore.`,
      data: { yanked: true, name: item.name, version },
    };
  },
};

// ── Clipboard helper ─────────────────────────────────────────────────

/** Copies the CLI install command for an item to the clipboard.
 *  Because the CEO often says "I need X in my other project" — this
 *  beats typing out `cwa add cwa-sidebar`. */
export const registryCopyInstallAction: AxonAction<
  { name: string; kind?: RegistryKind; version?: string },
  { copied: string }
> = {
  name: "copy_install_command",
  description:
    "Copy the appropriate CLI install command for a registry item to the operator's clipboard. For components emits 'cwa add <name>'; for templates emits 'cwa create <name>'. Optionally pin to a specific version. Use when the operator says 'how do I install X' / 'give me the install command for X'.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      kind: { type: "string", enum: ["component", "template"] },
      version: { type: "string", description: "Optional semver to pin." },
    },
    required: ["name"],
  },
  handler: async ({ name, kind, version }) => {
    const item = await findItem(name, kind);
    if (!item) return { summary: `No registry item matching "${name}".` };
    const verb = item.kind === "template" ? "create" : "add";
    const ver = version ? `@${version}` : "";
    const cmd = `cwa ${verb} ${item.name}${ver}`;
    try {
      await navigator.clipboard.writeText(cmd);
      return {
        summary: `Copied: ${cmd}`,
        data: { copied: cmd },
      };
    } catch {
      // Non-secure context, or clipboard perm denied. Still useful as a
      // text summary — the operator can hear it.
      return {
        summary: `Install command: ${cmd} (clipboard access failed — read aloud only).`,
        data: { copied: cmd },
      };
    }
  },
};

// ── Bundle registration ─────────────────────────────────────────────

export function registerCwaRegistryActions(): void {
  registerAction(registryStatsAction);
  registerAction(registrySearchAction);
  registerAction(registryInfoAction);
  registerAction(registryDeleteAction);
  registerAction(registryYankVersionAction);
  registerAction(registryCopyInstallAction);
}
