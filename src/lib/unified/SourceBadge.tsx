/**
 * lib/unified/SourceBadge.tsx — Small attribution badge used on
 * every row of a unified surface to show where the data came from.
 *
 * Three sizes, all tone-coded by the source's brand color via the
 * shared DATA_SOURCES registry. Two render modes:
 *
 *   · `pill`  — name + colored dot, fits inside table rows.
 *   · `dot`   — just the colored circle, for super-dense lists
 *               where space is at a premium.
 *
 * Title attribute always carries the full source name so hover
 * tooltip works regardless of the visual variant.
 */

import {
  getSourceMeta,
  sourceBadgeTones,
} from "./types";

type Variant = "pill" | "dot";
type Size = "xs" | "sm" | "md";

const SIZE_PRESETS: Record<Size, { px: number; text: string; pad: string }> = {
  xs: { px: 7, text: "text-[9.5px]", pad: "px-1 py-px" },
  sm: { px: 9, text: "text-[10.5px]", pad: "px-1.5 py-0.5" },
  md: { px: 11, text: "text-[11.5px]", pad: "px-2 py-1" },
};

export function SourceBadge({
  source,
  size = "sm",
  variant = "pill",
}: {
  source: string;
  size?: Size;
  variant?: Variant;
}) {
  const meta = getSourceMeta(source);
  const tones = sourceBadgeTones(source);
  const preset = SIZE_PRESETS[size];
  const label = meta?.name ?? source;

  if (variant === "dot") {
    return (
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: preset.px,
          height: preset.px,
          backgroundColor: tones.fg,
        }}
        title={label}
        aria-label={`Source: ${label}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-semibold whitespace-nowrap ${preset.pad} ${preset.text}`}
      style={{
        backgroundColor: tones.bg,
        color: tones.fg,
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: tones.border,
      }}
      title={`Source: ${label}`}
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: preset.px - 4,
          height: preset.px - 4,
          backgroundColor: tones.fg,
        }}
      />
      {label}
    </span>
  );
}
