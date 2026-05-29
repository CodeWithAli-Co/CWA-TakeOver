/**
 * /strategy — Strategic Intelligence destination (C-level only).
 *
 * The four-tab Intelligence / Revenue / Mission Control / Daily
 * Briefing panel that used to live as Row 3 of the home dashboard
 * has been promoted to its own page. Moving it off home solved two
 * problems: (1) the dashboard felt cluttered with a 4-paradigm
 * data viz block in the middle, (2) most of its surfaces are mock
 * pending real cwa_clients / cwa_pipeline / cwa_initiatives tables
 * — keeping it on a destination route makes the "deep dive" intent
 * explicit and lets the queries land without restructuring home.
 *
 * Role gating: client-side via the StrategyPage shell + sidebar
 * `requiredRoles` (only the CEO / COO / CFO / Admin slices of
 * role-datas.tsx surface the nav entry).
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { StrategyPage } from "@/MyComponents/Strategy/StrategyPage";

function StrategyRoute() {
  return <StrategyPage />;
}

export const Route = createLazyFileRoute("/strategy")({
  component: StrategyRoute,
});

export default StrategyRoute;
