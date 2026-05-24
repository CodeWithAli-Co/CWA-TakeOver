/**
 * /schedule — Team schedule + upcoming hiring meetings.
 *
 * Two stacked sections:
 *   1. Upcoming hiring meetings widget — NEW. Surfaces the next few
 *      candidate meetings (interviews + kickoffs + check-ins) from
 *      the candidate_meetings table written by the /apply →
 *      /hiring → /onboarding pipeline.
 *   2. EmployeeSchedule — existing employee calendar view.
 */

import EmployeeSchedule from "@/MyComponents/NewSchedule";
import { UpcomingHiringMeetingsWidget } from "@/MyComponents/Hiring/UpcomingHiringMeetingsWidget";
import { createLazyFileRoute } from "@tanstack/react-router";

function SchedulePage() {
  return (
    <div className="flex flex-col gap-4 p-4 bg-black min-h-full">
      <UpcomingHiringMeetingsWidget days={14} />
      <EmployeeSchedule />
    </div>
  );
}

export const Route = createLazyFileRoute("/schedule")({
  component: SchedulePage,
});
