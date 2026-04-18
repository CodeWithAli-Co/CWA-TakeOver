// ───────────────────────────────────────────────────────────────────
// Orb v3 — plasma sphere.
// Entirely canvas-driven. Renders:
//   - A soft outer glow halo
//   - A translucent sphere rim
//   - Flowing inner energy waves (lissajous / noise-field hybrid)
//   - Reactive core light
// No DOM children inside the orb — everything is on the canvas so the
// visual reads as a single coherent object, not a div sandwich.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { useAxon } from "../AxonProvider";

const ORB_SIZE = 96;
const PADDING = 4; // tiny margin for antialiasing only — no exterior glow

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

    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000; // seconds
      const { status: s, voiceState: vs, audioLevel: lvl } = stateRef.current;

      ctx.clearRect(0, 0, W, H);

      // ─ Hue shift per state ─
      const isError = s === "error";
      const isDormant = vs === "dormant";
      const intensity =
        isDormant ? 0.2 :
        s === "listening" ? 1.0 + lvl * 0.4 :
        s === "speaking" ? 0.9 + Math.sin(t * 6) * 0.12 :
        s === "processing" ? 0.75 :
        0.6;

      // Override color when error.
      const accentR = isError ? 255 : R;
      const accentG = isError ? 90 : G;
      const accentB = isError ? 60 : B;

      // ═══════════════════════════════════════════════════════════
      // 1. OUTER HALO — several overlaid radial gradients, large & soft
      // ═══════════════════════════════════════════════════════════
      const haloPulse = 1 + Math.sin(t * 1.4) * 0.04;
      const haloRadius = radius * 2.2 * haloPulse;
      const halo = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, haloRadius);
      halo.addColorStop(0, `rgba(${accentR}, ${accentG}, ${accentB}, ${0.28 * intensity})`);
      halo.addColorStop(0.4, `rgba(${accentR}, ${accentG}, ${accentB}, ${0.12 * intensity})`);
      halo.addColorStop(1, `rgba(${accentR}, ${accentG}, ${accentB}, 0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);

      // ═══════════════════════════════════════════════════════════
      // 2. BODY — sphere interior. Dark with color at center, deep edge.
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
      // Draw several smooth bezier-ish paths whose control points move on lissajous curves.
      const waveSpeed = isDormant ? 0.1 : s === "listening" ? 0.8 + lvl * 1.4 : s === "speaking" ? 1.0 : s === "processing" ? 0.6 : 0.35;
      const waves = 4;
      for (let w = 0; w < waves; w++) {
        const phase = w * (Math.PI * 2 / waves);
        const amp = radius * (0.55 + 0.2 * Math.sin(t * 0.4 + w));

        ctx.beginPath();
        const segments = 48;
        for (let i = 0; i <= segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          // Core wavy radius — distorted circle
          const wobble =
            Math.sin(a * 3 + t * waveSpeed + phase) * 0.22 +
            Math.sin(a * 2 - t * waveSpeed * 0.7 + phase * 0.6) * 0.12 +
            Math.cos(a * 5 + t * waveSpeed * 0.3) * 0.08;
          const r = amp * (1 + wobble + lvl * 0.25);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r * 0.85; // slight oblate for "sphere" feel
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
      // 3. RIM — thin glassy highlight on the sphere edge
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
      // 4. DUST — orbiting sparks around the outside
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
    </>
  );
}
