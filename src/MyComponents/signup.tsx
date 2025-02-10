import { useForm } from "@tanstack/react-form";
import { useAppStore } from "../stores/store";
import supabase from "./supabase";

export const SingUpPage = () => {
  const { setIsLoggedIn } = useAppStore();
  // const { data: role, isLoading, error: roleError } = useQuery({
  //   queryKey: ["getrole"],
  //   queryFn: fetchData,
  //   refetchInterval: 5000
  // });

  const form = useForm({
    defaultValues: {
      username: "",
      email: "",
      password: "",
      position: "Employee",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      // Need to Insert data into app_users table

      let { data, error } = await supabase.auth.signUp({
        email: value.email,
        password: value.password,
      });

      if (error) return console.log(error.message);

      if (value.position === "Employee") {
        const { error } = await supabase.from("app_users").insert({
          username: value.username,
          email: value.email,
          supa_id: data.user?.id,
        });
        if (error)
          return console.log("Signing Employee up Error:", error.message);
      } else if (value.position === "Intern") {
        const { error } = await supabase.from("interns").insert({
          username: value.username,
          email: value.email,
          supa_id: data.user?.id,
        });
        if (error)
          return console.log("Signing Intern up Error:", error.message);
      }

      // add delay for email to reach user
      await new Promise((r) => setTimeout(r, 10000));
      setIsLoggedIn("false"); // Go to login page
    },
  });

  return (
    <>
      <div className="form-Outdiv">
        <h3>SignUp</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="form">
            <form.Field
              name="email"
              children={(field) => {
                return (
                  <>
                    <label className="form-label" htmlFor={field.name}>
                      Email:
                    </label>
                    <input
                      name={field.name}
                      type="email"
                      className="form-input"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                );
              }}
            />
            <br />
            <form.Field
              name="password"
              children={(field) => {
                return (
                  <>
                    <label className="form-label" htmlFor={field.name}>
                      Password:
                    </label>
                    <input
                      name={field.name}
                      type="password"
                      className="form-input"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                );
              }}
            />
            <br />
            <form.Field
              name="position"
              children={(field) => {
                return (
                  <>
                    <select
                      name={field.name}
                      className="form-select"
                      onChange={(e) => field.handleChange(e.target.value)}
                    >
                      <option value="Employee" className="form-option">
                        Employee
                      </option>
                      <option value="Intern" className="form-option">
                        Intern
                      </option>
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
                Submit
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
