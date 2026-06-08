/**
 * fundraiseStore.ts — Cross-route entrypoint for the Fundraise module.
 *
 * Lets the global Cmd+K palette open a specific investor's drawer
 * from anywhere in the app (or filter the kanban to a stage),
 * without having to plumb props through the route tree.
 *
 * State:
 *   · activeInvestorId — drawer the FundraisePage will open
 *   · stageFilter      — if set, kanban (and grid in future) shows
 *                        only investors in this stage. Cleared via
 *                        clearStageFilter() or by setting null.
 *   · pendingViewMode  — if set, FundraisePage will flip to this
 *                        view ("grid" or "kanban") on next mount /
 *                        next render and then clear the pending
 *                        flag. Used by Cmd+K verbs like "show
 *                        investors by stage" which want to land
 *                        the operator on the kanban regardless of
 *                        their saved preference.
 *
 * The Cmd+K palette dispatches: navigate("/fundraise") then
 * openInvestor(id) / setStageFilter(stage) / setPendingViewMode.
 * FundraisePage's effects pick up the state when it mounts (or is
 * already mounted) and apply the side effects.
 */

import { create } from "zustand";
import type { InvestorPipelineStage } from "@/stores/investors";

export interface FundraiseStoreState {
  activeInvestorId: string | null;
  stageFilter: InvestorPipelineStage | null;
  pendingViewMode: "grid" | "kanban" | null;

  openInvestor: (id: string) => void;
  closeInvestor: () => void;

  setStageFilter: (stage: InvestorPipelineStage | null) => void;
  clearStageFilter: () => void;

  setPendingViewMode: (mode: "grid" | "kanban" | null) => void;
}

export const useFundraiseStore = create<FundraiseStoreState>((set) => ({
  activeInvestorId: null,
  stageFilter: null,
  pendingViewMode: null,

  openInvestor: (id) => set({ activeInvestorId: id }),
  closeInvestor: () => set({ activeInvestorId: null }),

  setStageFilter: (stage) => set({ stageFilter: stage }),
  clearStageFilter: () => set({ stageFilter: null }),

  setPendingViewMode: (mode) => set({ pendingViewMode: mode }),
}));
