// ────────────────────────────────────────────────────────────────
// registry-cli — Supabase Edge Function that proxies CWA-CLI ops.
//
// The CLI talks to this endpoint with `Authorization: Bearer cwa_xxx`
// (a personal-access token created from Takeover Settings). This
// function:
//
//   1. Validates the token via the `validate_cli_token` RPC, which
//      uses SECURITY DEFINER to bypass RLS on registry_tokens.
//   2. Attaches the owner identity to the request.
//   3. Routes the request to the right handler and performs DB +
//      storage ops with the service-role key (never shipped to the
//      CLI client).
//
// Routes:
//   GET    /whoami
//   GET    /items                       — list with ?kind&company&search
//   GET    /items/:name?kind=           — item detail + versions
//   GET    /download/:name?kind&version — 302 to public tarball URL
//   POST   /publish                     — multipart: tarball + meta
//   DELETE /items/:name?kind=           — remove item + all versions
//   POST   /install-log                 — best-effort usage logging
//
// Deploy:
//   supabase functions deploy registry-cli --no-verify-jwt
//   (--no-verify-jwt is essential: we do our own bearer validation)
// ────────────────────────────────────────────────────────────────

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;

// Admin client for all DB + storage operations. Never exposed to
// the caller — we only return rows it should see.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
// Anon client just for invoking the token-validation RPC. Runs
// under the anon role so we exercise the RPC grant path.
const anon  = createClient(SUPABASE_URL, ANON_KEY);

const BUCKET = "registry";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-project-name, x-machine-id",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function text(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/plain" },
  });
}

// ── Token validation ─────────────────────────────────────────
interface Caller {
  owner: string;
  scope: string;
}

async function requireAuth(req: Request): Promise<Caller | Response> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(cwa_[a-f0-9]{48,})$/i.exec(header.trim());
  if (!m) {
    return json(401, { error: "Missing or malformed bearer token. Format: 'Authorization: Bearer cwa_...'" });
  }
  const raw = m[1];

  const { data, error } = await anon.rpc("validate_cli_token", { raw_token: raw });
  if (error) return json(500, { error: `token validation: ${error.message}` });
  if (!data || data.length === 0) {
    return json(401, { error: "Invalid or expired token. Run `cwa login` again." });
  }
  return { owner: data[0].owner, scope: data[0].scope };
}

// ── Handlers ─────────────────────────────────────────────────
async function handleWhoami(caller: Caller): Promise<Response> {
  return json(200, {
    owner: caller.owner,
    scope: caller.scope,
    // Echo the server version so `cwa whoami --verbose` can cross-check.
    server_version: "1.0.0",
  });
}

async function handleListItems(url: URL): Promise<Response> {
  const kind     = url.searchParams.get("kind");
  const company  = url.searchParams.get("company");
  const search   = url.searchParams.get("search");
  const limit    = Number(url.searchParams.get("limit") ?? "200");

  let q = admin.from("registry_items_with_latest").select("*");
  if (kind)    q = q.eq("kind", kind);
  if (company) q = q.eq("company", company);
  if (search && search.length > 0) {
    const s = search.replace(/[%_]/g, "");
    q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
  }
  q = q.order("install_count", { ascending: false }).limit(Math.min(limit, 500));
  const { data, error } = await q;
  if (error) return json(500, { error: error.message });
  return json(200, { items: data ?? [] });
}

async function handleItemDetail(name: string, url: URL): Promise<Response> {
  const kind = url.searchParams.get("kind");
  if (!kind) return json(400, { error: "?kind=component|template is required" });

  const { data: item, error } = await admin
    .from("registry_items")
    .select("*")
    .eq("name", name)
    .eq("kind", kind)
    .maybeSingle();
  if (error) return json(500, { error: error.message });
  if (!item)  return json(404, { error: `${kind} '${name}' not found` });

  const { data: versions } = await admin
    .from("registry_versions")
    .select("*")
    .eq("item_id", item.id)
    .order("published_at", { ascending: false });

  return json(200, { item, versions: versions ?? [] });
}

async function handleDownload(name: string, url: URL): Promise<Response> {
  const kind    = url.searchParams.get("kind");
  const version = url.searchParams.get("version");
  if (!kind) return json(400, { error: "?kind= is required" });

  const { data: item } = await admin
    .from("registry_items")
    .select("id, latest_version")
    .eq("name", name)
    .eq("kind", kind)
    .maybeSingle();
  if (!item) return json(404, { error: `${kind} '${name}' not found` });

  const targetVersion = version ?? item.latest_version;
  if (!targetVersion) return json(404, { error: "no version published yet" });

  const { data: ver } = await admin
    .from("registry_versions")
    .select("storage_path, yanked, size_bytes")
    .eq("item_id", item.id)
    .eq("version", targetVersion)
    .maybeSingle();
  if (!ver)         return json(404, { error: `version ${targetVersion} not found` });
  if (ver.yanked)   return json(410, { error: `version ${targetVersion} was yanked` });

  // Bucket is public, so we can redirect straight to the public URL.
  // (CLI follows redirects by default.)
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(ver.storage_path);
  return new Response(null, {
    status: 302,
    headers: {
      ...CORS_HEADERS,
      Location: pub.publicUrl,
      "X-Registry-Version": targetVersion,
      "X-Registry-Size":    String(ver.size_bytes ?? 0),
    },
  });
}

async function handlePublish(req: Request, caller: Caller): Promise<Response> {
  const form = await req.formData();
  const name        = (form.get("name") ?? "").toString().trim();
  const kind        = (form.get("kind") ?? "").toString().trim();
  const company     = (form.get("company") ?? "shared").toString().trim();
  const description = (form.get("description") ?? "").toString() || null;
  const tagsRaw     = (form.get("tags") ?? "").toString();
  const version     = (form.get("version") ?? "").toString().trim();
  const changelog   = (form.get("changelog") ?? "").toString() || null;
  const depsRaw     = (form.get("dependencies") ?? "").toString();
  const tarball     = form.get("tarball");

  if (!name) return json(400, { error: "name is required" });
  if (!["component", "template"].includes(kind))
    return json(400, { error: "kind must be 'component' or 'template'" });
  if (!["cwa", "simplicity", "shared"].includes(company))
    return json(400, { error: "company must be 'cwa', 'simplicity', or 'shared'" });
  if (!(tarball instanceof File))
    return json(400, { error: "tarball file missing" });
  if (!/^\d+\.\d+\.\d+$/.test(version))
    return json(400, { error: "version must be semver (e.g. 1.0.0)" });

  const tags = tagsRaw ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  let dependencies: Record<string, string> = {};
  if (depsRaw) {
    try { dependencies = JSON.parse(depsRaw); } catch { /* noop */ }
  }

  // 1. Upsert item row.
  const { data: existing } = await admin
    .from("registry_items")
    .select("*")
    .eq("name", name)
    .eq("kind", kind)
    .maybeSingle();

  let item: any;
  if (existing) {
    item = existing;
  } else {
    const { data, error } = await admin
      .from("registry_items")
      .insert({
        name,
        kind,
        company,
        description,
        tags,
        created_by: caller.owner,
      })
      .select()
      .single();
    if (error || !data) return json(500, { error: `item insert: ${error?.message}` });
    item = data;
  }

  // 2. Guard against version collisions.
  const { data: existingVer } = await admin
    .from("registry_versions")
    .select("id")
    .eq("item_id", item.id)
    .eq("version", version)
    .maybeSingle();
  if (existingVer) {
    return json(409, { error: `version ${version} already published — bump it` });
  }

  // 3. Upload tarball.
  const storagePath = `artifacts/${item.id}/${version}.tgz`;
  const buffer = await (tarball as File).arrayBuffer();
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      cacheControl: "31536000",
      contentType: "application/gzip",
      upsert: true,
    });
  if (upErr) return json(500, { error: `upload: ${upErr.message}` });

  // 4. Insert version row.
  const { error: verErr } = await admin
    .from("registry_versions")
    .insert({
      item_id: item.id,
      version,
      storage_path: storagePath,
      size_bytes: buffer.byteLength,
      changelog,
      dependencies,
      published_by: caller.owner,
    });
  if (verErr) return json(500, { error: `version insert: ${verErr.message}` });

  // 5. Update item pointer + descriptive fields.
  await admin
    .from("registry_items")
    .update({
      latest_version: version,
      description: description ?? item.description,
      tags: tags.length > 0 ? tags : item.tags,
      company,
    })
    .eq("id", item.id);

  return json(200, {
    status: "published",
    item: item.name,
    kind,
    version,
    size_bytes: buffer.byteLength,
  });
}

async function handleDelete(name: string, url: URL): Promise<Response> {
  const kind = url.searchParams.get("kind");
  if (!kind) return json(400, { error: "?kind= is required" });

  const { data: item } = await admin
    .from("registry_items")
    .select("id")
    .eq("name", name)
    .eq("kind", kind)
    .maybeSingle();
  if (!item) return json(404, { error: `${kind} '${name}' not found` });

  // Collect storage paths to wipe after the cascading DB delete.
  const { data: versions } = await admin
    .from("registry_versions")
    .select("storage_path")
    .eq("item_id", item.id);
  const paths = (versions ?? []).map((v: any) => v.storage_path as string);
  paths.push(
    `covers/${item.id}.png`,
    `covers/${item.id}.jpg`,
    `covers/${item.id}.webp`,
  );
  if (paths.length > 0) {
    await admin.storage.from(BUCKET).remove(paths);
  }

  const { error } = await admin
    .from("registry_items")
    .delete()
    .eq("id", item.id);
  if (error) return json(500, { error: error.message });

  return json(200, { status: "deleted", name, kind });
}

async function handleInstallLog(req: Request, caller: Caller): Promise<Response> {
  const body = await req.json().catch(() => null) as {
    name?: string;
    kind?: string;
    version?: string;
    project_name?: string;
    machine_id?: string;
  } | null;
  if (!body?.name || !body.kind || !body.version) {
    return json(400, { error: "name, kind, version required" });
  }
  const { data: item } = await admin
    .from("registry_items")
    .select("id")
    .eq("name", body.name)
    .eq("kind", body.kind)
    .maybeSingle();
  if (!item) return json(404, { error: "item not found" });

  await admin.from("registry_installs").insert({
    item_id: item.id,
    version: body.version,
    installed_by: caller.owner,
    project_name: body.project_name ?? null,
    machine_id: body.machine_id ?? null,
  });
  return json(200, { status: "logged" });
}

// ── Router ───────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  // Supabase adds the function name to the path; strip it.
  // e.g. "/registry-cli/items" → "/items".
  const path = url.pathname.replace(/^\/registry-cli/, "") || "/";

  // All routes require auth. Token validation happens first.
  const authed = await requireAuth(req);
  if (authed instanceof Response) return authed;
  const caller = authed;

  try {
    // GET /whoami
    if (req.method === "GET" && path === "/whoami") {
      return handleWhoami(caller);
    }

    // GET /items
    if (req.method === "GET" && path === "/items") {
      return handleListItems(url);
    }

    // GET /items/:name
    const itemMatch = /^\/items\/([^/]+)\/?$/.exec(path);
    if (req.method === "GET" && itemMatch) {
      return handleItemDetail(decodeURIComponent(itemMatch[1]), url);
    }

    // GET /download/:name
    const downloadMatch = /^\/download\/([^/]+)\/?$/.exec(path);
    if (req.method === "GET" && downloadMatch) {
      return handleDownload(decodeURIComponent(downloadMatch[1]), url);
    }

    // POST /publish
    if (req.method === "POST" && path === "/publish") {
      return handlePublish(req, caller);
    }

    // DELETE /items/:name
    if (req.method === "DELETE" && itemMatch) {
      return handleDelete(decodeURIComponent(itemMatch[1]), url);
    }

    // POST /install-log
    if (req.method === "POST" && path === "/install-log") {
      return handleInstallLog(req, caller);
    }

    return text(404, `route not found: ${req.method} ${path}`);
  } catch (err) {
    console.error("[registry-cli] unhandled:", err);
    return json(500, { error: err instanceof Error ? err.message : String(err) });
  }
});
