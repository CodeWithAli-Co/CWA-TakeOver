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

type Option = { value: string; label: string };

// react-select styles tuned to Void theme
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderColor: state.isFocused ? "rgba(239, 68, 68, 0.25)" : "rgba(255, 255, 255, 0.06)",
    boxShadow: "none",
    "&:hover": { borderColor: "rgba(255, 255, 255, 0.12)" },
    padding: "1px",
    borderRadius: "2px",
    minHeight: "36px",
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: "#0f0f0f",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "2px",
    padding: "4px",
    boxShadow: "0 10px 25px rgba(0,0,0,0.6)",
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "rgba(239, 68, 68, 0.1)"
      : state.isFocused
        ? "rgba(255, 255, 255, 0.04)"
        : "transparent",
    color: state.isSelected ? "rgb(248, 113, 113)" : "rgba(255, 255, 255, 0.7)",
    "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.04)" },
    borderRadius: "2px",
    margin: "1px 0",
    fontSize: "12px",
  }),
  multiValue: (provided: any) => ({
    ...provided,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    borderRadius: "2px",
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    color: "rgb(248, 113, 113)",
    fontSize: "11px",
  }),
  multiValueRemove: (provided: any) => ({
    ...provided,
    color: "rgba(248, 113, 113, 0.7)",
    "&:hover": { backgroundColor: "rgba(239, 68, 68, 0.2)", color: "rgb(248, 113, 113)" },
  }),
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
      <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
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
        .insert({ name: value.groupName, subscribers: newOption });
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
            <label className="text-[10px] text-white/25 uppercase tracking-[0.12em] font-medium">
              Group Name
            </label>
            <input
              name={field.name}
              placeholder="e.g. Design Team"
              value={field.state.value}
              onChange={(e) => field.handleChange(Capitalize(e.target.value))}
              className="w-full px-3 py-2 bg-white/[0.02] border border-white/[0.06] text-white/80 rounded-sm text-[13px] placeholder:text-white/15 focus:outline-none focus:border-red-500/20 transition-colors"
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
            className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-[12px] font-medium rounded-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Create Group
          </button>
        )}
      />
    </form>
  );
};
