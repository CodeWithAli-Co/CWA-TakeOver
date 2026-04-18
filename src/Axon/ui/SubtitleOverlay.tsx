// ───────────────────────────────────────────────────────────────────
// Subtitle Overlay — lives near the orb, shows the last user turn
// and what AXON is currently saying. Auto-fades when idle. Purely
// display — no interaction.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { useAxon } from "../AxonProvider";

const HOLD_MS = 4200; // how long the last line lingers after speech ends

export function SubtitleOverlay() {
  const { conversation, status, orbPosition, settings } = useAxon();
  const [visibleText, setVisibleText] = useState<string>("");
  const [visibleRole, setVisibleRole] = useState<"user" | "axon" | "system">("axon");
  const hideTimer = useRef<number | null>(null);

  // Find the most recent axon turn and the most recent user turn separately.
  const latestAxon = [...conversation].reverse().find((t) => t.role === "axon");
  const latestUser = [...conversation].reverse().find((t) => t.role === "user");

  useEffect(() => {
    // Priority:
    //   speaking  → show latest AXON turn
    //   idle, just-spoke → keep it visible for HOLD_MS then fade
    //   listening/processing → show latest user turn so they see what was heard
    if (status === "speaking" && latestAxon) {
      setVisibleText(latestAxon.text);
      setVisibleRole("axon");
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      return;
    }
    if ((status === "processing" || status === "listening") && latestUser) {
      setVisibleText(latestUser.text);
      setVisibleRole("user");
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      return;
    }
    if (status === "idle") {
      // If we were just speaking, hold the last line on screen briefly.
      if (visibleText) {
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(() => {
          setVisibleText("");
          hideTimer.current = null;
        }, HOLD_MS);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, latestAxon?.id, latestUser?.id]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!settings.enabled) return null;
  if (!visibleText) return null;

  // Position near the orb — prefer placement to the LEFT of the orb so the
  // caption fans out into the screen rather than clipping off-edge.
  const placeLeft = orbPosition.x > window.innerWidth / 2;
  const left = placeLeft
    ? Math.max(16, orbPosition.x - 420 - 16)
    : Math.min(window.innerWidth - 420 - 16, orbPosition.x + 96 + 16);
  const top = Math.max(16, Math.min(window.innerHeight - 160, orbPosition.y + 4));

  return (
    <div
      className="axon-subtitle"
      data-role={visibleRole}
      data-status={status}
      style={{ left: `${left}px`, top: `${top}px` }}
      aria-live="polite"
    >
      <div className="axon-subtitle-meta">
        {visibleRole === "axon" ? "AXON" : visibleRole === "user" ? "YOU" : "—"}
        {status === "speaking" && visibleRole === "axon" && (
          <span className="axon-subtitle-speaking-dot" />
        )}
      </div>
      <div className="axon-subtitle-body">{visibleText}</div>
    </div>
  );
}
