/**
 * /task — Legacy route, redirects into /operations?tab=tasks.
 *
 * Kept around so existing bookmarks and the (transient) sidebar
 * entries still work while we migrate every consumer to point at
 * /operations directly.
 */

import { createLazyFileRoute, Navigate } from "@tanstack/react-router";

function TaskRedirect() {
  return <Navigate to={"/operations" as any} search={{ tab: "tasks" }} replace />;
}

export const Route = createLazyFileRoute("/task")({
  component: TaskRedirect,
});
