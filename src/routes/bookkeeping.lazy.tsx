// /bookkeeping route — Bookkeeping module entry point.
// Lives in src/routes/ so TanStack Router auto-registers it; the
// component itself lives under src/Bookkeeping/ui/.

import { createLazyFileRoute } from "@tanstack/react-router";
import BookkeepingRoot from "@/Bookkeeping/ui/BookkeepingRoot";

function BookkeepingRoute() {
  return <BookkeepingRoot />;
}

// routeTree.gen.ts regenerates on dev-server start (TanStack Vite
// plugin). Until then, /bookkeeping isn't in FileRoutesByPath, so
// the @ts-expect-error suppresses the transient error.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error route tree pending regeneration on next dev-server start
export const Route = createLazyFileRoute("/bookkeeping")({
  component: BookkeepingRoute,
});

export default BookkeepingRoute;
