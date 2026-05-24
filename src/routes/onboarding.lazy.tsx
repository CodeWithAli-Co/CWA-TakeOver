/**
 * /onboarding — Hiring onboarding dashboard.
 *
 * Single source of truth: OnboardingPipelinePanel reads the
 * candidates table (status in offer / hired) and surfaces every
 * post-offer hire with their real Axon score + 30/60/90 plan +
 * meetings. Buttons hit the Axon onboarding actions.
 *
 * The legacy OnboardingDashboard (1353 lines, tied to the older
 * onboarding_instances + offer_letters tables) is intentionally
 * NOT mounted here anymore. It contained hardcoded placeholder
 * timeline labels ("Scored X 94/100", "Sent welcome packet")
 * that pre-dated real Axon scoring, plus carried over duplicate
 * test instances from development. The component still lives in
 * src/MyComponents/Onboarding/OnboardingDashboard.tsx — mount it
 * at /onboarding/legacy or any other route if you need it back.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { OnboardingPipelinePanel } from "@/MyComponents/Hiring/OnboardingPipelinePanel";

function OnboardingRoute() {
  // Don't force min-h-full on the wrapper — when the pipeline is empty,
  // that just creates a huge void below the card. App background is
  // already black, so the page bleeds naturally to fit content.
  return (
    <div className="p-6 bg-black">
      <OnboardingPipelinePanel />
    </div>
  );
}

export const Route = createLazyFileRoute("/onboarding")({
  component: OnboardingRoute,
});

export default OnboardingRoute;
