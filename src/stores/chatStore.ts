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
import { matchesKeyword as matchesKeywordPure } from "@/lib/chatNotify";

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

  // ── Slack-in-Chat selection ────────────────────────────────────
  // When activeSlackChannelId is set, ChatLayout renders
  // SlackChannelView in place of native MessageList/MessageComposer.
  // Selecting a Slack channel clears GroupName-based native selection
  // (and vice versa) so only one chat surface is ever active at a time.
  activeSlackChannelId: string | null;
  activeSlackChannelName: string | null;
  setActiveSlackChannel: (id: string | null, name?: string | null) => void;

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

  /** Sidebar channel categories. Channels not mentioned in any category
   *  render as "Ungrouped" above the category list. Per-user, persisted. */
  channelCategories: { id: string; name: string; collapsed: boolean; items: string[] }[];
  addChannelCategory: (name: string) => void;
  renameChannelCategory: (id: string, name: string) => void;
  removeChannelCategory: (id: string) => void;
  moveChannelToCategory: (groupName: string, categoryId: string | null) => void;
  toggleCategoryCollapsed: (id: string) => void;

  /** Starred messages — per-user bookmarks. */
  starredMessages: { msgId: number; group: string; table: "cwa_chat" | "cwa_dm_chat"; starredAt: string }[];
  toggleStarred: (m: { msgId: number; group: string; table: "cwa_chat" | "cwa_dm_chat" }) => void;
  isStarred: (msgId: number) => boolean;

  /** Custom presence label — "In a meeting until 3pm", etc. Empty = clear. */
  customStatus: string;
  customStatusExpiresAt: number | null; // ms epoch; null = no expiry
  setCustomStatus: (label: string, expiresAt?: number | null) => void;
  clearCustomStatus: () => void;

  /** Per-channel notification level:
   *    all       → toast on every message (default)
   *    mentions  → toast only when @mentioned or @here fires
   *    none      → fully muted, only unread badge updates
   */
  notifLevels: Record<string, "all" | "mentions" | "none">;
  setNotifLevel: (group: string, level: "all" | "mentions" | "none") => void;
  getNotifLevel: (group: string) => "all" | "mentions" | "none";

  /** Custom keyword alerts — any message containing one of these words
   *  (case-insensitive) always fires a toast, even in muted channels. */
  keywordAlerts: string[];
  addKeywordAlert: (word: string) => void;
  removeKeywordAlert: (word: string) => void;
  matchesKeyword: (text: string) => string | null;
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

      // ── Slack-in-Chat selection ──────────────────────────────────
      activeSlackChannelId: null,
      activeSlackChannelName: null,
      setActiveSlackChannel: (id, name = null) =>
        set({
          activeSlackChannelId: id,
          activeSlackChannelName: id ? name : null,
        }),

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

      channelCategories: [],
      addChannelCategory: (name) =>
        set((state) => ({
          channelCategories: [
            ...state.channelCategories,
            {
              id: crypto.randomUUID(),
              name: name.trim() || "New category",
              collapsed: false,
              items: [],
            },
          ],
        })),
      renameChannelCategory: (id, name) =>
        set((state) => ({
          channelCategories: state.channelCategories.map((c) =>
            c.id === id ? { ...c, name: name.trim() || c.name } : c,
          ),
        })),
      removeChannelCategory: (id) =>
        set((state) => ({
          channelCategories: state.channelCategories.filter((c) => c.id !== id),
        })),
      moveChannelToCategory: (groupName, categoryId) =>
        set((state) => ({
          channelCategories: state.channelCategories.map((c) => {
            // remove from all categories first
            const filteredItems = c.items.filter((g) => g !== groupName);
            if (categoryId != null && c.id === categoryId) {
              return { ...c, items: [...filteredItems, groupName] };
            }
            return { ...c, items: filteredItems };
          }),
        })),
      toggleCategoryCollapsed: (id) =>
        set((state) => ({
          channelCategories: state.channelCategories.map((c) =>
            c.id === id ? { ...c, collapsed: !c.collapsed } : c,
          ),
        })),

      starredMessages: [],
      toggleStarred: (m) =>
        set((state) => {
          const exists = state.starredMessages.some((s) => s.msgId === m.msgId);
          if (exists) {
            return {
              starredMessages: state.starredMessages.filter((s) => s.msgId !== m.msgId),
            };
          }
          return {
            starredMessages: [
              ...state.starredMessages,
              { ...m, starredAt: new Date().toISOString() },
            ],
          };
        }),
      isStarred: (msgId) =>
        get().starredMessages.some((s) => s.msgId === msgId),

      customStatus: "",
      customStatusExpiresAt: null,
      setCustomStatus: (label, expiresAt = null) =>
        set({ customStatus: label.trim(), customStatusExpiresAt: expiresAt }),
      clearCustomStatus: () =>
        set({ customStatus: "", customStatusExpiresAt: null }),

      notifLevels: {},
      setNotifLevel: (group, level) =>
        set((state) => ({
          notifLevels: { ...state.notifLevels, [group]: level },
        })),
      getNotifLevel: (group) => get().notifLevels[group] ?? "all",

      keywordAlerts: [],
      addKeywordAlert: (word) =>
        set((state) => {
          const w = word.trim().toLowerCase();
          if (!w || state.keywordAlerts.includes(w)) return state;
          return { keywordAlerts: [...state.keywordAlerts, w] };
        }),
      removeKeywordAlert: (word) =>
        set((state) => ({
          keywordAlerts: state.keywordAlerts.filter((w) => w !== word.toLowerCase()),
        })),
      // Delegates to the pure helper in @/lib/chatNotify so the
      // matching logic can be unit-tested without bringing up the
      // Zustand persist middleware. Behavior is identical — same
      // word-boundary semantics, same case-insensitive comparison,
      // same regex-escape of user-supplied keywords.
      matchesKeyword: (text) => matchesKeywordPure(text, get().keywordAlerts),
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
        channelCategories: state.channelCategories,
        starredMessages: state.starredMessages,
        customStatus: state.customStatus,
        customStatusExpiresAt: state.customStatusExpiresAt,
        notifLevels: state.notifLevels,
        keywordAlerts: state.keywordAlerts,
      }),
    },
  ),
);
