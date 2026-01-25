import TimeTrackingPage from "@/MyComponents/TimeTracking/TimeTrackingPage";
import { createLazyFileRoute } from "@tanstack/react-router";

function TimeTracking() {
  return (
    <>
      <TimeTrackingPage />
    </>
  );
}

export const Route = createLazyFileRoute("/timetracking")({
  component: TimeTracking,
});
