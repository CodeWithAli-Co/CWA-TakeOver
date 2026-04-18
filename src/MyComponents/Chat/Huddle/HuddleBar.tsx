/**
 * HuddleBar.tsx — Floating bottom bar shown when the user is in a voice
 * huddle. Displays self + every remote peer (avatar tiles), mute /
 * camera / leave controls, and (when video is on) inline <video>
 * elements for each peer's tile.
 */

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Volume2, AlertCircle,
} from "lucide-react";
import type { HuddlePeer } from "./useHuddle";

interface Props {
  group: string;
  /** Currently-joined user's name. */
  username: string;
  localStream: MediaStream | null;
  peers: HuddlePeer[];
  muted: boolean;
  camera: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  error: string | null;
}

export function HuddleBar({
  group, username, localStream, peers, muted, camera,
  onToggleMute, onToggleCamera, onLeave, error,
}: Props) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-x-3 bottom-3 z-30 flex flex-col gap-2 rounded-xl border border-primary/30 bg-card/95 px-3 py-2.5 backdrop-blur"
      style={{ boxShadow: "0 18px 48px rgba(0,0,0,0.6)" }}
    >
      <div className="flex items-center gap-2 text-[11px]">
        <span className="flex items-center gap-1.5 font-semibold text-primary">
          <Volume2 className="h-3.5 w-3.5" />
          Huddle in #{group}
        </span>
        <span className="text-muted-foreground">
          · {peers.length + 1} {peers.length + 1 === 1 ? "person" : "people"}
        </span>
        {error && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertCircle className="h-3 w-3" />
            {error}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {/* Self */}
        <PeerTile
          name={`${username} (you)`}
          stream={localStream}
          isLocal
          muted={muted}
          cameraOn={camera}
        />
        {peers.map((p) => (
          <PeerTile
            key={p.id}
            name={p.id}
            stream={p.stream}
            muted={p.muted}
            cameraOn={p.camera}
          />
        ))}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onToggleMute}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
            muted
              ? "border-destructive/40 bg-destructive/15 text-destructive"
              : "border-border bg-muted/40 text-foreground hover:bg-muted/60"
          }`}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {muted ? "Muted" : "Mic on"}
        </button>
        <button
          type="button"
          onClick={onToggleCamera}
          className={`flex h-8 items-center gap-1.5 rounded-full border px-3 text-[11px] font-medium transition-colors ${
            camera
              ? "border-primary/40 bg-primary/15 text-primary"
              : "border-border bg-muted/40 text-foreground hover:bg-muted/60"
          }`}
          title={camera ? "Stop camera" : "Start camera"}
        >
          {camera ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
          {camera ? "Camera" : "No video"}
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="flex h-8 items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive px-3 text-[11px] font-medium text-destructive-foreground hover:bg-destructive/90"
          title="Leave huddle"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          Leave
        </button>
      </div>
    </motion.div>
  );
}

function PeerTile({
  name, stream, isLocal, muted, cameraOn,
}: {
  name: string;
  stream: MediaStream | null;
  isLocal?: boolean;
  muted?: boolean;
  cameraOn?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [speaking, setSpeaking] = useState(false);

  // Hook stream into element + simple speaking detector.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
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
      const isSpeaking = rms > 0.04;
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
  }, [stream, isLocal]);

  const showVideo = !!cameraOn && !!stream && stream.getVideoTracks().length > 0;
  const initial = name.replace(/\s+\(you\)$/i, "").slice(0, 1).toUpperCase();

  return (
    <div className="relative shrink-0">
      <div
        className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border transition-colors ${
          speaking ? "border-emerald-400" : "border-border"
        } bg-muted/40`}
      >
        {showVideo ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal /* avoid local echo */}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-lg font-semibold text-foreground/80">
            {initial}
          </span>
        )}
      </div>
      {/* Hidden audio element for remote peers */}
      {!isLocal && stream && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}
      {muted && (
        <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-destructive text-[8px] text-destructive-foreground">
          <MicOff className="h-2 w-2" />
        </div>
      )}
      <div className="mt-1 truncate text-center text-[9.5px] text-muted-foreground" style={{ maxWidth: 64 }}>
        {name}
      </div>
    </div>
  );
}
