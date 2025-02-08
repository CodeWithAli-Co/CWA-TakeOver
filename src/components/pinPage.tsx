import { useForm } from '@tanstack/react-form';
import './compAssets/pinPage.css';
import { useAppStore } from '../stores/main';
import cwa_logo_full from '/codewithali_logo_full.png';
import { useEffect } from 'react';

export default function PinPage() {
  const { setPinCheck, setIsLoggedIn } = useAppStore();
  useEffect(() => {
    const checkLogin = localStorage.getItem('isLoggedIn');
    if (checkLogin === 'true') {
      setIsLoggedIn('true');
    }
  }, [])
  

  const form = useForm({
    defaultValues: {
      pin: ''
    },
    onSubmit: async ({ value }) => {
      console.log(value);
      document.startViewTransition(() => {
        setPinCheck('true');
      })
  
      // // Checks if User's Input only contains numbers
      // const regex = /^\d+$/;
      // if (!regex.test(value.pin)) {
      //   console.log('Enter Number Please');
      //   value.pin = ''
      // } else {
      //   // Fetch Current user's saved PIN
      //   const userPIN = await window.api.getPin(currentUser);
      //   // Check if entered PIN matches saved PIN
      //   const res = await window.api.checkPin(userPIN.data['PIN'], value.pin);
      //   if (res === true) {
      //     console.log('Pin Successful!')
          
      //     document.startViewTransition(() => {
      //       setIsLoggedIn(true)
      //     });

      //     value.pin = ''
      //   } else {
      //     console.log('Pin is Invalid')
      //     value.pin = ''
      //   }
      // }
    }
  })

  return (
    <>
      <div id='pin-div'>
        <h1 id='big-title'>Welcome</h1>
        <img src={cwa_logo_full} alt="CodeWithAli Logo Full" id='cwa-logo-full' draggable={false} />
        <form
          id='pin-form'
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            form.handleSubmit()
          }}
        >
          <div>
            <form.Field
              name="pin"
              children={(field) => (
                <input
                  name={field.name}
                  id='pin-input'
                  type='password'
                  minLength={4}
                  maxLength={4}
                  autoFocus
                  placeholder='Enter 4-digit PIN'
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                />
              )}
            />
          </div>
          <button type="submit" id='pin-submit' style={{ display: 'none' }}>Submit</button>
        </form>
      </div>
    </>
  )
}
