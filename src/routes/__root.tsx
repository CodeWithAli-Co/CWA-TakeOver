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
import { useChatStore } from "@/stores/chatStore";

import { SidebarProvider } from "@/components/ui/shadcnComponents/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import supabase from "@/MyComponents/supabase";
import { useEffect, useState, lazy, Suspense } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import LoginPage from "@/MyComponents/Beginning/login";
import PinPage from "@/MyComponents/Beginning/pinPage";
import { SignUpPage } from "@/MyComponents/Beginning/signup";
import { ActiveUser, DMGroups, Messages } from "@/stores/query";
import UserView from "@/MyComponents/Reusables/userView";
import CyberpunkPinPage from "@/MyComponents/Beginning/bluePinPage";
import SecurityBreach from "@/MyComponents/Beginning/conceptIdea";

// AXON — lazy-loaded so the command-intelligence bundle never
// touches the login / pin-pad paths, and stays admin-gated internally.
const AxonRoot = lazy(() => import("@/Axon"));

// Global Cmd+K message search — also lazy so the chat search bundle
// only loads after the user actually invokes it.
const GlobalSearch = lazy(() =>
  import("@/MyComponents/Chat/GlobalSearch").then((m) => ({
    default: m.GlobalSearch,
  })),
);

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

      // Helper: read user's notification prefs from localStorage
      const isNotifEnabled = (): boolean => {
        try {
          const raw = localStorage.getItem("cwa-notification-prefs");
          if (!raw) return true; // default on
          const parsed = JSON.parse(raw);
          return parsed?.enableNotifications !== false;
        } catch { return true; }
      };

      // Helper: channel-level mute toggle from ChatHeader's More menu
      const isGroupMuted = (name: string): boolean => {
        try {
          const raw = localStorage.getItem("cwa-chat-muted-groups");
          if (!raw) return false;
          const arr = JSON.parse(raw);
          return Array.isArray(arr) && arr.includes(name);
        } catch { return false; }
      };

      // Helper: are we on the chat page right now? If so, we only skip
      // notifications for the CURRENTLY-VIEWED group (so user still gets
      // pings from other channels while in-chat).
      const isOnChatPage = (): boolean =>
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/chat");

      // Read the sound preference the same way (defaults to on).
      const isSoundEnabled = (): boolean => {
        try {
          const raw = localStorage.getItem("cwa-notification-prefs");
          if (!raw) return true;
          const parsed = JSON.parse(raw);
          return parsed?.enableSound !== false;
        } catch { return true; }
      };

      const fireNotify = (title: string, body: string) => {
        if (!isNotifEnabled()) {
          console.log("[notify] skipped (user disabled notifications)");
          return;
        }
        console.log("[notify] firing:", title, "·", body);
        try {
          sendNotification({
            title,
            body,
            // "default" plays the OS default notification chime on platforms
            // that support it (Windows / macOS). Harmless where unsupported.
            ...(isSoundEnabled() ? { sound: "default" } : {}),
          });
        } catch (err) {
          console.error("[notify] sendNotification failed:", err);
        }
      };

      // Detect @username mentions in the message text.
      const isMentioned = (text: string): boolean => {
        if (!currentUsername || !text) return false;
        const re = new RegExp(`(^|\\s)@${currentUsername}(?![A-Za-z0-9_.-])`, "i");
        return re.test(text);
      };

      // Detect /here — fire to anyone currently online per presence state.
      const isHereCall = (text: string): boolean =>
        /(^|\s)@here(?![A-Za-z0-9_.-])/i.test(text || "");
      const isUserOnline = (): boolean => {
        if (!currentUsername) return false;
        const status = useChatStore.getState().presenceStatus(currentUsername);
        return status === "online";
      };

      const unreadChannel = supabase
        .channel("unread-tracker")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "cwa_dm_chat" },
          (payload) => {
            const groupName = payload.new.dm_group;
            const sentBy = payload.new.sent_by;
            const body = payload.new.message || "";
            if (sentBy === currentUsername) return;
            const viewing = isOnChatPage() && GroupName === groupName;
            const mentioned = isMentioned(body);
            const hereCall = isHereCall(body) && isUserOnline();
            if (!viewing || mentioned || hereCall) {
              if (!viewing) incrementUnread(groupName);
              const muted = isGroupMuted(groupName);
              if (mentioned) {
                fireNotify(
                  `${sentBy} mentioned you in ${groupName}`,
                  body || "[attachment]",
                );
              } else if (hereCall) {
                fireNotify(
                  `${sentBy} called @here in ${groupName}`,
                  body || "[attachment]",
                );
              } else if (!muted) {
                fireNotify(
                  `New message in ${groupName}`,
                  `${sentBy}: ${body || "[attachment]"}`,
                );
              }
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "cwa_chat" },
          (payload) => {
            const sentBy = payload.new.sent_by;
            const body = payload.new.message || "";
            if (sentBy === currentUsername) return;
            const viewing = isOnChatPage() && GroupName === "General";
            const mentioned = isMentioned(body);
            const hereCall = isHereCall(body) && isUserOnline();
            if (!viewing || mentioned || hereCall) {
              if (!viewing) incrementUnread("General");
              const muted = isGroupMuted("General");
              if (mentioned) {
                fireNotify(
                  `${sentBy} mentioned you in General`,
                  body || "[attachment]",
                );
              } else if (hereCall) {
                fireNotify(
                  `${sentBy} called @here in General`,
                  body || "[attachment]",
                );
              } else if (!muted) {
                fireNotify(
                  "New message in General",
                  `${sentBy}: ${body || "[attachment]"}`,
                );
              }
            }
          },
        )
        .subscribe((status) => {
          console.log("[notify] realtime channel status:", status);
        });

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

      // *If the updater is downloading and trying to install during `dev` mode, that means you didnt `git pull`.
      // Because as long as the app's version matches the "new version" in the cloud, the updater wont run.
      // Which should always be the case in dev mode bc dev is newer or same version as cloud.
      RunUpdater();
    }, []);

    // ─── Scheduled messages — fire any due every 20s ────────────────
    useEffect(() => {
      const uname = user?.[0]?.username;
      if (!uname) return;
      let running = false;
      const tick = async () => {
        if (running) return;
        running = true;
        try {
          const { dueScheduled, removeScheduled } = await import(
            "@/MyComponents/Chat/scheduledStore"
          );
          const due = dueScheduled();
          for (const item of due) {
            // Only the author's client fires. Prevents dupes across devices.
            if (item.createdBy !== uname) continue;
            const { error } = await supabase
              .from(item.table)
              .insert(item.payload);
            if (!error) {
              console.log("[scheduled] sent", item.preview);
              removeScheduled(item.id);
            } else {
              console.warn(
                "[scheduled] send failed (keeping for retry):",
                error.message,
              );
            }
          }
        } catch (err) {
          console.warn("[scheduled] tick error:", err);
        } finally {
          running = false;
        }
      };
      tick();
      const id = setInterval(tick, 20_000);
      return () => clearInterval(id);
    }, [user]);

    // ─── Presence — track self + listen for others ──────────────────
    useEffect(() => {
      const uname = user?.[0]?.username;
      if (!uname) return;
      const channel = supabase.channel("chat-presence", {
        config: { presence: { key: uname } },
      });

      const syncPresence = () => {
        const state = channel.presenceState();
        const entries: Record<string, { lastSeen: number }> = {};
        for (const [key, presences] of Object.entries(state)) {
          const latest = (presences as any[])
            .map((p) => Number(p?.lastSeen ?? Date.now()))
            .reduce((a, b) => (a > b ? a : b), 0);
          entries[key] = { lastSeen: latest || Date.now() };
        }
        useChatStore.getState().setPresenceMany(entries);
      };

      channel
        .on("presence", { event: "sync" }, syncPresence)
        .on("presence", { event: "join" }, syncPresence)
        .on("presence", { event: "leave" }, syncPresence)
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            channel.track({ lastSeen: Date.now() });
          }
        });

      // Heartbeat — republish every 30s so we stay "online".
      const beat = setInterval(() => {
        channel.track({ lastSeen: Date.now() });
      }, 30_000);

      return () => {
        clearInterval(beat);
        channel.unsubscribe();
      };
    }, [user]);

    // ─── Cmd / Ctrl + K — global message search ─────────────────────
    const [searchOpen, setSearchOpen] = useState(false);
    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          setSearchOpen((v) => !v);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, []);

    // ─── Tray / taskbar unread badge ────────────────────────────────
    // Mirror totalUnread into the window title so taskbar + tray tooltip
    // show "(3) CWA TakeOver" and the user can see unread count even when
    // the window is hidden. Works on top of the existing tray icon.
    useEffect(() => {
      let cancelled = false;
      const updateTitle = async () => {
        try {
          const win = getCurrentWindow();
          const total = useChatStore.getState().totalUnread();
          const base = "CWA TakeOver";
          if (!cancelled) {
            await win.setTitle(total > 0 ? `(${total}) ${base}` : base);
          }
        } catch (err) {
          console.warn("[tray] setTitle failed:", err);
        }
      };
      updateTitle();
      const unsub = useChatStore.subscribe(() => updateTitle());
      return () => {
        cancelled = true;
        unsub();
      };
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
            {/* Global Cmd+K message search */}
            <Suspense fallback={null}>
              <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
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
