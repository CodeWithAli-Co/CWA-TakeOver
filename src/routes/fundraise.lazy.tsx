/**
 * /fundraise — Investor outreach + relationship pipeline.
 *
 * Standalone route (not a sub-tab of /sales) because the motion is
 * sufficiently distinct: this surface is for raising money, /sales
 * is for selling product. Same underlying CRM tables — different
 * working mode + different daily rhythm.
 *
 * Phase 1 ships:
 *   - Investor list + grid + detail drawer
 *   - Manual add via modal (Axon-powered "find" lands in Phase 2)
 *
 * RLS gates the actual row visibility. Sidebar requiredRoles gates
 * the nav entry per role-datas.tsx (CEO/COO/CFO/Head of Growth).
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { FundraisePage } from "@/MyComponents/Fundraise/FundraisePage";

function FundraiseRoute() {
  return <FundraisePage />;
}

export const Route = createLazyFileRoute("/fundraise")({
  component: FundraiseRoute,
});

export default FundraiseRoute;
