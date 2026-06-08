/**
 * HuddleBar.tsx — Discord-style voice/video huddle panel. Large gallery
 * tiles, speaker-ring emphasis, screen sharing, expandable fullscreen
 * mode, and mute/camera/screen/leave controls.
 *
 * Layout:
 *   · Collapsed floating panel (default): bottom-right, tiles up to 220x140
 *   · Expanded mode: centered modal-style panel, tiles ~300x200
 *   · If any peer (or self) is sharing a screen, that screen takes the
 *     primary stage; camera tiles shrink and row along the bottom.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, AlertCircle,
  Monitor, MonitorOff, Maximize2, Minimize2, ChevronDown, RefreshCw,
  Sparkles, Check, Columns2, Rows2, LayoutGrid, Pin,
} from "lucide-react";
import type { HuddlePeer } from "./useHuddle";
import { ShareSourceModal } from "./ShareSourceModal";
import {
  useHuddleStore,
  QUALITY_PRESETS,
  type HuddleQuality,
} from "@/stores/huddleStore";
import { companySupabase } from "@/routes/index.lazy";
import { Employees } from "@/stores/query";
import { displayLabelForDM, isDMKey } from "../displayName";

// ── Active-speaker hook ─────────────────────────────────────────────
// Maintains one analyser per peer and returns the currently-loudest
// peer id (above threshold). Sticky for 1.2s to avoid tile flicker
// between spoken words.
function useActiveSpeaker(peers: HuddlePeer[]): string | null {
  const [active, setActive] = useState<string | null>(null);
  const lastSpokeAtRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (peers.length === 0) return;
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    const nodes: { id: string; analyser: AnalyserNode; buf: Uint8Array }[] = [];
    for (const p of peers) {
      if (!p.stream) continue;
      if (p.stream.getAudioTracks().length === 0) continue;
      try {
        const src = ctx.createMediaStreamSource(p.stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        nodes.push({ id: p.id, analyser, buf: new Uint8Array(analyser.fftSize) });
      } catch { /* noop */ }
    }
    if (nodes.length === 0) {
      ctx.close().catch(() => {});
      return;
    }
    let raf = 0;
    const tick = () => {
      let loudest: { id: string; rms: number } | null = null;
      for (const n of nodes) {
        n.analyser.getByteTimeDomainData(n.buf);
        let sum = 0;
        for (let i = 0; i < n.buf.length; i++) {
          const v = (n.buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / n.buf.length);
        if (rms > 0.06) lastSpokeAtRef.current[n.id] = Date.now();
        if (!loudest || rms > loudest.rms) loudest = { id: n.id, rms };
      }
      const now = Date.now();
      // Sticky: prefer current active if they spoke in last 1.2s.
      const currentStillSpeaking =
        active && (now - (lastSpokeAtRef.current[active] ?? 0)) < 1200;
      if (loudest && loudest.rms > 0.06) {
        setActive(loudest.id);
      } else if (!currentStillSpeaking) {
        setActive(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peers.map((p) => p.id + ":" + (p.stream ? "s" : "n")).join("|")]);

  return active;
}

interface Props {
  group: string;
  username: string;
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  peers: HuddlePeer[];
  muted: boolean;
  camera: boolean;
  sharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onStartScreenShare: () => Promise<void> | void;
  onStopScreenShare: () => void;
  onLeave: () => void;
  error: string | null;
}

export function HuddleBar({
  group, username, localStream, localScreenStream, peers,
  muted, camera, sharing,
  onToggleMute, onToggleCamera,
  onStartScreenShare, onStopScreenShare,
  onLeave, error,
}: Props) {
  // Pretty label for the huddle chip / header. For DMs ("dm::Ali::Mason")
  // the central helper renders "Mason" / "Me" / "Axon" / comma-joined
  // group; for channels (no dm:: prefix) we keep the existing "#name"
  // convention. Critical to gate the "#" prefix on isDMKey — without it,
  // a 1:1 huddle with Mason renders as "#Mason" instead of just "Mason".
  const isDmHuddle = isDMKey(group);
  const groupLabel = displayLabelForDM(group, username);
  const groupDisplay = isDmHuddle ? groupLabel : `#${groupLabel}`;
  const [expanded, setExpanded] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const quality = useHuddleStore((s) => s.quality);
  const setQuality = useHuddleStore((s) => s.setQuality);

  // username → public avatar URL for every employee. Used by PeerTile
  // to render real avatar images when a peer's camera is off, so the
  // huddle stops showing "AL" initials for someone with an avatar
  // uploaded. app_users uses the `avatar` column; Supabase getPublicUrl
  // builds the correct bucket URL (string concatenation misses some
  // bucket-prefix rules and breaks silently).
  const { data: employees } = Employees();
  const avatarByUser = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of (employees ?? []) as Array<{ username?: string; avatar?: string }>) {
      const name = u?.username;
      const file = u?.avatar;
      if (!name || !file) continue;
      const { data } = companySupabase.storage.from("avatars").getPublicUrl(file);
      if (data?.publicUrl) map.set(name, data.publicUrl);
    }
    return map;
  }, [employees]);
  const avatarFor = (name: string): string | null => {
    // Strip the "(you)" suffix the local tile adds before lookup.
    const clean = name.replace(/\s+\(you\)$/i, "");
    return avatarByUser.get(clean) ?? null;
  };
  // Third display state — minimized to a small status pill at the
  // bottom-right. Ignores drag offset + can't be dragged off-screen.
  // Persisted so it survives route changes + reloads.
  const [minimized, setMinimized] = useState<boolean>(() => {
    try { return window.localStorage.getItem("cwa-huddle-minimized") === "1"; }
    catch { return false; }
  });
  const persistMinimized = (v: boolean) => {
    try { window.localStorage.setItem("cwa-huddle-minimized", v ? "1" : "0"); } catch { /* noop */ }
  };

  // Screen-share layout: "stacked" (screens on top, camera row below —
  // the original layout) or "side" (screens on the left, camera tiles
  // in a column on the right). Persisted across sessions.
  const [screenLayout, setScreenLayout] = useState<"stacked" | "side">(() => {
    try {
      return window.localStorage.getItem("cwa-huddle-screen-layout") === "side"
        ? "side"
        : "stacked";
    } catch { return "stacked"; }
  });
  const toggleScreenLayout = () => {
    setScreenLayout((cur) => {
      const next = cur === "stacked" ? "side" : "stacked";
      try { window.localStorage.setItem("cwa-huddle-screen-layout", next); }
      catch { /* noop */ }
      return next;
    });
  };

  // Multi-screen view mode: "tile" (all screens side-by-side, original
  // behavior) or "focus" (Discord-style: one big screen + others as
  // clickable thumbs across the top). Persisted across sessions.
  //
  // When in focus mode AND multiple people are sharing, this picks
  // which screen takes the big stage. Click a thumb to swap focus.
  const [screenView, setScreenView] = useState<"tile" | "focus">(() => {
    try {
      return window.localStorage.getItem("cwa-huddle-screen-view") === "tile"
        ? "tile" : "focus";
    } catch { return "focus"; }
  });
  const toggleScreenView = () => {
    setScreenView((cur) => {
      const next = cur === "tile" ? "focus" : "tile";
      try { window.localStorage.setItem("cwa-huddle-screen-view", next); }
      catch { /* noop */ }
      return next;
    });
  };
  /** Name (peer id / "username (you)") of the screen we want to feature
   *  in focus mode. Null = use first screen. */
  const [focusedScreenName, setFocusedScreenName] = useState<string | null>(null);

  // Persisted drag offset — remember where the user dragged the bar to.
  // On mount we clamp it back into the visible viewport so a resize or
  // stale value can't leave the panel floating out of reach.
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = window.localStorage.getItem("cwa-huddle-offset");
      if (raw) {
        const parsed = JSON.parse(raw) as { x: number; y: number };
        // Clamp to current viewport. The panel is anchored at bottom:16
        // right:16 with a 480px width, so x must be negative enough
        // (leftward) to keep its left edge visible; same for y upward.
        const maxLeft = -Math.max(0, window.innerWidth - 520);
        const maxUp = -Math.max(0, window.innerHeight - 260);
        return {
          x: Math.min(0, Math.max(maxLeft, parsed.x || 0)),
          y: Math.min(20, Math.max(maxUp, parsed.y || 0)),
        };
      }
    } catch { /* noop */ }
    return { x: 0, y: 0 };
  });
  const persistOffset = (o: { x: number; y: number }) => {
    try { window.localStorage.setItem("cwa-huddle-offset", JSON.stringify(o)); } catch { /* noop */ }
  };
  const resetOffset = () => {
    setDragOffset({ x: 0, y: 0 });
    persistOffset({ x: 0, y: 0 });
  };

  // Active-speaker detection: listen to every peer's audio via a single
  // shared AudioContext. The loudest peer (> threshold) bubbles up so
  // their tile can be promoted. Sticky for 1.2s to avoid flicker when
  // people pause between words.
  const activeSpeaker = useActiveSpeaker(peers);

  // Collect ALL active screen shares — each peer's AND the local one
  // if you're sharing too. Multiple simultaneous streams tile the
  // primary stage side-by-side instead of only showing the first.
  const primaryScreens: { name: string; stream: MediaStream; isLocal?: boolean }[] = [
    ...peers
      .filter((p) => p.sharing && p.screenStream)
      .map((p) => ({ name: p.id, stream: p.screenStream! })),
    ...(sharing && localScreenStream
      ? [{ name: `${username} (you)`, stream: localScreenStream, isLocal: true }]
      : []),
  ];
  const hasScreenStage = primaryScreens.length > 0;

  const peopleCount = peers.length + 1;

  // ── Minimized state — small pill, always in the corner ──
  // Critically, the <PeerAudioSink> elements are rendered here as
  // siblings to the pill so remote audio keeps playing even though
  // the full panel (and its PeerTiles) are unmounted. Without this
  // the WebRTC connection stays alive but you can't hear anyone.
  if (minimized) {
    return (
      <>
        {/* Hidden audio sinks — one per remote peer with a stream.
            Must stay mounted for remote voices to keep playing while
            the panel is collapsed to a pill. */}
        {peers.map(
          (p) => p.stream && <PeerAudioSink key={p.id} stream={p.stream} />,
        )}
        <AnimatePresence>
          <motion.button
            key="huddle-pill"
            type="button"
            initial={{ y: 20, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => {
              setMinimized(false);
              persistMinimized(false);
            }}
            className="fixed bottom-4 right-4 z-30 flex items-center gap-2 rounded-full border border-primary/40 bg-card/95 px-3.5 py-2 shadow-xl backdrop-blur-md hover:bg-card transition-colors cursor-pointer"
            title="Restore huddle"
            style={{ boxShadow: "0 12px 36px rgba(0,0,0,0.5)" }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <Volume2 className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11.5px] font-semibold text-foreground">
              {groupDisplay}
            </span>
            <span className="text-[10.5px] text-muted-foreground">
              {peopleCount} {peopleCount === 1 ? "person" : "ppl"}
            </span>
            {muted && <MicOff className="h-3 w-3 text-destructive" />}
            {sharing && <Monitor className="h-3 w-3 text-blue-400" />}
            {/* Close/leave button — stops propagation so it doesn't restore. */}
            <span
              role="button"
              onClick={(e) => {
                e.stopPropagation();
                onLeave();
              }}
              className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/20 hover:text-destructive transition-colors"
              title="Leave huddle"
            >
              <PhoneOff className="h-2.5 w-2.5" />
            </span>
          </motion.button>
        </AnimatePresence>
      </>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key="huddle-panel"
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        // Draggable when NOT in expanded (fullscreen) mode. The motion
        // `drag` handle applies a translate, which adds on top of the
        // fixed bottom-4 right-4 origin. We persist the offset so the
        // panel "remembers" where you put it.
        drag={!expanded}
        dragMomentum={false}
        dragElastic={0.1}
        dragConstraints={{
          left: -Math.max(0, window.innerWidth - 520),
          right: 0,
          top: -Math.max(0, window.innerHeight - 240),
          bottom: 20,
        }}
        onDragEnd={(_, info) => {
          const next = {
            x: dragOffset.x + info.offset.x,
            y: dragOffset.y + info.offset.y,
          };
          setDragOffset(next);
          persistOffset(next);
        }}
        style={{
          boxShadow: "0 28px 80px rgba(0,0,0,0.55)",
          ...(expanded ? {} : { x: dragOffset.x, y: dragOffset.y }),
        }}
        className={`
          fixed z-30 flex flex-col gap-3 rounded-2xl border border-primary/25
          bg-card/95 backdrop-blur-md shadow-2xl
          ${expanded
            ? "inset-6 p-5"
            : "bottom-4 right-4 w-[480px] max-w-[calc(100vw-2rem)] p-3.5"}
        `}
      >
        {/* Header — doubles as drag handle */}
        <header
          className={`flex items-center gap-2 text-[11.5px] select-none ${
            expanded ? "" : "cursor-grab active:cursor-grabbing"
          }`}
        >
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <Volume2 className="h-3.5 w-3.5" />
            Huddle · {groupDisplay}
          </span>
          <span className="text-muted-foreground">
            {peopleCount} {peopleCount === 1 ? "person" : "people"}
          </span>
          {primaryScreens.length > 0 && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
              <Monitor className="h-3 w-3" />
              {primaryScreens.length === 1
                ? (sharing ? "you're sharing" : "1 sharing")
                : `${primaryScreens.length} sharing`}
            </span>
          )}
          {/* Live quality chip — mid-call hot-swap. Visible whenever
              there's a screen share active (self or any peer). */}
          {hasScreenStage && (
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQualityMenuOpen((v) => !v);
                }}
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/75 hover:border-white/20 hover:bg-white/10 hover:text-white transition-colors"
                title="Change screen-share quality"
              >
                <Sparkles className="h-2.5 w-2.5" />
                {QUALITY_PRESETS[quality].label.split("·")[1]?.trim() ?? quality}
                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
              </button>
              {qualityMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setQualityMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-white/10 bg-card/95 shadow-2xl backdrop-blur-xl">
                    <div className="border-b border-white/5 px-3 py-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-white/40">
                      Share Quality
                    </div>
                    {(["smooth", "balanced", "crisp", "ultra"] as HuddleQuality[]).map((k) => {
                      const p = QUALITY_PRESETS[k];
                      const on = k === quality;
                      return (
                        <button
                          key={k}
                          type="button"
                          onClick={() => {
                            setQuality(k);
                            setQualityMenuOpen(false);
                          }}
                          className={[
                            "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
                            on
                              ? "bg-blue-500/15 text-white"
                              : "text-white/75 hover:bg-white/5 hover:text-white",
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                              on ? "border-blue-400 bg-blue-500" : "border-white/20",
                            ].join(" ")}
                          >
                            {on && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11.5px] font-medium truncate">
                              {p.label}
                            </div>
                            <div className="text-[9.5px] leading-tight text-white/45 truncate">
                              {p.blurb}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          {error && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              {error}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {/* Reset-position — visible only when drag offset is non-zero. */}
            {(dragOffset.x !== 0 || dragOffset.y !== 0) && !expanded && (
              <button
                type="button"
                onClick={resetOffset}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title="Reset position"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            {/* Layout toggle — only visible when someone's sharing a
                screen. Switches between the default stacked layout
                (screens on top, camera row below) and a side-by-side
                layout (screens on the left, camera tiles in a column
                on the right). Choice is persisted in localStorage. */}
            {hasScreenStage && (
              <button
                type="button"
                onClick={toggleScreenLayout}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={
                  screenLayout === "side"
                    ? "Switch to stacked layout (screens on top)"
                    : "Switch to side-by-side layout (screens on left, cameras on right)"
                }
              >
                {screenLayout === "side"
                  ? <Rows2 className="h-3.5 w-3.5" />
                  : <Columns2 className="h-3.5 w-3.5" />}
              </button>
            )}
            {/* View mode toggle — only useful when 2+ people share.
                "focus" = Discord-style (one big + thumbnails on top,
                click to switch). "tile" = all equal-sized side-by-side. */}
            {primaryScreens.length > 1 && (
              <button
                type="button"
                onClick={toggleScreenView}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                title={
                  screenView === "focus"
                    ? "Show all screens side-by-side"
                    : "Focus one screen, others as thumbnails"
                }
              >
                {screenView === "focus"
                  ? <LayoutGrid className="h-3.5 w-3.5" />
                  : <Pin className="h-3.5 w-3.5" />}
              </button>
            )}
            {/* Minimize to pill. Disabled while expanded — collapse first. */}
            <button
              type="button"
              onClick={() => {
                if (expanded) setExpanded(false);
                setMinimized(true);
                persistMinimized(true);
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Minimize to pill"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {/* Expand / collapse fullscreen */}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={expanded ? "Exit fullscreen" : "Fullscreen"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </header>

        {/* Body */}
        <div className={`flex flex-1 flex-col gap-3 min-h-0 ${expanded ? "" : ""}`}>
          {hasScreenStage ? (
            screenLayout === "side" ? (
              // ── Side-by-side layout ───────────────────────────
              // Screens take roughly two-thirds on the left; camera
              // tiles stack in a column on the right at full tile
              // size (not the small row used in stacked mode). Works
              // well for presentations where the presenter's face +
              // reactions from participants both matter.
              <div className="flex flex-1 min-h-0 gap-2">
                {primaryScreens.length > 1 && screenView === "focus" ? (
                  <div className="flex-1 min-h-0">
                    <ScreenFocusStage
                      screens={primaryScreens}
                      focusedName={focusedScreenName}
                      onFocus={setFocusedScreenName}
                    />
                  </div>
                ) : (
                  <div
                    className="grid flex-1 min-h-0 gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${
                        primaryScreens.length === 1
                          ? 1
                          : Math.min(2, primaryScreens.length)
                      }, 1fr)`,
                      gridAutoRows: "1fr",
                    }}
                  >
                    {primaryScreens.map((s, i) => (
                      <ScreenShareTile
                        key={s.isLocal ? "local-screen" : `${s.name}-${i}`}
                        name={s.name}
                        stream={s.stream}
                      />
                    ))}
                  </div>
                )}
                <div
                  className="flex flex-col gap-2 shrink-0 overflow-y-auto"
                  style={{ width: expanded ? 280 : 200 }}
                >
                  <PeerTile
                    name={`${username} (you)`}
                    avatarUrl={avatarFor(username)}
                    stream={localStream}
                    isLocal
                    muted={muted}
                    cameraOn={camera}
                    sharing={sharing}
                    size="lg"
                  />
                  {peers.map((p) => (
                    <PeerTile
                      key={p.id}
                      name={p.id}
                      avatarUrl={avatarFor(p.id)}
                      stream={p.stream}
                      muted={p.muted}
                      cameraOn={p.camera}
                      sharing={p.sharing}
                      size="lg"
                      isActiveSpeaker={activeSpeaker === p.id}
                    />
                  ))}
                </div>
              </div>
            ) : (
              // ── Stacked layout (original / default) ───────────
              <>
                {/* Screen-share primary stage. Two modes:
                    · TILE — all screens side-by-side, original behavior
                    · FOCUS — Discord-style: one big + clickable thumbs
                      above. Click any thumb to switch focus. */}
                {primaryScreens.length > 1 && screenView === "focus" ? (
                  <ScreenFocusStage
                    screens={primaryScreens}
                    focusedName={focusedScreenName}
                    onFocus={setFocusedScreenName}
                  />
                ) : (
                  <div
                    className="grid flex-1 min-h-0 gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${
                        primaryScreens.length === 1
                          ? 1
                          : primaryScreens.length === 2
                            ? 2
                            : Math.min(3, primaryScreens.length)
                      }, 1fr)`,
                      gridAutoRows: "1fr",
                    }}
                  >
                    {primaryScreens.map((s, i) => (
                      <ScreenShareTile
                        key={s.isLocal ? "local-screen" : `${s.name}-${i}`}
                        name={s.name}
                        stream={s.stream}
                      />
                    ))}
                  </div>
                )}
                {/* Participants row below */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <PeerTile
                    name={`${username} (you)`}
                    avatarUrl={avatarFor(username)}
                    stream={localStream}
                    isLocal
                    muted={muted}
                    cameraOn={camera}
                    sharing={sharing}
                    size="sm"
                  />
                  {peers.map((p) => (
                    <PeerTile
                      key={p.id}
                      name={p.id}
                      avatarUrl={avatarFor(p.id)}
                      stream={p.stream}
                      muted={p.muted}
                      cameraOn={p.camera}
                      sharing={p.sharing}
                      size="sm"
                    />
                  ))}
                </div>
              </>
            )
          ) : (
            /* Gallery grid — auto-fit columns for Discord-like density */
            <div
              className={`grid flex-1 min-h-0 gap-2 ${
                expanded ? "auto-rows-[minmax(200px,1fr)]" : "auto-rows-[140px]"
              }`}
              style={{
                gridTemplateColumns: `repeat(auto-fit, minmax(${
                  expanded ? "280px" : "180px"
                }, 1fr))`,
              }}
            >
              <PeerTile
                name={`${username} (you)`}
                avatarUrl={avatarFor(username)}
                stream={localStream}
                isLocal
                muted={muted}
                cameraOn={camera}
                sharing={sharing}
                size="lg"
              />
              {peers.map((p) => (
                <PeerTile
                  key={p.id}
                  name={p.id}
                  avatarUrl={avatarFor(p.id)}
                  stream={p.stream}
                  muted={p.muted}
                  cameraOn={p.camera}
                  sharing={p.sharing}
                  size="lg"
                  isActiveSpeaker={activeSpeaker === p.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-2 pt-1">
          <ControlButton
            active={!muted}
            dangerWhenOff
            onClick={onToggleMute}
            Icon={muted ? MicOff : Mic}
            label={muted ? "Unmuted" : "Mute"}
            title={muted ? "Unmute (mic off)" : "Mute mic"}
          />
          <ControlButton
            active={camera}
            onClick={onToggleCamera}
            Icon={camera ? Video : VideoOff}
            label={camera ? "Camera on" : "Camera off"}
            title={camera ? "Stop camera" : "Start camera"}
          />
          <ControlButton
            active={sharing}
            onClick={() =>
              sharing ? onStopScreenShare() : setShareModalOpen(true)
            }
            Icon={sharing ? MonitorOff : Monitor}
            label={sharing ? "Stop sharing" : "Share screen"}
            title={sharing ? "Stop screen share" : "Share your screen"}
            tone="accent"
          />
          <div className="mx-1 h-6 w-px bg-border" />
          <button
            type="button"
            onClick={onLeave}
            className="flex h-9 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive px-4 text-[11.5px] font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
            title="Leave huddle"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            Leave
          </button>
        </div>
      </motion.div>

      {/* Pre-share modal — replaces the abrupt hand-off to the OS
          picker with a branded confirmation step + quality selector. */}
      <ShareSourceModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onConfirm={() => onStartScreenShare()}
        huddleName={groupDisplay}
        peerCount={peers.length}
      />
    </AnimatePresence>
  );
}

// ── Control button -----------------------------------------------------

function ControlButton({
  active, onClick, Icon, label, title, dangerWhenOff, tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  dangerWhenOff?: boolean;
  tone?: "default" | "accent";
}) {
  const activeCls = tone === "accent"
    ? "border-blue-400/50 bg-blue-500/20 text-blue-200"
    : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
  const inactiveCls = dangerWhenOff
    ? "border-destructive/40 bg-destructive/15 text-destructive"
    : "border-border bg-muted/40 text-foreground hover:bg-muted/60";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[11.5px] font-medium transition-colors ${
        active ? activeCls : inactiveCls
      }`}
      title={title}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ── Tiles --------------------------------------------------------------

function PeerTile({
  name, stream, isLocal, muted, cameraOn, sharing, size = "lg", isActiveSpeaker, avatarUrl,
}: {
  name: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  muted?: boolean;
  cameraOn?: boolean;
  sharing?: boolean;
  size?: "sm" | "lg";
  isActiveSpeaker?: boolean;
  /** Public URL of the peer's avatar image. When set + camera is off,
   *  the tile shows the avatar instead of the initials placeholder. */
  avatarUrl?: string | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speaking, setSpeaking] = useState(false);

  const showVideo = !!cameraOn && !!stream && stream.getVideoTracks().length > 0;

  // Video <srcObject> sync — uses BOTH a ref callback AND a useEffect:
  //
  //   1. Ref callback `attachVideo` — fires on every render with the
  //      current stream captured in closure. React re-invokes it when
  //      the inline function identity changes (every render) which
  //      means it reliably re-binds srcObject even when the parent
  //      passes a same-reference MediaStream whose contents changed
  //      (track add/remove, mute/unmute). This was the fix for the
  //      first-sharer-blind-to-second-sharer bug: updatePeersState
  //      was sometimes reusing the same MediaStream reference across
  //      renders, so a useEffect keyed on [stream] would skip the
  //      re-assignment and the video element kept showing stale
  //      tracks (or went black).
  //
  //   2. useEffect — kicks el.play() after srcObject is assigned.
  //      Chromium leaves the video paused when srcObject is set
  //      after mount; autoPlay only reliably fires for the INITIAL
  //      pre-paint srcObject. Swallow AbortError — happens when
  //      React re-renders mid-play().
  const attachVideo = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  };
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !showVideo || !stream) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    el.play().catch(() => { /* noop */ });
  }, [stream, showVideo]);

  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
        // After post-mount srcObject reassignment Chromium leaves the
        // element paused. Kick play() so remote voice keeps flowing
        // when the stream reference changes (e.g., after rebucketing
        // or a new track arrives).
        audioRef.current.play().catch(() => { /* noop */ });
      }
    }
    if (!stream || !window.AudioContext) return;
    let raf = 0;
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    let lastSpeaking = false;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const d = (data[i]! - 128) / 128;
        sum += d * d;
      }
      const rms = Math.sqrt(sum / data.length);
      const isSpeaking = rms > 0.04 && !muted;
      if (isSpeaking !== lastSpeaking) {
        lastSpeaking = isSpeaking;
        setSpeaking(isSpeaking);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      ctx.close().catch(() => {});
    };
  }, [stream, isLocal, muted]);

  // `showVideo` is declared once up top — this is just the tile
  // content from here on.
  const initial = name.replace(/\s+\(you\)$/i, "").slice(0, 2).toUpperCase();

  const sm = size === "sm";
  const tileCls = sm
    ? "h-[72px] w-[96px] rounded-lg"
    : "w-full h-full rounded-xl";
  const textCls = sm ? "text-[10px]" : "text-[12px]";

  return (
    <div className={`group relative ${sm ? "shrink-0" : ""} ${size === "lg" ? "min-h-[120px]" : ""}`}>
      <div
        className={`
          relative flex items-center justify-center overflow-hidden border transition-all
          ${tileCls}
          ${isActiveSpeaker
            ? "border-primary/90 shadow-[0_0_0_3px_hsl(var(--primary)/0.35)]"
            : speaking
              ? "border-emerald-400/80 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]"
              : "border-border/60"}
          bg-gradient-to-br from-muted/40 to-muted/20
        `}
      >
        {showVideo ? (
          <video
            ref={attachVideo}
            autoPlay
            playsInline
            muted={isLocal}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PeerAvatar
              src={avatarUrl ?? null}
              fallback={initial}
              sizeClass={sm ? "h-9 w-9 text-[13px]" : "h-16 w-16 text-2xl"}
            />
          </div>
        )}

        {/* Bottom-left name chip */}
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur-sm">
          <span className={`font-semibold text-white/90 truncate ${textCls}`} style={{ maxWidth: sm ? 70 : 180 }}>
            {name}
          </span>
        </div>

        {/* Status chips top-right */}
        <div className="absolute top-1.5 right-1.5 flex gap-1">
          {muted && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
              <MicOff className="h-2.5 w-2.5" />
            </div>
          )}
          {sharing && (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow">
              <Monitor className="h-2.5 w-2.5" />
            </div>
          )}
        </div>
      </div>
      {!isLocal && stream && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}
    </div>
  );
}

// ── PeerAudioSink ────────────────────────────────────────────────
// A zero-UI component whose only job is to play a remote peer's
// audio. We render one of these PER PEER, unconditionally, at the
// root of both the minimized-pill branch and the full-panel branch
// — that way remote audio keeps playing while the user is in pill
// mode. Previously, audio playback was coupled to PeerTile, which
// unmounts when the pill collapses the panel, so minimizing cut
// all remote audio on our side (peers still heard us fine since
// our outgoing mic comes from getUserMedia, not a DOM element).
//
// Kept intentionally tiny: no speaking analyser, no volume UI, no
// muted-state icon — those all belong to the visible PeerTile. This
// is purely an audio playback surface.

function PeerAudioSink({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    // Some browsers pause the element when srcObject is reassigned
    // on an already-playing sink. Kicking play() fixes it; silently
    // ignore AbortError (happens when React re-renders mid-promise).
    el.play().catch(() => { /* noop — autoplay policy or re-render */ });
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline className="hidden" />;
}

// ──────────────────────────────────────────────────────────────────
// ScreenFocusStage — Discord-style multi-screen viewer.
//
// Renders ONE big screen tile in the center, with the other sharers
// shown as small clickable thumbnails across the top. Click any thumb
// to swap focus. Default focus = the first non-local sharer (so when
// the local user is also sharing they tend to want to watch what the
// other person is showing, not their own).
//
// Pure presentational — focus state lives in the parent so it
// survives unmounts (e.g. switching screen layout).
// ──────────────────────────────────────────────────────────────────
function ScreenFocusStage({
  screens,
  focusedName,
  onFocus,
}: {
  screens: { name: string; stream: MediaStream; isLocal?: boolean }[];
  focusedName: string | null;
  onFocus: (name: string | null) => void;
}) {
  // Resolve focused screen. Fallback: first remote if any, else first.
  const focused = useMemo(() => {
    if (focusedName) {
      const hit = screens.find((s) => s.name === focusedName);
      if (hit) return hit;
    }
    const firstRemote = screens.find((s) => !s.isLocal);
    return firstRemote ?? screens[0];
  }, [screens, focusedName]);

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-2">
      {/* Thumbnail strip — small clickable previews of every active
          screen. The currently-focused one gets a blue ring; others
          dim slightly until hovered. */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-shrink-0">
        {screens.map((s, i) => {
          const isFocused = s === focused;
          return (
            <button
              key={s.isLocal ? "local-thumb" : `${s.name}-thumb-${i}`}
              type="button"
              onClick={() => onFocus(s.name)}
              className={
                "relative shrink-0 overflow-hidden rounded-md border bg-black transition-all " +
                (isFocused
                  ? "border-blue-400/70 ring-1 ring-blue-400/40"
                  : "border-border opacity-70 hover:opacity-100 hover:border-blue-400/50")
              }
              style={{ width: 120, height: 68 }}
              title={isFocused ? `Focused: ${s.name}` : `Switch focus to ${s.name}`}
            >
              <ScreenThumbVideo stream={s.stream} />
              <div className="absolute bottom-0.5 left-0.5 right-0.5 truncate rounded bg-black/70 px-1 py-0.5 text-[9.5px] font-semibold text-blue-100">
                {s.name}{s.isLocal ? " · you" : ""}
              </div>
              {isFocused && (
                <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 rounded-sm bg-blue-500/90 px-1 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-white">
                  <Pin className="h-2 w-2" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Focused screen — fills the remaining stage height. */}
      <div className="flex-1 min-h-0">
        {focused && (
          <ScreenShareTile
            key={focused.isLocal ? "local-focus" : `${focused.name}-focus`}
            name={focused.name}
            stream={focused.stream}
          />
        )}
      </div>
    </div>
  );
}

// Lightweight video element used in the thumb strip. Mirrors
// ScreenShareTile's attach pattern but skips the bottom name overlay
// and chrome — the parent button renders the label.
function ScreenThumbVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const attach = (el: HTMLVideoElement | null) => {
    ref.current = el;
    if (el && stream && el.srcObject !== stream) el.srcObject = stream;
  };
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => { /* noop */ });
  }, [stream]);
  return (
    <video
      ref={attach}
      autoPlay
      playsInline
      muted
      className="h-full w-full object-cover"
    />
  );
}

function ScreenShareTile({ name, stream }: { name: string; stream: MediaStream }) {
  // Ref callback + play() kick. The ref callback handles srcObject
  // assignment across re-renders (including same-reference streams
  // whose contents mutated). The useEffect fires play() in case
  // Chromium left the element paused after a post-mount srcObject
  // assignment — autoPlay alone doesn't always resume.
  const ref = useRef<HTMLVideoElement | null>(null);
  const attach = (el: HTMLVideoElement | null) => {
    ref.current = el;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
    }
  };
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;
    el.play().catch(() => { /* noop */ });
  }, [stream]);
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-blue-400/30 bg-black">
      <video
        ref={attach}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-contain"
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/70 px-2 py-1 text-[11px] font-semibold text-blue-200 backdrop-blur">
        <Monitor className="h-3 w-3" />
        {name} · sharing screen
      </div>
    </div>
  );
}

// ── PeerAvatar ───────────────────────────────────────────────────
// Renders the peer's profile picture when `src` is provided, falling
// back to a gradient circle with their initials. Used inside PeerTile
// when the camera is off — replaces the old initials-only placeholder
// so people with avatars show their actual face on the call tile.
//
// Why a separate component (vs. inline conditional):
//   · We need useState to track image load failure (broken URL, 404,
//     CORS hiccup) and gracefully swap to initials WITHOUT requiring
//     the parent to know whether the URL eventually resolved.
//   · Mirrors the FaceChip pattern used in ChatSidebar so behavior is
//     consistent across the two surfaces (sidebar face-pile + huddle
//     gallery tiles).
//
// `sizeClass` is passed in so PeerTile can use the small variant in
// the bottom-row stacked layout vs. the large variant in the gallery
// grid — keeps sizing concerns at the call site.

function PeerAvatar({
  src,
  fallback,
  sizeClass,
}: {
  src: string | null;
  fallback: string;
  sizeClass: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = !!src && !failed;
  return showImg ? (
    <img
      src={src!}
      alt={fallback}
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-full object-cover ring-1 ring-white/10`}
    />
  ) : (
    <div
      className={`${sizeClass} flex items-center justify-center rounded-full bg-gradient-to-br from-primary/40 to-primary/20 font-semibold text-foreground ring-1 ring-white/10`}
    >
      {fallback}
    </div>
  );
}
