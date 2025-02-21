import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { UserPlus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card className="bg-red-950/10 border-red-900/20 mb-8">
        <CardContent className="pt-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="grid grid-cols-3 gap-6">
              <form.Field
                name="Username"
                children={(field) => {
                  return (
                    <div className="space-y-2">
                      <label className="text-amber-50/70" htmlFor={field.name}>
                        Username
                      </label>
                      <input
                        name={field.name}
                        type="text"
                        id="username"
                        autoComplete="off"
                        placeholder="Enter username"
                        className="bg-black/40 border-red-900/30 text-amber-50 rounded-lg
                                   focus:border-red-500 hover:bg-black/60 transition-colors"
                        required
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  );
                }}
              />
              <form.Field
                name="Email"
                children={(field) => {
                  return (
                    <div className="space-y-2">
                      <label className="text-amber-50/70" htmlFor={field.name}>
                        Email
                      </label>
                      <input
                        name={field.name}
                        type="email"
                        id="email"
                        autoComplete="off"
                        placeholder="Enter email"
                        className="bg-black/40 border-red-900/30 text-amber-50 rounded-lg
                                   focus:border-red-500 hover:bg-black/60 transition-colors"
                        required
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  );
                }}
              />
              <form.Field
                name="Role"
                children={(field) => {
                  return (
                    <div className="space-y-2">
                      <label htmlFor={field.name} className="text-amber-50/70">
                        Role
                      </label>
                      <select
                        name={field.name}
                        className="bg-black/40 border-red-900/30 text-amber-50 rounded-lg
                                                  focus:border-red-500 hover:bg-black/60 transition-colors"
                        onChange={(e) => field.handleChange(e.target.value)}
                      >
                        <option
                          value="member"
                          className="bg-black text-amber-50 border-red-900/20"
                        >
                          Member
                        </option>
                        <option
                          value="admin"
                          className="bg-black text-amber-50 border-red-900/20"
                        >
                          Admin
                        </option>
                      </select>
                    </div>
                  );
                }}
              />
            </div>
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <button
                  type="submit"
                  className="mt-6 bg-red-900 hover:bg-red-800 text-amber-50"
                  disabled={!canSubmit}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Employee
                </button>
              )}
            />
          </form>
        </CardContent>
      </Card>
    </>
  );
};
