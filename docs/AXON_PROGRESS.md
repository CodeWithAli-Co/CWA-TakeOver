# AXON Progress Log

> Running log of autonomous improvements. Each entry has the backlog ID,
> a one-line summary, files touched, and the commit that shipped it.
> See `AXON_BACKLOG.md` for the full roadmap.

---

## Sprint 1 — Tier 1 stability + Tier 2 discoverability

### ✅ T1.2 — Confirmation dialog timeout (30s auto-cancel)

- `src/Axon/AxonProvider.tsx` — added `CONFIRM_TIMEOUT_MS` + `timeoutId` on
  the `ConfirmRequest` shape; `requestConfirmation` now schedules an
  auto-cancel that resolves the dialog as `false` and drops a system note
  if the operator never answers. `answerConfirmation` clears the timer
  when a real answer arrives.

### ✅ T1.3 — Persistable undo stack (descriptor + handler registry)

- `src/Axon/engine/undoStack.ts` — rewrote to support two flavors of
  undo:
    - Closure-style (session-scoped, unchanged contract)
    - Descriptor-style: `{ kind, payload }` resolved via a handler
      registered with `registerUndoHandler`. These entries round-trip
      through localStorage under the `axon:undoStack:v1` key.
  Added `resolveUndo()` so callers don't need to know which flavor
  they're holding. Added `hydrateUndoStack()` to restore on mount.
- `src/Axon/types.ts` — relaxed `ActionContext.pushUndo` signature to
  accept either `undo` or `descriptor` (optional, at least one required
  in practice).
- `src/Axon/actions/undo.ts`, `src/Axon/actions/trust.ts` — swapped
  `entry.undo()` for `resolveUndo(entry)()` with a clean "stale entry"
  fallback message if the handler isn't registered.
- `src/Axon/actions/tasks.ts` — migrated all 3 undo pushes (create /
  update-status / delete) to descriptor-style with three registered
  handlers: `task.delete-created`, `task.restore-status`,
  `task.restore-deleted`. Demonstrates the pattern for other callers to
  follow.
- `src/Axon/AxonProvider.tsx` — calls `hydrateUndoStack()` once on mount.

### ✅ T2.1 — Inject capabilities roster into Claude preamble

- `src/Axon/engine/brain.ts` — new `buildCapabilitiesBlock()` emits a
  `<capabilities>` tag listing every registered action name, plus a
  nudge to Claude to group + phrase them conversationally when the
  operator asks "what can you do". Appended to every preamble.

### ✅ T2.2 — Voice-friendly `help` action

- `src/Axon/actions/help.ts` (new) — dedicated `help` action that
  groups registered action names by topic (navigation, tasks, meetings,
  chat, memory, registry, automations, briefings, admin, trust) and
  returns a conversational human-friendly summary instead of a raw
  list. Triggered by "help", "what can you do", "capabilities", etc.
- `src/Axon/actions/index.ts` — wired `registerHelpActions()` into the
  central registration list.

### Housekeeping

- `src/MyComponents/Beginning/conceptIdea.tsx` — re-saved the
  dispatcher in clean UTF-8 (git had started reporting it as binary due
  to a stray byte). No behavioral change — still re-exports
  `EditorialAuth`.
- `docs/AXON_BACKLOG.md` (new) — the full backlog driving this work.
- `docs/AXON_PROGRESS.md` (this file) — running log of shipped work.

### Shipped

Commit `52c12bb` — "feat(axon): persistable undo, confirm timeout, help action, capabilities roster"

---

## Sprint 2 — core features filled in

### ✅ T3.5 — Announcements actually broadcast now

- `src/Axon/actions/announcements.ts` — `confirm_announcement` now
  inserts into `cwa_chat` with a `📢 Announcement · <audience>` prefix
  so it reads as a company-wide post in the existing #General channel.
  Also fires the local Tauri notification for immediate operator
  feedback. Registered a new descriptor-style undo handler
  `announcement.delete-posted` that removes the row by id, so "undo
  that" retracts a broadcast cleanly (even after reload).

### ✅ T3.6 — Recurring meetings

- `src/Axon/actions/meetings.ts` — `create_meeting` now accepts
  `recurrence` (daily / weekly / biweekly / monthly), plus `endDate`
  or `occurrences` to bound the series. Single-call inserts up to 52
  rows in one batch. Registered `meeting.delete-batch` undo handler
  that takes the full id array — "undo that" cancels the entire
  series in one stroke.

### ✅ T4.5 — Paginated data queries

- `src/Axon/actions/tasks.ts` — `list_tasks` now accepts `offset` and
  returns a `nextOffset` cursor. Limit clamped to `[1, 200]`. The
  brain can chain "next 25" without re-deriving the arithmetic.
- `src/Axon/actions/cwa_registry.ts` — `search_registry` got the same
  treatment: `limit` + `offset` inputs, `nextOffset` output, 100-row
  cap. Prevents pathological full-table scans.

### ✅ T3.1 — Persistent automations

- `src/Axon/actions/automations.ts` — all mutations now mirror to
  localStorage (`axon:automations:v1`). `hydrateAutomations()` runs
  the moment `_bindAutomationExecutor` lands an executor; it restores
  recurring automations by restarting the interval, and reminders by
  computing the remaining delay. Reminders whose fire time has passed
  are silently dropped (missing a late reminder beats a surprise
  burst of them on reload).

### Shipped

Commit: _pending_ (sprint 2)
