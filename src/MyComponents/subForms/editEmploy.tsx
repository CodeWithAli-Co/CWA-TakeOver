import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { useAppStore } from "@/stores/store";
import { UserPlus, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface Props {
  rowID: number;
}

export const EditEmployee = (props: Props) => {
  const { setDialog } = useAppStore();
  const handleClose = () => {
    setDialog("closed");
    form.reset();
  };

  const form = useForm({
    defaultValues: {
      Username: "",
      Email: "",
    },
    onSubmit: async ({ value }) => {
      if (value.Username !== "") {
        const { error } = await takeOversupabase
    .from("app_users")
          .update({ username: value.Username })
          .eq("id", props.rowID);
        if (error) return console.log("Username Error:", error.message);
      }

      if (value.Email !== "") {
        const { error } = await takeOversupabase
    .from("app_users")
          .update({ email: value.Email })
          .eq("id", props.rowID);
        if (error) return console.log("Email Error:", error.message);
      }

      handleClose();
    },
  });

  return (
    <AnimatePresence mode="wait">
      <motion.div
        className="fixed inset-0 flex items-center justify-center z-50 bg-background/70 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-card border border-border rounded-sm shadow-2xl shadow-black/50">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-[15px] font-semibold text-foreground">Edit User</h2>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-sm text-muted-foreground/60 hover:text-muted-foreground/80 hover:bg-muted/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
                }}
                className="space-y-5"
              >
                <form.Field
                  name="Username"
                  children={(field) => (
                    <div className="space-y-2">
                      <label
                        className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.12em] font-medium"
                        htmlFor={field.name}
                      >
                        Username
                      </label>
                      <input
                        name={field.name}
                        type="text"
                        autoComplete="off"
                        placeholder="Enter username"
                        className="w-full px-3.5 py-2.5 bg-muted/30 border border-border text-foreground/80 rounded-sm text-[13px]
                           placeholder:text-muted-foreground/40 focus:border-primary/20 focus:outline-none transition-colors"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                />

                <form.Field
                  name="Email"
                  children={(field) => (
                    <div className="space-y-2">
                      <label
                        className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.12em] font-medium"
                        htmlFor={field.name}
                      >
                        Email
                      </label>
                      <input
                        name={field.name}
                        type="email"
                        autoComplete="off"
                        placeholder="Enter email"
                        className="w-full px-3.5 py-2.5 bg-muted/30 border border-border text-foreground/80 rounded-sm text-[13px]
                           placeholder:text-muted-foreground/40 focus:border-primary/20 focus:outline-none transition-colors"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </div>
                  )}
                />

                <form.Subscribe
                  selector={(state) => [state.canSubmit]}
                  children={([canSubmit]) => (
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full py-2.5 bg-primary hover:bg-primary/80 text-primary-foreground text-[13px] font-medium rounded-sm
                        disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Save Changes
                    </button>
                  )}
                />
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
