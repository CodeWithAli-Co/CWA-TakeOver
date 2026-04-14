/**
 * ChatLayout.tsx — Main 2-pane chat layout.
 *
 * Sidebar (left) + active chat (right). The active chat is composed of:
 *   ChatHeader (top)  + MessageList (middle)  + MessageComposer (bottom)
 *
 * Picks the right table (cwa_chat for General, cwa_dm_chat for DMs) and
 * passes data down to children.
 */

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import {
  ActiveUser, DMGroups, Employees, Messages, MessageInterface,
} from "@/stores/query";
import { useAppStore } from "@/stores/store";
import {
  Dialog, DialogContent, DialogTitle, DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";
import supabase from "@/MyComponents/supabase";

export const ChatLayout = () => {
  const { GroupName } = useAppStore();
  const { data: user } = ActiveUser();
  const { data: AllEmployees } = Employees();
  const { data: DmGroups } = DMGroups(user![0]?.username);
  const { data: messages, refetch: refetchMessages } = Messages(GroupName);

  // ── Realtime: refetch messages on any change for the CURRENT group ──
  // Subscribed to both tables but only the relevant one will fire for each
  // group (Supabase filter on dm_group for DM chats). Re-subscribes on
  // group change, with proper cleanup — no stale closures.
  useEffect(() => {
    if (!GroupName) return;

    const channelName = `messages-${GroupName}`;
    let channel;

    if (GroupName === "General") {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "cwa_chat" },
          () => refetchMessages()
        )
        .subscribe();
    } else {
      channel = supabase
        .channel(channelName)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "cwa_dm_chat",
            filter: `dm_group=eq.${GroupName}`,
          },
          () => refetchMessages()
        )
        .subscribe();
    }

    return () => { channel.unsubscribe(); };
  }, [GroupName, refetchMessages]);

  const username = user?.[0]?.username || "";
  const userAvatar = user?.[0]?.avatarName || "";
  const isGeneral = GroupName === "General";
  const table: "cwa_chat" | "cwa_dm_chat" = isGeneral ? "cwa_chat" : "cwa_dm_chat";

  // Build groups list with General at top
  const allGroups = [
    { id: "general", name: "General", type: "general" },
    ...(DmGroups || []),
  ];

  // Find active group meta for header
  const activeGroup = allGroups.find((g) => g.name === GroupName);
  const memberCount = (activeGroup as any)?.subscribers?.length || 0;

  return (
    <div className="flex h-[100dvh] w-full bg-black overflow-hidden">
      {/* Sidebar */}
      <ChatSidebar groups={allGroups} employees={AllEmployees || []} />

      {/* Active chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <AnimatePresence mode="wait">
          {GroupName ? (
            <motion.div
              key={GroupName}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col min-h-0"
            >
              <ChatHeader
                groupName={GroupName}
                isGeneral={isGeneral}
                memberCount={memberCount}
              />
              <MessageList
                messages={(messages || []) as MessageInterface[]}
                group={GroupName}
                currentUsername={username}
                table={table}
              />
              <MessageComposer
                group={GroupName}
                currentUsername={username}
                userAvatar={userAvatar}
                table={table}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center"
            >
              <div className="text-center max-w-sm">
                <div className="h-12 w-12 rounded-sm bg-red-500/[0.08] border border-red-500/15 mx-auto mb-4 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-red-400" />
                </div>
                <p className="text-[14px] text-white/40 font-medium mb-1">No conversation selected</p>
                <p className="text-[12px] text-white/20 mb-4">
                  Pick a conversation from the sidebar or start a new one
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="px-4 py-2 bg-red-500/[0.1] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[12px] font-medium rounded-sm transition-colors">
                      Start New Conversation
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogTitle className="text-white/85">New Conversation</DialogTitle>
                    <AddDMGroup Users={AllEmployees || []} />
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
