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
import { getActiveCompanyLabel } from "@/stores/query";
import { useForm } from "@tanstack/react-form";
import { message } from "@tauri-apps/plugin-dialog";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { PlusCircle, Flame, Clock, Tags } from "lucide-react";
import { useState } from "react";

interface Users {
  Users: any;
  homeDash?: boolean;
}

export const AddTodo = (props: Users) => {
  const [open, setOpen] = useState(false);
  const { optionsValue } = useMultiSelectStore();
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
        <Button
          className="group relative overflow-hidden bg-primary mb-2 
          hover:bg-primary/80 text-foreground border border-primary/15 
          shadow-md shadow-red-950/20 transition-all duration-300 
          hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="absolute inset-0 bg-red-700/10 opacity-0 group-hover:opacity-20 transition-opacity"></span>
          <PlusCircle className={`h-4 w-4 ${props.homeDash ? "m-0" : " mr-2"} transition-transform group-hover:rotate-90`} />
          {!props.homeDash && (
            <span>Create Task</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-primary" />
            Create New Task
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            Add a new task to your project. Fill in the task details below.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
          className="space-y-6"
        >
          <div className="grid gap-4">
            <form.Field
              name="title"
              children={(field) => (
                <div className="grid gap-2">
                  <Label
                    htmlFor={field.name}
                    className="text-foreground/70 flex items-center gap-2"
                  >
                    <Tags className="w-4 h-4 text-primary" />
                    Title
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="Task title"
                    className="bg-background/40 border-border text-foreground/70 
                    focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                    transition-all duration-300"
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
                <div className="grid gap-2">
                  <Label htmlFor={field.name} className="text-foreground/70">
                    Description
                  </Label>
                  <Textarea
                    id={field.name}
                    placeholder="Task description"
                    className="bg-background/40 border-border text-foreground/70 
                    min-h-[100px] focus:border-primary/30 focus:ring-2 
                    focus:ring-primary/20 transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            <div className="grid md:grid-cols-2 gap-4">
              <form.Field
                name="label"
                children={(field) => (
                  <div className="grid gap-2">
                    <Label htmlFor={field.name} className="text-foreground/70">
                      Label
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger
                        className="bg-background/40 border-border 
                        text-foreground/70 focus:border-primary/30 
                        focus:ring-2 focus:ring-primary/20"
                      >
                        <SelectValue placeholder="Select label" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-background/95 border-border 
                        text-foreground/70"
                      >
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
                            className="text-foreground/70 
                            hover:bg-primary/[0.12] focus:bg-primary/[0.15]"
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
                  <div className="grid gap-2">
                    <Label htmlFor={field.name} className="text-foreground/70">
                      Status
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger
                        className="bg-background/40 border-border 
                            text-foreground/70 focus:border-primary/30 
                            focus:ring-2 focus:ring-primary/20"
                      >
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-background/95 border-border 
                            text-foreground/70"
                      >
                        {["to-do", "in-progress", "done"].map((status) => (
                          <SelectItem
                            key={status}
                            value={status}
                            className="text-foreground/70 
                                hover:bg-primary/[0.12] focus:bg-primary/[0.15]"
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
                  <div className="grid gap-2">
                    <Label htmlFor={field.name} className="text-foreground/70">
                      Priority
                    </Label>
                    <Select
                      value={field.state.value}
                      onValueChange={(value) => field.handleChange(value)}
                    >
                      <SelectTrigger
                        className="bg-background/40 border-border 
                        text-foreground/70 focus:border-primary/30 
                        focus:ring-2 focus:ring-primary/20"
                      >
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent
                        className="bg-background/95 border-border 
                        text-foreground/70"
                      >
                        {["low", "medium", "high"].map((priority) => (
                          <SelectItem
                            key={priority}
                            value={priority}
                            className="text-foreground/70 
                            hover:bg-primary/[0.12] focus:bg-primary/[0.15]"
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

            <MultiSelectField name="Assign To" options={dynamicOptions} />

            <form.Field
              name="deadline"
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name} className="text-foreground/70">
                    Deadline
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Deadline (e.g. 3 days)"
                    className="bg-background/40 border-border text-foreground/70 
                    focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                    transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(Capitalize(e.target.value))
                    }
                  />
                </div>
              )}
            />
          </div>

          <DialogFooter className="flex justify-between items-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                form.reset();
              }}
              className="border-primary/15 text-foreground/70 
              hover:bg-primary/10 hover:text-foreground/80 
              transition-all duration-300"
            >
              Cancel
            </Button>
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-primary 
                  hover:bg-primary/80 
                  text-foreground border border-primary/15 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-300 
                  hover:scale-[1.02] active:scale-[0.98]"
                >
                  Create Task
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
