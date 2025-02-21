import {
  createRootRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import cwa_logo from "/codewithali_logo.png";
import book_icon from "/book_icon.svg";
import bot_icon from "/bot_icon.svg";
import employee_icon from "/employee_icon.svg";
import broadcast_icon from "/broadcast_icon.svg";
import "../assets/sidebar.css";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useAppStore } from "../stores/store";
import PinPage from "@/MyComponents/pinPage";
import { LoginPage } from "@/MyComponents/login";
import { SignUpPage } from "@/MyComponents/signup";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import supabase from "@/MyComponents/supabase";
import { useEffect } from "react";
// import { AppSidebar } from "@/MyComponents/Dashboard/app-sidebar";

// Import Sidebar Components
// import { SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";
// import { AppSidebar } from "../ui/components/app-sidebar";

export const Route = createRootRoute({
  component: () => {
    const { pinCheck, isLoggedIn } = useAppStore();
    // Gets current active path/route
    const location = useRouterState({ select: (s) => s.location });

    // Checks if user is on DMChat path or not. Using useEffect to prevent multiple rerenders
    useEffect(() => {
      // If user's on DMChat, remove realtime channel so they wont receive notification while in chat
      // While not on DMChat, they will get notifications
      // *But need to add a way to still get notified from OTHER Dm chats
      if (location.pathname !== "/chats/dm") {
        supabase
          .channel("dm")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "cwa_dm_chat" },
            (payload) =>
              sendNotification({
                title: "New DM Message",
                body: `${payload.new.sent_by}: "${payload.new.message}"`,
              })
          )
          .subscribe();
        console.log("Not on DMS");
      } else {
        const channels = supabase.getChannels();
        channels.map((channel) =>
          channel.topic === "realtime:dm"
            ? supabase.removeChannel(channel)
            : console.log("No Such Realtime DM channel")
        );
        console.log("on DMS!");
      }
    }, [location.pathname]);

    
    // Checks if user is on GeneralChat path or not. Using useEffect to prevent multiple rerenders
    useEffect(() => {
      // If user's on GeneralChat, remove realtime channel so they wont receive notification while in chat
      // While not on GeneralChat, they will get notifications
      if (location.pathname !== "/chats/general") {
        // Listens to the general chat updates no matter where user is in the App
        supabase
          .channel("general")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "cwa_chat" },
            (payload) =>
              sendNotification({
                title: "New Message in General",
                body: `${payload.new.sent_by}: "${payload.new.message}"`,
              })
          )
          .subscribe();
        console.log("Not on General chat");
      } else {
        const channels = supabase.getChannels();
        channels.map((channel) =>
          channel.topic === "realtime:general"
            ? supabase.removeChannel(channel)
            : console.log("No Such Realtime General channel")
        );
        console.log("on General chat!");
      }
    }, [location.pathname]);
    // Add global pressence if possible

    return (
      <>
        {pinCheck === "false" ? (
          <PinPage />
        ) : pinCheck === "true" && isLoggedIn === "false" ? (
          <LoginPage />
        ) : pinCheck === "true" && isLoggedIn === "makeAcc" ? (
          <SignUpPage />
        ) : pinCheck === "true" && isLoggedIn === "true" ? (
          <SidebarProvider>
            {/* // root.tsx layout section */}
            <AppSidebar />
            <section id="main-section">
              <Outlet />
            </section>
          </SidebarProvider>
        ) : (
          <h3>Error Loading App Components</h3>
        )}
      </>
    );
  },
  errorComponent: () => {
    const navigate = useNavigate();

    const goBack = () => {
      navigate({ to: ".." });
    };
    return (
      <>
        <h3>
          <strong>Error</strong>
        </h3>
        <button type="button" onClick={goBack}>
          Back
        </button>
      </>
    );
  },
  notFoundComponent: () => {
    const navigate = useNavigate();

    const goBack = () => {
      navigate({ to: ".." });
    };
    return (
      <>
        <h3>
          <strong>Not Found</strong>
        </h3>
        <button type="button" onClick={goBack}>
          Back
        </button>
      </>
    );
  },
});
