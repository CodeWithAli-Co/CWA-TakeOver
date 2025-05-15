import React from "react";
import { DayData, EventType } from "./ScheduleComponents";

interface ScheduleGridProps {
  week: DayData[];
  selectedDay: number | null;
  setSelectedDay: (day: number) => void;
  isAdminMode: boolean;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  week,
  selectedDay,
  setSelectedDay,
  isAdminMode
}) => {
  // Function to render an event with the appropriate styling
  const renderEvent = (event: EventType, eventIndex: number) => {
    const getTypeStyles = (): string => {
      switch (event.type) {
        case 'shift':
          return 'bg-red-900/40 hover:bg-red-900/60 text-white';
        case 'training':
          return 'bg-emerald-900/40 hover:bg-emerald-900/60 text-white';
        case 'break':
          return 'bg-blue-900/40 hover:bg-blue-900/60 text-white';
        case 'meeting':
          return 'bg-purple-900/40 hover:bg-purple-900/60 text-white';
        default:
          return 'bg-gray-800/40 hover:bg-gray-800/60 text-gray-300';
      }
    };

    // Create event badge based on time of day
    const renderEventBadge = () => {
      if (event.title.includes("Morning")) {
        return <span className="ml-2 px-2 py-0.5 text-xs bg-green-700 text-white rounded">low</span>;
      } else if (event.title.includes("Afternoon")) {
        return <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-600 text-white rounded">medium</span>;
      } else if (event.title.includes("Evening")) {
        return <span className="ml-2 px-2 py-0.5 text-xs bg-red-700 text-white rounded">high</span>;
      }
      return null;
    };

    return (
      <div key={eventIndex} className="mb-2 group">
        <div 
          className={`px-2 py-1 text-xs rounded transition-colors duration-150 ${getTypeStyles()} 
            ${event.isRequested ? 'border border-yellow-500' : ''}`}
          onClick={(e) => {
            // Allow editing in admin mode by using the global editShift function
            if (isAdminMode && typeof window !== 'undefined' && window.editShift) {
              e.stopPropagation();
              window.editShift({
                id: event.id,
                type: event.type,
                title: event.title,
                timeRange: event.timeRange,
                employeeName: event.employeeName || '',
                employeeId: event.employeeId || 0,
                dayIndex: selectedDay !== null ? selectedDay : undefined
              });
            }
          }}
        >
          <div className="font-medium truncate flex items-center justify-between">
            <span>{isAdminMode ? (event.employeeName || "Unassigned") : event.title}</span>
            {renderEventBadge()}
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span>{event.timeRange}</span>
            {isAdminMode && event.type !== 'off' && 
              <span className="text-xs opacity-70">{event.title}</span>
            }
          </div>
          {event.isRequested && (
            <div className="mt-1 text-xs text-yellow-300 flex items-center">
              <span>⚠ Change requested</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-6 border border-red-900/30 rounded-lg overflow-hidden mb-6">
      <div className="bg-red-900/20 border-b border-red-900/30 px-4 py-2">
        <h3 className="text-white font-medium">Weekly Schedule Overview</h3>
      </div>
      
      {/* Calendar Header */}
      <div className="grid grid-cols-7 border-b border-red-900/30">
        {week.map((day, index) => (
          <div 
            key={index} 
            className={`text-center py-2 ${day.isToday ? 'bg-red-900/30' : ''} 
              ${index < 6 ? 'border-r border-red-900/30' : ''}`}
          >
            <div className="text-red-400 text-sm">{day.shortName}</div>
            <div className="text-white font-medium">{day.date}</div>
          </div>
        ))}
      </div>
      
      {/* Calendar Body */}
      <div className="grid grid-cols-7 min-h-[300px] lg:min-h-[400px]">
        {week.map((day, index) => (
          <div 
            key={index} 
            className={`p-2 ${index < 6 ? 'border-r border-red-900/30' : ''} 
              ${day.isToday ? 'bg-red-900/10' : ''} 
              ${selectedDay === index ? 'bg-red-950/80 ring-1 ring-red-600' : 'hover:bg-red-950/50'} 
              overflow-y-auto max-h-[300px] lg:max-h-[400px] scrollbar-thin scrollbar-thumb-red-900 
              cursor-pointer transition-colors duration-150`}
            onClick={() => setSelectedDay(index)}
            aria-selected={selectedDay === index}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setSelectedDay(index)}
          >
            {day.events.length > 0 ? (
              day.events
                // In employee mode, filter to show only current user's events
                .filter(event => isAdminMode || event.employeeId === 0)
                .map((event, eventIndex) => renderEvent(event, eventIndex))
            ) : (
              <div className="text-center py-6 text-red-400/50 text-xs">
                No shifts
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};