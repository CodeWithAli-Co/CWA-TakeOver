/**
 * src/Axon/personality/postProcess.ts
 *
 * Runs on Claude's raw reply between the LLM call and TTS / display.
 * Two responsibilities:
 *
 *   1. Strip customer-service residue from the start of replies
 *      ("Certainly!", "Of course!", "As an AI...", etc.). These
 *      break the spell instantly — they get the boot before anything
 *      sees them.
 *
 *   2. Handle voice markers Claude inserted per the spec's hard
 *      constraints. [pause] / [laugh] / [sigh] / [smile] / [sarcasm]
 *      either get stripped (display path, or v2.5 TTS without SSML
 *      support) or converted to provider-specific cues (v3+ SSML).
 *
 * Bonus: tracks the last few opening phrases in localStorage and
 * surfaces a soft warning when two consecutive replies start the
 * same way. The brain doesn't act on this — it's diagnostic for
 * the playground / eval suite.
 */

import { BANNED_OPENERS, VOICE_MARKERS } from "./personality-prompts.config";

// ── Public types ──────────────────────────────────────────────

export interface PostProcessInput {
  /** Raw text from Claude (assistant final message). */
  text: string;
  /** When true, emit SSML cues compatible with ElevenLabs v3+
   *  prosody. When false (default), strip markers entirely. */
  ssmlEnabled?: boolean;
  /** Track openings for repetition detection. Pass false from the
   *  playground when re-rolling variants of the same prompt. */
  trackOpenings?: boolean;
}

export interface PostProcessOutput {
  /** Text for display in the UI (markers stripped). */
  displayText: string;
  /** Text routed to TTS. Either stripped (v2.5) or SSML (v3+). */
  voiceText: string;
  /** Whether any markers were detected — useful for the playground. */
  hadMarkers: boolean;
  /** Whether an anti-robot opener was stripped. */
  strippedOpener: string | null;
  /** True when this opening matches one of the last 3 — diagnostic
   *  only; we do not rewrite. */
  openingRepeated: boolean;
}

/** Main entry. Pure function — same input, same output. The opening
 *  tracker has a side-effect on localStorage but it's idempotent. */
export function postProcessReply(input: PostProcessInput): PostProcessOutput {
  const raw = input.text ?? "";
  const { stripped, opener } = stripBannedOpeners(raw);
  const trimmed = stripped.replace(/^\s+/, "");

  // Marker extraction & routing.
  const hadMarkers = VOICE_MARKERS.some((m) => trimmed.includes(m));
  const displayText = stripVoiceMarkers(trimmed);
  const voiceText = input.ssmlEnabled
    ? markersToSsml(trimmed)
    : stripVoiceMarkers(trimmed);

  // Repetition detection.
  const opening = openingFingerprint(displayText);
  let repeated = false;
  if (input.trackOpenings !== false && opening) {
    const recent = readRecentOpenings();
    repeated = recent.length > 0 && recent[0] === opening;
    writeRecentOpening(opening, recent);
  }

  return {
    displayText,
    voiceText,
    hadMarkers,
    strippedOpener: opener,
    openingRepeated: repeated,
  };
}

// ── Anti-robot opener strip ──────────────────────────────────

/** Strips any BANNED_OPENERS prefix (case-insensitive on the first
 *  letter) plus the trailing whitespace / sentence terminator that
 *  followed it. Returns both the stripped text and the opener that
 *  was removed (null if nothing matched). */
function stripBannedOpeners(text: string): { stripped: string; opener: string | null } {
  if (!text) return { stripped: text, opener: null };
  const leading = text.replace(/^\s+/, "");
  // Try the longer-prefix variants first (already ordered in the
  // BANNED_OPENERS array).
  for (const opener of BANNED_OPENERS) {
    if (caseInsensitiveStartsWith(leading, opener)) {
      // Drop the opener AND any immediately-following punctuation
      // + whitespace ("Certainly! Here's..." -> "Here's...").
      const after = leading
        .slice(opener.length)
        .replace(/^[!,.\s]+/, "");
      // Re-capitalize the first letter of the remainder so we don't
      // hand TTS lowercase mid-sentence-looking text.
      const capped = after.length > 0
        ? after[0].toUpperCase() + after.slice(1)
        : after;
      return { stripped: capped, opener };
    }
  }
  return { stripped: text, opener: null };
}

function caseInsensitiveStartsWith(haystack: string, needle: string): boolean {
  if (needle.length === 0) return true;
  if (haystack.length < needle.length) return false;
  return haystack.slice(0, needle.length).toLowerCase() === needle.toLowerCase();
}

// ── Voice markers ────────────────────────────────────────────

/** Removes [pause] / [laugh] / [sigh] / [smile] / [sarcasm] tokens
 *  for the display path. Collapses any double-spaces left behind. */
function stripVoiceMarkers(text: string): string {
  let out = text;
  for (const m of VOICE_MARKERS) {
    // Each marker may appear with a space before and/or after.
    const re = new RegExp(`\\s*${escapeRegex(m)}\\s*`, "g");
    out = out.replace(re, " ");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Converts markers to provider-flavoured SSML. Currently aimed at
 *  ElevenLabs v3 prosody hints; on v2.5 the caller should leave
 *  ssmlEnabled = false and just strip. */
function markersToSsml(text: string): string {
  let out = text;
  // [pause] → SSML break.
  out = out.replace(/\s*\[pause\]\s*/g, ' <break time="350ms"/> ');
  // [sigh] / [laugh] / [smile] — ElevenLabs v3 inline performance
  // hints. Format may shift; isolate the mapping here.
  out = out.replace(/\s*\[sigh\]\s*/g, ' <prosody rate="slow"> </prosody> ');
  out = out.replace(/\s*\[laugh\]\s*/g, " (laughs) ");
  out = out.replace(/\s*\[smile\]\s*/g, " ");  // smile is a vibe; no SSML for it
  // [sarcasm] — slow rate + breathy on the preceding sentence. v3
  // doesn't have a real sarcasm tag; we apply rate modulation only.
  // We can't easily target the prior sentence with regex without
  // false positives, so we just emit a break + slow on the next
  // breath; refine when we move to v3.
  out = out.replace(/\s*\[sarcasm\]\s*/g, ' <break time="200ms"/> ');
  return out.replace(/\s{2,}/g, " ").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Opening-fingerprint tracker ──────────────────────────────

const OPENING_HISTORY_KEY = "axon:opening-history";
const OPENING_HISTORY_MAX = 3;

/** First 4 words of the display text, lowercased, punctuation
 *  removed. A coarse fingerprint — exact match is the signal. */
function openingFingerprint(text: string): string {
  const first = text.replace(/^[\s"']+/, "").slice(0, 200);
  return first
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 4)
    .join(" ")
    .trim();
}

function readRecentOpenings(): string[] {
  try {
    const raw = localStorage.getItem(OPENING_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === "string");
    return [];
  } catch {
    return [];
  }
}

function writeRecentOpening(opening: string, recent: string[]): void {
  try {
    const next = [opening, ...recent.filter((o) => o !== opening)].slice(0, OPENING_HISTORY_MAX);
    localStorage.setItem(OPENING_HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — drop silently */
  }
}

/** Reset the tracker. Settings UI exposes this when the operator
 *  switches presets so the new persona doesn't get penalised for
 *  matching the last one's opening. */
export function resetOpeningHistory(): void {
  try { localStorage.removeItem(OPENING_HISTORY_KEY); } catch { /* ignore */ }
}
