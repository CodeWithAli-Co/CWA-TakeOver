import { Button } from "@/components/ui/shadcnComponents/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Label } from "@/components/ui/shadcnComponents/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcnComponents/select";
import { Textarea } from "@/components/ui/shadcnComponents/textarea";
import Capitalize from "@/MyComponents/Reusables/capitalize";
import {
  MultiSelectField,
  Option,
} from "@/MyComponents/Reusables/multiselectField";
import supabase from "@/MyComponents/supabase";
import { useMultiSelectStore } from "@/stores/store";
import { getActiveCompanyLabel, ActiveUser } from "@/stores/query";
import { useForm } from "@tanstack/react-form";
import { message } from "@tauri-apps/plugin-dialog";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

interface Users {
  Users: any;
  homeDash?: boolean;
}

export const AddTodo = (props: Users) => {
  const [open, setOpen] = useState(false);
  const { optionsValue } = useMultiSelectStore();
  // Current operator — stamped on the row as `assigned_by` so the
  // assignee (and admins) can see who delegated the task.
  const { data: currentUser } = ActiveUser();
  const assignerUsername: string | null =
    (currentUser?.[0] as { username?: string } | undefined)?.username ?? null;
  const dynamicOptions: Option[] = props.Users.map((user: any) => ({
    value: user.username,
    label: user.username,
  }));
  const newOption = optionsValue.map((newValue: any) => newValue.value);

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      label: "Personal",
      status: "to-do",
      priority: "low",
      assignee: "",
      deadline: "",
    },
    onSubmit: async ({ value }) => {
      if (
        newOption[0] === "" ||
        newOption[0] === null ||
        newOption[0] === undefined
      ) {
        await message(
          "Please Select at least 1 person to assign task to. (Could be yourself as well)",
          { title: "Error Adding Todo", kind: "error" }
        );
        return;
      }

      const priorityOrderMap = {
        low: 1,
        medium: 2,
        high: 3,
      };

      try {
        const { error } = await supabase.from("cwa_todos").insert({
          title: value.title,
          description: value.description,
          label: value.label,
          status: value.status,
          priority: value.priority,
          priorityOrder:
            priorityOrderMap[value.priority as keyof typeof priorityOrderMap],
          assignee: newOption,
          deadline: value.deadline,
          company: getActiveCompanyLabel(),
          assigned_by: assignerUsername,
        });

        if (error) {
          await message(error.message, {
            title: "Error Adding Task",
            kind: "error",
          });
        } else {
          setOpen(false);
          form.reset();
          sendNotification({
            title: "Todo Added",
            body: "Adding Todo was Successful!",
          });
        }
      } catch (err) {
        await message("An unexpected error occurred", {
          title: "Error",
          kind: "error",
        });
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {props.homeDash ? (
          // Compact icon-only toolbar variant for the dashboard header.
          // Was a solid filled red square — too loud against the rest
          // of the calm header. Now a primary-outlined ghost: faint
          // tinted bg, primary border at 20% alpha, primary plus icon
          // that rotates 90° on hover. Reads as "add" without
          // dominating the row.
          <Button
            size="icon"
            className="
              group h-7 w-7 p-0 rounded-md transition-colors
              bg-primary/[0.08] hover:bg-primary/15
              border border-primary/20 hover:border-primary/40
              text-primary
            "
            title="Create task"
          >
            <PlusCircle className="h-3.5 w-3.5 transition-transform duration-200 group-hover:rotate-90" />
          </Button>
        ) : (
          <Button
            className="group relative overflow-hidden bg-primary mb-2 hover:bg-primary/80 text-primary-foreground border border-primary/15 shadow-md shadow-red-950/20 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span className="absolute inset-0 bg-red-700/10 opacity-0 group-hover:opacity-20 transition-opacity"></span>
            <PlusCircle className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
            <span>Create Task</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="px-7 pt-5 pb-4 border-b border-xs border-border-soft">
          <DialogTitle className="text-[14px] font-semibold text-foreground">
            Create new task
          </DialogTitle>
          <DialogDescription className="text-[12px] text-text-tertiary">
            Add a task to your project — fill in what you can, leave the rest.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="px-7 pt-4 pb-5 space-y-4">
            <form.Field
              name="title"
              children={(field) => (
                <div className="grid gap-1.5">
                  <Label
                    htmlFor={field.name}
                    className="text-[12px] font-medium text-foreground"
                  >
                    Title
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="What needs to get done?"
                    className="bg-background/40 border-border text-foreground placeholder:text-text-tertiary focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(Capitalize(e.target.value))
                    }
                  />
                </div>
              )}
            />

            <form.Field
              name="description"
              children={(field) => (
                <div className="grid gap-1.5">
                  <Label htmlFor={field.name} className="text-[12px] font-medium text-foreground">
                    Description
                    <span className="ml-1 text-[10.5px] font-normal text-text-tertiary">optional</span>
                  </Label>
                  <Textarea
                    id={field.name}
                    placeholder="Context, acceptance criteria, links…"
                    className="bg-background/40 border-border text-foreground placeholder:text-text-tertiary min-h-[88px] focus:border-primary/40 focus:ring-2 focus:ring-primary/20 resize-none"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            <div className="grid md:grid-cols-3 gap-3">
              <form.Field
                name="label"
                children={(field) => (
                  <div className="grid gap-1.5">
                    <Label htmlFor={field.name} className="text-[12px] font-medium text-foreground">
                      Label
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger className="bg-background/40 border-border text-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="Personal" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        {[
                          "Personal",
                          "Global",
                          "Intern",
                          "Marketing Specialist",
                          "Admin",
                          "Project Manager",
                          "COO",
                          "CEO",
                        ].map((label) => (
                          <SelectItem
                            key={label}
                            value={label}
                            className="text-foreground/80 focus:bg-primary/10 focus:text-primary"
                          >
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              {/* status */}
              <form.Field
                name="status"
                children={(field) => (
                  <div className="grid gap-1.5">
                    <Label htmlFor={field.name} className="text-[12px] font-medium text-foreground">
                      Status
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger className="bg-background/40 border-border text-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="To Do" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        {["to-do", "in-progress", "done"].map((status) => (
                          <SelectItem
                            key={status}
                            value={status}
                            className="text-foreground/80 focus:bg-primary/10 focus:text-primary"
                          >
                            {status === "to-do"
                              ? "To Do"
                              : status === "in-progress"
                                ? "In Progress"
                                : "Done"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />

              <form.Field
                name="priority"
                children={(field) => (
                  <div className="grid gap-1.5">
                    <Label htmlFor={field.name} className="text-[12px] font-medium text-foreground">
                      Priority
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger className="bg-background/40 border-border text-foreground focus:border-primary/40 focus:ring-2 focus:ring-primary/20">
                        <SelectValue placeholder="Low" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border-border text-foreground">
                        {["low", "medium", "high"].map((priority) => (
                          <SelectItem
                            key={priority}
                            value={priority}
                            className="text-foreground/80 focus:bg-primary/10 focus:text-primary"
                          >
                            {priority.charAt(0).toUpperCase() +
                              priority.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-3">
              <MultiSelectField name="Assign to" options={dynamicOptions} />

              <form.Field
                name="deadline"
                children={(field) => (
                  <div className="grid gap-1.5">
                    <Label htmlFor={field.name} className="text-[12px] font-medium text-foreground">
                      Deadline
                      <span className="ml-1 text-[10.5px] font-normal text-text-tertiary">optional</span>
                    </Label>
                    <Input
                      id={field.name}
                      type="text"
                      autoComplete="off"
                      placeholder="e.g. 3 days"
                      className="bg-background/40 border-border text-foreground placeholder:text-text-tertiary focus:border-primary/40 focus:ring-2 focus:ring-primary/20"
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(Capitalize(e.target.value))
                      }
                    />
                  </div>
                )}
              />
            </div>
          </div>

          <DialogFooter className="px-7 py-4 border-t border-xs border-border-soft bg-popover/30 flex justify-end items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                form.reset();
              }}
              className="text-text-secondary hover:text-foreground hover:bg-foreground/[0.05] h-8 px-3 text-[12px] font-medium"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed h-8 px-3 text-[12px] font-semibold"
                >
                  Create task
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
