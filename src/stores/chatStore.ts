/**
 * chatStore.ts — Chat-specific state with localStorage persistence.
 *
 * Tracks:
 *   - unreadCounts:  { [groupName]: number }  → for sidebar badges
 *   - lastReadAt:    { [groupName]: ISO timestamp } → to detect new msgs
 *   - replyingTo:    transient — message being replied to in composer
 *   - typingUsers:   { [groupName]: { user, expiresAt }[] } → from presence
 *
 * Counts persist across reloads via Zustand persist middleware.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TypingUser {
  username: string;
  expiresAt: number; // ms timestamp
}

interface ReplyTarget {
  msgId: number;
  sentBy: string;
  preview: string; // first 60 chars of message
}

interface ChatStoreState {
  unreadCounts: Record<string, number>;
  lastReadAt: Record<string, string>; // ISO date string
  totalUnread: () => number;
  incrementUnread: (group: string) => void;
  markRead: (group: string) => void;
  resetAllUnread: () => void;
  setUnreadCount: (group: string, count: number) => void;

  // Transient (not persisted)
  replyingTo: ReplyTarget | null;
  setReplyingTo: (target: ReplyTarget | null) => void;

  typingByGroup: Record<string, TypingUser[]>;
  setTyping: (group: string, users: TypingUser[]) => void;
}

export const useChatStore = create<ChatStoreState>()(
  persist(
    (set, get) => ({
      unreadCounts: {},
      lastReadAt: {},

      totalUnread: () => Object.values(get().unreadCounts).reduce((s, n) => s + n, 0),

      incrementUnread: (group) => set((state) => ({
        unreadCounts: {
          ...state.unreadCounts,
          [group]: (state.unreadCounts[group] || 0) + 1,
        },
      })),

      markRead: (group) => set((state) => ({
        unreadCounts: { ...state.unreadCounts, [group]: 0 },
        lastReadAt: { ...state.lastReadAt, [group]: new Date().toISOString() },
      })),

      resetAllUnread: () => set({ unreadCounts: {} }),

      setUnreadCount: (group, count) => set((state) => ({
        unreadCounts: { ...state.unreadCounts, [group]: count },
      })),

      // Transient (not persisted via partialize)
      replyingTo: null,
      setReplyingTo: (target) => set({ replyingTo: target }),

      typingByGroup: {},
      setTyping: (group, users) => set((state) => ({
        typingByGroup: { ...state.typingByGroup, [group]: users },
      })),
    }),
    {
      name: "cwa-chat-store",
      // Only persist the long-lived counts/timestamps, not transient state
      partialize: (state) => ({
        unreadCounts: state.unreadCounts,
        lastReadAt: state.lastReadAt,
      }),
    }
  )
);
