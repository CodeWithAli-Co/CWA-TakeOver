/**
 * chatStore.ts — Chat-specific state with localStorage persistence.
 *
 * Tracks:
 *   - unreadCounts / lastReadAt      → sidebar badges
 *   - replyingTo (transient)         → reply-quote pill in composer
 *   - typingByGroup (transient)      → typing indicator presence
 *   - activeThreadRootId (transient) → which thread is open
 *   - threadStyle (persisted)        → "sidepanel" | "inline"
 *   - pinCollapsed (persisted)       → pinned-bar collapsed state per group
 *   - recentEmojis (persisted)       → 16 most-recent emojis for the picker
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThreadStyle = "sidepanel" | "inline";

interface TypingUser {
  username: string;
  expiresAt: number;
}

interface ReplyTarget {
  msgId: number;
  sentBy: string;
  preview: string;
}

interface ChatStoreState {
  unreadCounts: Record<string, number>;
  lastReadAt: Record<string, string>;
  totalUnread: () => number;
  incrementUnread: (group: string) => void;
  markRead: (group: string) => void;
  resetAllUnread: () => void;
  setUnreadCount: (group: string, count: number) => void;

  replyingTo: ReplyTarget | null;
  setReplyingTo: (target: ReplyTarget | null) => void;

  typingByGroup: Record<string, TypingUser[]>;
  setTyping: (group: string, users: TypingUser[]) => void;

  activeThreadRootId: number | null;
  setActiveThreadRootId: (id: number | null) => void;

  threadStyle: ThreadStyle;
  setThreadStyle: (s: ThreadStyle) => void;

  pinCollapsed: Record<string, boolean>;
  togglePinCollapsed: (group: string) => void;

  recentEmojis: string[];
  pushRecentEmoji: (emoji: string) => void;
}

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      unreadCounts: {},
      lastReadAt: {},

      totalUnread: () =>
        Object.values(get().unreadCounts).reduce((s, n) => s + n, 0),

      incrementUnread: (group) =>
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [group]: (state.unreadCounts[group] || 0) + 1,
          },
        })),

      markRead: (group) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [group]: 0 },
          lastReadAt: {
            ...state.lastReadAt,
            [group]: new Date().toISOString(),
          },
        })),

      resetAllUnread: () => set({ unreadCounts: {} }),

      setUnreadCount: (group, count) =>
        set((state) => ({
          unreadCounts: { ...state.unreadCounts, [group]: count },
        })),

      replyingTo: null,
      setReplyingTo: (target) => set({ replyingTo: target }),

      typingByGroup: {},
      setTyping: (group, users) =>
        set((state) => ({
          typingByGroup: { ...state.typingByGroup, [group]: users },
        })),

      activeThreadRootId: null,
      setActiveThreadRootId: (id) => set({ activeThreadRootId: id }),

      threadStyle: "sidepanel",
      setThreadStyle: (s) => set({ threadStyle: s }),

      pinCollapsed: {},
      togglePinCollapsed: (group) =>
        set((state) => ({
          pinCollapsed: {
            ...state.pinCollapsed,
            [group]: !state.pinCollapsed[group],
          },
        })),

      recentEmojis: [],
      pushRecentEmoji: (emoji) =>
        set((state) => {
          const next = [
            emoji,
            ...state.recentEmojis.filter((e) => e !== emoji),
          ].slice(0, 16);
          return { recentEmojis: next };
        }),
    }),
    {
      name: "cwa-chat-store",
      partialize: (state) => ({
        unreadCounts: state.unreadCounts,
        lastReadAt: state.lastReadAt,
        threadStyle: state.threadStyle,
        pinCollapsed: state.pinCollapsed,
        recentEmojis: state.recentEmojis,
      }),
    },
  ),
);
