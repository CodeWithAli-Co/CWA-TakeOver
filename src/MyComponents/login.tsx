import React from "react";
import { useForm } from "@tanstack/react-form";
import { useAppStore } from "../stores/store";
import { useRouter } from "@tanstack/react-router"; // Correct usage
import supabase from "./supabase";
import { SignUpPage } from "@/MyComponents/signup";
import cwa_logo_full from "../assets/codewithali_logo.png"; // Add this line to import the logo

export const LoginPage = () => {
  const { setIsLoggedIn } = useAppStore();
  // const router = useRouter(); // Initialize router

  // Check if user is logged in 
  // without this the redirect wont work
  const handleSignUp = () => {
    setIsLoggedIn("makeAcc"); // Indicate that user is signing up
  };

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      let { data, error } = await supabase.auth.signInWithPassword({
        email: value.email,
        password: value.password,
      });

      const { data: verify } = await supabase.auth.getUserIdentities();

      if (
        data.user?.role === "authenticated" &&
        verify?.identities[0].identity_data!.email_verified
      ) {
        setIsLoggedIn("true");
        localStorage.setItem("isLoggedIn", "true");
      }

      if (error?.message === "Invalid login credentials") {
        setIsLoggedIn("makeAcc");
      }
    },
  });

  return (
    <div className="min-h-screen w-full flex justify-center items-center bg-red-550">
      <div className="w-96 p-8 bg-gradient-to-b to-red-950 rounded-lg flex flex-col items-center border border-white-600">
        <h3 className="text-2xl text-amber-50 mb-12">Login</h3>
        {/* <img src={cwa_logo_full} alt="CodeWithAli Logo Full" id='cwa-logo-full' draggable={false} /> */}

        <form
          className="w-full flex flex-col items-center"
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div className="w-full space-y-4">
            {/* Email Field */}
            <form.Field 
              name="email"
              children={(field) => (
                <div className="w-full">
                  <label
                    className="text-amber-50 block mb-2"
                    htmlFor={field.name}
                  >
                    Email:
                  </label>
                  <input
                    name={field.name}
                    type="email"
                    className="w-full p-1 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-gray-600 focus:rounded-lg transition-all duration-300
                             hover:bg-gray-600 hover:rounded-lg hover:border-none"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />

            {/* Password Field */}
            <form.Field
              name="password"
              children={(field) => (
                <div className="w-full">
                  <label
                    className="text-amber-50 block mb-2"
                    htmlFor={field.name}
                  >
                    Password:
                  </label>
                  <input
                    name={field.name}
                    type="password"
                    className="w-full p-1 bg-transparent text-amber-50 border-b border-amber-50 
                             focus:outline-none focus:bg-gray-600 focus:rounded-lg transition-all duration-300
                             hover:bg-gray-600 hover:rounded-lg hover:border-none"
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              )}
            />
          </div>

          {/* Submit Button */}
          <form.Subscribe
            selector={(state) => [state.canSubmit]}
            children={([canSubmit]) => (
              <button
                type="submit"
                disabled={!canSubmit}
                className="mt-7 neonbtn"
              >
                Submit
              </button>
            )}
          />
        </form>

        {/* Sign Up Button */}
        <div className="mt-4 text-center">
          <p>Already Have an Account?</p>
          <button
            // goes to the above function, pretty simple right?
            onClick={handleSignUp}
            className="mt-3 neonbtn"
              >
            Sign Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
function setPinCheck(value: string) {
  localStorage.setItem("pinCheck", value);
}
