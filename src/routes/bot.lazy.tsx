import React from "react";
import api from "@/MyComponents/botApi";
import { createLazyFileRoute } from "@tanstack/react-router";
import { create } from "zustand";
import "../assets/bot.css";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/shadcnComponents/card"; // Replace 'your-card-library' with the actual library or file path
import { Button } from "@/components/ui/shadcnComponents/button"; // Replace 'your-button-library' with the actual library or file path
import { Power, Info, Send, LogIn } from "lucide-react"; // Replace 'lucide-react' with the actual icon library if different

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-8">
      <div className="max-w-[700px] w-full">
        <Card className="w-full max-md neonbtn  to-red-95">
          <CardHeader className="space-y-2 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-white">
              Bot Manager
            </CardTitle>
            <CardDescription className="text-center text-sm text-zinc-400">
              Control and monitor your bot
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <Button
                onClick={() => Start()}
                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-400 shadow-lg shadow-emerald-800/20 transition-all duration-200"
                size="lg"
              >
                <Power className="mr-2 h-5 w-5" />
                Start Bot
              </Button>
              <Button
                onClick={() => stopBot()}
                className="bg-red-950 hover:bg-red-900 border border-red-700/50 text-red-400 shadow-lg shadow-red-800/20 transition-all duration-200"
                size="lg"
              >
                <Power className="mr-2 h-5 w-5" />
                Stop Bot
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Button
                onClick={() => fetchStatus()}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 shadow-sm transition-all duration-200"
              >
                <Info className="mr-2 h-4 w-4" />
                Status
              </Button>
              <Button
                onClick={() =>
                  sendMessage("1327558265357205535", "Hello from tauri")
                }
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 shadow-sm transition-all duration-200"
              >
                <Send className="mr-2 h-4 w-4" />
                Send Msg
              </Button>
              <Button
                onClick={() => getToken("admin", "CWA#2025:)")}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 shadow-sm transition-all duration-200"
              >
                <LogIn className="mr-2 h-4 w-4" />
                Log In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export const Route = createLazyFileRoute("/bot")({
  component: Bot,
});
