import { create } from "zustand";

interface AppState {
  broadcastID: string;
  setBroadcastID: (broadcastID: string) => void;
  resetBroadcastID: () => void;
  pinCheck: string;
  setPinCheck: (pinCheck: string) => void;
  isLoggedIn: string;
  setIsLoggedIn: (isLoggedIn: string) => void;
 
  displayer: string;
  setDisplayer: (displayer: string) => void;
  resetDisplayer: () => void;
  dialog: string;
  setDialog: (dialog: string) => void;
  GroupName: string;
  setGroupName: (GroupName: string) => void;
  DBUsed: number;
  setDBSize: (DBUsed: number) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  // Broadcast state
  broadcastID: "",
  setBroadcastID: (broadcastID: string) => set({ broadcastID }),
  resetBroadcastID: () => set({ broadcastID: "" }),

  // Auth state
  pinCheck: "false",
  setPinCheck: (pinCheck: string) => set({ pinCheck }),
  isLoggedIn: "false",
  setIsLoggedIn: (isLoggedIn: string) => set({ isLoggedIn }),


  displayer: "Employees",
  setDisplayer: (displayer: string) => set({ displayer }),
  resetDisplayer: () => set({ displayer: "" }),
  dialog: "closed",
  setDialog: (dialog: string) => set({ dialog }),

  // Group Chat State
  GroupName: "General",
  setGroupName: (GroupName: string) => set({ GroupName }),

  // DBUsed
  DBUsed: 0,
  setDBSize: (DBUsed: number) => set({ DBUsed }),
}));

// Chat Store
interface ChatState {
  optionValue: any;
  setOptionValue: (optionValue: any) => void;
}

export const useChatStore = create<ChatState>()((set) => ({
  optionValue: [""],
  setOptionValue: (optionValue: any) => set({ optionValue }),
}));

// Multiselect Store
interface MultiselectState {
  optionsValue: any;
  setOptionsValue: (optionsValue: any) => void;
}
export const useMultiSelectStore = create<MultiselectState>()((set) => ({
  optionsValue: [""],
  setOptionsValue: (optionsValue: any) => set({ optionsValue }),
}));

// Sub Menus
interface SubMenuState {
  showPromote: string
  setShowPromote: (showPromote: string) => void
  resetPromote: () => void
}
export const useSubMenuStore = create<SubMenuState>()((set) => ({
  showPromote: 'hidden',
  setShowPromote: (showPromote: string) => set({ showPromote }),
  resetPromote: () => set({ showPromote: 'hidden' })
}))


// Display Schedule Pic. *This is prob getting removed after adding pop-up function/component
interface SchedImgState {
  isShowing: boolean,
  setIsShowing: (isShowing: boolean) => void
}
export const SchedImgStore = create<SchedImgState>()((set) => ({
  isShowing: false,
  setIsShowing: (isShowing: boolean) => set({ isShowing })
}))
