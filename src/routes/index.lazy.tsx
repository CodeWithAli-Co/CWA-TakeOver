import { createLazyFileRoute } from "@tanstack/react-router";
import { useAppStore } from "../stores/main";
import cwa_logo from '/codewithali_logo.png';
import home_icon from '/home_icon.svg';
import bot_icon from '/bot_icon.svg';
import employee_icon from '/employee_icon.svg';
import broadcast_icon from '/broadcast_icon.svg';
import "../assets/index.css";

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
  const { test, setTest } = useAppStore();

  const tempFunc = () => {
    setTest("User");
  };
  return (
    <>
    <div className="main-div">
      <section id="sidebar">
        <img src={cwa_logo} alt="CodeWithAli Logo" id="cwa-logo" draggable={false} />
        <img src={home_icon} alt="Home Icon" className="sidebar-icon" draggable={false} />
        <img src={employee_icon} alt="Employee Icon" className="sidebar-icon" draggable={false} />
        <img src={bot_icon} alt="Bot Icon" className="sidebar-icon" draggable={false} />
        <img src={broadcast_icon} alt="Broadcast Icon" className="sidebar-icon" draggable={false} />
      </section>
      
      <section id="main-section">
        <h3>This is main body</h3>
      </section>
    </div>
    </>
  );
}

export const Route = createLazyFileRoute("/")({
  component: Index,
});
