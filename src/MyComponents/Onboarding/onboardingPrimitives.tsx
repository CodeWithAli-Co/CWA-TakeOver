/**
 * onboardingPrimitives.tsx — shared layout + control components
 * for the welcome wizard.
 *
 * Every step screen uses these for visual consistency:
 *   · ProgressDots   — top-of-screen progress indicator
 *   · StepHeader     — eyebrow + title + subtitle
 *   · StepActions    — Back / Skip / Continue button row
 *   · FormField      — labeled input wrapper with hint/error
 *   · OptionTile     — large selectable card (Yes/No, scope, etc.)
 *   · PillPicker     — segmented pill group for enum picking
 *
 * No business logic here — these are pure presentation.
 */

import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2, type LucideIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// ProgressDots
// ─────────────────────────────────────────────────────────────────

export function ProgressDots({
  currentStep,
  totalSteps,
}: {
  /** Zero-based current step index. */
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-8">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const isDone = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{
              width: isCurrent ? 32 : 8,
              backgroundColor: isCurrent || isDone
                ? "hsl(var(--primary))"
                : "hsl(var(--foreground) / 0.15)",
            }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="h-1 rounded-full"
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// StepHeader
// ─────────────────────────────────────────────────────────────────

export function StepHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="text-center mb-7">
      {eyebrow && (
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary/85 block mb-3">
          {eyebrow}
        </span>
      )}
      <h1
        className="font-bold text-foreground leading-[1.05] tracking-[-0.025em] mb-2.5"
        style={{
          fontFamily: "var(--ed-font-display, Inter), system-ui, sans-serif",
          fontSize: "clamp(26px, 2.4vw, 32px)",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p className="text-[13px] text-text-tertiary max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────
// StepActions — Back / Skip / Continue row at the bottom
// ─────────────────────────────────────────────────────────────────

export function StepActions({
  onBack,
  onNext,
  onSkip,
  nextLabel = "Continue",
  nextDisabled = false,
  loading = false,
  /** When true, hide the Back button (used on first step). */
  hideBack = false,
}: {
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  hideBack?: boolean;
}) {
  // No top border / divider — the buttons sit naturally below
  // the form content. The divider was making the row look like
  // an orphaned footer detached from the form.
  return (
    <div className="flex items-center justify-between gap-3 mt-7">
      {hideBack ? (
        <span />
      ) : (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[12px] font-semibold text-text-tertiary hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={13} />
          Back
        </button>
      )}
      <div className="flex items-center gap-1.5">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="h-10 px-4 rounded-full text-[12px] font-semibold text-text-tertiary hover:text-foreground transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full text-[12.5px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_2px_12px_-2px_hsl(var(--primary)/0.45)] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
        >
          {loading ? (
            <Loader2 size={13} className="animate-spin" />
          ) : null}
          {nextLabel}
          {!loading && <ArrowRight size={13} />}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// FormField
// ─────────────────────────────────────────────────────────────────

export function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary mb-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="text-[10.5px] text-text-tertiary mt-1 leading-relaxed">
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[10.5px] text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}

/** Standard text input. Use inside `<FormField>`.
 *
 *  Focus state: kept very gentle. The old version used
 *  `focus:border-primary/40` which produced a harsh red ring on
 *  autoFocus (especially against the dark canvas — looked like
 *  a validation error). Replaced with a soft inset ring +
 *  subtle bg tint that reads as "active" without alarming. */
export function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email";
  autoFocus?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      spellCheck={false}
      className="w-full px-3.5 py-2.5 bg-foreground/[0.04] border border-border-soft rounded-xl text-[13.5px] text-foreground placeholder:text-text-tertiary/60 outline-none focus:border-foreground/20 focus:bg-foreground/[0.06] transition-colors"
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// FieldGroup — card wrapper that groups related FormFields
// ─────────────────────────────────────────────────────────────────
// Used in CompanyStep + ProfileStep to give the form a visible
// "card" shape rather than fields floating in space. Optional
// section heading sits at the top with a faint icon to anchor it.

export function FieldGroup({
  title,
  icon: Icon,
  children,
  className = "",
}: {
  title?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-border-soft bg-foreground/[0.02] p-5 ${className}`}
    >
      {title && (
        <div className="flex items-center gap-2 mb-4">
          {Icon && (
            <div className="w-6 h-6 rounded-md bg-foreground/[0.05] border border-border-soft flex items-center justify-center">
              <Icon className="h-3 w-3 text-text-tertiary" strokeWidth={2.3} />
            </div>
          )}
          <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-tertiary">
            {title}
          </h3>
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────
// OptionTile — large selectable card
// ─────────────────────────────────────────────────────────────────

export function OptionTile({
  icon: Icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      className={`text-left rounded-2xl border p-4 transition-colors ${
        active
          ? "border-primary/60 bg-primary/[0.06]"
          : "border-border-soft bg-foreground/[0.03] hover:bg-foreground/[0.05] hover:border-foreground/20"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
            active
              ? "bg-primary/15 border border-primary/30"
              : "bg-foreground/[0.05] border border-border-soft"
          }`}
        >
          <Icon
            className={`h-5 w-5 ${active ? "text-primary" : "text-foreground/70"}`}
            strokeWidth={2.2}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-[13.5px] font-bold leading-tight ${active ? "text-foreground" : "text-foreground/85"}`}
          >
            {label}
          </h3>
          {description && (
            <p className="text-[11.5px] text-text-tertiary mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────────
// PillPicker — segmented pill group
// ─────────────────────────────────────────────────────────────────

export interface PillOption<T extends string> {
  value: T;
  label: string;
}

export function PillPicker<T extends string>({
  options,
  value,
  onChange,
}: {
  options: PillOption<T>[];
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          data-active={value === opt.value}
          className="px-3.5 h-9 rounded-full text-[12px] font-semibold border transition-all text-text-secondary bg-foreground/[0.03] border-border-soft hover:border-foreground/25 hover:bg-foreground/[0.06] data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary data-[active=true]:shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.4)]"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Shell — outer page chrome for every step
// ─────────────────────────────────────────────────────────────────

/** Width preset for StepShell.
 *  · "form"   — narrow, comfortable reading width (default, used
 *               for company / profile / identity / industry steps)
 *  · "grid"   — wide, fits 3-4 column grids (modules + connectors)
 */
export type StepShellWidth = "form" | "grid";

export function StepShell({
  currentStep,
  totalSteps,
  width = "form",
  children,
}: {
  currentStep: number;
  totalSteps: number;
  width?: StepShellWidth;
  children: React.ReactNode;
}) {
  const maxW = width === "grid" ? "max-w-5xl" : "max-w-xl";
  return (
    <div className={`w-full ${maxW} mx-auto px-6 py-10`}>
      <ProgressDots currentStep={currentStep} totalSteps={totalSteps} />
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </div>
  );
}
