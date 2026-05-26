/**
 * workspace.index.lazy.tsx — The /workspace landing page.
 *
 * This file matches the URL exactly `/workspace` (no further path
 * segments). The outer layout (workspace.lazy.tsx) renders <Outlet/>;
 * the Outlet picks this file when the URL is exactly /workspace, and
 * picks workspace.docs.$id or workspace.sheets.$id otherwise.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { WorkspacePage } from "@/MyComponents/Workspace/WorkspacePage";

function WorkspaceIndexRoute() {
  return <WorkspacePage />;
}

export const Route = createLazyFileRoute("/workspace/")({
  component: WorkspaceIndexRoute,
});

export default WorkspaceIndexRoute;
