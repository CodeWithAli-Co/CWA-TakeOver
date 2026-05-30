/**
 * /operations — Unified operations hub.
 *
 * Single editorial surface that hosts three tabs: Tasks, Weekly
 * Quotas, and Projects. The legacy routes (/task, /quota,
 * /projects) redirect into here with `?tab=tasks|quotas|projects`
 * so existing sidebar links + bookmarks keep working.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { OperationsHub } from "@/MyComponents/Operations/OperationsHub";

function OperationsRoute() {
  return <OperationsHub />;
}

export const Route = createLazyFileRoute("/operations")({
  component: OperationsRoute,
});

export default OperationsRoute;
