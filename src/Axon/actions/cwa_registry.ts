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

import type { AxonAction } from "../types";
import { registerAction } from "./registry";
import { pushUndo } from "../engine/undoStack";
import { companySupabase } from "@/routes/index.lazy";

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
  let q = companySupabase
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
    const { data, error } = await companySupabase
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
  {
    query: string;
    kind?: RegistryKind;
    company?: RegistryCompany;
    limit?: number;
    offset?: number;
  },
  {
    hits: Array<{
      name: string;
      kind: string;
      company: string;
      version: string | null;
      description: string | null;
    }>;
    nextOffset: number | null;
  }
> = {
  name: "search_registry",
  description:
    "Search the component/template registry by text. Matches names and descriptions. Optional kind and company filters. Supports limit + offset for pagination ('next 15', 'show me more'). Use when the operator asks 'search for X in the registry' / 'find components matching X' / 'what do we have related to X'.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Text to search for in names and descriptions." },
      kind: { type: "string", enum: ["component", "template"], description: "Optional — limit to components or templates." },
      company: { type: "string", enum: ["cwa", "simplicity", "shared"], description: "Optional — scope by company." },
      limit: { type: "number", description: "Max hits. Defaults to 15. Capped at 100." },
      offset: { type: "number", description: "Zero-based offset for pagination. Use `nextOffset` from the previous response." },
    },
    required: ["query"],
  },
  handler: async ({ query, kind, company, limit: inLimit, offset: inOffset }) => {
    const q = (query || "").trim();
    if (q.length < 2) return { summary: "Search query must be at least 2 characters." };
    const limit = Math.max(1, Math.min(inLimit ?? 15, 100));
    const offset = Math.max(0, inOffset ?? 0);
    let sb = companySupabase
      .from("registry_items_with_latest")
      .select("name, kind, company, latest_version_str, description")
      .order("install_count", { ascending: false })
      .range(offset, offset + limit - 1);
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
    // If we got a full page back, more matches probably exist.
    const nextOffset = hits.length >= limit ? offset + limit : null;
    return {
      summary: `Found ${hits.length} match${hits.length === 1 ? "" : "es"} for "${q}"${offset > 0 ? ` (from offset ${offset})` : ""}${hits.length > 3 ? ` — top: ${top3}.` : `: ${top3}.`}`,
      data: { hits, nextOffset },
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
    const { data } = await companySupabase
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
    const { data: snapshot } = await companySupabase
.from("registry_items")
      .select("*")
      .eq("id", item.id)
      .maybeSingle();

    // Grab storage paths to purge.
    const { data: versions } = await companySupabase
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
      try { await companySupabase.storage.from("registry").remove(paths); } catch { /* noop */ }
    }

    const { error } = await companySupabase.from("registry_items").delete().eq("id", item.id);
    if (error) return { summary: `Delete failed: ${error.message}` };

    if (snapshot) {
      pushUndo({
        actionName: "delete_registry_item",
        label: `restore ${item.kind} ${item.name} (metadata only — tarballs gone)`,
        undo: async () => {
          const restorePayload = { ...snapshot };
          delete (restorePayload as any).id;  // let DB assign new id
          const { error } = await companySupabase.from("registry_items").insert(restorePayload);
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

    const { data: verRow } = await companySupabase
.from("registry_versions")
      .select("id, yanked")
      .eq("item_id", item.id)
      .eq("version", version)
      .maybeSingle();
    if (!verRow) return { summary: `${item.name} has no version ${version}.` };
    if (verRow.yanked) return { summary: `${item.name} v${version} is already yanked.` };

    // Executor handles the confirm prompt based on requiresConfirmation.
    const { error } = await companySupabase
.from("registry_versions")
      .update({ yanked: true })
      .eq("id", verRow.id);
    if (error) return { summary: `Yank failed: ${error.message}` };

    pushUndo({
      actionName: "yank_registry_version",
      label: `un-yank ${item.name} v${version}`,
      undo: async () => {
        const { error } = await companySupabase
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

// ── Recent activity ─────────────────────────────────────────────────

/** Recently-published items across the whole registry, newest first.
 *  Good for "what did the team ship this week?" questions. */
export const registryRecentActivityAction: AxonAction<
  { since?: string; limit?: number; company?: RegistryCompany },
  { recent: Array<{ name: string; kind: string; version: string | null; publishedAt: string; publishedBy: string }> }
> = {
  name: "list_recent_registry_activity",
  description:
    "List recently-published registry items (components + templates), newest first. Supports an optional 'since' relative period (e.g., 'week', 'day', 'month') and a company filter. Use when the operator asks 'what's new', 'what was published recently', 'what did we ship this week'.",
  input_schema: {
    type: "object",
    properties: {
      since: {
        type: "string",
        description: "Optional time window — 'hour', 'day', 'week', 'month'. Defaults to 'week'.",
      },
      limit: {
        type: "number",
        description: "Optional max results (default 10, max 50).",
      },
      company: { type: "string", enum: ["cwa", "simplicity", "shared"] },
    },
  },
  handler: async ({ since, limit, company }) => {
    const windowMs = (() => {
      switch ((since || "week").toLowerCase()) {
        case "hour":  return 3600 * 1000;
        case "day":   return 24 * 3600 * 1000;
        case "week":  return 7 * 24 * 3600 * 1000;
        case "month": return 30 * 24 * 3600 * 1000;
        default:      return 7 * 24 * 3600 * 1000;
      }
    })();
    const cutoff = new Date(Date.now() - windowMs).toISOString();
    const cap = Math.max(1, Math.min(50, Number(limit) || 10));

    // Query registry_versions joined back to items — gives us one row
    // per publish event rather than one row per item.
    let q = companySupabase
      .from("registry_versions")
      .select("version, published_at, published_by, registry_items!inner(name, kind, company)")
      .gte("published_at", cutoff)
      .order("published_at", { ascending: false })
      .limit(cap);

    const { data, error } = await q;
    if (error || !data) return { summary: `Couldn't read recent activity: ${error?.message ?? "unknown"}` };

    // Client-side company filter — applied after the join because
    // nested filtering in PostgREST joins is finicky.
    const rows = (data as any[])
      .filter((r) => !company || r.registry_items?.company === company)
      .map((r) => ({
        name: r.registry_items?.name ?? "(unknown)",
        kind: r.registry_items?.kind ?? "(unknown)",
        version: r.version,
        publishedAt: r.published_at,
        publishedBy: r.published_by,
      }));

    if (rows.length === 0) {
      return { summary: `Nothing new in the last ${since ?? "week"}${company ? ` (${company})` : ""}.` };
    }

    const top = rows.slice(0, 3).map((r) => `${r.name} v${r.version}`).join(", ");
    return {
      summary:
        `${rows.length} publish${rows.length === 1 ? "" : "es"} in the last ${since ?? "week"}` +
        (company ? ` for ${company}` : "") + `. Top 3: ${top}.`,
      data: { recent: rows },
    };
  },
};

// ── Metadata update (with undo) ────────────────────────────────────

/** Update the description (and optionally tags) of a registry item. */
export const registryUpdateDescriptionAction: AxonAction<
  { name: string; kind?: RegistryKind; description?: string; tags?: string[] },
  { updated: boolean; name: string }
> = {
  name: "update_registry_description",
  description:
    "Update the human description and/or tags of a registry item. Reversible via 'undo that'. Use when the operator says 'change the description of X to Y' or 'tag X with navigation'.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      kind: { type: "string", enum: ["component", "template"] },
      description: { type: "string", description: "New description. Omit to leave unchanged." },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "New tags list (replaces existing). Omit to leave unchanged.",
      },
    },
    required: ["name"],
  },
  mutating: true,
  handler: async ({ name, kind, description, tags }) => {
    const item = await findItem(name, kind);
    if (!item) return { summary: `No registry item matching "${name}".` };

    // Snapshot previous values for the undo.
    const { data: prev } = await companySupabase
.from("registry_items")
      .select("description, tags")
      .eq("id", item.id)
      .maybeSingle();

    const patch: Record<string, unknown> = {};
    if (description !== undefined) patch.description = description;
    if (tags !== undefined)        patch.tags = tags;
    if (Object.keys(patch).length === 0) {
      return { summary: "Nothing to update — pass description or tags." };
    }

    const { error } = await companySupabase
.from("registry_items")
      .update(patch)
      .eq("id", item.id);
    if (error) return { summary: `Update failed: ${error.message}` };

    pushUndo({
      actionName: "update_registry_description",
      label: `revert description/tags on ${item.name}`,
      undo: async () => {
        if (!prev) return `Can't revert — no snapshot.`;
        const revertPatch: Record<string, unknown> = {};
        if (description !== undefined) revertPatch.description = prev.description;
        if (tags !== undefined)        revertPatch.tags = prev.tags;
        const { error } = await companySupabase
    .from("registry_items")
          .update(revertPatch)
          .eq("id", item.id);
        return error ? `Revert failed: ${error.message}` : `Reverted ${item.name}.`;
      },
    });

    const changed = Object.keys(patch).join(" + ");
    return {
      summary: `Updated ${item.name} (${changed}). Say 'undo that' to revert.`,
      data: { updated: true, name: item.name },
    };
  },
};

// ── Shell execution — actually run `cwa` in a terminal ─────────────
/**
 * Executes `cwa <subcommand>` via the Tauri shell plugin. Captures
 * stdout/stderr and returns the first few lines in the summary so
 * Axon can read them aloud.
 *
 * Requires tauri-plugin-shell to be installed + a capability allowing
 * the `cwa` binary to run. See registerCwaRegistryActions below for
 * setup steps.
 *
 * Working-directory policy:
 *   · If `cwd` is provided, run there.
 *   · Otherwise run in the user's HOME (cross-platform via Tauri path).
 *   · Commands that require a project folder (like `cwa add`) will
 *     fail if you don't pass `cwd` — that's fine; Axon will surface
 *     the error and ask the operator for a path.
 */
export const registryRunCwaAction: AxonAction<
  { subcommand: string; cwd?: string },
  { exitCode: number; stdout: string; stderr: string }
> = {
  name: "run_cwa_command",
  description:
    "Execute a cwa CLI subcommand directly in a terminal process and read back the result. The operator can say things like 'install DataTable in my MyApp folder' (subcommand='add DataTable', cwd='C:/Dev/MyApp') or 'cwa ls' (just subcommand='ls', no cwd needed). DO NOT include the literal word 'cwa' in subcommand — just the args after it.",
  input_schema: {
    type: "object",
    properties: {
      subcommand: {
        type: "string",
        description: "The cwa subcommand + args, e.g. 'add cwa-sidebar' or 'publish my-template --bump=minor'. Exclude the leading 'cwa'.",
      },
      cwd: {
        type: "string",
        description: "Optional absolute folder path to run the command in. Required for `add` / `publish` / `store` / `update` since those operate on a project folder.",
      },
    },
    required: ["subcommand"],
  },
  mutating: true,
  // requiresConfirmation is false — reads like `cwa ls` shouldn't
  // prompt. The action itself includes a safety guard that force-
  // prompts for any command containing `delete` / `remove` / `publish`.
  handler: async ({ subcommand, cwd }, ctx) => {
    const cmd = (subcommand || "").trim();
    if (!cmd) return { summary: "No subcommand given." };

    // Extra safety: if the command could be destructive, prompt even
    // when the subcommand-level requiresConfirmation is off.
    const destructive = /^(delete|remove|publish|store)\b/i.test(cmd);
    if (destructive) {
      const ok = await ctx.requestConfirmation(`Run: cwa ${cmd}${cwd ? ` (in ${cwd})` : ""}?`);
      if (!ok) return { summary: "Cancelled." };
    }

    // Dynamically import the shell plugin so the build doesn't fail
    // if it isn't installed. If the import fails, fall back to
    // clipboard copy.
    let Command: any;
    try {
      const shell = await import("@tauri-apps/plugin-shell");
      Command = (shell as any).Command;
    } catch {
      const fullCmd = `cwa ${cmd}`;
      try { await navigator.clipboard.writeText(fullCmd); } catch { /* noop */ }
      return {
        summary:
          `Tauri shell plugin isn't installed. Copied 'cwa ${cmd}' to clipboard — paste it into a terminal manually. ` +
          `(Add tauri-plugin-shell to Cargo.toml + lib.rs + capabilities/default.json to enable direct execution.)`,
      };
    }

    try {
      // Parse args respecting double-quoted strings.
      const args = splitArgs(cmd);
      const command = Command.create("cwa", args, cwd ? { cwd } : {});
      const out: string[] = [];
      const errOut: string[] = [];
      command.stdout.on("data", (line: string) => out.push(line));
      command.stderr.on("data", (line: string) => errOut.push(line));

      const child = await command.execute();
      const exitCode = child.code ?? 0;
      const stdout = (child.stdout ?? out.join("\n")).trim();
      const stderr = (child.stderr ?? errOut.join("\n")).trim();

      // Summarize the first ~3 lines of stdout for Axon to speak.
      const brief = stdout.split("\n").slice(0, 3).join(" ").slice(0, 240);

      return {
        summary:
          exitCode === 0
            ? `Ran cwa ${cmd}${brief ? `. ${brief}` : "."}`
            : `cwa ${cmd} exited ${exitCode}${stderr ? `: ${stderr.slice(0, 200)}` : ""}`,
        data: { exitCode, stdout, stderr },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Most common cause: capability not allowed.
      if (/not allowed|not authorized|capability/i.test(msg)) {
        return {
          summary:
            `Shell execution blocked by Tauri capabilities. Add 'shell:allow-execute' with 'cwa' to src-tauri/capabilities/default.json and rebuild.`,
        };
      }
      return { summary: `cwa ${cmd} failed to launch: ${msg}` };
    }
  },
};

function splitArgs(s: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return out;
}

// ── Bundle registration ─────────────────────────────────────────────

export function registerCwaRegistryActions(): void {
  registerAction(registryStatsAction);
  registerAction(registrySearchAction);
  registerAction(registryInfoAction);
  registerAction(registryDeleteAction);
  registerAction(registryYankVersionAction);
  registerAction(registryCopyInstallAction);
  registerAction(registryRecentActivityAction);
  registerAction(registryUpdateDescriptionAction);
  registerAction(registryRunCwaAction);
}
