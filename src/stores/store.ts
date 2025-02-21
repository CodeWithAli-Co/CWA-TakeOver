import { create } from "zustand";

type DialogState = "shown" | "closed";
type DialogDisplayer = "addDialog" | "editDialog" | null;

interface AppState {
  DM: any;
  broadcastID: string
  setBroadcastID: (broadcastID: string) => void
  resetBroadcastID: () => void
  pinCheck: string
  setPinCheck: (pinCheck: string) => void
  isLoggedIn: string
  setIsLoggedIn: (isLoggedIn: string) => void
  displayer: string
  setDisplayer: (displayer: string) => void
  resetDisplayer: () => void
  dialog: string
  setDialog: (dialog: string) => void
  DMGroupName: string
  setDMGroupName: (DMGroupName: string) => void
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
  setDialog: (dialog: string) => set({ dialog }),
  DMGroupName: '',
  setDMGroupName: (DMGroupName: string) => set({ DMGroupName })
}))

// Chat Store
interface ChatState {
  optionValue: any
  setOptionValue: (optionValue: any) => void
}

export const useChatStore = create<ChatState>()((set) => ({
  optionValue: [''],
  setOptionValue: (optionValue: any) => set({ optionValue })
}))
