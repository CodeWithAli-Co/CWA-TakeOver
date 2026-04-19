/**
 * VoicePlayer.tsx — Custom voice-message / audio player UI.
 *
 * Replaces the default <audio controls> element (black bg, generic
 * chrome) with a styled player that matches the chat theme:
 *   · primary-tinted play/pause pill
 *   · mini waveform (randomized-deterministic bars) that fills to a
 *     progress color as playback advances
 *   · elapsed / total time readout
 *   · variable-speed button (1x / 1.5x / 2x)
 *
 * No external deps; a real waveform would need a peak-extraction step
 * either at upload or via AudioBuffer analysis. For a chat-grade voice
 * note the stylized bars look great without that overhead.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";

interface Props {
  src: string;
  /** Render compact (inline beside text) — defaults to standard. */
  compact?: boolean;
}

const PLAYBACK_RATES = [1, 1.5, 2] as const;

// Deterministic pseudo-random bar heights from a URL string so the same
// voice note always shows the same waveform shape.
function hashBars(src: string, count: number): number[] {
  const out: number[] = [];
  let seed = 0;
  for (let i = 0; i < src.length; i++) seed = (seed * 31 + src.charCodeAt(i)) >>> 0;
  for (let i = 0; i < count; i++) {
    // xorshift32
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    const v = (seed >>> 0) / 0xffffffff;
    // Bias to mid-high bars (0.3 – 1.0) for a lively look
    out.push(0.3 + v * 0.7);
  }
  return out;
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoicePlayer({ src, compact = false }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIdx, setRateIdx] = useState(0);

  const barCount = compact ? 28 : 42;
  const bars = useMemo(() => hashBars(src, barCount), [src, barCount]);

  // Wire up audio events
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setCurrent(a.currentTime);
    const onMeta = () => setDuration(a.duration || 0);
    const onEnd = () => { setPlaying(false); setCurrent(0); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      // Pause any other voice players currently playing (browser only
      // plays one audio at a time nicely, but this enforces it).
      document.querySelectorAll("audio[data-voice-player]").forEach((el) => {
        if (el !== a) (el as HTMLAudioElement).pause();
      });
      void a.play();
    } else {
      a.pause();
    }
  };

  const cycleRate = () => {
    const a = audioRef.current;
    if (!a) return;
    const next = (rateIdx + 1) % PLAYBACK_RATES.length;
    setRateIdx(next);
    a.playbackRate = PLAYBACK_RATES[next];
  };

  const seekFromPointer = (clientX: number) => {
    const a = audioRef.current;
    const el = barsRef.current;
    if (!a || !el || !duration) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    a.currentTime = pct * duration;
    setCurrent(a.currentTime);
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl border border-primary/25 bg-primary/[0.06] px-2.5 py-1.5 shadow-sm transition-colors hover:border-primary/40 ${
        compact ? "max-w-[280px]" : "max-w-[360px]"
      }`}
    >
      <audio ref={audioRef} src={src} preload="metadata" data-voice-player className="hidden" />

      {/* Play/pause */}
      <button
        type="button"
        onClick={toggle}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-[1px]" />
        )}
      </button>

      {/* Waveform */}
      <div
        ref={barsRef}
        className="relative flex h-7 flex-1 cursor-pointer items-center gap-[2px]"
        onClick={(e) => seekFromPointer(e.clientX)}
        onMouseDown={(e) => {
          const move = (ev: MouseEvent) => seekFromPointer(ev.clientX);
          const up = () => {
            document.removeEventListener("mousemove", move);
            document.removeEventListener("mouseup", up);
          };
          document.addEventListener("mousemove", move);
          document.addEventListener("mouseup", up);
          seekFromPointer(e.clientX);
        }}
      >
        {bars.map((h, i) => {
          const passed = i / bars.length < progress;
          return (
            <div
              key={i}
              className={`flex-1 rounded-full transition-colors ${
                passed ? "bg-primary" : "bg-primary/30"
              }`}
              style={{ height: `${Math.max(10, h * 100)}%` }}
            />
          );
        })}
      </div>

      {/* Time + speed */}
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums min-w-[46px] text-right">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <button
          type="button"
          onClick={cycleRate}
          className="flex h-6 min-w-[28px] items-center justify-center rounded-full border border-border bg-background/60 px-1.5 font-mono text-[9.5px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          title="Playback speed"
        >
          {PLAYBACK_RATES[rateIdx]}x
        </button>
        <Volume2 className="h-3 w-3 text-muted-foreground/60" />
      </div>
    </div>
  );
}
