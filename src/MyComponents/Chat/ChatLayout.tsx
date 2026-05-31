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

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { ChatSidebar } from "./ChatSidebar";
import { ChatHeader } from "./ChatHeader";
import { MessageList } from "./MessageList";
import { MessageComposer } from "./MessageComposer";
import { ThreadPanel } from "./ThreadPanel";
import { PinnedBar } from "./PinnedBar";
import { ForwardDialog } from "./ForwardDialog";
import { CreateChannelDialog } from "./CreateChannelDialog";
import { StarredView } from "./StarredView";
import { ThreadsView } from "./ThreadsView";
import { WebhookManager } from "./WebhookManager";
import { announceHuddleStart, consumePendingHuddleJoin } from "./Huddle/HuddleRing";
import { useHuddleStore } from "@/stores/huddleStore";
import {
  parseReactionsMarker, stripReactionsMarker, encodeReactionsMarker,
} from "./MessageBubble";
import {
  ActiveUser, DMGroups, Employees, Messages, MessageInterface,
} from "@/stores/query";
import { useAppStore } from "@/stores/store";
import { useChatStore } from "@/stores/chatStore";
import {
  Dialog, DialogContent, DialogTitle, DialogTrigger,
} from "@/components/ui/shadcnComponents/dialog";
import { AddDMGroup } from "@/MyComponents/subForms/addDMGroup";
import { takeOversupabase } from "@/MyComponents/supabase";
import { displayLabelForDM, isDMKey } from "./displayName";

const ADMIN_ROLES = ["CEO", "COO", "CFO", "Admin"];

export const ChatLayout = () => {
  const { GroupName } = useAppStore();
  const { data: user } = ActiveUser();
  const { data: AllEmployees } = Employees();
  const { data: DmGroups } = DMGroups(user![0]?.username);
  const {
    data: messages,
    refetch: refetchMessages,
    isLoading: messagesLoading,
    isPlaceholderData: messagesStale,
  } = Messages(GroupName);

  const {
    activeThreadRootId, setActiveThreadRootId, threadStyle, markRead,
  } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [forwardSource, setForwardSource] = useState<MessageInterface | null>(null);
  const [createChannelOpen, setCreateChannelOpen] = useState(false);
  const [webhooksOpen, setWebhooksOpen] = useState(false);
  // Huddle state lives in a global store (huddleStore) so calls stay
  // active when the user navigates to other routes. ChatLayout only
  // reads `group` here to render the header toggle correctly.
  const huddleGroup = useHuddleStore((s) => s.group);
  const startHuddle = useHuddleStore((s) => s.startHuddle);
  const leaveHuddle = useHuddleStore((s) => s.leaveHuddle);

  // ── Realtime: refetch messages on any change for the CURRENT group ──
  useEffect(() => {
    if (!GroupName) return;
    const channelName = `messages-${GroupName}`;
    const channel =
      GroupName === "General"
        ? takeOversupabase
            .channel(channelName)
            .on(
              "postgres_changes",
              { event: "*", schema: "public", table: "cwa_chat" },
              () => refetchMessages(),
            )
            .subscribe()
        : takeOversupabase
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

  // User identity — derived once so the effects below can reference it.
  const username = user?.[0]?.username || "";
  const userRole = (user?.[0] as any)?.role ?? "";
  const userAvatar = user?.[0]?.avatarName || "";

  // Auto-join a huddle if the user clicked "Join" on a ring notification
  // while on another route — HuddleRing stashes the target group in
  // localStorage, we consume it here on mount / GroupName change.
  useEffect(() => {
    if (!GroupName) return;
    const pending = consumePendingHuddleJoin();
    if (pending && pending === GroupName) {
      startHuddle(pending);
      announceHuddleStart(pending, username).catch(() => {});
    }
  }, [GroupName, startHuddle, username]);
  const isGeneral = GroupName === "General";
  const table: "cwa_chat" | "cwa_dm_chat" = isGeneral ? "cwa_chat" : "cwa_dm_chat";
  const canPin = ADMIN_ROLES.includes(userRole);

  const allGroups = [
    { id: "general", name: "General", type: "general" },
    ...(DmGroups || []),
  ];
  const activeGroup = allGroups.find((g) => g.name === GroupName);
  const memberCount = (activeGroup as any)?.subscribers?.length || 0;

  // Members available for @mention autocomplete. For DMs = subscribers;
  // for General = all employee usernames.
  const channelMembers: string[] = (() => {
    const dmSubs = (activeGroup as any)?.subscribers as string[] | undefined;
    if (dmSubs && dmSubs.length > 0) return dmSubs;
    return (AllEmployees || [])
      .map((e: any) => e.username)
      .filter(Boolean) as string[];
  })();

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
  const editMessage = async (m: MessageInterface, nextText: string) => {
    // Preserve any embedded markers (reply / reactions) that sit at the top
    // of the current body; rewrite only the user-visible portion underneath.
    const current = m.message || "";
    let prefix = "";
    const rxMatch = current.match(/^\{rx:[^}]*\}\s*\n?/);
    if (rxMatch) prefix += rxMatch[0];
    const replyMatch = current.slice(prefix.length).match(/^\{reply:\d+\|[^}]+\}\s*\n?/);
    if (replyMatch) prefix += replyMatch[0];
    const nextBody = prefix + nextText;
    const { error } = await takeOversupabase
.from(table)
      .update({ message: nextBody })
      .eq("msg_id", m.msg_id);
    if (error) {
      console.error("[edit] update failed:", error.message);
      return;
    }
    refetchMessages();
  };

  const deleteMessage = async (m: MessageInterface) => {
    // Soft-delete: tombstone the body so reply references + timeline
    // continuity aren't broken.
    const { error } = await takeOversupabase
.from(table)
      .update({ message: "[message deleted]", image_urls: null })
      .eq("msg_id", m.msg_id);
    if (error) {
      // Fallback without image_urls if column missing
      const r2 = await takeOversupabase
  .from(table)
        .update({ message: "[message deleted]" })
        .eq("msg_id", m.msg_id);
      if (r2.error) {
        console.error("[delete] update failed:", r2.error.message);
        return;
      }
    }
    refetchMessages();
  };

  const togglePin = async (m: MessageInterface) => {
    const nextPin = m.pinned_at ? null : new Date().toISOString();
    const payload = nextPin
      ? { pinned_at: nextPin, pinned_by: username }
      : { pinned_at: null, pinned_by: null };
    const { error } = await takeOversupabase.from(table).update(payload).eq("msg_id", m.msg_id);
    if (error) {
      console.error("[pin] toggle failed:", error.message);
      return;
    }
    refetchMessages();
  };

  const jumpTo = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /**
   * Delete a DM channel from the sidebar + its message history. Two-step
   * confirm because this is destructive and there's no undo. The General
   * channel can never be deleted (guarded by the sidebar's canDelete).
   */
  const deleteChannel = async (group: { name: string; id?: string | number; type?: string }) => {
    if (group.type === "general") return;
    // Confirm prompt uses the display label so users see "Mason" or
    // "Mason, Sem" instead of the canonical "dm::Ali::Mason" key.
    const friendlyName = isDMKey(group.name)
      ? displayLabelForDM(group.name, username)
      : group.name;
    if (!window.confirm(
      `Delete "${friendlyName}" for everyone? All messages in this channel will be permanently removed.`,
    )) return;
    // Delete messages first so orphaned rows aren't left behind if the
    // group delete succeeds but the purge below fails.
    const purge = await takeOversupabase
.from("cwa_dm_chat")
      .delete()
      .eq("dm_group", group.name);
    if (purge.error) {
      console.warn("[chat] purge messages failed:", purge.error.message);
    }
    const { error } = await takeOversupabase
.from("dm_groups")
      .delete()
      .eq("name", group.name);
    if (error) {
      alert(`Could not delete: ${error.message}`);
      return;
    }
    // Switch off the deleted channel if we're currently viewing it.
    if (GroupName === group.name) {
      (useAppStore.getState() as any).setGroupName?.("General");
    }
  };

  const reactToMessage = async (msgId: number, emoji: string) => {
    const m = msgs.find((x) => x.msg_id === msgId);
    if (!m) return;

    // Compute next reactions state (toggle emoji for current user). Read the
    // current state from DB column first, falling back to the embedded marker
    // inside the message body.
    const fromColumn = m.reactions || {};
    const fromMarker = parseReactionsMarker(m.message || "");
    const current: Record<string, string[]> =
      Object.keys(fromColumn).length > 0 ? fromColumn : fromMarker;

    const next: Record<string, string[]> = { ...current };
    const users = next[emoji] || [];
    if (users.includes(username)) {
      next[emoji] = users.filter((u) => u !== username);
      if (next[emoji].length === 0) delete next[emoji];
    } else {
      next[emoji] = [...users, username];
    }

    // Try the DB column first.
    const col = await takeOversupabase
.from(table)
      .update({ reactions: next })
      .eq("msg_id", msgId);
    if (!col.error) {
      refetchMessages();
      return;
    }
    console.warn(
      "[reaction] column update failed, falling back to text marker:",
      col.error.message,
    );

    // Text-marker fallback: prepend {rx:...} to the message body. Preserves
    // the original body and every other embedded marker (reply, etc.).
    const bodyWithoutReactions = stripReactionsMarker(m.message || "");
    const nextBody = encodeReactionsMarker(next) + bodyWithoutReactions;
    const { error: textErr } = await takeOversupabase
.from(table)
      .update({ message: nextBody })
      .eq("msg_id", msgId);
    if (textErr) {
      console.error("[reaction] text-marker fallback failed:", textErr.message);
      return;
    }
    refetchMessages();
  };

  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      {/* Left: channel sidebar */}
      <ChatSidebar
        groups={allGroups}
        employees={AllEmployees || []}
        onCreateChannel={canPin ? () => setCreateChannelOpen(true) : undefined}
        onManageWebhooks={canPin ? () => setWebhooksOpen(true) : undefined}
        canDelete={canPin}
        onDeleteChannel={canPin ? deleteChannel : undefined}
      />

      {/* Middle: active chat */}
      <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {GroupName === "__starred__" ? (
            <motion.div
              key="starred"
              initial={{ opacity: 0, x: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -14, filter: "blur(4px)" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col min-h-0 min-w-0"
            >
              <StarredView
                currentUsername={username}
                onReact={reactToMessage}
              />
            </motion.div>
          ) : GroupName === "__threads__" ? (
            <motion.div
              key="threads"
              initial={{ opacity: 0, x: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -14, filter: "blur(4px)" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col min-h-0 min-w-0"
            >
              <ThreadsView currentUsername={username} />
            </motion.div>
          ) : GroupName ? (
            <motion.div
              key={GroupName}
              initial={{ opacity: 0, x: 14, filter: "blur(4px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -14, filter: "blur(4px)" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col min-h-0 min-w-0"
            >
              <ChatHeader
                groupName={GroupName}
                isGeneral={isGeneral}
                memberCount={memberCount}
                pinnedCount={pinnedMessages.length}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                onMarkAllRead={() => markRead(GroupName)}
                huddleActive={huddleGroup === GroupName}
                onToggleHuddle={() => {
                  if (huddleGroup === GroupName) {
                    leaveHuddle();
                  } else {
                    startHuddle(GroupName);
                    announceHuddleStart(GroupName, username).catch(() => {});
                  }
                }}
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
                messages={messagesLoading || messagesStale ? undefined : msgs}
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
                onEdit={editMessage}
                onDelete={deleteMessage}
                onForward={(m) => setForwardSource(m)}
                searchQuery={searchQuery}
              />

              <MessageComposer
                group={GroupName}
                currentUsername={username}
                userAvatar={userAvatar}
                table={table}
                recentMessages={recentForAxon}
                onAfterSend={refetchMessages}
                members={channelMembers}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
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


      {/* Create channel dialog (admin only) */}
      <CreateChannelDialog
        open={createChannelOpen}
        onOpenChange={setCreateChannelOpen}
        allEmployees={(AllEmployees || []).map((e: any) => e.username).filter(Boolean) as string[]}
        currentUsername={username}
      />

      {/* Webhook manager (admin only) */}
      <WebhookManager
        open={webhooksOpen}
        onOpenChange={setWebhooksOpen}
        groups={allGroups}
        currentUsername={username}
      />

      {/* HuddleBar is now mounted globally by HuddleHost in __root.tsx
       *  so the call survives route changes — nothing to render here. */}

      {/* Forward dialog */}
      <ForwardDialog
        open={forwardSource != null}
        onOpenChange={(v) => !v && setForwardSource(null)}
        source={forwardSource}
        sourceGroup={GroupName}
        groups={allGroups}
        currentUsername={username}
        userAvatar={userAvatar}
      />
    </div>
  );
};
