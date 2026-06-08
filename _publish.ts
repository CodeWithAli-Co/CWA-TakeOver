#!/usr/bin/env bun
/**
 * build-and-upload.ts
 *
 * Windows build + upload pipeline for a Tauri app driven by Bun.
 *
 * Flow:
 *   1. bun install
 *   2. bun run tauri build
 *   3. Locate the .sig signature file that matches the built .msi (parsed from build output)
 *   4. Read the signature file contents into a variable
 *   5. Locate the folder that contains the .msi installer (parsed from build output)
 *   6. Upload the .msi to a server using the Fetch API (signature sent alongside)
 *   7. Log progress / warnings / errors throughout
 *
 * Run with:  bun run build-and-upload.ts
 *
 * Note: literally `cd`-ing into a file isn't meaningful inside a script, so instead of
 * changing directories we resolve the absolute paths from the build output and read /
 * upload them directly. Every resolved path is logged so you can see exactly what was
 * picked.
 */

import { createClient } from "@supabase/supabase-js";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration  (override via environment variables)
// ---------------------------------------------------------------------------
const UPLOAD_URL = "https://www.takeover.systems/api/releases/upload";
// const UPLOAD_TOKEN = process.env.UPLOAD_TOKEN ?? ""; // optional bearer token
const PROJECT_DIR = process.env.PROJECT_DIR ?? process.cwd(); // dir holding package.json / src-tauri
const BUCKET = "takeover_downloads";
const VERSION_RE = /v?(?:\d{1,2}\.)+\d{1,2}/i;
// A commit subject that opens with a version tag, e.g. "v1.2.3 ...".
const VERSION_COMMIT_RE = /^(?:(?:release:|`)\s?)?v\d{1,2}(?:\.\d{1,2})+\b`?/i;

interface UploadTarget {
  path: string;
  token: string;
  signedUrl: string;
}
interface InitResponse {
  ok: boolean;
  executable: UploadTarget;
  manifest: UploadTarget;
  error?: string;
}

type UpdaterTarget = "windows" | "darwin" | "linux";

function detectTarget(fileName: string): UpdaterTarget {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".msi") || lower.endsWith(".exe")) return "windows";
  if (lower.endsWith(".dmg") || lower.endsWith(".app.tar.gz")) return "darwin";
  if (
    lower.endsWith(".appimage") ||
    lower.endsWith(".appimage.tar.gz") ||
    lower.endsWith(".deb") ||
    lower.endsWith(".rpm")
  ) {
    return "linux";
  }

  // Fall back to the OS the build ran on.
  switch (process.platform) {
    case "win32":
      return "windows";
    case "darwin":
      return "darwin";
    case "linux":
      return "linux";
    default:
      throw new Error(
        `Could not determine target for "${fileName}" (platform: ${process.platform}).`,
      );
  }
}

const CONTENT_TYPE_BY_TARGET: Record<UpdaterTarget, string> = {
  windows: "application/x-msi",
  darwin: "application/octet-stream",
  linux: "application/octet-stream",
};

// ── Platform / target selection ───────────────────────────────
interface BuildTarget {
  triple: string; // passed to `tauri build --target`
  host: NodeJS.Platform; // OS you must build on (no cross-compiling bundles)
  label: string;
}

// Keyed by CLI flag. Aliases point at the same triple.
const BUILD_TARGETS: Record<string, BuildTarget> = {
  // Windows — build on Windows
  "--windows": {
    triple: "x86_64-pc-windows-msvc",
    host: "win32",
    label: "Windows x64",
  },
  "--windows-x64": {
    triple: "x86_64-pc-windows-msvc",
    host: "win32",
    label: "Windows x64",
  },
  "--windows-arm": {
    triple: "aarch64-pc-windows-msvc",
    host: "win32",
    label: "Windows ARM64",
  },
  "--windows-x86": {
    triple: "i686-pc-windows-msvc",
    host: "win32",
    label: "Windows 32-bit",
  },

  // macOS — build on macOS
  "--mac": {
    triple: "universal-apple-darwin",
    host: "darwin",
    label: "macOS Universal",
  },
  "--mac-universal": {
    triple: "universal-apple-darwin",
    host: "darwin",
    label: "macOS Universal",
  },
  "--mac-arm": {
    triple: "aarch64-apple-darwin",
    host: "darwin",
    label: "macOS Apple Silicon",
  },
  "--mac-intel": {
    triple: "x86_64-apple-darwin",
    host: "darwin",
    label: "macOS Intel",
  },

  // Linux — build on Linux
  "--linux": {
    triple: "x86_64-unknown-linux-gnu",
    host: "linux",
    label: "Linux x64",
  },
  "--linux-x64": {
    triple: "x86_64-unknown-linux-gnu",
    host: "linux",
    label: "Linux x64",
  },
  "--linux-arm": {
    triple: "aarch64-unknown-linux-gnu",
    host: "linux",
    label: "Linux ARM64",
  },
};

const KNOWN_NON_TARGET = new Set(["--help"]); // extend if you add other flags

function platformList(): string {
  const seen = new Set<string>();
  const lines = Object.entries(BUILD_TARGETS)
    .filter(([, t]) => !seen.has(t.label) && seen.add(t.label)) // one line per label
    .map(
      ([flag, t]) =>
        `  ${flag.padEnd(16)} ${t.label} (${t.triple}, build on ${t.host})`,
    );
  return `Available platforms:\n${lines.join("\n")}\n  (no flag)        Build for the current host`;
}

/** Returns the chosen target, or null to build for the host with the default target. */
function resolveBuildTarget(): BuildTarget | null {
  const flags = process.argv.slice(2).filter((a) => a.startsWith("--"));

  if (flags.includes("--help")) {
    console.log(platformList());
    process.exit(0);
  }

  const targetFlags = flags.filter((f) => !KNOWN_NON_TARGET.has(f));
  if (targetFlags.length === 0) return null;

  const unknown = targetFlags.filter((f) => !(f in BUILD_TARGETS));
  if (unknown.length) {
    throw new Error(
      `Unknown platform flag(s): ${unknown.join(", ")}.\n${platformList()}`,
    );
  }

  // Collapse aliases to distinct triples; reject conflicting picks.
  const triples = [...new Set(targetFlags.map((f) => BUILD_TARGETS[f].triple))];
  if (triples.length > 1) {
    throw new Error(
      `Pick one platform per run, got: ${targetFlags.join(", ")}.`,
    );
  }

  const target = BUILD_TARGETS[targetFlags[0]];

  if (process.platform !== target.host) {
    throw new Error(
      `${target.label} must be built on "${target.host}", but you're on "${process.platform}". ` +
        `Tauri can't cross-compile bundles — run this on a ${target.host} machine or CI runner.`,
    );
  }
  return target;
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------
const ts = () => new Date().toISOString();
const log = {
  info: (m: string) => console.log(`\x1b[36m[INFO    ${ts()}]\x1b[0m ${m}`),
  success: (m: string) => console.log(`\x1b[32m[SUCCESS ${ts()}]\x1b[0m ${m}`),
  warn: (m: string) => console.warn(`\x1b[33m[WARN    ${ts()}]\x1b[0m ${m}`),
  error: (m: string) => console.error(`\x1b[31m[ERROR   ${ts()}]\x1b[0m ${m}`),
};

// ---------------------------------------------------------------------------
// Run a shell command, stream its output live, and return the captured output.
// ---------------------------------------------------------------------------
function runCommand(
  command: string,
  cwd: string = PROJECT_DIR,
): Promise<string> {
  return new Promise((resolve, reject) => {
    log.info(`Running: ${command}   (cwd: ${cwd})`);

    // shell: true is required on Windows so `bun` resolves to bun.exe / bun.cmd via PATH.
    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
    });

    let output = "";

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text); // mirror live so the build is visible
    });

    // cargo / tauri write a lot of their progress to stderr, so capture that too.
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stderr.write(text);
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code) => {
      if (code === 0) {
        log.success(`Finished: ${command}`);
        resolve(output);
      } else {
        reject(new Error(`Command failed (exit code ${code}): ${command}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Extract absolute artifact paths from build output. Cross-platform.
// Matches:
//   Windows: *.msi, *.exe, *.msi.sig, *.exe.sig    (C:\... paths)
//   macOS:   *.dmg, *.app.tar.gz(.sig)             (/Users/... paths)
//   Linux:   *.AppImage, *.deb, *.rpm, *.AppImage.tar.gz(.sig)
// `app.tar.gz` / `AppImage.tar.gz` come first in the alternation so the regex
// captures the full compound suffix instead of truncating at `.gz`.
// ---------------------------------------------------------------------------
function extractArtifactPaths(buildOutput: string): string[] {
  const windowsRe = /[A-Za-z]:\\[^\r\n"]*?\.(?:msi|exe)(?:\.sig)?/gi;
  const unixRe =
    /\/[^\r\n"]*?\.(?:app\.tar\.gz|AppImage\.tar\.gz|dmg|AppImage|deb|rpm)(?:\.sig)?/g;
  const found = [
    ...(buildOutput.match(windowsRe) ?? []),
    ...(buildOutput.match(unixRe) ?? []),
  ];
  return [...new Set(found.map((p) => p.trim()))]; // de-dupe, preserve order
}

// ---------------------------------------------------------------------------
// Pick the installer + its matching signature out of the detected paths.
// ---------------------------------------------------------------------------
function selectArtifacts(paths: string[]) {
  // Updater bundles -- these are what the Tauri auto-updater installs from.
  // They're the only files that ship with a matching .sig.
  //   Windows -> .msi (the .msi IS the updater bundle)
  //   macOS   -> .app.tar.gz (the .dmg is for first-install download only)
  //   Linux   -> .AppImage.tar.gz
  // We pick the updater bundle as the "installer" because that's the artifact
  // whose .sig the updater manifest must point at.
  const updaterExts =
    process.platform === "win32"
      ? [".msi"]
      : process.platform === "darwin"
        ? [".app.tar.gz"]
        : [".appimage.tar.gz"];

  const installerFiles = paths.filter((p) => {
    const lower = p.toLowerCase();
    return (
      updaterExts.some((ext) => lower.endsWith(ext)) && !lower.endsWith(".sig")
    );
  });
  const sigFiles = paths.filter((p) => p.toLowerCase().endsWith(".sig"));

  if (installerFiles.length === 0) {
    const exts = updaterExts.join(", ");
    throw new Error(
      `No updater bundle (${exts}) found in build output. ` +
        `Make sure tauri.conf.json has bundle.createUpdaterArtifacts = true and a signing key configured.`,
    );
  }
  if (installerFiles.length > 1) {
    log.warn(
      `Multiple installer files found, using the first:\n  ${installerFiles.join("\n  ")}`,
    );
  }

  const msiPath = installerFiles[0];
  const msiName = path.basename(msiPath);

  // The correct signature is the one named "<installer-file-name>.sig".
  const expectedSigName = `${msiName}.sig`.toLowerCase();
  const sigPath = sigFiles.find(
    (p) => path.basename(p).toLowerCase() === expectedSigName,
  );

  if (!sigPath) {
    const seen = sigFiles.map((p) => path.basename(p)).join(", ") || "none";
    throw new Error(
      `No signature matching "${msiName}.sig" found. Signatures seen: ${seen}`,
    );
  }

  // Version source: on macOS, the `.app.tar.gz` is named "TakeOver.app.tar.gz"
  // (no version), so we can't derive a version from it. The matching `.dmg`
  // (e.g. "TakeOver_1.8.1_aarch64.dmg") DOES carry the version -- prefer it
  // when present. Windows / Linux installers carry the version in-name already.
  const dmgPath = paths.find((p) => p.toLowerCase().endsWith(".dmg"));
  const versionSource = dmgPath ?? msiPath;

  return {
    msiPath,
    sigPath,
    executableDir: path.dirname(msiPath),
    versionSource,
  };
}

// ---------------------------------------------------------------------------
// Upload the installer (with its signature) via the Fetch API.
// ---------------------------------------------------------------------------
async function uploadInstaller(
  msiPath: string,
  signature: string,
  notes?: string,
  versionSource?: string,
): Promise<void> {
  const fileName = path.basename(msiPath);
  const fileBuffer = await readFile(msiPath);
  const sizeMb = (fileBuffer.byteLength / 1024 / 1024).toFixed(2);

  // Version drives the manifest path; must match what the server derives.
  // On macOS the .app.tar.gz has no version in its name -- versionSource
  // points at a sibling .dmg ("TakeOver_1.8.1_aarch64.dmg") instead.
  const versionFileName = path.basename(versionSource ?? msiPath);
  const derivedVersion = VERSION_RE.exec(versionFileName)?.[0];
  if (!derivedVersion) {
    throw new Error(`Could not derive a version from "${versionFileName}".`);
  }

  const version = `v${derivedVersion}`;

  // Which platform this artifact targets.
  const target = detectTarget(fileName);
  log.info(`Detected target: ${target}`);

  // 1. Ask our server for the two upload URLs (tiny JSON request — no body cap).
  log.info(`Requesting upload URLs for "${fileName}" (${sizeMb} MB)`);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "TakeOver-App": "true",
  };
  // if (UPLOAD_TOKEN) headers.Authorization = `Bearer ${UPLOAD_TOKEN}`;

  const initRes = await fetch(UPLOAD_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ filename: fileName, signature, notes, target }),
  });
  if (!initRes.ok) {
    throw new Error(
      `Could not get upload URLs: HTTP ${initRes.status}\n${await initRes.text()}`,
    );
  }
  const init = (await initRes.json()) as InitResponse;
  if (!init.ok || !init.executable?.token || !init.manifest?.token) {
    throw new Error(
      `Server returned no valid upload targets: ${JSON.stringify(init)}`,
    );
  }

  // 2. Upload the installer directly to storage (bypasses the function body cap).
  log.info(`Uploading installer → ${init.executable.path}`);
  const res = await fetch(
    `${import.meta.env.VITE_TAKEOVER_SITE_URL}/api/takeover_creds`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "TakeOver-App": "true",
      },
    },
  );
  const result = await res.json();
  const supabaseUrl = import.meta.env.VITE_DB_URL;
  const supabaseKey = result.supabase_key;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, storageKey: "sb-publish-auth" },
  });
  const exeUp = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(
      init.executable.path,
      init.executable.token,
      fileBuffer,
      {
        contentType: CONTENT_TYPE_BY_TARGET[target],
      },
    );
  if (exeUp.error)
    throw new Error(`Installer upload failed: ${exeUp.error.message}`);
  log.success(`Installer uploaded: ${init.executable.path}`);

  // 3. Build the release manifest the updater will read.
  const downloadUrl = supabase.storage
    .from(BUCKET)
    .getPublicUrl(init.executable.path).data.publicUrl;

  const manifest = {
    version,
    target, // record which platform this manifest is for
    signature,
    url: downloadUrl,
    notes: notes ?? "-",
    pub_date: new Date().toISOString(), // RFC 3339
  };
  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], {
    type: "application/json",
  });

  // 4. Upload release.json to its versioned path.
  log.info(`Uploading manifest → ${init.manifest.path}`);
  const manUp = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(init.manifest.path, init.manifest.token, manifestBlob, {
      contentType: "application/json",
    });
  if (manUp.error)
    throw new Error(`Manifest upload failed: ${manUp.error.message}`);
  log.success(`Manifest uploaded: ${init.manifest.path}`);
}

// ---------------------------------------------------------------------------
// Build release notes from the last N commit subjects (git log --oneline).
// Strips the short hash, turns each subject into a markdown bullet, and breaks
// any inline "- word" bullets onto their own lines.
// ---------------------------------------------------------------------------
async function getRecentCommitNotes(count = 5): Promise<string> {
  let raw: string;
  try {
    raw = await runCommand(`git log --oneline -${count}`);
  } catch (e) {
    log.warn(`Could not read git log: ${e instanceof Error ? e.message : e}`);
    return "-";
  }

  // Clean each line down to its commit subject (drop short hash + decorations).
  const subjects = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^\S+\s+(?:\([^)]*\)\s+)?/, ""))
    .filter(Boolean);

  if (subjects.length === 0) return "-";

  // If a release-style commit ("v1.2.3 ...") is present, that single message
  // IS the release note — use it alone and ignore the rest.
  const versioned = subjects.find((s) => VERSION_COMMIT_RE.test(s));
  if (versioned) {
    log.info(`Using versioned commit for notes: ${versioned}`);
    return versioned;
  }

  // Otherwise fall back to a bulleted list of recent subjects.
  const bullets = subjects.flatMap((msg) =>
    msg
      .split(/\s+-\s+/g)
      .map((part) => part.replace(/^-\s*/, "").trim())
      .filter(Boolean)
      .map((part) => `- ${part}`),
  );

  if (bullets.length === 0) return "-";
  return ["### What's new", "", ...bullets].join("\n");
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  log.info("Starting Tauri build & upload pipeline (Windows).");

  // Step 1
  await runCommand("bun install");

  // Step 2
  const target = resolveBuildTarget();
  if (target) log.info(`Building for: ${target.label} (${target.triple})`);
  const buildCmd = target
    ? `bun run tauri build --target ${target.triple}`
    : `bun run tauri build`;
  const buildOutput = await runCommand(buildCmd);

  // Steps 3 & 5: parse the artifact paths printed by the build.
  const paths = extractArtifactPaths(buildOutput);
  if (paths.length === 0) {
    throw new Error(
      "Could not find any artifact paths (.msi/.sig) in the build output.",
    );
  }
  log.info(`Artifact paths detected:\n  ${paths.join("\n  ")}`);

  const { msiPath, sigPath, executableDir, versionSource } =
    selectArtifacts(paths);
  log.success(`Matched installer:  ${msiPath}`);
  log.success(`Matched signature:  ${sigPath}`);
  log.info(`Executable folder:  ${executableDir}`);
  if (versionSource && versionSource !== msiPath) {
    log.info(`Version source:     ${path.basename(versionSource)}`);
  }

  // Step 4: read the signature file contents into a variable.
  log.info(`Reading signature file: ${sigPath}`);
  const signature = (await readFile(sigPath, "utf-8")).trim();
  if (!signature) {
    log.warn("Signature file is empty!");
  } else {
    log.success(`Signature loaded (${signature.length} chars).`);
  }

  // Step 5.5: build release notes from recent commits.
  const notes = await getRecentCommitNotes(5);
  log.info(`Release notes:\n${notes}`);

  // Step 6: upload the installer with the signature + notes.
  await uploadInstaller(msiPath, signature, notes, versionSource);

  log.success("Pipeline finished successfully.");
}

main().catch((err) => {
  log.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
