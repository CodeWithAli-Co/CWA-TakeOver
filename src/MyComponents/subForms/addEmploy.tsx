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
      <div className="form-Outdiv">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="form">
            <form.Field
              name="Username"
              children={(field) => {
                return (
                  <>
                    <label className="form-label" htmlFor={field.name}>Username:</label>
                    <input
                      name={field.name}
                      type="text"
                      className="form-input"
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
                    <label className="form-label" htmlFor={field.name}>Email:</label>
                    <input
                      name={field.name}
                      className="form-input"
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
                    <select name={field.name} className="form-select" onChange={(e) => field.handleChange(e.target.value)}>
                      <option value="Member" className="form-option">Member</option>
                      <option value="Admin" className="form-option">Admin</option>
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
              <button type="submit" className="neonbtn" disabled={!canSubmit}>
                Add
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
