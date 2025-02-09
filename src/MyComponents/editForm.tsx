import { useForm } from "@tanstack/react-form";
import supabase from "./supabase";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores/store";

interface Props {
  rowID: any
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
        if (error) return console.log('PlatformName Error:', error.message);
      }

      if (value.Username !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ acc_username: value.Username })
          .eq("id", props.rowID);
        if (error) return console.log('Username Error:', error.message);
      }

      if (value.Email !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ acc_email: value.Email })
          .eq("id", props.rowID);
        if (error) return console.log('Email Error:', error.message);
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
          if (error) return console.log('Password Error:', error.message);
        });
      }

      if (value.AddInfo !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ acc_addinfo: value.AddInfo })
          .eq("id", props.rowID);
        if (error) return console.log('AddInfo Error:', error.message);
      }

      if (value.Active !== "") {
        const { error } = await supabase
          .from("cwa_creds")
          .update({ active: JSON.parse(value.Active) })
          .eq("id", props.rowID);
        if (error) return console.log('Active Status Error:', error.message);
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
              name="platformName"
              children={(field) => {
                return (
                  <>
                    <input
                      name={field.name}
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
                    <input
                      name={field.name}
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
                    <input
                      name={field.name}
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
                    <input
                      name={field.name}
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
                    <input
                      name={field.name}
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
                    <input
                      name={field.name}
                      type="radio"
                      checked
                      value='true'
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <input
                      name={field.name}
                      type="radio"
                      value='false'
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
              <button type="submit" id="submit" disabled={!canSubmit}>
                Submit
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
