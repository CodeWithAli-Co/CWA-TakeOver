import React from "react";
import { useAppStore } from "@/stores/store";
import { useForm } from "@tanstack/react-form";
import { invoke } from "@tauri-apps/api/core";

export const EditResendContact = () => {
  const { setDialog } = useAppStore();
  const form = useForm({
    defaultValues: {
      Email: "",
      FirstName: "",
      LastName: "",
      UnSubscribed: "false",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      await invoke("edit_contact", {
        email: value.Email,
        fName: value.FirstName,
        lName: value.LastName,
        status: JSON.parse(value.UnSubscribed),
      });

      setDialog("closed");
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
              name="Email"
              children={(field) => {
                return (
                  <>
                    <label className="form-label" htmlFor={field.name}>Email:</label>
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
              name="FirstName"
              children={(field) => {
                return (
                  <>
                    <label className="form-label" htmlFor={field.name}>First Name:</label>
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
              name="LastName"
              children={(field) => {
                return (
                  <>
                    <label className="form-label" htmlFor={field.name}>Last Name:</label>
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
              name="UnSubscribed"
              children={(field) => {
                return (
                  <>
                    <select
                      name={field.name}
                      className="form-select"
                      onChange={(e) => field.handleChange(e.target.value)}
                    >
                      <option value="false" className="form-option">False</option>
                      <option value="true" className="form-option">True</option>
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
                Save Changes
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
