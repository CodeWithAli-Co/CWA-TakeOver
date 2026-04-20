/**
 * migrate-registry.ts — one-shot Node script that pulls every
 * template + component from the OLD cwa-registry.vercel.app and
 * re-publishes them into Takeover's new registry via the
 * registry-cli Edge Function.
 *
 * Strategy: HTTP-based. We don't need the old Supabase
 * credentials — the old CLI already accessed the data through the
 * Vercel service's public endpoints:
 *
 *   GET  /templates   → { DBdata: [{ name, ... }] }
 *   GET  /components  → { DBdata: [{ name, ... }] }
 *   POST /create       body=<name>   → tarball stream (templates)
 *   POST /install-component  body=<name> → tarball stream (components)
 *
 * We list both collections, download each tarball into memory,
 * and POST it to the new Edge Function's /publish endpoint with
 * version 1.0.0 + the chosen company scope.
 *
 * Idempotent: items that already exist in the new registry are
 * skipped (server returns 409 on version collision).
 *
 * Run:
 *   bun run scripts/migrate-registry.ts --token cwa_xxx --new-endpoint https://<ref>.supabase.co/functions/v1/registry-cli
 *
 * Flags:
 *   --old-url <url>        (default: https://cwa-registry.vercel.app)
 *   --new-endpoint <url>   (required unless CWA_ENDPOINT is set)
 *   --token <cwa_xxx>      (required unless CWA_TOKEN is set)
 *   --company <scope>      cwa | simplicity | shared (default: cwa)
 *   --only <kind>          component | template (default: both)
 *   --dry-run              list what would migrate, do nothing
 *   --concurrency <n>      parallel item migrations (default: 3)
 */

// ── Colors — avoid pulling chalk for a one-shot script ─────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

// ── Flag parsing ────────────────────────────────────────────
interface Args {
  oldUrl: string;
  newEndpoint: string;
  token: string;
  company: "cwa" | "simplicity" | "shared";
  only: "component" | "template" | "both";
  dryRun: boolean;
  concurrency: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string, def?: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i === -1) return def;
    return argv[i + 1];
  };
  const has = (flag: string): boolean => argv.includes(flag);

  const args: Args = {
    oldUrl: (get("--old-url") ?? "https://cwa-registry.vercel.app").replace(/\/+$/, ""),
    newEndpoint: (get("--new-endpoint") ?? process.env.CWA_ENDPOINT ?? "").replace(/\/+$/, ""),
    token: get("--token") ?? process.env.CWA_TOKEN ?? "",
    company: (get("--company", "cwa") as Args["company"]),
    only: (get("--only", "both") as Args["only"]),
    dryRun: has("--dry-run"),
    concurrency: Number(get("--concurrency", "3")),
  };

  if (!args.newEndpoint) fail("--new-endpoint or CWA_ENDPOINT is required");
  if (!args.token && !args.dryRun) fail("--token or CWA_TOKEN is required (unless --dry-run)");
  if (!["cwa", "simplicity", "shared"].includes(args.company))
    fail(`--company must be cwa|simplicity|shared (got ${args.company})`);
  if (!["component", "template", "both"].includes(args.only))
    fail(`--only must be component|template|both (got ${args.only})`);

  return args;
}

function fail(msg: string): never {
  console.error(`${C.red}✖${C.reset} ${msg}`);
  process.exit(1);
}

function log(prefix: string, msg: string, color = C.cyan) {
  console.log(`${color}${prefix}${C.reset} ${msg}`);
}

// ── Old registry API ────────────────────────────────────────
interface OldDbRow {
  name: string;
  [k: string]: unknown;
}

async function listOld(baseUrl: string, path: "/templates" | "/components"): Promise<OldDbRow[]> {
  const res = await fetch(`${baseUrl}${path}`);
  const ct = res.headers.get("content-type") ?? "";
  const bodyText = await res.text();

  if (!res.ok) {
    const snippet = bodyText.slice(0, 300).replace(/\s+/g, " ").trim();
    throw new Error(
      `GET ${baseUrl}${path} → ${res.status} ${res.statusText}\n` +
      `  Response: ${snippet || "(empty)"}`,
    );
  }

  // Defensive: the old Vercel project might be paused, returning HTML.
  if (!ct.includes("application/json")) {
    const snippet = bodyText.slice(0, 300).replace(/\s+/g, " ").trim();
    throw new Error(
      `GET ${baseUrl}${path} returned ${ct || "no content-type"} instead of JSON.\n` +
      `  Likely the old cwa-registry Vercel project is paused, deleted, or reached its free-tier limit.\n` +
      `  First ${Math.min(300, snippet.length)} chars of response:\n` +
      `    ${snippet || "(empty)"}\n` +
      `  If the old service is gone, use Plan B (direct Supabase export) instead.`,
    );
  }

  try {
    const data = JSON.parse(bodyText) as { DBdata?: OldDbRow[] };
    return data.DBdata ?? [];
  } catch (e) {
    throw new Error(
      `GET ${baseUrl}${path} returned non-JSON despite application/json content-type.\n` +
      `  Parse error: ${e instanceof Error ? e.message : String(e)}\n` +
      `  Body (first 300 chars): ${bodyText.slice(0, 300)}`,
    );
  }
}

async function downloadTarball(
  baseUrl: string,
  kind: "component" | "template",
  name: string,
): Promise<ArrayBuffer> {
  const endpoint = kind === "template" ? "/create" : "/install-component";
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    body: name,
  });
  if (!res.ok) {
    throw new Error(`POST ${baseUrl}${endpoint} (${name}) → ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength === 0) {
    throw new Error(`empty tarball for ${kind} '${name}'`);
  }
  return buf;
}

// ── New registry API (via Edge Function) ────────────────────
interface NewItemCheck {
  exists: boolean;
  latestVersion?: string;
}

async function checkNewExists(
  endpoint: string,
  token: string,
  name: string,
  kind: "component" | "template",
): Promise<NewItemCheck> {
  const res = await fetch(`${endpoint}/items/${encodeURIComponent(name)}?kind=${kind}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return { exists: false };
  if (!res.ok) throw new Error(`check ${name}: ${res.status}`);
  const body = (await res.json()) as { item: { latest_version: string | null } };
  return { exists: true, latestVersion: body.item.latest_version ?? undefined };
}

interface PublishResult {
  status: string;
  version: string;
  size_bytes: number;
}

async function publishToNew(
  endpoint: string,
  token: string,
  args: {
    name: string;
    kind: "component" | "template";
    company: Args["company"];
    tarball: ArrayBuffer;
  },
): Promise<PublishResult> {
  const form = new FormData();
  form.append("name", args.name);
  form.append("kind", args.kind);
  form.append("company", args.company);
  form.append("version", "1.0.0");
  form.append("description", `Imported from legacy cwa-registry`);
  form.append("tags", "legacy-import");
  form.append("changelog", "Initial import from cwa-registry.vercel.app");

  const blob = new Blob([args.tarball], { type: "application/gzip" });
  form.append("tarball", blob, `${args.name}-1.0.0.tgz`);

  const res = await fetch(`${endpoint}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`publish ${args.name}: ${res.status} ${body}`);
  }
  return (await res.json()) as PublishResult;
}

// ── Main ────────────────────────────────────────────────────
interface Plan {
  name: string;
  kind: "component" | "template";
  action: "migrate" | "skip";
  reason?: string;
}

async function main() {
  const args = parseArgs();

  console.log();
  console.log(`${C.bold}CWA Registry Migration${C.reset}`);
  console.log(`${C.gray}  Old: ${args.oldUrl}${C.reset}`);
  console.log(`${C.gray}  New: ${args.newEndpoint}${C.reset}`);
  console.log(`${C.gray}  Scope: ${args.company}  ·  Only: ${args.only}  ·  Concurrency: ${args.concurrency}${C.reset}`);
  if (args.dryRun) console.log(`${C.yellow}  DRY RUN — no writes${C.reset}`);
  console.log();

  // 1. List old registry.
  log("→", "Listing old registry…", C.cyan);
  const templates = args.only !== "component"
    ? (await listOld(args.oldUrl, "/templates")).map((r) => ({ name: r.name, kind: "template" as const }))
    : [];
  const components = args.only !== "template"
    ? (await listOld(args.oldUrl, "/components")).map((r) => ({ name: r.name, kind: "component" as const }))
    : [];
  log("✔", `Found ${templates.length} templates, ${components.length} components`, C.green);
  console.log();

  const all = [...templates, ...components];
  if (all.length === 0) {
    log("ℹ", "Nothing to migrate.", C.yellow);
    process.exit(0);
  }

  // 2. Build migration plan — check which already exist.
  const plan: Plan[] = [];
  if (!args.dryRun) {
    log("→", "Checking which items already exist on the new registry…", C.cyan);
    for (const item of all) {
      try {
        const exists = await checkNewExists(args.newEndpoint, args.token, item.name, item.kind);
        if (exists.exists) {
          plan.push({ ...item, action: "skip", reason: `already present (v${exists.latestVersion ?? "?"})` });
        } else {
          plan.push({ ...item, action: "migrate" });
        }
      } catch (e) {
        plan.push({ ...item, action: "skip", reason: `check failed: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
  } else {
    // In dry-run, everything is marked "migrate" (we can't tell without the token).
    for (const item of all) plan.push({ ...item, action: "migrate" });
  }

  const toMigrate = plan.filter((p) => p.action === "migrate");
  const toSkip = plan.filter((p) => p.action === "skip");

  console.log();
  log("→", `${toMigrate.length} to migrate · ${toSkip.length} to skip`, C.cyan);
  for (const p of toSkip) {
    console.log(`  ${C.gray}skip${C.reset}  ${p.kind.padEnd(9)}  ${p.name}  ${C.gray}${p.reason ?? ""}${C.reset}`);
  }
  console.log();

  if (args.dryRun) {
    log("✔", "Dry run complete — nothing written.", C.green);
    process.exit(0);
  }

  // 3. Migrate with bounded concurrency.
  let succeeded = 0;
  let failed = 0;
  const queue = [...toMigrate];
  const workers: Promise<void>[] = [];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      try {
        const tarball = await downloadTarball(args.oldUrl, item.kind, item.name);
        const result = await publishToNew(args.newEndpoint, args.token, {
          name: item.name,
          kind: item.kind,
          company: args.company,
          tarball,
        });
        const size = (result.size_bytes / 1024).toFixed(1);
        console.log(
          `  ${C.green}✔${C.reset}  ${item.kind.padEnd(9)}  ${C.bold}${item.name}${C.reset}  ${C.gray}v${result.version} (${size} KiB)${C.reset}`,
        );
        succeeded += 1;
      } catch (e) {
        console.log(
          `  ${C.red}✖${C.reset}  ${item.kind.padEnd(9)}  ${C.bold}${item.name}${C.reset}  ${C.red}${e instanceof Error ? e.message : String(e)}${C.reset}`,
        );
        failed += 1;
      }
    }
  };

  for (let i = 0; i < args.concurrency; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  console.log();
  console.log(`${C.bold}Migration complete${C.reset}`);
  console.log(`  ${C.green}✔ ${succeeded} migrated${C.reset}`);
  if (toSkip.length > 0) console.log(`  ${C.gray}↷ ${toSkip.length} skipped${C.reset}`);
  if (failed > 0) console.log(`  ${C.red}✖ ${failed} failed${C.reset}`);
  console.log();
  log("ℹ", "Open Takeover → /components to verify.", C.cyan);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(`${C.red}Fatal:${C.reset}`, e);
  process.exit(1);
});
