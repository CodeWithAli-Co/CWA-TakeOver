/**
 * /inbox — Email landing page.
 *
 * Lazy-loaded entry point. The page itself lives in
 * MyComponents/Inbox/InboxPage.tsx — this file is just the route
 * binding so TanStack Router's codegen picks it up.
 *
 * Visible to: everyone in the sidebar. Sends require a connected
 *             Gmail account (the page surfaces a Connect CTA when
 *             not connected — no hidden failure mode).
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/MyComponents/Inbox/InboxPage";

function InboxRoute() {
  return <InboxPage />;
}

export const Route = createLazyFileRoute("/inbox")({
  component: InboxRoute,
});

export default InboxRoute;
