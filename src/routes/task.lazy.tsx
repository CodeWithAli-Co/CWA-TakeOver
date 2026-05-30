/**
 * /task — Legacy URL, redirects to the unified /operations dashboard.
 *
 * Tasks live inside the Operations dashboard now — there is no
 * standalone tasks page. Bookmarks and existing in-app links still
 * resolve via this redirect.
 */

import { createLazyFileRoute, Navigate } from "@tanstack/react-router";

function TaskRedirect() {
  return <Navigate to={"/operations" as any} replace />;
}

export const Route = createLazyFileRoute("/task")({
  component: TaskRedirect,
});
