import React from "react";
import { useMultiSelectStore } from "@/stores/store";
import Select from "react-select";

export type Option = { value: string; label: string };

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

export const MultiSelectField = ({
  name,
  options,
}: {
  name: string;
  options: Option[];
}) => {
  const { setOptionsValue } = useMultiSelectStore();
  return (
    <div className="w-full">
      <label className="text-amber-50 font-semibold block mb-2 ">{name}</label>
      <Select
        isMulti
        options={options}
        name={name}
        onChange={(value) => setOptionsValue(value)}
        styles={customSelectStyles}
        className="text-amber-50 rounded-2xl"
        placeholder="Select subscribers..."
      />
    </div>
  );
};
