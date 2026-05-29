/**
 * dashboard-components.tsx — Modern dashboard primitives.
 *
 * Six small building blocks the home dashboard composes against:
 *
 *   Card         · padded, layered surface with hairline border
 *   MetricCard   · label + big hero number + optional delta + Sparkline
 *   Pill         · small one-accent chip for priority / status
 *   Sparkline    · inline SVG mini-chart — no chart-lib dependency
 *   ProgressBar  · 0..100 bar with optional inline label
 *   TaskRow      · calm list row used by task + meeting lists
 *
 * Design rules these primitives enforce:
 *   · Generous padding (20px) inside cards
 *   · 0.5px hairline borders, NO neon glow, NO heavy drop shadows
 *   · One accent — used sparingly via tone="accent". Money + healthy
 *     states use tone="success" (calm green). Warnings tone="warning".
 *   · Real type hierarchy via the text-metric / text-title / text-label
 *     tokens defined in src/styles/theme.css.
 *
 * None of these components own data — they're presentation only. The
 * existing dashboard widgets keep their data wiring; they just paint
 * through these.
 */

import { type ReactNode, type LucideIcon, type MouseEventHandler } from "react";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────────────────
// Shared types
// ────────────────────────────────────────────────────────────────────

export type Tone = "default" | "accent" | "success" | "warning" | "danger";

interface ToneTokens {
  /** Pill bg + foreground combo. */
  pillBg: string;
  pillFg: string;
  /** Solid colour for a sparkline stroke or rail. */
  solid: string;
  /** Soft tinted background for an icon chip. */
  iconBg: string;
}

const TONE: Record<Tone, ToneTokens> = {
  default: {
    pillBg: "bg-foreground/[0.06]",
    pillFg: "text-fg-muted",
    solid:  "stroke-fg-muted",
    iconBg: "bg-foreground/[0.06] text-fg-muted",
  },
  accent: {
    pillBg: "bg-primary/10",
    pillFg: "text-primary",
    solid:  "stroke-[hsl(var(--primary))]",
    iconBg: "bg-primary/12 text-primary",
  },
  success: {
    pillBg: "bg-success-bg",
    pillFg: "text-success-strong",
    solid:  "stroke-[hsl(var(--cwa-success))]",
    iconBg: "bg-success-bg text-success-strong",
  },
  warning: {
    pillBg: "bg-warning-bg",
    pillFg: "text-warning-strong",
    solid:  "stroke-[hsl(var(--cwa-warning))]",
    iconBg: "bg-warning-bg text-warning-strong",
  },
  danger: {
    pillBg: "bg-danger-bg",
    pillFg: "text-danger-strong",
    solid:  "stroke-[hsl(var(--cwa-danger))]",
    iconBg: "bg-danger-bg text-danger-strong",
  },
};

// ────────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────────

export interface CardProps {
  /** When true the card lights up + lifts on hover. Use for clickable cards. */
  interactive?: boolean;
  /** Optional click handler — applies cursor + keyboard affordance. */
  onClick?: MouseEventHandler<HTMLDivElement>;
  className?: string;
  children: ReactNode;
  /** Optional ARIA label when interactive. */
  ariaLabel?: string;
}

export function Card({
  interactive = false,
  onClick,
  className,
  children,
  ariaLabel,
}: CardProps) {
  const isInteractive = interactive || !!onClick;
  const tag = isInteractive ? "button" : "div";
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tag as any) === "button" ? (
      <button
        type="button"
        onClick={onClick as unknown as MouseEventHandler<HTMLButtonElement>}
        aria-label={ariaLabel}
        className={cn(
          "group block w-full text-left rounded-card border-xs border-line bg-surface p-5",
          "transition-colors transition-shadow",
          "hover:border-line-strong hover:bg-surface-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          className,
        )}
      >
        {children}
      </button>
    ) : (
      <div
        className={cn(
          "rounded-card border-xs border-line bg-surface p-5",
          className,
        )}
      >
        {children}
      </div>
    )
  );
}

// ────────────────────────────────────────────────────────────────────
// MetricCard
// ────────────────────────────────────────────────────────────────────

export interface MetricCardProps {
  /** Tracked uppercase label (e.g. "My tasks"). */
  label: string;
  /** Big metric value — formatted by the caller. */
  value: ReactNode;
  /** Tiny suffix glued to the value ("$" or "/12" etc.). */
  suffix?: ReactNode;
  /** Optional secondary line under the metric ("4 due this week"). */
  hint?: ReactNode;
  /** Optional delta — caller decides positive / negative wording. */
  delta?: { value: string; positive?: boolean };
  /** Icon shown in the top-right corner. */
  icon?: LucideIcon;
  /** Tone applied to the icon + delta + optional sparkline. */
  tone?: Tone;
  /** Inline sparkline data (numbers, any range). */
  sparkline?: number[];
  /** Click handler — promotes the card to interactive. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  ariaLabel?: string;
}

export function MetricCard({
  label,
  value,
  suffix,
  hint,
  delta,
  icon: Icon,
  tone = "default",
  sparkline,
  onClick,
  className,
  ariaLabel,
}: MetricCardProps) {
  const t = TONE[tone];
  return (
    <Card
      onClick={onClick as unknown as MouseEventHandler<HTMLDivElement>}
      ariaLabel={ariaLabel ?? `${label} ${typeof value === "string" || typeof value === "number" ? value : ""}`}
      interactive={!!onClick}
      className={cn("relative", className)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-label text-fg-faint">{label}</span>
        {Icon && (
          <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", t.iconBg)}>
            <Icon size={14} strokeWidth={2.2} />
          </div>
        )}
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-metric text-fg">{value}</span>
        {suffix && (
          <span className="text-[14px] font-medium text-fg-subtle mb-1.5">
            {suffix}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3 mt-2 min-h-[18px]">
        <div className="text-hint text-fg-subtle">
          {hint}
          {delta && (
            <span
              className={cn(
                "ml-1 font-medium",
                delta.positive ? "text-success-strong" : "text-danger-strong",
              )}
            >
              {delta.value}
            </span>
          )}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline
            data={sparkline}
            tone={tone}
            width={64}
            height={22}
          />
        )}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────
// Pill
// ────────────────────────────────────────────────────────────────────

export interface PillProps {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  /** When true, render the pill as a small uppercase tracked label. */
  uppercase?: boolean;
}

export function Pill({
  tone = "default",
  children,
  className,
  uppercase = false,
}: PillProps) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-semibold",
        uppercase && "uppercase tracking-wider text-[10px]",
        t.pillBg,
        t.pillFg,
        className,
      )}
    >
      {children}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────
// Sparkline — inline SVG mini-chart, zero deps.
// ────────────────────────────────────────────────────────────────────

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  tone?: Tone;
  /** Stroke width. */
  strokeWidth?: number;
  /** When true, fills the area under the line at low alpha. */
  area?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  tone = "default",
  strokeWidth = 1.5,
  area = true,
  className,
  ariaLabel = "trend",
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = data.length > 1 ? width / (data.length - 1) : 0;
  const norm = (v: number) => height - 2 - ((v - min) / range) * (height - 4);

  const points = data.map((v, i) => `${i * stepX},${norm(v)}`).join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  const t = TONE[tone];
  // Strip leading "stroke-" so we can reuse the same class as fill too.
  const fillColorVar =
    tone === "accent" ? "hsl(var(--primary))" :
    tone === "success" ? "hsl(var(--cwa-success))" :
    tone === "warning" ? "hsl(var(--cwa-warning))" :
    tone === "danger"  ? "hsl(var(--cwa-danger))" :
                         "hsl(var(--cwa-fg-muted))";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel}
      className={cn("overflow-visible", className)}
    >
      {area && (
        <polygon
          points={areaPoints}
          fill={fillColorVar}
          fillOpacity={0.10}
        />
      )}
      <polyline
        points={points}
        className={t.solid}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
// ProgressBar
// ────────────────────────────────────────────────────────────────────

export interface ProgressBarProps {
  /** 0..100 */
  value: number;
  tone?: Tone;
  /** Renders a small inline label after the bar. */
  label?: ReactNode;
  className?: string;
  /** Tall (1.5px → 6px) variant for hero cards. */
  size?: "sm" | "md";
}

export function ProgressBar({
  value,
  tone = "accent",
  label,
  className,
  size = "sm",
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const fillBg =
    tone === "success" ? "bg-success-strong" :
    tone === "warning" ? "bg-warning-strong" :
    tone === "danger"  ? "bg-danger-strong" :
    tone === "default" ? "bg-fg-muted" :
                         "bg-primary";
  const trackH = size === "md" ? "h-1.5" : "h-1";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "flex-1 rounded-full bg-foreground/[0.07] overflow-hidden",
          trackH,
        )}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-all", fillBg)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {label !== undefined && (
        <span className="text-[10.5px] font-bold tabular-nums text-fg-subtle min-w-[28px] text-right">
          {label}
        </span>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// TaskRow — calm list row (used by tasks + meetings lists)
// ────────────────────────────────────────────────────────────────────

export interface TaskRowProps {
  title: ReactNode;
  meta?: ReactNode;
  /** Optional priority / status pill on the right. */
  pill?: { tone: Tone; label: string };
  /** Optional left-side accessory: avatar, status dot, icon. */
  left?: ReactNode;
  /** Optional right-side meta (timestamp, count). */
  right?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  ariaLabel?: string;
}

export function TaskRow({
  title,
  meta,
  pill,
  left,
  right,
  onClick,
  className,
  ariaLabel,
}: TaskRowProps) {
  const isInteractive = !!onClick;
  const Component = (isInteractive ? "button" : "div") as "button" | "div";
  return (
    <Component
      type={isInteractive ? "button" : undefined}
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left",
        "transition-colors",
        isInteractive && "hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        className,
      )}
    >
      {left && <div className="flex-shrink-0">{left}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-title text-fg truncate">{title}</div>
        {meta && (
          <div className="text-hint text-fg-subtle truncate mt-0.5">{meta}</div>
        )}
      </div>
      {pill && (
        <Pill tone={pill.tone} uppercase>
          {pill.label}
        </Pill>
      )}
      {right && (
        <div className="text-hint text-fg-subtle flex-shrink-0">{right}</div>
      )}
    </Component>
  );
}
