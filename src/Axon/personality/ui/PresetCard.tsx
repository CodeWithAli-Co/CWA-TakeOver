// ───────────────────────────────────────────────────────────────────
// PresetCard — single preset chip inside the Personality section.
//
// THIS IS THE ISOLATION BUILD. Renders ONE card with the data passed
// in via props. No grid yet, no click-to-select wiring, no confirm
// dialog, no localStorage read. Operator reviews the visual first;
// the orchestration (grid + click + confirm + active state from
// stored preset) lands in subsequent P6.2 sub-steps.
//
// Visual contract (locked with operator at architecture review):
//   · Inactive: muted border, no chip, subtle hover lift.
//   · Active:   violet border + ACTIVE chip (same chip mechanic as
//               the master toggle\'s tinted state).
//   · Click target: the whole card. No nested buttons.
//   · Disabled mode: parent (PersonalitySection) sets opacity + 
//               pointer-events:none when the master toggle is off,
//               so this component doesn\'t carry its own disabled
//               styling — keeps the dim-when-off pattern consistent
//               across the section.
// ───────────────────────────────────────────────────────────────────

import { useState } from "react";
import type { PresetDefinition } from "../types";

interface Props {
  preset: PresetDefinition;
  /** True when this preset matches the operator\'s current selection.
   *  Drives the violet border + ACTIVE chip. */
  isActive?: boolean;
  /** Click handler. Will be wired in the next P6.2 sub-step with
   *  flush-debounce + confirm-dialog logic. For the isolation build
   *  it can be a noop or a console.log to confirm clicks register. */
  onSelect?: () => void;
}

export function PresetCard({ preset, isActive = false, onSelect }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        // Layout
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        textAlign: "left",
        // Sizing — fills the grid cell. Min height keeps cards
        // visually aligned even when one tagline wraps.
        width: "100%",
        minHeight: 80,
        padding: "12px 14px",
        // Visual state
        borderRadius: 10,
        background: isActive
          ? "hsl(280 50% 55% / 0.10)"
          : hovered
            ? "hsl(0 0% 100% / 0.04)"
            : "transparent",
        border: `1px solid ${
          isActive
            ? "hsl(280 50% 55% / 0.38)"
            : hovered
              ? "hsl(0 0% 50% / 0.32)"
              : "hsl(0 0% 50% / 0.18)"
        }`,
        transform: hovered && !isActive ? "translateY(-1px)" : "translateY(0)",
        transition:
          "background 140ms ease, border-color 140ms ease, transform 140ms ease",
        cursor: "pointer",
        // Inheritances — match the rest of AxonSettings
        font: "inherit",
        color: "inherit",
      }}
    >
      {/* Name + ACTIVE chip on the same row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
        }}
      >
        <span
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            color: isActive ? "hsl(280 60% 80%)" : "var(--axon-fg, inherit)",
          }}
        >
          {preset.displayName}
        </span>
        {isActive && (
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "hsl(280 60% 76%)",
              padding: "1px 6px",
              borderRadius: 4,
              background: "hsl(280 50% 55% / 0.18)",
              marginLeft: "auto",
            }}
          >
            ACTIVE
          </span>
        )}
      </div>

      {/* Tagline */}
      <span
        style={{
          fontSize: 11.5,
          color: "var(--axon-muted)",
          lineHeight: 1.4,
        }}
      >
        {preset.tagline}
      </span>
    </button>
  );
}
