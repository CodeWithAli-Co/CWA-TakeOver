/**
 * liveHuddlesStore — global "who's in which huddle right now" state.
 *
 * Populated by a single Supabase Realtime presence channel subscribed
 * to in HuddleHost (mounted at the app root). Every logged-in client
 * tracks `{ huddle: currentGroup | null }` on the lobby; readers (the
 * chat sidebar, the header, etc.) consume the resulting map without
 * needing to open the huddle channel itself.
 *
 * Critically: each store update creates a NEW Map reference. Zustand
 * shallow-compares by ref, and React shallow-compares object props.
 * Mutating in place would silently break re-renders on sub-components.
 */

import { create } from "zustand";

interface LiveHuddlesStore {
  /** channel name → list of usernames currently in that huddle */
  byChannel: Map<string, string[]>;
  setByChannel: (next: Map<string, string[]>) => void;
}

export const useLiveHuddlesStore = create<LiveHuddlesStore>((set) => ({
  byChannel: new Map(),
  setByChannel: (next) => set({ byChannel: next }),
}));

/** Convenience selector — usernames currently in the named huddle.
 *  Empty array if no one is huddled there. */
export function getHuddleParticipants(channel: string): string[] {
  return useLiveHuddlesStore.getState().byChannel.get(channel) ?? [];
}
