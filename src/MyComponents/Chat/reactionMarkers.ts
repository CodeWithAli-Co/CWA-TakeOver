/**
 * reactionMarkers.ts — In-body reaction marker codec.
 *
 * Some deployments don't have the `reactions` JSONB column on the
 * messages table (older schemas). For those rows we encode the same
 * reaction data into the message body as a sentinel block:
 *
 *   {rx:👍=alice,bob;❤=carol}
 *   <actual message body>
 *
 * Display code calls `parseReactionsMarker` to lift the reactions
 * back out and `stripReactionsMarker` to render the body without it.
 * Write code calls `encodeReactionsMarker` to prepend a fresh block.
 *
 * Pure / no I/O — extracted from MessageBubble.tsx so the codec can
 * be unit-tested without React. MessageBubble re-exports these for
 * backward compatibility with existing imports.
 */

/**
 * Matches the leading reaction block: `{rx:...}` with an optional
 * trailing newline. Capture group 1 is the inner payload (everything
 * between the colon and the closing brace).
 *
 * `^` and the lack of a `\n` inside `[^}]*` mean this only ever
 * matches a single-line marker at the very start of the body — a
 * marker mid-message would be ignored, which is intentional.
 */
export const REACTIONS_MARKER_RE = /^\{rx:([^}]*)\}\s*\n?/;

/**
 * Lift the reaction map out of the message body. Returns an empty
 * object when no marker is present.
 *
 *   parseReactionsMarker("{rx:👍=alice}\nhello")  // → { "👍": ["alice"] }
 *   parseReactionsMarker("hello")                  // → {}
 */
export function parseReactionsMarker(text: string): Record<string, string[]> {
  const match = text.match(REACTIONS_MARKER_RE);
  if (!match) return {};
  const body = match[1] ?? "";
  const out: Record<string, string[]> = {};
  for (const chunk of body.split(";")) {
    const piece = chunk.trim();
    if (!piece) continue;
    const eq = piece.indexOf("=");
    if (eq < 0) continue;
    const emoji = piece.slice(0, eq).trim();
    const users = piece
      .slice(eq + 1)
      .split(",")
      .map((u) => u.trim())
      .filter(Boolean);
    if (emoji) out[emoji] = users;
  }
  return out;
}

/**
 * Remove the leading reaction marker (if any), returning the bare
 * message body. Trims any leading whitespace introduced by the marker
 * being followed by a newline.
 */
export function stripReactionsMarker(text: string): string {
  return text.replace(REACTIONS_MARKER_RE, "").trimStart();
}

/**
 * Build a marker block from a reactions map. Empty emojis (no users
 * left) are dropped, so removing the last reactor of an emoji and
 * round-tripping yields a clean payload.
 *
 * Returns `""` when the map is empty — callers can blindly prepend
 * the result to a body without worrying about an empty `{rx:}`
 * placeholder polluting the message.
 */
export function encodeReactionsMarker(
  reactions: Record<string, string[]>,
): string {
  const parts: string[] = [];
  for (const [emoji, users] of Object.entries(reactions)) {
    if (!users || users.length === 0) continue;
    parts.push(`${emoji}=${users.join(",")}`);
  }
  if (parts.length === 0) return "";
  return `{rx:${parts.join(";")}}\n`;
}
