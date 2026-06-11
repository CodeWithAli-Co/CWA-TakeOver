/**
 * /jobs — Job Hunt. Personal day-job search + AI resume tailoring, built on the
 * same engine as the Fundraise module. Gated to leadership for now.
 */
import { createLazyFileRoute } from "@tanstack/react-router";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { JobHuntPage } from "@/MyComponents/JobHunt/JobHuntPage";

function JobsRoute() {
  return (
    <UserView userRole={[Role.CEO, Role.COO]}>
      <div className="h-[100dvh] w-full overflow-auto bg-background">
        <JobHuntPage />
      </div>
    </UserView>
  );
}

export const Route = createLazyFileRoute("/jobs")({
  component: JobsRoute,
});

export default JobsRoute;
