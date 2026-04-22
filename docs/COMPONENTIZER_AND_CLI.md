# Componentizer import + CWA-CLI — operator guide

This document covers two related pieces of the registry ecosystem:

1. **How we rescued the CWA-Componentizer contents** — the
   `import-from-componentizer.ts` script that walks the local
   Componentizer repo and publishes every saved component into
   Takeover's registry.
2. **How the new CWA-CLI is installed and run** — what each command
   does, what flags it takes, and what happens server-side.

For the registry's overall architecture (schema, RLS, Edge
Function, Axon voice actions), see `REGISTRY_ARCHITECTURE.md`.
This doc is the practical "I need to pull stuff from the old
componentizer, and I want to know what each CLI command does"
guide.

---

## 1. Background — why this exists

Before Takeover, components lived in a separate service:
`cwa-registry.vercel.app` + its own Supabase project. The old
registry was deleted before we could migrate. All that remained
was the local **CWA-Componentizer** folder — the CEO's dev-local
project that served as the source-of-truth for component source
code (`src/saved-components/<Name>/` folders).

Takeover shipped a new registry built into its own Supabase
project, with a Supabase Edge Function (`registry-cli`) as the
CLI's backend. We needed a one-time import to pull every saved
component out of the Componentizer folder and upload it into the
new registry.

---

## 2. The import script

**Location**: `CWA-Manager/scripts/import-from-componentizer.ts`

### What it does, step by step

1. Reads the Componentizer root path from `--componentizer-dir`.
2. Walks `src/saved-components/` and treats each subdirectory as
   one component (e.g. `saved-components/DataTable/`).
3. For each candidate folder:
   a. Checks for a `package.json` (required; that's what the CLI
      packs against)
   b. Runs `npm pack` in a temp directory to produce a `.tgz`
   c. POSTs the tarball to the `registry-cli` Edge Function's
      `/publish` endpoint with the CEO's CLI token
   d. Marks the item as `kind=component`, sets company scope
      (default `cwa`)
4. Reports per-item success/failure and exits with a summary.

### Required flags

| Flag | Purpose |
|---|---|
| `--componentizer-dir <path>` | Root of the CWA-Componentizer repo |
| `--new-endpoint <url>` or `CWA_ENDPOINT` env | The `registry-cli` Edge Function URL |
| `--token <cwa_xxx>` or `CWA_TOKEN` env | A personal access token generated in Takeover |

### Optional flags

| Flag | Default | Purpose |
|---|---|---|
| `--company <scope>` | `cwa` | Tag items with `cwa`, `simplicity`, or `shared` |
| `--only <a,b,c>` | (all) | Comma-separated filter to import a subset |
| `--concurrency <n>` | `3` | Parallel uploads |
| `--dry-run` | off | Lists what would be imported; does nothing |

### How it was actually run

```bash
# One-time rescue import. Dry-run first to confirm the list:
bun run scripts/import-from-componentizer.ts \
  --componentizer-dir "C:/Dev/Python GitHub/CWA-Componentizer" \
  --dry-run

# Then for real:
set CWA_ENDPOINT=https://<takeover-ref>.supabase.co/functions/v1/registry-cli
set CWA_TOKEN=cwa_xxxxxxxx
bun run scripts/import-from-componentizer.ts \
  --componentizer-dir "C:/Dev/Python GitHub/CWA-Componentizer"
```

### Why this script and not `migrate-registry.ts`

There's a sibling script `scripts/migrate-registry.ts` designed to
pull from the **old Supabase registry project** via its Edge
Function and re-publish into the new one. That only works if the
old registry is still running. Since `cwa-registry.vercel.app`
and its DB were gone, `migrate-registry.ts` couldn't reach
anything — the import script was written as the fallback that
operates purely on local disk.

If you ever spin up a similar project in the future and it still
has a live backend, `migrate-registry.ts` is the simpler path —
same destination endpoint, just pulling from a remote source of
truth.

### When to re-run it

The import is idempotent at the version level. If a component
hasn't changed, re-running does nothing. If you've edited a
component in the Componentizer folder and bumped its version in
`package.json`, re-running publishes the new version.

For active day-to-day publishing, don't re-run this script —
use `cwa store` (see below). The import is for bulk one-shot
imports only.

---

## 3. The CWA-CLI

**Location**: separate repo, `C:/Dev/Python GitHub/CWA-CLI`
**Binary**: `cwa` (global after `bun link`)
**Version**: 2.0.0

The CLI is a Node/Bun CLI that speaks to the `registry-cli` Edge
Function. It replaces the old `cwa-registry.vercel.app`-era CLI
with a modern, authenticated, versioned workflow.

### ⚠️ Upgrading from the old CWA-CLI

If you've used the CLI before (anything 1.x that pointed at
`cwa-registry.vercel.app`), you MUST fully uninstall it before
the new one works. The old binary is also called `cwa`, so
whichever one resolves first on `PATH` wins — and if the old one
still resolves, every command will try to hit a dead server and
fail with network errors that look cryptic.

**Step 1 — figure out what you have installed:**

```bash
# Is `cwa` resolving anywhere?
which cwa         # macOS / Linux / Git Bash
where cwa         # cmd / PowerShell

# What version?
cwa --version
# If this prints anything less than 2.0.0, it's the old one.
```

**Step 2 — uninstall the old one.** It was likely installed with
`npm -g` or `bun add -g` in the old days. Try each, in order,
until `where cwa` returns nothing:

```bash
# If it was an npm global install:
npm uninstall -g cwa-cli
npm uninstall -g cwa

# If it was a bun global install:
bun remove -g cwa-cli
bun remove -g cwa

# If bun link was used against the old repo:
cd <old cwa-cli folder>
bun unlink
```

If `where cwa` STILL returns a path, delete the binary at that
path by hand. On Windows it'll usually be
`%APPDATA%\npm\cwa.cmd` or `%USERPROFILE%\.bun\bin\cwa.exe`. On
macOS/Linux it's under `/usr/local/bin/cwa` or
`~/.bun/bin/cwa`. Nuke it.

**Step 3 — wipe the old config.** The old CLI stored its
endpoint + token in the same `~/.cwa/config.json`, but the
endpoint value pointed at `cwa-registry.vercel.app`. If you
leave it there, `cwa doctor` will try to reach a dead host on
every run.

```bash
# Windows (cmd):
del "%USERPROFILE%\.cwa\config.json"

# macOS / Linux:
rm ~/.cwa/config.json
```

**Step 4 — clone + install the new CLI.**

```bash
git clone <the new CWA-CLI repo URL>  C:/Dev/Python\ GitHub/CWA-CLI
cd C:/Dev/Python\ GitHub/CWA-CLI
bun install
bun run build
bun link
bun link cwa-cli
```

**Step 5 — verify.**

```bash
cwa --version    # → 2.0.0
cwa login        # paste a fresh PAT from Takeover
cwa doctor       # should print all green checks
```

If `cwa --version` still shows an old number after step 5, step 2
didn't fully remove the old binary — go back, check `where cwa`
again, and delete whatever's still there.

### First-time install (no old CLI on the machine)

From inside the `CWA-CLI` folder:

```bash
# One-time install:
bun install          # install deps
bun run build        # compile TypeScript to dist/
bun link             # register the bin globally
bun link cwa-cli     # link the package from wherever you run `cwa`

# Sanity check:
cwa --version        # prints 2.0.0
cwa --help           # lists all commands
```

After install, `cwa` is available in any terminal. It reads its
configuration (endpoint + token) from `~/.cwa/config.json`
(mode 0600 — not readable by other users on the machine).

### Pulling updates

To update the CLI after pulling new changes:

```bash
cd C:/Dev/Python\ GitHub/CWA-CLI
git pull
bun install
bun run build
# No re-link needed — bun link uses symlinks, so rebuild is enough.
```

### First-time setup

```bash
cwa login          # paste a PAT generated in Takeover → Components → CLI Tokens
cwa whoami         # verify the token works
cwa doctor         # full health check
```

---

## 4. Command reference

Every command. Grouped by what you'd use them for.

### Authentication + identity

| Command | What it does |
|---|---|
| `cwa login` | Prompts for the endpoint URL (with a sensible default) + a paste-in personal access token (PAT). Validates against the server by calling a whoami-style check. Persists to `~/.cwa/config.json`. |
| `cwa logout` | Wipes the stored token. Leaves the endpoint URL cached so re-login doesn't re-ask. |
| `cwa whoami` | Round-trips to the server and prints your identity in a clean key-value block: username, role, company scope, token expiry, endpoint. |

Why paste-in tokens instead of OAuth: the CLI is desktop-only
and there's no web origin to redirect to. You generate a PAT in
Takeover's UI (Components → CLI Tokens), copy it once, paste it
into `cwa login`, done.

### Discovery

| Command | What it does |
|---|---|
| `cwa ls` | Lists everything in the registry. No filters → two-column layout (templates on the left, components on the right). Filter flags: `--templates`, `--components`, `--search <q>`, `--company <scope>`, `--mine`. |
| `cwa search <query>` | Fuzzy-ish search across names + descriptions. Shows *why* each result matched (by highlighting matched substrings). Thin wrapper over `ls --search` with result-formatting tuned for search. |
| `cwa info <name>` | Detail view for one item — metadata table + version list (latest first, shows install count + publisher for each). |

### Installing

| Command | What it does |
|---|---|
| `cwa create <template>` | Scaffold a new project from a template. Prompts for project name, downloads the tarball, extracts into a new directory, strips `.git` so you start fresh. |
| `cwa add <name> [<name>...]` | Install one or more components into the CURRENT project's `src/CWAComponents/<name>/`. Multi-install runs with bounded concurrency. Per-component: downloads tarball, wipes any existing install at that path, extracts, writes a `.cwa.json` receipt with version + installed-at + source-endpoint metadata. |
| `cwa update [<name>]` | Walk `src/CWAComponents/`, check the registry for newer versions of each installed component, and upgrade anything out of date. Pass a name to update just one. Reads each component's `.cwa.json` receipt to know current version. |
| `cwa init` | Interactive wizard: pick a template from a numbered list, enter project name, optionally pre-install a set of starter components in one go. Wraps `create` + `add` with a nicer flow for first-time project setup. |

### Publishing

| Command | What it does |
|---|---|
| `cwa publish <name>` | Pack the CURRENT directory as a `.tgz` (via `npm pack`) and upload as a **template**. Creates the item if new, or pushes a new version if it exists. Flags: `--bump patch\|minor\|major` (default `patch`), `--version <exact>`, `--description <str>`, `--company <scope>`, `--dry-run`. |
| `cwa store <name>` | Publish a **component** instead. Walks into `src/saved-components/<name>/` (to match the old CLI's folder convention), packs that, uploads as `kind=component`. All other flags identical to `publish`. |
| `cwa delete <template>` | Delete a template from the registry (auth-gated to its publisher / CEO). |
| `cwa remove <component>` | Same as `delete` but aliased for the component naming convention. Both call the same backend DELETE endpoint. |

### Diagnostics

| Command | What it does |
|---|---|
| `cwa doctor` | Full health check. Tests: (1) config file readable, (2) endpoint reachable, (3) token valid, (4) whoami round-trip, (5) `registry-cli` reports OK, (6) current dir is a valid project if applicable. Prints a pass/fail table with actionable hints on any failure. Exit code = number of failed checks (capped at 255) — use this in CI. |
| `cwa completion <shell>` | Emit a completion script to stdout for `bash`, `zsh`, or `pwsh`. Eval/source into your shell config for tab-completion of command names, flags, and (where possible) item names pulled from the registry. |

### Global flags

Supported on most commands:

| Flag | Effect |
|---|---|
| `--json` | Machine-readable JSON output instead of the pretty CLI view. For scripting. |
| `--quiet` | Suppress chatty progress output; print only the final result. |
| `--verbose` | Extra detail on every HTTP call, file op, and backend response. Debug first. |
| `--endpoint <url>` | Override `~/.cwa/config.json` endpoint for one invocation. Useful when testing against a local Edge Function. |
| `--token <cwa_xxx>` | Override the stored token. |

---

## 5. How the CLI talks to the backend

Every command (other than `login` / `logout` / `completion`)
makes a POST or GET to
`https://<project-ref>.supabase.co/functions/v1/registry-cli`
with headers:

```
Authorization: Bearer <the personal-access token>
x-cwa-cli-version: 2.0.0
```

The Edge Function verifies the PAT against a `cli_tokens` table
in Takeover's Supabase, then handles the request with
service-role access. Sub-routes:

- `POST /publish` — upload a tarball (multipart form) + metadata
- `GET /items` — list, with `?kind=`, `?search=`, `?company=`
- `GET /items/:name` — detail view
- `GET /items/:name/versions/:version/tarball` — download
- `DELETE /items/:name` — remove (versioned or whole item)
- `GET /whoami` — validate the token + return identity

The CLI itself never touches Supabase directly. The Edge Function
is the only boundary into the DB, which keeps secrets and RLS
concerns behind one controlled surface.

---

## 6. Common recipes

### "I edited a component in Componentizer — how do I get it into the registry?"

```bash
# Option A: From the component's own folder
cd src/saved-components/DataTable
cwa store DataTable --bump minor

# Option B: Re-run the bulk import (picks up version bumps)
cd C:/Dev/Python\ GitHub/CWA-Manager
bun run scripts/import-from-componentizer.ts \
  --componentizer-dir "C:/Dev/Python GitHub/CWA-Componentizer" \
  --only DataTable
```

### "I want to start a new project from a template"

```bash
cwa init
# → pick template, enter name, optionally pick starter components
```

Or the non-interactive path:

```bash
cwa create my-template
cd my-new-project
cwa add Sidebar ChatLayout Presence   # multi-install
```

### "Bring everything up to date after a sprint"

```bash
cd my-project
cwa update        # upgrades every installed component
```

### "A component broke after update — how do I roll back?"

```bash
# List the versions
cwa info Sidebar
# Pick the one you want
cwa add Sidebar --version=1.2.0
```

### "I'm in CI — how do I fail the build if the registry is unhealthy?"

```bash
cwa doctor --quiet
# Exit code = number of failed checks. 0 = pass.
```

---

## 7. Files and paths — where things live

### Inside CWA-Manager (Takeover)

- `scripts/import-from-componentizer.ts` — bulk-import script
- `scripts/migrate-registry.ts` — cross-backend migration (mostly
  historical at this point; retained for future projects)
- `supabase/functions/registry-cli/` — Edge Function source
- `src/routes/components.lazy.tsx` — web UI for browsing + managing
- `migrations/registry_*.sql` — schema + RLS policies

### Inside CWA-CLI (separate repo)

- `src/cwa.ts` — entry point, Commander setup
- `src/commands/*.ts` — one file per command
- `src/api.ts` — thin HTTP layer over the Edge Function
- `src/config.ts` — read/write `~/.cwa/config.json`
- `src/archive.ts` — tarball packing/unpacking
- `src/ui.ts` — colored output helpers
- `CAPABILITIES.md` — authoritative feature list
- `package.json` → `"bin": { "cwa": "./dist/cwa.js" }`

### On the user's machine after install

- `~/.cwa/config.json` (mode 0600) — endpoint + token
- `~/.cwa/cache/` — occasionally-used tarball cache for fast
  re-installs
- `./src/CWAComponents/<name>/` in each project — installed
  components
- `./src/CWAComponents/<name>/.cwa.json` — per-component
  install receipt

---

## 8. Things that don't exist yet

- **Cross-machine token sync** — if you get a new laptop you
  re-run `cwa login` and paste a fresh PAT.
- **Team scopes beyond cwa/simplicity/shared** — if another
  brand is added, the Edge Function's company enum needs a
  migration.
- **Install receipts with integrity hashes** — `.cwa.json` has
  the version, not the tarball SHA. If it becomes useful for
  tamper-detection, extend the publish + add paths.
- **Offline mode** — the CLI always hits the Edge Function. No
  local mirror/caching for air-gapped usage.

Any of these are small follow-ups if a real need materializes.
