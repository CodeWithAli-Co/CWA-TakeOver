import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { invoke } from "@tauri-apps/api/core";
import { getActiveCompanyLabel } from "@/stores/query";
import { motion } from "framer-motion";
import { Clock, FolderClosed, Plus, Tags } from "lucide-react";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Button } from "@/components/ui/shadcnComponents/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/shadcnComponents/radio-group";
import { message } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";

export const AddData = () => {
  const [open, setOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      platformName: "",
      folder: "default",
      Username: "",
      Email: "",
      Password: "",
      AddInfo: "",
      Active: "true",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      const encPassword = invoke("encrypt", {
        keyStr: import.meta.env.VITE_ENCRYPTION_KEY,
        plaintext: value.Password,
      });
      encPassword.then(async (res) => {
        const { error } = await supabase.from("cwa_creds").insert({
          platform_name: value.platformName,
          acc_username: value.Username,
          acc_email: value.Email,
          acc_enc_password: res,
          acc_addinfo: value.AddInfo,
          active: value.Active,
          folder: value.folder,
          company: getActiveCompanyLabel(),
        });
        if (error) {
          await message(error.message, {
            title: "Error Adding Account",
            kind: "error",
          });
        }
      });

      setOpen(false);
      form.reset();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Button
            size={"default"}
            className="relative bg-gradient-to-r rounded-xs from-red-950/10 via-red-950 to-red-950/20 hover:from-red-950/5 hover:via-red-950 to:red-950/10  w-auto h-auto px-4 py-2 transform transition-all ease-out border border-primary/20 group   duration-300"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Account
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderClosed className="h-4 w-4 text-primary" />
            Add New Account
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Add a new Account. Fill in the Account Details below.
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
            {/* Platform Name */}
            <form.Field
              name="platformName"
              children={(field) => (
                <div className="grid gap-2">
                  <Label
                    htmlFor={field.name}
                    className="text-foreground/70 flex items-center gap-2"
                  >
                    <Tags className="w-4 h-4 text-primary" />
                    Platform Name
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    required
                    placeholder="Enter Platform Name"
                    className="bg-background/40 border-border text-foreground/70 
                    focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                    transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Folder Name */}
            <form.Field
              name="folder"
              children={(field) => (
                <div className="grid gap-2">
                  <Label
                    htmlFor={field.name}
                    className="text-foreground/70 flex items-center gap-2"
                  >
                    <FolderClosed className="w-4 h-4 text-primary" />
                    Folder Name
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Enter Platform Name"
                    className={`bg-background/40 border-border ${field.state.value === "default" ? "text-muted-foreground" : "text-foreground/70"} 
                    focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                    transition-all duration-300 capitalize`}
                    value={field.state.value}
                    onChange={(e) =>
                      field.handleChange(e.target.value.toLocaleLowerCase())
                    }
                  />
                </div>
              )}
            />

            {/* Username */}
            <form.Field
              name="Username"
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name} className="text-foreground/70">
                    Username
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Enter Username"
                    className="bg-background/40 inline border-border text-foreground/70 
                  focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                  transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Email */}
            <form.Field
              name="Email"
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name} className="text-foreground/70">
                    Email
                  </Label>
                  <Input
                    id={field.name}
                    type="email"
                    autoComplete="off"
                    placeholder="Enter Email"
                    className="bg-background/40 inline border-border text-foreground/70 
                  focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                  transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Password */}
            <form.Field
              name="Password"
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name} className="text-foreground/70">
                    Password
                  </Label>
                  <Input
                    id={field.name}
                    type="password"
                    required
                    autoComplete="off"
                    placeholder="Enter Password"
                    className="bg-background/40 inline border-border text-foreground/70 
                  focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                  transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Additional Info */}
            <form.Field
              name="AddInfo"
              children={(field) => (
                <div className="grid gap-2">
                  <Label htmlFor={field.name} className="text-foreground/70">
                    Additional Info
                  </Label>
                  <Input
                    id={field.name}
                    type="text"
                    autoComplete="off"
                    placeholder="Add Additional Info"
                    className="bg-background/40 inline border-border text-foreground/70 
                  focus:border-primary/30 focus:ring-2 focus:ring-primary/20 
                  transition-all duration-300"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Status Field */}
            <form.Field
              name="Active"
              children={(field) => (
                <div className="space-y-2">
                  <Label className="text-foreground/70">Status</Label>
                  <RadioGroup
                    defaultValue="true"
                    onValueChange={(value) => field.handleChange(value)}
                    className="flex space-x-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="true"
                        id="active"
                        className="text-primary border-border"
                      />
                      <Label htmlFor="active" className="text-foreground/70">
                        Active
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem
                        value="false"
                        id="inactive"
                        className="text-primary border-border"
                      />
                      <Label htmlFor="inactive" className="text-foreground/70">
                        Inactive
                      </Label>
                    </div>
                  </RadioGroup>
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
              className="border-primary/15 text-primary-foreground/70 
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
                  text-primary-foreground border border-primary/15 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-300 
                  hover:scale-[1.02] active:scale-[0.98]"
                >
                  Add Account
                </Button>
              )}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
