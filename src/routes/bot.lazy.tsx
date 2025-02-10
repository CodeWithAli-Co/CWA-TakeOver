import api from "@/MyComponents/botApi";
import { createLazyFileRoute } from "@tanstack/react-router";
import { create } from "zustand";
import '../assets/bot.css';

interface TokenState {
  myToken: any;
  setMyToken: (myToken: any) => void;
}

export const useTokenStore = create<TokenState>()((set) => ({
  myToken: "",
  setMyToken: (myToken: any) => set({ myToken }),
}));

function Bot() {
  const { myToken, setMyToken } = useTokenStore();

  const BASE_URL = "https://koi-climbing-squid.ngrok-free.app";

  async function getToken(username: any, password: any) {
    const response = await fetch(`${BASE_URL}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      throw new Error("Failed to log in");
    }

    const data = await response.json();
    setMyToken(data.access_token); // Setting token to state for other functions can access it
    console.log("Token Generated:", data.access_token);
    return data.access_token; // Use this token for further requests
  }

  const Start = () => {
    console.log("Bot Started");
  };

  // const Stop = () => {
  //   console.log("Bot Started");
  // };

  async function fetchStatus() {
    try {
      const token = myToken!;
      const response = await api.request(`${BASE_URL}/status`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("Bot Status:", response);
    } catch (error) {
      console.error("Error fetching status:", error);
    }
  }

  // Need to recieve channel_id as string and change it into an int in python server
  // because channel_id number is too long and typescript wont send the correct numbers.
  async function sendMessage(channelID: any, message: any) {
    try {
      const token = await getToken("admin", "CWA#2025:)");
      const response = await api.request("/send-message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify({ channel_id: channelID, message }),
      });
      console.log("Message Response:", JSON.stringify(response.body));
      console.log("ChannelID and msg:", channelID, message);
      console.log("token gotten:", token);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  async function stopBot() {
    try {
      const token = await getToken("admin", "CWA#2025:)");
      const response = await api.request("/shutdown", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token,
        },
        body: JSON.stringify(""),
      });
      console.log("Shutdown:", response);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  return (
    <>
      <h3>Bot Manager</h3>
      <p>Work in Progress</p>
      <div id="btns-div">
        <button
          type="button"
          onClick={() => Start()}
          className="btn"
          id="start-btn"
        >
          Start Bot
        </button>
        <button
          type="button"
          onClick={() => stopBot()}
          className="btn"
          id="stop-btn"
        >
          Stop Bot
        </button>
        <button
          type="button"
          onClick={() => fetchStatus()}
          className="btn"
          id="stop-btn"
        >
          Status
        </button>
        <button
          type="button"
          onClick={() => sendMessage("1327558265357205535", "Hello from tauri")}
          className="btn"
          id="stop-btn"
        >
          Send Msg
        </button>
        <button
          type="button"
          onClick={() => getToken("admin", "CWA#2025:)")}
          className="btn"
          id="stop-btn"
        >
          Log In
        </button>
      </div>
    </>
  );
}

export const Route = createLazyFileRoute("/bot")({
  component: Bot,
});
