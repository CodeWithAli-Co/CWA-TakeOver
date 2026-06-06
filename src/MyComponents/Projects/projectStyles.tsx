/**
 * projectStyles.tsx — Shared visual helpers for the /projects
 * surface. Status + priority colour maps, date helpers, avatar
 * primitives. Kept separate so ProjectsPage / Drawer / CreateDialog
 * stay focused on flow rather than tokens.
 *
 * Token convention: dark + light parity using bg-X-500/15 dark:bg-X-500/10
 * + text-X-700 dark:text-X-300 for tinted chips. Semantic tokens
 * (bg-card, text-foreground, etc.) elsewhere.
 */

import { useMemo } from "react";
import {
  CircleDot, Activity, Eye, CheckCircle2, Pause,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { takeOversupabase } from "@/MyComponents/supabase";
import type { ProjectStatus, ProjectPriority } from "@/stores/projects";

export const STATUS_META: Record<
  ProjectStatus,
  { label: string; chip: string; dot: string; ring: string; tone: string; Icon: LucideIcon }
> = {
  to_do: {
    label: "To do",
    chip:  "bg-amber-500/15 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
    dot:   "bg-amber-500",
    ring:  "ring-amber-500/30",
    tone:  "text-amber-500",
    Icon:  CircleDot,
  },
  in_progress: {
    label: "In progress",
    chip:  "bg-sky-500/15 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
    dot:   "bg-sky-500",
    ring:  "ring-sky-500/30",
    tone:  "text-sky-500",
    Icon:  Activity,
  },
  review: {
    label: "In review",
    chip:  "bg-violet-500/15 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25",
    dot:   "bg-violet-500",
    ring:  "ring-violet-500/30",
    tone:  "text-violet-500",
    Icon:  Eye,
  },
  completed: {
    label: "Completed",
    chip:  "bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    dot:   "bg-emerald-500",
    ring:  "ring-emerald-500/30",
    tone:  "text-emerald-500",
    Icon:  CheckCircle2,
  },
  on_hold: {
    label: "On hold",
    chip:  "bg-foreground/[0.05] text-text-secondary border-border-soft",
    dot:   "bg-text-tertiary",
    ring:  "ring-foreground/20",
    tone:  "text-text-tertiary",
    Icon:  Pause,
  },
};

export const PRIORITY_META: Record<
  ProjectPriority,
  { label: string; chip: string; tone: string }
> = {
  low: {
    label: "Low",
    chip:  "bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    tone:  "text-emerald-500",
  },
  medium: {
    label: "Medium",
    chip:  "bg-amber-500/15 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300",
    tone:  "text-amber-500",
  },
  high: {
    label: "High",
    chip:  "bg-orange-500/15 dark:bg-orange-500/10 text-orange-700 dark:text-orange-300",
    tone:  "text-orange-500",
  },
  critical: {
    label: "Critical",
    chip:  "bg-red-500/15 dark:bg-red-500/10 text-red-700 dark:text-red-300",
    tone:  "text-red-500",
  },
};

// ────────────────────────────────────────────────
// Linear-inspired primitives
//
// Quiet, scannable indicators that replace chunky chips with the
// visual vocabulary Linear popularized: a single colored circle
// for status, a stack of bars for priority. Both ship in two
// sizes (sm and md) so they read well in tight list rows and
// roomier card headers.
// ────────────────────────────────────────────────

/**
 * StatusIcon — Linear-style status circle.
 *
 *   to_do       hollow ring (no fill)
 *   in_progress half-filled circle (conic gradient simulated with
 *               two stacked half-circles)
 *   review      filled circle with an inner dot
 *   completed   filled circle with a centered check
 *   on_hold     filled circle with a centered pause hint
 *
 * Use `withLabel` when the row has horizontal space; the circle
 * alone is fine inside dense lists.
 */
export function StatusIcon({
  status,
  size = 14,
  withLabel = false,
}: {
  status: ProjectStatus;
  size?: number;
  withLabel?: boolean;
}) {
  const meta = STATUS_META[status];
  const px = size;

  // Single-class outer wrap so the label inherits the meta tone
  // without us re-deriving it. `[&_*]:` makes child SVG/divs pick
  // up the color via currentColor.
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold ${meta.tone ?? "text-foreground/70"}`}
      title={meta.label}
    >
      <span
        className="relative inline-flex shrink-0"
        style={{ width: px, height: px }}
      >
        {status === "to_do" && (
          <span
            className="absolute inset-0 rounded-full border-[2px] border-current opacity-70"
          />
        )}
        {status === "in_progress" && (
          <>
            <span className="absolute inset-0 rounded-full border-[2px] border-current opacity-60" />
            <span
              className="absolute inset-[2px] rounded-full bg-current opacity-90"
              style={{ clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)" }}
            />
          </>
        )}
        {status === "review" && (
          <>
            <span className="absolute inset-0 rounded-full bg-current opacity-90" />
            <span className="absolute inset-[3px] rounded-full bg-background" />
            <span className="absolute inset-[5px] rounded-full bg-current" />
          </>
        )}
        {status === "completed" && (
          <>
            <span className="absolute inset-0 rounded-full bg-current" />
            <svg
              viewBox="0 0 12 12"
              className="absolute inset-0 m-auto"
              style={{ width: px * 0.7, height: px * 0.7 }}
            >
              <path
                d="M2.5 6.5l2.4 2.4 4.6-4.8"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </>
        )}
        {status === "on_hold" && (
          <>
            <span className="absolute inset-0 rounded-full bg-current opacity-40" />
            <span
              className="absolute bg-background rounded-[1px]"
              style={{
                top: px * 0.28,
                bottom: px * 0.28,
                left: px * 0.32,
                width: 1.5,
              }}
            />
            <span
              className="absolute bg-background rounded-[1px]"
              style={{
                top: px * 0.28,
                bottom: px * 0.28,
                right: px * 0.32,
                width: 1.5,
              }}
            />
          </>
        )}
      </span>
      {withLabel && <span>{meta.label}</span>}
    </span>
  );
}

/**
 * PriorityIcon — Linear-style stacked bars.
 *
 *   critical 4 filled bars (red)
 *   high     3 bars
 *   medium   2 bars
 *   low      1 bar
 *
 * Empty slots render as a low-contrast track so the indicator
 * always occupies the same width — keeps list columns aligned.
 */
export function PriorityIcon({
  priority,
  size = 12,
  withLabel = false,
}: {
  priority: ProjectPriority;
  size?: number;
  withLabel?: boolean;
}) {
  const meta = PRIORITY_META[priority];
  const bars: Record<ProjectPriority, number> = {
    low: 1,
    medium: 2,
    high: 3,
    critical: 4,
  };
  const active = bars[priority];

  // Bar widths scale incrementally so the indicator reads as a
  // mini bar chart — the Linear pattern.
  const w = size;
  const h = size;
  const slotWidth = w / 4 - 0.5;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold ${meta.tone}`}
      title={`Priority: ${meta.label}`}
    >
      <span
        className="inline-flex items-end gap-[1.5px]"
        style={{ height: h, width: w }}
      >
        {[1, 2, 3, 4].map((i) => {
          const isOn = i <= active;
          // Heights: 30 / 50 / 70 / 100 % of the icon.
          const fillH = h * (0.3 + 0.225 * (i - 1));
          return (
            <span
              key={i}
              className={`rounded-[1px] ${
                isOn ? "bg-current" : "bg-current opacity-20"
              }`}
              style={{
                width: slotWidth,
                height: fillH,
              }}
            />
          );
        })}
      </span>
      {withLabel && <span>{meta.label}</span>}
    </span>
  );
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function daysUntil(iso: string): number {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return 0;
  const now = Date.now();
  return Math.round((d - now) / 86_400_000);
}

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h`;
  return `${Math.round(diff / 86_400_000)}d`;
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "··";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Hook: returns a Map<username, avatarURL> built from the cached
 * Employees query. Shares the same `["employees"]` queryKey as the
 * Suspense-based `Employees()` hook in stores/query.ts so data is
 * cached once and reused across components. Supports both legacy
 * storage-bucket filenames (rewritten via takeOversupabase.storage public
 * URL) and full-URL avatars (DiceBear, Direct Hire).
 */
function useAvatarsByName(): Map<string, string> {
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await takeOversupabase.from("app_users").select("*");
      return data ?? [];
    },
    staleTime: 60_000,
  });
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const e of (employees as any[] | undefined) ?? []) {
      if (!e?.username) continue;
      let url: string | undefined;
      if (typeof e.avatar === "string" && e.avatar.startsWith("http")) {
        url = e.avatar;
      } else if (e.avatar) {
        const { data } = takeOversupabase.storage
          .from("avatars")
          .getPublicUrl(e.avatar);
        url = data?.publicUrl;
      }
      if (url) map.set(e.username, url);
    }
    return map;
  }, [employees]);
}

export function Avatar({
  username,
  size = 24,
  title,
}: {
  username: string | null | undefined;
  size?: number;
  title?: string;
}) {
  const avatarsByName = useAvatarsByName();
  const url = username ? avatarsByName.get(username) : undefined;
  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-bold tracking-tight border border-primary/20 overflow-hidden"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.4) }}
      title={title ?? username ?? ""}
    >
      {url ? (
        <img
          src={url}
          alt={username ?? ""}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        initialsOf(username)
      )}
    </span>
  );
}

export function AvatarStack({
  usernames,
  max = 3,
}: {
  usernames: string[];
  max?: number;
}) {
  const shown = usernames.slice(0, max);
  const extra = Math.max(0, usernames.length - max);
  return (
    <div className="flex -space-x-1.5">
      {shown.map((u, i) => (
        <span key={`${u}-${i}`} className="ring-2 ring-card rounded-full">
          <Avatar username={u} size={22} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="inline-flex items-center justify-center rounded-full bg-foreground/[0.06] text-text-secondary text-[9.5px] font-bold ring-2 ring-card"
          style={{ width: 22, height: 22 }}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
