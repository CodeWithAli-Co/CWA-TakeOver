// ────────────────────────────────────────────────────────────────
// Registry queries — TanStack Query hooks over the registry_*
// tables and storage bucket. Mutations handle upload, delete,
// yank, and version bump.
//
// Storage convention:
//   artifacts/<item_id>/<version>.tgz    — published tarball
//   covers/<item_id>.(png|jpg|webp)      — optional cover image
// ────────────────────────────────────────────────────────────────

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companySupabase } from "@/routes/index.lazy";
import {
  rowToItem,
  rowToItemWithLatest,
  rowToVersion,
  rowToToken,
  bumpVersion,
  type RegistryItem,
  type RegistryItemWithLatest,
  type RegistryVersion,
  type RegistryCompany,
  type RegistryKind,
  type Bump,
  type RegistryToken,
  type RegistryTokenCreateResult,
} from "./types";

const BUCKET = "registry";

// ── Gallery — list all items with latest-version metadata ──────
// Optional filters applied server-side; the `company === "all"`
// case is handled in the UI (CEO / cross-company view).
export interface ListItemsOptions {
  kind?: RegistryKind;
  company?: RegistryCompany | "all";
  search?: string;
}

async function fetchItems(opts: ListItemsOptions = {}): Promise<RegistryItemWithLatest[]> {
  let q = companySupabase
    .from("registry_items_with_latest")
    .select("*")
    .order("install_count", { ascending: false })
    .order("updated_at", { ascending: false });

  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.company && opts.company !== "all") q = q.eq("company", opts.company);
  if (opts.search && opts.search.trim().length > 0) {
    // Case-insensitive LIKE on name OR description.
    const s = opts.search.trim().replace(/[%_]/g, "");
    q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[registry] fetchItems:", error.message);
    return [];
  }
  return (data ?? []).map(rowToItemWithLatest);
}

export function useRegistryItems(opts: ListItemsOptions = {}) {
  return useQuery({
    queryKey: ["registry", "items", opts],
    queryFn: () => fetchItems(opts),
    staleTime: 30_000,
  });
}

// ── Single item detail ─────────────────────────────────────────
async function fetchItem(id: string): Promise<RegistryItem | null> {
  const { data, error } = await companySupabase    .from("registry_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return rowToItem(data);
}

export function useRegistryItem(id: string | null) {
  return useQuery({
    queryKey: ["registry", "item", id],
    queryFn: () => (id ? fetchItem(id) : Promise.resolve(null)),
    enabled: !!id,
  });
}

// ── Version history for an item ────────────────────────────────
async function fetchVersions(itemId: string): Promise<RegistryVersion[]> {
  const { data, error } = await companySupabase    .from("registry_versions")
    .select("*")
    .eq("item_id", itemId)
    .order("published_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map(rowToVersion);
}

export function useRegistryVersions(itemId: string | null) {
  return useQuery({
    queryKey: ["registry", "versions", itemId],
    queryFn: () => (itemId ? fetchVersions(itemId) : Promise.resolve([])),
    enabled: !!itemId,
  });
}

// ── Create item + first version (publish flow) ─────────────────
export interface CreateItemInput {
  name: string;
  kind: RegistryKind;
  company: RegistryCompany;
  description?: string;
  tags?: string[];
  tarball: Blob;         // the .tgz of the artifact
  cover?: Blob;          // optional cover image
  createdBy: string;     // username
  version?: string;      // defaults to 1.0.0
  changelog?: string;
  dependencies?: Record<string, string>;
}

export function useCreateRegistryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateItemInput): Promise<RegistryItem> => {
      const version = input.version ?? "1.0.0";

      // 1. Insert item row (or reuse if name+kind already exists —
      //    that lets the same mutation function handle "create + first
      //    publish" *and* "publish a new version of an existing item").
      const { data: existing } = await companySupabase
  .from("registry_items")
        .select("*")
        .eq("name", input.name)
        .eq("kind", input.kind)
        .maybeSingle();

      let itemRow: any;
      if (existing) {
        itemRow = existing;
      } else {
        const { data, error } = await companySupabase
    .from("registry_items")
          .insert({
            name: input.name,
            kind: input.kind,
            company: input.company,
            description: input.description ?? null,
            tags: input.tags ?? [],
            created_by: input.createdBy,
          })
          .select()
          .single();
        if (error || !data) throw new Error(error?.message ?? "insert failed");
        itemRow = data;
      }

      const itemId: string = itemRow.id;

      // 2. Upload tarball.
      const storagePath = `artifacts/${itemId}/${version}.tgz`;
      const { error: upErr } = await companySupabase.storage
        .from(BUCKET)
        .upload(storagePath, input.tarball, {
          cacheControl: "31536000",
          upsert: true,
          contentType: "application/gzip",
        });
      if (upErr) throw new Error(`tarball upload: ${upErr.message}`);

      // 3. Optional cover — upload + write url to item row.
      if (input.cover) {
        const ext = input.cover.type.includes("png") ? "png" :
                    input.cover.type.includes("webp") ? "webp" : "jpg";
        const coverPath = `covers/${itemId}.${ext}`;
        const { error: coverErr } = await companySupabase.storage
          .from(BUCKET)
          .upload(coverPath, input.cover, {
            cacheControl: "3600",
            upsert: true,
            contentType: input.cover.type || "image/jpeg",
          });
        if (!coverErr) {
          const { data: pub } = companySupabase.storage.from(BUCKET).getPublicUrl(coverPath);
          await companySupabase
      .from("registry_items")
            .update({ cover_url: pub.publicUrl })
            .eq("id", itemId);
        }
      }

      // 4. Insert version row.
      const { error: verErr } = await companySupabase
  .from("registry_versions")
        .insert({
          item_id: itemId,
          version,
          storage_path: storagePath,
          size_bytes: input.tarball.size,
          changelog: input.changelog ?? null,
          dependencies: input.dependencies ?? {},
          published_by: input.createdBy,
        });
      if (verErr) throw new Error(`version insert: ${verErr.message}`);

      // 5. Update latest_version pointer + description/tags if changed.
      await companySupabase
  .from("registry_items")
        .update({
          latest_version: version,
          description: input.description ?? itemRow.description,
          tags: input.tags ?? itemRow.tags,
          company: input.company,
        })
        .eq("id", itemId);

      return rowToItem({ ...itemRow, latest_version: version });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registry", "items"] });
    },
  });
}

// ── Publish a new version of an existing item ──────────────────
export interface PublishVersionInput {
  itemId: string;
  currentLatest: string | null;  // e.g. "1.2.3" — used to compute the bump
  bump?: Bump;                   // defaults to "patch"
  explicitVersion?: string;      // overrides bump if provided
  tarball: Blob;
  changelog?: string;
  dependencies?: Record<string, string>;
  publishedBy: string;
}

export function usePublishVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: PublishVersionInput): Promise<RegistryVersion> => {
      const next =
        input.explicitVersion ??
        (input.currentLatest
          ? bumpVersion(input.currentLatest, input.bump ?? "patch")
          : "1.0.0");

      const storagePath = `artifacts/${input.itemId}/${next}.tgz`;
      const { error: upErr } = await companySupabase.storage
        .from(BUCKET)
        .upload(storagePath, input.tarball, {
          cacheControl: "31536000",
          upsert: true,
          contentType: "application/gzip",
        });
      if (upErr) throw new Error(`tarball upload: ${upErr.message}`);

      const { data: verRow, error: verErr } = await companySupabase
  .from("registry_versions")
        .insert({
          item_id: input.itemId,
          version: next,
          storage_path: storagePath,
          size_bytes: input.tarball.size,
          changelog: input.changelog ?? null,
          dependencies: input.dependencies ?? {},
          published_by: input.publishedBy,
        })
        .select()
        .single();
      if (verErr || !verRow) throw new Error(verErr?.message ?? "version insert failed");

      await companySupabase
  .from("registry_items")
        .update({ latest_version: next })
        .eq("id", input.itemId);

      return rowToVersion(verRow);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["registry", "items"] });
      qc.invalidateQueries({ queryKey: ["registry", "versions", vars.itemId] });
      qc.invalidateQueries({ queryKey: ["registry", "item", vars.itemId] });
    },
  });
}

// ── Yank / un-yank a version ───────────────────────────────────
export function useYankVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ versionId, yanked }: { versionId: string; yanked: boolean }) => {
      const { error } = await companySupabase
  .from("registry_versions")
        .update({ yanked })
        .eq("id", versionId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registry", "versions"] });
      qc.invalidateQueries({ queryKey: ["registry", "items"] });
    },
  });
}

// ── Delete item (cascade kills versions + storage objects) ─────
export function useDeleteRegistryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      // Fetch all storage paths so we can clean the bucket after DB cascade.
      const { data: versions } = await companySupabase
  .from("registry_versions")
        .select("storage_path")
        .eq("item_id", itemId);

      const paths = (versions ?? []).map((v: any) => v.storage_path as string);
      // Cover images — we don't know the extension, try all three.
      paths.push(
        `covers/${itemId}.png`,
        `covers/${itemId}.jpg`,
        `covers/${itemId}.webp`,
      );

      if (paths.length > 0) {
        await companySupabase.storage.from(BUCKET).remove(paths);
      }

      const { error } = await companySupabase
  .from("registry_items")
        .delete()
        .eq("id", itemId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registry", "items"] });
    },
  });
}

// ── Item update (description, tags, company, cover) ────────────
export interface UpdateItemInput {
  id: string;
  description?: string;
  tags?: string[];
  company?: RegistryCompany;
  cover?: Blob;
}

export function useUpdateRegistryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateItemInput) => {
      const patch: Record<string, unknown> = {};
      if (input.description !== undefined) patch.description = input.description;
      if (input.tags !== undefined) patch.tags = input.tags;
      if (input.company !== undefined) patch.company = input.company;

      if (input.cover) {
        const ext = input.cover.type.includes("png") ? "png" :
                    input.cover.type.includes("webp") ? "webp" : "jpg";
        const coverPath = `covers/${input.id}.${ext}`;
        const { error: coverErr } = await companySupabase.storage
          .from(BUCKET)
          .upload(coverPath, input.cover, {
            cacheControl: "3600",
            upsert: true,
            contentType: input.cover.type || "image/jpeg",
          });
        if (!coverErr) {
          const { data: pub } = companySupabase.storage.from(BUCKET).getPublicUrl(coverPath);
          patch.cover_url = pub.publicUrl;
        }
      }

      if (Object.keys(patch).length === 0) return;
      const { error } = await companySupabase
  .from("registry_items")
        .update(patch)
        .eq("id", input.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["registry", "items"] });
      qc.invalidateQueries({ queryKey: ["registry", "item", vars.id] });
    },
  });
}

// ── Tarball download URL (CLI + UI use this) ──────────────────
export function registryTarballUrl(storagePath: string): string {
  const { data } = companySupabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// ── Install log (best-effort, non-blocking) ────────────────────
export async function logInstall(params: {
  itemId: string;
  version: string;
  installedBy: string;
  projectName?: string;
  machineId?: string;
}): Promise<void> {
  await companySupabase.from("registry_installs").insert({
    item_id: params.itemId,
    version: params.version,
    installed_by: params.installedBy,
    project_name: params.projectName ?? null,
    machine_id: params.machineId ?? null,
  });
}

// ── Installs for an item — powers the Installs tab ─────────────
export interface InstallRow {
  id: string;
  version: string;
  installedBy: string;
  projectName: string | null;
  machineId: string | null;
  installedAt: string;
}

async function fetchInstalls(itemId: string): Promise<InstallRow[]> {
  const { data, error } = await companySupabase    .from("registry_installs")
    .select("id, version, installed_by, project_name, machine_id, installed_at")
    .eq("item_id", itemId)
    .order("installed_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return (data ?? []).map((r: any) => ({
    id: r.id,
    version: r.version,
    installedBy: r.installed_by,
    projectName: r.project_name ?? null,
    machineId: r.machine_id ?? null,
    installedAt: r.installed_at,
  }));
}

export function useRegistryInstalls(itemId: string | null) {
  return useQuery({
    queryKey: ["registry", "installs", itemId],
    queryFn: () => (itemId ? fetchInstalls(itemId) : Promise.resolve([] as InstallRow[])),
    enabled: !!itemId,
    staleTime: 30_000,
  });
}

// ── CLI tokens (personal access tokens) ────────────────────────
async function fetchTokens(owner: string): Promise<RegistryToken[]> {
  const { data, error } = await companySupabase    .from("registry_tokens")
    .select("*")
    .eq("owner", owner)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []).map(rowToToken);
}

export function useRegistryTokens(owner: string | null) {
  return useQuery({
    queryKey: ["registry", "tokens", owner],
    queryFn: () => (owner ? fetchTokens(owner) : Promise.resolve([])),
    enabled: !!owner,
  });
}

/** Raw token generator — 48 hex chars prefixed with `cwa_`. Crypto-random. */
function generateRawToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `cwa_${hex}`;
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function useCreateRegistryToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      label: string;
      owner: string;
      expiresAt?: string | null;
    }): Promise<RegistryTokenCreateResult> => {
      const raw = generateRawToken();
      const tokenHash = await sha256Hex(raw);
      const { data, error } = await companySupabase
  .from("registry_tokens")
        .insert({
          token_hash: tokenHash,
          label: input.label,
          owner: input.owner,
          expires_at: input.expiresAt ?? null,
          scope: "full",
        })
        .select()
        .single();
      if (error || !data) throw new Error(error?.message ?? "token create failed");
      return { token: rowToToken(data), rawToken: raw };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registry", "tokens"] });
    },
  });
}

export function useDeleteRegistryToken() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await companySupabase
  .from("registry_tokens")
        .delete()
        .eq("id", tokenId);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["registry", "tokens"] });
    },
  });
}
