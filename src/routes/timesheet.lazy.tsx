/**
 * /timesheet — Unified schedule + time-tracking surface.
 *
 * Replaces the older /schedule and /timetracking routes. Both of those
 * still exist as redirect shims so any bookmarks or in-app links keep
 * working.
 */

import TimesheetPage from "@/MyComponents/Timesheet/TimesheetPage";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/timesheet")({
  component: TimesheetPage,
});
