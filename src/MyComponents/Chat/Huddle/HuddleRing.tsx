/**
 * HuddleRing.tsx — Listens to a broadcast channel that announces new
 * huddles being started in any of the user's groups, and pops a
 * Discord-style toast that the user can click to join.
 *
 * Wire into __root.tsx so it's mounted globally; toasts appear no
 * matter which page is active.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, X, Volume2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import supabase from "@/MyComponents/supabase";
import { useAppStore } from "@/stores/store";

interface IncomingRing {
  id: string;             // unique ring id (we can dismiss by id)
  group: string;          // channel name
  starter: string;        // username who started
  receivedAt: number;     // ms epoch
}

interface Props {
  username: string;
  /** Names of channels the user belongs to (incl. "General") */
  channelNames: string[];
}

/**
 * Public helper — call this when YOU start (or join first) a huddle to
 * notify everyone else in the channel. Idempotent: if no one's
 * listening yet, the broadcast is just dropped.
 */
export async function announceHuddleStart(group: string, starter: string) {
  const ch = supabase.channel("huddle-ring");
  await ch.subscribe();
  await ch.send({
    type: "broadcast",
    event: "huddle:start",
    payload: { group, starter, at: Date.now() },
  });
  // Tear down — we just needed a one-shot send.
  setTimeout(() => { ch.unsubscribe(); }, 500);
}

const RING_TTL_MS = 30_000; // auto-dismiss after 30s

export function HuddleRing({ username, channelNames }: Props) {
  const [rings, setRings] = useState<IncomingRing[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const { setGroupName } = useAppStore();

  useEffect(() => {
    const channel = supabase.channel("huddle-ring");
    channel
      .on("broadcast", { event: "huddle:start" }, (evt) => {
        const p = evt.payload as { group: string; starter: string; at: number };
        if (!p || !p.group || !p.starter) return;
        if (p.starter === username) return;
        // Only ring if user is in the channel
        if (!channelNames.includes(p.group) && p.group !== "General") return;
        const id = `${p.group}:${p.starter}:${p.at}`;
        if (seenRef.current.has(id)) return;
        seenRef.current.add(id);
        setRings((r) => [
          ...r,
          { id, group: p.group, starter: p.starter, receivedAt: Date.now() },
        ]);
        // Play a soft ring tone if browser allows
        try {
          const audio = new Audio(
            "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YT9vT18AAA==",
          );
          audio.volume = 0.3;
          void audio.play();
        } catch { /* noop */ }
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [username, channelNames]);

  // Auto-expire after RING_TTL_MS
  useEffect(() => {
    if (rings.length === 0) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setRings((r) => r.filter((x) => now - x.receivedAt < RING_TTL_MS));
    }, 1000);
    return () => window.clearInterval(id);
  }, [rings.length]);

  const dismiss = (id: string) => setRings((r) => r.filter((x) => x.id !== id));

  const join = (ring: IncomingRing) => {
    setGroupName(ring.group);
    navigate({ to: "/chat" }).catch(() => {});
    dismiss(ring.id);
  };

  if (rings.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[80] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {rings.map((ring) => (
          <motion.div
            key={ring.id}
            initial={{ x: 40, opacity: 0, scale: 0.96 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto flex w-[340px] items-center gap-3 rounded-xl border border-emerald-400/40 bg-card/95 p-3 shadow-2xl backdrop-blur"
            style={{ boxShadow: "0 18px 48px rgba(0,0,0,0.55)" }}
          >
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/30" />
              <Volume2 className="relative h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-foreground">
                {ring.starter} started a huddle
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                in #{ring.group}
              </p>
            </div>
            <button
              type="button"
              onClick={() => join(ring)}
              className="flex h-8 items-center gap-1 rounded-full bg-emerald-500 px-3 text-[11px] font-semibold text-white hover:bg-emerald-500/90"
            >
              <Phone className="h-3 w-3" />
              Join
            </button>
            <button
              type="button"
              onClick={() => dismiss(ring.id)}
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
