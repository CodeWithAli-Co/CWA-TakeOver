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

Commit `5585810` — "feat(axon): announcements broadcast, recurring meetings, pagination, persistent automations"

---

## Sprint 3 — robustness + the big feature (call mode)

### ✅ T1.4 — Serial dispatch queue

- `src/Axon/AxonProvider.tsx` — `submitCommand` is now a thin wrapper
  that chains off an `inFlightRef` promise. Rapid-fire triggers (voice
  intent + automation fire + keyboard shortcut landing at the same
  time) now execute one-at-a-time instead of racing each other's
  conversation history / activity log / pending-confirm state.

### ✅ T5.3 — CALL MODE (the big ticket item)

- `src/Axon/types.ts` — `AxonContextValue` gained `callMode: boolean`
  and `setCallMode(on: boolean)`. `ActionContext` gained `setCallMode?`
  so actions can toggle it themselves.
- `src/Axon/AxonProvider.tsx` — new `callMode` state + `callModeRef`
  for use inside stale-closure callbacks. The TTS `onEnd` handler now
  arms the recognizer whenever `callModeRef.current` is true (not just
  when Axon's line ended with a question). Exposed through the context
  value + plugged into the ActionContext.
- `src/Axon/actions/call.ts` (new) — `start_call` and `end_call`
  actions. Trigger phrases: "start a call" / "call me" / "let's chat"
  / "conversation mode" to engage; "hang up" / "end call" / "that's
  all for now" to disengage.
- `src/Axon/actions/index.ts` — registered both call-mode actions.
- `src/Axon/ui/CommandPanel.tsx` — added a "📞 Call" / "📞 On Call"
  toggle button in the header that reflects + flips callMode. Turns
  red when active.

Under the hood it's a tiny change — just "arm the mic after every
reply instead of only after questions." The UX payoff is huge: Axon
now feels like a phone conversation, not a command-shell prompt.

### Shipped

Commit `b39a2ea` — "feat(axon): call mode + serial dispatch queue"

---

## Sprint 4 — Outbound reach + multi-step workflows + external data

> Triggered by Axon's own self-audit: "outbound reach is the biggest
> gap." This sprint closes the outbound family + the data-ingestion
> family + multi-step workflows in a single push.

### ✅ T7.9 — Credentials store

- `src/Axon/engine/credentials.ts` (new) — keyed localStorage backing
  for webhook URLs, API tokens, secrets. Convention: `<kind>:<label>`.
- `src/Axon/actions/credentials.ts` (new) — `set_credential`,
  `forget_credential`, `list_credentials` actions. Forget pushes a
  descriptor-style undo so "undo that" restores the value. Audit log
  captures the key but never the secret.

### ✅ T7.1-T7.3 — Outbound integrations

- `src/Axon/actions/outbound.ts` (new) — three actions, all gated by
  credential lookups (returns a "set up first" message if missing):
    - `send_webhook` — generic POST/PUT to a stored URL. Foundation
      for everything else.
    - `send_discord_message` — wraps the webhook primitive with
      Discord's payload shape (`content` + optional `username`).
    - `create_github_issue` — POSTs to api.github.com/repos/{o}/{r}/issues
      with a Bearer PAT (default credential key `github:pat`).
      Returns the issue number + URL on success.

### ✅ T7.5-T7.6 — External data ingestion

- `src/Axon/actions/ingest.ts` (new):
    - `fetch_url` — generic HTTPS GET. Returns text body truncated to
      8KB to keep the LLM context healthy. Optional `bearerKey`
      threads a credential through as `Authorization: Bearer …`.
    - `read_github_pr` — calls api.github.com/.../pulls/{n} and
      returns title, state (open/closed/merged), author, body summary,
      and diff stats. Optional PAT for higher rate limits / private
      repos.

### ✅ T3.3 — chain_commands (multi-step workflows)

- `src/Axon/engine/commandExecutor.ts` (new) — extracted shared
  binding for "submit a natural-language command back to AXON's
  brain". The provider binds it once on mount; both the existing
  automation executor and the new chain_commands hook off this.
- `src/Axon/actions/workflows.ts` (new) — `chain_commands` action
  takes `{ description, commands[], stopOnError? }` and runs each
  command sequentially through the brain pipeline (so each step gets
  full context, confirmations, undo). Capped at 12 steps with a 350ms
  pause between fires to avoid hammering Anthropic. `stopOnError`
  defaults to true.
- `src/Axon/AxonProvider.tsx` — calls `bindCommandExecutor` alongside
  `_bindAutomationExecutor` so both consumers see the same handler.

### Shipped

Commit `d5e3ed2` — "feat(axon): outbound reach (Discord/GitHub/webhooks) + external fetch + chain_commands"

---

## Sprint 5 — closing the elite gap (memory · voice auth · proactive)

> Three of the six gaps Axon flagged were partially in earlier tiers
> but not yet shipped. This sprint closes them all.

### ✅ T7.7 — Persistent session memory (texture, not just raw notes)

- `src/Axon/engine/memory.ts` — `PersistentMemory` extended with three
  new arrays: `sessionSummaries[]`, `decisions[]`, `defers[]`. Each
  with its own age cap. New helpers: `appendSessionSummary`,
  `appendDecision`, `appendDefer`. `memoryPreamble` now surfaces the
  last 3 session recaps + last 5 decisions + last 5 defers in the
  brain's context — Axon now has continuity across reloads ("you've
  been working on X for the past few days").
- `src/Axon/AxonProvider.tsx` — the existing summarizer now also
  writes its compressed output to `appendSessionSummary` whenever it
  fires, so every conversation collapse becomes a durable recap.
- `src/Axon/actions/journal.ts` (new) — `record_decision` and
  `record_defer` actions give the brain a dedicated channel to commit
  these moments to durable memory. No confirmation required —
  capturing should feel weightless.
- `src/Axon/actions/memory.ts` — `forget_all_memory` updated to wipe
  the new fields too.

### ✅ T7.8 — Voice-print actually gates sensitive actions now

- `src/Axon/types.ts` — added `voicePrintGate: boolean` to `AxonSettings`.
- `src/Axon/actions/voiceauth.ts` (new) — four actions: `enroll_voice_print`,
  `enable_voice_gate`, `disable_voice_gate` (with confirm), and
  `test_voice_print` (snapshot + score for tuning). Provider binds
  read/write accessors so actions can mutate settings without prop-
  drilling.
- `src/Axon/engine/executor.ts` — when `opts.voicePrintGate` is set,
  every mutating action snapshots the speaker's voice and rejects if
  cosine similarity falls below threshold. Bypass list covers the
  enroll / enable / disable / test actions themselves so the operator
  can't lock themselves out. Fail-closed if the mic isn't reachable.
- `src/Axon/engine/brain.ts` — `BrainRunOpts.voicePrintGate` threads
  the gate descriptor through to `executeAction`.
- `src/Axon/AxonProvider.tsx` — builds the gate descriptor from
  current settings and passes it to `runTurn`.

### ✅ T5.4 — Proactive intelligence: new monitors

- `src/Axon/engine/monitors.ts` — added two monitors that match the
  examples Axon gave in its self-audit:
    - **stale-meetings** — meetings 2-5 days old whose title doesn't
      appear in any task title get flagged as missed follow-ups.
      Closure-keyed dedupe so the same meeting doesn't fire twice.
      Polls every 30 min.
    - **revenue-swing** — compares last 7 days of invoice income to
      the prior 7. Alerts on >25% jumps or drops. Bucketed dedupe so
      the same anomaly only fires once per direction shift. Polls
      hourly.
- The monitor system already had voice-speaking infrastructure —
  every alert says "Heads up — …" and lands in the conversation log.

### Shipped

Commit: _pending_ (sprint 5)

---

## Sprint 6 — Voice catalog + code generation by voice

Operator request: "give axon alot more options for voice, make it
smoother, even add a british accent voice — and let me build tools,
features, and code files on my voice prompt."

### ✅ T7.10 — Curated voice catalog (presets + smoother cadence)

- `src/Axon/engine/voiceCatalog.ts` — new module with 10 curated
  presets across **British**, **American**, **Australian** accents.
  Each preset bundles:
    - public ElevenLabs voice id (Daniel, George, Lily, Charlotte,
      Dorothy on the British side; Adam, Brian, Rachel, Matilda
      American; Charlie Australian)
    - Web-Speech fallback name list (Google UK English Male, Microsoft
      Sonia, Daniel, Karen, etc) tried in priority order
    - per-preset `rate` + `pitch` so each voice keeps its character
    - tuned `voice_settings` (stability/similarity_boost/style) — two
      profiles: `SMOOTH_TUNED` for news/calm voices, `EXPRESSIVE_TUNED`
      for storyteller voices. Smoother than the v3 hardcoded defaults.
- `src/Axon/engine/voiceOutput.ts` — accepts `voicePresetId` in its
  config; preset wins over operator-set voice id, and the preset's
  rate/pitch + voice_settings flow through to both Web-Speech and
  ElevenLabs paths.
- `src/Axon/types.ts` — `AxonSettings.voicePresetId` added; default
  changed to `"british-george"` (warm British male).
- `src/Axon/config.ts` — settings storage key bumped v3 → v4 to drop
  stale per-operator settings cleanly.
- `src/Axon/ui/AxonSettings.tsx` — voice picker with `<optgroup>` per
  accent, plus the existing system-voice fallback dropdown.
- `src/Axon/actions/voice.ts` — three new actions:
    - `set_voice({ id?, description? })` — exact id OR free-text
      ("British male", "warm female English voice"); writes preset id
      to settings and immediately speaks a confirmation in the new
      voice for an audible settling effect.
    - `list_voices` — returns all presets grouped by accent.
    - `current_voice` — reports the active preset.
- System prompt extended with a "Voice switching" section so the
  brain proactively reaches for `set_voice` when the operator asks
  for a different accent.

### ✅ T7.11 — Code generation by voice

Axon now writes and modifies code in a folder the operator picks.

- `src/Axon/engine/codegen.ts` — engine module:
    - `pickWorkspaceDirectory` (Tauri dialog plugin)
    - `safeJoin` rejects path traversal (`..`)
    - `listWorkspace`, `readWorkspaceFile`, `writeWorkspaceFile`,
      `deleteWorkspaceFile` (Tauri FS plugin, scoped to workspace)
    - `generateFile` — calls Anthropic with a code-writer system
      prompt that forces a single fenced code block; extractor strips
      the fence and returns `{ code, language, raw }`.
    - `modifyFile` — sends current file + change brief; gets back the
      full revised file.
    - `scaffoldFeature` — multi-file output via a single
      `\`\`\`json { "files": [{ "path", "content" }] }\`\`\`` block.
- `src/Axon/actions/code.ts` — voice-callable actions:
    - `set_workspace` (folder picker), `current_workspace`,
      `list_workspace`, `read_workspace_file`
    - `generate_file({ filename, brief })` — mutating, requiresConfirmation;
      pre-checks for clobber, registers undo (delete on first-write,
      restore-from-snapshot on overwrite).
    - `modify_file({ filename, brief })` — mutating, requiresConfirmation;
      undo restores the prior bytes.
    - `scaffold_feature({ name, brief })` — creates ≤5 files under
      `src/features/<name>/`; bulk-undo deletes the whole scaffold.
    - `delete_workspace_file` — destructive; snapshot-restore undo.
- `src/Axon/types.ts` — `AxonSettings.codegenWorkspace` + null default.
- `src/Axon/AxonProvider.tsx` — binds `_bindCodegenAccessors` so
  actions can read/write the workspace setting without prop drilling.
- `src/Axon/ui/AxonSettings.tsx` — Code generation block with a
  "Pick…" button that opens the Tauri folder dialog.
- `src-tauri/capabilities/default.json` — added scoped FS permissions
  (`read-text-file`, `write-text-file`, `read-dir`, `mkdir`, `exists`,
  `remove`) plus an `fs:scope` covering `$HOME/**`, `$DOCUMENT/**`,
  `$DESKTOP/**`, `$DOWNLOAD/**`. Without this scope, writes outside
  AppData would have been rejected by Tauri's permission system.
- System prompt extended with a "Code generation" section so the brain
  knows when to reach for `generate_file` / `modify_file` /
  `scaffold_feature` and that it should call `set_workspace` first if
  no workspace is set.

### Shipped

Commit: _pending_ (sprint 6)
