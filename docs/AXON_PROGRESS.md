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

---

## Sprint 7 — Snappy voice + thinking orb + multi-project + autonomous agent

Operator request: "axon feels slow / forgets to respond — animate him +
change color when thinking — give him max-claude-plan capability with
multi-project access — I just want to tell him the end result and he
breaks it down + executes himself."

### ✅ T1.6 — Voice dispatch latency cut

- `engine/voiceInput.ts` — added an early-dispatch path. When the
  recognizer's interim transcript stops growing for `earlyDispatchSilenceMs`
  (default 650ms) while in `armed` state, we promote the interim to a
  command instead of waiting for browser endpointing (~1.8s). The
  trailing real `isFinal` event is suppressed by extending `suppressUntil`
  + the existing exact-match dedup.
- `AxonProvider.tsx` — wired `earlyDispatchSilenceMs: 650`. Tightened
  `dispatchCooldownMs: 1400 → 700` since early-dispatch + final-dedup
  already cover the duplicate-guard case.

### ✅ T6.4 — Orb thinking animation + color

- `ui/Orb.tsx` — new visual treatment for `processing` / `executing`:
    - Accent shifts from CWA red to cyan-violet (R 120, G 160, B 255).
    - Rotating arc orbits the rim clockwise, fading head-to-tail.
    - Counter-rotating second arc on the outer ring (gyroscope feel).
    - Concentric pulse ring expands from center every ~700ms.
    - Wave speed bumped to 1.6 during thinking — interior plasma
      churns faster.
    - Thinking-state intensity gets a subtle sin-pulse so the operator
      can see Axon is alive, not stuck.
- New `axon-thinking-badge` rendered below the orb with "Thinking…"
  or "Working…" text. CSS keyframe `axon-thinking-pulse` glows the
  badge in sync with the orb's pulse.

### ✅ T7.12 — Multi-project workspaces

- `types.ts` — added `CodegenProject { id, name, path, language?, notes? }`,
  `AxonSettings.projects: CodegenProject[]`, `AxonSettings.activeProjectId`.
  Legacy `codegenWorkspace` kept as fallback.
- `actions/projects.ts` — five new actions:
    - `add_project({ name, path?, language?, notes?, activate? })` —
      opens picker if no path, rejects duplicate names.
    - `list_projects` — returns all + which is active.
    - `current_project` — reports active.
    - `switch_project({ name? | id? })` — fuzzy-matched name; voice
      can say "switch to simplicity" or "work on cwa-manager".
    - `remove_project` — destructive, confirmed; auto-promotes another
      project to active if the removed one was active.
- `AxonProvider.tsx` — `_bindCodegenAccessors` resolves active project
  first (falls back to legacy `codegenWorkspace`); `_bindProjectAccessors`
  threads settings read/write to the projects module.
- `config.ts` — settings storage key bumped v4 → v5.

### ✅ T5.1 — Autonomous agent mode

- `engine/agent.ts` — new `runAgent({ goal, ctx, project, maxIters,
  onProgress, onAction, narrate })` runs a planner+executor loop against
  Anthropic with the FULL action registry as tools. Specialized
  `AGENT_SYSTEM` prompt frames Claude as an autonomous engineer:
    - Plan briefly, call tools, course-correct on errors, stop when
      done with a 1-2 sentence spoken summary.
    - Higher iteration cap (14 vs. 4 for the conversational brain).
    - Non-streaming — full content blocks per turn so tool_use chains
      stay clean.
    - Project context (name, path, language, notes) injected into the
      first user message.
- `actions/agent.ts` — `accomplish_goal({ goal, projectName?,
  maxIterations?, narrate? })` action. Resolves the project (named or
  active), runs the agent, narrates progress aloud between steps via
  `ctx.speak`, logs every sub-action to the activity feed prefixed
  `agent:`. Marked `silent: true` when narrating so the brain doesn't
  re-speak the final summary on top.
- `AxonProvider.tsx` — `_bindAgentAccessors` gives the agent action a
  reader for current settings (active project resolution).
- System prompt: new "Multi-project + autonomous mode" section. Tells
  the brain to prefer `accomplish_goal` for multi-step requests
  ("build a settings page", "scaffold the auth flow") and single
  tool calls for atomic file changes.

### Shipped

Commit: _pending_ (sprint 7)


### ✅ T8.1 — Live Mind Map (week 1 of the $1M upgrade)

- `engine/graphStore.ts` (new) — pure event store with subscribe /
  getState pattern. Sessions hold {nodes, edges, activeNodeId},
  with node kinds: root | plan | tool | file | thought | error |
  summary. Mutations are emit-driven; React reads via
  useSyncExternalStore.
- `engine/agent.ts` — wires `axonGraph.startSession({ kind: "agent",
  prompt: goal })` at run start, `addThought(text)` between turns,
  `endSession({ summary, failed })` on terminal states or cap-hit.
- `engine/brain.ts` — same pattern for conversational turns.
- `engine/executor.ts` — `startTool` + `endTool` wrap every action
  call with input args, error message, duration.
- `engine/codegen.ts` — `addFile` events on every find / search /
  read / list / write / modify / delete.
- `ui/MindMap.tsx` (new) — custom canvas at devicePixelRatio with
  force-directed layout. Boxy CWA-style nodes (rectangular tags
  with monospace labels, dashed left accent bar, kind-color border).
  Hover tooltips, click-to-pin, replay scrubber across the bottom.
- `ui/CommandPanel.tsx` — new "Mind" tab + maximize button (⤢) for
  full-screen Mind Map.
- `axon.css` — sovereign-tech styling.

### ✅ T8.2 — Live diff overlay (week 2)

- `engine/diffUtil.ts` (new) — pure LCS-based unified line diff,
  ~140 lines, no deps. `diffLines(before, after)` returns
  {kind: "eq"|"add"|"del", text, lineNo}. `compactDiff(raw)` collapses
  long unchanged stretches into "skip" markers with N context lines.
- `engine/graphStore.ts` — GraphNode gains `before` / `after` /
  `diffTruncated` fields with a 64KB cap helper.
- `engine/codegen.ts` — `writeWorkspaceFile` reads existing bytes
  BEFORE overwriting and threads before+after through `addFile`.
- `ui/DiffOverlay.tsx` (new) — floating side panel mounted at
  AxonRoot level so it's visible without opening the Command Panel.
  Auto-shows on every write/modify, auto-hides after 7s. Pin button
  cancels auto-hide. `window.__axonOpenDiff(id)` lets the Mind Map
  pop the overlay for a clicked file node.
- `ui/MindMap.tsx` — click handler fires `__axonOpenDiff` for
  write/modify file nodes.
- `AxonRoot.tsx` — mounts <DiffOverlay /> alongside the other
  overlays.

### ✅ T8.3 — Mind Map render fixes

- Canvas was crashing every frame because KIND_COLOR.root resolved
  to "rgb(var(--axon-accent-rgb))" — a CSS variable. Canvas color
  APIs need a fully-resolved literal; the .replace("rgb","rgba")...
  shorthand produced "rgba(var(--axon-accent-rgb, 0.55))" which
  addColorStop refused. Fix: `resolveAccentRgb()` calls
  getComputedStyle once at module load and caches the literal
  rgb(R,G,B) form.
- useSyncExternalStore was bailing out because mutating `state` in
  place returned the same reference forever. Fix: emit() now
  shallow-copies the active session's nodes + edges and
  `getState()` returns a cached snapshot wrapper that invalidates
  on every emit. React-side memos finally see fresh data;
  DiffOverlay actually appears now.

### ✅ T8.4 — `add_page` action

- `actions/code.ts` — new mutating action. Detects the project's
  router by probing for marker files: `routeTree.gen.ts` /
  `__root.tsx` (TanStack file-based), `app/layout.tsx` (Next App),
  `pages/_app.tsx` (Next Pages), or vanilla Vite fallback.
  Generates the route file at the correct location with a working
  scaffold; if a `brief` is provided, hands the scaffold off to
  Claude as code-writer to flesh out the inner JSX while preserving
  the route registration. Confirmation-gated, undo-pushed. Action
  description nudges Claude to use it whenever the operator says
  "page" or "route".

### ✅ T8.5 — Cross-turn agent memory

- `engine/agent.ts` — `buildRecentContext()` walks the last 2-3
  graph store sessions and returns a structured summary of file
  events (write / modify / find / read / delete) grouped by op,
  capped at 12 entries. Prepended to the first user message in
  every `runAgent` call. System prompt explicitly directs Claude to
  scan this block before calling find_file. Eliminates the
  rediscovery loop where every follow-up turn ("now wire it into
  the home page") burned iterations re-finding files the previous
  turn already located.

### ✅ T8.6 — Workspace picker auto-fallback

- `actions/code.ts` — `set_workspace` handler now auto-pops the
  folder picker dialog when a verbal path can't be reached (either
  doesn't exist OR outside Tauri's static fs:scope). The picker's
  recursive:true flag adds the chosen folder to runtime scope,
  fixing the scope rejection AND letting the operator correct
  typos in one click.
- `src-tauri/capabilities/default.json` — fs:scope widened to allow
  C:/Dev/**, D:/Dev/**, C:/Projects/**, D:/Projects/** so common
  dev locations don't trip the scope guard.

### ✅ T8.7 — Iteration budget + anti-loop rules

- `engine/agent.ts` — AGENT_MAX_ITER bumped 14 → 50 (real coding
  tasks routinely chew 20+ tool calls). Added explicit ITERATION
  BUDGET + ANTI-LOOP RULES sections to AGENT_SYSTEM:
    - "After find_file, your NEXT call MUST be modify_file, not
      another find_file or read_file."
    - "DO NOT call read_workspace_file before modify_file —
      modify_file reads internally."
    - "DO NOT call read_workspace_file to verify what generate_file
      or modify_file just wrote."
    - "If the operator says 'import X here', that's ONE
      modify_file call. No more lookups."
- On cap-hit, `axonGraph.endSession({ failed: true })` runs so the
  Mind Map root settles red instead of pulsing forever.

### ✅ T8.8 — Boxy CWA-style node redesign

- `ui/MindMap.tsx` — replaced spherical gradient nodes with
  rectangular tags. Dark fill (rgba(10,11,14,0.94)), 1px kind-color
  border, 1.5px left-edge accent bar, monospace label inside
  ("GOAL", "TOOL FIND_FILE", "WRITE src/billing/page.tsx", etc).
  Active state gets a brand-color glow shadow; hover/pin lights up
  the border. Diamond + pill special shapes are gone — every kind
  is one consistent boxy family. Hit-test switched from circle to
  bounding-rect.

### ✅ T8.9 — Replay polish + simulation mode

- `ui/MindMap.tsx` scrubber:
    - New ▶ Play / ❚❚ Pause button auto-advances replayIndex
      step-by-step, RAF-driven for smoothness.
    - 1× / 2× / 4× speed toggle (600ms / 300ms / 150ms per step).
    - Auto-stops + flips back to live mode at the end.
    - ● Live also pauses if playing — no orphan animation loops.
- `engine/simulationFlag.ts` (new) — module-level signal
  (`getSimulationMode` / `setSimulationModeFlag`) so engine reads
  the toggle without threading through every action context.
- `engine/executor.ts` — when simulationMode is on AND action is
  mutating, returns synthetic `(simulated)` result without calling
  the handler. Non-mutating actions (find_file, read_workspace_file)
  still run so the agent can plan accurately. Graph node tagged
  `simulated: true`.
- `engine/agent.ts` — `runAgent` defaults `simulationMode` from the
  flag, passes through to `executeAction` so the whole tool chain
  stays consistent for the run.
- `engine/graphStore.ts` — GraphNode gains `simulated?: boolean`,
  threaded through `startTool`.
- `ui/MindMap.tsx` canvas — simulated nodes render with dashed
  border (setLineDash([3,3])) plus an amber "SIM" pill above the
  box. Visually distinct from real activity.
- `types.ts` / `AxonProvider.tsx` — `simulationMode` + setter
  exposed via context. Operator-facing toggle pending wiring into
  Command Panel.

### Shipped

Commit: _pending_ (sprint 8)

### ✅ T8.10 — Multi-agent ensemble (week 4)

- `engine/ensemble.ts` (new) — sequential three-agent pipeline:
    1. **Architect** — given the goal, returns a JSON plan
       (approach, steps, files expected, risks). No tools, just a
       thinking pass. Plan becomes a `plan` node in the Mind Map.
    2. **Engineer** — runs the existing `runAgent` loop with the
       plan injected as context. Full tool access. Executes.
    3. **Critic** — given the Engineer's final summary + the list
       of files touched, returns a JSON verdict
       `{ verdict: "ship" | "revise" | "abort", issues, summary }`.
       Verdict becomes a `critique` node.
   On `revise`, loops back to the Engineer with the critique
   appended. Hard cap of 2 revision rounds.
- `engine/graphStore.ts` — new `critique` node kind + `addCritique`
  helper. Verdict drives the label ("✓ SHIP" / "↺ REVISE" /
  "✕ ABORT") and the node state.
- `actions/ensemble.ts` (new) — `accomplish_with_ensemble({ goal,
  narrate?, maxRevisions? })` voice action. Description nudges
  Claude to use it whenever the operator says "ensemble", "with
  the team", "plan first", "have the critic review", or for goals
  that warrant double-checking.
- `actions/index.ts` — registers the new action.
- `AxonProvider.tsx` — `_bindEnsembleAccessors` reads the active
  project from settings.
- `ui/MindMap.tsx` — `critique` nodes render in amber with a
  "CRITIC" label prefix. Visually distinct from regular Engineer
  output so the operator can scan a session and see where the
  reviewer weighed in.

Notes:
- For v1 the Critic reviews from summary + file list rather than
  running its own read-only tools — keeps the loop fast and
  deterministic. Live tool access for the Critic is a future step.
- If the Architect's JSON fails to parse, the ensemble falls back
  to a regular agent run rather than refusing the task.

### ✅ T8.11 — Anthropic 429 backoff + retry

The ensemble pipeline (Architect + Engineer loop + Critic) routinely
spikes past the default 30k input-tokens-per-minute Anthropic ceiling
on long goals. Crashing the run with a raw 429 stranded the operator
mid-build.

- `engine/anthropicFetch.ts` (new) — wrapped `fetch` for the
  Anthropic Messages API. Catches 429s, reads `retry-after` (or
  falls back to exponential 5s/10s/20s), waits, and retries up to
  three times. Throws the last 429 only if every retry fails. An
  `onWait(waitMs, attempt)` callback lets the caller narrate
  "Rate-limited. Waiting Xs." so the operator hears a status update
  instead of silence.
- `engine/agent.ts` — uses `anthropicFetch` for the autonomous
  loop's main API call. The `onWait` hook fires `ctx.speak(...)`
  during the wait so the Orb keeps talking.
- `engine/ensemble.ts` — uses `anthropicFetch` for both Architect
  and Critic calls. Phase tag ("Architect: rate-limited..." /
  "Critic: rate-limited...") so the operator can hear which agent
  is paused.
- Brain.ts (streaming) is handled separately at its own surface
  (different request shape, already has a catch path).

### ✅ T8.12 — Three-color + animation system for ensemble roles

Visual identity for the three ensemble agents so the operator can
read the phase at a glance on the Mind Map canvas:

- **Architect** — indigo (`rgb(129, 140, 248)`). Slow, deliberate
  breathing pulse (~1.6s cycle) plus an animated dashed top edge
  that scrolls left→right like blueprint paper.
- **Engineer** — sky (`rgb(56, 189, 248)`). Quick scan-tick pulse
  while running plus a bright bottom-edge scanner bar that sweeps
  L→R like a live cursor. Settles to nothing when idle.
- **Critic** — verdict-tinted: green (ship), amber (revise), or
  rose (abort). Bright flash burst on appear (600ms) then a faint
  steady glow. Pop-in verdict stamp on the right edge: ✓ / ↺ / ✕,
  scaled with a 220ms animation.

Detection is implicit: an ensemble session is identified by its
prompt prefix `[ensemble]` (set in `runEnsemble`), so no schema
changes were needed — the renderer infers role from `kind` plus
session prompt.

- `ui/MindMap.tsx` — `ensembleRole()`, `roleColor()`,
  `criticVerdictColor()` helpers. Per-role glow signature in the
  draw loop and per-role decoration pass (architect dashes,
  engineer scanner, critic stamp). Tooltip header now reads
  "ARCHITECT" / "ENGINEER" / "CRITIC" inside an ensemble session.
- `axon.css` — three role chips in the header (`ARCH` / `ENG` /
  `CRIT`) that only appear during an ensemble session, each
  pulsing in its own color and rhythm. Architect at 2.4s, Engineer
  at 1.2s, Critic at 3s — cadence mirrors the canvas animations.

### ✅ T9.0 — Simulation toggle wired into Command Panel

Engine respected `simulationMode` since T8.9 but the operator had
no switch — it could only be flipped via the AxonContext. Now there
is a SIM button in the Command Panel header next to the call-mode
toggle. Click flips `useAxon().setSimulationMode()` which mirrors
through to the module-level signal that `executor.ts` reads at
mutating-action time. When ON the button glows amber and reads
"🟡 SIM"; when OFF it's plain "SIM". The Mind Map already paints
simulated nodes with a dashed border + SIM pill, so the operator
gets clear visual feedback that nothing's actually being written.

### ✅ T9.1 — Continuous vision (Week 5.1)

Axon can now ambiently SEE — not just respond when asked.

- `engine/visionLoop.ts` (new) — periodic screenshot → Claude
  Sonnet vision → Mind Map vision node. Default interval 30s.
  Skips when status is busy (coding / executing / processing /
  speaking), when the document is hidden, when the visible-text
  hash hasn't changed since the last successful capture, or
  while a previous capture is still in-flight. Goes through
  `anthropicFetch` for graceful 429 handling. Returns a
  one-sentence read like "you're on the transactions page,
  ledger has 3 unreconciled items" — or `"No change."` /
  `"Loading."` which we treat as silent skips.
- `engine/graphStore.ts` — new `vision` node kind + `addVision`
  helper. Vision nodes hang off the session root so they don't
  visually entangle with the agent's tool tree. Detail field
  carries the screenshot data URL via `meta.thumbnailUrl` for
  future click-to-view.
- `ui/MindMap.tsx` — sky-200 color, 👁 prefix in the box label,
  20px layout radius. Reuses the existing rectangular tag style
  with no extra ceremony.
- `types.ts` / `AxonProvider.tsx` — new `continuousVision: boolean`
  setting (default false). `AxonProvider` `configureVisionLoop`s
  the loop with an `isBusy` getter at mount, then toggles
  `startVisionLoop` / `stopVisionLoop` whenever the setting
  changes.
- `ui/CommandPanel.tsx` — 👁 EYES / 👁 SEEING button in the header
  next to SIM. Sky-blue glow when active. Flipping it persists
  via the existing settings persistence so it survives reloads.

Operator-facing: enable, work normally, glance at the Mind Map
every so often to see what Axon noticed. Future agent runs can
read these vision notes via `buildRecentContext` for spatial
awareness.

CEO auto-enable: a per-user localStorage flag
(`cwa-axon-vision-auto-on-v1-{supaId}`) auto-flips the setting to
ON the first time a CEO signs in. After that the flag is set
forever and we respect whatever the CEO's persisted choice is
(turn off → stays off). Other roles default OFF.

### ✅ T9.2 — Filesystem watcher (Week 5.2)

Axon now notices when files change OUTSIDE the agent — saving in
VS Code, pulling a branch, generating types, anything. Each
external edit lands as a 📝 thought beat on the Mind Map and
fires a `axon:file-modified` `CustomEvent` on `window` for future
toasts to hook into ("I see you edited transactions.tsx — want me
to update the related types?").

- `engine/fsWatcher.ts` (new) — wraps `@tauri-apps/plugin-fs`'s
  `watch` API. Active project's full tree is watched recursively.
  Filters: ignores `node_modules`, `.git`, `dist`, `build`,
  `.next`, `.turbo`, `.cache`, `target`, `coverage`, `.DS_Store`;
  only surfaces files matching a curated extension set
  (ts/tsx/js/jsx/rs/py/go/css/scss/md/json/toml/yaml/html/svg/sql).
  Per-path 280ms debounce so editor save-bursts coalesce. Rolling
  history capped at 24 entries.
- `types.ts` — new `fsWatcher: boolean` setting (default false —
  watcher events can be noisy on heavy refactors).
- `AxonProvider.tsx` — `configureFsWatcher` with active-project
  getter, then start/stop hook gated on `settings.fsWatcher && enabled`.
  Reconfigures whenever the active project changes.
- `ui/CommandPanel.tsx` — 📝 FS toggle button next to 👁 EYES.
  Emerald glow when active.

### ✅ T9.3 — Axon Diary (Week 6.1)

Foundation for Axon's long-term memory. Every session that ends
writes a Markdown reflection to:

```
<activeProject>/docs/diary/YYYY-MM-DD/HH-MM-SS-<slug>.md
```

The file captures: goal, kind (conversation / agent / ensemble),
duration, status (✅ done / ❌ failed), final summary, Critic
verdict (ensemble only), every file touched (with op + duration),
every tool called (with success/error), vision notes that fired
during the session, blockers / errors, last 8 reasoning beats,
and external FS-watcher edits.

- `engine/diary.ts` (new) — `configureDiary` + `startDiary` /
  `stopDiary`. Subscribes to `axonGraph` and writes a diary entry
  whenever a session transitions from active to ended. Skips
  empty sessions (just a root, no real activity). Uses
  `@tauri-apps/plugin-fs` `mkdir` + `writeTextFile`. Surfaces the
  write-path as a 📔 thought so the operator sees it land.
- `types.ts` — new `diary: boolean` setting (default TRUE — empty
  sessions don't write, so the cost is effectively zero, and the
  operator gets a free history log).
- `AxonProvider.tsx` — diary configure + start/stop hook gated
  on `settings.diary && enabled && activeProjectPath`.
- `ui/CommandPanel.tsx` — 📔 LOG toggle button. Indigo glow when
  active.

Why a daily folder + timestamped filename: multiple sessions per
day stay grouped, lex-sorting filenames inside the day folder
gives chronological order for free, slug pulled from the goal
makes filenames actually scannable.

Future T-tasks build on top:
- T9.4 (Improvement loop) reads recent diary entries to feed the
  Critic / Architect "lessons learned" context.
- T9.5 (Memory tab in Command Panel) surfaces recent diary entries
  with click-to-open.

### ✅ T8.13 — Orb visual modes for ensemble agents

The Mind Map showed which agent was active, but the Orb was still
defaulting to its standard idle/thinking/coding palette. Operators
glancing at the Orb couldn't tell which ensemble phase was running.

- `engine/ensemblePhase.ts` (new) — module-level signal + pub-sub for
  the active ensemble agent. Same pattern as `simulationFlag.ts`.
  Engine code calls `setEnsemblePhase(...)` as it transitions; UI
  surfaces subscribe.
- `engine/ensemble.ts` — sets the phase to "architect" → "engineer" →
  "critic" at each transition, and back to null on every exit path.
- `AxonProvider.tsx` — subscribes to the signal, mirrors it into
  React state, exposes `ensemblePhase` on the context value.
- `types.ts` — `ensemblePhase` added to `AxonContextValue`.
- `ui/Orb.tsx` — three new color modes (indigo / sky / amber) plus
  three role-specific in-sphere overlays:
    - **Architect** — blueprint grid + slowly-rotating drafting
      compass arc + outer quarter-segment tick ring (slow, deliberate).
    - **Engineer** — top-to-bottom scan line + falling code-stream
      sparkles + blinking corner cursor + rapid progress arc.
    - **Critic** — heartbeat ring + balance-scales arcs that gently
      tilt + judgment crosshair at center.
  Wave speed and intensity pulse rate are role-specific too —
  Architect breathes (~0.9Hz), Engineer ticks (~5.5Hz), Critic
  pulses (~2Hz). Ensemble phase wins over the generic
  thinking/coding states.
- The status badge under the Orb now reads "Architect…" /
  "Engineer…" / "Critic…" with role-tinted background, border, and
  pulse duration matching the Orb's cadence.

### ✅ T8.14 — Mind Map breathing room

Operator screenshot showed nodes overlapping each other and the
GOAL center after 8+ siblings spawned. Force-directed layout was
too tight.

- `ui/MindMap.tsx` `LAYOUT_PARAMS`:
    - `attraction` 0.04 → 0.025 (weaker spring pull).
    - `repulsion` 1800 → 4200 (~2.3× harder push between every pair).
    - `minDistance` 64 → 110 (visual gap floor).
- New anti-overlap shove using actual rendered box dimensions plus
  a 16px gutter — when two boxes touch, an extra outward impulse
  separates them so labels never sit on top of each other.
- Soft bounds use per-node half-extents so labeled boxes can't
  collide with the canvas edge or the header bar.

### ✅ T8.15 — Live coder panel (typewriter playback)

Diff overlay only popped after the file was finalized, often for a
split second between turns. Operators wanted to SEE Axon coding,
not just inspect the result.

- `ui/DiffOverlay.tsx`:
    - Detects in-flight coding tools (`generate_file`, `modify_file`,
      `scaffold_feature`, `add_page`) by watching for `state ==
      "running"` on tool nodes — pops the panel immediately,
      before any file content is even ready.
    - New `LiveCoderBody` sub-component — once the file's `after`
      content lands, plays a typewriter animation revealing lines
      1 → N at ~22ms each (capped to a 6s budget so a 1000-line
      file finishes quickly). Gutter-numbered lines flash blue as
      they appear, with a blinking cursor on the active line.
    - Auto-scrolls to the latest revealed line.
    - When the typewriter finishes, falls through to the existing
      unified diff view (so the operator can scroll and review).
    - Auto-hide bumped 7s → 14s — long enough to actually read.
- `axon.css`:
    - Width bumped from 460px to `min(720px, calc(100vw - 48px))`
      so 80–120 char lines don't wrap. Min height 240px.
    - New `.axon-live-coder*` class set — sky-blue status bar with
      pulsing dot, mono stream with 44px line-number gutter, line
      reveal animation (`axonLiveLineIn`), blinking cursor
      (`axonLiveCursorBlink`).

