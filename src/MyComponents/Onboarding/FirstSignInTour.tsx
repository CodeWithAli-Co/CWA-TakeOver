// ───────────────────────────────────────────────────────────────────
// FirstSignInTour — auto-fires the role-aware tour on first sign-in.
//
// Replaces the previous Welcome-modal-plus-task-list onboarding for
// users themselves. The tour itself is the entire experience: as soon
// as a brand-new (or never-toured) user signs in, the right step set
// for their role plays automatically.
//
// Once the user finishes / skips, tourStore stamps `seen: true` to
// localStorage and this component does nothing on every subsequent
// sign-in. The user can replay manually from the Onboarding page's
// "Take a tour" button (which calls start with reset: true).
//
// Notes:
//   • This component renders nothing — it's purely an effect host.
//   • The actual UI lives in <GuidedTourOverlay /> which is mounted
//     once at the app root.
//   • Auto-launch is a one-shot: we use a ref so role changes mid-
//     session don't restart the tour mid-stream.
// ───────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { ActiveUser } from "@/stores/query";
import { useTourStore } from "./tourStore";
import { getTourStopsForRole } from "./tourSteps";

export function FirstSignInTour() {
  const { data: user } = ActiveUser();
  const role = user?.[0]?.role as string | undefined;

  const seen = useTourStore((s) => s.seen);
  const active = useTourStore((s) => s.active);
  const start = useTourStore((s) => s.start);

  // Have we already kicked off the tour during this mount? Don't loop
  // even if `seen` flips back to false mid-session (e.g. devtools).
  const launched = useRef(false);

  useEffect(() => {
    // Wait until we actually have a user record. Without this the
    // tour might fire with an unknown role and use the wrong step set.
    if (!role) return;
    if (seen) return;
    if (active) return;
    if (launched.current) return;
    launched.current = true;
    // Defer one tick so the router + sidebar have mounted. Otherwise
    // the tour navigates to /financialDashboard before the chrome is
    // ready and the operator sees a flash of the empty dashboard.
    const id = window.setTimeout(() => {
      const stops = getTourStopsForRole(role);
      start(stops);
    }, 400);
    return () => window.clearTimeout(id);
  }, [role, seen, active, start]);

  return null;
}
