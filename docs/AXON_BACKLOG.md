# AXON Improvement Backlog

> Autonomous work plan. Each item has title, description, effort (S/M/L/XL),
> dependencies. Ordered by tier — do Tier 1 first, then 2, then 3, etc.
> Items marked `[x]` are done; see `AXON_PROGRESS.md` for the running log.

---

## Architecture Snapshot

Voice/text → VoiceInput state machine (dormant/standby/armed) → submitCommand
→ `buildContextPreamble` (operator, active company, current path, recent
memory, prior conversation summary, screen context) → `runTurn` (Claude brain
via Anthropic API w/ streaming + prompt caching) → sentence streaming to TTS
while brain decides tools → `executeAction` (role gates + confidence-weighted
confirmation + undo stack) → action handlers mutate Supabase / navigate /
speak → activity logged → conversation appended.

Fast updates use refs. Settlement approach: low-confidence voice doesn't
demand confirmation; operator says "undo that" if wrong.

---

## Current Capabilities (baseline)

- **Navigation**: `navigate`, `go_back`
- **Company**: `switch_company`, `which_company`
- **Tasks**: `create_task`, `list_tasks`, `update_task_status`, `delete_task`
- **Meetings**: `create_meeting`, `upcoming_meetings`, `delete_meeting`
- **Chat**: `send_chat_message`, `delete_message`, `draft_chat_message`, `create_dm`
- **Briefings & data**: `brief_me`, `list_undo`, `peek_undo`, `undo_last`, `list_undoable`
- **CEO registry**: `get_registry_stats`, `search_registry`, `get_registry_item_info`, `list_recent_registry_activity`, `copy_install_command`, `count_rows`, `count_users`, `delete_registry_item`, `update_registry_description`, `yank_registry_version`
- **Automations**: `schedule_automation`, `list_automations`, `cancel_automation`
- **DOM**: `click_button`, `fill_input`, `read_screen`
- **Memory**: `remember_note`, `set_preference`, `forget_all_memory`
- **Admin/system**: `run_cwa_command`, `run_routine`, `list_routines`, `draft_announcement`, `confirm_announcement` (stubbed), `delete_channel`, `recent_signups`
- **Trust & safety**: loyalty monitor (blocks disrespect, CEO alert)
- **Voice & screen**: vision capture (clamped 1568px), voice print (7 features), sentence-streaming TTS, conversation mode

---

## Tier 1 — Stability & Error Handling

- [ ] **T1.1 Refactor AxonProvider into hooks** — **M** — Split the 889-line provider into `useAxonState`, `useVoiceEngine`, `useConversationSummarizer`, `useMonitors`, `useKeyboardShortcuts`. Enables testing + reduces cognitive load.
- [x] **T1.2 Confirmation dialog timeout** — **S** — Pending confirms auto-expire after 30s with a cancel message so the UI never freezes.
- [x] **T1.3 Persist undo stack to localStorage** — **S** — Serialize on each action; restore on mount. "Undo that" should survive reload.
- [x] **T1.4 Action dispatch queue + rate limiting** — **M** — Queue outgoing tool calls, dispatch serially with a short cooldown. Prevents accidental double-fires.
- [ ] **T1.5 Offline fallback for brain downtime** — **M** — If Anthropic is unreachable, surface a helpful message + list 5 built-in voice macros so the assistant isn't dead.

## Tier 2 — UX & Discoverability

- [x] **T2.1 Inject available actions into system prompt** — **S** — Append the full action roster to the preamble so "what can you do?" has a real answer.
- [x] **T2.2 Voice-friendly `help` action** — **S** — Trigger on "help" / "what can I do". Returns top 10 actions with examples. Depends on T2.1.
- [ ] **T2.3 Low-confidence transcription toast** — **S** — When confidence < 0.55, non-modal toast: "Did you say '…'?" auto-dismisses.
- [ ] **T2.4 Editable transcript in SubtitleOverlay** — **M** — Click/tap the live transcript, edit, then submit the corrected text.
- [ ] **T2.5 Activity log search + replay** — **M** — Search past 50 activities; click one to re-run (with confirm).

## Tier 3 — Core Features

- [x] **T3.1 Persist automations to localStorage** — **M** — Survive reload; recalc `nextFire` on mount. Unblocks "remind me tomorrow".
- [ ] **T3.2 Cron-like scheduling** — **M** — `schedule_automation({ schedule: "0 9 * * *" })`. Depends on T3.1.
- [x] **T3.3 Multi-step workflow action** — **M** — `chain_commands({ commands: [...] })` so compound utterances don't re-prompt.
- [ ] **T3.4 Email drafting + sending** — **M** — `draft_email` + `send_email` (send is destructive, requires confirm). Needs backend email integration.
- [x] **T3.5 Complete announcements** — **S** — Finish the broadcast-table TODO in `announcements.ts`; `confirm_announcement` should actually post.
- [x] **T3.6 Recurring meetings** — **S** — Extend `create_meeting` schema with `recurrence: "daily" | "weekly" | "biweekly"` + optional end date.

## Tier 4 — Advanced UX & Capability

- [ ] **T4.1 Cross-operator memory persistence** — **M** — New `axon_memory` Supabase table (operator_id, notes, prefs, updated_at). Load on mount, sync on save.
- [ ] **T4.2 Structured DOM awareness** — **M** — Enhance `read_screen` to return table structure, interactive element positions, computed styles. Enables reliable "click the second row".
- [ ] **T4.3 Vision-feedback loop** — **S** — When vision captures, Claude narrates: "I see a chart with 3 lines…" before answering.
- [ ] **T4.4 Voice-print re-enrollment UI + test** — **M** — Settings button: re-enroll, then run a "say this phrase" test showing the similarity score.
- [x] **T4.5 Paginated data queries** — **S** — `limit` + `offset` on `list_tasks`, `list_undo`, registry searches. No more 200-cap.
- [ ] **T4.6 Prompt caching for actions + schemas** — **S** — Cache the action registry + tool schemas per operator; save tokens per turn.

## Tier 5 — Advanced Features

- [ ] **T5.1 Agent mode** — **L** — `navigate_and_complete({ task })`: chain `click_button` + `fill_input` in a loop until the task is done.
- [ ] **T5.2 Meeting transcription + recap** — **L** — If a meeting is detected, capture audio, transcribe via Whisper, summarize with Claude.
- [x] **T5.3 Call mode (bidirectional conversation)** — **L** — New mode where Axon speaks a question, waits for reply, continues naturally. Refactor `voiceInput` for continuous back-and-forth.
- [x] **T5.4 Proactive anomaly alerts** — **M** — Monitors run continuously; when a new anomaly fires, Axon interrupts and speaks: "Heads up — task overdue."
- [ ] **T5.5 Full-text search over Supabase** — **M** — `search_data({ table, query })` using PG FTS or Supabase vector. "Find invoices over $5000."

## Tier 7 — Outbound + Elite (per Axon's own self-assessment)

> Axon was asked what was missing and identified six gaps. These map
> across earlier tiers but several are entirely new. Listed here as a
> coherent push toward "elite" capability.

- [x] **T7.1 Generic outbound webhook** — **M** — `send_webhook` action that fires an HTTP POST to a registered URL with a JSON payload. Foundation for the rest of the outbound family.
- [x] **T7.2 Discord message send** — **S** — `send_discord_message` wrapping the webhook primitive with Discord's payload shape.
- [x] **T7.3 GitHub issue creation** — **M** — `create_github_issue` against api.github.com/repos/{owner}/{repo}/issues using a stored PAT.
- [ ] **T7.4 Google Calendar event** — **L** — `create_calendar_event` via Calendar API. Requires OAuth setup; may stub initially.
- [x] **T7.10 Voice catalog with British presets** — **M** — `engine/voiceCatalog.ts` with 10 curated presets across British / American / Australian, each bundling an ElevenLabs voice id + tuned `voice_settings` + Web-Speech fallback names + per-preset rate/pitch. Settings UI exposes grouped picker; `set_voice`, `list_voices`, `current_voice` actions let operator switch by voice ("British male", "warm female English voice").
- [x] **T7.11 Code-generation actions** — **L** — `engine/codegen.ts` + `actions/code.ts` give Axon a sandboxed workspace folder it can read/write inside via Tauri FS plugin. Actions: `set_workspace`, `current_workspace`, `list_workspace`, `read_workspace_file`, `generate_file`, `modify_file`, `scaffold_feature`, `delete_workspace_file`. Each mutating action snapshots prior content and registers an undo. Code generation calls Anthropic directly with a code-writer system prompt that forces single-fenced output. Capability JSON extended with `fs:scope` covering `$HOME`, `$DOCUMENT`, `$DESKTOP`, `$DOWNLOAD`.
- [x] **T5.1 Agent mode (Claude-Max-style autonomy)** — **L** — `engine/agent.ts` + `actions/agent.ts` wire an autonomous engineer loop: operator says "build X" → Claude plans + executes using the full tool registry without further prompting. Up to 14 iterations, narrates progress out loud between steps, falls back to "stuck" report if cap hit. Single entrypoint: `accomplish_goal({ goal, projectName? })`.
- [x] **T7.12 Multi-project workspaces** — **M** — `actions/projects.ts` adds `add_project`, `list_projects`, `switch_project`, `current_project`, `remove_project`. Each project stores `{ name, path, language?, notes? }`; active project's path becomes the workspace for all code-gen + agent actions. Voice-resolved by name ("switch to simplicity").
- [x] **T1.6 Voice dispatch latency** — **S** — Added an early-dispatch heuristic to `voiceInput.ts`: when the recognizer's interim transcript stops growing for 650ms while armed, force-finalize the command. Cuts perceived latency from ~1.8s (browser endpointing) to ~700ms — feels instant. Cooldown tightened from 1400ms to 700ms now that early-dispatch + final-dedup cover duplicate guards.
- [x] **T6.4 Thinking-state animation** — **S** — Orb now renders a distinct cyan-violet hue plus a rotating arc + counter-rotating outer ring + concentric pulse during `processing`/`executing`. A pill-shaped "Thinking…" / "Working…" badge sits below the orb so the operator can read the state at a glance.
- [x] **T7.5 Generic URL fetch** — **M** — `fetch_url` action that GETs a URL, returns text + a Claude-friendly summary. Lets the operator say "Axon, what does this page say?"
- [x] **T7.6 GitHub PR reader** — **S** — `read_github_pr` wraps fetch_url with GitHub-aware shape (title, body, diff stat).
- [x] **T7.7 Persistent session summary + decision log** — **M** — At session close (or every N turns), summarize and persist: what we discussed, decisions made, things deferred, work patterns. Surfaces in the next session's preamble so Axon "knows you" over time.
- [x] **T7.8 Voice-print gate on sensitive actions** — **M** — Wire the existing voicePrint enrollment to actually block destructive/CEO actions when the speaker doesn't match. Configurable threshold + whitelist of locked actions.
- [x] **T7.9 Credentials store** — **S** — `engine/credentials.ts` keyed localStorage backing for webhooks / API tokens, plus `set_credential` + `forget_credential` actions. Foundation for T7.1-T7.6.

## Tier 6 — Polish & Accessibility

- [ ] **T6.1 Keyboard shortcuts cheat sheet** — **S** — Settings pane: visual cheat sheet (Cmd+K, Esc, /, Ctrl+Space) + remapping.
- [ ] **T6.2 Export conversation history** — **S** — `export_session({ format: "json" | "markdown" | "pdf" })`.
- [ ] **T6.3 Screen-reader labels** — **S** — aria-labels on Orb, Panel; subtitle overlay as live region. WCAG compliance.

---

## Suggested order (first 3-4 hour sprint)

1. T1.2 confirm-dialog timeout (S) — fast safety win
2. T1.3 undo stack persistence (S) — fast UX win
3. T2.1 inject actions into preamble (S) — unblocks T2.2
4. T2.2 `help` action (S) — discoverability
5. T3.5 complete announcements (S) — unblock dead feature
6. T3.6 recurring meetings (S) — common need
7. T4.5 paginated data queries (S) — scaling
8. T1.4 dispatch queue (M) — robustness
9. T3.1 persist automations (M) — enables real scheduling
10. T1.1 refactor AxonProvider (M) — biggest architecture clean-up

Call mode (T5.3), agent mode (T5.1), and meeting recap (T5.2) are the
dream-tier features — tackle once Tiers 1-3 are solid.
