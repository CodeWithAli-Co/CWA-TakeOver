import { useForm } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores/store";
import supabase from "../supabase";

interface Props {
  rowID: number;
}

export const EditData = (props: Props) => {
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
      if (value.platformName !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ platform_name: value.platformName })
          .eq("id", props.rowID);
        if (error) return console.log("PlatformName Error:", error.message);
      }

      if (value.Username !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ acc_username: value.Username })
          .eq("id", props.rowID);
        if (error) return console.log("Username Error:", error.message);
      }

      if (value.Email !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ acc_email: value.Email })
          .eq("id", props.rowID);
        if (error) return console.log("Email Error:", error.message);
      }

      // Encrypt then insert
      if (value.Password !== "") {
        const encPassword = invoke("encrypt", {
          keyStr: import.meta.env.VITE_ENCRYPTION_KEY,
          plaintext: value.Password,
        });
        encPassword.then(async (res) => {
          const { error } = await supabase
            .from("cwa_creds")
            .update({
              acc_enc_password: res,
            })
            .eq("id", props.rowID);
          if (error) return console.log("Password Error:", error.message);
        });
      }

      if (value.AddInfo !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ acc_addinfo: value.AddInfo })
          .eq("id", props.rowID);
        if (error) return console.log("AddInfo Error:", error.message);
      }

      if (value.Active !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ active: JSON.parse(value.Active) })
          .eq("id", props.rowID);
        if (error) return console.log("Active Status Error:", error.message);
      }

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
                    <label htmlFor={field.name}>Platform Name:</label>
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
                    {/* Can make this into textarea of editable div */}
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
