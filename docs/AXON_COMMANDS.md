# AXON — Commands & Behavior

> Everything AXON hears, how he decides, how he speaks, how to stop him,
> and how he carries context. Written for operators, not engineers.

---

## 1. The mental model

AXON operates in three **voice states** plus a handful of internal
**status indicators** that drive the orb.

```
┌──────────────────────────────────────────────────────────────┐
│                      VOICE STATES                            │
│                                                              │
│     ┌──────────┐    wake phrase    ┌──────────┐              │
│     │ STANDBY  │─────────────────▶ │  ARMED   │              │
│     │ (idle)   │◀─────────────────│ (ready)  │              │
│     └──────────┘  command or 10s   └──────────┘              │
│          │                                                   │
│          │ sleep phrase                                      │
│          ▼                                                   │
│     ┌──────────┐                                             │
│     │ DORMANT  │◀── resume phrase ──┐                        │
│     │ (muted)  │────────────────────┘                        │
│     └──────────┘                                             │
└──────────────────────────────────────────────────────────────┘
```

| State     | Meaning                                              | Orb visual        |
| --------- | ---------------------------------------------------- | ----------------- |
| Standby   | Listening only for the wake phrase                   | Slow plasma drift |
| Armed     | Wake phrase heard. Next utterance is the command.    | Brighter, active  |
| Dormant   | Soft-off. Only resume phrases are acted on.          | Desaturated, dim  |

**Status indicators** (separate from voice state, visible in the panel header):

| Status      | What it means                       |
| ----------- | ----------------------------------- |
| Idle        | Nothing happening                   |
| Listening   | Voice is armed, capturing command   |
| Thinking    | Claude is reasoning                 |
| Speaking    | Audio playing                       |
| Error       | Something failed                    |

---

## 2. How to talk to him

### Waking him
- **"Hey Axon"** — the canonical wake phrase.
- **Also accepted (fuzzy-matched):** "hey exxon", "hey action", "hey axel",
  "axon", "exxon", "action" — plus anything within one edit of "axon".
- **Chained commands work:** "Hey Axon, what's overdue?" fires the wake
  AND the command in one utterance. No need to pause.

### Putting him to sleep
- **"Axon, go to sleep"**
- **"Axon, stop listening"**
- **"Axon, standby"**
- **"Axon, go quiet"**
- **"Goodbye, Axon"**

### Waking him back up
- **"Axon, wake up"**
- **"Axon, activate"**
- **"Hey Axon, wake up"**
- **"Axon, come back"**

### Stopping him mid-speech
- **"Stop"**
- **"Shut up"**
- **"Quiet"** / **"Silence"**
- **"Never mind"** / **"Nevermind"**
- **"Hold on"** / **"Wait"**
- **"Cancel"**
- **"Axon, stop"** / **"Axon, shut up"**

These work **even while he's talking.** He'll cut off mid-syllable. No ack
on interrupt — silence is the acknowledgment.

### Fallback input
- **Push-to-talk:** `Ctrl+Space` (configurable in Settings)
- **Click the orb** to open the panel → type in the composer
- **Shortcuts:**
  - `Cmd/Ctrl+K` — toggle the panel
  - `Esc` — close the panel
  - `/` — focus the composer

---

## 3. Command catalog

Everything below can be said OR typed. AXON understands natural phrasing;
the listed wording is one shape among many.

### Briefing & awareness
- "Brief me" / "Give me a briefing" / "What do I need to know?"
- "What happened while I was away?"
- "What's on this screen?" / "What am I looking at?"
- "Run morning routine" — briefing + open tasks
- "Focus mode" — list overdue + open tasks
- "End of day" — summary of today's completions, signups, meetings

### Navigation
- "Take me to the finance dashboard"
- "Open tasks" / "Show me the employees page"
- "Go to Simplicity analytics"
- "Open the broadcast stage"
- "Go back"

### Company switching
- "Switch to Simplicity" / "Switch to Simplicity Funds"
- "Switch to CodeWithAli" / "Switch to CWA"
- "Show everything" / "Switch to all"
- "What company are we on?"

### Tasks
- "Create a task: review the budget logic, due Friday, high priority"
- "Add a task for the Simplicity team — deploy auth fixes"
- "What tasks are overdue?"
- "Show me this week's tasks" / "What's due this week?"
- "Mark the dashboard redesign as done" / "Mark that as done"
- "Start the API integration task"
- "Delete the task called X" *(asks for confirmation)*

### Meetings
- "Schedule a meeting tomorrow at 3pm called Q2 planning"
- "Book a hybrid meeting Friday at 10am with 5 attendees"
- "What meetings are coming up this week?"

### Data queries
- "How many users do we have?"
- "How many admins?"
- "How many users signed up today?"
- "Who signed up this week?"
- "How many rows in cwa_todos?"

### Announcements (two-step, safe)
- "Draft an announcement for the Simplicity team about the new budget feature"
- "Send it" *(confirms before broadcasting)*

### Automations & reminders
- "Remind me to review finance in 30 minutes"
- "Every hour, check overdue tasks"
- "Daily, run the morning routine"
- "List my automations"
- "Cancel automation [id]"

### Page control (DOM)
- "Type 'Q2 planning' in the title field"
- "Fill the description with [text]"
- "Click Save" / "Click the Submit button"

### Memory
- "Remember that I prefer end-of-week deadlines"
- "Remember that we're planning the Q2 roadmap this month"
- "Forget everything you know about me" *(confirms first)*

### Vision (requires `html2canvas` + `VITE_ANTHROPIC_API_KEY`)
- "Axon, what's on this screen?" — captures a screenshot and describes it
- "What does this chart show?"
- "Is this invoice formatted correctly?"
- "Take a look at this" / "What do you see?"
- Vision auto-triggers on keywords (see, look, chart, picture, screen).
  Set mode in Settings → Vision: **off / auto / always**.

### Undo & safety
- "Undo that" / "Revert" / "Take it back" — reverses the last mutation
- "What would undo do?" — previews the reversal
- "List undoable" — shows the stack (most recent first)
- "Dry run: [command]" — if you set dryRun in Settings, AXON describes the
  action without actually performing it

### Pronoun resolution
- "Mark **that** as done"
- "Open **the first one**"
- "What does **this** show?"
- "Create a task for **the thing we just talked about**"

AXON resolves these using two signals: the last few conversation turns, and
the visible text on your current page. No tool call needed — the brain sees
both in its preamble.

---

## 4. How AXON thinks

When you say something:

```
1. TRANSCRIBE   — browser gives text + confidence score (0–1)
2. CLASSIFY     — interrupt? wake? sleep? resume? command?
3. DEDUP        — same phrase within 2.5s? drop it.
4. PREAMBLE     — compose brain context:
                    • Operator name, role, company
                    • Current route, local time
                    • Persistent memory (recent notes + prefs)
                    • Prior conversation summary (if any)
                    • Visible screen text
5. REASON       — stream to Claude Sonnet with all registered tools
6. EXECUTE      — run any tool_use blocks via the executor
                    (role gate, confidence gate, confirmation if destructive)
7. RESPOND      — stream final text, chunked by sentence
8. SPEAK        — queue each sentence to TTS (ElevenLabs or Web Speech)
```

**The confidence gate is silent safety.** If your voice transcript came
through at < 55% confidence AND the action is destructive (delete, broadcast,
etc.), AXON forces a confirmation modal even if he'd normally skip it. You
can adjust the threshold in Settings.

**The brain is stateful within a session.** Each turn includes the recent
conversation. When history grows past 20 turns, the oldest get silently
summarized into a compressed block that stays in context.

**Memory is cross-session.** Notes and preferences persist in localStorage
for 30 days. AXON injects them into every brain call so continuity survives
reload.

---

## 5. How he speaks

### Voice
- Default: Web Speech Synthesis, picks the best available deep masculine
  voice (Google UK Male → Daniel → Microsoft Guy → Alex).
- With `VITE_ELEVENLABS_API_KEY` + a voice id set in Settings → ElevenLabs
  streaming. Recommended voice IDs: **Antoni** (`ErXwobaYiN019PkySvjV`),
  **Josh** (`TxGEqnHWrfWFTfGW9XjX`).

### Tone
- Casual, short, natural. Not butler-ish. No "As you wish." No filler
  openers like "Great question."
- 1–2 sentences is the default. Longer only on briefings.
- Addresses you by first name when it fits; doesn't overuse it.
- Closes with the outcome, not small talk.

### Cadence
- Text is sanitized before TTS: markdown stripped, em-dashes become commas,
  URLs dropped, lists flattened. He never reads "asterisk" aloud.

### Interruptibility
- Any of the interrupt phrases cut him off instantly. No ack — silence
  tells you it worked.
- Starting to speak while he's speaking also works: recognition pauses
  during his speech, but interrupt phrases bypass the pause.

---

## 6. How he reacts to mistakes

| Situation                            | What he does                                           |
| ------------------------------------ | ------------------------------------------------------ |
| Missing API key                      | One short sentence. Panel shows the fix detail.        |
| API 401 / auth error                 | "I can't reach my brain — the API key is invalid."     |
| API 404 / bad model                  | "The model I'm configured to use isn't available."     |
| API 429 / rate limit                 | "I'm hitting rate limits — give me a moment."          |
| API 5xx                              | "My brain is having trouble. Try again in a sec."      |
| Network drop                         | "I lost the connection. Try again."                    |
| Action throws                        | Short summary in speech, full error in activity log.   |
| Confidence < 55% + mutating action   | Forced confirmation modal regardless of action rules.  |
| Action not found                     | "I don't know how to do that yet."                     |
| Role not permitted                   | Silent skip (the action won't appear in his tools).    |

Raw error JSON, stack traces, and request IDs are **never spoken**. They go
to the panel as a system note for debugging.

---

## 7. Proactive behaviors

AXON isn't purely reactive. He'll speak up on his own for:

### Auto-greet on app open
- Fires ~1.6s after the authenticated app mounts.
- One of four warm lines, keyed to your first name.
- Local — no brain round-trip. Always reliable.

### Route observations
When you navigate, if there's something notable, AXON adds one short line:
- On `/task` → "Three overdue tasks here."
- On `/schedule` → "Two meetings in the next week."
- On `/financialDashboard` → "Finance dashboard open. Ask me for the biggest
  line items."
- On Simplicity screens → brief context line.

Rate-limited to one observation every 25 seconds. Silent on unknown routes.
Toggle in Settings → Auto-greet (treated the same way) or through
`proactiveRouteObservations` in config.

### Anomaly monitors
Background checks (configurable per-monitor in Settings):

- **Overdue tasks** — every 5 minutes, alerts if any task is past deadline.
- **New signups** — every minute, alerts if new rows appear in `app_users`
  since the last check.

Alerts surface in the subtitle overlay AND the conversation. Preceded by
"Heads up —".

### Session automations
Anything you schedule — "remind me in 30 minutes", "every hour check
overdue" — fires in-session. Listed under Settings → Active automations.
**Not persistent across reloads** by design.

---

## 8. Settings (click orb → Settings tab)

| Setting                   | Default            | What                                        |
| ------------------------- | ------------------ | ------------------------------------------- |
| AXON enabled              | On                 | Master on/off                               |
| Always-on listening       | On                 | Continuous mic for wake phrase              |
| Auto-greet on open        | On                 | One-shot proactive greeting                 |
| Wake word                 | "hey axon"         | The canonical wake phrase                   |
| Sleep phrases             | 5 defaults         | Comma-separated; edit freely                |
| Resume phrases            | 4 defaults         | Phrases that move from dormant → standby    |
| Interrupt phrases         | 7 defaults         | Words that cut speech mid-sentence          |
| Push-to-talk shortcut     | `Control+Space`    | Fallback activation                         |
| Preferred voice           | Auto               | Pick any available synthesis voice          |
| Rate / Pitch / Volume     | 1.02 / 0.95 / 1.0  | TTS tuning                                  |
| ElevenLabs voice id       | Unset              | Enables premium voice if key is set         |
| Anomaly monitors          | None on            | Pick which monitors run                     |
| Confidence threshold      | 0.55               | Below this → forced confirm on mutations    |
| Dry-run mode              | Off                | Mutating actions describe without doing     |
| Vision mode               | Auto               | Off / Auto / Always capture screenshots     |
| Voice identity            | Off                | Enroll your voice as a best-effort filter   |
| Voice match threshold     | 0.70               | Cosine similarity minimum for voice match   |

Settings persist in `localStorage` at key `axon:settings:v3`.

---

## 9. Cheat sheet — one-line reference

```
WAKE        : Hey Axon              SLEEP  : Axon, go to sleep
RESUME      : Axon, wake up         STOP   : Stop | Shut up | Cancel

NAVIGATE    : Take me to <page>     BACK   : Go back
COMPANY     : Switch to <company>   WHICH  : What company are we on?

TASKS       : Create a task <...>   DONE   : Mark <X> as done
              What's overdue?       DELETE : Delete the <X> task
              What's due this week?

MEETINGS    : Schedule a meeting <...>
              What meetings are this week?

DATA        : How many users?       SIGNUPS: Who signed up today?
              How many admins?      COUNT  : How many rows in <table>?

ANNOUNCE    : Draft an announcement <...>
              Send it

AUTOMATE    : Remind me in <time>   LIST   : List automations
              Every <cadence> <...> CANCEL : Cancel automation <id>

PAGE        : Type <X> in <field>   CLICK  : Click <Save>
              What's on screen?

MEMORY      : Remember that <...>   FORGET : Forget everything you know

ROUTINE     : Run morning routine   EOD    : Run end of day
              Focus mode            LIST   : What routines do you know?

BRIEF       : Brief me              RECAP  : What happened while I was away?
```

---

## 10. Edge cases to know

- **He won't talk over himself.** If you fire a new command while he's
  speaking, the previous speech cuts off.
- **He won't listen to himself.** The mic is muted during his TTS so he
  never hears his own voice as input. Only interrupt phrases bypass this.
- **He respects role gates.** An action can set `allowedRoles: ["CEO"]` to
  restrict it; your role is checked before the action runs.
- **He treats "that"/"this" as the most recent relevant thing.** Could be
  from the last AXON turn, the last user turn, or what's visible on
  your screen.
- **He'll say no.** If voice confidence was low and the action is
  destructive, he'll force a confirmation even if you didn't expect one.
- **Drafts are never sent without confirmation.** An announcement draft
  stays in session memory until you say "send it" — and even then the
  system re-confirms.
- **Memory ages out.** Persistent notes older than 30 days are dropped
  automatically.

---

## 11. What AXON isn't (yet)

Honest boundaries:

- **Voice identity is best-effort, not security.** The pitch/timbre
  filter rejects most background voices but is not authentication.
  Use role gates for real security.
- **Vision requires html2canvas.** Without it installed, AXON falls
  back to text-only perception.
- **No true offline mode.** He needs the Anthropic API for reasoning.
  Web Speech works offline but he won't understand you without Claude.
- **No persistent automations.** Scheduled commands are session-scoped.
  A reload drops them.
- **Undo stack is session-only.** The audit log persists, but the
  reversal functions don't survive reload. Once you close the app,
  you can't undo what happened yesterday.
- **No cross-device sync.** Memory is per-machine.
- **No learning over time within a session beyond the summary.** He
  won't infer new preferences unless you tell him explicitly with
  "remember that ...".

---

## 12. When in doubt

- **"Axon, what can you do?"** — he'll rattle off his capabilities.
- **"Axon, list your routines."** — for the named chains.
- **"Axon, what's on this screen?"** — tests that he sees the page.
- **"Axon, which company are we on?"** — quick state check.

If he goes silent and you don't know why, check the three things in order:

1. The subtitle overlay — any system note about mic or API?
2. Settings → Always-on listening toggle.
3. Dev console (`[AXON]` filter) — warnings will tell you the story.

### Visual aids — see what Axon is doing

- **Mind Map** — Open the Command Panel → "Mind" tab. Live graph of
  every step Axon takes: prompt → tool calls → file touches →
  summary. Click any node to inspect its details. Click the maximize
  button (⤢) to expand to full-screen.
- **Replay** — When a session has more than one event, a scrubber
  appears at the bottom of the Mind Map. Drag the slider to rewind
  through events one at a time, hit ▶ to auto-advance, toggle
  1× / 2× / 4× to control speed. Click ● Live to resume real-time.
- **DiffOverlay** — Whenever Axon writes or modifies a file, a glassy
  diff card slides in from the top-right edge of the screen showing
  exactly what changed (green adds, red dels). Auto-hides after 7s
  unless you pin it. Click any past write/modify node in the Mind
  Map to re-open its diff.

### Simulation mode

Toggle simulation mode (`useAxon().setSimulationMode(true)`) before
issuing a goal and Axon will plan the entire chain WITHOUT actually
running mutating actions. Every generate_file / modify_file /
delete_workspace_file call returns a synthetic success; the Mind
Map renders those nodes with a dashed border and an amber **SIM**
badge. Read-only actions (find_file, read_workspace_file) still run
normally so the plan accounts for the real workspace state. Toggle
back off and re-issue the same goal to actually execute.

### Cross-turn memory

Each new agent run reads the last 2-3 sessions from the Mind Map
graph store and includes a "Recent file activity" block at the top
of its first prompt. So when you say "now wire it into the home
page" right after Axon created a component, it already knows where
both files live and goes straight to `modify_file` instead of
re-running `find_file`. No special syntax needed — just speak
naturally across turns.

### Workspace picker fallback

Say `set workspace` with a verbal path. If the path doesn't exist,
or is outside Tauri's static fs:scope, the folder picker dialog
auto-pops so you can correct it in one click — the picker also
extends Tauri's runtime scope to the chosen folder, so subsequent
`generate_file` calls work without "forbidden path" errors.

