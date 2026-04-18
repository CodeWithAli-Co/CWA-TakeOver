// ───────────────────────────────────────────────────────────────────
// Orb — persistent draggable visual presence.
// Renders five animation states + a live-audio visualizer ring while
// listening.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { useAxon } from "../AxonProvider";

const ORB_SIZE = 72;

export function Orb() {
  const {
    status,
    orbPosition,
    setOrbPosition,
    togglePanel,
    audioLevel,
    liveTranscript,
    settings,
  } = useAxon();

  const orbRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── draggable ──
  useEffect(() => {
    const el = orbRef.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        origX: orbPosition.x,
        origY: orbPosition.y,
        moved: false,
      };
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || !d.dragging) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      setOrbPosition({
        x: Math.max(8, Math.min(window.innerWidth - ORB_SIZE - 8, d.origX + dx)),
        y: Math.max(8, Math.min(window.innerHeight - ORB_SIZE - 8, d.origY + dy)),
      });
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      el.releasePointerCapture(e.pointerId);
      if (d && !d.moved) togglePanel();
      dragRef.current = null;
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbPosition.x, orbPosition.y]);

  // ── audio visualizer (while listening) ──
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      if (status === "listening" || status === "processing" || status === "speaking") {
        const accent = getComputedStyle(c).getPropertyValue("--axon-accent-rgb").trim() || "220, 38, 38";
        const cx = c.width / 2;
        const cy = c.height / 2;
        const base = 42;
        // Three concentric rings, reactive to level in listening mode.
        for (let i = 0; i < 3; i++) {
          const wobble =
            status === "listening"
              ? audioLevel * 10 + Math.sin(Date.now() / 400 + i) * 2
              : status === "processing"
              ? 3 + i * 2
              : Math.sin(Date.now() / 160 + i) * 4 + 2;
          const r = base + i * 5 + wobble;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${accent}, ${0.4 - i * 0.1})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [status, audioLevel]);

  // Don't render if disabled.
  if (!settings.enabled) return null;

  return (
    <>
      <div
        ref={orbRef}
        className="axon-orb"
        data-state={status}
        style={{ left: `${orbPosition.x}px`, top: `${orbPosition.y}px` }}
        role="button"
        aria-label="AXON command orb"
        title="AXON — click to open panel"
      >
        <canvas
          ref={canvasRef}
          className="axon-orb-visualizer"
          width={ORB_SIZE + 36}
          height={ORB_SIZE + 36}
        />
        <div className="axon-orb-ring" />
        <div className="axon-orb-core" />
      </div>

      {liveTranscript && status === "listening" && (
        <div
          className="axon-live-transcript"
          style={{
            left: Math.max(8, orbPosition.x - 260),
            top: orbPosition.y + 14,
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: "0.1em", opacity: 0.7 }}>HEARING…</div>
          <div>{liveTranscript}</div>
        </div>
      )}
    </>
  );
}
