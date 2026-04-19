/**
 * /analytics — Chat analytics dashboard.
 * Gated to CEO/COO/CFO/Admin via UserView so the rest of the team
 * doesn't see aggregate activity stats.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { AnalyticsDashboard } from "@/MyComponents/Chat/AnalyticsDashboard";

function AnalyticsRoute() {
  return (
    <UserView userRole={[Role.CEO, Role.COO, Role.CFO, Role.Admin]}>
      <div className="h-[100dvh] w-full flex flex-col bg-background">
        <AnalyticsDashboard />
      </div>
    </UserView>
  );
}

export const Route = createLazyFileRoute("/analytics")({
  component: AnalyticsRoute,
});

export default AnalyticsRoute;
