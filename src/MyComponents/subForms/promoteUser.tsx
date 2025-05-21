import { useForm } from "@tanstack/react-form";
import { useSubMenuStore } from "@/stores/store";
import supabase from "../supabase";
import {
  CEORolesList,
  COORolesList,
  RoleRank,
  RolesList,
} from "../Reusables/roleRanks";
import { message } from "@tauri-apps/plugin-dialog";
import { Label } from "@/components/ui/shadcnComponents/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
import { useSuspenseQuery } from "@tanstack/react-query";
import UserView, { Role } from "../Reusables/userView";

// Fetch CWA Employee Name
const fetchEmployeeName = async (id: number) => {
  const { data } = await supabase
    .from("app_users")
    .select("*")
    .eq("id", id)
    .single();
  return data;
};
const EmployeeName = (id: number) => {
  return useSuspenseQuery({
    queryKey: ["employee-name"],
    queryFn: () => fetchEmployeeName(id),
  });
};

interface PromoteInterface {
  userID: number;
}

export const PromoteUser = (props: PromoteInterface) => {
  const { resetPromote } = useSubMenuStore();
  const { data, error } = EmployeeName(props.userID);
  if (error) {
    console.log(
      "Error fetching selected Employee name. For more info:",
      error.message
    );
  }

  const handleReset = () => {
    form.reset();
    resetPromote();
  };

  const form = useForm({
    defaultValues: {
      Role: "",
    },
    onSubmit: async ({ value }) => {
      console.log(value);

      const rank = await RoleRank(value.Role);
      const { error } = await supabase
        .from("app_users")
        .update({ role: value.Role, role_rank: rank })
        .eq("id", props.userID);
      if (error) {
        await message(error.message, {
          title: "Error Promoting User",
          kind: "error",
        });
      } else {
        await message(`Successfully Promoted User to ${value.Role}!`, {
          title: "User Promoted!",
          kind: "info",
          okLabel: "Close",
        });
      }

      // Reset Form and State
      handleReset();
    },
  });

  return (
    <>
      <div className="mb-2">
        <h3>
          Promote {data?.username}
          <button
            type="button"
            onClick={handleReset}
            className="bg-red-800/50 rounded-xl text-[14px] p-1 px-2 hover:bg-red-800/30 float-right"
          >
            Cancel
          </button>
        </h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          {/* Role */}
          <form.Field
            name="Role"
            children={(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name} className="text-red-200">
                  Role
                </Label>
                <Select
                  value={field.state.value}
                  onValueChange={(value) => field.handleChange(value)}
                >
                  <SelectTrigger
                    className="bg-black/40 border-red-950/30 
                            text-red-200 focus:border-red-700 
                            focus:ring-2 focus:ring-red-900/50"
                  >
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <UserView
                    userRole={[
                      Role.Client,
                      Role.Intern,
                      Role.Member,
                      Role.UIDesigner,
                      Role.SoftwareDev,
                      Role.MechEngineer,
                      Role.Recruiter,
                      Role.AiDev,
                      Role.DBAdmin,
                      Role.AccManager,
                      Role.DataScientist,
                      Role.ProjectManager,
                      Role.Marketing,
                      Role.CustomerSupport,
                      Role.Admin,
                      Role.SecurityEngineer,
                      Role.Partner
                    ]}
                  >
                    <SelectContent
                      className="bg-black/95 border-red-950/30 
                            text-red-200"
                    >
                      {RolesList.map((role : string) => (
                        <SelectItem
                          key={role}
                          value={role}
                          className="text-red-200 
                                hover:bg-red-950/30 focus:bg-red-950/40"
                        >
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </UserView>

                  {/* Let COO have power to promote anyone to any role */}
                  <UserView userRole={"COO"}>
                    <SelectContent
                      className="bg-black/95 border-red-950/30 
                            text-red-200"
                    >
                      {COORolesList.map((role) => (
                        <SelectItem
                          key={role}
                          value={role}
                          className="text-red-200 
                                hover:bg-red-950/30 focus:bg-red-950/40"
                        >
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </UserView>

                  {/* Let CEO have power to promote anyone to any role */}
                  <UserView userRole={"CEO"}>
                    <SelectContent
                      className="bg-black/95 border-red-950/30 
                            text-red-200"
                    >
                      {CEORolesList.map((role) => (
                        <SelectItem
                          key={role}
                          value={role}
                          className="text-red-200 
                                hover:bg-red-950/30 focus:bg-red-950/40"
                        >
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </UserView>
                </Select>
              </div>
            )}
          />

          <br />
          <form.Subscribe
            selector={(state) => [state.canSubmit]}
            children={([canSubmit]) => (
              <button
                type="submit"
                disabled={!canSubmit}
                className="bg-red-800/50 rounded-xl p-1 px-2 hover:bg-red-800/30"
              >
                Promote/Demote
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};
