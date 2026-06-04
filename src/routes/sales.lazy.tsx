/**
 * /sales — Native CRM landing page.
 *
 * First-class business module replacing the HubSpot connector that
 * was originally planned. See docs/SALES_CRM_ARCHITECTURE.md for the
 * full architectural proposal.
 *
 * Day 3 ships: route shell + sub-tab strip + editorial bento landing
 *              page with KPI strip placeholders. Pipeline, contacts,
 *              companies, and activity tabs render a "coming soon"
 *              card with their own ship dates.
 *
 * Visible to: everyone with access to the workspace. RLS gates the
 *             actual rows; sidebar `requiredRoles` gates the nav
 *             entry per role-datas.tsx.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { SalesPage } from "@/MyComponents/Sales/SalesPage";

function SalesRoute() {
  return <SalesPage />;
}

export const Route = createLazyFileRoute("/sales")({
  component: SalesRoute,
});

export default SalesRoute;
