import { create } from "zustand";

type DialogState = "shown" | "closed";
type DialogDisplayer = "addDialog" | "editDialog" | null;

interface AppState {
  // Broadcast related
  broadcastID: string;
  setBroadcastID: (broadcastID: string) => void;
  resetBroadcastID: () => void;

  // Auth related
  pinCheck: string;
  setPinCheck: (pinCheck: string) => void;
  isLoggedIn: string;
  setIsLoggedIn: (isLoggedIn: string) => void;

  // Dialog and Display related - combined both systems
  displayer: DialogDisplayer;
  setDisplayer: (displayer: DialogDisplayer) => void;
  resetDisplayer: () => void;
  dialog: DialogState;
  setDialog: (dialog: DialogState) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  // Broadcast state
  broadcastID: '',
  setBroadcastID: (broadcastID: string) => set({ broadcastID }),
  resetBroadcastID: () => set({ broadcastID: '' }),

  // Auth state
  pinCheck: 'false',
  setPinCheck: (pinCheck: string) => set({ pinCheck }),
  isLoggedIn: 'false',
  setIsLoggedIn: (isLoggedIn: string) => set({ isLoggedIn }),

  // Dialog and Display state - combined implementation
  displayer: null,
  setDisplayer: (displayer: DialogDisplayer) => set({ displayer }),
  resetDisplayer: () => set({ displayer: null }),
  dialog: 'closed',
  setDialog: (dialog: DialogState) => set({ dialog })
}));