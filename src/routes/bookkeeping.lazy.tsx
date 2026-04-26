// /bookkeeping route — Bookkeeping module entry point.
// Lives in src/routes/ so TanStack Router auto-registers it; the
// component itself lives under src/Bookkeeping/ui/.

import { createLazyFileRoute } from "@tanstack/react-router";
import BookkeepingRoot from "@/Bookkeeping/ui/BookkeepingRoot";

function BookkeepingRoute() {
  return <BookkeepingRoot />;
}

export const Route = createLazyFileRoute("/bookkeeping")({
  component: BookkeepingRoute,
});

export default BookkeepingRoute;
