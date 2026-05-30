/**
 * /projects — Legacy route, redirects into /operations?tab=projects.
 *
 * Kept so existing bookmarks + sidebar entries still work while we
 * migrate consumers to /operations directly.
 */

import { createLazyFileRoute, Navigate } from "@tanstack/react-router";

function ProjectsRedirect() {
  return (
    <Navigate
      to={"/operations" as any}
      search={{ tab: "projects" }}
      replace
    />
  );
}

export const Route = createLazyFileRoute("/projects")({
  component: ProjectsRedirect,
});
