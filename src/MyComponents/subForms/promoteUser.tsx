import { useForm } from "@tanstack/react-form";
import { useSubMenuStore } from "@/stores/store";
import { takeOversupabase } from "../supabase";
import { message } from "@tauri-apps/plugin-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
import { useSuspenseQuery } from "@tanstack/react-query";
import UserView, { Role } from "../Reusables/userView";
import {
  CEORolesList,
  COORolesList,
  getRoleRank,
  RoleList,
} from "../Reusables/roleRanks";
import { Shield, X } from "lucide-react";

const fetchEmployeeName = async (id: number) => {
  const { data } = await takeOversupabase    .from("app_users")
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
    console.log("Error fetching selected Employee name:", error.message);
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
      const rank = getRoleRank(value.Role);
      const { error } = await takeOversupabase
  .from("app_users")
        .update({ role: value.Role, role_rank: rank })
        .eq("id", props.userID);
      if (error) {
        await message(error.message, { title: "Error Promoting User", kind: "error" });
      } else {
        await message(`Successfully updated ${data?.username} to ${value.Role}`, {
          title: "Role Updated",
          kind: "info",
          okLabel: "Close",
        });
      }
      handleReset();
    },
  });

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-sm bg-amber-500/[0.06]">
            <Shield className="h-3.5 w-3.5 text-amber-400/70" />
          </div>
          <div>
            <span className="text-[12px] text-foreground/60 font-medium">
              Change role for{" "}
              <span className="text-foreground/80">{data?.username}</span>
            </span>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-muted/50 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="flex items-center gap-3 px-5 py-3"
      >
        <form.Field
          name="Role"
          children={(field) => (
            <div className="flex-1">
              <Select
                value={field.state.value}
                onValueChange={(value) => field.handleChange(value)}
              >
                <SelectTrigger className="bg-muted/30 border-border text-foreground/60 rounded-sm text-[12px] h-8 focus:border-primary/20">
                  <SelectValue placeholder="Select new role" />
                </SelectTrigger>

                {/* Regular users */}
                <UserView
                  userRole={[
                    Role.Client, Role.Intern, Role.Member, Role.UIDesigner,
                    Role.SoftwareDev, Role.MechEngineer, Role.Recruiter,
                    Role.AiDev, Role.DBAdmin, Role.AccManager, Role.DataScientist,
                    Role.ProjectManager, Role.Marketing, Role.CustomerSupport,
                    Role.Admin, Role.SecurityEngineer, Role.Partner,
                  ]}
                >
                  <SelectContent className="bg-card border-border text-foreground/60 rounded-sm">
                    {RoleList.map((role: string) => (
                      <SelectItem key={role} value={role} className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-sm text-[12px]">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UserView>

                {/* COO */}
                <UserView userRole={"COO"}>
                  <SelectContent className="bg-card border-border text-foreground/60 rounded-sm">
                    {COORolesList.map((role) => (
                      <SelectItem key={role} value={role} className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-sm text-[12px]">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UserView>

                {/* CEO */}
                <UserView userRole={"CEO"}>
                  <SelectContent className="bg-card border-border text-foreground/60 rounded-sm">
                    {CEORolesList.map((role) => (
                      <SelectItem key={role} value={role} className="text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 rounded-sm text-[12px]">
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </UserView>
              </Select>
            </div>
          )}
        />

        <form.Subscribe
          selector={(state) => [state.canSubmit]}
          children={([canSubmit]) => (
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-1.5 bg-primary hover:bg-primary/80 text-primary-foreground text-[11px] font-medium rounded-sm h-8
                disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Update Role
            </button>
          )}
        />
      </form>
    </div>
  );
};
