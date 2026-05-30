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
    <header className="text-center mb-8">
      {eyebrow && (
        <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary block mb-2.5">
          {eyebrow}
        </span>
      )}
      <h1
        className="font-bold text-foreground leading-[1.05] tracking-[-0.02em] mb-2"
        style={{
          fontFamily: "var(--ed-font-display, Inter), system-ui, sans-serif",
          fontSize: "clamp(22px, 2vw, 28px)",
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
  return (
    <div className="flex items-center justify-between gap-3 mt-8 pt-5 border-t border-xs border-border/15">
      {hideBack ? (
        <span />
      ) : (
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-semibold text-text-tertiary hover:text-foreground transition-colors disabled:opacity-50"
        >
          <ArrowLeft size={12} />
          Back
        </button>
      )}
      <div className="flex items-center gap-2">
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={loading}
            className="h-9 px-4 rounded-full text-[12px] font-semibold text-text-tertiary hover:text-foreground transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="inline-flex items-center gap-2 h-9 px-5 rounded-full text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : null}
          {nextLabel}
          {!loading && <ArrowRight size={12} />}
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

/** Standard text input. Use inside `<FormField>`. */
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
      className="w-full px-3 py-2 bg-foreground/[0.03] border border-border-soft rounded-lg text-[13px] text-foreground placeholder:text-text-tertiary outline-none focus:border-primary/40 transition-colors"
    />
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
          className="px-3 h-8 rounded-full text-[11.5px] font-semibold border transition-colors text-text-secondary border-border-soft hover:border-foreground/30 data-[active=true]:bg-foreground data-[active=true]:text-background data-[active=true]:border-foreground"
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

export function StepShell({
  currentStep,
  totalSteps,
  children,
}: {
  currentStep: number;
  totalSteps: number;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-xl mx-auto px-6 py-10">
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
