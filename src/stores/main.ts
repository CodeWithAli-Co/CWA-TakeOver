import { create } from "zustand";

interface AppState {
  loggedIn: boolean
  setLoggedIn: (loggedIn: boolean) => void
}

export const useAppStore = create<AppState>()((set) => ({
  loggedIn: false,
  setLoggedIn: (loggedIn: boolean) => set({ loggedIn })
}))