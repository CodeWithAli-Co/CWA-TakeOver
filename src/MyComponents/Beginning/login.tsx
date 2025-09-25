import { useForm } from "@tanstack/react-form";
import { useAppStore } from "@/stores/store";
import supabase from "../supabase";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/shadcnComponents/Label";
import { Input } from "@/components/ui/shadcnComponents/input";

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
    <div className="min-h-screen w-full flex justify-center items-center bg-gradient-to-br from-red-950/20 via-red-950/70 to-red-950/20">
      <div className="w-[24em] h-[30em] p-8 bg-black rounded-lg flex flex-col items-center border border-white-600">
        <h3 className="text-2xl text-amber-50 mb-12">Login</h3>
        {/* <img src={cwa_logo_full} alt="CodeWithAli Logo Full" id='cwa-logo-full' draggable={false} /> */}

        <form
          className="w-full flex flex-col items-center "
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
                    className="w-full p-1  text-amber-50 border pl-3 border-zinc-900  
                             focus:border-red-950 focus:bg-zinc-950/10 focus:rounded-lg 
                             hover:bg-zinc-950/20 hover:rounded-lg hover:border-none"
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
                  <Label
                    className="text-amber-50 block mb-2"
                    htmlFor={field.name}
                  >
                    Password:
                  </Label>
                  <Input
                    name={field.name}
                    type="password"
                    placeholder="Enter Password "
                    className="w-full p-1 pl-3 text-amber-50 border border-zinc-900  
                             focus:border-red-950 focus:bg-zinc-950/10 focus:rounded-lg 
                             hover:bg-zinc-950/20 hover:rounded-lg hover:border-none"
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
              <Button
                type="submit"
                disabled={!canSubmit}
                // neonbtn
                className="my-9 bg-red-950 hover:bg-red-950/10 w-full "
              >
                Submit
              </Button>
            )}
          />
        </form>

        {/* Sign Up Button */}
        <div className="mt-4 text-center ">
          <p>Already Have an Account?</p>
          <Button
            // goes to the above function, pretty simple right?
            onClick={handleSignUp}
            className="mt-3 bg-blue-950 hover:bg-blue-900/20 w-full "
              >
            Sign Up
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
