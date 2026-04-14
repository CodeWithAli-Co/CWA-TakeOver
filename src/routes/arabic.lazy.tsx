import { createLazyFileRoute } from "@tanstack/react-router";
import ArabicDashboardRoute from "@/MyComponents/Arabic/components/ArabicDashboard";

export const Route = createLazyFileRoute("/arabic")({
  component: ArabicDashboardRoute,
});
