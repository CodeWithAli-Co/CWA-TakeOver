/**
 * salesDrawerStore.ts — Single source of truth for which sales drawer
 * is currently open, across the whole /sales surface.
 *
 * Why this exists (was three separate useState calls before):
 *   · Cross-drawer navigation. Clicking the "Acme Inc" link in a deal
 *     drawer needs to hot-swap to the company drawer. With per-view
 *     useState that was impossible — the deal drawer lives inside
 *     PipelineView, the company drawer lives inside CompaniesView,
 *     and they couldn't see each other.
 *   · Tab independence. With drawers hoisted to SalesPage and bound
 *     to this store, opening a deal from the kanban then switching
 *     to Contacts keeps the deal drawer visible. Switching tabs no
 *     longer auto-closes the drawer because the drawer doesn't live
 *     under the tab content.
 *   · Mutual exclusion. At most one drawer is open at a time —
 *     `openX()` clears the other two. Keeps the UI focused.
 *
 * Use these accessors instead of touching the state directly:
 *   const open = useSalesDrawer((s) => s.openDeal);
 *   open(dealId);
 */

import { create } from "zustand";

export interface SalesDrawerState {
  activeDealId: string | null;
  activeContactId: string | null;
  activeCompanyId: string | null;
  openDeal: (id: string) => void;
  openContact: (id: string) => void;
  openCompany: (id: string) => void;
  close: () => void;
}

export const useSalesDrawer = create<SalesDrawerState>((set) => ({
  activeDealId: null,
  activeContactId: null,
  activeCompanyId: null,
  openDeal: (id) =>
    set({ activeDealId: id, activeContactId: null, activeCompanyId: null }),
  openContact: (id) =>
    set({ activeDealId: null, activeContactId: id, activeCompanyId: null }),
  openCompany: (id) =>
    set({ activeDealId: null, activeContactId: null, activeCompanyId: id }),
  close: () =>
    set({ activeDealId: null, activeContactId: null, activeCompanyId: null }),
}));
