import { createLazyFileRoute } from "@tanstack/react-router";
import TrainingPlanDashboard from "@/MyComponents/Sidebar/TrainingPlan/TrainingPlanDashboard";

function TrainingPlan() {
  return <TrainingPlanDashboard />;
}

export const Route = createLazyFileRoute("/trainingplan")({
  component: TrainingPlan,
});
