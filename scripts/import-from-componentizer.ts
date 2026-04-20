/**
 * import-from-componentizer.ts — walks the local CWA-Componentizer's
 * `src/saved-components/<Name>/` folders, packs each into a .tgz,
 * and publishes to the new Takeover registry via the registry-cli
 * Edge Function.
 *
 * Why this instead of migrate-registry.ts: the old
 * cwa-registry.vercel.app + its Supabase are gone, so we can't
 * pull tarballs from there. The source code, however, still lives
 * locally in the Componentizer repo — this script ships it
 * straight from disk.
 *
 * Run:
 *   bun run scripts/import-from-componentizer.ts \
 *     --componentizer-dir "C:/Users/Ali/OneDrive/Desktop/CWA-Componentizer" \
 *     --token cwa_xxx
 *
 *   # Or with env vars:
 *   set CWA_ENDPOINT=https://<ref>.supabase.co/functions/v1/registry-cli
 *   set CWA_TOKEN=cwa_xxx
 *   bun run scripts/import-from-componentizer.ts --componentizer-dir C:\...\CWA-Componentizer
 *
 * Flags:
 *   --componentizer-dir <path>   (required) root of CWA-Componentizer
 *   --new-endpoint <url>         (required unless CWA_ENDPOINT is set)
 *   --token <cwa_xxx>            (required unless CWA_TOKEN is set)
 *   --company <scope>            cwa | simplicity | shared  (default: cwa)
 *   --dry-run                    list what would import, do nothing
 *   --only <name,name>           comma-separated filter
 *   --concurrency <n>            parallel uploads (default: 3)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

// ── Colors ──────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  cyan: "\x1b[36m", gray: "\x1b[90m",
};

// ── Flags ───────────────────────────────────────────────────
interface Args {
  componentizerDir: string;
  newEndpoint: string;
  token: string;
  company: "cwa" | "simplicity" | "shared";
  dryRun: boolean;
  only: string[] | null;
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

  const componentizerDir = get("--componentizer-dir") ?? "";
  const onlyRaw = get("--only");

  const args: Args = {
    componentizerDir,
    newEndpoint: (get("--new-endpoint") ?? process.env.CWA_ENDPOINT ?? "").replace(/\/+$/, ""),
    token: get("--token") ?? process.env.CWA_TOKEN ?? "",
    company: (get("--company", "cwa") as Args["company"]),
    dryRun: has("--dry-run"),
    only: onlyRaw ? onlyRaw.split(",").map((s) => s.trim()).filter(Boolean) : null,
    concurrency: Number(get("--concurrency", "3")),
  };

  if (!args.componentizerDir) fail("--componentizer-dir is required");
  if (!fs.existsSync(args.componentizerDir))
    fail(`Componentizer dir does not exist: ${args.componentizerDir}`);
  if (!args.newEndpoint) fail("--new-endpoint or CWA_ENDPOINT is required");
  if (!args.token && !args.dryRun) fail("--token or CWA_TOKEN is required (unless --dry-run)");
  if (!["cwa", "simplicity", "shared"].includes(args.company))
    fail(`--company must be cwa|simplicity|shared (got ${args.company})`);

  return args;
}

function fail(msg: string): never {
  console.error(`${C.red}✖${C.reset} ${msg}`);
  process.exit(1);
}

// ── Tar — use Bun/Node's built-in tar via a child process rather
//    than pulling the 'tar' npm dep into this one-shot script.
//    Bun's shell can also do this but spawn is portable. ─────
async function packFolder(folderPath: string, outFile: string): Promise<number> {
  // Use Node's tar module via dynamic import — it's already in
  // CWA-CLI's deps, and if it's in the parent node_modules it
  // works here too.
  try {
    const tar = await import("tar");
    const parent = path.dirname(folderPath);
    const folderName = path.basename(folderPath);
    await tar.c(
      {
        gzip: true,
        file: outFile,
        cwd: parent,
        filter: (filePath: string) => {
          const norm = filePath.replace(/\\/g, "/");
          const skips = [
            "node_modules", ".git/", ".DS_Store", ".vscode",
            "dist", "build", ".next", ".local", ".log",
          ];
          return !skips.some((s) => norm.includes(s));
        },
      },
      [folderName],
    );
    return fs.statSync(outFile).size;
  } catch (e) {
    // Fallback: shell out to system tar, which Windows 10+ has.
    return await tarViaShell(folderPath, outFile);
  }
}

function tarViaShell(folderPath: string, outFile: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const parent = path.dirname(folderPath);
    const folderName = path.basename(folderPath);
    const proc = spawn("tar", ["-czf", outFile, "-C", parent, folderName], {
      stdio: "ignore",
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`tar exited ${code}`));
      try {
        resolve(fs.statSync(outFile).size);
      } catch (e) {
        reject(e);
      }
    });
  });
}

// ── Check if an item exists on the new registry ─────────────
interface ExistsCheck {
  exists: boolean;
  version?: string;
}

async function checkExists(
  endpoint: string,
  token: string,
  name: string,
): Promise<ExistsCheck> {
  const res = await fetch(
    `${endpoint}/items/${encodeURIComponent(name)}?kind=component`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return { exists: false };
  if (!res.ok) {
    const body = await res.text();
    const snippet = body.slice(0, 300).replace(/\s+/g, " ").trim();
    throw new Error(`check ${name}: ${res.status} — ${snippet || "(empty body)"}`);
  }
  const body = (await res.json()) as { item: { latest_version: string | null } };
  return { exists: true, version: body.item.latest_version ?? undefined };
}

// ── Publish one ─────────────────────────────────────────────
interface PublishResult {
  status: string;
  version: string;
  size_bytes: number;
}

async function publish(
  endpoint: string,
  token: string,
  input: { name: string; company: Args["company"]; tarballPath: string },
): Promise<PublishResult> {
  const buf = fs.readFileSync(input.tarballPath);
  const blob = new Blob([buf], { type: "application/gzip" });
  const form = new FormData();
  form.append("name", input.name);
  form.append("kind", "component");
  form.append("company", input.company);
  form.append("version", "1.0.0");
  form.append("description", "Imported from CWA-Componentizer");
  form.append("tags", "componentizer-import");
  form.append("changelog", "Initial import from local Componentizer folder");
  form.append("tarball", blob, `${input.name}-1.0.0.tgz`);

  const res = await fetch(`${endpoint}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`publish ${input.name}: ${res.status} ${body}`);
  }
  return (await res.json()) as PublishResult;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const args = parseArgs();

  const savedDir = path.join(args.componentizerDir, "src", "saved-components");
  if (!fs.existsSync(savedDir)) {
    fail(`Expected folder not found: ${savedDir}`);
  }

  // Turn "name-to-slug" — DB names are kebab-case by convention.
  // "CWASidebar" → "cwa-sidebar". Keep original too so we can find
  // the folder on disk.
  const entries = fs
    .readdirSync(savedDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      folder: d.name,
      name: toKebabCase(d.name),
      absPath: path.join(savedDir, d.name),
    }))
    .filter((e) => !args.only || args.only.includes(e.folder) || args.only.includes(e.name));

  console.log();
  console.log(`${C.bold}Componentizer → Registry Import${C.reset}`);
  console.log(`${C.gray}  Source: ${savedDir}${C.reset}`);
  console.log(`${C.gray}  New:    ${args.newEndpoint}${C.reset}`);
  console.log(`${C.gray}  Scope:  ${args.company}  ·  Concurrency: ${args.concurrency}${C.reset}`);
  if (args.dryRun) console.log(`${C.yellow}  DRY RUN — no writes${C.reset}`);
  console.log();
  console.log(`${C.cyan}→${C.reset} Found ${entries.length} components`);
  for (const e of entries) {
    console.log(
      `  ${C.gray}•${C.reset} ${e.folder.padEnd(20)} ${C.gray}→ ${e.name}${C.reset}`,
    );
  }
  console.log();

  if (entries.length === 0) {
    console.log(`${C.yellow}Nothing to import.${C.reset}`);
    process.exit(0);
  }

  if (args.dryRun) {
    console.log(`${C.green}✔${C.reset} Dry run complete — re-run without --dry-run to import.`);
    process.exit(0);
  }

  // Check which already exist on the new registry.
  console.log(`${C.cyan}→${C.reset} Checking which items already exist on the new registry…`);
  const plan: Array<typeof entries[number] & { skip: boolean; reason?: string }> = [];
  for (const e of entries) {
    try {
      const check = await checkExists(args.newEndpoint, args.token, e.name);
      if (check.exists) {
        plan.push({ ...e, skip: true, reason: `already present (v${check.version ?? "?"})` });
      } else {
        plan.push({ ...e, skip: false });
      }
    } catch (err) {
      plan.push({ ...e, skip: true, reason: `check failed: ${err instanceof Error ? err.message : String(err)}` });
    }
  }
  const toImport = plan.filter((p) => !p.skip);
  const toSkip = plan.filter((p) => p.skip);
  console.log(`${C.cyan}→${C.reset} ${toImport.length} to import · ${toSkip.length} to skip`);
  for (const p of toSkip) {
    console.log(`  ${C.gray}skip${C.reset}  ${p.name.padEnd(24)}  ${C.gray}${p.reason ?? ""}${C.reset}`);
  }
  console.log();

  if (toImport.length === 0) {
    console.log(`${C.green}✔${C.reset} Everything is already imported.`);
    process.exit(0);
  }

  // Pack + publish with bounded concurrency.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cwa-import-"));
  let succeeded = 0;
  let failed = 0;
  const queue = [...toImport];

  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const tarPath = path.join(tmpDir, `${item.name}.tgz`);
      try {
        const size = await packFolder(item.absPath, tarPath);
        const res = await publish(args.newEndpoint, args.token, {
          name: item.name,
          company: args.company,
          tarballPath: tarPath,
        });
        console.log(
          `  ${C.green}✔${C.reset}  ${item.name.padEnd(24)}  ${C.gray}v${res.version} (${(size / 1024).toFixed(1)} KiB)${C.reset}`,
        );
        succeeded += 1;
      } catch (e) {
        console.log(
          `  ${C.red}✖${C.reset}  ${item.name.padEnd(24)}  ${C.red}${e instanceof Error ? e.message : String(e)}${C.reset}`,
        );
        failed += 1;
      } finally {
        try { if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath); } catch { /* noop */ }
      }
    }
  };

  await Promise.all(Array.from({ length: args.concurrency }, () => worker()));

  // Cleanup tmp dir.
  try { fs.rmdirSync(tmpDir); } catch { /* noop */ }

  console.log();
  console.log(`${C.bold}Import complete${C.reset}`);
  console.log(`  ${C.green}✔ ${succeeded} imported${C.reset}`);
  if (toSkip.length > 0) console.log(`  ${C.gray}↷ ${toSkip.length} skipped${C.reset}`);
  if (failed > 0)        console.log(`  ${C.red}✖ ${failed} failed${C.reset}`);
  console.log();
  console.log(`${C.cyan}ℹ${C.reset} Open Takeover → /components to verify.`);

  process.exit(failed > 0 ? 1 : 0);
}

// ── Helpers ─────────────────────────────────────────────────
/**
 * Convert Componentizer's PascalCase folder names to registry
 * kebab-case names. Uses capital-letter boundaries.
 *   "CWASidebar"   → "cwa-sidebar"
 *   "AdminTabs"    → "admin-tabs"
 *   "ModeToggle"   → "mode-toggle"
 *   "NetiflySidebar" → "netifly-sidebar"
 */
function toKebabCase(s: string): string {
  return s
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2") // ABCd → AB-Cd
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")    // aB   → a-B
    .toLowerCase();
}

main().catch((e) => {
  console.error(`${C.red}Fatal:${C.reset}`, e);
  process.exit(1);
});
