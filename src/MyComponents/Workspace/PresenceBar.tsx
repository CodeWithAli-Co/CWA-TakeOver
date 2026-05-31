/**
 * PresenceBar.tsx — "Who else is here right now" avatar pile.
 *
 * Two surfaces, two data sources, one component:
 *
 *   · `<PresenceBar provider={…} self={…} />` — reads from a Y.Awareness
 *     instance on the given SupabaseYProvider. Used inside the doc
 *     editor where we already have a Y.Doc + provider.
 *
 *   · `<PresenceBar channelName="sheet:abc" self="Mason" />` — opens a
 *     dedicated Supabase Realtime presence channel and tracks who's
 *     joined / left. Used by the spreadsheet detail page where there's
 *     no Y.Doc to piggy-back on.
 *
 * The component visually de-dupes by username and excludes `self` so
 * the local operator doesn't see their own dot.
 */

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { takeOversupabase } from "@/MyComponents/supabase";
import { colorForUser } from "@/lib/yjs/awareness";
import type { SupabaseYProvider } from "@/lib/yjs/SupabaseYProvider";

interface PresenceUser {
  name: string;
  color: string;
}

type Props =
  | { provider: SupabaseYProvider; self: string; channelName?: never }
  | { channelName: string; self: string; provider?: never };

export function PresenceBar(props: Props) {
  const others = props.provider
    ? useAwarenessPeers(props.provider, props.self)
    : useChannelPresence(props.channelName, props.self);

  if (others.length === 0) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] text-foreground/35">
        <Users size={11} />
        Solo
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center"
      title={others.map((p) => p.name).join(", ")}
    >
      <div className="flex -space-x-1.5">
        {others.slice(0, 4).map((p) => (
          <Avatar key={p.name} user={p} />
        ))}
        {others.length > 4 && (
          <div
            className="h-6 w-6 rounded-full bg-muted border border-background flex items-center justify-center text-[10px] font-bold text-foreground/65"
            title={others.slice(4).map((p) => p.name).join(", ")}
          >
            +{others.length - 4}
          </div>
        )}
      </div>
    </div>
  );
}

function Avatar({ user }: { user: PresenceUser }) {
  const initials = user.name.slice(0, 2).toUpperCase();
  return (
    <div
      className="h-6 w-6 rounded-full border-2 border-background flex items-center justify-center text-[9.5px] font-bold text-white shadow-sm"
      style={{ backgroundColor: user.color }}
      title={user.name}
    >
      {initials}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Data source A: Y.Awareness (doc editor)
// ──────────────────────────────────────────────────────────────────
function useAwarenessPeers(
  provider: SupabaseYProvider,
  self: string,
): PresenceUser[] {
  const [peers, setPeers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const refresh = () => {
      const seen = new Set<string>();
      const out: PresenceUser[] = [];
      const states = provider.awareness.getStates();
      for (const [clientId, state] of states.entries()) {
        if (clientId === provider.doc.clientID) continue;
        const u = (state as any)?.user as { name?: string; color?: string } | undefined;
        if (!u?.name) continue;
        if (u.name === self) continue;
        if (seen.has(u.name)) continue;
        seen.add(u.name);
        out.push({ name: u.name, color: u.color ?? colorForUser(u.name) });
      }
      setPeers(out);
    };
    refresh();
    provider.awareness.on("update", refresh);
    return () => {
      provider.awareness.off("update", refresh);
    };
  }, [provider, self]);

  return peers;
}

// ──────────────────────────────────────────────────────────────────
// Data source B: Supabase Realtime presence channel (sheets)
// ──────────────────────────────────────────────────────────────────
function useChannelPresence(
  channelName: string | undefined,
  self: string,
): PresenceUser[] {
  const [peers, setPeers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!channelName || !self) return;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    const refresh = (presenceState: Record<string, any[]>) => {
      const seen = new Set<string>();
      const out: PresenceUser[] = [];
      for (const arr of Object.values(presenceState)) {
        for (const entry of arr) {
          const name = entry?.name as string | undefined;
          if (!name || name === self || seen.has(name)) continue;
          seen.add(name);
          out.push({ name, color: colorForUser(name) });
        }
      }
      setPeers(out);
    };

    channel = takeOversupabase.channel(`workspace-presence:${channelName}`, {
      config: { presence: { key: self } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        if (cancelled || !channel) return;
        refresh(channel.presenceState());
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && channel) {
          await channel.track({ name: self, at: new Date().toISOString() });
        }
      });

    return () => {
      cancelled = true;
      channel?.untrack();
      channel?.unsubscribe();
    };
  }, [channelName, self]);

  return peers;
}
