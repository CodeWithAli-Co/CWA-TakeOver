/**
 * /onboarding — full-screen onboarding workspace.
 *
 * Wrapper is intentionally minimal: full height, no padding. The
 * OnboardingPipelinePanel manages its own internal layout (sidebar +
 * detail) so it can claim the whole viewport without padding fighting
 * its own internal column widths.
 *
 * Legacy OnboardingDashboard (src/MyComponents/Onboarding/) is NOT
 * mounted here — it pulled from onboarding_instances with hardcoded
 * placeholder timelines. The new pipeline reads real candidates +
 * Axon assessments + meetings.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { OnboardingPipelinePanel } from "@/MyComponents/Hiring/OnboardingPipelinePanel";

function OnboardingRoute() {
  return (
    <div className="h-full bg-zinc-950">
      <OnboardingPipelinePanel />
    </div>
  );
}

export const Route = createLazyFileRoute("/onboarding")({
  component: OnboardingRoute,
});

export default OnboardingRoute;
