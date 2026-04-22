/**
 * /onboarding — Hiring onboarding dashboard.
 *
 * Visible to anyone with an onboarding_instance against them (RLS
 * handles the filtering). Admins see every instance and can check
 * off employer-owned tasks; the new hire sees only their own and
 * can check off employee-owned tasks. Same UI for both audiences.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { OnboardingDashboard } from "@/MyComponents/Onboarding/OnboardingDashboard";

function OnboardingRoute() {
  return <OnboardingDashboard />;
}

export const Route = createLazyFileRoute("/onboarding")({
  component: OnboardingRoute,
});

export default OnboardingRoute;
