import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";

export const AddEmployee = () => {
  const form = useForm({
    defaultValues: {
      Username: "",
      Email: "",
      Role: "member",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      const { error } = await supabase.from("app_users").insert({
        username: value.Username,
        email: value.Email,
        role: value.Role,
      });
      if (error) return console.log(error.message);
 
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
                      required
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
                      required
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
              <button type="submit" disabled={!canSubmit}>
                Add
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
