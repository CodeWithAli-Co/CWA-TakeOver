/**
 * workspace.docs.$id.lazy.tsx — Doc detail route.
 *
 * Loads the workspace_documents row with this id and hands it to the
 * DocEditor (TipTap). The editor handles its own debounced save loop.
 */

import { createLazyFileRoute, useParams } from "@tanstack/react-router";
import { DocDetailPage } from "@/MyComponents/Workspace/DocDetailPage";

function DocRoute() {
  const { id } = useParams({ from: "/workspace/docs/$id" });
  return <DocDetailPage id={id} />;
}

export const Route = createLazyFileRoute("/workspace/docs/$id")({
  component: DocRoute,
});

export default DocRoute;
