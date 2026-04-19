/**
 * HuddleHost.tsx — Lives at the root of the app (mounted in __root.tsx).
 * Reads huddle state from the global store so the call continues
 * regardless of which route the user is on. ChatLayout now just
 * toggles the store via `startHuddle` / `leaveHuddle`.
 */

import { useEffect } from "react";
import { useHuddle } from "./useHuddle";
import { HuddleBar } from "./HuddleBar";
import { useHuddleStore } from "@/stores/huddleStore";
import { ActiveUser } from "@/stores/query";

export function HuddleHost() {
  const { group, muted, camera, leaveHuddle, toggleMute, toggleCamera, pttActive } =
    useHuddleStore();
  const { data: me } = ActiveUser();
  const username = me?.[0]?.username || "";

  // Effective mute state: if push-to-talk is active, treat as unmuted
  // regardless of the persisted `muted` flag.
  const effectiveMuted = pttActive ? false : muted;

  const huddle = useHuddle({
    group: group ?? "",
    username,
    joined: group != null && !!username,
    muted: effectiveMuted,
    camera,
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
