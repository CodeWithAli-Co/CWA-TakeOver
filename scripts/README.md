# CWA-Manager — scripts

One-shot operational scripts. Not part of the app build; run directly
with `bun` (or `node --experimental-strip-types`).

## migrate-registry.ts

Pulls every template + component from the old
`cwa-registry.vercel.app` backend and re-publishes each into
Takeover's new registry.

Everything lands at **version 1.0.0** under the company scope you
pick (default `cwa`). Items already present on the new registry are
skipped, so the script is safe to re-run.

### Prerequisites
1. New Takeover Supabase has the `registry_*` tables (run
   `migrations/registry_init.sql`).
2. Edge Function `registry-cli` is deployed:
   ```bash
   supabase functions deploy registry-cli --no-verify-jwt
   ```
3. You have a CLI token from Takeover → Components → CLI Tokens.

### Dry run first
See what would migrate without writing anything:
```bash
bun run scripts/migrate-registry.ts \
  --new-endpoint https://<ref>.supabase.co/functions/v1/registry-cli \
  --dry-run
```

### Real run
```bash
bun run scripts/migrate-registry.ts \
  --new-endpoint https://<ref>.supabase.co/functions/v1/registry-cli \
  --token cwa_xxx...
```

### Flags
| Flag | Default | Purpose |
|------|---------|---------|
| `--old-url <url>` | `https://cwa-registry.vercel.app` | Old registry to pull from |
| `--new-endpoint <url>` | `$CWA_ENDPOINT` | New Edge Function URL |
| `--token <cwa_xxx>` | `$CWA_TOKEN` | CLI bearer token |
| `--company <scope>` | `cwa` | `cwa`, `simplicity`, or `shared` |
| `--only <kind>` | `both` | `component`, `template`, or `both` |
| `--dry-run` | off | List plan, write nothing |
| `--concurrency <n>` | `3` | Parallel migrations |

### After migration
- Open Takeover → `/components` to eyeball the gallery.
- Re-tag any items that should be `simplicity` or `shared` via the
  detail drawer → Overview tab.
- Once verified, you can shut down the old `cwa-registry.vercel.app`
  Vercel project and its separate Supabase.

---

## import-from-componentizer.ts

Use this when the old `cwa-registry.vercel.app` backend is dead
(Supabase project deleted, Vercel app removed) but you still have
the component source code locally in your CWA-Componentizer repo.

Walks `<componentizer>/src/saved-components/*`, packs each folder
into a `.tgz`, publishes to the new Takeover registry as a
component at version 1.0.0.

### Run (dry-run first)
```bash
set CWA_ENDPOINT=https://<ref>.supabase.co/functions/v1/registry-cli
bun run scripts/import-from-componentizer.ts ^
  --componentizer-dir "C:\Users\Ali\OneDrive\Desktop\CWA-Componentizer" ^
  --dry-run
```

### Real run
```bash
set CWA_ENDPOINT=https://<ref>.supabase.co/functions/v1/registry-cli
set CWA_TOKEN=cwa_xxx
bun run scripts/import-from-componentizer.ts ^
  --componentizer-dir "C:\Users\Ali\OneDrive\Desktop\CWA-Componentizer"
```

(Windows cmd line-continuation is `^`; on bash/zsh use `\`.)

### Flags
| Flag | Default | Purpose |
|------|---------|---------|
| `--componentizer-dir <path>` | *(required)* | Root of CWA-Componentizer repo |
| `--new-endpoint <url>` | `$CWA_ENDPOINT` | New Edge Function URL |
| `--token <cwa_xxx>` | `$CWA_TOKEN` | CLI bearer token |
| `--company <scope>` | `cwa` | `cwa`, `simplicity`, or `shared` |
| `--only <a,b,c>` | all | Comma-list of folder names to limit import |
| `--dry-run` | off | List plan only, write nothing |
| `--concurrency <n>` | `3` | Parallel uploads |

### Naming
Componentizer folders are PascalCase (`CWASidebar`,
`AdminTabs`). The script kebab-cases them for registry names:

| Folder | Registry name |
|--------|---------------|
| `AdminTabs` | `admin-tabs` |
| `CWASidebar` | `cwa-sidebar` |
| `ModeToggle` | `mode-toggle` |
| `BGParticle` | `bg-particle` |

After import the names on the registry are kebab-case; if you don't
like how any of them translated, delete + re-publish with a custom
`cwa store <preferred-name>`.

### After
- Verify in Takeover `/components`.
- For components that need a cover image, open the detail drawer →
  Overview → edit and upload.
- Re-tag any that aren't CWA-scoped via the company pill in the
  detail drawer.
