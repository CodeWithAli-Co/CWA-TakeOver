/**
 * AddDMGroup — form for creating a new DM group.
 *
 * Used INSIDE a Dialog (see chat.lazy.tsx / ChatSidebar.tsx). This component
 * renders only the form body — no overlay/modal wrapper, since the parent
 * Dialog already provides those.
 */

import { useForm } from "@tanstack/react-form";
import Capitalize from "../Reusables/capitalize";
import Select from "react-select";
import { useChatStore } from "@/stores/store";
import supabase from "../supabase";
import { getActiveCompanyLabel } from "@/stores/query";

type Option = { value: string; label: string };

/**
 * Theme-aware react-select styles.
 * Reads the current --primary HSL from the document to adapt to CWA (red) or Simplicity (teal).
 */
const getThemeColor = () => {
  const style = getComputedStyle(document.documentElement);
  const primary = style.getPropertyValue("--primary").trim();
  if (!primary) return { r: 239, g: 68, b: 68 }; // fallback red
  const [h, s, l] = primary.split(" ").map((v) => parseFloat(v));
  // Simple HSL→RGB for tag coloring
  const hsl2rgb = (h: number, s: number, l: number) => {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => { const k = (n + h / 30) % 12; return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); };
    return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
  };
  return hsl2rgb(h, s, l);
};

const customSelectStyles = {
  control: (provided: any, state: any) => {
    const c = getThemeColor();
    return {
      ...provided,
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      borderColor: state.isFocused ? `rgba(${c.r}, ${c.g}, ${c.b}, 0.25)` : "rgba(255, 255, 255, 0.06)",
      boxShadow: "none",
      "&:hover": { borderColor: "rgba(255, 255, 255, 0.12)" },
      padding: "1px",
      borderRadius: "2px",
      minHeight: "36px",
    };
  },
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "2px",
    padding: "4px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
  }),
  option: (provided: any, state: any) => {
    const c = getThemeColor();
    return {
      ...provided,
      backgroundColor: state.isSelected
        ? `rgba(${c.r}, ${c.g}, ${c.b}, 0.1)`
        : state.isFocused
          ? "rgba(255, 255, 255, 0.04)"
          : "transparent",
      color: state.isSelected ? `rgb(${c.r}, ${c.g}, ${c.b})` : "rgba(255, 255, 255, 0.7)",
      "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.04)" },
      borderRadius: "2px",
      margin: "1px 0",
      fontSize: "12px",
    };
  },
  multiValue: (provided: any) => {
    const c = getThemeColor();
    return {
      ...provided,
      backgroundColor: `rgba(${c.r}, ${c.g}, ${c.b}, 0.1)`,
      border: `1px solid rgba(${c.r}, ${c.g}, ${c.b}, 0.2)`,
      borderRadius: "2px",
    };
  },
  multiValueLabel: (provided: any) => {
    const c = getThemeColor();
    return {
      ...provided,
      color: `rgb(${c.r}, ${c.g}, ${c.b})`,
      fontSize: "11px",
    };
  },
  multiValueRemove: (provided: any) => {
    const c = getThemeColor();
    return {
      ...provided,
      color: `rgba(${c.r}, ${c.g}, ${c.b}, 0.7)`,
      "&:hover": { backgroundColor: `rgba(${c.r}, ${c.g}, ${c.b}, 0.2)`, color: `rgb(${c.r}, ${c.g}, ${c.b})` },
    };
  },
  input: (provided: any) => ({
    ...provided,
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: "12px",
  }),
  placeholder: (provided: any) => ({
    ...provided,
    color: "rgba(255, 255, 255, 0.15)",
    fontSize: "12px",
  }),
};

const MultiSelectField = ({ options }: { options: Option[] }) => {
  const { setOptionValue } = useChatStore();
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-medium">
        Subscribers
      </label>
      <Select
        isMulti
        options={options}
        onChange={(value) => setOptionValue(value)}
        styles={customSelectStyles}
        placeholder="Pick team members..."
      />
    </div>
  );
};

interface Subscribers {
  Users: any;
}

export const AddDMGroup = (props: Subscribers) => {
  const { optionValue } = useChatStore();
  const dynamicOptions: Option[] = props.Users.map((user: any) => ({
    value: user.username,
    label: user.username,
  }));
  const newOption = optionValue.map((newValue: any) => newValue.value);

  const form = useForm({
    defaultValues: { groupName: "" },
    onSubmit: async ({ value }) => {
      const { error } = await supabase
        .from("dm_groups")
        .insert({ name: value.groupName, subscribers: newOption, company: getActiveCompanyLabel() });
      if (error) console.log("Error adding DM Group:", error.message);
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field
        name="groupName"
        children={(field) => (
          <div className="space-y-1.5">
            <label className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.12em] font-medium">
              Group Name
            </label>
            <input
              name={field.name}
              placeholder="e.g. Design Team"
              value={field.state.value}
              onChange={(e) => field.handleChange(Capitalize(e.target.value))}
              className="w-full px-3 py-2 bg-muted/30 border border-border text-foreground/80 rounded-sm text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/20 transition-colors"
            />
          </div>
        )}
      />

      <MultiSelectField options={dynamicOptions} />

      <form.Subscribe
        selector={(state) => [state.canSubmit]}
        children={([canSubmit]) => (
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-2 bg-primary hover:bg-primary/80 text-primary-foreground text-[12px] font-medium rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Create Group
          </button>
        )}
      />
    </form>
  );
};
