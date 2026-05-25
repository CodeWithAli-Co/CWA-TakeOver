# CODE MODULE

GitHub-style code surface for AI-attributed repositories. Lives at `/code` in
the app shell; reads come from Supabase with graceful fallback to seeded
mock data so the UI never goes blank.

This file tracks every change that has shipped to the module so far, plus
the next-step backlog. Keep it updated as new pieces land.

---

## Table of contents

1. [What it is](#what-it-is)
2. [Architecture at a glance](#architecture-at-a-glance)
3. [Files in the module](#files-in-the-module)
4. [Database schema](#database-schema)
5. [Query layer (queries.ts)](#query-layer-queriests)
6. [UI surfaces](#ui-surfaces)
7. [Editor + save flow](#editor--save-flow)
8. [Activation steps](#activation-steps)
9. [Change log](#change-log)
10. [Backlog](#backlog)
11. [Known gotchas](#known-gotchas)

---

## What it is

`/code` is the in-app GitHub clone. Every commit, PR, issue, and code-action
is first-class data attached to one of three AI agents (Architect / Engineer
/ Critic) or to a human author. The page is dense, theme-aware, and lean —
no wasted padding, no spinner-first loading states.

Primary modules:

- A **dashboard** that lists repos as cards with language breakdown + open-PR
  count + activity heat, plus a live AI-activity rail on the right.
- A **repo view** with the GitHub 6-tab nav (Code / Issues / Pulls / Actions
  / Insights / Settings).
- A **PR detail view** with Conversation / Commits / Files Changed sub-tabs
  + a sticky merge bar.
- A **commit detail view** with the agent reasoning panel + per-file diff.
- An **agent autonomy panel** inside Settings: per-repo permission matrix
  + branch protection rules.
- A **file editor** with view / edit toggle, Monaco when installed,
  textarea fallback otherwise.
- A **global Cmd+K palette** that jumps to repos / PRs / issues / Axon
  actions.

---

## Architecture at a glance

```
                +---------------------+
                |   CodePage.tsx      |
                |   (dashboard +      |
                |    repo view shell) |
                +----+-----------+----+
                     |           |
            +--------+           +-----------+
            |                                |
+---------------------+         +-------------------------+
|   RepoTabs.tsx      |         |   PullRequestDetail.tsx |
|   Issues/Actions/   |         |   Conv/Commits/Files    |
|   Insights          |         |   + merge bar           |
+---------------------+         +-------------------------+
            |                                |
            v                                v
   +-------------------+           +---------------------+
   |   queries.ts      |<----------+   FileEditor.tsx    |
   |   TanStack hooks  |           |   view + edit       |
   |   + UUID guards   |           |   + Monaco lazy     |
   |   + breaker       |           +---------------------+
   +---------+---------+
             |
             v
       Supabase REST (PostgREST) -- falls back to mockData.ts
```

All components stay shape-compatible with the mock fixtures so the page
keeps working pre-migration. Once the migrations apply, the same hooks
return live rows without any component change.

---

## Files in the module

| File | Role |
|------|------|
| `src/MyComponents/Code/CodePage.tsx` | Main shell, dashboard, repo view, tab strip, code tab. |
| `src/MyComponents/Code/RepoTabs.tsx` | Issues / Actions / Insights tabs (one module so the visual language stays consistent). |
| `src/MyComponents/Code/PullRequestDetail.tsx` | Full PR view + threaded comments + reviews + merge bar. |
| `src/MyComponents/Code/CommitDetail.tsx` | Single-commit page (subject + body + AI reasoning + per-file diff). |
| `src/MyComponents/Code/AgentAutonomyPanel.tsx` | Settings tab: permission matrix + branch protection cards. |
| `src/MyComponents/Code/FileEditor.tsx` | View/edit toggle with Save mutation; Monaco lazy + textarea fallback. |
| `src/MyComponents/Code/CodeBlock.tsx` | Shared syntax-highlighter wrapper (Prism + vscDarkPlus) with diff overlay support. |
| `src/MyComponents/Code/queries.ts` | TanStack Query hooks for every read + the save mutation + UUID guards + session circuit breaker. |
| `src/MyComponents/Code/mockData.ts` | Typed fixture data: 3 agents, 6 repos, 3 commits, 5 files, 5 PRs, 5 activities, 8 labels, 6 issues, 6 permissions, 2 branch rules, 5 agent runs. |
| `src/components/CommandPalette.tsx` | Global Cmd+K palette (Navigation / Repos / PRs / Issues / Axon Actions). |
| `src/routes/code.lazy.tsx` | TanStack Router lazy route mounted at `/code`. |
| `migrations/code_init.sql` | 9 core tables + shared updated-at trigger + RLS. |
| `migrations/code_permissions.sql` | `agent_permissions` + `branch_protection`. |
| `migrations/code_issues.sql` | `issue_labels` + `issues` + `issue_label_map` + `issue_comments`. |
| `migrations/code_seed.sql` | Idempotent inserts that match every UUID in `mockData.ts`. |

---

## Database schema

### `code_init.sql` -- the 9 core tables

| Table | Purpose |
|-------|---------|
| `ai_agents` | First-class agent identities (Architect / Engineer / Critic). Distinct from human authors so the UI can render mixed attribution. |
| `repos` | Top-level repos with `language_breakdown` JSON + `activity_heat` + `open_pr_count` cache. |
| `branches` | Named refs. Mostly bookkeeping today; the UI sources branch names from commits. |
| `commits` | Append-only commit log with optional agent attribution + `agent_reasoning` blob. |
| `files` | Current-HEAD file snapshots per branch (content inline; chunked storage is a follow-up). |
| `pull_requests` | Title/body/state + `ai_explanation` banner + diff stats cache. |
| `pr_reviews` | approved / changes_requested / commented / dismissed. |
| `pr_comments` | Inline + top-level threaded comments (self-referential `parent_id`). |
| `code_activity` | Denormalised feed for the dashboard's "Live AI activity" rail. |

All tables share `public.code_touch_updated_at()` as a BEFORE UPDATE trigger,
have `pgcrypto` for `gen_random_uuid()`, and have RLS enabled with permissive
policies for `authenticated` (the UI gates writes by role).

### `code_permissions.sql`

- `agent_permissions(repo_id, agent_id, branch_pattern)` -> six boolean
  capabilities (`can_commit_direct`, `can_open_pr`, `can_review_pr`,
  `can_merge_pr`, `can_merge_own_pr`, `can_force_push`) + `notes`.
- `branch_protection(repo_id, branch_pattern)` -> `required_approvals`,
  `require_human_approval`, `required_approver_roles[]`,
  `require_resolved_threads`, `block_force_push`, `delete_after_merge`.

### `code_issues.sql`

- `issue_labels(repo_id, name, color_hsl)`
- `issues(repo_id, number, title, body, status, ...assignee/author, ai_reason)`
- `issue_label_map(issue_id, label_id)` -- M:N join.
- `issue_comments(issue_id, body, ...)` -- flat thread (PRs handle nesting).

### `code_seed.sql`

Re-encodes every row from `mockData.ts` with fixed UUIDs of shape
`00000000-0000-4000-8000-0000000NNNNN`. All inserts are
`ON CONFLICT DO NOTHING` so the file is safe to re-run.

UUID slot allocation:

| Range | Entity |
|-------|--------|
| `...00000a` -- `...00000c` | Agents |
| `...000101` -- `...000106` | Repos |
| `...000201` -- `...000203` | Commits |
| `...000301` -- `...000305` | Files |
| `...000401` -- `...000405` | Pull requests |
| `...000501` -- `...000505` | Activity feed |
| `...000601` -- `...000608` | Issue labels |
| `...000701` -- `...000706` | Issues |
| `...000801` -- `...000806` | Agent permissions |
| `...000901` -- `...000902` | Branch protection |

---

## Query layer (queries.ts)

All Supabase access for `/code` lives in **one** module so components stay
declarative and we have a single place to patch when columns change.

### Read hooks

| Hook | Returns | Notes |
|------|---------|-------|
| `useAgents()` | `AiAgent[]` | Circuit-breaker gated. |
| `useRepos()` | `Repo[]` | Circuit-breaker gated. |
| `useRepo(id)` | `Repo | null` | Local find over `useRepos()` cache. |
| `useCommits(repoId)` | `CommitRow[]` | UUID guard. |
| `useFiles(repoId, branchName?)` | `FileRow[]` | UUID guard. |
| `usePullRequests(repoId)` | `PullRequest[]` | UUID guard. |
| `usePullRequest(prId)` | `PullRequest | null` | UUID guard + maybeSingle. |
| `usePrComments(prId)` | `PrComment[]` | UUID guard. |
| `usePrReviews(prId)` | `PrReview[]` | UUID guard. |
| `useActivity(repoId?)` | `ActivityItem[]` | Circuit-breaker gated when no `repoId`. |
| `usePermissions(repoId)` | `AgentPermission[]` | UUID guard. |
| `useBranchProtection(repoId)` | `BranchProtection[]` | UUID guard. |
| `useLabels(repoId)` | `IssueLabel[]` | UUID guard. |
| `useIssues(repoId)` | `Issue[]` | Parallel fetch of issues + label map; UUID guard. |

### Mutation

- `useSaveFile()` -- upserts on `(repo_id, branch_name, path)`. Returns the
  row id so a "New file" save can re-select. Throws a friendly
  "apply-migrations" error when the active repo isn't a UUID.

### Guards

- **`isUuid()`** -- loose RFC 4122 test. Every read hook short-circuits to
  the matching `MOCK_*` slice when the id is mock-shaped
  (`r-takeover-web`, `f1`, `pr1`, ...). Stops the cascade of 400s that
  Postgres would otherwise return for "invalid uuid syntax".
- **Session circuit breaker** -- the listing hooks (no id to gate on:
  `useRepos`, `useAgents`, `useActivity` without `repoId`) read a
  `sessionStorage` flag (`code-schema-applied = "missing" | "applied"`).
  First 400 flips it to `"missing"`; every subsequent call this session
  skips the network. Reload clears the flag so it re-probes.
- **Row mappers** -- each table has a `<Name>RowDb` snake_case interface
  and a `map<Name>()` helper that translates to the camelCase shapes the
  rest of the app uses. Mock data and live data go through the same
  TypeScript types.

---

## UI surfaces

### Dashboard (`/code`)

- Search box + Active / Archived / All segmented control.
- Repo grid (1 / 2 / 3 columns depending on viewport).
- Right rail: live AI activity feed with mixed agent + human entries.
- `RepoCard` shows visibility icon (Lock / EyeOff / Eye), language bar
  (Linguist-style colors), open-PR count, last-commit agent dot, and
  an `ActivityHeatPill` with three tones (primary / amber / idle).

### Repo view

GitHub-style tab strip at the top: **Code / Issues / Pulls / Actions /
Insights / Settings**. Switching tabs keeps the user inside the repo.

- **Code tab.** File tree on the left, FileEditor on the right (view
  mode by default), AI summary rail on the far right. Top of the tree
  has a `+ New file` button.
- **Issues tab.** Status segmented (Open / Closed / All) + label dropdown
  filter + search. Issue rows show status icon, title, AI badge for
  agent-authored, label chips with HSL color, author/assignee dots.
- **Pulls tab.** Status segmented + GitHub-style PR rows with merge-state
  icon (open green / draft muted / merged violet). Click a row -> PR
  detail.
- **Actions tab.** AI agent run log. Collapsible run cards with step
  timeline, duration formatting, trigger badge (manual / scheduled /
  webhook / auto), and a link to the produced commit/PR when available.
- **Insights tab.** 30-day commit-frequency chart + per-agent
  contribution table (commits / PRs / lines) + file ownership heatmap
  + PR throughput tiles (open / merged / closed).
- **Settings tab.** Mounts `AgentAutonomyPanel` with the permission
  matrix + branch protection cards.

### PR detail

Three sub-tabs (Conversation / Commits / Files Changed) with a sticky
merge bar on Conversation for open PRs:

- **Conversation.** Top description card with the `aiExplanation` banner,
  threaded comments (with nested replies via `parent_id`), review cards
  (approved emerald / changes_requested amber).
- **Commits.** Recent commits on the repo; click one -> `CommitDetail`
  (in-place; back button returns here).
- **Files Changed.** Per-file diff using `CodeBlock` with a deterministic
  `lineStates` map seeded off `(fileId, commitSha)` so different
  commits show different-looking diffs.

### Commit detail

Subject + body + SHA + parent SHA chips, AI Reasoning panel for
agent-authored commits, per-file diff cards.

### Cmd+K palette

Global. Sections: Navigation / Repos / PRs / Issues / Axon Actions.
Arrow-key navigation + Esc to dismiss. Axon actions fire CustomEvents on
`window` so the AxonProvider can react.

---

## Editor + save flow

`FileEditor.tsx` is the single editor used by both the Code tab and any
future "open file" deep links.

- **Modes.** `view` (CodeBlock) or `edit` (Monaco when installed,
  textarea fallback otherwise).
- **Header.** File path on the left (editable input for New File only),
  save state indicator (`Loader2` spinner / `save failed` chip), and
  the Edit / Cancel + Save buttons.
- **Body.** `flex-1 min-h-0 overflow-hidden flex flex-col` so the
  height chain reaches the textarea. View mode wraps `CodeBlock` in
  its own scrollable child; edit mode lets the editor handle scroll.
- **MonacoFallback.** `<div className="relative h-full min-h-[400px]
  flex flex-col">` wrapping a textarea with `flex-1 min-h-0` +
  `rows={24}` as a belt-and-suspenders. Floating amber banner says
  "plain editor -- install @monaco-editor/react for richer UX" and is
  `pointer-events-none` so it doesn't block typing.
- **Save flow.**
  1. Click Save -> `useSaveFile.mutateAsync({ repoId, branchName, path,
     content, language, fileId })`.
  2. If `repoId` isn't a UUID -> throw friendly error.
  3. If `fileId` is a real UUID -> `UPDATE files WHERE id = fileId`.
  4. Otherwise -> `UPSERT files ON CONFLICT (repo_id, branch_name,
     path)` (covers both "new file" and "mock file row on seeded repo").
  5. Returns the canonical row id; parent re-selects.
  6. TanStack Query invalidates `[code, files, repoId, branchName]`
     -> the tree refreshes.

The editor does **not** push to the `commits` table yet -- saves go
directly to HEAD on the branch. A "save -> propose commit" flow is the
natural next step.

---

## Activation steps

### Enable live Supabase data

In your Supabase SQL editor, run **in order**:

1. `migrations/code_init.sql`
2. `migrations/code_permissions.sql`
3. `migrations/code_issues.sql`
4. `migrations/code_seed.sql`

Then refresh the page once. The schema-applied flag flips to `"applied"`
and live data takes over. Save buttons start persisting real rows.

### Enable the Monaco editor

```bash
pnpm add @monaco-editor/react monaco-editor
```

Refresh. The lazy import in `FileEditor.tsx` picks it up automatically;
no code change required. The textarea fallback disappears.

---

## Change log

Most recent first. Update this list as new work lands.

### 2026-05 -- Wire Supabase + editor + safety nets

- Created the three missing schema migrations (`code_init.sql`,
  `code_permissions.sql`, `code_issues.sql`) that had been referenced in
  past commit messages but never actually written.
- Authored `code_seed.sql`: 49 mock rows -> idempotent INSERTs with
  fixed UUIDs that exactly match `mockData.ts`.
- New `queries.ts`: 14 read hooks + 1 save mutation, snake -> camel row
  mappers, UUID guards on every id-scoped hook.
- Per-session `sessionStorage` circuit breaker for listing hooks so the
  console stops drowning in 400s when the schema isn't applied yet.
- Wired hooks into `CodePage`, `RepoTabs`, `PullRequestDetail`,
  `AgentAutonomyPanel` (with `useEffect` resync for local state).
- New `FileEditor.tsx`: view/edit toggle, Monaco lazy-loader (Vite-safe
  via variable + `/* @vite-ignore */`), textarea fallback with proper
  flex-height chain + `rows={24}` so it doesn't collapse to 2 rows.
- Added Edit toggle + `+ New file` button to the Code tab.
- `useSaveFile` throws a friendly "apply migrations first" error for
  mock repos; falls back from update-by-id to upsert-by-path for
  mock-shaped file ids on seeded repos.
- `IssueRow` now takes `labels` as a prop -- fixes a `labelById is not
  defined` runtime error after the import was scoped down.
- Recovered file truncations on `CodePage.tsx`, `AgentAutonomyPanel.tsx`,
  `PullRequestDetail.tsx`, `RepoTabs.tsx`, `FileEditor.tsx`, `queries.ts`
  (Edit/Write tools kept cutting mid-stream; final writes go through
  Python heredocs with round-trip byte checks).

### Earlier work (pre-Supabase, from prior sessions)

- Initial Code module: dashboard + repo view + 6-tab nav + mockData
  shape.
- PR detail view with Conversation / Commits / Files Changed.
- Agent autonomy panel + branch protection.
- Issues / Actions / Insights tabs.
- Syntax highlighting via `react-syntax-highlighter` (Prism + vscDarkPlus)
  with diff-overlay support in `CodeBlock`.
- Commit detail view with AI reasoning panel.
- Global Cmd+K command palette.
- Added Code entry to all 9 role sidebars + CEO's nested Insights submenu.

---

## Backlog

Next-up improvements, roughly ordered by impact.

- **Save -> propose commit flow.** Today Save writes straight to the
  `files` row. Real Git semantics: each save produces a `commits` row
  on a branch + updates `pull_requests.head_sha`. Needs a "Commit
  message" dialog after Save when the working branch is a feature
  branch.
- **Branch switcher.** Right now `useFiles` always loads
  `repo.defaultBranch`. Add a branch dropdown in the Code tab header
  that swaps `branchName` and re-fetches.
- **Diff overlay during edit.** Compute a diff against the saved
  version on every keystroke so the editor's gutter shows
  add/delete/modify rails.
- **Rename / delete file.** Currently the path field locks once a file
  exists. Add a soft "Move" action that updates the path on the
  existing row (the `(repo_id, branch_name, path)` unique index makes
  this a simple update).
- **Real branch protection enforcement.** The panel persists rules but
  the save flow doesn't check them yet. Block direct commits to a
  protected branch + gate `useSaveFile` on the active agent's
  permissions.
- **AI agent action handlers.** Wire the Actions tab's "run" cards to
  real Axon agent triggers so a click can dispatch an Architect/Engineer
  task and stream step updates back into `agent_runs`.
- **Issue comments + PR comment composer.** Inboxes are read-only
  today. Add a composer at the bottom of the conversation tab + a
  threaded reply affordance.
- **Real activity feed.** `useActivity` reads the seeded rows but
  nothing writes to `code_activity` yet. Hook commits + PR opens + PR
  merges into the trigger chain.
- **Repo creation modal.** The "New repo" button is currently inert.
  Add an insert flow + storage-bucket provisioning.
- **Onboarding / empty states.** When the schema is applied but the
  repos table is empty, show a friendly "Create your first repo"
  state instead of an empty grid.
- **Mutations + optimistic UI for permissions.** Permission toggles
  in `AgentAutonomyPanel` are local-only. Wire an upsert mutation +
  optimistic state.

---

## Known gotchas

- **One 400 per session reload before migrations.** The schema-applied
  circuit breaker can't know the schema is missing until it tries
  once. After that single probe, every listing call goes silent.
  Apply the migrations to eliminate even that one.
- **Mock-data ids are not UUIDs.** The seeded mock rows use short ids
  (`r-takeover-web`, `f1`, `pr1`). All Supabase id columns are `uuid`
  and Postgres rejects non-UUIDs with code `22P02`. Every read hook
  short-circuits to mock when the id isn't UUID-shaped; the save
  mutation throws a friendly error.
- **Monaco isn't in package.json by default.** Until you
  `pnpm add @monaco-editor/react monaco-editor` the editor renders
  the textarea fallback. The lazy import is wrapped in
  `/* @vite-ignore */` + a runtime `.catch()` so the dev server doesn't
  break on the missing module.
- **Large-file truncation on Edit/Write.** Files over ~15 KB
  occasionally come back mid-line truncated. Write them via Python
  heredoc with a round-trip byte check when this happens.
- **The seed inserts skip on conflict.** Re-running `code_seed.sql` is
  safe but won't update existing rows. To re-seed cleanly, truncate
  the tables first.
