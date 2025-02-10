import { useForm } from "@tanstack/react-form";
import { useAppStore } from "../stores/store";
import supabase from "./supabase";

export const LoginPage = () => {
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
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      // Login with username + pass; grab usernsame's email to insert into signIn supabase API
      let { data, error } = await supabase.auth.signInWithPassword({
        email: value.email, // need to change this
        password: value.password,
      });

      const { data: verify } = await supabase.auth.getUserIdentities();
      // checks if user is authenticated by supabase and if they have the specified custom role
      if (
        data.user?.role === "authenticated" &&
        verify?.identities[0].identity_data!.email_verified
      ) {
        setIsLoggedIn("true");
        localStorage.setItem("isLoggedIn", "true");
      }
      console.log();

      if (error?.message === "Invalid login credentials") {
        setIsLoggedIn("makeAcc");
      }
    },
  });

  return (
    <>
      <div className="form-Outdiv">
        <h3>LogIn</h3>
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
