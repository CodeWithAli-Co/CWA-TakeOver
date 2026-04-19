/**
 * /offers — Employment offer-letter drafter, admin-only.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { OfferLettersDashboard } from "@/MyComponents/OfferLetters/OfferLettersDashboard";

function OffersRoute() {
  return (
    <UserView userRole={[Role.CEO, Role.COO, Role.CFO, Role.Admin]}>
      <OfferLettersDashboard />
    </UserView>
  );
}

export const Route = createLazyFileRoute("/offers")({
  component: OffersRoute,
});

export default OffersRoute;
