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

export const EditIntern = (props: Props) => {
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
          .from("interns")
          .update({ username: value.Username })
          .eq("id", props.rowID);
        if (error) return console.log("Username Error:", error.message);
      }

      if (value.Email !== "") {
        const { error } = await supabase
          .from("interns")
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
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]"
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
          <Card className="bg-[#0a0a0a] border border-white/[0.08] rounded-sm shadow-2xl shadow-black/50">
            <CardHeader className="relative border-b border-white/[0.04] px-6 py-4">
              <button
                onClick={handleClose}
                className="absolute right-3 top-3 p-1.5 rounded-sm text-white/30 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <CardTitle className="text-[15px] font-semibold text-white/90 tracking-tight">
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
                      shadow-lg shadow-red-950/20 disabled:opacity-50"
                      disabled={!canSubmit}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      Edit Intern
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
