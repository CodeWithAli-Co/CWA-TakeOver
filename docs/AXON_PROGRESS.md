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

Commit: _pending_ (first autonomous sprint commit)
