/**
 * roadmap.lazy.tsx — Sovereign Roadmap
 *
 * Living command surface across Fundraising, CodeWithAli, SimplicityFunds,
 * Takeover, Brand & Marketing, and Ops & People lanes. Gated to CEO, COO,
 * and CFO via UserView.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { RoadmapPage } from "@/MyComponents/Roadmap/RoadmapPage";

function RoadmapRoute() {
  return (
    <UserView userRole={[Role.CEO, Role.COO, Role.CFO]}>
      <RoadmapPage />
    </UserView>
  );
}

export const Route = createLazyFileRoute("/roadmap")({
  component: RoadmapRoute,
});
