/**
 * /admin/observatory — The Observatory.
 *
 * Internal system-surveillance dashboard: the whole stack (cwa_manager +
 * takeover_b2b) on one screen — every store, wire, table, route, risk, and
 * what-if, rendered from src/admin/observatory/data/manifest.ts.
 *
 * This page is a map of the system's weaknesses, so it is gated to the
 * leadership/admin roles via UserView. Keep it out of any customer-facing
 * build. Regenerate the manifest after big merges (see the Observatory README).
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import Observatory from "@/admin/observatory/Observatory";

function AdminObservatoryRoute() {
  return (
    <UserView userRole={[Role.CEO, Role.COO, Role.CFO, Role.Admin]}>
      <div className="h-[100dvh] w-full overflow-auto bg-background">
        <Observatory />
      </div>
    </UserView>
  );
}

export const Route = createLazyFileRoute("/admin/observatory")({
  component: AdminObservatoryRoute,
});

export default AdminObservatoryRoute;
