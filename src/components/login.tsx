import { useForm } from '@tanstack/react-form';
import { useAppStore } from '../stores/main';
import supabase from './supabase';

export const LoginPage = () => {
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
      // Login with username + pass; grab usernsame's email to insert into signIn supabase API
      let { data, error } = await supabase.auth.signInWithPassword({
        email: value.email, // need to change this
        password: value.password
      })

      const { data: role } = await supabase.from('app_users').select('email, role').eq('email', value.email)
      // checks if user is authenticated by supabase and if they have the specified custom role
      if (data.user?.role === 'authenticated' && role![0].role === 'admin') {
        setIsLoggedIn('true');
      }

      if (error?.message === 'Invalid login credentials') {
        setIsLoggedIn('makeAcc');
      }

      // trying out sessionStorage
      localStorage.setItem('isLoggedIn', 'true');
    }
  });

  return (
    <>
      <div>
        <h3>LogIn</h3>
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

