import { create } from "zustand";

// App Store
interface AppState {
  pinCheck: string
  setPinCheck: (pinCheck: string) => void
  isLoggedIn: string
  setIsLoggedIn: (isLoggedIn: string) => void
  displayer: string
  setDisplayer: (displayer: string) => void
}

export const useAppStore = create<AppState>()((set) => ({
  pinCheck: 'false',
  setPinCheck: (pinCheck: string) => set({ pinCheck }),
  isLoggedIn: 'false',
  setIsLoggedIn: (isLoggedIn: string) => set({ isLoggedIn }),
  displayer: 'Employees',
  setDisplayer: (displayer: string) => set({ displayer })
}))