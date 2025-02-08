import { createLazyFileRoute } from "@tanstack/react-router";
import "../assets/index.css";
import Welcome from "../components/welcome";

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
  const remLS = () => {
    localStorage.removeItem('isLoggedIn')
  }
  return (
    <>
      <button type="button" onClick={() => remLS()}>Reset LocalStorage</button>
      <Welcome />
    </>
  );
}

export const Route = createLazyFileRoute("/")({
  component: Index,
});
