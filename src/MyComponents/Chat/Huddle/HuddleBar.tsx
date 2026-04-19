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

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, AlertCircle,
  Monitor, MonitorOff, Maximize2, Minimize2,
} from "lucide-react";
import type { HuddlePeer } from "./useHuddle";

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
  const [expanded, setExpanded] = useState(false);

  // Identify the primary screen share (first peer sharing, else local if sharing)
  const sharingPeer = peers.find((p) => p.sharing && p.screenStream);
  const primaryScreen: { name: string; stream: MediaStream } | null = sharingPeer
    ? { name: sharingPeer.id, stream: sharingPeer.screenStream! }
    : sharing && localScreenStream
      ? { name: `${username} (you)`, stream: localScreenStream }
      : null;

  const peopleCount = peers.length + 1;

  return (
    <AnimatePresence>
      <motion.div
        key="huddle-panel"
        initial={{ y: 20, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={`
          fixed z-30 flex flex-col gap-3 rounded-2xl border border-primary/25
          bg-card/95 backdrop-blur-md shadow-2xl
          ${expanded
            ? "inset-6 p-5"
            : "bottom-4 right-4 w-[480px] max-w-[calc(100vw-2rem)] p-3.5"}
        `}
        style={{ boxShadow: "0 28px 80px rgba(0,0,0,0.55)" }}
      >
        {/* Header */}
        <header className="flex items-center gap-2 text-[11.5px]">
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-1 font-semibold text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <Volume2 className="h-3.5 w-3.5" />
            Huddle · #{group}
          </span>
          <span className="text-muted-foreground">
            {peopleCount} {peopleCount === 1 ? "person" : "people"}
          </span>
          {sharing && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-300">
              <Monitor className="h-3 w-3" /> sharing screen
            </span>
          )}
          {error && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              {error}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </header>

        {/* Body */}
        <div className={`flex flex-1 flex-col gap-3 min-h-0 ${expanded ? "" : ""}`}>
          {primaryScreen ? (
            <>
              {/* Screen-share primary stage */}
              <div className="flex-1 min-h-0">
                <ScreenShareTile name={primaryScreen.name} stream={primaryScreen.stream} />
              </div>
              {/* Participants row below */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <PeerTile
                  name={`${username} (you)`}
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
                    stream={p.stream}
                    muted={p.muted}
                    cameraOn={p.camera}
                    sharing={p.sharing}
                    size="sm"
                  />
                ))}
              </div>
            </>
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
                  stream={p.stream}
                  muted={p.muted}
                  cameraOn={p.camera}
                  sharing={p.sharing}
                  size="lg"
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
            onClick={() => (sharing ? onStopScreenShare() : onStartScreenShare())}
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
  name, stream, isLocal, muted, cameraOn, sharing, size = "lg",
}: {
  name: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  muted?: boolean;
  cameraOn?: boolean;
  sharing?: boolean;
  size?: "sm" | "lg";
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [speaking, setSpeaking] = useState(false);

  // Use a ref callback so srcObject is re-assigned whenever the <video>
  // element mounts/unmounts. Works across cameraOn toggles (which
  // swap the video element for an avatar and back), unlike a plain ref
  // + useEffect pattern which can miss the remount.
  const attachVideo = (el: HTMLVideoElement | null) => {
    if (el && stream) {
      // Only re-assign if different — avoids needless pauses.
      if (el.srcObject !== stream) el.srcObject = stream;
    }
  };

  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      if (audioRef.current.srcObject !== stream) {
        audioRef.current.srcObject = stream;
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

  const showVideo = !!cameraOn && !!stream && stream.getVideoTracks().length > 0;
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
          ${speaking
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
            <div
              className={`flex items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 font-semibold text-primary-foreground/90 ${
                sm ? "h-9 w-9 text-[13px]" : "h-16 w-16 text-2xl"
              }`}
            >
              {initial}
            </div>
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

function ScreenShareTile({ name, stream }: { name: string; stream: MediaStream }) {
  // Ref callback for robust srcObject assignment across remounts.
  const attach = (el: HTMLVideoElement | null) => {
    if (el && stream && el.srcObject !== stream) el.srcObject = stream;
  };
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
