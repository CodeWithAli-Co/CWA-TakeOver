/**
 * /schedule — Legacy URL. The schedule has been merged with time tracking
 * into the unified /timesheet page. This route is kept as a shim so any
 * in-app links, bookmarks, or external references keep working.
 */

import TimesheetPage from "@/MyComponents/Timesheet/TimesheetPage";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/schedule")({
  component: TimesheetPage,
});
