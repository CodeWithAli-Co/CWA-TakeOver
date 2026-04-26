// ───────────────────────────────────────────────────────────────────
// Guided Tour Overlay — the actual tutorial UI.
//
// Renders a backdrop + a card centered on screen (or anchored to a
// spotlit element when step.selector is set). Subscribes to the tour
// store. Auto-navigates the router when the active step changes so
// each stop lands on the right page before showing its copy.
//
// Mounted once at the app root (in __root.tsx). When inactive, it
// renders nothing — zero cost.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { useTourStore } from "./tourStore";
import { ChevronLeft, ChevronRight, X, Play, Sparkles } from "lucide-react";

export function GuidedTourOverlay() {
  const active = useTourStore((s) => s.active);
  const index = useTourStore((s) => s.index);
  const steps = useTourStore((s) => s.steps);
  const next = useTourStore((s) => s.next);
  const prev = useTourStore((s) => s.prev);
  const skip = useTourStore((s) => s.skip);
  const finish = useTourStore((s) => s.finish);

  const navigate = useNavigate();
  const step = steps[index];

  // Navigate to the step's route every time the active step changes.
  // We use a ref to remember the last route we sent so quick prev/next
  // doesn't navigate twice in a row to the same place (which would
  // cause unnecessary remounts).
  const lastRouteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !step) return;
    if (lastRouteRef.current === step.route) return;
    lastRouteRef.current = step.route;
    // navigate is async but we don't need to await — the overlay
    // re-renders on top of whatever lands.
    navigate({ to: step.route as never }).catch(() => {});
  }, [active, step?.route, navigate]);

  // Reset lastRouteRef when the tour ends so a fresh tour re-navigates.
  useEffect(() => {
    if (!active) lastRouteRef.current = null;
  }, [active]);

  // Spotlight — track the element bounds when step.selector is set.
  const [spot, setSpot] = useState<DOMRect | null>(null);
  useEffect(() => {
    if (!active || !step?.selector) {
      setSpot(null);
      return;
    }
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector(step.selector!) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        setSpot(rect);
      } else {
        setSpot(null);
      }
      raf = requestAnimationFrame(tick);
    };
    // Wait one frame so the page from navigate() has settled.
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [active, step?.selector, step?.route]);

  // Keyboard nav — Esc skips, ←/→ step.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
      else if (e.key === "ArrowRight" || e.key === "Enter") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, prev, skip]);

  // Card placement — when there's no spot, center. With a spot,
  // anchor below or to the side based on placement.
  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (!spot || !step) {
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    const placement = step.placement ?? "bottom";
    const margin = 18;
    if (placement === "bottom") {
      return {
        left: Math.max(16, spot.left),
        top: Math.min(window.innerHeight - 220, spot.bottom + margin),
      };
    }
    if (placement === "top") {
      return {
        left: Math.max(16, spot.left),
        top: Math.max(16, spot.top - 220),
      };
    }
    if (placement === "right") {
      return {
        left: Math.min(window.innerWidth - 420, spot.right + margin),
        top: Math.max(16, spot.top),
      };
    }
    if (placement === "left") {
      return {
        left: Math.max(16, spot.left - 420),
        top: Math.max(16, spot.top),
      };
    }
    return { left: "50%", top: "50%", transform: "translate(-50%, -50%)" };
  }, [spot, step]);

  if (!active || !step) return null;

  const isFirst = index === 0;
  const isLast = index === steps.length - 1;

  // Render via portal so the overlay sits above the entire app.
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <div
      className="cwa-tour-root"
      role="dialog"
      aria-modal="true"
      aria-label="Guided tour"
    >
      {/* Backdrop with optional spotlight cutout */}
      {spot ? (
        <SpotlightBackdrop spot={spot} />
      ) : (
        <div className="cwa-tour-backdrop" />
      )}

      {/* Tooltip card */}
      <div className="cwa-tour-card" style={cardStyle}>
        <div className="cwa-tour-card-head">
          <span className="cwa-tour-card-step">
            <Sparkles className="size-3.5" />
            Step {index + 1} of {steps.length}
          </span>
          <button
            className="cwa-tour-iconbtn"
            onClick={skip}
            title="Skip tour"
            aria-label="Skip tour"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="cwa-tour-card-title">{step.title}</h2>
        <p className="cwa-tour-card-body">{step.body}</p>
        {step.hint && (
          <p className="cwa-tour-card-hint">
            <Play className="size-3.5" />
            {step.hint}
          </p>
        )}

        {/* Progress dots */}
        <div className="cwa-tour-dots" aria-hidden="true">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`cwa-tour-dot${i === index ? " is-active" : ""}${
                i < index ? " is-done" : ""
              }`}
            />
          ))}
        </div>

        <div className="cwa-tour-card-foot">
          <button
            className="cwa-tour-btn cwa-tour-btn-ghost"
            onClick={skip}
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            <button
              className="cwa-tour-btn cwa-tour-btn-secondary"
              onClick={prev}
              disabled={isFirst}
            >
              <ChevronLeft className="size-4" />
              Back
            </button>
            {isLast ? (
              <button
                className="cwa-tour-btn cwa-tour-btn-primary"
                onClick={finish}
              >
                Finish
              </button>
            ) : (
              <button
                className="cwa-tour-btn cwa-tour-btn-primary"
                onClick={next}
              >
                Next
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    portalTarget,
  );
}

// ── Spotlight backdrop — dims the page and cuts a hole over `spot`. ─
function SpotlightBackdrop({ spot }: { spot: DOMRect }) {
  // SVG mask gives us a clean rectangular cutout with rounded corners.
  const pad = 8;
  const r = 10;
  const x = Math.max(0, spot.left - pad);
  const y = Math.max(0, spot.top - pad);
  const w = spot.width + pad * 2;
  const h = spot.height + pad * 2;
  return (
    <svg className="cwa-tour-spotlight" aria-hidden="true">
      <defs>
        <mask id="cwa-tour-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={r} ry={r} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.62)"
        mask="url(#cwa-tour-mask)"
      />
      {/* Glowing rim around the spotlight */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        ry={r}
        fill="none"
        stroke="rgba(220, 38, 38, 0.85)"
        strokeWidth={2}
        style={{ filter: "drop-shadow(0 0 12px rgba(220,38,38,0.6))" }}
      />
    </svg>
  );
}
