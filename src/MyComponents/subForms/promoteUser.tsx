import React from "react";
import { useForm } from "@tanstack/react-form";
import { useSubMenuStore } from "@/stores/store";
import supabase from "../supabase";
import { RoleRank, RolesList } from "../Reusables/roleRanks";
import { message } from "@tauri-apps/plugin-dialog";
import { Label } from "@/components/ui/shadcnComponents/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";

interface PromoteInterface {
  userID: number;
}

export const PromoteUser = (props: PromoteInterface) => {
  const { resetPromote } = useSubMenuStore();

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
        });
      }

      // Reset Form and State
      handleReset();
    },
  });

  return (
    <>
      <div>
        <h3>Promote User</h3>
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
                  <SelectContent
                    className="bg-black/95 border-red-950/30 
                            text-red-200"
                  >
                    {RolesList.map((role) => (
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
                </Select>
              </div>
            )}
          />

          <br />
          <form.Subscribe
            selector={(state) => [state.canSubmit]}
            children={([canSubmit]) => (
              <button type="submit" disabled={!canSubmit}>
                Promote/Demote
              </button>
            )}
          />
        </form>
        <button type="button" onClick={handleReset}>
          Cancel
        </button>
      </div>
    </>
  );
};
