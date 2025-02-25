import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import Capitalize from "@/MyComponents/capitalize";
import { MultiSelectField, Option } from "@/MyComponents/multiselectField";
import supabase from "@/MyComponents/supabase";
import { useMultiSelectStore } from "@/stores/store";
import { useForm } from "@tanstack/react-form";
import { message } from "@tauri-apps/plugin-dialog";
import { PlusCircle, Flame, Clock, Tags } from "lucide-react";
import { useState } from "react";
import React from "react";

interface Users {
  Users: any;
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
        high: 3
      };

      try {
        const { error } = await supabase.from("cwa_todos").insert({
          title: value.title,
          description: value.description,
          label: value.label,
          status: value.status,
          priority: value.priority,
          priorityOrder: priorityOrderMap[value.priority as keyof typeof priorityOrderMap],
          assignee: newOption,
          deadline: value.deadline,
        });

        if (error) {
          await message(error.message, {
            title: "Error Adding Task",
            kind: "error",
          });
        } else {
          setOpen(false);
          form.reset();
          await message("Adding Todo was Successful!", {
            title: "Todo Added",
            kind: "info",
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
          className="group relative overflow-hidden bg-gradient-to-r from-red-950 to-red-900 
          hover:from-red-900 hover:to-red-800 text-white border border-red-800/30 
          shadow-lg shadow-red-950/20 transition-all duration-300 
          hover:scale-[1.02] active:scale-[0.98]"
        >
          <span className="absolute inset-0 bg-red-700/10 opacity-0 group-hover:opacity-20 transition-opacity"></span>
          <PlusCircle className="h-4 w-4 mr-2 transition-transform group-hover:rotate-90" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent 
        className="sm:max-w-[600px] bg-black/95 border-red-950/30 
        shadow-2xl shadow-red-950/40 rounded-xl overflow-hidden"
      >
        <DialogHeader>
          <DialogTitle className="text-red-200 flex items-center gap-2">
            <Flame className="w-6 h-6 text-red-500" />
            Create New Task
          </DialogTitle>
          <DialogDescription className="text-red-200/60 flex items-center gap-2">
            <Clock className="w-4 h-4 text-red-400" />
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
                  <Label htmlFor={field.name} className="text-red-200 flex items-center gap-2">
                    <Tags className="w-4 h-4 text-red-400" />
                    Title
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="Task title"
                    className="bg-black/40 border-red-950/30 text-red-200 
                    focus:border-red-700 focus:ring-2 focus:ring-red-900/50 
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
                  <Label htmlFor={field.name} className="text-red-200">
                    Description
                  </Label>
                  <Textarea
                    id={field.name}
                    placeholder="Task description"
                    className="bg-black/40 border-red-950/30 text-red-200 
                    min-h-[100px] focus:border-red-700 focus:ring-2 
                    focus:ring-red-900/50 transition-all duration-300"
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
                    <Label htmlFor={field.name} className="text-red-200">
                      Label
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
                        <SelectValue placeholder="Select label" />
                      </SelectTrigger>
                      <SelectContent 
                        className="bg-black/95 border-red-950/30 
                        text-red-200"
                      >
                        {["Personal", "Global", "Intern", "Marketing Specialist", 
                          "Admin", "Project Manager", "COO", "CEO"].map((label) => (
                          <SelectItem 
                            key={label} 
                            value={label} 
                            className="text-red-200 
                            hover:bg-red-950/30 focus:bg-red-950/40"
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
                        <Label htmlFor={field.name} className="text-red-200">
                          Status
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
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent 
                            className="bg-black/95 border-red-950/30 
                            text-red-200"
                          >
                            {["to-do", "in-progress", "done"].map((status) => (
                              <SelectItem 
                                key={status} 
                                value={status} 
                                className="text-red-200 
                                hover:bg-red-950/30 focus:bg-red-950/40"
                              >
                                {status === "to-do" ? "To Do" : 
                                status === "in-progress" ? "In Progress" : "Done"}
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
                    <Label htmlFor={field.name} className="text-red-200">
                      Priority
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
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent 
                        className="bg-black/95 border-red-950/30 
                        text-red-200"
                      >
                        {["low", "medium", "high"].map((priority) => (
                          <SelectItem 
                            key={priority} 
                            value={priority} 
                            className="text-red-200 
                            hover:bg-red-950/30 focus:bg-red-950/40"
                          >
                            {priority.charAt(0).toUpperCase() + priority.slice(1)}
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
                  <Label htmlFor={field.name} className="text-red-200">
                    Deadline
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Deadline (e.g. 3 days)"
                    className="bg-black/40 border-red-950/30 text-red-200 
                    focus:border-red-700 focus:ring-2 focus:ring-red-900/50 
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
              className="border-red-800/30 text-red-200 
              hover:bg-red-950/20 hover:text-red-100 
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
                  className="bg-gradient-to-r from-red-950 to-red-900 
                  hover:from-red-900 hover:to-red-800 
                  text-white border border-red-800/30 
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