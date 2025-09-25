import { useForm } from "@tanstack/react-form";

import { useState } from "react";
import { useAppStore } from "@/stores/store";
import supabase from "../supabase";
import { message } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/shadcnComponents/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcnComponents/select";
import { Label } from "@/components/ui/shadcnComponents/Label";

export const SignUpPage = () => {
  const { setIsLoggedIn } = useAppStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // const { data: role, isLoading, error: roleError } = useQuery({
  //   queryKey: ["getrole"],
  //   queryFn: fetchData,
  //   refetchInterval: 5000
  // });

  const handleLogIn = () => {
    setIsLoggedIn("false"); // Indicate that user should go back to login
  };

  const form = useForm({
    defaultValues: {
      username: "-",
      email: "",
      password: "",
      retypepassword: "",
      position: "Employee",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      // Need to Insert data into app_users table

      // Check if passwords match or not
      if (value.password !== value.retypepassword) {
        setErrorMessage("Passwords do not match");
        console.log("Passwords do not match");
        return;
      }
      let { data, error } = await supabase.auth.signUp({
        email: value.email,
        password: value.password,
      });

      if (error) return await message(error.message, { title: 'Error Signing Up', kind: "error" });


      if (value.position === "Employee") {
        const { error } = await supabase.from("app_users").insert({
          username: value.username,
          email: value.email,
          supa_id: data.user?.id,
        });
        if (error)
          return console.log("Signing Employee up Error:", error.message);
      } else if (value.position === "Intern") {
        const { error } = await supabase.from("interns").insert({
          username: value.username,
          email: value.email,
          supa_id: data.user?.id,
        });
        if (error)
          return console.log("Signing Intern up Error:", error.message);
      }

      // add delay for email to reach user
      // ill shorten the time for the email to reach the user sooner by removing the line entirely
      // await new Promise((r) => setTimeout(r, 10000));
      setIsLoggedIn("false"); // Go to login page
    },
  });

  return (
    
      <div className="min-h-screen w-full flex justify-center items-center  bg-gradient-to-br from-red-950/20 via-red-950/70 to-red-950/20">
      <div className="w-[400px]  p-8 rounded-lg flex flex-col items-center border bg-black border-white">
        <h3 className="text-2xl text-amber-50 mb-12">Sign Up</h3>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
        
          <div className="w-[300px] ">
            {/* Email Field */}
            <form.Field
              name="email"
           
              children={(field) => (
                <div className="w-full group ">
                  <Label
                    className="text-amber-50 block mb-2"
                    htmlFor={field.name}
                  >
                    Email:
                  </Label>
                  
                  <Input
                    name={field.name}
                    type="email"
                    placeholder="john@gmail.com"
                    className="w-full p-0  text-amber-50  border-zinc-900 
                             focus:border-red-900 pl-3 focus:bg-zinc-950/10 focus:rounded-lg 
                             hover:bg-zinc-950/10 hover:border-red-950 hover:rounded-lg hover:border-none"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />
            <br />
            {/* Password Field */}
            <form.Field
              name="password"
              children={(field) => (
                <div className="w-full group  ">
                  <Label
                    className="text-amber-50 block mb-2"
                    htmlFor={field.name}
                  >
                    Password:
                  </Label>
                  <Input
                    name={field.name}
                    type="password"
                    placeholder="Enter Password..."
                    className="w-full p-0 bg-transparent text-amber-50  border-zinc-900 mb-4
                             focus:border-red-900 pl-3 focus:bg-zinc-950/10 focus:rounded-lg 
                             hover:bg-zinc-950/10 hover:border-red-950 hover:rounded-lg hover:border-none"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Retype Password Field */}
          <form.Field
            name="retypepassword"
            children={(field) => (
              <div className="w-full group ">
                <Label className="text-amber-50 block mb-2" htmlFor={field.name}>
                  Retype Password:
                </Label>
                <Input
                  name={field.name}
                  type="password"
                  placeholder="Re-enter Password..."
                  className="w-full p-0  text-amber-50  border-zinc-900 
                           focus:border-red-900 pl-3 focus:bg-zinc-950/10 focus:rounded-lg 
                           hover:bg-zinc-950/10 hover:border-red-950 hover:rounded-lg hover:border-none"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
                {/* Show error message below Retype Password field */}
                {form.getFieldValue("password") !== form.getFieldValue("retypepassword") &&
                  form.getFieldValue("retypepassword").length > 0 && (
                    <p className="text-red-900 mt-2">Passwords do not match!</p>
                  )}
              </div>
            )}
          />

            <br />
            <form.Field
              name="position"
              children={(field) => (
                <div className="flex flex-col justify-center w-full">
                  <Label className="mb-1 block font-bold ">Role</Label>
                  <Select name={field.name}>
                    <SelectTrigger className="border border-zinc-900">
                      <SelectValue placeholder= "Select Role"/>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Employee">Employee</SelectItem>
                      <SelectItem value="Intern">Intern</SelectItem>
                    </SelectContent>
                  </Select>
                  {/* <select
                    name={field.name}
                    className="w-full p-2  text-amber-50 bg-transparent  border-zinc-900
                             focus:border-red-900 pl-3 focus:bg-zinc-950/10 focus:rounded-lg 
                             hover:bg-zinc-950/10 hover:border-red-950 hover:rounded-lg hover:border-none
                              cursor-pointer appearance-none"
                    onChange={(e) => field.handleChange(e.target.value)}
                  >
                    <option value="Employee" className="bg-gray-800 text-amber-50">
                      Employee
                    </option>
                    <option value="Intern" className="bg-gray-800 text-amber-50">
                      Intern
                    </option>
                  </select> */}
                </div>
              )}
            />
            <br />
          </div>
          <div className="flex flex-col items-center w-full space-y-4">
            <form.Subscribe
              selector={(state) => [state.canSubmit]}
              children={([canSubmit]) => (
                <Button type="submit" className="w-full bg-red-950 hover:bg-red-950" disabled={!canSubmit}>
                  Submit
                </Button>
              )}
            />
         
             {/* Sign Up Button */}
        <div className="mt-4 text-center">
        <p>Already have an account?</p>
        <Button
          // goes to the above function, pretty simple right?
          onClick={handleLogIn}
         className="mt-2 w-full bg-blue-950 hover:bg-blue-950/20 px-0"
        >
          Log In
        </Button>
      </div>
          
      </div>
        </form>
      </div>
    </div>
  // throw new Error("Function not implemented.");
  );

};
