/**
 * observatory-audit.mjs — scan both repos for the hard facts the Observatory
 * cares about, write a machine-readable scan, append a history snapshot, and
 * print a drift report vs the previous scan.
 *
 * Zero dependencies. Run from the cwa_manager repo root:
 *   node scripts/observatory-audit.mjs
 *   node scripts/observatory-audit.mjs --json   (print scan JSON, no writes)
 *
 * It does NOT rewrite the hand-authored manifest prose — it surfaces drift so
 * you (or Claude) can update findings deliberately. Outputs:
 *   src/admin/observatory/data/scan.json          (latest facts + file:line)
 *   src/admin/observatory/data/scan-history.json  (append-only snapshots)
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CWA = resolve(__dirname, "..");                 // this repo
const B2B = resolve(CWA, "..", "takeover-B2B");       // sibling repo
const OUT_DIR = join(CWA, "src", "admin", "observatory", "data");
const SCAN = join(OUT_DIR, "scan.json");
const HIST = join(OUT_DIR, "scan-history.json");
const jsonOnly = process.argv.includes("--json");

const SECRETY = /(key|secret|token|password|service[_-]?role|postgres:\/\/|sk-|sk_live|hmac)/i;
const SAFE_PUBLIC = /(_URL$|_SITE_URL$|PUBLIC_.*URL|SUPABASE_URL)/i;

// ── tiny recursive walker (skips noise) ──────────────────────────────────────
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", ".tanstack", "target"]);
function walk(dir, test, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
}
const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };
const rel = (base, p) => relative(base, p).replace(/\\/g, "/");

// ── 1) bundled secrets (CWA .env, VITE_ prefix = shipped in the client) ──────
function scanBundledSecrets() {
  const env = read(join(CWA, ".env"));
  const out = [];
  env.split(/\r?\n/).forEach((line, i) => {
    const m = line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=/);
    if (!m) return;
    const name = m[1];
    const secret = SECRETY.test(name) || SECRETY.test(line.split("=").slice(1).join("="));
    const benign = SAFE_PUBLIC.test(name);
    out.push({ name, file: ".env", line: i + 1, bundled: true, secret: secret && !benign });
  });
  return out;
}

// ── 2) localStorage keys written by the client (resolves const KEY = "..."} ───
function scanLocalStorage() {
  const files = walk(join(CWA, "src"), (p) => /\.(t|j)sx?$/.test(p));
  const keys = new Map(); // key -> {file,line}
  const secretRe = /(auth|token|cred|session|secret|sb-|voice|memory)/i;
  for (const f of files) {
    const txt = read(f);
    const lines = txt.split(/\r?\n/);
    // map local const identifiers to their string value
    const consts = {};
    for (const m of txt.matchAll(/(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*["'`]([^"'`]+)["'`]/g)) consts[m[1]] = m[2];
    lines.forEach((ln, i) => {
      const m = ln.match(/localStorage\.(?:setItem|getItem|removeItem)\(\s*([^,)\s]+)/);
      if (!m) return;
      let raw = m[1].trim();
      let key = null;
      const lit = raw.match(/^["'`]([^"'`]+)["'`]/);
      if (lit) key = lit[1];
      else if (consts[raw]) key = consts[raw];
      if (key && !keys.has(key)) keys.set(key, { key, file: rel(CWA, f), line: i + 1, secret: secretRe.test(key) });
    });
  }
  return [...keys.values()];
}

// ── 3) supabase client: custom storage adapter present? ──────────────────────
function scanSupabaseStorage() {
  const f = join(CWA, "src", "MyComponents", "supabase.ts");
  const txt = read(f);
  if (!txt) return { found: false };
  const customAdapter = /\bstorage\s*:/.test(txt) && /auth\s*:/.test(txt);
  const persist = /persistSession\s*:\s*true/.test(txt);
  return { found: true, file: rel(CWA, f), customStorageAdapter: customAdapter, persistSession: persist };
}

// ── 4) takeover_b2b API routes + auth posture ────────────────────────────────
function scanRoutes() {
  const base = join(B2B, "app", "api");
  const files = walk(base, (p) => /[\\/]route\.(t|j)s$/.test(p));
  return files.map((f) => {
    const txt = read(f);
    const routePath = "/api/" + rel(base, f).replace(/[\\/]route\.(t|j)s$/, "").replace(/\\/g, "/");
    const methods = [...txt.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS)/g)].map((m) => m[1]).filter((m) => m !== "OPTIONS");
    let auth = "none";
    if (/getUser\(|getSession\(|createServerClient/.test(txt)) auth = "supabase-jwt";
    else if (/constructEvent|verif(y|ied).*sign|svix|timingSafeEqual|oauthState|verifyState/i.test(txt)) auth = "signature";
    else if (/headers\.get\(["'`]TakeOver-App["'`]\)\s*!==/.test(txt)) auth = "header-strict (spoofable)";
    else if (/headers\.has\(["'`]TakeOver-App["'`]\)/.test(txt)) auth = "header-presence (spoofable)";
    const serviceRole = /SERVICE_ROLE|supabaseAdmin\(/.test(txt);
    const realAuth = auth === "supabase-jwt" || auth === "signature";
    return { path: routePath, methods: methods.length ? methods : ["?"], auth, realAuth, serviceRole, file: rel(B2B, f) };
  }).sort((a, b) => a.path.localeCompare(b.path));
}

// ── 5) migrations: tables + RLS posture ──────────────────────────────────────
const tableName = (raw) => raw.replace(/["']/g, "").split(".").pop();
function scanMigrations() {
  const dir = join(CWA, "migrations");
  const files = walk(dir, (p) => /\.sql$/.test(p));
  const tables = new Map();
  const ensure = (t, f) => tables.get(t) || (tables.set(t, { table: t, file: f, rls: "none", anonReadable: false }), tables.get(t));
  for (const f of files) {
    const txt = read(f);
    const fr = rel(CWA, f);
    for (const m of txt.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?["']?([a-z0-9_."]+)["']?/gi)) ensure(tableName(m[1]), fr);
    for (const m of txt.matchAll(/alter\s+table\s+["']?([a-z0-9_."]+)["']?\s+enable\s+row\s+level\s+security/gi)) {
      const e = ensure(tableName(m[1]), fr); if (e.rls === "none") e.rls = "enabled";
    }
    // parse each CREATE POLICY statement on its own so the policy NAME can't be
    // mistaken for the table (e.g. a name containing "anon")
    const stmts = txt.split(/create\s+policy/i).slice(1);
    for (const st of stmts) {
      const body = st.split(";")[0];
      const onM = body.match(/\bon\s+(?:[a-z_][a-z0-9_]*\.)?["']?([a-z0-9_]+)["']?/i);
      if (!onM) continue;
      const e = ensure(tableName(onM[1]), fr);
      if (e.rls === "none") e.rls = "enabled";
      if (/\bto\s+anon\b/i.test(body) && /using\s*\(\s*true\s*\)/i.test(body)) {
        e.anonReadable = true; e.rls = "anon-readable";
      }
    }
  }
  return [...tables.values()].sort((a, b) => a.table.localeCompare(b.table));
}

// ── assemble + run ───────────────────────────────────────────────────────────
export async function runAudit({ write = true, history = true, json = false } = {}) {
  const secrets = scanBundledSecrets();
  const localStorage = scanLocalStorage();
  const supabaseStorage = scanSupabaseStorage();
  const routes = scanRoutes();
  const migrations = scanMigrations();

  const summary = {
    bundledSecrets: secrets.filter((s) => s.secret).length,
    localStorageKeys: localStorage.length,
    localStorageSecretKeys: localStorage.filter((k) => k.secret).length,
    routes: routes.length,
    routesNoRealAuth: routes.filter((r) => !r.realAuth).length,
    serviceRoleRoutes: routes.filter((r) => r.serviceRole).length,
    migrationsTables: migrations.length,
    anonReadableTables: migrations.filter((t) => t.anonReadable).length,
    customStorageAdapter: !!supabaseStorage.customStorageAdapter,
  };

  const scan = {
    generatedAt: new Date().toISOString(),
    repos: { cwa: rel(resolve(CWA, ".."), CWA), b2b: existsSync(B2B) ? rel(resolve(CWA, ".."), B2B) : null, cwaAbs: CWA, b2bAbs: existsSync(B2B) ? B2B : null },
    summary, bundledSecrets: secrets, localStorage, supabaseStorage, routes, migrations,
  };

  if (json) return { scan, drift: null };

  let hist = [];
  try { hist = JSON.parse(read(HIST) || "[]"); } catch { hist = []; }
  const prev = hist[hist.length - 1];

  const diffList = (prevArr, curArr, key) => {
    const ps = new Set((prevArr || []).map((x) => x[key]));
    const cs = new Set(curArr.map((x) => x[key]));
    return {
      added: curArr.filter((x) => !ps.has(x[key])).map((x) => x[key]),
      removed: (prevArr || []).filter((x) => !cs.has(x[key])).map((x) => x[key]),
    };
  };
  const drift = prev ? {
    since: prev.generatedAt,
    routes: diffList(prev.routes, routes, "path"),
    newUnauthRoutes: routes.filter((r) => !r.realAuth && !(prev.routes || []).some((p) => p.path === r.path)).map((r) => `${r.methods.join("/")} ${r.path}`),
    bundledSecrets: diffList((prev.bundledSecrets || []).filter((s) => s.secret), secrets.filter((s) => s.secret), "name"),
    localStorage: diffList(prev.localStorage, localStorage, "key"),
    anonReadable: diffList((prev.migrations || []).filter((t) => t.anonReadable), migrations.filter((t) => t.anonReadable), "table"),
  } : null;

  if (write) {
    writeFileSync(SCAN, JSON.stringify({ ...scan, drift }, null, 2));
    if (history) {
      hist.push({ generatedAt: scan.generatedAt, summary, routes, bundledSecrets: secrets, localStorage, migrations });
      if (hist.length > 60) hist = hist.slice(-60);
      writeFileSync(HIST, JSON.stringify(hist, null, 2));
    }
  }
  return { scan, drift };
}

function report({ summary, supabaseStorage, generatedAt }, drift) {
  const c = { r: "\x1b[31m", y: "\x1b[33m", g: "\x1b[32m", d: "\x1b[2m", b: "\x1b[1m", x: "\x1b[0m" };
  console.log(`\n${c.b}Observatory audit${c.x} ${c.d}${generatedAt}${c.x}`);
  console.log(`  routes ${summary.routes} · ${c.r}${summary.routesNoRealAuth} without real auth${c.x} · ${summary.serviceRoleRoutes} service-role`);
  console.log(`  bundled secrets ${c.r}${summary.bundledSecrets}${c.x} · localStorage keys ${summary.localStorageKeys} (${c.y}${summary.localStorageSecretKeys} secret-shaped${c.x})`);
  console.log(`  migrations: ${summary.migrationsTables} tables · ${c.r}${summary.anonReadableTables} anon-readable${c.x}`);
  console.log(`  supabase custom storage adapter: ${supabaseStorage.customStorageAdapter ? c.g + "yes" + c.x : c.r + "no (sessions in localStorage)" + c.x}`);
  if (!drift) { console.log(`\n${c.d}First scan — baseline saved. Re-run after changes to see drift.${c.x}\n`); return; }
  console.log(`\n${c.b}Drift since ${drift.since}${c.x}`);
  const show = (label, arr, color = c.y) => arr.length && console.log(`  ${color}${label}:${c.x} ${arr.join(", ")}`);
  let any = false;
  if (drift.newUnauthRoutes.length) { any = true; console.log(`  ${c.r}⚠ NEW ROUTES WITHOUT REAL AUTH:${c.x} ${drift.newUnauthRoutes.join(", ")}`); }
  any = show("new routes", drift.routes.added) || any;
  any = show("removed routes", drift.routes.removed, c.d) || any;
  any = show("⚠ new bundled secrets", drift.bundledSecrets.added, c.r) || any;
  any = show("new localStorage keys", drift.localStorage.added) || any;
  any = show("⚠ new anon-readable tables", drift.anonReadable.added, c.r) || any;
  if (!any) console.log(`  ${c.g}no drift — nothing new entered the attack surface.${c.x}`);
  console.log("");
}

// ── CLI (only when executed directly, not when imported by the Vite plugin) ──
const isCli = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("observatory-audit.mjs");
if (isCli) {
  const json = process.argv.includes("--json");
  const ci = process.argv.includes("--ci");
  const { scan, drift } = await runAudit({ write: !json, json });
  if (json) { console.log(JSON.stringify(scan, null, 2)); process.exit(0); }
  report(scan, drift);
  const ciFail = drift && (drift.newUnauthRoutes.length || drift.bundledSecrets.added.length || drift.anonReadable.added.length);
  if (ci && ciFail) { console.error("observatory-audit: new exposure detected since last scan (see above)."); process.exit(1); }
}
