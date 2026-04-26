// ───────────────────────────────────────────────────────────────────
// Active-entity store — which entity the operator is currently working
// in. Drives EntitySwitcher in the header; every report / list reads
// this so a single global switch scopes the whole module.
// ───────────────────────────────────────────────────────────────────

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ENTITY_IDS } from "../data/seedEntities";

interface ActiveEntityState {
  activeEntityId: string;
  setActiveEntity: (id: string) => void;
}

export const useActiveEntity = create<ActiveEntityState>()(
  persist(
    (set) => ({
      activeEntityId: ENTITY_IDS.CWA,
      setActiveEntity: (id) => set({ activeEntityId: id }),
    }),
    { name: "bookkeeping.activeEntity" },
  ),
);
