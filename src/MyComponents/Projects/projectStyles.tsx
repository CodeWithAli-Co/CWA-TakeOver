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
  { label: string; chip: string; dot: string; ring: string; Icon: LucideIcon }
> = {
  to_do: {
    label: "To do",
    chip:  "bg-amber-500/15 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/25",
    dot:   "bg-amber-500",
    ring:  "ring-amber-500/30",
    Icon:  CircleDot,
  },
  in_progress: {
    label: "In progress",
    chip:  "bg-sky-500/15 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25",
    dot:   "bg-sky-500",
    ring:  "ring-sky-500/30",
    Icon:  Activity,
  },
  review: {
    label: "In review",
    chip:  "bg-violet-500/15 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/25",
    dot:   "bg-violet-500",
    ring:  "ring-violet-500/30",
    Icon:  Eye,
  },
  completed: {
    label: "Completed",
    chip:  "bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25",
    dot:   "bg-emerald-500",
    ring:  "ring-emerald-500/30",
    Icon:  CheckCircle2,
  },
  on_hold: {
    label: "On hold",
    chip:  "bg-foreground/[0.05] text-text-secondary border-border-soft",
    dot:   "bg-text-tertiary",
    ring:  "ring-foreground/20",
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
