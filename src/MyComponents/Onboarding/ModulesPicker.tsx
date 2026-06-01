/**
 * ModulesPicker.tsx — colored tabbed module-builder picker.
 *
 * UX intent: turn "pick from 25 things" into a guided builder.
 *   1. Top: preset chips for one-click bundles ("Startup Starter",
 *      "Sales Team", etc.) — most users just hit one of these.
 *   2. Below: category tab strip with per-category accent colors
 *      and live count. One category visible at a time so the page
 *      doesn't feel like a long settings list.
 *   3. Grid: 3-4 column cards tinted with the active category's
 *      accent, animated transitions when switching tabs.
 *
 * Used by:
 *   · InitialOnboarding Step 4 — install-time picker
 *   · Settings → Modules — runtime toggle
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles, Layers } from "lucide-react";
import {
  MODULES,
  MODULE_CATEGORIES,
  MODULE_PRESETS,
  modulesByCategory,
  type ModuleCategory,
  type ModuleDef,
} from "./modulesCatalog";

/** Hex `#RRGGBB` → `rgba(r,g,b,a)`. Tiny inline so we don't
 *  add a util dep. */
function rgba(hex: string, alpha: number): string {
  const m = hex.replace("#", "");
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ModulesPicker({
  value,
  onChange,
  disabled = false,
  /** Hide the preset chip row (Settings can opt out). */
  showPresets = true,
  /** Hide the category tab strip and show all categories stacked
   *  (Settings prefers the long view). */
  stacked = false,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  showPresets?: boolean;
  stacked?: boolean;
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

  const presetMatch = (presetIds: string[]): boolean => {
    const want = new Set(presetIds);
    if (want.size !== enabled.size) return false;
    for (const id of want) if (!enabled.has(id)) return false;
    return true;
  };

  // Which categories to render in the body, based on tab choice.
  const visibleCats: typeof MODULE_CATEGORIES =
    stacked || activeCat === "all"
      ? MODULE_CATEGORIES
      : MODULE_CATEGORIES.filter((c) => c.id === activeCat);

  return (
    <div className="space-y-5">
      {/* ─── Preset chip row ───────────────────────────────── */}
      {showPresets && (
        <div className="rounded-2xl border border-border-soft bg-foreground/[0.025] p-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" strokeWidth={2.4} />
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-foreground">
              Quick start
            </span>
            <span className="text-[10.5px] text-text-tertiary">
              one click to pick a bundle, then tweak below
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {MODULE_PRESETS.map((p) => {
              const targetIds = p.id === "full" ? MODULES.map((m) => m.id) : p.ids;
              const isActive = presetMatch(targetIds);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  disabled={disabled}
                  title={p.tagline}
                  className="group inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11.5px] font-semibold border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: isActive ? p.accent : rgba(p.accent, 0.08),
                    borderColor: isActive ? p.accent : rgba(p.accent, 0.4),
                    color: isActive ? "#fff" : p.accent,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Category tabs ─────────────────────────────────── */}
      {!stacked && (
        <div className="flex flex-wrap gap-1.5">
          {/* "All" tab */}
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
      )}

      {/* ─── Module grid (animated tab swap) ───────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={stacked ? "stacked" : activeCat}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
          {visibleCats.map((cat) => {
            const modules = grouped.get(cat.id) ?? [];
            if (modules.length === 0) return null;
            const enabledInCat = modules.filter((m) => enabled.has(m.id)).length;
            return (
              <section key={cat.id}>
                {/* Show the category heading when in "all" mode
                 *  or stacked; in single-cat mode the tab itself
                 *  is the heading so we skip. */}
                {(activeCat === "all" || stacked) && (
                  <div className="mb-3 flex items-baseline gap-3">
                    <h3
                      className="text-[10.5px] font-bold uppercase tracking-[0.22em] shrink-0"
                      style={{ color: cat.accent }}
                    >
                      {cat.label}
                    </h3>
                    <span className="text-[10px] font-semibold text-text-tertiary tabular-nums shrink-0">
                      {enabledInCat}/{modules.length}
                    </span>
                    <div
                      className="flex-1 h-px"
                      style={{ background: rgba(cat.accent, 0.18) }}
                    />
                    <span className="text-[10.5px] text-text-tertiary hidden md:inline shrink-0">
                      {cat.desc}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {modules.map((m) => (
                    <ModuleCard
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
  );
}

// ────────────────────────────────────────────────────────────────
// Category tab — colored chip with live count.
// ────────────────────────────────────────────────────────────────
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
  const accentSolid = isHsl ? accent : accent;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[12px] font-bold border transition-all"
      style={{
        background: active
          ? isHsl
            ? "hsl(var(--foreground) / 0.1)"
            : rgba(accent, 0.18)
          : isHsl
            ? "hsl(var(--foreground) / 0.04)"
            : rgba(accent, 0.06),
        borderColor: active
          ? accentSolid
          : isHsl
            ? "hsl(var(--foreground) / 0.18)"
            : rgba(accent, 0.3),
        color: active ? accentSolid : isHsl ? "hsl(var(--foreground) / 0.75)" : accent,
      }}
    >
      {Icon && <Icon size={12} strokeWidth={2.4} />}
      <span>{label}</span>
      <span
        className="text-[10px] font-semibold tabular-nums px-1.5 py-px rounded-full"
        style={{
          background: active ? rgba(isHsl ? "#FFFFFF" : accent, 0.16) : "transparent",
          color: active ? accentSolid : "currentColor",
          opacity: active ? 1 : 0.7,
        }}
      >
        {count}/{total}
      </span>
    </motion.button>
  );
}

// ────────────────────────────────────────────────────────────────
// Module card — colored, denser, with left edge accent on active.
// ────────────────────────────────────────────────────────────────
function ModuleCard({
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
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      className={`group relative text-left rounded-xl border p-3.5 overflow-hidden transition-colors ${
        m.alwaysOn ? "cursor-default" : ""
      } ${disabled ? "opacity-70" : ""}`}
      style={{
        background: active ? rgba(accent, 0.1) : "hsl(var(--foreground) / 0.025)",
        borderColor: active ? rgba(accent, 0.55) : "hsl(var(--border) / 0.4)",
        boxShadow: active ? `0 4px 18px -8px ${rgba(accent, 0.5)}` : "none",
      }}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full"
          style={{ background: accent }}
        />
      )}

      <div className="flex items-start gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border transition-colors"
          style={{
            background: active ? rgba(accent, 0.18) : "hsl(var(--foreground) / 0.06)",
            borderColor: active ? rgba(accent, 0.4) : "hsl(var(--border) / 0.4)",
            color: active ? accent : "hsl(var(--foreground) / 0.7)",
          }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className="text-[12.5px] font-bold leading-tight"
              style={{
                color: active ? "hsl(var(--foreground))" : "hsl(var(--foreground) / 0.9)",
              }}
            >
              {m.name}
            </span>
            {m.alwaysOn && (
              <span className="text-[8.5px] font-bold uppercase tracking-[0.14em] text-text-tertiary px-1 py-px rounded bg-foreground/[0.06]">
                Required
              </span>
            )}
            {active && !m.alwaysOn && (
              <CheckCircle2
                className="h-3.5 w-3.5 ml-auto shrink-0"
                strokeWidth={2.8}
                style={{ color: accent }}
              />
            )}
          </div>
          <p className="text-[11px] text-text-tertiary leading-relaxed line-clamp-2">
            {m.description}
          </p>
        </div>
      </div>
    </motion.button>
  );
}
