/**
 * workspace.sheets.$id.lazy.tsx — Spreadsheet detail route.
 *
 * Phase 1 stub — Univer integration ships in a dedicated session.
 * This route exists today so the doc <-> sheet navigation works and
 * we can create spreadsheet rows from the landing page.
 */

import { createLazyFileRoute, useParams } from "@tanstack/react-router";
import { SheetDetailPage } from "@/MyComponents/Workspace/SheetDetailPage";

function SheetRoute() {
  const { id } = useParams({ from: "/workspace/sheets/$id" });
  return <SheetDetailPage id={id} />;
}

export const Route = createLazyFileRoute("/workspace/sheets/$id")({
  component: SheetRoute,
});

export default SheetRoute;
