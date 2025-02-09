import { useForm } from '@tanstack/react-form';
import { useAppStore } from '../stores/store';
import supabase from './supabase';

export const SingUpPage = () => {
  const { setIsLoggedIn } = useAppStore();
  // const { data: role, isLoading, error: roleError } = useQuery({
  //   queryKey: ["getrole"],
  //   queryFn: fetchData,
  //   refetchInterval: 5000
  // });

  const form = useForm({
    defaultValues: {
      username: '',
      email: '',
      password: ''
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      // Need to Insert data into app_users table

      let { error } = await supabase.auth.signUp({
        email: value.email,
        password: value.password
      })

      
      if (error) return console.log(error.message);

      // add delay for email to reach user
      await new Promise((r) => setTimeout(r, 15000))
      setIsLoggedIn('false') // Go to login page
    }
  });

  return (
    <>
      <div>
        <h3>SignUp</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div>
            <form.Field
              name='email'
              children={(field) => {
                return (
                  <>
                    <input
                      name={field.name}
                      type='email'
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </>
                );
              }}
            />
            <br />
            <form.Field
              name='password'
              children={(field) => {
                return (
                  <>
                    <input
                      name={field.name}
                      type='password'
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
              <button type='submit' id='submit' disabled={!canSubmit}>
                Submit
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};