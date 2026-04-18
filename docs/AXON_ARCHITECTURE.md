# AXON — Architecture

> AXON is the voice-driven command-intelligence layer inside Takeover. This
> document is the engineering map: how it's wired, where each piece lives, and
> where to make changes.

---

## 1. The 30-second version

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AXON (admin-gated)                          │
│                                                                     │
│    ┌──────────────┐       ┌──────────────┐      ┌──────────────┐   │
│    │ VOICE INPUT  │──────▶│  PROVIDER    │─────▶│ VOICE OUTPUT │   │
│    │ Web Speech   │intent │  (context +  │speak │ WebSpeech /  │   │
│    │ + wake word  │       │  state mach.)│      │ ElevenLabs   │   │
│    └──────────────┘       └──────┬───────┘      └──────────────┘   │
│                                  │                                  │
│                                  ▼                                  │
│                          ┌──────────────┐                           │
│                          │   BRAIN      │  claude-sonnet-4-6        │
│                          │   (streams   │  tool-use loop            │
│                          │   via SSE)   │  screen + memory preamble │
│                          └──────┬───────┘                           │
│                                 │ tool_use                          │
│                                 ▼                                   │
│                          ┌──────────────┐                           │
│                          │   EXECUTOR   │  (confidence gate,        │
│                          │              │   role gate, confirm)     │
│                          └──────┬───────┘                           │
│                                 ▼                                   │
│                  ┌────────────────────────────┐                     │
│                  │      ACTION REGISTRY       │                     │
│                  │  nav · company · tasks ·   │                     │
│                  │  meetings · data · dom ·   │                     │
│                  │  memory · routines · ...   │                     │
│                  └────────────────────────────┘                     │
│                                                                     │
│    ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐      │
│    │   ORB        │   │ COMMAND PANEL│   │ SUBTITLE OVERLAY │      │
│    │ (canvas)     │   │ (glass UI)   │   │ (floating caps)  │      │
│    └──────────────┘   └──────────────┘   └──────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

AXON mounts inside `src/routes/__root.tsx` as a lazy-loaded tree, only for
users with role `Admin`, `CEO`, or `COO`. Everything else in the Takeover app
runs untouched.

---

## 2. File map

```
src/Axon/
├── index.ts                      ← lazy-loaded entry, exports AxonRoot
├── AxonRoot.tsx                  ← role gate + provider + mounted UI
├── AxonProvider.tsx              ← the context. Wires engines + UI.
├── types.ts                      ← every cross-cutting type
├── config.ts                     ← env, constants, system prompt
├── axon.css                      ← scoped styles (uses --brand-accent)
│
├── engine/                       ← pure logic, no React
│   ├── brain.ts                  ← Claude SSE streaming + tool loop + vision
│   ├── executor.ts               ← dispatch actions + role/confidence/audit
│   ├── voiceInput.ts             ← Web Speech Recognition + wake/sleep FSM
│   ├── voiceOutput.ts            ← Web Speech Synthesis + ElevenLabs stream
│   ├── monitors.ts               ← background anomaly checks
│   ├── memory.ts                 ← persistent local store (localStorage)
│   ├── summarizer.ts             ← compress old turns via Claude
│   ├── screenContext.ts          ← capture visible page text for "this/that"
│   ├── visionCapture.ts          ← screenshot capture for Claude vision
│   ├── routeObservations.ts      ← proactive one-liners on navigation
│   ├── auditLog.ts               ← persistent mutation log
│   ├── undoStack.ts              ← session-scoped reversible actions
│   └── voicePrint.ts             ← voice identity fingerprint + verify
│
├── actions/                      ← all tools AXON can invoke
│   ├── registry.ts               ← register / list / build tool defs
│   ├── index.ts                  ← registerAllActions() called on provider mount
│   ├── navigation.ts             ← navigate, go_back
│   ├── company.ts                ← switch_company, which_company
│   ├── tasks.ts                  ← CRUD against cwa_todos (dry-run + undo)
│   ├── meetings.ts               ← create_meeting against cwa_meetings
│   ├── data.ts                   ← count_users, recent_signups, etc.
│   ├── briefing.ts               ← brief_me (compound action)
│   ├── announcements.ts          ← draft_announcement + confirm_announcement
│   ├── automations.ts            ← schedule/list/cancel (session-scoped)
│   ├── dom.ts                    ← fill_input, click_button, read_screen
│   ├── memory.ts                 ← remember_note, set_preference
│   ├── routines.ts               ← run_routine (morning, focus, eod)
│   └── trust.ts                  ← undo_last, list_undoable, what_would_undo
│
└── ui/
    ├── Orb.tsx                   ← plasma sphere canvas
    ├── CommandPanel.tsx          ← slide-in glass panel (4 tabs)
    ├── SubtitleOverlay.tsx       ← floating captions near orb
    ├── AxonSettings.tsx          ← settings pane inside the panel
    ├── ConfirmDialog.tsx         ← modal for destructive actions
    └── quickCommandsMap.ts       ← per-route contextual chips
```

---

## 3. How a command flows (end-to-end)

Follow one utterance, "Hey Axon, what's overdue?", from mic to speech:

```
 1. MIC INPUT
    Browser captures audio → webkitSpeechRecognition emits interim +
    final results on `onresult`.

 2. VOICE INPUT ENGINE   (engine/voiceInput.ts)
    handleFinal(text, confidence):
      – Dedup check (cooldown + last-dispatched cache)
      – Fuzzy wake match: "hey axon" / "hey exxon" / "hey action"
      – State machine: standby → armed → dispatch({command})

 3. PROVIDER             (AxonProvider.tsx)
    onIntent({kind: "command"}) → submitCommand(text, "voice", confidence)
      – Append user turn to conversation
      – setStatus("processing")
      – voiceOutRef.interrupt()  (kills any prior speech)

 4. BRAIN                 (engine/brain.ts)
    runTurn(text, history, ctx, {confidence, summary, onSentence}):
      – Build preamble: operator + company + path + time + memory +
        summary + <visible_screen>
      – serializeHistory: alternating user/assistant messages
      – POST /v1/messages stream=true → parse SSE events
      – Text deltas → chunker → onSentence callback → queueSentence
      – Tool use events → execute via executor

 5. EXECUTOR              (engine/executor.ts)
    executeAction(name, input, ctx, {confidence}):
      – Look up action in registry
      – Role gate check
      – Low-confidence + mutating + !requiresConfirmation →
        forced confirmation prompt
      – Call action.handler(input, ctx)

 6. ACTION                (actions/data.ts :: list_tasks)
    Query Supabase → log activity → return { summary, data }

 7. BRAIN (continued)
    Receive tool_result → generate final text response → stream

 8. VOICE OUTPUT          (engine/voiceOutput.ts)
    queueSentence("Three overdue...") → drain queue:
      – if elevenLabsVoiceId + VITE_ELEVENLABS_API_KEY → stream MP3
      – else → Web Speech Synthesis utterance
    onStart → setMuted(voice_input) so AXON doesn't hear himself

 9. SUBTITLE OVERLAY      (ui/SubtitleOverlay.tsx)
    Picks latest axon turn → shows captions near orb

10. ORB CANVAS            (ui/Orb.tsx)
    Reads status from ref every frame → "speaking" state →
    pulse rings + intensity bloom
```

---

## 4. The three layers — who owns what

### Layer 1: Voice (real-time I/O)

```
voiceInput.ts  ← browser SpeechRecognition, state machine, dedup
voiceOutput.ts ← synthesis + ElevenLabs, sentence queue, self-mute
```

These are plain TypeScript classes. **No React.** They know nothing about the
rest of the app. They communicate via callbacks (onIntent, onStart, etc.).

### Layer 2: Brain (reasoning)

```
brain.ts       ← Claude SSE streaming + tool loop
executor.ts    ← validates + dispatches actions
screenContext.ts ← DOM scraping
memory.ts      ← persistent notes and prefs
summarizer.ts  ← compress old turns
```

The brain calls Anthropic's API directly from the renderer with the
`anthropic-dangerous-direct-browser-access` header. Acceptable for a Tauri
desktop app; proxy through a server if you ship a web build.

### Layer 3: Actions (capabilities)

Each action is a TypeScript object with `name`, `description`, `input_schema`,
and `handler`. Registering one is the ONLY thing needed to give AXON a new
capability — the brain will auto-include it in tool definitions.

```ts
registerAction({
  name: "my_thing",
  description: "What it does — sent to Claude verbatim.",
  input_schema: { type: "object", properties: { … }, required: [] },
  mutating: true,          // optional; triggers confidence gating
  requiresConfirmation: false, // optional; forces confirm dialog always
  handler: async (input, ctx) => {
    // ctx.operator, ctx.activeCompany, ctx.navigate, ctx.speak, ctx.logActivity
    return { summary: "what I did", data: { … } };
  },
});
```

---

## 5. State — where it lives

| State                        | Lives in                         | Persistence                |
| ---------------------------- | -------------------------------- | -------------------------- |
| Settings                     | `AxonProvider` → localStorage    | `axon:settings:v3`         |
| Persistent memory            | `engine/memory.ts` → localStorage| `axon:memory:v1` (30d cap) |
| Audit log                    | `engine/auditLog.ts` → localStorage | `axon:audit:v1` (200 rows) |
| Undo stack                   | `engine/undoStack.ts` module     | **Session only** (20 cap)  |
| Conversation turns           | `AxonProvider` state             | **Session only**           |
| Activity log                 | `AxonProvider` state             | **Session only**           |
| Session automations          | `actions/automations.ts` module  | **Session only**           |
| Voice state (standby/armed)  | `VoiceInput` instance            | **Session only**           |
| Voice print vector           | Settings → localStorage          | Persistent (via settings)  |
| Orb position                 | `AxonProvider` state             | Session (reset on reload)  |
| Conversation summary         | `AxonProvider` ref               | Session only               |

---

## 6. The six UI surfaces

```
┌─────────────────────────┐  Plasma sphere (canvas-drawn)
│         ORB             │  ← click to open panel, drag to move
└─────────────────────────┘  Always visible when admin

     ╔═══════════════════╗   Floating captions near orb
     ║ SUBTITLE OVERLAY  ║   ← auto-fades after 4s idle
     ╚═══════════════════╝   Shows current speech + last user turn

                     ┌────────────────────┐
                     │  COMMAND PANEL     │  Slide-in glass panel
                     │  ├── Conversation  │  ← Cmd+K to toggle
                     │  ├── Activity      │  3 tabs, voice + type
                     │  └── Settings      │
                     └────────────────────┘

                     ┌────────────────────┐
                     │  CONFIRM DIALOG    │  Modal for destructive ops
                     └────────────────────┘

                     ┌────────────────────┐
                     │  FOCUS CUE         │  Halo on acted-on element
                     └────────────────────┘  (fill_input, click_button)
```

---

## 7. Key lifecycles

### Session bootstrap

```
1. User passes pin + login → isLoggedIn === "true"
2. __root.tsx mounts <AxonRoot> (lazy)
3. AxonRoot checks role → if admin, render provider + UI
4. AxonProvider runs registerAllActions() (idempotent module-load)
5. Provider effects fire:
   - Load persisted settings
   - Init voice input with mic permission request
   - Init voice output
   - Start monitors (if enabled)
   - Start keyboard shortcuts
   - Schedule auto-greet timer (1.6s)
   - Update memory.lastSeen every 60s
6. Auto-greet fires → one of 4 warm lines → voice output → subtitle
```

### Wake word heard

```
standby ── "hey axon" heard ──▶ armed (10s window)
                                  │
                                  ├─ command heard → dispatch → standby
                                  └─ 10s elapsed → standby
```

### Sleep / resume

```
any awake state ── "axon go to sleep" ──▶ dormant
dormant         ── "axon wake up"     ──▶ standby
```

### Destructive action

```
brain → tool_use "delete_task" ─┐
                                ├─▶ requiresConfirmation? ──▶ modal
                                │                            │
                                │                            ├─ confirm → run
                                │                            └─ cancel → abort
                                │
                                └─▶ low confidence + mutating ──▶ modal
                                                                 (safety net)
```

### Conversation summarization

```
Every submitCommand → conversation grows by 2
                    │
                    ▼
conversation.length >= 20 ──▶ summarizeTurns(oldest N except last 8)
                             │
                             ├─ silent Claude call → summary text
                             │
                             ▼
                      summaryRef = summary
                      setConversation(last 8 turns)
                      (next brain call includes summary in preamble)
```

---

## 8. Extending AXON — a cheat-sheet

### Add a new action

| Step | File                                   | What                           |
| ---- | -------------------------------------- | ------------------------------ |
| 1    | `actions/your-action.ts` (new)         | Define the `AxonAction`        |
| 2    | `actions/index.ts`                     | Register in `registerAllActions` |
| 3    | (optional) `ui/quickCommandsMap.ts`    | Add a chip for the action      |

Nothing else changes. The brain auto-discovers it.

### Add a new monitor

| Step | File                       | What                                        |
| ---- | -------------------------- | ------------------------------------------- |
| 1    | `engine/monitors.ts`       | Append to `MONITORS` array                  |
| 2    | Settings panel (automatic) | Shows up in toggles                         |

### Add a new route observation

| Step | File                              | What                                |
| ---- | --------------------------------- | ----------------------------------- |
| 1    | `engine/routeObservations.ts`     | Add a `if (p === "/…")` branch      |

### Tune voice behavior

| Want to change…         | File                           |
| ----------------------- | ------------------------------ |
| Wake variants accepted  | `engine/voiceInput.ts` → `AXON_VARIANTS` |
| Sleep/resume phrases    | `types.ts` → `DEFAULT_SETTINGS` (then bump `AXON_SETTINGS_KEY`) |
| Interrupt words         | `config.ts` → `INTERRUPT_PHRASES` |
| Wake ack lines          | `config.ts` → `WAKE_ACKS`      |
| Dispatch cooldown ms    | `AxonProvider.tsx` → `dispatchCooldownMs` in VoiceInput config |
| System prompt / persona | `config.ts` → `SYSTEM_PROMPT`  |
| Model (sonnet/opus/haiku) | `config.ts` → `CLAUDE_MODEL` |

### Change the orb visual

Everything is in `ui/Orb.tsx` → the `draw()` render loop. Layer order:

1. Ground shadow
2. Outer aura
3. Sphere body (luminous radial)
4. Plasma waves (additive)
5. Inner core
6. Soft rim
7. Speaking wisps
8. Orbiting dust

Each layer is a self-contained block you can tune or replace.

### Add a UI surface

Mount under `<AxonRoot>` in `AxonRoot.tsx`, inside the `<AxonProvider>`. Call
`useAxon()` to read state. Respect `data-axon` scoping on your root element.

### Add a settings toggle

1. `types.ts` → add field to `AxonSettings` + default in `DEFAULT_SETTINGS`
2. `config.ts` → bump `AXON_SETTINGS_KEY` so old users get the new default
3. `ui/AxonSettings.tsx` → add a row with the toggle

### Ship a breaking setting change

Always bump `AXON_SETTINGS_KEY` in `config.ts`. Old settings get discarded
cleanly and the new defaults win.

---

## 9. Dependency graph (who imports who)

```
                ┌───────────────┐
                │ AxonRoot      │
                └──────┬────────┘
                       │
                ┌──────▼────────┐
                │ AxonProvider  │
                └──────┬────────┘
          ┌────────────┼──────────────┬─────────────┐
          │            │              │             │
    ┌─────▼─────┐ ┌────▼─────┐ ┌──────▼──────┐ ┌────▼────┐
    │ VoiceIn   │ │ VoiceOut │ │ brain.ts    │ │ ui/*    │
    └─────┬─────┘ └──────────┘ └──────┬──────┘ └─────────┘
          │                           │
          │                    ┌──────▼──────┐
          │                    │ executor.ts │
          │                    └──────┬──────┘
          │                           │
          │                    ┌──────▼──────┐
          └───────────────────▶│ registry.ts │
                               └──────┬──────┘
                                      │
                               ┌──────▼──────┐
                               │ actions/*   │
                               └──────┬──────┘
                                      │
                             ┌────────┴────────┐
                             │ Supabase        │
                             │ Tauri plugins   │
                             │ DOM             │
                             └─────────────────┘
```

Rules:

- `engine/*` never imports `ui/*`.
- `actions/*` never import React or UI.
- UI talks to engine only through the provider's context.

---

## 10. The environment variables

Set these in `.env` at the project root:

| Variable                    | Required | What                                  |
| --------------------------- | -------- | ------------------------------------- |
| `VITE_ANTHROPIC_API_KEY`    | **Yes**  | Claude Sonnet for the brain           |
| `VITE_ELEVENLABS_API_KEY`   | No       | Unlocks ElevenLabs streaming voice    |

Both are referenced in `src/Axon/config.ts`. If missing, AXON falls back
gracefully: no key → spoken error "I'm not hooked up to my brain yet." No
ElevenLabs key → Web Speech Synthesis.

---

## 11. Known constraints

- **Speech Recognition is browser-specific.** Tauri's WebView2 on Windows
  supports `webkitSpeechRecognition`, but it's not an official web standard.
  If you ever move to a non-Chromium WebView, replace `voiceInput.ts` with a
  native Tauri mic capture + local transcription model.
- **Automations don't survive reload.** They're in-memory only. Persist to a
  server table if you need durable schedules.
- **API key in the renderer.** Safe for a Tauri desktop tool; NOT safe for a
  public web build. Proxy through a backend in that case.
- **No speaker verification.** Anyone with mic access and admin role can talk
  to AXON. Tighten with voiceprint auth if needed.

---

## 12. Quick diagnostic checklist

AXON isn't greeting / waking / speaking — run through:

1. **Fully restart** `bun run tauri dev` (Vite doesn't re-evaluate
   `AXON_SETTINGS_KEY` on hot reload).
2. **Is the role admin?** Only `Admin` / `CEO` / `COO` see AXON.
3. **Check the subtitle on boot** — does it show a system note about mic
   permission being denied?
4. **Open dev tools → Console** (right-click in Tauri window → Inspect) →
   filter for `[AXON]`. All warnings are prefixed.
5. **Open Settings tab in the panel** — verify "Always-on listening" and
   "Auto-greet" are on.
6. **Windows mic access** — Settings → Privacy → Microphone → Desktop apps on.

If PTT (Ctrl+Space) works but wake word doesn't — continuous recognition is
running but the transcript isn't matching. Say something short and clear;
check the "HEARING" overlay shows up.

If nothing happens at all — either recognition isn't running (mic denied)
or the app doesn't recognize you as admin. The first system note in the
conversation tab will usually tell you which.
