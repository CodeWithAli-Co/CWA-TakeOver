import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores/store";

export const AddData = () => {
  const { setDialog } = useAppStore();

  const form = useForm({
    defaultValues: {
      platformName: "",
      Username: "",
      Email: "",
      Password: "",
      AddInfo: "",
      Active: "true",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      const encPassword = invoke("encrypt", {
        keyStr: import.meta.env.VITE_ENCRYPTION_KEY,
        plaintext: value.Password,
      });
      encPassword.then(async (res) => {
        const { error } = await supabase.from("cwa_creds").insert({
          platform_name: value.platformName,
          acc_username: value.Username,
          acc_email: value.Email,
          acc_enc_password: res,
          acc_addinfo: value.AddInfo,
          active: value.Active,
        });
        if (error) return console.log(error.message);
      });
  
      setDialog("closed");
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
              name="platformName"
              children={(field) => {
                return (
                  <>
                    <label htmlFor={field.name}>Platfrom Name:</label>
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
              name="Password"
              children={(field) => {
                return (
                  <>
                    <label htmlFor={field.name}>Password:</label>
                    <input
                      name={field.name}
                      type="password"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                );
              }}
            />
            <br />
            <form.Field
              name="AddInfo"
              children={(field) => {
                return (
                  <>
                    <label htmlFor={field.name}>Additional Info:</label>
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
              name="Active"
              children={(field) => {
                return (
                  <>
                    <label htmlFor={field.name}>Status:</label>

                    <br />

                    <label htmlFor={field.name}>Active:</label>
                    <input
                      name={field.name}
                      type="radio"
                      value="true"
                      onChange={(e) => field.handleChange(e.target.value)}
                    />

                    <label htmlFor={field.name}>Inactive:</label>
                    <input
                      name={field.name}
                      type="radio"
                      value="false"
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
