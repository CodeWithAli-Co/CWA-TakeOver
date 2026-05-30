/**
 * /welcome — first-launch user onboarding wizard.
 *
 * Note: NOT to be confused with `/onboarding`, which is the
 * candidate-onboarding (hiring pipeline) page. This route is
 * about onboarding the operator INTO the app on first run —
 * identity fork → founder/employee flow → land on dashboard.
 *
 * Branch logic (founder vs employee vs done) is owned by
 * OnboardingPage which reads `useOnboardingState`.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { OnboardingPage } from "@/MyComponents/Onboarding/OnboardingPage";

export const Route = createLazyFileRoute("/welcome")({
  component: OnboardingPage,
});
