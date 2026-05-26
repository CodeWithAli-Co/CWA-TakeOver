/**
 * workspace.lazy.tsx — Layout for /workspace and its children.
 *
 * Renders just an <Outlet/>. The actual landing-page UI lives in
 * workspace.index.lazy.tsx; the doc + sheet detail pages live in their
 * own files. This split is what makes TanStack Router pick the right
 * child to render for each URL — without an Outlet here, navigating
 * to /workspace/docs/$id would render the landing page (the parent's
 * component) and silently drop the child.
 */

import { createLazyFileRoute, Outlet } from "@tanstack/react-router";

function WorkspaceLayout() {
  return <Outlet />;
}

export const Route = createLazyFileRoute("/workspace")({
  component: WorkspaceLayout,
});

export default WorkspaceLayout;
