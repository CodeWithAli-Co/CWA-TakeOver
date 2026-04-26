// ───────────────────────────────────────────────────────────────────
// Continuous vision loop.
//
// Every INTERVAL_MS, capture the visible UI, ask Claude Sonnet vision
// to summarize it in one terse sentence ("you're on the transactions
// page, ledger has 3 unreconciled items"), and append a `vision`
// node to the Mind Map.
//
// Why a separate loop from brain.ts's on-demand vision?
//   • This runs ambiently — the operator doesn't ask. Axon just
//     "watches" so future commands have spatial context.
//   • The summaries become free-form notes the agent loop can read
//     via buildRecentContext to know what page the operator is on.
//
// Behaviors / safeguards:
//   • Skips when status is already busy (coding / executing /
//     processing / speaking) — we don't want vision pings to compete
//     with active work for token budget.
//   • Skips when the visible-text hash hasn't changed since the last
//     successful capture — no point asking the model the same
//     question if the page hasn't moved.
//   • Skips when the document is hidden (tab unfocused).
//   • Goes through anthropicFetch so a 429 doesn't crash the loop.
//   • Hard-throttles to one in-flight request at a time (drops the
//     interval beat if the previous one is still pending).
//
// Operator control: start() / stop() exposed for the UI toggle.
// ───────────────────────────────────────────────────────────────────

import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  CLAUDE_MODEL,
} from "../config";
import { axonGraph } from "./graphStore";
import { anthropicFetch } from "./anthropicFetch";
import {
  captureScreenshot,
  dataUrlToBase64,
  type CapturedScreen,
} from "./visionCapture";

// ── Tunables ──────────────────────────────────────────────────────

const DEFAULT_INTERVAL_MS = 30_000; // 30s — long enough to be cheap, short enough to feel "alive"
const VISION_MAX_TOKENS = 220; // 1-2 sentence cap — we only want a beat
const SUMMARY_MIN_GAP_MS = 8_000; // never two captures closer than 8s, even on manual trigger

const VISION_SYSTEM = [
  "You are AXON's ambient vision — a quiet observer riding alongside the operator.",
  "You receive a screenshot of what's currently on their screen.",
  "Your job is to produce ONE terse, factual sentence describing what they're looking at,",
  "with the focus on operationally meaningful info: which page / module they're on, any",
  "obvious anomaly (red counters, error states, empty lists, unread badges), and any",
  "action item that's visible (3 unreconciled items, 2 pending approvals, etc).",
  "",
  "RULES:",
  "- One sentence. No greeting, no preamble, no markdown.",
  "- If nothing meaningful changed, reply EXACTLY: \"No change.\"",
  "- If the screen is just a loading state / blank, reply EXACTLY: \"Loading.\"",
  "- Don't speculate about what the operator is doing — just describe what you see.",
  "- Maximum ~200 characters. Brevity above all.",
].join("\n");

// ── Module state ──────────────────────────────────────────────────

let _intervalId: number | null = null;
let _intervalMs = DEFAULT_INTERVAL_MS;
let _inFlight = false;
let _lastSuccessAt = 0;
let _lastTextHash = "";
let _isBusyProvider: () => boolean = () => false;

/** Lightweight DOM-text hash so we can skip vision pings when the
 *  page hasn't visibly changed since the last call. We only hash a
 *  trimmed slice — no need to keccak the whole DOM. */
function visibleTextHash(): string {
  if (typeof document === "undefined") return "";
  const main =
    (document.querySelector("#main-section") as HTMLElement) ?? document.body;
  const txt = (main.innerText || "").replace(/\s+/g, " ").trim();
  // FNV-1a 32-bit — fast, plenty of dispersion for a "did this change" gate.
  let h = 0x811c9dc5;
  const cap = Math.min(txt.length, 4096);
  for (let i = 0; i < cap; i++) {
    h ^= txt.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16) + ":" + txt.length;
}

/** Caller (AxonProvider) supplies a getter so we can check whether
 *  Axon is currently busy. Avoids a circular import on the provider. */
export function configureVisionLoop(opts: {
  isBusy?: () => boolean;
  intervalMs?: number;
}): void {
  if (opts.isBusy) _isBusyProvider = opts.isBusy;
  if (typeof opts.intervalMs === "number" && opts.intervalMs >= 5_000) {
    _intervalMs = opts.intervalMs;
  }
}

export function startVisionLoop(): void {
  if (_intervalId !== null) return;
  // Kick the first beat fast (3s) so the operator sees activity right
  // away when they enable the toggle. Subsequent beats use the full
  // interval.
  const firstId = window.setTimeout(() => {
    void runOneBeat();
    _intervalId = window.setInterval(() => {
      void runOneBeat();
    }, _intervalMs);
  }, 3_000);
  // Use the timeout id as our placeholder until the interval registers.
  _intervalId = firstId;
}

export function stopVisionLoop(): void {
  if (_intervalId !== null) {
    window.clearInterval(_intervalId);
    window.clearTimeout(_intervalId); // covers the kick-off timeout case
    _intervalId = null;
  }
  _inFlight = false;
}

export function isVisionLoopRunning(): boolean {
  return _intervalId !== null;
}

/** Manually trigger a single vision capture + summary. Useful for the
 *  UI's "look now" button. Bypasses the interval but still respects
 *  the in-flight + busy + min-gap guards. */
export async function triggerOneVisionBeat(): Promise<void> {
  await runOneBeat();
}

// ── Inner beat ────────────────────────────────────────────────────

async function runOneBeat(): Promise<void> {
  if (_inFlight) return;
  if (!ANTHROPIC_API_KEY) return;
  if (typeof document !== "undefined" && document.hidden) return;
  if (_isBusyProvider()) return;
  if (Date.now() - _lastSuccessAt < SUMMARY_MIN_GAP_MS) return;

  const hash = visibleTextHash();
  if (hash === _lastTextHash && hash !== "") {
    // Page didn't change. Skip silently.
    return;
  }

  let shot: CapturedScreen | null = null;
  try {
    shot = await captureScreenshot({ format: "jpeg" });
  } catch {
    return;
  }
  if (!shot) return;

  _inFlight = true;
  try {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: VISION_MAX_TOKENS,
      system: VISION_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: shot.mediaType,
                data: dataUrlToBase64(shot.dataUrl),
              },
            },
            {
              type: "text",
              text: "Describe what's on screen in one terse sentence.",
            },
          ],
        },
      ],
    };

    const res = await anthropicFetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify(body),
      // Vision pings stay silent — no narration on rate-limit. We
      // just skip the beat.
      onWait: () => {
        /* noop */
      },
    });
    if (!res.ok) return;
    const json = await res.json();
    const content = (json?.content ?? []) as Array<{
      type: string;
      text?: string;
    }>;
    const text = content
      .filter((c) => c.type === "text")
      .map((c) => String(c.text ?? "").trim())
      .join(" ")
      .trim();
    if (!text) return;

    // "No change." is a meaningful answer — but we don't want to
    // pollute the Mind Map with a stream of those. Treat it like a
    // skip and let the next text-hash gate handle dedup naturally.
    if (/^no change\.?$/i.test(text)) {
      _lastTextHash = hash;
      _lastSuccessAt = Date.now();
      return;
    }
    if (/^loading\.?$/i.test(text)) {
      // Don't update the hash so the next loading→loaded transition
      // captures a real read.
      return;
    }

    axonGraph.addVision({
      label: text,
      detail: text,
      thumbnailUrl: shot.dataUrl,
    });
    _lastTextHash = hash;
    _lastSuccessAt = Date.now();
  } catch {
    // Network blips, parse errors, etc. — silent. The next beat tries again.
  } finally {
    _inFlight = false;
  }
}
