/**
 * src/Axon/personality/postProcess.ts  (v2)
 *
 * Runs on each sentence between Claude's stream and TTS / display.
 *
 * v2 changes (operator-mandated):
 *   - Widened marker regex: catches bracketed [pause], parenthetical
 *     (pause), asterisk-wrapped *pause* / **pause**, AND verb forms
 *     (laughs, sighs, smiles, pauses). NEVER strips bare words
 *     — "Let me pause and think" is legitimate prose.
 *   - splitOnPause(): [pause] becomes a chunk boundary so the natural
 *     between-chunk gap serves as the pause (no SSML needed for
 *     ElevenLabs v2.5). Other markers (laugh/sigh/smile/sarcasm)
 *     are stripped from each chunk and never produce a split.
 *   - Streaming-safe: postProcessReply now takes isFirstSentence
 *     so the opening-variation tracker only fires on the first
 *     sentence of a turn. Middle sentences\' "openings" are noise.
 *   - voiceChunks output: array of text fragments ready to queue
 *     separately. Single-element when no [pause] in input.
 */

import { BANNED_OPENERS, VOICE_MARKERS } from "./personality-prompts.config";

// ── Public types ──────────────────────────────────────────────

export interface PostProcessInput {
  /** Raw text from Claude (one sentence in streaming mode, or a
   *  full reply when called whole-message). */
  text: string;
  /** When true, emit SSML cues compatible with ElevenLabs v3+
   *  prosody. Default false (v2.5 strip-only). */
  ssmlEnabled?: boolean;
  /** Tracks the first-N openings used. Pass false from the test
   *  path so exploration doesn\'t burn the history. Pass false on
   *  non-first sentences of a streamed reply. Defaults true. */
  trackOpenings?: boolean;
  /** Set true ONLY for the first sentence of a streamed reply.
   *  Gates banned-opener stripping (which is anchored to text
   *  start) and opening-fingerprint registration. Middle sentences
   *  pass false. Defaults true for full-message callers. */
  isFirstSentence?: boolean;
}

export interface PostProcessOutput {
  /** Text for display in the UI (markers stripped). */
  displayText: string;
  /** Single voice-bound text — markers stripped. Use this when
   *  the caller doesn\'t want to split on [pause]. */
  voiceText: string;
  /** Voice-bound chunks. Length 1 when no [pause] in input.
   *  Length 2+ when [pause] split occurred. Callers can queue each
   *  chunk separately to use the natural between-chunk gap as the
   *  pause. */
  voiceChunks: string[];
  /** Whether any markers were detected. */
  hadMarkers: boolean;
  /** Whether an anti-robot opener was stripped. */
  strippedOpener: string | null;
  /** True when this opening matches one of the last N. Diagnostic. */
  openingRepeated: boolean;
}

/** Main entry. */
export function postProcessReply(input: PostProcessInput): PostProcessOutput {
  const raw = input.text ?? "";
  const isFirst = input.isFirstSentence ?? true;

  // Anti-robot opener strip — only meaningful on first sentence.
  const { stripped, opener } = isFirst
    ? stripBannedOpeners(raw)
    : { stripped: raw, opener: null };

  const trimmed = stripped.replace(/^\s+/, "");

  // Diagnostic: warn when Claude emits a tag NOT in the v3
  // supported palette. v3 interprets a wide tag vocabulary
  // descriptively; this catches invented tokens (e.g. [smile]
  // from the v1 era, or freelance tags Claude tries) so we
  // can tighten the prompt if it happens.
  const unsupported = detectUnsupportedTags(trimmed);
  const hadMarkers = unsupported.length > 0 ||
    /\[(pause|pauses|laughs|chuckles|sighs|whispers|fast-paced|drawn out|excited|frustrated|tired|sorrowful|sad)\]/i.test(trimmed);
  if (unsupported.length > 0) {
    console.warn(
      "[postProcess] unsupported v3 tag stripped:",
      unsupported,
    );
  }

  // Build the voice-side output. v3 renders [laughs] / [sighs] /
  // etc. as audible sounds, so we PRESERVE supported tags. [pause]
  // gets converted to <break time="0.2s" /> inline per v3 docs —
  // this replaces the v1 chunk-splitting workaround entirely.
  const displayText = stripAllTagsForDisplay(trimmed);
  const voiceBody = pauseToBreak(stripDeprecatedOnly(trimmed));
  const voiceText = voiceBody;
  // voiceChunks always length 1 on v3 — no more chunk-splitting.
  // The break tag handles the pause; the caller queues a single
  // chunk per sentence as before.
  const voiceChunks = voiceBody.length > 0 ? [voiceBody] : [];

  // Opening fingerprint — only on first sentence, only when
  // tracking is on.
  const opening = openingFingerprint(displayText);
  let repeated = false;
  if (isFirst && input.trackOpenings !== false && opening) {
    const recent = readRecentOpenings();
    repeated = recent.length > 0 && recent[0] === opening;
    writeRecentOpening(opening, recent);
  }

  return {
    displayText,
    voiceText,
    voiceChunks: voiceChunks.length > 0 ? voiceChunks : [displayText],
    hadMarkers,
    strippedOpener: opener,
    openingRepeated: repeated,
  };
}

// ── Anti-robot opener strip ──────────────────────────────────

function stripBannedOpeners(text: string): { stripped: string; opener: string | null } {
  if (!text) return { stripped: text, opener: null };
  const leading = text.replace(/^\s+/, "");
  for (const opener of BANNED_OPENERS) {
    if (caseInsensitiveStartsWith(leading, opener)) {
      const after = leading.slice(opener.length).replace(/^[!,.\s]+/, "");
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

// ── Voice markers — widened regex set ────────────────────────
//
// Token vocabulary (case-insensitive, verb forms permitted):
//   pause / pauses · laugh / laughs · sigh / sighs ·
//   smile / smiles · sarcasm
//
// Wrappers we match (and strip):
//   [token]            canonical bracket form
//   (token)            parenthetical
//   *token*  **token** asterisk emphasis (1+ asterisks per side)
//
// We deliberately DO NOT match bare standalone tokens.
// "Let me pause and think" is a legitimate sentence.

// ── v3 marker palette ─────────────────────────────────────────
//
// v3 renders these tags as audible sounds. They pass through to
// ElevenLabs as inline text and the model interprets them. Pause
// gets special handling: converted inline to <break time="0.2s" />
// per v3 docs since that produces a deterministic silence instead
// of the previous chunk-splitting workaround.

const SUPPORTED_V3_TAGS = [
  "pause", "pauses",
  "laughs", "laughs harder", "starts laughing", "chuckles",
  "sighs", "sigh",
  "whispers", "shouts",
  "fast-paced", "drawn out", "rushed",
  "excited", "frustrated", "tired", "sorrowful", "sad",
  "calm", "angry", "happily", "curious", "nervous",
  "cheerfully", "flatly", "deadpan", "playfully",
  "resigned tone", "hesitates", "stammers",
  "gulps", "gasps", "clears throat",
] as const;

// Deprecated custom tokens we used to emit. Always strip — these
// never rendered as sounds and would read as text.
const DEPRECATED_TOKENS = ["smile", "smiles", "sarcasm"] as const;

// Generic detector regex — catches anything in brackets / parens
// / asterisks that looks like a tag token. Used by the warn path
// to flag tokens NOT in SUPPORTED_V3_TAGS so we see if Claude
// invents new ones.
const GENERIC_TAG_REGEXES: RegExp[] = [
  /\[\s*([a-z\- ]+?)\s*\]/gi,
  /\(\s*([a-z\- ]+?)\s*\)/gi,
  /\*+\s*([a-z\- ]+?)\s*\*+/gi,
];

/** Convert every [pause] / (pause) / *pause* / *pauses* variant
 *  to a v3 SSML break tag inline. Replaces the v1 chunk-splitting
 *  approach — v3 honors <break time="x.xs" /> directly. */
function pauseToBreak(text: string): string {
  let out = text;
  out = out.replace(/\s*\[\s*pauses?\s*\]\s*/gi, ' <break time="0.2s" /> ');
  out = out.replace(/\s*\(\s*pauses?\s*\)\s*/gi, ' <break time="0.2s" /> ');
  out = out.replace(/\s*\*+\s*pauses?\s*\*+\s*/gi, ' <break time="0.2s" /> ');
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Strip ONLY deprecated tokens. Everything else (the v3 supported
 *  palette) passes through to TTS unchanged. */
function stripDeprecatedOnly(text: string): string {
  let out = text;
  for (const tok of DEPRECATED_TOKENS) {
    out = out.replace(new RegExp(`\\s*\\[\\s*${tok}\\s*\\]\\s*`, "gi"), " ");
    out = out.replace(new RegExp(`\\s*\\(\\s*${tok}\\s*\\)\\s*`, "gi"), " ");
    out = out.replace(new RegExp(`\\s*\\*+\\s*${tok}\\s*\\*+\\s*`, "gi"), " ");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Strip ALL tags including v3-supported ones — for the DISPLAY
 *  text path. Users don't want to see "[laughs]" in chat. */
function stripAllTagsForDisplay(text: string): string {
  let out = text;
  // Strip every plausible tag form. We don't care about preserving
  // tokens for display — anything bracketed/asterisked goes.
  out = out.replace(/\s*\[[a-z\- ]+?\]\s*/gi, " ");
  // Don't strip parens generally — the prose uses them. Only strip
  // when content is a known tag token.
  for (const tok of [...SUPPORTED_V3_TAGS, ...DEPRECATED_TOKENS]) {
    out = out.replace(new RegExp(`\\s*\\(\\s*${tok}\\s*\\)\\s*`, "gi"), " ");
    out = out.replace(new RegExp(`\\s*\\*+\\s*${tok}\\s*\\*+\\s*`, "gi"), " ");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

/** Detect ANY tag-shaped token in the input. Returns the list of
 *  raw bracketed tokens for the diagnostic warn. Used to flag
 *  tokens that aren't in SUPPORTED_V3_TAGS so we see if Claude
 *  invents unsupported ones. */
function detectUnsupportedTags(text: string): string[] {
  const hits: string[] = [];
  const supportedLower = new Set<string>([
    ...SUPPORTED_V3_TAGS.map((t) => t.toLowerCase()),
    ...DEPRECATED_TOKENS.map((t) => t.toLowerCase()),
  ]);
  for (const re of GENERIC_TAG_REGEXES) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const token = (m[1] ?? "").trim().toLowerCase();
      if (token && !supportedLower.has(token)) {
        hits.push(m[0]);
      }
    }
  }
  return hits;
}

// ── Legacy aliases kept so postProcessReply\'s call sites compile. ──
const MARKER_REGEXES: RegExp[] = GENERIC_TAG_REGEXES;

/** Strip every flavour of marker, collapse whitespace. */
function stripAllMarkers(text: string): string {
  let out = text;
  for (const re of MARKER_REGEXES) {
    re.lastIndex = 0;
    out = out.replace(re, " ");
  }
  // Also handle the canonical legacy form from VOICE_MARKERS (kept
  // for back-compat — already covered by the bracket regex above
  // but loop here so unknown future marker tokens still strip).
  for (const m of VOICE_MARKERS) {
    out = out.replace(new RegExp(`\\s*${escapeRegex(m)}\\s*`, "gi"), " ");
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

// ── [pause] chunk-splitter ───────────────────────────────────
//
// Only [pause] / (pause) / *pause* / *pauses* trigger a split.
// Other markers stay in-text (they get stripped, not split).

const PAUSE_TOKEN = "(pause|pauses)";
const PAUSE_SPLIT_REGEXES: RegExp[] = [
  new RegExp(`\\s*\\[\\s*${PAUSE_TOKEN}\\s*\\]\\s*`, "gi"),
  new RegExp(`\\s*\\(\\s*${PAUSE_TOKEN}\\s*\\)\\s*`, "gi"),
  new RegExp(`\\s*\\*+\\s*${PAUSE_TOKEN}\\s*\\*+\\s*`, "gi"),
];

/** Splits text on any pause marker. Returns [text] if no marker. */
function splitOnPause(text: string): string[] {
  // Replace every pause variant with a single unique sentinel,
  // then split on that. Simpler than iterating regex.exec().
  const SENTINEL = "\u0000PAUSE\u0000";
  let work = text;
  for (const re of PAUSE_SPLIT_REGEXES) {
    re.lastIndex = 0;
    work = work.replace(re, SENTINEL);
  }
  return work
    .split(SENTINEL)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ── SSML path (v3 upgrade — not active until ssmlEnabled true) ─

function markersToSsml(text: string): string {
  let out = text;
  // [pause] → SSML break.
  out = out.replace(new RegExp(`\\s*\\[\\s*pauses?\\s*\\]\\s*`, "gi"), ' <break time="350ms"/> ');
  out = out.replace(new RegExp(`\\s*\\(\\s*pauses?\\s*\\)\\s*`, "gi"), ' <break time="350ms"/> ');
  out = out.replace(new RegExp(`\\s*\\*+\\s*pauses?\\s*\\*+\\s*`, "gi"), ' <break time="350ms"/> ');
  // [sigh], [laugh], [smile], [sarcasm] — for v3 we\'ll wire
  // proper prosody. For v2.5 the SSML path is opt-in only.
  out = stripAllMarkers(out);  // safe: SSML break tags don\'t match marker regex.
  return out.replace(/\s{2,}/g, " ").trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Opening-fingerprint tracker ──────────────────────────────

const OPENING_HISTORY_KEY = "axon:opening-history";
const OPENING_HISTORY_MAX = 3;

function openingFingerprint(text: string): string {
  const first = text.replace(/^[\s"\']+/, "").slice(0, 200);
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
  } catch { /* private mode / quota — drop silently */ }
}

export function resetOpeningHistory(): void {
  try { localStorage.removeItem(OPENING_HISTORY_KEY); } catch { /* ignore */ }
}
