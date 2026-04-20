# CWA Registry — Architecture Guide

The **CWA Registry** is a private component + template store that lives
inside Takeover's own Supabase project. It replaces the standalone
`cwa-registry.vercel.app` service and its separate Supabase project,
consolidating everything into one backend to cut infrastructure cost
and unify auth/data with the rest of Takeover.

This document explains the whole system end-to-end: every file that
was touched, how the three pieces (Takeover UI, Edge Function, CLI)
talk to each other, and how the common user flows (login, publish,
install) travel through the stack.

---

## What is the registry?

Think of it as **your private npm + GitHub template repo, in one**.

A **component** is a reusable React piece (a sidebar, a data table, a
chart) that gets installed into a project under
`src/CWAComponents/<name>/`.

A **template** is a full project scaffold — you run
`cwa create <name>` and it creates a fresh directory with everything
wired up.

The registry **stores tarballs** (`.tgz`). It doesn't write, compile,
or preview code. You author in your IDE, the CLI packs the folder
into a tarball, uploads it, and another project's CLI downloads and
extracts it when needed.

Each named item has many **versions** (semver). Older versions stay
installable even after you publish newer ones — you can pin by
version when you install (`cwa add foo --version=1.2.3`).

Items carry a **company tag** (`cwa`, `simplicity`, or `shared`) so
devs on different companies see the right things. The CEO sees
everything.

---

## The three pieces

```
┌─────────────────────┐     ┌──────────────────────────┐     ┌──────────────────┐
│  CWA-CLI            │     │ Takeover Supabase        │     │ Takeover App     │
│  (Node.js binary)   │     │                          │     │ (Tauri desktop)  │
│                     │     │  ┌────────────────────┐  │     │                  │
│  cwa login          │────▶│  │ Edge Function      │  │     │  /components     │
│  cwa publish foo    │     │  │ registry-cli       │  │     │  route           │
│  cwa add foo        │     │  └─────────┬──────────┘  │     │                  │
│                     │     │            ↓             │     │  · Gallery       │
│  ~/.cwa/config.json │     │  ┌─────────────────────┐ │     │  · Detail drawer │
│  (token + endpoint) │     │  │ Postgres + Storage  │ │◀────│  · Publish modal │
└─────────────────────┘     │  │ registry_* tables   │ │     │  · CLI Tokens    │
                            │  │ 'registry' bucket   │ │     │                  │
                            │  └─────────────────────┘ │     └──────────────────┘
                            └──────────────────────────┘
```

1. **Takeover app** (React/Tauri/CWA-Manager repo) — UI for browsing
   the registry, publishing manually, generating CLI tokens. Talks
   to Supabase **directly** via the Supabase JS client (authenticated
   session from the app's existing login flow).

2. **Edge Function `registry-cli`** — the CLI's entry point. Validates
   PAT bearer tokens via the `validate_cli_token` RPC, then performs
   DB + storage ops using the service-role key. This is the security
   boundary: the CLI never sees the service-role key; it only has a
   PAT.

3. **CWA-CLI** (CWA-CLI repo) — Node binary that devs run in their
   terminal. Authenticates via `cwa login` which paste-prompts for a
   PAT, stores it at `~/.cwa/config.json`, and sends it as
   `Authorization: Bearer cwa_xxx` on every request.

---

## Schema

Four tables and one view live under `public` in Takeover's Supabase.
Migration file: **`migrations/registry_init.sql`**.

### `registry_items`
One row per named artifact. Carries soft metadata (description, tags,
company scope, cover image URL, latest-version pointer, install
count). The unique key is `(name, kind)` — so `foo/component` and
`foo/template` can coexist, but two components named `foo` cannot.

### `registry_versions`
Append-only version history. Every publish creates a new row.
`yanked` is the npm-style "hide from installs but keep for audit"
flag. References `registry_items.id` with `ON DELETE CASCADE`, so
removing an item purges all its versions.

### `registry_installs`
Best-effort install log. The CLI posts here whenever `cwa add` runs,
recording which user / machine / project installed which version.
Powers the future dependency-graph view. A trigger increments
`registry_items.install_count` on insert.

### `registry_tokens`
Personal-access tokens for the CLI. Only the sha256 **hash** of the
raw token is stored. The raw `cwa_xxx` value is shown exactly once
at creation time, then never again.

### `registry_items_with_latest` (view)
Joins `registry_items` with the latest non-yanked version via
`LEFT JOIN LATERAL`. The gallery reads from this view so one round
trip gives you name + kind + company + latest version + size.

### `validate_cli_token(raw_token)` RPC
SECURITY DEFINER function that bypasses RLS on `registry_tokens`.
Hashes the raw token, looks it up, bumps `last_used_at`, and returns
owner/scope only if valid + unexpired. Granted to `anon` so the Edge
Function can call it.

### Storage bucket `registry`
100 MiB per-file cap. Public read (anyone with a URL can pull a
tarball — that's fine since URLs are opaque UUID paths). Authenticated
write.

Files live at:
- `artifacts/<item_id>/<version>.tgz` — the tarballs
- `covers/<item_id>.(png|jpg|webp)` — optional cover images

### RLS
Wide-open for `authenticated` role. No role gating. The CEO has full
access; devs have full access. The security boundary is the CLI
token (hash-gated) and the Edge Function (proxies ops with
service-role so the CLI never holds dangerous keys).

---

## Data flow: `cwa login`

```
┌─────┐                      ┌──────────────┐                   ┌──────────┐
│ Dev │                      │ Takeover App │                   │ CLI      │
└──┬──┘                      └───────┬──────┘                   └─────┬────┘
   │                                 │                                │
   │ Open Takeover → /components     │                                │
   │ → CLI Tokens → "New token"      │                                │
   │────────────────────────────────▶│                                │
   │                                 │ useCreateRegistryToken()       │
   │                                 │ - generate 48-hex rawToken      │
   │                                 │ - sha256 → token_hash           │
   │                                 │ - INSERT registry_tokens        │
   │ ◀───── show raw token ONCE      │                                │
   │ (copy with 1 click)             │                                │
   │                                 │                                │
   │ Run `cwa login`                 │                                │
   │                                 │                                │
   │ Paste endpoint URL              │                                │
   │ Paste `cwa_xxx` token           │                                │
   │ ─────────────────────────────────────────────────────────────── ▶│
   │                                 │                                │ save
   │                                 │                                │ to
   │                                 │                                │ ~/.cwa/
   │                                 │                                │ config.json
   │                                 │                                │
   │                                 │                                │ GET
   │                                 │                                │ /whoami
   │                                 │                                │  │
   │                     ┌────────────────────────────────────────────┘
   │                     ▼
   │        ┌──────────────────────┐
   │        │ Edge Function        │
   │        │ rpc('validate_cli_   │
   │        │   token', raw)       │──→ UPDATE registry_tokens
   │        │ → {owner, scope}     │    SET last_used_at = now()
   │        └──────────┬───────────┘    WHERE token_hash = sha256(raw)
   │                   │                RETURNING owner, scope
   │                   ▼
   │ ◀── { owner: 'unfold', scope: 'full', server_version: '1.0.0' }
   │
   │ "✔ Logged in as unfold"
```

---

## Data flow: `cwa publish sidebar-nav`

```
┌─────┐                  ┌─────┐                  ┌─────────────┐      ┌──────────┐
│ Dev │                  │ CLI │                  │ Edge Fn     │      │ Postgres │
└──┬──┘                  └──┬──┘                  └──────┬──────┘      └────┬─────┘
   │ run in proj folder    │                            │                   │
   │──────────────────────▶│                            │                   │
   │                       │                            │                   │
   │                       │ GET /items/sidebar-nav?    │                   │
   │                       │   kind=component           │                   │
   │                       │───────────────────────────▶│                   │
   │                       │                            │ SELECT latest     │
   │                       │                            │ version           │──▶│
   │                       │                            │◀──                │   │
   │                       │◀── {latest_version: "1.0.0"}│                  │   │
   │                       │                            │                   │
   │                       │ Determine next: 1.0.0      │                   │
   │                       │ + patch bump = 1.0.1       │                   │
   │                       │                            │                   │
   │                       │ Pack ./ to .tgz            │                   │
   │                       │ (excludes node_modules,    │                   │
   │                       │  .git, dist, etc.)         │                   │
   │                       │                            │                   │
   │                       │ POST /publish (multipart)  │                   │
   │                       │ - name: sidebar-nav         │                   │
   │                       │ - kind: component           │                   │
   │                       │ - version: 1.0.1            │                   │
   │                       │ - tarball: <File>           │                   │
   │                       │───────────────────────────▶│                   │
   │                       │                            │ UPSERT item       │
   │                       │                            │ INSERT version    │──▶│
   │                       │                            │ Storage.upload    │
   │                       │                            │   artifacts/<id>/ │
   │                       │                            │   1.0.1.tgz       │
   │                       │                            │ UPDATE latest_ver │
   │                       │◀── {status, version, size} │                   │
   │                       │                            │                   │
   │                       │ Delete local .tgz          │                   │
   │◀── ✔ Published v1.0.1 │                            │                   │
```

**No more `setTimeout(unlink, 3000)` hacks** — the local tarball is
removed immediately after the upload promise resolves.

---

## Data flow: `cwa add sidebar-nav`

```
┌─────┐                  ┌─────┐                  ┌─────────────┐      ┌──────────┐
│ Dev │                  │ CLI │                  │ Edge Fn     │      │ Storage  │
└──┬──┘                  └──┬──┘                  └──────┬──────┘      └────┬─────┘
   │                       │                            │                   │
   │                       │ GET /download/sidebar-nav? │                   │
   │                       │   kind=component           │                   │
   │                       │───────────────────────────▶│                   │
   │                       │                            │ look up latest    │
   │                       │                            │ build public URL  │
   │                       │◀── 302 Location: <pubUrl> ─│                   │
   │                       │                            │                   │
   │                       │ (auto-follow redirect)                         │
   │                       │ GET <pubUrl> ─────────────────────────────────▶│
   │                       │◀── <tarball stream> ───────────────────────────│
   │                       │                            │                   │
   │                       │ Stream → OS tmpdir         │                   │
   │                       │ Extract → src/CWAComponents/sidebar-nav/       │
   │                       │                            │                   │
   │                       │ POST /install-log          │                   │
   │                       │   (fire-and-forget)        │                   │
   │                       │───────────────────────────▶│                   │
   │                       │                            │ INSERT install row│
   │                       │                            │ trigger bumps     │
   │                       │                            │ install_count     │
   │                       │                            │                   │
   │◀── ✔ Installed v1.0.1 │                            │                   │
```

Public bucket means the actual download is a direct object-storage
hit — no Edge Function CPU spent on the tarball bytes. The redirect
is the only thing the function does for reads.

---

## Security model

- **Service-role key** lives only in the Edge Function env. Never
  ships to the CLI.
- **Raw tokens** (`cwa_xxx`) exist for exactly two moments:
    1. The instant the "Generate new token" modal shows it in
       Takeover (user copies immediately or it's gone).
    2. On the user's laptop at `~/.cwa/config.json` (0600 perms).
- **Only hashes** (sha256 hex) are stored in the DB.
- **Token validation** is a SECURITY DEFINER RPC — the `anon` role
  the Edge Function uses can invoke it but cannot SELECT from
  `registry_tokens` directly.
- **Revocation** is instant: delete the row in the UI → the hash no
  longer matches → next CLI request returns 401.
- **Expiry** is built in (`expires_at`) but unused by default.
- **No rate limiting yet** — relies on Supabase's per-function
  limits. Worth adding per-token throttling in Phase 6.

---

## File-by-file map

### Takeover (CWA-Manager repo)

| File | What it does | New/Modified |
|------|--------------|--------------|
| `migrations/registry_init.sql` | Schema: 4 tables + view + RPC + storage bucket + RLS | **New** |
| `supabase/functions/registry-cli/index.ts` | Edge Function — validates PATs, proxies all CLI ops | **New** |
| `src/MyComponents/Registry/types.ts` | TS types mirroring schema + row-to-camelCase mappers + semver helpers | **New** |
| `src/MyComponents/Registry/queries.ts` | TanStack Query hooks for list/get/publish/yank/delete/tokens | **New** |
| `src/MyComponents/Registry/RegistryDashboard.tsx` | Gallery shell — header, filter tabs, company chip, Registry/Tokens toggle | **New** |
| `src/MyComponents/Registry/RegistryItemCard.tsx` | Individual gallery tile (cover, kind chip, company badge, install count) | **New** |
| `src/MyComponents/Registry/RegistryDetailDrawer.tsx` | Right-side drawer with Overview/Versions/Install tabs | **New** |
| `src/MyComponents/Registry/RegistryPublishModal.tsx` | Draggable publish modal (flex-center + framer-motion `useDragControls`) | **New** |
| `src/MyComponents/Registry/CliTokensCard.tsx` | PAT management — list, generate (one-time reveal), revoke | **New** |
| `src/routes/components.lazy.tsx` | TanStack Router route entry — no role gate | **New** |
| `src/components/ui/Dashboard/role-datas.tsx` | Added "Components" nav entry with Package icon to CEO/COO/CFO sidebars | Modified |

### CLI (CWA-CLI repo)

| File | What it does | New/Modified |
|------|--------------|--------------|
| `src/cwa.ts` | Commander entry + figlet banner. Wires every command | **Rewritten** |
| `src/config.ts` | `~/.cwa/config.json` load/save with env-var overrides | **New** |
| `src/api.ts` | `fetch` wrapper with bearer auth, `ApiError` with friendly hints | **New** |
| `src/ui.ts` | Spinner, `prompt`, `promptHidden` (for token paste), chalk formatters | **New** |
| `src/archive.ts` | `packDirectory` + `extractTarball` — proper async, no setTimeout hacks | **New** |
| `src/commands/login.ts` | Paste-PAT flow → validate via `/whoami` → persist | **New** |
| `src/commands/logout.ts` | Wipe token, keep endpoint | **New** |
| `src/commands/whoami.ts` | Roundtrip check | **New** |
| `src/commands/ls.ts` | Two-column table output (preserves old CLI format) | **New** |
| `src/commands/info.ts` | Full version history + changelog display | **New** |
| `src/commands/create.ts` | Scaffold project from template | **New** |
| `src/commands/publish.ts` | Pack + upload as template with semver bumping | **New** |
| `src/commands/add.ts` | Install component + log usage | **New** |
| `src/commands/store.ts` | Pack component folder + publish as kind=component | **New** |
| `src/commands/del.ts` | Shared delete for templates + components | **New** |
| `package.json` | Bumped to 2.0.0, tsc flags, removed `@types/prompt-sync` | Modified |
| `tsconfig.json` | Target es2022 + DOM lib + skipLibCheck | Modified |

### Old Componentizer (CWA-Componentizer repo)

Not touched in this phase. Will be retired in Phase 4+ — its
"saved-components" folder convention is preserved by
`cwa store`'s folder auto-detection.

---

## Endpoint map

Every route on the Edge Function is authed via Bearer token:

| Method | Path | What it does |
|--------|------|--------------|
| `GET` | `/whoami` | Returns `{owner, scope, server_version}` |
| `GET` | `/items?kind=&company=&search=` | List registry items (latest versions) |
| `GET` | `/items/:name?kind=` | One item + full version history |
| `GET` | `/download/:name?kind=&version=` | 302 redirect to the public tarball URL |
| `POST` | `/publish` | Multipart: upload tarball + create/bump version |
| `DELETE` | `/items/:name?kind=` | Remove item + all versions + storage objects |
| `POST` | `/install-log` | Best-effort usage logging from `cwa add` |

---

## Running it

### Deploy schema
```bash
# In Supabase SQL editor, paste migrations/registry_init.sql
# Safe to re-run — everything is IF NOT EXISTS / CREATE OR REPLACE.
```

### Deploy Edge Function
```bash
cd CWA-Manager
supabase functions deploy registry-cli --no-verify-jwt
```
`--no-verify-jwt` is essential. The function does its own bearer
validation via the PAT hash comparison — Supabase's built-in JWT
check would reject the `cwa_xxx` format.

### Build CLI
```bash
cd CWA-CLI
bun install
bun run build
# Optional: package as a standalone exe
bun run package   # Deno-based compile → cwa.exe
```

### First login
1. Open Takeover → Components → toggle to **CLI Tokens** → **New token**
2. Label it ("laptop", "ci", whatever) → Generate → Copy
3. Terminal: `cwa login`
4. Paste endpoint URL: `https://<project-ref>.supabase.co/functions/v1/registry-cli`
5. Paste the `cwa_xxx` token
6. See `✔ Logged in as <username>`

### Daily usage
```bash
# From any project folder:
cwa publish sidebar-nav --company=cwa --tags=nav,sidebar --description="Primary navigation"

# From another project:
cwa add sidebar-nav
# installs into src/CWAComponents/sidebar-nav/

# Discover what's available:
cwa ls
cwa info sidebar-nav --kind=component

# Version control:
cwa publish sidebar-nav --bump=minor   # 1.0.5 → 1.1.0
cwa publish sidebar-nav --version=2.0.0-beta
cwa add sidebar-nav --version=1.0.5    # pin to specific
```

---

## Phase history

- **Phase 1** — Schema + storage bucket
- **Phase 2** — Types + query hooks
- **Phase 2b** — Gallery + Detail drawer
- **Phase 2c** — Publish modal (with drag + flex-center fix)
- **Phase 3** — Edge Function + CLI rewrite + PAT auth (**this phase**)
- **Phase 3b** — CLI enhancements: `cwa search`, `cwa update`, lockfile, shell completions *(pending)*
- **Phase 4** — Migration script: pull old `cwa-registry.vercel.app` data → new registry *(pending)*
- **Phase 5** — Axon voice actions: `publish_component`, `install_component`, `search_registry` *(pending)*
- **Phase 6** — Live iframe preview, version diff, install dependency graph, fork flow *(pending)*

---

## Design decisions + trade-offs

**Why paste-token instead of OAuth?**
Takeover is a desktop-only Tauri app with no public web origin. OAuth
needs a redirect URI that both sides trust; the easiest equivalent in
a desktop-only world is a short-lived device code flow, which adds
schema + polling for a UX that's barely better than paste. Paste
works and is one `copy` click.

**Why an Edge Function instead of the CLI talking to Supabase
directly?**
Direct talk requires either (a) a public Supabase anon key with wide
RLS access (anyone with the binary becomes an admin), or (b) a
per-user signed JWT the CLI can obtain. The Edge Function proxy
keeps the service-role key server-side, authenticates via PAT hash
comparison, and centralizes audit logging. It's one network hop of
overhead in exchange for a sound security boundary.

**Why one unified `registry_items` table with a `kind` discriminator?**
The old backend had separate `/templates` and `/components` endpoints.
They share 95% of the schema and 100% of the lifecycle (publish, yank,
version, search). One table with a `kind` column halves the query
surface, makes the gallery a single list, and gives us `cwa ls` as one
query instead of two.

**Why soft company-scoping instead of RLS-enforced?**
The CEO needs to see everything across CWA and Simplicity. RLS-enforced
per-company would require user_id → company lookups on every query,
and the CEO would need a special bypass path. Soft scoping (filter in
the UI/CLI) is simpler; there's no actual data-segregation requirement
between these two companies the CEO owns both of.

**Why public storage bucket?**
Tarball URLs are opaque UUID paths (`artifacts/<uuid>/<ver>.tgz`) — not
guessable. Keeping the bucket public means `cwa add` downloads are
direct object-storage hits (cheap, fast, no Edge Function CPU). If
you need private tarballs later, swap `getPublicUrl` for
`createSignedUrl(path, 60)` in the Edge Function's download handler.

**Why `setTimeout` was a bug.**
The old CLI did:
```ts
tar.x({ file: `${name}.tgz` });
setTimeout(() => fs.unlinkSync(`${name}.tgz`), 3000);
```
The 3-second window was a guess at how long extraction would take.
On slow networks or big tarballs it could race. The rewrite awaits
`tar.x` (now returns a promise) and deletes the moment it resolves.

---

## What's not in this phase

- Shell completion (bash/zsh/pwsh) — Phase 3b
- `cwa search` / `cwa update` — Phase 3b
- `cwa.lock.json` per-project version pinning — Phase 3b
- Automatic migration from old `cwa-registry.vercel.app` — Phase 4
- Axon voice-driven registry ops — Phase 5
- Live iframe preview, version diff viewer — Phase 6

Each of the above has a tracked task and will ship independently.
