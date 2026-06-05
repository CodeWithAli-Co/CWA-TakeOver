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
import { useEffect } from "react";

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

// ────────────────────────────────────────────────
// useSalesDrawerUrl — two-way sync between the drawer store and URL
// search params (?deal=ID / ?contact=ID / ?company=ID).
//
// Why: shareable links + working back/forward + the bare URL reflects
// the visible state. Click "back" after opening a deal → drawer
// closes. Hit reload with ?company=abc → the company drawer reopens.
//
// Mounted once at SalesPage root. Two effects:
//   1. URL → store. Runs on mount + on popstate (back/forward
//      buttons fire popstate). Pulls the params and calls openX.
//   2. Store → URL. Subscribes to the store; whenever the active id
//      changes, pushes a new history entry with the matching params.
//
// Loop-avoidance: history.pushState does NOT fire popstate, so the
// store-driven push won't retrigger the URL-driven read. The URL-
// driven read sets store state, which kicks the store-driven push,
// but the comparison "newSearch === currentSearch" short-circuits
// it. Net: one round trip per real navigation, zero loops.
// ────────────────────────────────────────────────
const DRAWER_PARAMS = ["deal", "contact", "company"] as const;

function readSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function applyParamsToStore(params: URLSearchParams): void {
  const deal    = params.get("deal");
  const contact = params.get("contact");
  const company = params.get("company");
  const s = useSalesDrawer.getState();
  if (deal)    { if (s.activeDealId    !== deal)    s.openDeal(deal); return; }
  if (contact) { if (s.activeContactId !== contact) s.openContact(contact); return; }
  if (company) { if (s.activeCompanyId !== company) s.openCompany(company); return; }
  // No drawer-id params → close any open drawer (but only if one is
  // open, to avoid spurious store updates on every popstate).
  if (s.activeDealId || s.activeContactId || s.activeCompanyId) s.close();
}

export function useSalesDrawerUrl(): void {
  // URL → store.
  useEffect(() => {
    applyParamsToStore(readSearchParams());
    const onPop = () => applyParamsToStore(readSearchParams());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Store → URL.
  useEffect(() => {
    const unsub = useSalesDrawer.subscribe((state) => {
      const params = readSearchParams();
      // Clear any of our params, then set whichever (if any) is
      // currently active. Leave other params alone so we don't
      // stomp on URL state owned by other features.
      let mutated = false;
      for (const k of DRAWER_PARAMS) {
        if (params.has(k)) { params.delete(k); mutated = true; }
      }
      if      (state.activeDealId)    { params.set("deal",    state.activeDealId);    mutated = true; }
      else if (state.activeContactId) { params.set("contact", state.activeContactId); mutated = true; }
      else if (state.activeCompanyId) { params.set("company", state.activeCompanyId); mutated = true; }
      if (!mutated) return;
      const next = params.toString();
      const current = window.location.search.replace(/^\?/, "");
      if (next === current) return;
      const url = window.location.pathname + (next ? `?${next}` : "");
      window.history.pushState(null, "", url);
    });
    return unsub;
  }, []);
}

