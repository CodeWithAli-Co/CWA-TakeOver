import { createLazyFileRoute } from "@tanstack/react-router";
import { useAppStore } from "../stores/main";
import "../assets/index.css";

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
      <div>
        <h3>Welcome Home! {test}</h3>
        <button type="button" onClick={() => tempFunc()}>
          Click Me
        </button>
      </div>
    </>
  );
}

export const Route = createLazyFileRoute("/")({
  component: Index,
});
