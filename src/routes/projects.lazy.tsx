/**
 * /projects — Top-level route for the Projects board.
 *
 * Same shape as /workspace and /growth: a thin lazy route file
 * that mounts the page component. RLS enforces C-level write
 * gating in Supabase; the page also gates UI affordances client-
 * side so non-C-level users see "view only" rather than a
 * failing button.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/MyComponents/Projects/ProjectsPage";

function ProjectsRoute() {
  return <ProjectsPage />;
}

export const Route = createLazyFileRoute("/projects")({
  component: ProjectsRoute,
});

export default ProjectsRoute;
