import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";
import { create, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import {
  createRootRoute,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import "../assets/sidebar.css";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { useAppStore } from "../stores/store";

import { SidebarProvider } from "@/components/ui/shadcnComponents/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import supabase from "@/MyComponents/supabase";
import { useEffect, lazy, Suspense } from "react";
import LoginPage from "@/MyComponents/Beginning/login";
import PinPage from "@/MyComponents/Beginning/pinPage";
import { SignUpPage } from "@/MyComponents/Beginning/signup";
import { ActiveUser, DMGroups, Messages } from "@/stores/query";
import { useChatStore } from "@/stores/chatStore";
import UserView from "@/MyComponents/Reusables/userView";
import CyberpunkPinPage from "@/MyComponents/Beginning/bluePinPage";
import SecurityBreach from "@/MyComponents/Beginning/conceptIdea";

// AXON — lazy-loaded so the command-intelligence bundle never
// touches the login / pin-pad paths, and stays admin-gated internally.
const AxonRoot = lazy(() => import("@/Axon"));

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

    // Keep DMGroups in sync across the app (channel is idempotent for same name)
    useEffect(() => {
      const channel = supabase
        .channel("dm-groups-sync")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dm_groups" },
          () => refetchDMGroups()
        )
        .subscribe();
      return () => { channel.unsubscribe(); };
    }, [refetchDMGroups]);

    // Checks if user is on DMChat or not. Using useEffect to prevent multiple rerenders
    useEffect(() => {
      // If user's on DMChat, remove realtime channel so they wont receive notification while in chat
      // While not on DMChat, they will get notifications
      // *But need to add a way to still get notified from OTHER Dm chats

      // If user's on GeneralChat, remove realtime channel so they wont receive notification while in chat
      // Default value is General, so by default users wont receive notification from generalchat unless navigated to a DM
      const currentUsername = user?.[0]?.username || "";
      const { incrementUnread } = useChatStore.getState();

      // Listen to ALL message tables; increment unread + notify when not viewing that group
      const unreadChannel = supabase
        .channel("unread-tracker")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "cwa_dm_chat" },
          (payload) => {
            const groupName = payload.new.dm_group;
            const sentBy = payload.new.sent_by;
            // Skip own messages
            if (sentBy === currentUsername) return;
            // If not currently viewing this DM, increment unread + notify
            if (GroupName !== groupName) {
              incrementUnread(groupName);
              sendNotification({
                title: `New message in ${groupName}`,
                body: `${sentBy}: ${payload.new.message}`,
              });
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "cwa_chat" },
          (payload) => {
            const sentBy = payload.new.sent_by;
            if (sentBy === currentUsername) return;
            if (GroupName !== "General") {
              incrementUnread("General");
              sendNotification({
                title: "New message in General",
                body: `${sentBy}: ${payload.new.message}`,
              });
            }
          }
        )
        .subscribe();

      return () => { unreadChannel.unsubscribe(); };
    }, [GroupName, user]);

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
            title: `New Update Available: v${update.version}`,
            body: `${update.body || "Get new Update now!"}`,
          });
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

      // Only run the updater in production builds — in `bun run tauri dev`
      // the dev host gets killed by relaunch() and the loop retriggers on every start.
      if (import.meta.env.PROD) {
        RunUpdater();
      }
    }, []);

    return (
      <>
        {pinCheck === "false" ? (
          <>
            <UserView
              userRole={[
                "Intern",
                "Member",
                "UIDesigner",
                "SoftwareDev",
                "MechEngineer",
                "Recruiter",
                "AiDev",
                "DBAdmin",
                "AccManager",
                "DataScientist",
                "ProjectManager",
                "Marketing",
                "CustomerSupport",
                "Admin",
                "SecurityEngineer",
                "Partner",
              ]}
            >
              <PinPage />
            </UserView>
            <UserView userRole={"COO"}>
              <CyberpunkPinPage />
            </UserView>
            <UserView userRole={"CEO"}>
              <SecurityBreach />
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
            {/* AXON command intelligence — admin-gated inside the module */}
            <Suspense fallback={null}>
              <AxonRoot />
            </Suspense>
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
