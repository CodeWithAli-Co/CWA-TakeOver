import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { useAppStore } from "@/stores/store";

interface Props {
  rowID: number;
}

export const EditIntern = (props: Props) => {
  const { setDialog } = useAppStore();
  const form = useForm({
    defaultValues: {
      Username: "",
      Email: "",
      Role: "",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      if (value.Username !== "") {
        const { error } = await supabase
          .from("interns")
          .update({ username: value.Username })
          .eq("id", props.rowID);
        if (error) return console.log("Username Error:", error.message);
      }

      if (value.Email !== "") {
        const { error } = await supabase
          .from("interns")
          .update({ email: value.Email })
          .eq("id", props.rowID);
        if (error) return console.log("Email Error:", error.message);
      }

      if (value.Role !== "") {
        const { error } = await supabase
          .from("interns")
          .update({ role: value.Role })
          .eq("id", props.rowID);
        if (error) return console.log("Role Error:", error.message);
      }

      setDialog('closed');
      form.reset();
    },
  });

  return (
    <>
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div>
            <form.Field
              name="Username"
              children={(field) => {
                return (
                  <>
                    <label htmlFor={field.name}>Username:</label>
                    <input
                      name={field.name}
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                );
              }}
            />
            <br />
            <form.Field
              name="Email"
              children={(field) => {
                return (
                  <>
                    <label htmlFor={field.name}>Email:</label>
                    <input
                      name={field.name}
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                );
              }}
            />
            <br />
            <form.Field
              name="Role"
              children={(field) => {
                return (
                  <>
                    <select name={field.name} id="role-select" onChange={(e) => field.handleChange(e.target.value)}>
                      <option value="Member">Member</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </>
                );
              }}
            />
            <br />
          </div>
          <form.Subscribe
            selector={(state) => [state.canSubmit]}
            children={([canSubmit]) => (
              <button type="submit" id="Editsubmit" disabled={!canSubmit}>
                Save Changes
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
