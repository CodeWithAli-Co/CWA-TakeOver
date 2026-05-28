/**
 * /growth — Career growth detail view.
 *
 * Every signed-in user sees their own approved track with a
 * step-by-step timeline + progress. CEO/COO/CFO additionally see
 * a Team Tracks section showing every employee's track with edit
 * affordances.
 *
 * Linked from the home dashboard's CareerGrowthCard "View
 * breakdown" footer button.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { GrowthPage } from "@/MyComponents/Growth/GrowthPage";

function GrowthRoute() {
  return <GrowthPage />;
}

export const Route = createLazyFileRoute("/growth")({
  component: GrowthRoute,
});
