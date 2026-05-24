/**
 * InboxToolbar.tsx — Shared toolbar for the inbox tables.
 *
 * Renders the top-row controls used by both Reports and Bug
 * Reports tabs: search input, a horizontally-scrolling row of
 * filter dropdowns, a density toggle, and a result count.
 *
 * Filter values are owned by the caller; this component is
 * stateless aside from internal dropdown open/close logic.
 */

import { Search, X, Rows3, Rows4 } from "lucide-react";

export type Density = "comfortable" | "compact";

interface FilterOption {
  value: string;
  label: string;
}

interface Filter {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: FilterOption[];
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;

  filters: Filter[];

  /** Bottom-line result count, e.g. "12 bugs". */
  countLabel: string;

  /** Optional clear-all-filters button. Shows only when truthy. */
  onClearFilters?: () => void;

  density: Density;
  onDensityChange: (d: Density) => void;
}

export function InboxToolbar({
  search, onSearchChange, searchPlaceholder = "Search…",
  filters, countLabel, onClearFilters, density, onDensityChange,
}: Props) {
  return (
    <div className="shrink-0 border-b border-border bg-zinc-950/40 px-5 py-3">
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-[360px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-md border border-border bg-background pl-8 pr-8 py-1.5 text-[12px] placeholder:text-muted-foreground/60 outline-none focus:border-foreground/30 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter dropdowns */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {filters.map((f) => (
            <FilterSelect key={f.label} {...f} />
          ))}
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-[10.5px] font-semibold text-primary hover:text-primary/80 shrink-0 px-2"
            >
              Clear
            </button>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <p className="text-[10.5px] text-muted-foreground/80 shrink-0">
            {countLabel}
          </p>
          {/* Density toggle */}
          <div className="flex rounded-md border border-border p-0.5 bg-background">
            <DensityButton
              label="Comfortable"
              icon={Rows3}
              active={density === "comfortable"}
              onClick={() => onDensityChange("comfortable")}
            />
            <DensityButton
              label="Compact"
              icon={Rows4}
              active={density === "compact"}
              onClick={() => onDensityChange("compact")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: Filter) {
  // Show the chosen option's label when not at "All …"; otherwise
  // show the filter's own label (acts like a dropdown label until
  // the user narrows it).
  const chosen = options.find((o) => o.value === value);
  const showLabel = !chosen || /^all\b/i.test(chosen.label) ? label : chosen.label;
  const active = chosen && !/^all\b/i.test(chosen.label);
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={[
          "appearance-none rounded-md border bg-background pl-2.5 pr-7 py-1.5 text-[11px] font-semibold outline-none cursor-pointer transition-colors",
          active
            ? "border-primary/40 text-primary hover:bg-primary/5"
            : "border-border text-foreground/80 hover:text-foreground hover:bg-muted/40",
        ].join(" ")}
        style={{
          backgroundImage: "url(\"data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='%23a1a1aa' stroke-width='1.5' d='M3 5l3 3 3-3'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 5px center",
        }}
        title={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-background text-foreground">
            {o.label}
          </option>
        ))}
      </select>
      {/* The native <select> renders the chosen label, but we want
          the filter's name when at "All". To do that without
          replacing <select> we just hide the displayed text via
          color when active === false. The overlay label sits on
          top.  This sub-component instead exposes the active state
          to colour the chip — the parent select still works
          natively, which keeps keyboard accessibility intact. */}
      {!active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center pl-2.5 pr-7 text-[11px] font-semibold text-foreground/80 bg-background rounded-md"
        >
          {showLabel}
        </span>
      )}
    </div>
  );
}

function DensityButton({
  label, icon: Icon, active, onClick,
}: {
  label: string;
  icon: typeof Rows3;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={[
        "inline-flex h-6 w-7 items-center justify-center rounded-sm transition-colors",
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
      ].join(" ")}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}
