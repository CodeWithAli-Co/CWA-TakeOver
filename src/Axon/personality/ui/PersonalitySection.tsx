// ───────────────────────────────────────────────────────────────────
// PersonalitySection — top-level container for the Personality
// settings group. Lives inside AxonSettingsPane between Master and
// Autonomy.
//
// THIS IS THE ISOLATION BUILD. Inner content (presets, sliders, test
// composer) is a placeholder. The pieces this isolation build proves
// out:
//
//   · Master toggle row at the top with the "(beta)" chip and
//     ACTIVE-styled tint when on (visual parity with the existing
//     forced-sleep row).
//   · Live read of axon:settings:personalityEnabled — every render
//     reflects the current localStorage value, no caching.
//   · First-time ON triggers stampFirstSeenIfMissing() so the
//     relationship clock starts the moment the user opts in.
//   · OFF preserves all settings + clock — kill switch, not factory
//     reset.
//   · Dimmed-when-off inner content area, pointer-events-none on the
//     dim, with an inline hint nudging the user to flip the toggle.
// ───────────────────────────────────────────────────────────────────

import { useState } from "react";
import {
  isPersonalityEnabled,
  setPersonalityEnabled,
  stampFirstSeenIfMissing,
} from "../settings";

export function PersonalitySection() {
  // Initialise from localStorage. Subsequent toggles update both
  // localStorage AND React state — kept in lockstep so the UI is
  // responsive and the next runTurn picks up the live value.
  const [enabled, setEnabled] = useState<boolean>(() => isPersonalityEnabled());

  const onToggle = (next: boolean) => {
    setPersonalityEnabled(next);
    if (next) {
      // First-time ON: stamp the relationship clock now so it
      // measures the right thing. No-op if already stamped.
      stampFirstSeenIfMissing();
    }
    setEnabled(next);
  };

  return (
    <div className="axon-settings-group">
      <label className="axon-settings-label">
        Personality{" "}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.08em",
            padding: "1px 6px",
            borderRadius: 4,
            background: "hsl(40 80% 50% / 0.18)",
            color: "hsl(40 85% 65%)",
            marginLeft: 6,
            verticalAlign: "middle",
          }}
        >
          BETA
        </span>
      </label>

      {/* ── Master toggle row ────────────────────────────────────── */}
      <div
        className="axon-settings-row"
        style={{
          borderRadius: 8,
          padding: "10px 12px",
          background: enabled
            ? "hsl(280 50% 55% / 0.10)"
            : "transparent",
          border: `1px solid ${enabled ? "hsl(280 50% 55% / 0.32)" : "hsl(0 0% 50% / 0.15)"}`,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: 3 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13 }}>
              Personality engine
            </span>
            {enabled && (
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "hsl(280 60% 76%)",
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "hsl(280 50% 55% / 0.18)",
                }}
              >
                ACTIVE
              </span>
            )}
          </span>
          <span style={{ fontSize: 11, color: "var(--axon-muted)", lineHeight: 1.45 }}>
            When off, Axon uses default behavior.
          </span>
        </div>
        <input
          className="axon-switch"
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
        />
      </div>

      {/* ── Inner content — dimmed when master is off ────────────── */}
      <div
        style={{
          position: "relative",
          marginTop: 10,
          opacity: enabled ? 1 : 0.42,
          pointerEvents: enabled ? "auto" : "none",
          transition: "opacity 160ms ease",
        }}
      >
        {!enabled && (
          <div
            style={{
              fontSize: 11,
              color: "var(--axon-muted)",
              fontStyle: "italic",
              padding: "8px 10px",
              borderRadius: 6,
              border: "1px dashed hsl(0 0% 50% / 0.25)",
              marginBottom: 8,
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            Turn on the engine to test presets and tune sliders.
          </div>
        )}

        {/* PLACEHOLDER: presets + sliders + test composer land here
            once the isolation build is signed off. Showing a stub
            so we can verify the dimmed-when-off shell works
            visually before any inner UI exists. */}
        <div
          style={{
            padding: "14px 12px",
            borderRadius: 8,
            background: "hsl(0 0% 50% / 0.04)",
            border: "1px solid hsl(0 0% 50% / 0.10)",
            color: "var(--axon-muted)",
            fontSize: 11.5,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, color: "var(--axon-fg, inherit)", marginBottom: 4 }}>
            Coming in P6.2–P6.7
          </div>
          Preset cards (Jarvis, Samantha, HAL Lite, Best Friend, Professor, Operator),
          ten dimension sliders with band-divider ticks + live band labels,
          test composer with per-test history, and a scoped Reset button.
          This placeholder verifies the master-toggle + dimmed-shell behavior
          in isolation before the inner UI lands.
        </div>
      </div>
    </div>
  );
}
