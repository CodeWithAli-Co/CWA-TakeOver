/**
 * /reports — Leadership inbox for all team-submitted reports.
 * Elevated roles only (CEO / COO / CFO / Admin). RLS enforces
 * the same gate server-side.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { ReportsHub } from "@/MyComponents/Reports/ReportsHub";

function ReportsRoute() {
  return (
    <UserView userRole={[Role.CEO, Role.COO, Role.CFO, Role.Admin]}>
      <ReportsHub />
    </UserView>
  );
}

export const Route = createLazyFileRoute("/reports")({
  component: ReportsRoute,
});

export default ReportsRoute;
