/**
 * ActivityFeed.tsx — Compact recent-activity card for the workspace
 * landing page.
 *
 * Shows the last ~12 doc + sheet edits, sorted by updated_at, with the
 * resource title, kind icon, who, and a relative timestamp. Clicking a
 * row navigates to the resource.
 */

import { useNavigate } from "@tanstack/react-router";
import { Activity, FileText, Sheet, Loader2 } from "lucide-react";
import { useRecentActivity } from "@/stores/workspace";
import { colorForUser } from "@/lib/yjs/awareness";

export function ActivityFeed() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useRecentActivity(12);

  return (
    <section className="rounded-sm border border-border bg-card overflow-hidden">
      <header className="px-4 h-10 border-b border-border/60 flex items-center gap-2">
        <Activity size={12} className="text-primary" />
        <div className="text-[10px] tracking-[0.14em] uppercase text-foreground/45 font-semibold">
          Recent activity
        </div>
      </header>

      {isLoading ? (
        <div className="p-5 flex items-center justify-center text-foreground/40 text-[11.5px]">
          <Loader2 size={11} className="animate-spin mr-1.5" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="p-5 text-center text-[11.5px] text-foreground/45">
          Nothing yet.
        </div>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((r) => {
            const Icon = r.kind === "document" ? FileText : Sheet;
            const accent = r.kind === "document" ? "text-sky-400" : "text-emerald-400";
            const who = r.updated_by ?? r.owner;
            return (
              <li key={`${r.kind}-${r.id}`}>
                <button
                  type="button"
                  onClick={() => {
                    if (r.kind === "document") {
                      navigate({ to: "/workspace/docs/$id", params: { id: r.id } });
                    } else {
                      navigate({ to: "/workspace/sheets/$id", params: { id: r.id } });
                    }
                  }}
                  className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-muted/25 transition-colors"
                >
                  <Icon size={12} className={accent + " flex-shrink-0"} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-foreground truncate">
                      {r.title || "Untitled"}
                    </div>
                    <div className="text-[10.5px] text-foreground/45 truncate inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-3 w-3 rounded-full text-[8px] font-bold text-white flex items-center justify-center"
                        style={{ backgroundColor: colorForUser(who) }}
                      >
                        {who.slice(0, 1).toUpperCase()}
                      </span>
                      {who}
                      <span className="text-foreground/25">·</span>
                      <span className="font-mono tabular-nums">
                        {formatRelative(r.updated_at)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
