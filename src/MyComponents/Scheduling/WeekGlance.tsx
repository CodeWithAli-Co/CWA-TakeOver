import React from "react";
import { DayData } from "./ScheduleComponents";
import { EventCard } from "./ScheduleContext";

interface WeekGlanceProps {
  days: DayData[];
  selectedDay: number | null;
}

// Week Glance Component - Shows upcoming activities for the week
export const WeekGlance: React.FC<WeekGlanceProps> = ({ days, selectedDay }) => {
  // Get upcoming events for the week
  const upcomingEvents = React.useMemo(() => {
    const upcoming: { day: DayData; event: DayData["events"][0]; employeeName?: string }[] = [];
    
    days.forEach((day, index) => {
      // In admin mode, show all events including the selected day
      // For employee mode, skip the currently selected day
      const { isAdminMode } = useSchedule();
      if (!isAdminMode && index === selectedDay) return;
      
      // Add events for days
      day.events.forEach(event => {
        // For admin view, we can add employee info if available in the event
        upcoming.push({ 
          day, 
          event,
          employeeName: event.employeeName || undefined
        });
      });
    });
    
    // Sort by date (days are already in order)
    return upcoming;
  }, [days, selectedDay]);
  
  if (upcomingEvents.length === 0) {
    return null;
  }
  
  const { isAdminMode } = useSchedule();
  
  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-red-100 mb-3">
        {isAdminMode ? "All Scheduled Shifts" : "Other Activities This Week"}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {upcomingEvents.slice(0, isAdminMode ? upcomingEvents.length : 6).map((item, index) => (
          <div key={index} className="flex flex-col">
            <div className="text-xs text-red-400 mb-1 flex justify-between">
              <span>{item.day.dayName}, {item.day.date}</span>
              {isAdminMode && item.employeeName && (
                <span className="font-medium">{item.employeeName}</span>
              )}
            </div>
            <EventCard event={item.event} />
          </div>
        ))}
      </div>
    </div>
  );
};

function useSchedule(): { isAdminMode: any; } {
    throw new Error("Function not implemented.");
}
