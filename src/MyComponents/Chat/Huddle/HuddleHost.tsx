/**
 * HuddleHost.tsx — Lives at the root of the app (mounted in __root.tsx).
 * Reads huddle state from the global store so the call continues
 * regardless of which route the user is on. ChatLayout now just
 * toggles the store via `startHuddle` / `leaveHuddle`.
 *
 * Also runs the global "huddle lobby" presence subscription that
 * powers the in-call indicators in the chat sidebar. Every signed-in
 * client tracks `{ huddle: currentGroup | null }` on the lobby so
 * other users can see who's huddled where WITHOUT having to join.
 * Writes the resulting map into `liveHuddlesStore` for any UI to
 * consume.
 */

import { useEffect, useRef } from "react";
import { useHuddle } from "./useHuddle";
import { HuddleBar } from "./HuddleBar";
import { useHuddleStore } from "@/stores/huddleStore";
import { useLiveHuddlesStore } from "@/stores/liveHuddlesStore";
import { ActiveUser } from "@/stores/query";
import { takeOversupabase } from "@/MyComponents/supabase";

export function HuddleHost() {
  const { group, muted, camera, leaveHuddle, toggleMute, toggleCamera, pttActive, quality } =
    useHuddleStore();
  const { data: me } = ActiveUser();
  const username = me?.[0]?.username || "";

  const effectiveMuted = pttActive ? false : muted;

  const huddle = useHuddle({
    group: group ?? "",
    username,
    joined: group != null && !!username,
    muted: effectiveMuted,
    camera,
    quality,
  });

  // Push-to-talk: hold Space (outside of input fields) to unmute.
  useEffect(() => {
    if (!group) return;
    const shouldSkip = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        !!(el && (el as HTMLElement).isContentEditable)
      );
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (shouldSkip(e.target)) return;
      e.preventDefault();
      useHuddleStore.getState().setPttActive(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (shouldSkip(e.target)) return;
      useHuddleStore.getState().setPttActive(false);
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [group]);

  // ── Live-huddle lobby ────────────────────────────────────────────
  // Mounts once per username session. Tracks the current user's
  // huddle state on a global presence channel; reads + publishes the
  // resulting "who's where" map to liveHuddlesStore so UI surfaces
  // (chat sidebar) can show in-call indicators without joining.
  //
  // CRITICAL: we don't wait on the presence round-trip to update OUR
  // OWN sidebar — that round-trip is flaky (mid-reconnect, dropped
  // broadcast, HMR-leftover channel). Instead we patch our own row
  // into liveHuddlesStore SYNCHRONOUSLY on every group change. The
  // presence broadcast is still propagated to remote peers so their
  // sidebars update too — but our local UI never depends on it.
  const lobbyRef = useRef<ReturnType<typeof takeOversupabase.channel> | null>(null);
  const subscribedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!username) return;

    const channel = takeOversupabase.channel("huddle-lobby", {
      config: { presence: { key: username } },
    });
    lobbyRef.current = channel;
    subscribedRef.current = false;

    channel
      .on("presence", { event: "sync" }, () => {
        const presenceState = channel.presenceState() as Record<
          string,
          Array<{ huddle?: string | null; ts?: number }>
        >;
        // Build a fresh Map so Zustand + React notice the change.
        const next = new Map<string, string[]>();
        for (const [user, instances] of Object.entries(presenceState)) {
          // Pick the MOST RECENTLY updated instance per user (highest
          // ts). Older instances can linger in the presence state when
          // a client switches huddles, so picking any-non-null would
          // surface the stale "previous huddle" value. ts is set by
          // every track() call below.
          const latest = instances.reduce<{ huddle?: string | null; ts?: number } | null>(
            (best, cur) => {
              const bestTs = best?.ts ?? -Infinity;
              const curTs = cur?.ts ?? -Infinity;
              return curTs > bestTs ? cur : best;
            },
            null,
          );
          const huddle = latest?.huddle;
          if (typeof huddle !== "string" || huddle.length === 0) continue;
          const arr = next.get(huddle) ?? [];
          if (!arr.includes(user)) arr.push(user);
          next.set(huddle, arr);
        }
        // Overlay OUR OWN current state. The presence broadcast for
        // our own track() can lag or drop entirely — this guarantees
        // our row in the sidebar is always in sync with the store
        // regardless of network state.
        const myGroup = useHuddleStore.getState().group;
        // Remove ourselves from every channel first.
        for (const [ch, users] of Array.from(next.entries())) {
          const stripped = users.filter((u) => u !== username);
          if (stripped.length === 0) next.delete(ch);
          else next.set(ch, stripped);
        }
        // Re-add to current huddle if we're in one.
        if (myGroup) {
          const arr = next.get(myGroup) ?? [];
          if (!arr.includes(username)) arr.push(username);
          next.set(myGroup, arr);
        }
        useLiveHuddlesStore.getState().setByChannel(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          subscribedRef.current = true;
          // Initial track reflects whatever huddle state we're in right
          // now (handles refresh-while-in-call cleanly). ts lets the
          // sync handler pick the latest instance per user.
          channel.track({
            huddle: useHuddleStore.getState().group ?? null,
            ts: Date.now(),
          });
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          subscribedRef.current = false;
        }
      });

    return () => {
      subscribedRef.current = false;
      channel.unsubscribe();
      lobbyRef.current = null;
      // Clear the store on logout so stale state doesn't linger.
      useLiveHuddlesStore.getState().setByChannel(new Map());
    };
  }, [username]);

  // Re-track whenever the user's huddle state changes (join / leave /
  // switch huddles). Two-step:
  //
  //   1. SYNCHRONOUSLY patch liveHuddlesStore so OUR OWN sidebar
  //      reflects the change immediately. No network wait, no
  //      dependency on the presence broadcast actually landing.
  //
  //   2. Push the change up to the lobby presence so OTHER clients
  //      see it. We retry briefly if the channel isn't subscribed
  //      yet — common on first paint when this effect fires before
  //      SUBSCRIBED arrives.
  //
  // We `untrack()` before `track()` to force a clean state
  // replacement — Supabase presence has been observed retaining the
  // previous instance alongside the new one when only track() is
  // called, which made the sidebar show "in call" on BOTH the old
  // and new channels after switching.
  useEffect(() => {
    if (!username) return;

    // Step 1: optimistic local patch. Strip the user out of every
    // channel, then re-add to the current one (if any). Always
    // produces a fresh Map so Zustand + React notice the change.
    {
      const prev = useLiveHuddlesStore.getState().byChannel;
      const next = new Map<string, string[]>();
      for (const [ch, users] of prev.entries()) {
        const stripped = users.filter((u) => u !== username);
        if (stripped.length > 0) next.set(ch, stripped);
      }
      if (group) {
        const arr = next.get(group) ?? [];
        if (!arr.includes(username)) arr.push(username);
        next.set(group, arr);
      }
      useLiveHuddlesStore.getState().setByChannel(next);
    }

    // Step 2: propagate to lobby presence so other clients see it.
    // Retry a few times while the channel is still connecting
    // (first-mount race where this effect can fire before
    // SUBSCRIBED arrives).
    let cancelled = false;
    void (async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        const channel = lobbyRef.current;
        if (channel && subscribedRef.current) {
          try { await channel.untrack(); } catch { /* noop */ }
          try { await channel.track({ huddle: group ?? null, ts: Date.now() }); }
          catch { /* noop */ }
          return;
        }
        // Wait 150ms and try again. Bails after ~3s.
        await new Promise((r) => setTimeout(r, 150));
      }
    })();
    return () => { cancelled = true; };
  }, [group, username]);

  if (!group) return null;

  return (
    <HuddleBar
      group={group}
      username={username}
      localStream={huddle.localStream}
      localScreenStream={huddle.localScreenStream}
      peers={huddle.peers}
      muted={effectiveMuted}
      camera={camera}
      sharing={huddle.sharing}
      onToggleMute={toggleMute}
      onToggleCamera={toggleCamera}
      onStartScreenShare={huddle.startScreenShare}
      onStopScreenShare={huddle.stopScreenShare}
      onLeave={() => {
        if (huddle.sharing) huddle.stopScreenShare();
        leaveHuddle();
      }}
      error={huddle.error}
    />
  );
}
