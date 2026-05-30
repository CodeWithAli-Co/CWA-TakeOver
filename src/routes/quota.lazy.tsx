/**
 * /quota — Legacy route, redirects into /operations?tab=quotas.
 *
 * Kept so existing bookmarks + sidebar entries still work while we
 * migrate consumers to /operations directly.
 */

import { createLazyFileRoute, Navigate } from "@tanstack/react-router";

function QuotaRedirect() {
  return (
    <Navigate to={"/operations" as any} search={{ tab: "quotas" }} replace />
  );
}

export const Route = createLazyFileRoute("/quota")({
  component: QuotaRedirect,
});
