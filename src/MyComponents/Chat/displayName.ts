/**
 * src/MyComponents/Chat/displayName.ts
 *
 * Single source of truth for converting a DM storage key like
 * "dm::Ali::Mason" into a user-facing label.
 *
 * Storage layer is untouched — the canonical "dm::a::b::..." format
 * stays as the database key, message routing key, channel identity.
 * This helper ONLY affects the render layer. Search/filter is the
 * one place callers must opt in: match against the DISPLAY name, not
 * the storage key, so a user typing "Mason" still finds "dm::Ali::Mason".
 *
 * Rules (per the P0 display-name fix):
 *   1. 1:1 DM with another person   → other person's name ("Mason")
 *   2. Self-DM (you DMing yourself) → "Me"
 *   3. DM with Axon                 → "Axon" (plain, no badge)
 *   4. Group DM, ≤4 participants    → comma-separated OTHER names
 *      ("dm::Ali::Mason::Sem"       → "Mason, Sem")
 *   5. Group DM, >4 participants    → first 3 alphabetical visible
 *      avatars + "+N" overflow chip + full list as tooltip
 *   6. Channels (no dm:: prefix)    → unchanged
 *
 * Lookups: this codebase identifies users by username and stores the
 * username inside the dm:: key. There is no separate user-id ↔ name
 * resolution step; the parts in the key ARE the names. If a future
 * refactor introduces opaque user ids, swap parseDMKey() to do the
 * resolve and the rest of the API stays stable.
 */

const AXON_USERNAME = "axon";

export interface DMAvatarDisplay {
  kind: "avatars";
  /** First N alphabetical OTHER participants — render their avatars. */
  visible: string[];
  /** Count of names hidden behind the "+N" chip. */
  overflow: number;
  /** Full comma-separated list of OTHER participants — tooltip target. */
  tooltip: string;
  /** Text-only fallback for sites that don't render an avatar stack
   *  (notifications, huddle chip, etc). Looks like "Mason, Sem, blazehp +2". */
  label: string;
}

export interface DMTextDisplay {
  kind: "text";
  label: string;
}

export type DMDisplay = DMTextDisplay | DMAvatarDisplay;

const eqId = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

/** Parse "dm::a::b::c" into ["a","b","c"]. Returns null for non-DM
 *  keys (channels like "General" or "#announcements"). Tolerates
 *  stray trailing "::" and surrounding whitespace. */
export function parseDMKey(storageKey: string): string[] | null {
  if (!storageKey || !storageKey.startsWith("dm::")) return null;
  const rest = storageKey.slice(4);
  if (!rest) return null;
  const parts = rest.split("::").map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : null;
}

/** True if `storageKey` is a DM (vs a channel/topic name). */
export function isDMKey(storageKey: string): boolean {
  return parseDMKey(storageKey) !== null;
}

/** Dedupe a participant list case-insensitively, preserving the
 *  ORIGINAL casing of the first occurrence of each id. */
function dedupePreserveCase(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

/** Rich display struct — text for ≤4 participants total, avatar stack
 *  for >4. Always returns something renderable; never throws. */
export function displayNameForDM(
  storageKey: string,
  currentUserId: string,
): DMDisplay {
  const parts = parseDMKey(storageKey);
  if (!parts || parts.length === 0) {
    // Non-DM key — caller normally wouldn't hit this branch, but
    // keeping the contract total means defensively-coded sites can
    // call displayNameForDM unconditionally without a pre-check.
    return { kind: "text", label: storageKey };
  }

  const unique = dedupePreserveCase(parts);

  // Self-DM. Two recognized shapes:
  //   "dm::Ali::Ali" → unique = ["Ali"]
  //   "dm::Ali"      → unique = ["Ali"]
  // Either way, after dedupe, length 1 AND that one matches me → "Me".
  if (unique.length === 1) {
    if (eqId(unique[0], currentUserId)) {
      return { kind: "text", label: "Me" };
    }
    // Edge case: 1-id key where the id isn't me. Treat as a 1:1 with
    // that person (rare data drift; render the name, don't crash).
    return { kind: "text", label: unique[0] };
  }

  // Others = everyone except me. If filtering empties the list
  // (legacy data where I'm not actually in the key), fall back to
  // the full deduped list so we still render *something* sensible.
  const others = unique.filter((p) => !eqId(p, currentUserId));
  const effective = others.length > 0 ? others : unique;

  // 1:1 — exactly one OTHER person.
  if (effective.length === 1) {
    // Axon collapses to plain "Axon", no decoration. Case-folded so
    // a future "AXON" / "axon" rename ships cleanly.
    if (eqId(effective[0], AXON_USERNAME)) {
      return { kind: "text", label: "Axon" };
    }
    return { kind: "text", label: effective[0] };
  }

  // Group DM — alphabetical for stable ordering across sessions /
  // clients. Avoids "Mason, Sem" on my screen and "Sem, Mason" on
  // yours when we open the same conversation.
  const sorted = [...effective].sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );

  // ≤4 participants total ≡ ≤3 OTHER names → text form.
  if (sorted.length <= 3) {
    return { kind: "text", label: sorted.join(", ") };
  }

  // >4 total → avatar stack of first 3 + "+N" overflow.
  const visible = sorted.slice(0, 3);
  const overflow = sorted.length - visible.length;
  const tooltip = sorted.join(", ");
  return {
    kind: "avatars",
    visible,
    overflow,
    tooltip,
    label: `${visible.join(", ")} +${overflow}`,
  };
}

/** Text-only convenience for sites that don't render avatars
 *  (huddle chip, notifications, toast titles, channel-name copy).
 *  Returns the raw key unchanged for channels (no dm:: prefix). */
export function displayLabelForDM(
  storageKey: string,
  currentUserId: string,
): string {
  if (!isDMKey(storageKey)) return storageKey;
  return displayNameForDM(storageKey, currentUserId).label;
}

/** True iff the key is a 1:1 DM (exactly one OTHER participant after
 *  dedupe, ignoring self). Used by sidebar/header to decide whether
 *  to show the presence dot on the avatar. */
export function isOneOnOneDM(
  storageKey: string,
  currentUserId: string,
): boolean {
  const parts = parseDMKey(storageKey);
  if (!parts) return false;
  const unique = dedupePreserveCase(parts);
  // Self-DM is NOT a 1:1 — there's no other person to show presence for.
  if (unique.length === 1) return false;
  const others = unique.filter((p) => !eqId(p, currentUserId));
  return others.length === 1;
}

/** The OTHER participant's username for a 1:1 DM, or null otherwise.
 *  Used to attach the PresenceDot to the right person. */
export function dmOtherParty(
  storageKey: string,
  currentUserId: string,
): string | null {
  const parts = parseDMKey(storageKey);
  if (!parts) return null;
  const unique = dedupePreserveCase(parts);
  if (unique.length === 1) return null;
  const others = unique.filter((p) => !eqId(p, currentUserId));
  return others.length === 1 ? others[0] : null;
}
