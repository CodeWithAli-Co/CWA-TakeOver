import React from "react";
import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { useAppStore } from "@/stores/store";
import { Card, CardContent } from "@/components/ui/shadcnComponents/card";
import { UserPlus } from "lucide-react";

interface Props {
  rowID: number;
}

export const EditEmployee = (props: Props) => {
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
          .from("app_users")
          .update({ username: value.Username })
          .eq("id", props.rowID);
        if (error) return console.log("Username Error:", error.message);
      }

      if (value.Email !== "") {
        const { error } = await supabase
          .from("app_users")
          .update({ email: value.Email })
          .eq("id", props.rowID);
        if (error) return console.log("Email Error:", error.message);
      }

      if (value.Role !== "") {
        const { error } = await supabase
          .from("app_users")
          .update({ role: value.Role })
          .eq("id", props.rowID);
        if (error) return console.log("Role Error:", error.message);
      }

      setDialog("closed");
      form.reset();
    },
  });

  return (
    // Make it so other fields only show when needed
    <Card className="bg-red-950/10 border-red-900/20 mb-8">
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="grid grid-cols-3 gap-8">
            <form.Field
              name="Username"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label
                    className="text-amber-50/70 text-sm font-medium"
                    htmlFor={field.name}
                  >
                    Username
                  </label>
                  <input
                    name={field.name}
                    type="text"
                    id="username"
                    autoComplete="off"
                    placeholder="Enter username"
                    className="w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg
                             focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors"
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            <form.Field
              name="Email"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label
                    className="text-amber-50/70 text-sm font-medium"
                    htmlFor={field.name}
                  >
                    Email
                  </label>
                  <input
                    name={field.name}
                    type="email"
                    id="email"
                    autoComplete="off"
                    placeholder="Enter email"
                    className="w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg
                             focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors"
                    required
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            <form.Field
              name="Role"
              children={(field) => (
                <div className="flex flex-col space-y-2">
                  <label
                    className="text-amber-50/70 text-sm font-medium"
                    htmlFor={field.name}
                  >
                    Role
                  </label>
                  <select
                    name={field.name}
                    defaultValue={"Member"}
                    className="w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg
                             focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors"
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    <option
                      value="Intern"
                      className="bg-black text-amber-50 border-red-900/20"
                    >
                      Intern
                    </option>
                    <option
                      value="Member"
                      className="bg-black text-amber-50 border-red-900/20"
                    >
                      Member
                    </option>
                    <option
                      value="Marketing Specialist"
                      className="bg-black text-amber-50 border-red-900/20"
                    >
                      Marketing Specialist
                    </option>
                    <option
                      value="Admin"
                      className="bg-black text-amber-50 border-red-900/20"
                    >
                      Admin
                    </option>
                    <option
                      value="Project Manager"
                      className="bg-black text-amber-50 border-red-900/20"
                    >
                      Project Manager
                    </option>
                  </select>
                </div>
              )}
            />
          </div>

          <form.Subscribe
            selector={(state) => [state.canSubmit]}
            children={([canSubmit]) => (
              <button
                type="submit"
                className="mt-8 px-4 py-2 flex items-center bg-red-900 hover:bg-red-800 text-amber-50 rounded-lg transition-colors"
                disabled={!canSubmit}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Edit Employee
              </button>
            )}
          />
        </form>
      </CardContent>
    </Card>
  );
};
