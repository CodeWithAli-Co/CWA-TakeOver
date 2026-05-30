/**
 * /projects — Legacy URL, redirects to the unified /operations dashboard.
 *
 * Projects live inside the Operations dashboard now — there is no
 * standalone projects page. Bookmarks and existing in-app links
 * still resolve via this redirect.
 */

import { createLazyFileRoute, Navigate } from "@tanstack/react-router";

function ProjectsRedirect() {
  return <Navigate to={"/operations" as any} replace />;
}

export const Route = createLazyFileRoute("/projects")({
  component: ProjectsRedirect,
});
