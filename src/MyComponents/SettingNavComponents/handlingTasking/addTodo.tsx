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
import Capitalize from "@/MyComponents/capitalize";
import { MultiSelectField, Option } from "@/MyComponents/multiselectField";
import supabase from "@/MyComponents/supabase";
import { useMultiSelectStore } from "@/stores/store";
import { useForm } from "@tanstack/react-form";
import { message } from "@tauri-apps/plugin-dialog";
import { PlusCircle } from "lucide-react";
import { useState } from "react";

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
      deadline: "-",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      console.log(newOption)
      console.log(newOption[0])
      if (newOption[0] === "" || newOption[0] === null || newOption[0] === undefined) {
        await message(
          "Please Select atleast 1 person to assign task to. ( Could be yourself as well )",
          { title: "Error Adding Todo", kind: "error" }
        );
      } else {
        if (value.priority === "low") {
          const { error } = await supabase.from("cwa_todos").insert({
            title: value.title,
            description: value.description,
            label: value.label,
            status: value.status,
            priority: value.priority,
            priorityOrder: 1,
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
        } else if (value.priority === "medium") {
          const { error } = await supabase.from("cwa_todos").insert({
            title: value.title,
            description: value.description,
            label: value.label,
            status: value.status,
            priority: value.priority,
            priorityOrder: 2,
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
        } else if (value.priority === "high") {
          const { error } = await supabase.from("cwa_todos").insert({
            title: value.title,
            description: value.description,
            label: value.label,
            status: value.status,
            priority: value.priority,
            priorityOrder: 3,
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
        }
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                   text-white border border-red-800/30 shadow-lg shadow-red-950/20"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-black/95 border-red-950/30">
        <DialogHeader>
          <DialogTitle className="text-red-200">Create New Task</DialogTitle>
          <DialogDescription className="text-red-200/60">
            Add a new task to your project. Fill in the task details below.
          </DialogDescription>
        </DialogHeader>
        {/* form -> prob remove first div */}
        <div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
          >
            <div className="grid gap-4 py-4">
              <form.Field
                name="title"
                children={(field) => {
                  return (
                    <div className="grid gap-2">
                      <label htmlFor={field.name} className="text-red-200">
                        Title
                      </label>
                      <input
                        name={field.name}
                        type="text"
                        autoComplete="off"
                        required
                        placeholder="Task title"
                        className="bg-black/40 border-red-950/30 text-red-200"
                        value={field.state.value}
                        onChange={(e) =>
                          field.handleChange(Capitalize(e.target.value))
                        }
                      />
                    </div>
                  );
                }}
              />
              <form.Field
                name="description"
                children={(field) => {
                  return (
                    <div className="grid gap-2">
                      <label htmlFor={field.name} className="text-red-200">
                        Description
                      </label>
                      <input
                        name={field.name}
                        type="text"
                        autoComplete="off"
                        placeholder="Task description"
                        className="bg-black/40 border-red-950/30 text-red-200"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  );
                }}
              />
              <form.Field
                name="label"
                children={(field) => {
                  return (
                    <div className="grid gap-2">
                      <label htmlFor={field.name} className="text-red-200">
                        Label
                      </label>
                      <select
                        name={field.name}
                        className="bg-black/40 border-red-950/30 text-red-200"
                        defaultValue="Personal"
                        onChange={(e) => field.handleChange(e.target.value)}
                      >
                        <option value="Personal" className="text-red-200">
                          Personal
                        </option>
                        <option value="Global" className="text-red-200">
                          Global
                        </option>
                        <option value="Intern" className="text-red-200">
                          Intern
                        </option>
                        <option
                          value="Marketing Specialist"
                          className="text-red-200"
                        >
                          Marketing Specialist
                        </option>
                        <option value="Admin" className="text-red-200">
                          Admin
                        </option>
                        <option
                          value="Project Manager"
                          className="text-red-200"
                        >
                          Project Manager
                        </option>
                        <option value="COO" className="text-red-200">
                          COO
                        </option>
                        <option value="CEO" className="text-red-200">
                          CEO
                        </option>
                      </select>
                    </div>
                  );
                }}
              />
              <form.Field
                name="status"
                children={(field) => {
                  return (
                    <div className="grid gap-2">
                      <label htmlFor={field.name} className="text-red-200">
                        Status
                      </label>
                      <select
                        name={field.name}
                        className="bg-black/40 border-red-950/30 text-red-200"
                        defaultValue="to-do"
                        onChange={(e) => field.handleChange(e.target.value)}
                      >
                        <option value="to-do" className="text-red-200">
                          To-Do
                        </option>
                        <option value="in-progress" className="text-red-200">
                          In-Progress
                        </option>
                        <option value="done" className="text-red-200">
                          Done
                        </option>
                      </select>
                    </div>
                  );
                }}
              />
              <form.Field
                name="priority"
                children={(field) => {
                  return (
                    <div className="grid gap-2">
                      <label htmlFor={field.name} className="text-red-200">
                        Priority
                      </label>
                      <select
                        name={field.name}
                        className="bg-black/40 border-red-950/30 text-red-200"
                        defaultValue="low"
                        onChange={(e) => field.handleChange(e.target.value)}
                      >
                        <option value="low" className="text-red-200">
                          Low
                        </option>
                        <option value="medium" className="text-red-200">
                          Medium
                        </option>
                        <option value="high" className="text-red-200">
                          High
                        </option>
                      </select>
                    </div>
                  );
                }}
              />

              <MultiSelectField name="Assign To" options={dynamicOptions} />

              <form.Field
                name="deadline"
                children={(field) => {
                  return (
                    <div className="grid gap-2">
                      <label htmlFor={field.name} className="text-red-200">
                        Deadline
                      </label>
                      <input
                        name={field.name}
                        type="date"
                        className="bg-gray-500/10 border-red-950/30 text-red-200"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  );
                }}
              />
            </div>
            <DialogFooter>
              <form.Subscribe
                selector={(state) => [state.canSubmit]}
                children={([canSubmit]) => (
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-red-950 to-red-900 hover:from-red-900 hover:to-red-800
                  text-white border border-red-800/30"
                    disabled={!canSubmit}
                  >
                    Create Task
                  </button>
                )}
              />
            </DialogFooter>
          </form>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setOpen(false);
            form.reset();
          }}
          className="border-red-800/30 text-red-200 hover:bg-red-950/20 hover:text-red-100"
        >
          Cancel
        </Button>
      </DialogContent>
    </Dialog>
  );
};
