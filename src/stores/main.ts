import { create } from "zustand";

interface AppState {
  test: string
  setTest: (test: string) => void
  resetTest: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  test: '',
  setTest: (test: string) => set({ test }),
  resetTest: () => set({ test: '' })
}))