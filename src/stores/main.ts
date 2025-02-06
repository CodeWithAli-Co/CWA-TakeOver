import { create } from "zustand";

// App Store
interface AppState {
  loggedIn: boolean
  setLoggedIn: (loggedIn: boolean) => void
  displayer: string
  setDisplayer: (displayer: string) => void
}

export const useAppStore = create<AppState>()((set) => ({
  loggedIn: false,
  setLoggedIn: (loggedIn: boolean) => set({ loggedIn }),
  displayer: 'Employees',
  setDisplayer: (displayer: string) => set({ displayer })
}))