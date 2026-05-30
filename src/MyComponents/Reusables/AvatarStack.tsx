/**
 * AvatarStack.tsx
 *
 * Shared editorial-style avatar stack used by the dashboard card
 * widgets (Tasks, Meetings, etc.). Renders up to 3 overlapping
 * circles with a "+N" overflow chip. Falls back to deterministic
 * seeded gradients when real user data isn't available.
 *
 * Why this lives in Reusables/:
 *   Tasks and Meetings both needed identical avatar treatment for
 *   the bottom-right slot of their cards. Keeping it in one place
 *   means the visual treatment (size, ring colour, overflow chip
 *   styling) only has to be tuned once.
 *
 * Real-user mode vs gradient mode:
 *   When `users` is provided and non-empty, we render actual <img>
 *   avatars with seeded-gradient underlays (so broken images don't
 *   show a cracked-glyph). Hover the avatar to see the username.
 *   When users is absent or empty, we fall back to N seeded gradient
 *   circles derived from the `count` + `seed` params — useful for
 *   legacy rows where we only have a count, not a roster.
 */

import { useMemo } from "react";

/** Minimum shape needed to render a real-user avatar. */
export interface AvatarUser {
  /** Stable id for keying + as the seed for the gradient underlay. */
  id: string;
  /** Display name — shown as the hover tooltip. */
  name: string;
  /** Optional avatar URL. Missing or broken images fall back to the
   *  gradient underlay so the slot never looks empty. */
  avatarUrl?: string;
}

/** djb2-ish string hash → non-negative int. Tiny and deterministic. */
function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Build a deterministic linear-gradient from a string seed.
 *  Saturation + lightness tuned to read well on both light and dark
 *  card backgrounds without going neon. */
export function gradientForSeed(seed: string): string {
  const h = hashSeed(seed);
  const h1 = h % 360;
  const h2 = (h1 + 35) % 360;
  return `linear-gradient(135deg, hsl(${h1} 65% 62%), hsl(${h2} 72% 48%))`;
}

interface AvatarStackProps {
  /** Real users to render. When present and non-empty we draw actual
   *  avatars + tooltips. Otherwise we fall back to `count` + seeded
   *  gradients (legacy / placeholder mode). */
  users?: AvatarUser[];
  /** Fallback count when `users` is empty — number of placeholder
   *  circles to render. Accepts string ("1".."5") or number; nullish
   *  values default to 1 so the avatar slot is never empty. */
  count?: number | string | null;
  /** Stable string used as the seed prefix for fallback gradients.
   *  Should be unique per row (e.g. meeting id, task id) so two
   *  rows don't end up with identical placeholder colours. */
  seed: string;
  /** Max real avatars shown before the overflow chip kicks in. */
  max?: number;
}

export function AvatarStack({
  users,
  count,
  seed,
  max = 3,
}: AvatarStackProps) {
  // Coerce fallback count once. Whatever the input shape, end up with
  // a non-zero positive integer.
  const fallbackCount = useMemo(() => {
    const parsed = typeof count === "string" ? parseInt(count, 10) : count ?? 1;
    if (!parsed || isNaN(parsed) || parsed < 1) return 1;
    return parsed;
  }, [count]);

  // ── Real-user mode ─────────────────────────────────────────────
  if (users && users.length > 0) {
    const visible = users.slice(0, max);
    const overflow = users.length - visible.length;
    return (
      <div className="flex -space-x-2 shrink-0">
        {visible.map((u) => (
          <div
            key={u.id}
            title={u.name}
            className="relative w-6 h-6 rounded-full ring-2 ring-card overflow-hidden"
            // Seeded gradient underlay so a broken/missing image
            // still shows colour rather than cracked-glyph.
            style={{ background: gradientForSeed(u.id) }}
          >
            {u.avatarUrl ? (
              <img
                src={u.avatarUrl}
                alt={u.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : null}
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="w-6 h-6 rounded-full ring-2 ring-card bg-foreground/15 text-foreground/80 flex items-center justify-center text-[9.5px] font-bold tabular-nums"
            title={users
              .slice(max)
              .map((u) => u.name)
              .join(", ")}
          >
            +{overflow}
          </div>
        )}
      </div>
    );
  }

  // ── Legacy / placeholder mode (no roster, just a count) ────────
  const visible = Math.min(fallbackCount, max);
  const overflow = fallbackCount - visible;
  return (
    <div className="flex -space-x-2 shrink-0">
      {Array.from({ length: visible }).map((_, i) => (
        <div
          key={i}
          style={{ background: gradientForSeed(`${seed}-${i}`) }}
          className="w-6 h-6 rounded-full ring-2 ring-card"
          aria-hidden
        />
      ))}
      {overflow > 0 && (
        <div className="w-6 h-6 rounded-full ring-2 ring-card bg-foreground/15 text-foreground/80 flex items-center justify-center text-[9.5px] font-bold tabular-nums">
          +{overflow}
        </div>
      )}
    </div>
  );
}
