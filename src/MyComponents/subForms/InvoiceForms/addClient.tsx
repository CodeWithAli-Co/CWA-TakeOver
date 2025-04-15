import { Button } from "@/components/ui/button";
import { useForm } from "@tanstack/react-form";
import { Loader2, Send, User } from "lucide-react";
import Database from "@tauri-apps/plugin-sql";
import Capitalize from "@/MyComponents/Reusables/capitalize";

export const AddClient = () => {
  const form = useForm({
    defaultValues: {
      clientName: "",
      clientEmail: "",
    },
    onSubmit: async ({ value }) => {
      const db = await Database.load(import.meta.env.VITE_DB_URL);
      await db.execute(
        "INSERT into clients (name, email) VALUES ($1, $2)",
        [
          value.clientName,
          value.clientEmail,
        ]
      );
      
      form.reset();
    },
  });

  return (
    <>
      <div className="p-8 md:p-10">
        <div className="grid grid-cols-1 gap-8">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            <div>
              <form.Field
                name="clientName"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-gray-400 font-medium mb-2 text-sm"
                      >
                        Client Name
                      </label>
                    {/* div - ali  Added a div for the icon to surroudn everything and to have the group functionality
                        Now Ive only changed the first client name box, I want you to replicte the same styling or even add your own tweak
                        to the email input ( use the email icon lucidd)  (The seminar continues hehehee)
                    */}
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <User size={16} className="text-red-500/50 group-hover:text-red-500 transition-colors duration-200" />
                      </div>


                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="pl-10 pr-4 py-3 w-full bg-black border border-red-900/30 rounded-md text-white 
                        focus:outline-none focus:ring-1 focus:ring-red-900/30 focus:border-red-500 
                        transition-all duration-200 placeholder:text-gray-600"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(Capitalize(e.target.value))}
                      />
                      </div>

                    </>
                  );
                }}
              />
              <br />
              <form.Field
                name="clientEmail"
                children={(field) => {
                  return (
                    <>
                      <label
                        htmlFor={field.name}
                        className="block text-red-200 font-medium mb-2"
                      >
                        Email
                      </label>
                      <input
                        name={field.name}
                        autoComplete="off"
                        required
                        className="bg-red-950/20 border-red-800/40 rounded-lg pl-2 text-white focus:border-red-600 h-12 text-base w-full"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                      />
                    </>
                  );
                }}
              />
              <br />
            </div>
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="bg-red-950/20 hover:bg-red-900/20
                text-white border border-red-700/40 shadow-lg shadow-red-950/20 px-5 py-4 text-lg font-medium ml-[65px]"
                >
                 
                
                  <div className="relative flex items-center justify-center text-gray-400 ">
                  {!canSubmit ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className=" mr-3 h-1 w-2 text-red-900" />
                      Add Client
                    </>
                  )}
                  </div>
                </Button>
              )}
            />
          </form>
        </div>
      </div>
    </>
  );
};
