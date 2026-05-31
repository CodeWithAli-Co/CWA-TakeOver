import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  initial_launch: boolean;
  completeInitialLaunch: () => void;
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

export const useAppStore = create<AppState>()(persist((set) => ({
  // First App Launch
  initial_launch: true,
  completeInitialLaunch: () => set({ initial_launch: false }),

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
}),
{
  name: "persistent-app-store",
  partialize: (state) => ({ initial_launch: state.initial_launch })
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


// Role Preview — lets CEO/COO preview what other roles see
interface RolePreviewState {
  previewRole: string | null; // null = no preview active, string = previewing that role
  setPreviewRole: (role: string | null) => void;
}
export const useRolePreview = create<RolePreviewState>()((set) => ({
  previewRole: null,
  setPreviewRole: (previewRole: string | null) => set({ previewRole }),
}));

// Company Filter — scopes the entire dashboard to a single company or "all"
// Persisted to localStorage so refresh doesn't reset the toggle.
// Also applies [data-company] to <html> for the CSS theme system.
export type CompanyFilter = "all" | "codeWithAli" | "simplicityFunds";
interface CompanyFilterState {
  activeCompany: CompanyFilter;
  setActiveCompany: (company: CompanyFilter) => void;
}

const applyCompanyTheme = (company: CompanyFilter) => {
  // "all" and "codeWithAli" both use the CWA theme; "simplicityFunds" uses the Simplicity theme
  const themeKey = company === "simplicityFunds" ? "simplicityFunds" : "codeWithAli";
  document.documentElement.setAttribute("data-company", themeKey);
};

export const useCompanyFilter = create<CompanyFilterState>()(
  persist(
    (set) => ({
      activeCompany: "codeWithAli",
      setActiveCompany: (activeCompany: CompanyFilter) => {
        applyCompanyTheme(activeCompany);
        set({ activeCompany });
      },
    }),
    {
      name: "cwa-company-filter",
      onRehydrate: (_state, _options) => {
        // After rehydration, apply the theme immediately
        return (rehydratedState) => {
          if (rehydratedState) {
            applyCompanyTheme(rehydratedState.activeCompany);
          }
        };
      },
    }
  )
);

// Display Schedule Pic. *This is prob getting removed after adding pop-up function/component
interface SchedImgState {
  isShowing: boolean,
  setIsShowing: (isShowing: boolean) => void
}
export const SchedImgStore = create<SchedImgState>()((set) => ({
  isShowing: false,
  setIsShowing: (isShowing: boolean) => set({ isShowing })
}))
