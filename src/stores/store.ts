import { create } from "zustand";

// App Store
interface AppState {
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
}

export const useAppStore = create<AppState>()((set) => ({
  broadcastID: '',
  setBroadcastID: (broadcastID: string) => set({ broadcastID }),
  resetBroadcastID: () => set({ broadcastID: '' }),
  pinCheck: 'false',
  setPinCheck: (pinCheck: string) => set({ pinCheck }),
  isLoggedIn: 'false',
  setIsLoggedIn: (isLoggedIn: string) => set({ isLoggedIn }),
  displayer: 'Employees',
  setDisplayer: (displayer: string) => set({ displayer }),
  resetDisplayer: () => set({ displayer: 'Employees' }),
  dialog: 'closed',
  setDialog: (dialog: string) => set({ dialog })
}))