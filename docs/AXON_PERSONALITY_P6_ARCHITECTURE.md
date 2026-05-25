# P6 — Personality Settings UI: architecture proposal

**Status:** awaiting operator sign-off. No component code until sign-off.

**Scope:** ten sliders, preset picker, master toggle, "Test current personality" button. Live persistence, no surprise behavior, same runTurn path as production for the test.

This doc answers the seven specific concerns from the brief, grounded in the
actual code I read (`src/Axon/ui/AxonSettings.tsx` 561 lines,
`src/Axon/AxonProvider.tsx` 1289 lines).

---

## 0. Context discovered from reading the code

Things I confirmed before writing this proposal:

1. **There is no tabbed surface today.** `AxonSettingsPane` is one vertical
   scrolling pane with stacked `<div className="axon-settings-group">`
   sections (Master, Autonomy, Vision, Voice identity, Wake/Sleep, Voice,
   Code generation, Monitors, Automations, Confidence). "Personality tab"
   from the brief means "new section in this same pane."

2. **Existing settings flow through `updateSettings()`** which writes the
   `AxonSettings` blob to `axon:settings:v5`. The personality engine writes
   to its own namespace (`axon:settings:personality` + `axon:settings:personalityEnabled`).
   These two persistence layers stay separate per the namespace decision —
   the Personality section uses my `personality/settings.ts` helpers
   directly, not `updateSettings()`. This keeps "reset engine settings" and
   "reset personality settings" as two distinct operations even when they
   appear in the same UI surface.

3. **`submitCommand(text, modality, confidence)`** is the provider's public
   entry point for sending text through Axon. It chains through `inFlightRef`
   (serialized queue) → `runCommand` → builds `ActionContext` → calls `runTurn`
   with the personality payload (now wired in PR #2) → streams sentences to
   `voiceOutRef`. The test button must NOT use `submitCommand` because that
   appends a user-turn + axon-turn to `conversation` state, which pollutes
   the main chat panel. The test result needs to render inline in settings,
   not in the conversation.

4. **CSS conventions in this pane:** `axon-settings-group`, `axon-settings-label`,
   `axon-settings-row`, `axon-switch` (checkbox), `axon-settings-range` (slider),
   `axon-settings-select`, `axon-settings-input`, `axon-btn`, `axon-hint`. I'll
   re-use these classes for visual consistency — no Tailwind in this surface.

---

## 1. WHERE the Personality section slots in

**Order:** insert directly after **Master**, before **Autonomy**.

Reasoning: Master controls whether Axon exists / listens at all. Personality
controls who he is when he runs. Autonomy / Vision / Voice are progressively
more technical concerns. Putting Personality second makes the section read
top-down as "exist → identity → behavior knobs → integrations."

**Label:** `Personality (beta)`. The `(beta)` is a small chip next to the
group label, same visual weight as the `ACTIVE` chip on the forced-sleep
row. Signals "this is opt-in and may change" without burying the section.

**No icon** — the existing groups don't use icons, just text labels. Adding
one for Personality would break visual consistency.

---

## 2. HOW the sliders persist

**Write-on-debounce, 300ms after last move.** Your lean was right. Users
drag back and forth to feel out a value, and write-on-release commits each
fiddle. 300ms debounce means "user stopped moving, that's their answer."

Implementation:

```
- Component holds local React state for the 10 dimension values
  (immediate paint, no jank).
- A single useEffect with a 300ms setTimeout debouncer calls
  writePersonalitySettings(...) when local state stabilizes.
- The timer resets on every state change.
- On unmount, flush immediately so a half-typed value still persists.
```

Live-preview (composed prompt char count) updates every keystroke — that's
local-only, no persistence cost.

**Preset selection** is write-on-click — no debounce needed, single discrete
event. When a preset is picked, we update both `preset` AND `dimensions` in
the blob so a later flip back to "custom" preserves the preset's values as
the operator's last-known-good slider position.

---

## 3. WHAT the "Test current personality" button does

End-to-end, same path as a real voice command, with one isolation difference:
result does NOT enter the main conversation history.

**Pipeline:**

1. User types a test prompt in a textarea (default: "Hey, how's the build going?").
2. User clicks **Test**.
3. Button enters loading state with spinner + "Composing…" copy.
4. Provider exposes a new method `runPersonalityTest(text: string)` that:
   - Reads the LIVE personality payload via `getPersonalityTurnPayload()`
     (same call the submitCommand path uses, so settings flips during a
     test reflect on the next click without refresh).
   - Builds the same `ActionContext` via `buildActionContext()`.
   - Calls `runTurn(text, [], ctx, { ...payload, onSentence: ttsSpeak })`
     directly — bypassing `submitCommand` so conversation state stays
     untouched. The empty `[]` history means each test is a clean turn
     (no prior context), which is what you want for A/B feel testing.
   - Streams sentences to the SAME `voiceOutRef.current?.queueSentence(s)`
     pipeline as production. ElevenLabs voice id, rate/pitch/volume all
     come from the existing AxonSettings, not from anywhere new.
   - Returns `{ assistantText, fallback, fallbackReason }` to the caller.
5. Settings UI renders `assistantText` inline in a result panel under the
   test composer. Voice plays automatically.
6. Button returns to "Test" label.

**One thing I want explicit confirmation on:** should the test response
COUNT toward the post-processor opening-history tracker? It reads / writes
`axon:opening-history` in localStorage to detect "you started two replies
the same way." If test responses count, the operator burns through that
history quickly while iterating. My lean: **the test path passes
`trackOpenings: false` to the post-processor.** Tests are exploration, not
production speech. Confirm/revise.

---

## 4. HOW slider changes propagate to next test press without refresh

The provider's `runPersonalityTest` calls `getPersonalityTurnPayload()` at
**click time**, not at component mount time. That function reads
localStorage live (no caching). So:

- User drags sliders.
- 300ms after they stop, settings persist to `axon:settings:personality`.
- User clicks Test.
- `runPersonalityTest()` fires → calls `getPersonalityTurnPayload()` →
  reads the fresh blob → composes the prompt with the new values.

No state plumbing through React. The localStorage round-trip IS the
propagation mechanism, and it's the same one the provider already uses
every turn. No risk of UI state and engine state drifting because they
read the same key.

**Edge case:** if the user is mid-drag when they click Test (slider not
yet debounced to storage), the click captures the stale persisted value.
Mitigation: the Test click triggers an immediate flush of any pending
debounce before reading. Trivial — call the flush function before calling
`runPersonalityTest`.

---

## 5. LOADING and ERROR states for the test button

**Loading:**

- Button disabled.
- Inline spinner replaces icon, label changes to "Composing…".
- Below the button: a small pulsing dot + "Axon is thinking" line.
- Result panel shows skeleton ghost (3 grey lines, ~80% width) so the
  layout doesn't jump when the response lands.

**Errors:**

- **Anthropic API fails** (missing key, network error, 429):
  - Button returns to "Test" label.
  - Result panel shows a red-tinted card with the humanized error from
    `runTurn`'s `assistantText` (the brain already humanizes 429s, missing
    keys, etc.). No raw JSON.
  - Voice does NOT speak the error — silent failure on the audio side
    matches the rest of the app's error handling.

- **TTS fails but Claude succeeded:**
  - Result panel renders the text normally.
  - Small "Voice unavailable — text only" hint below the result.
  - This is rare (ElevenLabs key missing or browser blocks autoplay) but
    common enough to handle.

- **Double-click:**
  - First click sets a `testInFlightRef` boolean.
  - Second click while in-flight is a no-op (button is already disabled
    via state, but the ref is a belt-and-suspenders against a state
    update race).
  - If the user really wants to bail mid-test, a "Cancel" button appears
    next to "Composing…" that calls `voiceOutRef.current?.cancel()` and
    aborts the in-flight runTurn (via AbortController on the fetch).
  - Currently `runTurn` doesn't support cancellation — that's a v2
    feature. v1: just don't show Cancel. Double-click is no-op.

---

## 6. PRESET buttons UX

**Layout:** 6 preset cards in a 3-column grid (Jarvis, Samantha, HAL Lite,
Best Friend, Professor, Operator). Each card shows `displayName` (large)
+ `tagline` (small muted). Click selects.

**Confirm dialog logic:**

- If current `preset === "custom"` AND the current dimension values
  diverge from the default neutral-50 baseline, a single confirm appears:
  *"Replace your current settings with the Jarvis preset?"*
- Confirm dialog has a checkbox: *"Don't ask again this session."* Stored
  in `sessionStorage` (not localStorage — resets each session).
- If current preset is non-custom (operator is iterating between
  presets), no confirm — the choice was already a discrete preset.
- If the user is on `custom` with dimensions == defaults (untouched),
  no confirm — there's nothing to lose.

The "this session" qualifier is important: the user who suppressed the
warning while iterating gets it back next time they open the app, before
they've had a chance to remember they meant to keep their custom values.

---

## 7. The MASTER TOGGLE for the personality engine

**Placement:** very top of the Personality section, ahead of presets and
sliders. First thing the user sees inside the section.

**Visual:** same `axon-settings-row` pattern as other toggles, with the
section label `Personality (beta)` styled like Forced-sleep when active
(tinted background, "ACTIVE" chip). Subtitle line:
*"When off, Axon uses default behavior."*

**When OFF:**

- The rest of the section UI (presets, sliders, test composer) stays
  visible but dimmed.
- Pointer-events disabled on the dimmed region.
- A small inline message at the top of the dimmed region: *"Turn on the
  engine to test presets and tune sliders."*
- Visible-but-disabled is the right call here: hiding makes the feature
  feel like a teaser; dimming shows the user exactly what they get when
  they flip it on.

**When ON:**

- Full opacity, full interactivity.
- First-time activation stamps `axon:relationship:firstSeenAt` if it isn't
  already set (already handled by `buildPersonalityContext` on first
  composed turn — but for transparency, the master toggle could also
  trigger the stamp so the relationship clock starts the moment the user
  turns the feature on, not later when they fire their first message).
  **Lean: do trigger on master-toggle-on**, so the clock reflects "when
  did this user start having a personality-aware Axon" rather than "when
  did this user first speak to him after enabling."

---

## Component breakdown

Three new files, plus a hook into AxonProvider:

```
src/Axon/personality/
  ui/
    PersonalitySection.tsx    — top-level section (master toggle +
                                preset grid + sliders + test composer)
    PresetCard.tsx            — single preset chip
    DimensionSlider.tsx       — labeled slider with band name display
    TestComposer.tsx          — textarea + Test button + result panel

src/Axon/ui/AxonSettings.tsx  — import PersonalitySection, slot it
                                between Master and Autonomy. ~5 lines
                                of diff in this file.

src/Axon/AxonProvider.tsx     — expose runPersonalityTest(text) via the
                                useAxon() context. ~30 lines added.
```

Files stay under 200 lines each so the truncation pattern (Edit/Write tools
cutting large files) doesn't hit. Each component is single-concern and
testable in isolation.

---

## What's NOT in this proposal (deliberately deferred)

- **"What Axon Remembers" UI** — that's the Memory pillar, separate spec.
  P6 has zero memory UI.
- **Voice picker reorg** — the existing Voice section stays where it is.
  P6 doesn't touch voice settings; that's a separate refactor when we
  curate the 6-8 voice list.
- **Eval suite** — the brief mentioned 50-turn personality drift evals.
  Those run in CI or the playground, not in the settings UI. P7 territory.
- **A/B compare** — diffing two settings side-by-side. P7 playground feature.

---

## Sign-off checklist

(a) Personality section between Master and Autonomy — agree?
(b) Write-on-debounce 300ms with immediate flush on Test click — agree?
(c) `runPersonalityTest` is a new provider method that bypasses
    `submitCommand` to keep conversation history clean — agree?
(d) Test-path post-processor calls with `trackOpenings: false` — agree
    or override?
(e) Preset confirm dialog with session-scoped "don't ask again" — agree?
(f) Master toggle ON triggers immediate `firstSeenAt` stamp if not set —
    agree?
(g) Three new component files, one provider hook, one AxonSettings
    import — file shape OK?

Once you give me the seven sign-offs (or specific overrides), I'll build.
Same discipline as before: no code until architecture is locked.
