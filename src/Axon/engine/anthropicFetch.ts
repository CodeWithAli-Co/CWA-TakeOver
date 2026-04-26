// ───────────────────────────────────────────────────────────────────
// anthropicFetch — wrapped fetch for Anthropic with 429 backoff.
//
// Anthropic enforces per-org input-token-per-minute caps. The
// ensemble pipeline (Architect + Engineer loop + Critic) can blow
// through the default 30k tokens/min ceiling on long goals.
//
// Instead of failing hard, this wrapper:
//   1. Catches 429 responses,
//   2. Reads `retry-after` from headers (or falls back to exponential
//      backoff: 5s, 10s, 20s),
//   3. Optionally narrates "Rate-limited, waiting Xs..." via the
//      provided onWait callback so the operator knows what's
//      happening instead of seeing a frozen UI,
//   4. Retries up to MAX_ATTEMPTS times,
//   5. Throws the original 429 error only if all retries fail.
//
// Used by agent.ts and ensemble.ts. Brain.ts uses streaming and is
// handled separately at its own surface (see runTurn's catch block).
// ───────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 4; // initial + 3 retries
const BACKOFF_MS = [5000, 10000, 20000]; // 5s, 10s, 20s between retries

export interface AnthropicFetchOpts extends RequestInit {
  /** Called when a 429 forces a wait, with the wait time in ms.
   *  Perfect place to ctx.speak("rate-limited, waiting 10 seconds")
   *  so the operator hears a status update instead of silence. */
  onWait?: (waitMs: number, attempt: number) => void;
}

export async function anthropicFetch(
  url: string,
  opts: AnthropicFetchOpts,
): Promise<Response> {
  const { onWait, ...init } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);

      // Not rate-limited — return immediately, success or hard failure.
      if (res.status !== 429) return res;

      // Rate limited. Decide how long to wait.
      const retryAfterHeader = res.headers.get("retry-after");
      let waitMs: number;
      if (retryAfterHeader) {
        const parsed = Number(retryAfterHeader);
        if (!Number.isNaN(parsed)) {
          waitMs = Math.min(parsed * 1000, 60_000);
        } else {
          waitMs = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
        }
      } else {
        waitMs = BACKOFF_MS[attempt] ?? BACKOFF_MS[BACKOFF_MS.length - 1]!;
      }

      // Last attempt? Don't bother waiting; throw with the 429 body.
      if (attempt === MAX_ATTEMPTS - 1) {
        const text = await res.text().catch(() => "");
        throw new Error(`Anthropic 429: ${text.slice(0, 200)}`);
      }

      // Tell the caller we're pausing.
      onWait?.(waitMs, attempt + 1);

      // Drain the body so the connection can be reused.
      try { await res.text(); } catch { /* ignore */ }

      await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      // Loop continues with attempt + 1
    } catch (e) {
      lastError = e as Error;
      // Network error — retry once with a small wait, then give up.
      if (attempt >= MAX_ATTEMPTS - 1) throw lastError;
      onWait?.(2000, attempt + 1);
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    }
  }

  throw lastError ?? new Error("Anthropic fetch exhausted retries.");
}
