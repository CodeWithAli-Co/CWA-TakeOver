import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { create, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router";
import "../assets/sidebar.css";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useAppStore } from "../stores/store";

import { SidebarProvider } from "@/components/ui/shadcnComponents/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import supabase from "@/MyComponents/supabase";
import { useEffect } from "react";
import LoginPage from "@/MyComponents/Beginning/login";
import PinPage from "@/MyComponents/Beginning/pinPage";
import { SignUpPage } from "@/MyComponents/Beginning/signup";
import { ActiveUser, DMGroups, Messages } from "@/stores/query";
import UserView from "@/MyComponents/Reusables/userView";
import CyberpunkPinPage from "@/MyComponents/Beginning/bluePinPage";

export const Route = createRootRoute({
  component: () => {
    const { pinCheck, isLoggedIn, GroupName } = useAppStore();
    const { data: user, error: userError } = ActiveUser();
    if (userError) {
      sendNotification({
        title: "Error with Active User",
        body: "Error Fetching Active User on Start up!",
      });
    }
    const { refetch: refetchDMGroups } = DMGroups(user[0]?.username);
    const { refetch: refetchMessages } = Messages(GroupName);

    // Messaging Realtime channel
    supabase
      .channel("all-messages")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_dm_chat" },
        () => refetchMessages()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dm_groups" },
        () => refetchDMGroups()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cwa_chat" },
        () => refetchMessages()
      )
      .subscribe();

    // Checks if user is on DMChat or not. Using useEffect to prevent multiple rerenders
    useEffect(() => {
      // If user's on DMChat, remove realtime channel so they wont receive notification while in chat
      // While not on DMChat, they will get notifications
      // *But need to add a way to still get notified from OTHER Dm chats

      // If user's on GeneralChat, remove realtime channel so they wont receive notification while in chat
      // Default value is General, so by default users wont receive notification from generalchat unless navigated to a DM
      if (GroupName === "General") {
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

        // While not on GeneralChat, they will get notifications
        const channels = supabase.getChannels();
        channels.map((channel) =>
          channel.topic === "realtime:general"
            ? supabase.removeChannel(channel)
            : console.log("No Such Realtime General channel")
        );
        console.log("on General chat!");
      } else {
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

        const channels = supabase.getChannels();
        channels.map((channel) =>
          channel.topic === "realtime:dm"
            ? supabase.removeChannel(channel)
            : console.log("No Such Realtime DM channel")
        );
        console.log("on DMS!");
      }
    }, [GroupName]);

        // Check if can send notifications
        useEffect(() => {
          async function CheckNotifPerm() {
            // Do you have permission to send a notification?
            let permissionGranted = await isPermissionGranted();
    
            // If not we need to request it
            if (!permissionGranted) {
              const permission = await requestPermission();
              permissionGranted = permission === "granted";
            }
    
            // Once permission has been granted we can send the notification
            if (permissionGranted) {
              console.log("Notification Permission is Granted!");
            }
          }
          CheckNotifPerm();
        }, []);
    
        // Check if invoiceStats file exists or not
        useEffect(() => {
          async function Create() {
            const checkFile = await exists("invoiceStats.json", {
              baseDir: BaseDirectory.AppLocalData,
            });
            if (checkFile) {
              return;
            } else {
              const file = await create("invoiceStats.json", {
                baseDir: BaseDirectory.AppLocalData,
              });
              // await file.write(new TextEncoder().encode('Hello from CWA Invoicer'));
              await file.close();
            }
          }
          Create();
        }, []);
    

    // Add global pressence if possible

    useEffect(() => {
      async function RunUpdater() {
        const update = await check();
        // Run when update has an actual version and has 'rid' value
        if (update && update.rid !== null && update.version !== null) {
          sendNotification({
            title: 'New Update Available!',
            body: `Found update v${update.version}`
          })
          let downloaded = 0;
          let contentLength = 0;
          // alternatively we could also call update.download() and update.install() separately
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case "Started":
                contentLength = event.data.contentLength!;
                console.log(
                  `started downloading ${event.data.contentLength} bytes`
                );
                break;
              case "Progress":
                downloaded += event.data.chunkLength;
                console.log(`downloaded ${downloaded} from ${contentLength}`);
                break;
              case "Finished":
                console.log("download finished");
                break;
            }
          });

          console.log("update installed");
          await relaunch();
        }
      }

      RunUpdater();
    }, []);

    return (
      <>
        {pinCheck === "false" ? (
          <>
          <UserView userRole={["Intern", "Member", "Marketing Specialist", "Admin", "Project Manager", "CEO"]}>
            <PinPage />
          </UserView>
          <UserView userRole={"COO"}>
            <CyberpunkPinPage />
          </UserView>
          </>
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
