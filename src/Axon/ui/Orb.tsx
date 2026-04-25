// ───────────────────────────────────────────────────────────────────
// Orb v3 — plasma sphere.
// Entirely canvas-driven. Renders:
//   - A translucent sphere rim
//   - Flowing inner energy waves (lissajous / noise-field hybrid)
//   - Reactive core light
//   - Orbiting dust particles around the sphere (no rectangular bg)
// No DOM children inside the orb — everything is on the canvas so the
// visual reads as a single coherent object, not a div sandwich.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { useAxon } from "../AxonProvider";

// Orb dimensions — smaller footprint so it doesn't dominate the
// screen. The particle ring still has room to orbit via PADDING.
const ORB_SIZE = 68;
const PADDING = 20;

function parseRgb(raw: string): [number, number, number] {
  const parts = raw.split(",").map((n) => parseInt(n.trim(), 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return [parts[0], parts[1], parts[2]];
  }
  return [220, 38, 38]; // CWA red default
}

export function Orb() {
  const {
    status,
    voiceState,
    orbPosition,
    setOrbPosition,
    togglePanel,
    audioLevel,
    liveTranscript,
    settings,
  } = useAxon();

  const orbRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ dragging: boolean; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);

  // Keep latest reactive values in refs so canvas loop doesn't restart.
  const stateRef = useRef({ status, voiceState, audioLevel });
  stateRef.current = { status, voiceState, audioLevel };

  // ── draggable ─────────────────────────────────────────────────
  useEffect(() => {
    const el = orbRef.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      dragRef.current = {
        dragging: true,
        sx: e.clientX,
        sy: e.clientY,
        ox: orbPosition.x,
        oy: orbPosition.y,
        moved: false,
      };
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.dragging) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
      setOrbPosition({
        x: Math.max(8, Math.min(window.innerWidth - ORB_SIZE - 8, d.ox + dx)),
        y: Math.max(8, Math.min(window.innerHeight - ORB_SIZE - 8, d.oy + dy)),
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

  // ── canvas render loop ─────────────────────────────────────────
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = (ORB_SIZE + PADDING * 2) * dpr;
    const H = (ORB_SIZE + PADDING * 2) * dpr;
    c.width = W;
    c.height = H;
    c.style.width = `${ORB_SIZE + PADDING * 2}px`;
    c.style.height = `${ORB_SIZE + PADDING * 2}px`;

    const rgbRaw = getComputedStyle(c).getPropertyValue("--axon-accent-rgb").trim();
    const [R, G, B] = parseRgb(rgbRaw);

    const cx = W / 2;
    const cy = H / 2;
    const radius = (ORB_SIZE / 2) * dpr;

    // Orbiting particles — live around the sphere, not on a rectangle bg.
    const dustCount = 18;
    const dust: Array<{ a: number; r: number; s: number; p: number }> = [];
    for (let i = 0; i < dustCount; i++) {
      dust.push({
        a: (i / dustCount) * Math.PI * 2 + Math.random() * 0.4,
        r: radius * 1.05 + Math.random() * (PADDING * dpr - 4),
        s: 0.8 + Math.random() * 1.4,
        p: Math.random() * Math.PI * 2,
      });
    }

    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000; // seconds
      const { status: s, voiceState: vs, audioLevel: lvl } = stateRef.current;

      ctx.clearRect(0, 0, W, H);

      // ─ Hue shift per state ─
      const isError = s === "error";
      const isDormant = vs === "dormant";
      const isThinking = s === "processing" || s === "executing";
      // Subtle pulse on intensity while thinking — helps the operator see
      // the orb is actively working, not stuck.
      const thinkingPulse = isThinking ? 0.85 + Math.sin(t * 3.2) * 0.18 : 0;
      const intensity =
        isDormant ? 0.2 :
        s === "listening" ? 1.0 + lvl * 0.4 :
        s === "speaking" ? 0.9 + Math.sin(t * 6) * 0.12 :
        isThinking ? thinkingPulse :
        0.6;

      // Color per state. Thinking shifts to cyan-violet so the operator
      // immediately sees Axon flipped from listening (red) to thinking.
      let accentR = R;
      let accentG = G;
      let accentB = B;
      if (isError) {
        accentR = 255; accentG = 90; accentB = 60;
      } else if (isThinking) {
        // Cyan-violet — distinct from the default red without clashing.
        accentR = 120; accentG = 160; accentB = 255;
      }

      // Rectangular halo fill removed — nothing outside the sphere
      // except the orbiting particles (drawn at the end).

      // ═══════════════════════════════════════════════════════════
      // BODY — sphere interior. Dark with color at center, deep edge.
      // ═══════════════════════════════════════════════════════════
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      // Deep background inside the sphere
      const body = ctx.createRadialGradient(
        cx - radius * 0.2, cy - radius * 0.3, radius * 0.1,
        cx, cy, radius
      );
      body.addColorStop(0, `rgba(${accentR}, ${accentG}, ${accentB}, ${0.55 * intensity})`);
      body.addColorStop(0.35, `rgba(${Math.round(accentR * 0.4)}, ${Math.round(accentG * 0.2)}, ${Math.round(accentB * 0.6)}, ${0.35 * intensity})`);
      body.addColorStop(1, `rgba(5, 5, 10, 0.96)`);
      ctx.fillStyle = body;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      // ─ Flowing plasma waves inside the sphere ─
      const waveSpeed =
        isDormant ? 0.1 :
        s === "listening" ? 0.8 + lvl * 1.4 :
        s === "speaking" ? 1.0 :
        isThinking ? 1.6 :
        0.35;
      const waves = 4;
      for (let w = 0; w < waves; w++) {
        const phase = w * (Math.PI * 2 / waves);
        const amp = radius * (0.55 + 0.2 * Math.sin(t * 0.4 + w));

        ctx.beginPath();
        const segments = 48;
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          const wobble =
            Math.sin(a * 3 + t * waveSpeed + phase) * 0.22 +
            Math.sin(a * 2 - t * waveSpeed * 0.7 + phase * 0.6) * 0.12 +
            Math.cos(a * 5 + t * waveSpeed * 0.3) * 0.08;
          const r = amp * (1 + wobble + lvl * 0.25);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.85;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();

        const alphaBase =
          w === 0 ? 0.9 : w === 1 ? 0.65 : w === 2 ? 0.4 : 0.25;
        const gradient = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${0.55 * alphaBase * intensity})`);
        gradient.addColorStop(0.3, `rgba(${accentR}, ${accentG}, ${accentB}, ${0.6 * alphaBase * intensity})`);
        gradient.addColorStop(0.7, `rgba(${Math.round(accentR * 0.6)}, ${Math.round(accentG * 0.3)}, ${Math.round(accentB * 0.9)}, ${0.3 * alphaBase * intensity})`);
        gradient.addColorStop(1, `rgba(${accentR}, ${accentG}, ${accentB}, 0)`);
        ctx.fillStyle = gradient;
        ctx.globalCompositeOperation = "lighter";
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      // ─ Bright inner core ─
      const corePulse =
        s === "speaking" ? 1 + Math.sin(t * 18) * 0.25 :
        s === "listening" ? 1 + lvl * 0.8 :
        1 + Math.sin(t * 1.4) * 0.08;
      const coreR = radius * 0.28 * corePulse;
      const core = ctx.createRadialGradient(
        cx - coreR * 0.25, cy - coreR * 0.25, 0,
        cx, cy, coreR
      );
      core.addColorStop(0, `rgba(255, 255, 255, ${0.95 * intensity})`);
      core.addColorStop(0.3, `rgba(${Math.min(255, accentR + 40)}, ${Math.min(255, accentG + 40)}, ${Math.min(255, accentB + 40)}, ${0.8 * intensity})`);
      core.addColorStop(0.7, `rgba(${accentR}, ${accentG}, ${accentB}, ${0.35 * intensity})`);
      core.addColorStop(1, `rgba(${accentR}, ${accentG}, ${accentB}, 0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore(); // release sphere clip

      // ═══════════════════════════════════════════════════════════
      // RIM — thin glassy highlight on the sphere edge
      // ═══════════════════════════════════════════════════════════
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = 1 * dpr;
      ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${0.75 * intensity})`;
      ctx.stroke();

      // Top highlight arc — gives glass sphere vibe
      ctx.beginPath();
      ctx.arc(cx, cy - radius * 0.1, radius * 0.85, Math.PI * 1.1, Math.PI * 1.55);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.18 * intensity})`;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // ═══════════════════════════════════════════════════════════
      // THINKING — rotating arc orbit + concentric pulse
      // Only renders during processing/executing. Distinct from any
      // other state so the operator can read it at a glance.
      // ═══════════════════════════════════════════════════════════
      if (isThinking) {
        // Rotating arc — moves clockwise around the rim, fades head-to-tail.
        const arcAngle = t * 3.4; // rad/sec
        const arcSpan = Math.PI * 0.55;
        const segs = 24;
        for (let i = 0; i < segs; i++) {
          const a0 = arcAngle + (i / segs) * arcSpan;
          const a1 = arcAngle + ((i + 1) / segs) * arcSpan;
          const fade = i / segs; // 0 at head, 1 at tail
          const alpha = (1 - fade) * 0.95;
          ctx.beginPath();
          ctx.arc(cx, cy, radius + 4 * dpr, a0, a1);
          ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${alpha})`;
          ctx.lineWidth = 2.4 * dpr;
          ctx.stroke();
        }

        // Counter-rotating second arc on the other side — gives a
        // gyroscope feel, reinforces the "computing" read.
        const arcAngle2 = -t * 2.1 + Math.PI;
        const arcSpan2 = Math.PI * 0.35;
        const segs2 = 16;
        for (let i = 0; i < segs2; i++) {
          const a0 = arcAngle2 + (i / segs2) * arcSpan2;
          const a1 = arcAngle2 + ((i + 1) / segs2) * arcSpan2;
          const fade = i / segs2;
          const alpha = (1 - fade) * 0.7;
          ctx.beginPath();
          ctx.arc(cx, cy, radius + 9 * dpr, a0, a1);
          ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
          ctx.lineWidth = 1.4 * dpr;
          ctx.stroke();
        }

        // Concentric expanding ring — "pulse" that emanates from center.
        const pulseT = (t * 1.4) % 1; // 0..1 every ~700ms
        const pulseR = radius * (0.4 + pulseT * 1.1);
        const pulseAlpha = (1 - pulseT) * 0.55;
        ctx.beginPath();
        ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${pulseAlpha})`;
        ctx.lineWidth = 1.2 * dpr;
        ctx.stroke();
      }

      // ═══════════════════════════════════════════════════════════
      // DUST — orbiting sparks around the sphere
      // ═══════════════════════════════════════════════════════════
      if (!isDormant) {
        for (const d of dust) {
          d.a += 0.002 + (s === "listening" ? lvl * 0.015 : s === "processing" ? 0.008 : 0.002);
          const twinkle = 0.3 + Math.abs(Math.sin(t * 2 + d.p)) * 0.7;
          const x = cx + Math.cos(d.a) * d.r;
          const y = cy + Math.sin(d.a) * d.r;
          ctx.beginPath();
          ctx.arc(x, y, d.s * dpr * (0.6 + twinkle * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${accentR}, ${accentG}, ${accentB}, ${twinkle * 0.9 * intensity})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!settings.enabled) return null;

  return (
    <>
      <div
        ref={orbRef}
        className="axon-orb-v3"
        data-state={status}
        data-voice={voiceState}
        style={{
          left: `${orbPosition.x - PADDING}px`,
          top: `${orbPosition.y - PADDING}px`,
          width: ORB_SIZE + PADDING * 2,
          height: ORB_SIZE + PADDING * 2,
        }}
        role="button"
        aria-label="AXON command orb"
        title={
          voiceState === "dormant"
            ? "AXON is dormant — say 'Axon wake up'"
            : voiceState === "armed"
            ? "AXON is listening — speak your command"
            : "AXON standby — say 'Hey AXON'"
        }
      >
        <canvas ref={canvasRef} className="axon-orb-v3-canvas" />
      </div>

      {liveTranscript && status === "listening" && (
        <div
          className="axon-live-transcript"
          style={{
            left: Math.min(
              window.innerWidth - 380,
              Math.max(8, orbPosition.x - 280)
            ),
            top: orbPosition.y + ORB_SIZE + 18,
          }}
        >
          <div style={{ fontSize: 9.5, letterSpacing: "0.16em", opacity: 0.7, marginBottom: 2 }}>
            HEARING
          </div>
          <div>{liveTranscript}</div>
        </div>
      )}

      {(status === "processing" || status === "executing") && (
        <div
          className="axon-thinking-badge"
          style={{
            left: orbPosition.x + ORB_SIZE / 2 - 38,
            top: orbPosition.y + ORB_SIZE + 14,
            position: "fixed",
            pointerEvents: "none",
            padding: "4px 10px",
            borderRadius: 999,
            fontSize: 10.5,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            background: "rgba(120, 160, 255, 0.18)",
            border: "1px solid rgba(120, 160, 255, 0.45)",
            color: "rgba(200, 220, 255, 0.95)",
            backdropFilter: "blur(10px)",
            zIndex: 9999,
            animation: "axon-thinking-pulse 1.4s ease-in-out infinite",
          }}
        >
          {status === "executing" ? "Working…" : "Thinking…"}
        </div>
      )}
    </>
  );
}
