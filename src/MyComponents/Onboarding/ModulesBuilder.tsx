/**
 * ModulesBuilder.tsx — the "watch your dashboard come to life" picker.
 *
 * Replaces the tabbed grid for onboarding Step 4. Two-pane layout:
 *
 *   LEFT  · Compact list of modules grouped by category, with
 *           preset shortcuts at the top. Each row is a single
 *           click to toggle.
 *
 *   RIGHT · Sticky live "preview" of the dashboard that fills in
 *           as the founder ticks modules. Each enabled module
 *           materializes as a widget tile (animated in via
 *           framer-motion layout). Empty state shows ghost
 *           outlines so the user knows what's coming.
 *
 * Not used in Settings — Settings still uses the simpler
 * `ModulesPicker`. Keeping these split means the rich live-preview
 * stays focused on the install-time "wow" moment.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Sparkles,
  Layers,
  RotateCcw,
} from "lucide-react";
import {
  MODULES,
  MODULE_CATEGORIES,
  MODULE_PRESETS,
  modulesByCategory,
  getModule,
  type ModuleCategory,
  type ModuleDef,
} from "./modulesCatalog";

function rgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getCategoryAccent(catId: ModuleCategory): string {
  return MODULE_CATEGORIES.find((c) => c.id === catId)?.accent ?? "#E5484D";
}

export function ModulesBuilder({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const grouped = modulesByCategory();
  const enabled = new Set(value);
  const [activeCat, setActiveCat] = useState<ModuleCategory | "all">("all");

  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(enabled);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const applyPreset = (presetId: string) => {
    if (disabled) return;
    const preset = MODULE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (preset.id === "full") {
      onChange(MODULES.map((m) => m.id));
    } else {
      onChange([...preset.ids]);
    }
  };

  const reset = () => onChange([]);

  const presetMatch = (presetIds: string[]): boolean => {
    const want = new Set(presetIds);
    if (want.size !== enabled.size) return false;
    for (const id of want) if (!enabled.has(id)) return false;
    return true;
  };

  // Modules to show in the left list, filtered by category tab.
  const visibleCats =
    activeCat === "all"
      ? MODULE_CATEGORIES
      : MODULE_CATEGORIES.filter((c) => c.id === activeCat);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5 items-start">
      {/* ════════════════════════════════════════════════════
       * LEFT — picker
       * ════════════════════════════════════════════════════ */}
      <div className="min-w-0">
        {/* ─── Preset row ─── */}
        <div className="rounded-2xl border border-border-soft bg-foreground/[0.025] p-3 mb-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles
              className="h-3.5 w-3.5 text-primary"
              strokeWidth={2.4}
            />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-foreground">
              Quick start
            </span>
            <span className="text-[10.5px] text-text-tertiary hidden sm:inline">
              tap a bundle to fill in your stack
            </span>
            <button
              type="button"
              onClick={reset}
              disabled={disabled || enabled.size === 0}
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-text-tertiary hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RotateCcw size={10} strokeWidth={2.4} />
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MODULE_PRESETS.map((p) => {
              const targetIds =
                p.id === "full" ? MODULES.map((m) => m.id) : p.ids;
              const isActive = presetMatch(targetIds);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  disabled={disabled}
                  title={p.tagline}
                  className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-foreground/[0.04] text-foreground/80 border-border-soft hover:border-foreground/35 hover:bg-foreground/[0.07] hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Category tabs ─── */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <CategoryTab
            label="All"
            count={enabled.size}
            total={MODULES.length}
            accent="hsl(var(--foreground))"
            icon={Layers}
            active={activeCat === "all"}
            onClick={() => setActiveCat("all")}
          />
          {MODULE_CATEGORIES.map((cat) => {
            const cms = grouped.get(cat.id) ?? [];
            const on = cms.filter((m) => enabled.has(m.id)).length;
            return (
              <CategoryTab
                key={cat.id}
                label={cat.label}
                count={on}
                total={cms.length}
                accent={cat.accent}
                active={activeCat === cat.id}
                onClick={() => setActiveCat(cat.id)}
              />
            );
          })}
        </div>

        {/* ─── Module rows ─── */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeCat}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16 }}
            className="space-y-4"
          >
            {visibleCats.map((cat) => {
              const modules = grouped.get(cat.id) ?? [];
              if (modules.length === 0) return null;
              const enabledInCat = modules.filter((m) =>
                enabled.has(m.id),
              ).length;
              return (
                <section key={cat.id}>
                  {activeCat === "all" && (
                    <div className="mb-2 flex items-baseline gap-3">
                      <h3
                        className="text-[10.5px] font-bold uppercase tracking-[0.22em] shrink-0"
                        style={{ color: cat.accent }}
                      >
                        {cat.label}
                      </h3>
                      <span className="text-[10px] font-semibold text-text-tertiary tabular-nums">
                        {enabledInCat}/{modules.length}
                      </span>
                      <div
                        className="flex-1 h-px"
                        style={{ background: rgba(cat.accent, 0.18) }}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    {modules.map((m) => (
                      <ModuleRow
                        key={m.id}
                        module={m}
                        accent={cat.accent}
                        active={enabled.has(m.id)}
                        disabled={disabled || !!m.alwaysOn}
                        onToggle={() => toggle(m.id)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ════════════════════════════════════════════════════
       * RIGHT — sticky live preview
       * ════════════════════════════════════════════════════ */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <PreviewWindow value={value} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Category tab
// ─────────────────────────────────────────────────────────────
function CategoryTab({
  label,
  count,
  total,
  accent,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  total: number;
  accent: string;
  icon?: typeof Layers;
  active: boolean;
  onClick: () => void;
}) {
  const isHsl = accent.startsWith("hsl");
  // Quieter palette: inactive tabs render in a neutral foreground
  // tone with just a small color dot to telegraph the category.
  // Only the active tab promotes to the full category color. This
  // keeps the tab strip from reading like a rainbow.
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-bold border transition-all"
      style={{
        background: active
          ? isHsl
            ? "hsl(var(--foreground) / 0.08)"
            : rgba(accent, 0.14)
          : "hsl(var(--foreground) / 0.03)",
        borderColor: active
          ? accent
          : "hsl(var(--border) / 0.5)",
        color: active
          ? isHsl
            ? "hsl(var(--foreground))"
            : accent
          : "hsl(var(--foreground) / 0.7)",
      }}
    >
      {Icon ? (
        <Icon size={11} strokeWidth={2.4} />
      ) : (
        // Color dot for non-"All" tabs in the inactive state —
        // small enough to be a hint, not a shout.
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: accent, opacity: active ? 1 : 0.85 }}
        />
      )}
      <span>{label}</span>
      <span className="text-[9.5px] font-semibold tabular-nums opacity-60">
        {count}/{total}
      </span>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Module row — compact list row, not card
// ─────────────────────────────────────────────────────────────
function ModuleRow({
  module: m,
  accent,
  active,
  disabled,
  onToggle,
}: {
  module: ModuleDef;
  accent: string;
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const Icon = m.icon;
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={disabled && !active}
      whileHover={disabled ? undefined : { x: 1 }}
      whileTap={disabled ? undefined : { scale: 0.99 }}
      className={`w-full text-left rounded-lg border p-2.5 transition-colors flex items-center gap-3 ${
        m.alwaysOn ? "cursor-default" : ""
      } ${disabled ? "opacity-60" : ""}`}
      style={{
        background: active
          ? rgba(accent, 0.08)
          : "hsl(var(--foreground) / 0.02)",
        borderColor: active
          ? rgba(accent, 0.45)
          : "hsl(var(--border) / 0.35)",
      }}
    >
      {/* Icon tile */}
      <div
        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0 border transition-colors"
        style={{
          background: active
            ? rgba(accent, 0.18)
            : "hsl(var(--foreground) / 0.05)",
          borderColor: active
            ? rgba(accent, 0.4)
            : "hsl(var(--border) / 0.4)",
          color: active ? accent : "hsl(var(--foreground) / 0.7)",
        }}
      >
        <Icon className="h-4 w-4" strokeWidth={2.3} />
      </div>

      {/* Name + description */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[12.5px] font-bold leading-tight"
            style={{
              color: active
                ? "hsl(var(--foreground))"
                : "hsl(var(--foreground) / 0.9)",
            }}
          >
            {m.name}
          </span>
          {m.alwaysOn && (
            <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary px-1 py-px rounded bg-foreground/[0.06]">
              Required
            </span>
          )}
        </div>
        <p className="text-[10.5px] text-text-tertiary leading-snug line-clamp-1">
          {m.description}
        </p>
      </div>

      {/* Check indicator */}
      <div className="shrink-0">
        {active ? (
          <CheckCircle2
            className="h-4 w-4"
            strokeWidth={2.6}
            style={{ color: accent }}
          />
        ) : (
          <Circle
            className="h-4 w-4 text-text-tertiary/40"
            strokeWidth={2}
          />
        )}
      </div>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Preview window — the "fake dashboard" that builds up
// ─────────────────────────────────────────────────────────────
function PreviewWindow({ value }: { value: string[] }) {
  // Resolve picked module ids → full module defs (skipping any
  // unknown ids gracefully so the preview can never crash).
  const picked = value
    .map((id) => getModule(id))
    .filter((m): m is ModuleDef => !!m);

  return (
    <div className="rounded-2xl border border-border-soft bg-foreground/[0.03] overflow-hidden shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6)]">
      {/* Fake window chrome — title bar with traffic lights */}
      <div className="flex items-center gap-2 px-3 h-8 bg-foreground/[0.05] border-b border-border-soft">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]/70" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-[10px] font-semibold text-text-tertiary tracking-wide">
            your.takeover
          </span>
        </div>
        <span className="w-8" />
      </div>

      {/* Header strip — "Your Dashboard" */}
      <div className="px-4 pt-4 pb-2">
        <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-text-tertiary">
          Live preview
        </span>
        <h3 className="text-[15px] font-bold text-foreground mt-0.5 leading-tight">
          Your dashboard
        </h3>
        <p className="text-[10.5px] text-text-tertiary mt-0.5 leading-relaxed">
          {picked.length === 0
            ? "Pick modules and watch your dashboard build itself."
            : `${picked.length} widget${picked.length === 1 ? "" : "s"} ready to log in.`}
        </p>
      </div>

      {/* Grid body */}
      <div className="px-4 pb-4 min-h-[280px]">
        {picked.length === 0 ? (
          // Empty state — ghost tiles
          <div className="grid grid-cols-2 gap-2 mt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-lg border border-dashed border-border-soft/60 bg-foreground/[0.015] h-16"
              />
            ))}
            <div className="col-span-2 text-center text-[10.5px] text-text-tertiary/70 italic mt-1">
              Empty. Tap a preset or pick a module on the left.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <AnimatePresence initial={false} mode="popLayout">
              {picked.map((m) => (
                <PreviewTile key={m.id} module={m} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer strip — count + brand pulse */}
      <div className="border-t border-border-soft px-4 py-2.5 flex items-center justify-between bg-foreground/[0.02]">
        <span className="text-[10px] text-text-tertiary">
          {picked.length} of {MODULES.length} modules
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </span>
          Live
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PreviewTile — a single widget tile inside the preview
// ─────────────────────────────────────────────────────────────
function PreviewTile({ module: m }: { module: ModuleDef }) {
  const accent = getCategoryAccent(m.category);
  const Icon = m.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      transition={{
        type: "spring",
        stiffness: 380,
        damping: 28,
        mass: 0.7,
      }}
      className="rounded-lg p-2.5 border overflow-hidden"
      style={{
        background: rgba(accent, 0.07),
        borderColor: rgba(accent, 0.3),
      }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div
          className="w-5 h-5 rounded-sm flex items-center justify-center"
          style={{ background: rgba(accent, 0.18), color: accent }}
        >
          <Icon className="h-3 w-3" strokeWidth={2.4} />
        </div>
        <span
          className="text-[10px] font-bold leading-tight truncate"
          style={{ color: "hsl(var(--foreground) / 0.95)" }}
        >
          {m.name}
        </span>
      </div>
      {/* Fake "data rows" so the tile feels like a real widget */}
      <div className="space-y-1">
        <div
          className="h-1 rounded-full"
          style={{ background: rgba(accent, 0.4), width: "80%" }}
        />
        <div
          className="h-1 rounded-full"
          style={{ background: rgba(accent, 0.2), width: "55%" }}
        />
        <div
          className="h-1 rounded-full"
          style={{ background: rgba(accent, 0.2), width: "70%" }}
        />
      </div>
    </motion.div>
  );
}
