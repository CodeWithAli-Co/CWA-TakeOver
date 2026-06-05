/**
 * SavedViewsMenu — small "Views ▾" pill that lives next to a list
 * header. Click opens a dropdown with:
 *   · the entity's saved views (click to apply, X to delete)
 *   · "+ Save current view" — prompts for a name, saves the caller-
 *     supplied filter blob
 *
 * Generic over filter shape. The caller passes:
 *   · `entity` — which bucket to save into ("contacts", "pipeline", …)
 *   · `currentFilters` — the live filter state, snapshotted on save
 *   · `onApply(filters)` — applied when the operator picks a view
 *
 * No fancy outside-click detection: the dropdown is closed on the
 * same button toggle, on Escape, and on apply/delete. Keeps the
 * implementation tight.
 */

import { useEffect, useRef, useState } from "react";
import { Bookmark, Plus, X, Check } from "lucide-react";
import {
  useSavedViews,
  type SavedViewEntity,
  type SavedView,
} from "./savedViewsStore";

export const SavedViewsMenu: React.FC<{
  entity: SavedViewEntity;
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
  /** Active view id, if any — caller tracks this locally so the
   *  pill can show the current view name. Optional; the menu still
   *  works fine without it. */
  activeViewId?: string | null;
  onActiveViewChange?: (id: string | null) => void;
}> = ({ entity, currentFilters, onApply, activeViewId, onActiveViewChange }) => {
  const views = useSavedViews((s) => s.views[entity] ?? []);
  const addView = useSavedViews((s) => s.addView);
  const removeView = useSavedViews((s) => s.removeView);

  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Escape closes whatever's open (naming first, then the menu).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (naming) setNaming(false);
        else setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, naming]);

  useEffect(() => {
    if (naming) requestAnimationFrame(() => nameInputRef.current?.focus());
  }, [naming]);

  const activeView = activeViewId
    ? views.find((v) => v.id === activeViewId) ?? null
    : null;

  const handleSave = () => {
    const v = addView(entity, name, currentFilters);
    onActiveViewChange?.(v.id);
    setName("");
    setNaming(false);
    setOpen(false);
  };

  const handleApply = (view: SavedView) => {
    onApply(view.filters);
    onActiveViewChange?.(view.id);
    setOpen(false);
  };

  const handleRemove = (view: SavedView) => {
    removeView(entity, view.id);
    if (activeViewId === view.id) onActiveViewChange?.(null);
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 border text-[10.5px] font-mono uppercase tracking-[0.16em] rounded-md transition-colors ${
          activeView
            ? "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-200"
            : "border-white/[0.1] hover:border-white/[0.18] text-zinc-300 hover:text-zinc-100"
        }`}
        title={activeView ? `View: ${activeView.name}` : "Saved views"}
      >
        <Bookmark className="h-3 w-3" />
        {activeView ? activeView.name : "Views"}
        <span className="text-zinc-500">▾</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 z-30 w-64 rounded-lg border border-white/[0.1] bg-zinc-950 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Saved view rows */}
          <div className="max-h-72 overflow-y-auto">
            {views.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-zinc-600 italic">
                No saved views yet
              </p>
            ) : (
              views.map((v) => {
                const isActive = activeViewId === v.id;
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2 px-3 py-2 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.03] transition-colors ${
                      isActive ? "bg-emerald-500/[0.04]" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleApply(v)}
                      className="flex-1 flex items-baseline justify-between gap-2 text-left"
                    >
                      <span className={`text-[12px] ${isActive ? "text-emerald-200" : "text-zinc-200"} truncate`}>
                        {v.name}
                      </span>
                      {isActive && (
                        <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(v)}
                      className="text-zinc-600 hover:text-rose-300 transition-colors shrink-0"
                      title="Delete view"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Save current */}
          <div className="border-t border-white/[0.06]">
            {naming ? (
              <div className="flex items-center gap-2 px-3 py-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                  placeholder="View name…"
                  className="flex-1 bg-zinc-900 border border-white/[0.08] rounded-md px-2 py-1 text-[12px] text-zinc-100 outline-none focus:border-emerald-500/30 placeholder:text-zinc-600"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setNaming(false); setName(""); }}
                  className="text-zinc-500 hover:text-zinc-200 transition-colors"
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNaming(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-[11.5px] font-mono uppercase tracking-[0.16em] text-zinc-400 hover:text-emerald-300 hover:bg-emerald-500/[0.04] transition-colors"
              >
                <Plus className="h-3 w-3" />
                Save current view
              </button>
            )}
          </div>
        </div>
      )}

      {/* Backdrop that closes the menu when clicked. Sits behind the
          dropdown but above page content so any click outside the
          menu collapses it. */}
      {open && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => { setOpen(false); setNaming(false); }}
          aria-hidden
        />
      )}
    </div>
  );
};
