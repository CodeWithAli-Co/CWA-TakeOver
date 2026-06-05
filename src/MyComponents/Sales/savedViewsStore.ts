/**
 * savedViewsStore.ts — named filter snapshots per entity, persisted
 * to localStorage so they survive reloads and reopens.
 *
 * A "view" is just a name + an opaque filter blob. The store doesn't
 * care what's in the blob — the caller (ContactsView, PipelineView,
 * etc.) serializes its current filter state on save, and deserializes
 * + applies the filters on load. That keeps the store generic and
 * lets each entity decide what's worth saving.
 *
 * Why not URL state? URLs are great for "the thing I'm currently
 * looking at" but bad for "the workflows I want to come back to".
 * Operators want to bookmark "my open SQL leads" and pick it from a
 * menu, not memorize a URL.
 *
 * Stored shape:
 *   { contacts: [{id, name, filters, createdAt}], pipeline: [...] }
 *
 * The persist middleware writes JSON to localStorage under
 * "cwa-sales-saved-views".
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SavedViewEntity = "contacts" | "pipeline" | "companies";

export interface SavedView {
  id: string;
  name: string;
  /** Opaque filter blob — shape is defined by the entity that owns
   *  this view. Stored as a plain object so JSON round-trip works. */
  filters: Record<string, unknown>;
  createdAt: string;
}

interface SavedViewsState {
  views: Record<SavedViewEntity, SavedView[]>;
  addView: (entity: SavedViewEntity, name: string, filters: Record<string, unknown>) => SavedView;
  removeView: (entity: SavedViewEntity, id: string) => void;
  /** Rename a saved view — used by the inline edit in the menu. */
  renameView: (entity: SavedViewEntity, id: string, name: string) => void;
}

const EMPTY: Record<SavedViewEntity, SavedView[]> = {
  contacts: [],
  pipeline: [],
  companies: [],
};

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useSavedViews = create<SavedViewsState>()(
  persist(
    (set) => ({
      views: EMPTY,
      addView: (entity, name, filters) => {
        const view: SavedView = {
          id: makeId(),
          name: name.trim() || "Untitled view",
          filters,
          createdAt: new Date().toISOString(),
        };
        set((s) => ({
          views: {
            ...s.views,
            [entity]: [...(s.views[entity] ?? []), view],
          },
        }));
        return view;
      },
      removeView: (entity, id) =>
        set((s) => ({
          views: {
            ...s.views,
            [entity]: (s.views[entity] ?? []).filter((v) => v.id !== id),
          },
        })),
      renameView: (entity, id, name) =>
        set((s) => ({
          views: {
            ...s.views,
            [entity]: (s.views[entity] ?? []).map((v) =>
              v.id === id ? { ...v, name: name.trim() || v.name } : v,
            ),
          },
        })),
    }),
    {
      name: "cwa-sales-saved-views",
      // Migrate older shapes that may have missing entity keys —
      // safer than nuking the user's saved views on schema change.
      migrate: (persisted, _version) => {
        const p = (persisted ?? {}) as { views?: Partial<typeof EMPTY> };
        return {
          views: { ...EMPTY, ...(p.views ?? {}) },
        };
      },
      version: 1,
    },
  ),
);
