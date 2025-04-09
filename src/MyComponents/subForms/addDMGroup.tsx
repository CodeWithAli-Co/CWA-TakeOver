import React from "react";
import { useForm } from "@tanstack/react-form";
import Capitalize from "../Reusables/capitalize";
import Select from "react-select";
import { useChatStore } from "@/stores/store";
import supabase from "../supabase";

type Option = { value: string; label: string };

// Custom styles for react-select
const customSelectStyles = {
  control: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    borderColor: state.isFocused ? "#B91C1C" : "#B91C1C",
    boxShadow: state.isFocused ? "0 0 0 1px #B91C1C" : "none",
    "&:hover": {
      borderColor: "#B91C1C",
    },
    padding: "2px",
    borderRadius: "0.8rem",
  }),
  menu: (provided: any) => ({
    ...provided,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    border: "1px solid #B91C1C",
    borderRadius: "0.5rem",
    padding: "4px",
  }),
  option: (provided: any, state: any) => ({
    ...provided,
    backgroundColor: state.isSelected
      ? "#B91C1C"
      : state.isFocused
        ? "rgba(185, 28, 28, 0.5)"
        : "transparent",
    color: "#FFFFFF",
    "&:hover": {
      backgroundColor: "rgba(185, 28, 28, 0.5)",
    },
    borderRadius: "0.25rem",
    margin: "2px 0",
  }),
  multiValue: (provided: any) => ({
    ...provided,
    // this is the background color of the selected subscriber in the droplist
    backgroundColor: "rgba(185, 28, 28, 0.8)",
    borderRadius: "0.25rem",
  }),
  multiValueLabel: (provided: any) => ({
    ...provided,
    // this is the text color when you select the subscriber
    color: "#FFFFFF",
  }),
  multiValueRemove: (provided: any) => ({
    ...provided,
    // this is the x button remove and color
    color: "#FFFFFF",
    "&:hover": {
      backgroundColor: "#B91C1C",
      color: "white",
    },
  }),
  input: (provided: any) => ({
    ...provided,
    color: "#fbbf24",
  }),
};

const MultiSelectField = ({
  name,
  options,
}: {
  name: string;
  options: Option[];
}) => {
  const { setOptionValue } = useChatStore();
  return (
    <div className="w-full">
      <label className="text-amber-50 font-semibold block mb-2 ">{name}</label>
      <Select
        isMulti
        options={options}
        name={name}
        onChange={(value) => setOptionValue(value)}
        styles={customSelectStyles}
        className="text-amber-50 rounded-2xl"
        placeholder="Select subscribers..."
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
    defaultValues: {
      groupName: "",
    },
    onSubmit: async ({ value }) => {
      console.log(value, newOption);
      const { error } = await supabase
        .from("dm_groups")
        .insert({ name: value.groupName, subscribers: newOption });
      if (error) return console.log("Error adding new DM Group", error.message);
    },
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="bg-gradient-to-b from-black to-red-950/30 border border-red-800 rounded-lg 
                    p-6 w-full max-w-md shadow-lg shadow-red-900/20"
      >
        <div className="mb-6">
          <h3 className="text-amber-50 text-xl md:text-2xl font-semibold text-center">
            Create Group DM
          </h3>
          <div className="mt-2 h-0.5 bg-gradient-to-r from-transparent via-red-800 to-transparent"></div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="space-y-4">
            <div>
              <label className="text-amber-50 font-semibold block mb-2">
                Group Name
              </label>
              <form.Field
                name="groupName"
                children={(field) => (
                  <input
                    name={field.name}
                    placeholder="Enter group name..."
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(Capitalize(e.target.value))
                    }
                    className="w-full p-2 bg-black/80 text-amber-50 border border-red-800 rounded-lg 
                             focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600
                             placeholder-amber-50/50 transition-all duration-300"
                  />
                )}
              />
            </div>

            <MultiSelectField name="Subscribers" options={dynamicOptions} />
          </div>

          <div className="pt-4">
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full p-3 bg-gradient-to-r from-red-900 to-red-800 text-amber-50 
                           rounded-2xl hover:from-red-800 hover:to-red-700 
                           transition-all duration-300 border border-red-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-red-900/20 font-semibold
                           focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 
                           focus:ring-offset-black"
                >
                  Create Group
                </button>
              )}
            />
          </div>
        </form>
      </div>
    </div>
  );
};
