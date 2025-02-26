import React from "react";
import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { invoke } from "@tauri-apps/api/core";
import { useAppStore } from "@/stores/store";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Button } from "@/components/ui/shadcnComponents/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/shadcnComponents/radio-group";

export const AddData = () => {
  const { setDialog } = useAppStore();

  const form = useForm({
    defaultValues: {
      platformName: "",
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
        });
        if (error) return console.log(error.message);
      });

      handleClose();
    },
  });

  const handleClose = () => {
    setDialog("closed");
    form.reset();
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="fixed inset-0 flex items-center justify-center backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          className="w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="bg-black/20 border-red-800/30  shadow-xl shadow-red-800/20">
            <CardHeader className="relative border-b border-red-950/20">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="absolute right-4 top-4 p-1 rounded-full text-red-500 
                         hover:text-red-400 hover:bg-red-950/20 transition-colors"
              >
                <X size={20} />
              </motion.button>
              <CardTitle className="text-2xl font-semibold text-white text-center">
                Add Platform
              </CardTitle>
            </CardHeader>

            <CardContent className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
                }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  {/* Platform Name Field */}
                  <form.Field
                    name="platformName"
                    children={(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name} className="text-red-200">
                          Platform Name
                        </Label>
                        <Input
                          name={field.name}
                          type="text"
                          required
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className="bg-black/40 border-red-950/30 text-white 
                                   focus:border-red-500 focus:ring-red-500/20
                                   placeholder:text-red-200/20"
                          placeholder="Enter platform name..."
                        />
                      </div>
                    )}
                  />

                  {/* Username Field */}
                  <form.Field
                    name="Username"
                    children={(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name} className="text-red-200">
                          Username
                        </Label>
                        <Input
                          name={field.name}
                          type="text"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className="bg-black/40 border-red-950/30 text-white 
                                   focus:border-red-500 focus:ring-red-500/20
                                   placeholder:text-red-200/20"
                          placeholder="Enter username..."
                        />
                      </div>
                    )}
                  />

                  {/* Email Field */}
                  <form.Field
                    name="Email"
                    children={(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name} className="text-red-200">
                          Email
                        </Label>
                        <Input
                          name={field.name}
                          type="email"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className="bg-black/40 border-red-950/30 text-white 
                                   focus:border-red-500 focus:ring-red-500/20
                                   placeholder:text-red-200/20"
                          placeholder="Enter email..."
                        />
                      </div>
                    )}
                  />

                  {/* Password Field */}
                  <form.Field
                    name="Password"
                    children={(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name} className="text-red-200">
                          Password
                        </Label>
                        <Input
                          name={field.name}
                          type="password"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className="bg-black/40 border-red-950/30 text-white 
                                   focus:border-red-500 focus:ring-red-500/20
                                   placeholder:text-red-200/20"
                          placeholder="Enter password..."
                        />
                      </div>
                    )}
                  />

                  {/* Additional Info Field */}
                  <form.Field
                    name="AddInfo"
                    children={(field) => (
                      <div className="space-y-2">
                        <Label htmlFor={field.name} className="text-red-200">
                          Additional Info
                        </Label>
                        <Input
                          name={field.name}
                          type="text"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                          className="bg-black/40 border-red-950/30 text-white 
                                   focus:border-red-500 focus:ring-red-500/20
                                   placeholder:text-red-200/20"
                          placeholder="Enter additional info..."
                        />
                      </div>
                    )}
                  />

                  {/* Status Field */}
                  <form.Field
                    name="Active"
                    children={(field) => (
                      <div className="space-y-2">
                        <Label className="text-red-200">Status</Label>
                        <RadioGroup
                          defaultValue="true"
                          onValueChange={(value) => field.handleChange(value)}
                          className="flex space-x-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="true"
                              id="active"
                              className="text-red-500 border-red-950/30"
                            />
                            <Label htmlFor="active" className="text-red-200">
                              Active
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem
                              value="false"
                              id="inactive"
                              className="text-red-500 border-red-950/30"
                            />
                            <Label htmlFor="inactive" className="text-red-200">
                              Inactive
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    )}
                  />
                </div>

                {/* Submit Button */}
                <form.Subscribe
                  selector={(state) => [state.canSubmit]}
                  children={([canSubmit]) => (
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                    >
                      <Button
                        type="submit"
                        disabled={!canSubmit}
                        className="w-full bg-gradient-to-r from-red-950 to-black hover:from-red-900 
                                 hover:to-red-950 text-white border border-red-900/30
                                 shadow-lg shadow-red-950/20 disabled:opacity-50"
                      >
                        Add Platform
                      </Button>
                    </motion.div>
                  )}
                />
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
