/**
 * workspace.lazy.tsx — Landing page for /workspace.
 *
 * Shows the user's docs + sheets in a list with create / recent / search
 * affordances. Clicking a row navigates to the detail route for that
 * resource. All the actual list rendering lives in WorkspacePage.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/MyComponents/Workspace/WorkspacePage";

function WorkspaceRoute() {
  return <WorkspacePage />;
}

export const Route = createLazyFileRoute("/workspace")({
  component: WorkspaceRoute,
});

export default WorkspaceRoute;
