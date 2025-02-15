import { useForm } from "@tanstack/react-form";
import Capitalize from "../capitalize";
import Select from "react-select";
import { useChatStore } from "@/stores/store";
import supabase from "../supabase";

type Option = { value: string; label: string };

const MultiSelectField = ({
  name,
  options,
}: {
  name: string;
  options: Option[];
}) => {
  const { setOptionValue } = useChatStore();
  return (
    <div>
      <label className="font-bold text-black">{name}</label>
      <Select
        isMulti
        options={options}
        name={name}
        onChange={(value) => setOptionValue(value)}
        className="text-black"
      />
    </div>
  );
};

interface Subscribers {
  Users: any;
}

export const AddDMGroup = (props: Subscribers) => {
  const { optionValue } = useChatStore();

  const dynamicOptions: Option[] = [];

  for (var users of props.Users) {
    dynamicOptions.push({ value: users.username, label: users.username });
  }

  const newOption = optionValue.map((newValue: any) => newValue.value);

  const form = useForm({
    defaultValues: {
      groupName: "",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      console.log(newOption);
      const { error } = await supabase
        .from("dm_groups")
        .insert({ name: value.groupName, subscribers: newOption });
      if (error) return console.log("Error adding new DM Group", error.message);
    },
  });

  return (
    <>
      <div>
        <h3 className="text-black">Create Group DM</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div>
            <form.Field
              name="groupName"
              children={(field) => {
                return (
                  <>
                    <input
                      name={field.name}
                      placeholder="group name"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(Capitalize(e.target.value))
                      }
                    />
                  </>
                );
              }}
            />
            <br />
            <MultiSelectField name="Subscribers" options={dynamicOptions} />
            <br />
          </div>
          <form.Subscribe
            selector={(state) => [state.canSubmit]}
            children={([canSubmit]) => (
              <button type="submit" className="text-black neonbtn" disabled={!canSubmit}>
                Add
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
