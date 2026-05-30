import { useMultiSelectStore } from "@/stores/store";
import Select, { type MultiValue } from "react-select";

export type Option = {
  value: string;
  label: string;
  /** Optional URL — when provided, the field renders the avatar
   *  next to the label in both the dropdown and the selected
   *  chip. Used by meeting/task forms to show real employee
   *  faces instead of just usernames. */
  avatarUrl?: string;
};

/**
 * MultiSelectField — react-select wrapped with the app's semantic
 * token system. No more hardcoded `#B91C1C` everywhere — colours
 * resolve through `hsl(var(--…))` so the field stays in lockstep
 * with theme changes (light/dark, brand recolour).
 *
 * Style rules:
 *   · Control matches the rest of the form inputs (bg-background/40
 *     + border-border, soft focus ring via --primary)
 *   · Menu uses bg-popover with the same hairline as cards
 *   · Selected option = quiet bg-primary/12 + text-primary
 *     (not a saturated red fill — that was the "looks like an error"
 *     dropdown the operator just flagged)
 *   · Multi-value chips use the same primary tint with restrained alpha
 */
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: "hsl(var(--background) / 0.4)",
    borderColor: state.isFocused
      ? "hsl(var(--primary) / 0.45)"
      : "hsl(var(--border))",
    boxShadow: state.isFocused
      ? "0 0 0 2px hsl(var(--primary) / 0.20)"
      : "none",
    "&:hover": {
      borderColor: "hsl(var(--primary) / 0.30)",
    },
    minHeight: "38px",
    borderRadius: "8px",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border) / 0.6)",
    borderRadius: "10px",
    padding: "4px",
    boxShadow:
      "0 12px 32px -8px rgba(0, 0, 0, 0.55), 0 4px 12px -4px rgba(0, 0, 0, 0.35)",
    overflow: "hidden",
    /* Marginally lifted off the trigger so the elevation shadow
     *  has room to read. */
    marginTop: "6px",
  }),
  menuList: (provided: any) => ({
    ...provided,
    padding: 0,
    /* Cap the height so a long roster scrolls inside the menu
     *  instead of pushing the dropdown off the viewport. */
    maxHeight: "220px",
  }),
  /* Portal the menu through document.body so it can sit above the
   *  dialog's overflow-hidden clip + footer chrome. zIndex puts it
   *  above any modal at z-200.
   *
   *  pointerEvents: 'auto' is CRITICAL — Radix Dialog (which shadcn
   *  wraps) sets pointer-events: none on every element outside the
   *  dialog content when modal={true} (default). Since the menu is
   *  portalled to <body>, it inherits that block — the dropdown
   *  visually opens and hover styles work, but clicks register on
   *  nothing because the entire portal subtree has pointer-events
   *  disabled. Forcing 'auto' here punches a hole through that. */
  menuPortal: (provided: any) => ({
    ...provided,
    zIndex: 9999,
    pointerEvents: "auto",
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "hsl(var(--primary) / 0.12)"
      : state.isFocused
      ? "hsl(var(--foreground) / 0.05)"
      : "transparent",
    color: state.isSelected
      ? "hsl(var(--primary))"
      : "hsl(var(--foreground))",
    fontWeight: state.isSelected ? 600 : 400,
    fontSize: "13px",
    cursor: "pointer",
    borderRadius: "6px",
    padding: "6px 10px",
    "&:active": {
      backgroundColor: "hsl(var(--primary) / 0.15)",
    },
  }),
  multiValue: (provided: any) => ({
    ...provided,
    backgroundColor: "hsl(var(--primary) / 0.12)",
    border: "1px solid hsl(var(--primary) / 0.25)",
    borderRadius: "6px",
    overflow: "hidden",
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    color: "hsl(var(--primary))",
    fontSize: "12px",
    fontWeight: 500,
    padding: "2px 6px",
  }),
  multiValueRemove: (provided: any) => ({
    ...provided,
    color: "hsl(var(--primary) / 0.7)",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: "hsl(var(--primary) / 0.20)",
      color: "hsl(var(--primary))",
    },
  }),
  input: (provided: any) => ({
    ...provided,
    color: "hsl(var(--foreground))",
    fontSize: "13px",
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: "hsl(var(--text-tertiary))",
    fontSize: "13px",
  }),
  indicatorSeparator: (provided: any) => ({
    ...provided,
    backgroundColor: "hsl(var(--border))",
  }),
  dropdownIndicator: (provided: any, state: any) => ({
    ...provided,
    color: state.isFocused
      ? "hsl(var(--primary))"
      : "hsl(var(--text-tertiary))",
    transition: "color 0.15s ease",
    "&:hover": { color: "hsl(var(--foreground))" },
  }),
  clearIndicator: (provided: any) => ({
    ...provided,
    color: "hsl(var(--text-tertiary))",
    cursor: "pointer",
    "&:hover": { color: "hsl(var(--foreground))" },
  }),
};

/**
 * Renders an option row with optional avatar + name. Used for
 * formatOptionLabel so the same shape is used in the dropdown
 * menu AND in the selected chip — keeps both consistent without
 * doubling the label markup.
 */
function OptionLabel({ opt }: { opt: Option }) {
  if (!opt.avatarUrl) {
    return <span>{opt.label}</span>;
  }
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src={opt.avatarUrl}
        alt=""
        className="w-5 h-5 rounded-full object-cover ring-1 ring-border/40"
        onError={(e) => {
          // Hide broken avatars rather than show the cracked-image
          // glyph; the username still reads fine on its own.
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
      <span>{opt.label}</span>
    </span>
  );
}

export const MultiSelectField = ({
  name,
  options,
  /** Optional controlled value — pass when you want to manage state
   *  outside the shared zustand store (e.g. so two open modals don't
   *  collide on the same global state). */
  value,
  /** Optional controlled change handler — pairs with `value`. */
  onChange,
  /** Optional placeholder override. */
  placeholder,
  /** Hide the built-in label and let the parent label this field
   *  itself. Useful inside forms that already have their own
   *  matching Label component. */
  hideLabel = false,
}: {
  name: string;
  options: Option[];
  value?: Option[];
  onChange?: (value: Option[]) => void;
  placeholder?: string;
  hideLabel?: boolean;
}) => {
  const { setOptionsValue } = useMultiSelectStore();
  // Controlled mode flag — when the caller supplied either prop we
  // wire react-select to those instead of the shared zustand store.
  // This lets the meeting and task modals coexist without leaking
  // selections between them.
  const isControlled = value !== undefined || onChange !== undefined;

  const handleChange = (next: MultiValue<Option>) => {
    if (isControlled) {
      onChange?.(next as Option[]);
    } else {
      setOptionsValue(next);
    }
  };

  return (
    <div className="w-full">
      {!hideLabel && (
        <label className="text-[12px] font-medium text-foreground block mb-1.5">
          {name}
        </label>
      )}
      <Select
        isMulti
        options={options}
        name={name}
        {...(isControlled ? { value } : {})}
        onChange={handleChange}
        styles={customSelectStyles}
        placeholder={placeholder ?? "Select people…"}
        noOptionsMessage={() => "No matches"}
        formatOptionLabel={(opt) => <OptionLabel opt={opt as Option} />}
        /* Render the menu in a portal at <body> so it can pierce
         *  the parent dialog's overflow-hidden + footer chrome.
         *  Without this the dropdown gets clipped at the dialog
         *  edge — see the screenshot the operator just sent. */
        menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
        menuPosition="fixed"
      />
    </div>
  );
};
