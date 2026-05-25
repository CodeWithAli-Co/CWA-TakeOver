/**
 * /timetracking — Legacy URL. The standalone time-tracking dashboard has
 * been merged with the schedule into the unified /timesheet page. This
 * route is kept as a shim so any in-app links and bookmarks keep working.
 */

import TimesheetPage from "@/MyComponents/Timesheet/TimesheetPage";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/timetracking")({
  component: TimesheetPage,
});
