/**
 * /components — CWA Registry home. Gallery of components + templates
 * sourced from Takeover's own Supabase (no separate registry project).
 *
 * Per-item company tag; CEO sees everything. No UserView gate —
 * full access for all authenticated users.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { RegistryDashboard } from "@/MyComponents/Registry/RegistryDashboard";

function ComponentsRoute() {
  return <RegistryDashboard />;
}

export const Route = createLazyFileRoute("/components")({
  component: ComponentsRoute,
});

export default ComponentsRoute;
