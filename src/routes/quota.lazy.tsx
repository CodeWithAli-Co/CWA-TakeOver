/**
 * /quota — Legacy URL, redirects to the unified /operations dashboard.
 *
 * Weekly quotas live inside the Operations dashboard now — there is
 * no standalone quotas page. Bookmarks and existing in-app links
 * still resolve via this redirect.
 */

import { createLazyFileRoute, Navigate } from "@tanstack/react-router";

function QuotaRedirect() {
  return <Navigate to={"/operations" as any} replace />;
}

export const Route = createLazyFileRoute("/quota")({
  component: QuotaRedirect,
});
