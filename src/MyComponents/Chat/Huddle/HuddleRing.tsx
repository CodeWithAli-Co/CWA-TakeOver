/**
 * HuddleRing.tsx — Broadcasts and receives huddle-start announcements.
 *
 * Key design points (learned the hard way):
 *   · Single persistent Supabase channel — NOT a fresh one per send.
 *     Creating an ad-hoc channel-per-send was causing double toasts
 *     because the sender's short-lived channel and the receiver's
 *     long-lived channel would both deliver the broadcast.
 *   · Ring audio via WebAudio (synth) — the old base64 data-URI was
 *     invalid padding and played silently.
 *   · Join button stashes a "pending-join" flag in localStorage that
 *     ChatLayout reads on the next tick, so clicking Join actually
 *     drops you INTO the huddle, not just the channel.
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, X, Volume2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import supabase from "@/MyComponents/supabase";
import { useAppStore } from "@/stores/store";
import { displayLabelForDM, isDMKey } from "../displayName";

interface IncomingRing {
  id: string;
  group: string;
  starter: string;
  receivedAt: number;
}

interface Props {
  username: string;
  channelNames: string[];
}

// ── Shared channel + helpers ──────────────────────────────────────────

/** Module-level singleton so `announceHuddleStart` and `HuddleRing`
 *  share one channel instance. Prevents double-delivery. */
let ringChannel: ReturnType<typeof supabase.channel> | null = null;
let ringChannelSubscribing = false;
function getRingChannel() {
  if (!ringChannel) {
    ringChannel = supabase.channel("huddle-ring", {
      // Explicitly opt out of self-delivery so the sender never sees
      // their own broadcast. Fixes the ring-on-starter-side bug.
      config: { broadcast: { self: false, ack: false } },
    });
    if (!ringChannelSubscribing) {
      ringChannelSubscribing = true;
      ringChannel.subscribe();
    }
  }
  return ringChannel;
}

// Tracks huddles the local user just started, keyed by group name.
// Any incoming ring broadcast for a group within the suppression
// window (10s) is silently dropped — belt-and-suspenders against
// two failure modes that were both happening in production:
//   1. Supabase Realtime's `broadcast.self: false` occasionally
//      delivers the broadcast back to the sender anyway (race
//      between subscribe + send).
//   2. Stale useEffect handlers with a captured empty username
//      from pre-auth mount — the `p.starter === username` check
//      trivially fails against `""`, so the handler rings.
// Checking this map first sidesteps both.
const recentlyStartedByMe = new Map<string, number>();
const START_SUPPRESSION_MS = 10_000;

function wasJustStartedByMe(group: string): boolean {
  const at = recentlyStartedByMe.get(group);
  if (!at) return false;
  if (Date.now() - at > START_SUPPRESSION_MS) {
    recentlyStartedByMe.delete(group);
    return false;
  }
  return true;
}

export async function announceHuddleStart(group: string, starter: string) {
  // Stamp the start BEFORE broadcasting. Even if Realtime echoes the
  // broadcast back to us faster than this function resolves, the
  // incoming handler will see the entry and suppress the ring.
  recentlyStartedByMe.set(group, Date.now());
  // Lazy cleanup — stops the map growing if a user starts 100 huddles
  // without closing the tab.
  if (recentlyStartedByMe.size > 50) {
    const cutoff = Date.now() - START_SUPPRESSION_MS;
    for (const [g, t] of recentlyStartedByMe) {
      if (t < cutoff) recentlyStartedByMe.delete(g);
    }
  }

  const ch = getRingChannel();
  // Wait briefly for subscribe if needed — Realtime.send queues if not.
  try {
    await ch.send({
      type: "broadcast",
      event: "huddle:start",
      payload: { group, starter, at: Date.now() },
    });
  } catch { /* noop */ }
}

/** Pending-join flag read by ChatLayout to auto-enter a huddle after
 *  the user clicks "Join" in a toast and navigates to /chat. */
const PENDING_KEY = "cwa-pending-huddle-join";
export function setPendingHuddleJoin(group: string) {
  try { window.localStorage.setItem(PENDING_KEY, group); } catch { /* noop */ }
}
export function consumePendingHuddleJoin(): string | null {
  try {
    const v = window.localStorage.getItem(PENDING_KEY);
    if (v) window.localStorage.removeItem(PENDING_KEY);
    return v;
  } catch { return null; }
}

// ── Ring audio (WebAudio synth) ───────────────────────────────────────

let ringCtx: AudioContext | null = null;
function ensureRingCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  if (!ringCtx) ringCtx = new AC();
  return ringCtx;
}

/** Twin-chirp that sounds like a soft incoming-call tone. */
function playRingTone() {
  const ctx = ensureRingCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  // Two bursts, ~500ms apart — classic ring pattern.
  const bursts = [0, 0.6];
  const tones: [number, number][] = [
    [523.25, 0.0],  // C5
    [659.25, 0.12], // E5
  ];
  for (const burstOffset of bursts) {
    for (const [freq, toneOffset] of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + burstOffset + toneOffset;
      const dur = 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.014);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
  }
}

const RING_TTL_MS = 30_000;

export function HuddleRing({ username, channelNames }: Props) {
  const [rings, setRings] = useState<IncomingRing[]>([]);
  // seen-ids dedup + TTL-based expiry so stale entries eventually free
  const seenRef = useRef<Map<string, number>>(new Map());
  const navigate = useNavigate();
  const { setGroupName } = useAppStore();

  useEffect(() => {
    const channel = getRingChannel();
    const handler = (evt: any) => {
      const p = evt?.payload as { group?: string; starter?: string; at?: number };
      if (!p || !p.group || !p.starter) return;
      // Absolute defense: if WE just started this group's huddle,
      // never ring — regardless of whose username is in the payload
      // or which handler closure caught the event. Catches both the
      // Realtime self-echo bug and the stale-closure-username bug.
      if (wasJustStartedByMe(p.group)) return;
      if (p.starter === username) return;
      if (!channelNames.includes(p.group) && p.group !== "General") return;

      const id = `${p.group}:${p.starter}:${p.at}`;
      const now = Date.now();
      // Dedup: same id within 10s is a duplicate delivery.
      const lastAt = seenRef.current.get(id);
      if (lastAt && now - lastAt < 10_000) return;
      seenRef.current.set(id, now);
      // Prune old seen entries so the map doesn't grow unboundedly.
      for (const [k, t] of seenRef.current) {
        if (now - t > 60_000) seenRef.current.delete(k);
      }

      setRings((r) => {
        // If a toast for this group+starter is still on screen, skip.
        if (r.some((x) => x.group === p.group && x.starter === p.starter)) return r;
        return [...r, { id, group: p.group!, starter: p.starter!, receivedAt: now }];
      });
      playRingTone();
    };
    channel.on("broadcast", { event: "huddle:start" }, handler);
    // No cleanup unsubscribe here — the channel is a shared singleton.
    // We just let the closure stop receiving when the component unmounts
    // by virtue of React GC'ing the handler's references.
    return () => {
      // Best-effort handler removal — Realtime doesn't expose an "off"
      // for specific handlers, so leave the shared channel in place.
    };
  }, [username, channelNames]);

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
    // Stash the group so ChatLayout picks it up and auto-joins the huddle.
    setPendingHuddleJoin(ring.group);
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
                {/* Display label — never the raw "dm::Ali::Mason" key.
                    Channels stay "#name", DMs render as the central
                    helper decides (other-party / Me / Axon / joined). */}
                in {isDMKey(ring.group)
                  ? displayLabelForDM(ring.group, username)
                  : `#${ring.group}`}
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
