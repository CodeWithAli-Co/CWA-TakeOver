/**
 * OnboardingDebugButton.tsx — TEMPORARY floating debug button.
 *
 * Two affordances:
 *   · "Open welcome" — navigate straight to /welcome regardless
 *     of onboarded_at state. Lets you see the flow without
 *     having to UPDATE a Supabase column first.
 *   · "Reset + open" — clear your `onboarded_at` + `role` so the
 *     real auto-redirect fires too, exercising the production
 *     code path end-to-end.
 *
 * Remove from __root.tsx before shipping. Marked clearly with
 * a yellow tint and the word "Debug" so it doesn't get
 * mistaken for production UI.
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles, RotateCcw, ChevronUp, X } from "lucide-react";
import supabase from "@/MyComponents/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { ActiveUser } from "@/stores/query";

export function OnboardingDebugButton() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: user } = ActiveUser();
  const supaId = user?.[0]?.supa_id;
  const [open, setOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // No supa_id means we're on login/auth screens — hide the
  // button rather than dangle a non-functional control.
  if (!supaId) return null;

  const openWelcome = () => {
    navigate({ to: "/welcome" as any });
    setOpen(false);
  };

  const resetAndOpen = async () => {
    setResetting(true);
    const { error } = await supabase
      .from("app_users")
      .update({
        onboarded_at: null,
        role: null,
        onboarding_state: null,
      })
      .eq("supa_id", supaId);
    setResetting(false);
    if (error) {
      console.error("[debug] reset failed", error);
      alert(`Reset failed: ${error.message}`);
      return;
    }
    // Bust the cached branch lookup so the next render reflects
    // the freshly cleared state.
    qc.invalidateQueries({ queryKey: ["onboarding-state"] });
    navigate({ to: "/welcome" as any });
    setOpen(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[300] flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-2xl border border-warning/40 bg-background shadow-2xl p-2 min-w-[220px]">
          <div className="px-2 pt-1 pb-2 flex items-center justify-between">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-warning">
              Debug · Onboarding
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-text-tertiary hover:text-foreground"
              aria-label="Close debug menu"
            >
              <X size={12} />
            </button>
          </div>

          <button
            type="button"
            onClick={openWelcome}
            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-foreground/[0.05] flex items-center gap-2 text-[12px] text-foreground"
          >
            <Sparkles size={13} className="text-primary shrink-0" />
            <span className="flex-1">Open /welcome</span>
          </button>

          <button
            type="button"
            onClick={resetAndOpen}
            disabled={resetting}
            className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-foreground/[0.05] flex items-center gap-2 text-[12px] text-foreground disabled:opacity-60"
          >
            {resetting ? (
              <Loader2 size={13} className="animate-spin shrink-0 text-text-tertiary" />
            ) : (
              <RotateCcw size={13} className="text-warning shrink-0" />
            )}
            <span className="flex-1">
              {resetting ? "Resetting…" : "Reset + open"}
            </span>
          </button>

          <p className="text-[10px] text-text-tertiary px-2.5 pt-1 pb-1 leading-relaxed">
            Reset clears your onboarded_at + role so the auto-redirect fires
            for real. Don't run on a real account you care about.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full bg-warning/15 hover:bg-warning/25 text-warning border border-warning/40 text-[11px] font-semibold shadow-lg transition-colors"
        title="Onboarding debug"
      >
        <ChevronUp
          size={11}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
        Debug
      </button>
    </div>
  );
}
