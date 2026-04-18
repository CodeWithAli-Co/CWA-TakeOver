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

export type PresenceStatus = "online" | "away" | "offline";

interface PresenceEntry {
  /** ms timestamp of last heartbeat */
  lastSeen: number;
}

interface ChatStoreState {
  unreadCounts: Record<string, number>;
  lastReadAt: Record<string, string>;
  totalUnread: () => number;
  incrementUnread: (group: string) => void;
  markRead: (group: string) => void;
  resetAllUnread: () => void;
  setUnreadCount: (group: string, count: number) => void;

  // Presence (transient)
  presenceByUser: Record<string, PresenceEntry>;
  setPresence: (username: string, lastSeen: number) => void;
  setPresenceMany: (entries: Record<string, PresenceEntry>) => void;
  presenceStatus: (username: string) => PresenceStatus;

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

  /** Custom emoji registry — `:shortcode:` → image URL. */
  customEmojis: Record<string, string>;
  setCustomEmoji: (shortcode: string, url: string) => void;
  removeCustomEmoji: (shortcode: string) => void;
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

      presenceByUser: {},
      setPresence: (username, lastSeen) =>
        set((state) => ({
          presenceByUser: {
            ...state.presenceByUser,
            [username]: { lastSeen },
          },
        })),
      setPresenceMany: (entries) =>
        set((state) => ({
          presenceByUser: { ...state.presenceByUser, ...entries },
        })),
      presenceStatus: (username) => {
        const entry = get().presenceByUser[username];
        if (!entry) return "offline";
        const age = Date.now() - entry.lastSeen;
        if (age < 60_000) return "online";       // < 1 min
        if (age < 5 * 60_000) return "away";    // < 5 min
        return "offline";
      },

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

      customEmojis: {},
      setCustomEmoji: (shortcode, url) =>
        set((state) => ({
          customEmojis: { ...state.customEmojis, [shortcode]: url },
        })),
      removeCustomEmoji: (shortcode) =>
        set((state) => {
          const next = { ...state.customEmojis };
          delete next[shortcode];
          return { customEmojis: next };
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
        customEmojis: state.customEmojis,
      }),
    },
  ),
);
