import { useForm } from "@tanstack/react-form";
import supabase from "../supabase";
import { useAppStore } from "@/stores/store";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcnComponents/card";
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
      console.log(value);

      if (value.Username !== "") {
        const { error } = await supabase
          .from("app_users")
          .update({ username: value.Username })
          .eq("id", props.rowID);
        if (error) return console.log("Username Error:", error.message);
      }

      if (value.Email !== "") {
        const { error } = await supabase
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
          <Card className="bg-black border-red-800/30  shadow-xl shadow-red-800/20">
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
                Edit User
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  form.handleSubmit();
                }}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <form.Field
                    name="Username"
                    children={(field) => (
                      <div className="space-y-2">
                        <label
                          className="text-amber-50/70 text-sm font-medium"
                          htmlFor={field.name}
                        >
                          Username
                        </label>
                        <input
                          name={field.name}
                          type="text"
                          id="username"
                          autoComplete="off"
                          placeholder="Enter username"
                          className="w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg
                             focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors"
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
                          className="text-amber-50/70 text-sm font-medium"
                          htmlFor={field.name}
                        >
                          Email
                        </label>
                        <input
                          name={field.name}
                          type="email"
                          id="email"
                          autoComplete="off"
                          placeholder="Enter email"
                          className="w-full px-3 py-2 bg-black/40 border border-red-900/30 text-amber-50 rounded-lg
                             focus:border-red-500 focus:outline-none hover:bg-black/60 transition-colors"
                          value={field.state.value}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </div>
                    )}
                  />
                </div>

                <form.Subscribe
                  selector={(state) => [state.canSubmit]}
                  children={([canSubmit]) => (
                    <button
                      type="submit"
                      className="w-full bg-gradient-to-r from-red-950 to-black hover:from-red-900 
                      hover:to-red-950 text-white border border-red-900/30
                      shadow-lg shadow-red-950/20 disabled:opacity-50 flex items-center justify-center py-2"
                      disabled={!canSubmit}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Edit Employee
                    </button>
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
