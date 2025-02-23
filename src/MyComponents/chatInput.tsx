import { useForm } from '@tanstack/react-form';
import supabase from './supabase';
import { message } from '@tauri-apps/plugin-dialog';

interface Props {
  table: string
  activeUser: string
  UserAvatar: string
  DmGroup?: string
  className?: string
  placeholder?: string
}

export const ChatInputBox = (props: Props) => {
  const form = useForm({
    defaultValues: {
      Message: '',
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      console.log('User Avatar: ', props.UserAvatar)
      const { error } = await supabase.from(props.table).insert({ dm_group: props.DmGroup, sent_by: props.activeUser, message: value.Message, userAvatar: props.UserAvatar });
      if (error) {
        return await message(error.message, { title: `Error sending Message at ${props.table}` });
      }
      
      form.reset();
    }
  });

  return (
    <>
      <div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            form.handleSubmit();
          }}
        >
          <div>
            <form.Field
              name='Message'
              children={(field) => {
                return (
                  <>
                    <input
                      name={field.name}
                      autoFocus
                      autoComplete='off'
                      className={`${props.className}`}
                      placeholder={`${props.placeholder || 'Enter Message'}`}
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
              <button type='submit' style={{ display: 'none' }} disabled={!canSubmit}>
                Submit
              </button>
            )}
          />
        </form>
      </div>
    </>
  );
};