/**
 * chatNotify.ts — Pure helpers for chat notification routing.
 *
 * Extracted from `__root.tsx` and `chatStore.ts` so the matching
 * logic can be unit-tested without bringing up React, Zustand
 * persistence, or the Supabase client. Each function is referentially
 * transparent — same input always yields same output, no I/O, no side
 * effects, no globals.
 *
 * Stakes: these functions decide *who gets pinged for what*. A bug
 * here means employees miss messages or get spammed. Boundary cases
 * (word-boundary respect, regex escaping in user-provided keywords)
 * are not optional.
 */

/**
 * Escape regex meta-characters so user-supplied keywords can be
 * safely interpolated into a `RegExp` constructor.
 *
 * Without this, a user setting an alert on "(prod)" would crash the
 * matcher when the unbalanced paren turns into a malformed pattern.
 */
export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Returns the *first* matched keyword for `text`, or null when none
 * of `keywords` appear inside `text` on a word boundary.
 *
 *   matchesKeyword("foo bar", ["bar"])      // → "bar"
 *   matchesKeyword("foobar",  ["foo"])      // → null  (no word boundary)
 *   matchesKeyword("FooBar",  ["foo"])      // → null  (boundary respect)
 *   matchesKeyword("hello FOO", ["foo"])    // → "foo" (case insensitive)
 *
 * Word boundary uses `[^a-z0-9]` rather than \b so emoji-adjacent
 * matches still fire ("alert! 🚨" should match "alert").
 *
 * Keywords are normalized to lowercase before comparison; the lookup
 * is intended to be cheap relative to the cardinality (≤ ~20 keywords
 * per user in practice).
 */
export function matchesKeyword(text: string, keywords: string[]): string | null {
  const hay = (text || "").toLowerCase();
  if (!hay) return null;
  for (const raw of keywords) {
    const w = (raw || "").toLowerCase().trim();
    if (!w) continue;
    const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(w)}($|[^a-z0-9])`, "i");
    if (re.test(hay)) return w;
  }
  return null;
}

/**
 * True when `text` contains an `@username` mention of the given user.
 *
 *   isMentioned("hey @alice can you check this", "alice")  // → true
 *   isMentioned("contact alice@example.com", "alice")      // → false
 *   isMentioned("ping @alicia", "alice")                   // → false
 *   isMentioned("@alice!", "alice")                        // → true
 *
 * Empty username or empty text returns false. The mention must be
 * preceded by start-of-string or whitespace, and not followed by
 * additional identifier characters (so `@aliceberg` doesn't ping
 * Alice).
 */
export function isMentioned(text: string, username: string): boolean {
  if (!username || !text) return false;
  const re = new RegExp(
    `(^|\\s)@${escapeRegExp(username)}(?![A-Za-z0-9_.-])`,
    "i",
  );
  return re.test(text);
}

/**
 * True when `text` contains an `@here` call. Same boundary rules as
 * `isMentioned` but with no username variable — `@here` is a fixed
 * token that means "everyone currently online".
 */
export function isHereCall(text: string): boolean {
  if (!text) return false;
  return /(^|\s)@here(?![A-Za-z0-9_.-])/i.test(text);
}
