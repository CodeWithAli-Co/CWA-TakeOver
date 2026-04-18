/**
 * ChatLayout.tsx — Main 3-pane chat layout.
 *
 *   Sidebar (left)
 *   · Active chat (middle): ChatHeader + PinnedBar + MessageList + MessageComposer
 *   · ThreadPanel (right, only when threadStyle="sidepanel" + activeThreadRootId set)
 *
 * Owns:
 *   · realtime subscription for the current group (messages table)
 *   · lookup maps for thread reply counts + pinned messages
 *   · passes onOpenThread/onTogglePin/canPin down to MessageBubble via MessageList
 */

import { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { ThreadPanel } from "./ThreadPanel";
import { PinnedBar } from "./PinnedBar";
import {
  ActiveUser, DMGroups, Employees, Messages, MessageInterface,
} from "@/stores/query";
import { useAppStore } from "@/stores/store";
import { useChatStore } from "@/stores/chatStore";
import {
  Dialog, DialogContent, DialogTitle, DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";
import supabase from "@/MyComponents/supabase";

const ADMIN_ROLES = ["CEO", "COO", "CFO", "Admin"];

export const ChatLayout = () => {
  const { GroupName } = useAppStore();
  const { data: user } = ActiveUser();
  const { data: AllEmployees } = Employees();
  const { data: DmGroups } = DMGroups(user![0]?.username);
  const { data: messages, refetch: refetchMessages } = Messages(GroupName);

  const {
    activeThreadRootId, setActiveThreadRootId, threadStyle,
  } = useChatStore();

  // ── Realtime: refetch messages on any change for the CURRENT group ──
  useEffect(() => {
    if (!GroupName) return;
    const channelName = `messages-${GroupName}`;
    const channel =
      GroupName === "General"
        ? supabase
            .channel(channelName)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "cwa_chat" },
              () => refetchMessages(),
            )
            .subscribe()
        : supabase
            .channel(channelName)
            .on(
              "postgres_changes",
              {
                event: "*",
                schema: "public",
                table: "cwa_dm_chat",
                filter: `dm_group=eq.${GroupName}`,
              },
              () => refetchMessages(),
            )
            .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [GroupName, refetchMessages]);

  // Close thread when switching groups
  useEffect(() => {
    setActiveThreadRootId(null);
  }, [GroupName, setActiveThreadRootId]);

  const username = user?.[0]?.username || "";
  const userRole = (user?.[0] as any)?.role ?? "";
  const userAvatar = user?.[0]?.avatarName || "";
  const isGeneral = GroupName === "General";
  const table: "cwa_chat" | "cwa_dm_chat" = isGeneral ? "cwa_chat" : "cwa_dm_chat";
  const canPin = ADMIN_ROLES.includes(userRole);

  const allGroups = [
    { id: "general", name: "General", type: "general" },
    ...(DmGroups || []),
  ];
  const activeGroup = allGroups.find((g) => g.name === GroupName);
  const memberCount = (activeGroup as any)?.subscribers?.length || 0;

  // Derived: thread reply counts + pinned messages from current messages window.
  // (For full-history pins, PinnedBar could subscribe separately — v1 uses the
  // window, which is plenty for the most-recent 10-item fetch.)
  const msgs = (messages || []) as MessageInterface[];

  const threadReplyCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const m of msgs) {
      if (m.thread_root_id != null) {
        map.set(m.thread_root_id, (map.get(m.thread_root_id) ?? 0) + 1);
      }
    }
    return map;
  }, [msgs]);

  const pinnedMessages = useMemo(
    () => msgs.filter((m) => m.pinned_at).sort((a, b) => (a.pinned_at! > b.pinned_at! ? -1 : 1)),
    [msgs],
  );

  const activeThreadRoot = activeThreadRootId
    ? msgs.find((m) => m.msg_id === activeThreadRootId) ?? null
    : null;

  const recentForAxon = msgs.slice(-6).map((m) => ({
    sender: m.sent_by,
    text: m.message || "",
  }));

  // ── Action handlers --------------------------------------------------
  const togglePin = async (m: MessageInterface) => {
    const nextPin = m.pinned_at ? null : new Date().toISOString();
    const payload = nextPin
      ? { pinned_at: nextPin, pinned_by: username }
      : { pinned_at: null, pinned_by: null };
    const { error } = await supabase.from(table).update(payload).eq("msg_id", m.msg_id);
    if (error) {
      console.error("[pin] toggle failed:", error.message);
    }
  };

  const jumpTo = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const reactToMessage = async (msgId: number, emoji: string) => {
    const m = msgs.find((x) => x.msg_id === msgId);
    if (!m) return;
    const reactions: Record<string, string[]> = { ...(m.reactions || {}) };
    const users = reactions[emoji] || [];
    if (users.includes(username)) {
      reactions[emoji] = users.filter((u) => u !== username);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji] = [...users, username];
    }
    const { error } = await supabase.from(table).update({ reactions }).eq("msg_id", msgId);
    if (error) console.warn("[reaction] update failed:", error.message);
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      {/* Left: channel sidebar */}
      <ChatSidebar groups={allGroups} employees={AllEmployees || []} />

      {/* Middle: active chat */}
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

              <PinnedBar
                pinnedMessages={pinnedMessages}
                group={GroupName}
                table={table}
                currentUsername={username}
                isAdmin={canPin}
                onJumpTo={jumpTo}
              />

              <MessageList
                messages={msgs}
                group={GroupName}
                currentUsername={username}
                table={table}
                onOpenThread={(m) => setActiveThreadRootId(m.msg_id)}
                onTogglePin={togglePin}
                canPin={canPin}
                threadReplyCounts={threadReplyCounts}
                threadStyle={threadStyle}
                userAvatar={userAvatar}
                onReactOverride={reactToMessage}
              />

              <MessageComposer
                group={GroupName}
                currentUsername={username}
                userAvatar={userAvatar}
                table={table}
                recentMessages={recentForAxon}
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
                <div className="h-12 w-12 rounded-sm bg-primary/[0.08] border border-primary/15 mx-auto mb-4 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <p className="text-[14px] text-muted-foreground/70 font-medium mb-1">No conversation selected</p>
                <p className="text-[12px] text-muted-foreground/60 mb-4">
                  Pick a conversation from the sidebar or start a new one
                </p>
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="px-4 py-2 bg-primary/10 hover:bg-primary/80/[0.15] border border-primary/20 text-primary text-[12px] font-medium rounded-sm transition-colors">
                      Start New Conversation
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogTitle className="text-foreground/85">New Conversation</DialogTitle>
                    <AddDMGroup Users={AllEmployees || []} />
                  </DialogContent>
                </Dialog>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: thread panel (only in sidepanel mode) */}
      {threadStyle === "sidepanel" && activeThreadRoot && GroupName && (
        <ThreadPanel
          rootMsg={activeThreadRoot}
          group={GroupName}
          currentUsername={username}
          userAvatar={userAvatar}
          table={table}
          onClose={() => setActiveThreadRootId(null)}
          allMessages={msgs}
          onReact={reactToMessage}
        />
      )}
    </div>
  );
};
