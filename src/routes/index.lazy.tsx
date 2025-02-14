import { createLazyFileRoute } from "@tanstack/react-router";
import "../assets/index.css";
import { ActiveUser } from "../stores/query";
import supabase from "@/MyComponents/supabase";

// Assets in public directory cannot be imported from JavaScript.
// If you intend to import that asset, put the file in the src directory, and use /src/codewithali_logo.png instead of /public/codewithali_logo.png.
// If you intend to use the URL of that asset, use /codewithali_logo.png?url.
// Files in the public directory are served at the root path.
// Instead of /public/codewithali_logo.png, use /codewithali_logo.png.

// const [greetMsg, setGreetMsg] = useState("");
// const [name, setName] = useState("");

// async function greet() {
//   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
//   setGreetMsg(await invoke("greet", { name }));
// }

function Index() {
  const { data: activeuser } = ActiveUser();

  const Logout = async() => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log('Error Signing Out:', error.message)
    } else {
      localStorage.removeItem('isLoggedIn');
      window.location.reload();
    }
  }

  return (
    <>
      {activeuser?.map((user: any) => (
        <div key={user.supa_id}>
          <h3>
            Logged in as: {user.username}
            <p style={{ display: 'inline-block' }} className={`roleTag ${user.role === 'admin' ? ('admin-role') : user.role === 'member' ? ('member-role') : ('')}`}>{user.role}</p>
          </h3>
        </div>
      ))}
      <button className="neonbtn" type="button" onClick={() => Logout()}>Log Out</button>
      <br />
      <h3>Welcome to Home Page</h3>
    </>
  );
}

export const Route = createLazyFileRoute("/")({
  component: Index,
});
