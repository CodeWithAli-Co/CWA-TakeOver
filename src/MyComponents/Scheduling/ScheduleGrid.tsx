import React from "react";
import { DayData } from "./ScheduleComponents";

interface ScheduleGridProps {
  week: DayData[];
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  isAdminMode: boolean;
}

export const ScheduleGrid: React.FC<ScheduleGridProps> = ({
  week,
  selectedDay,
  setSelectedDay,
  isAdminMode
}) => {
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
            className={`text-center py-2 ${day.isToday ? 'bg-red-900/30' : ''} ${index < 6 ? 'border-r border-red-900/30' : ''}`}
          >
            <div className="text-red-400 text-sm">{day.shortName}</div>
            <div className="text-white font-medium">{day.date}</div>
          </div>
        ))}
      </div>
      
      {/* Calendar Body */}
      <div className="grid grid-cols-7 min-h-[300px]">
        {week.map((day, index) => (
          <div 
            key={index} 
            className={`p-2 ${index < 6 ? 'border-r border-red-900/30' : ''} ${day.isToday ? 'bg-red-900/10' : ''} ${selectedDay === index ? 'bg-red-950/80' : ''} overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-red-900 cursor-pointer`}
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
                .map((event, eventIndex) => (
                  <div key={eventIndex} className="mb-2">
                    <div 
                      className={`px-2 py-1 text-xs rounded ${
                        event.type === 'shift' ? 'bg-red-900/40 text-white' : 
                        event.type === 'training' ? 'bg-emerald-900/40 text-white' :
                        event.type === 'break' ? 'bg-blue-900/40 text-white' :
                        'bg-gray-800/40 text-gray-300'
                      }`}
                    >
                      <div className="font-medium truncate flex items-center">
                        {isAdminMode ? (event.employeeName || "Unassigned") : event.title}
                        {event.title.includes("Morning") && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-green-700 text-white rounded">low</span>
                        )}
                        {event.title.includes("Afternoon") && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-600 text-white rounded">medium</span>
                        )}
                        {event.title.includes("Evening") && (
                          <span className="ml-2 px-2 py-0.5 text-xs bg-red-700 text-white rounded">high</span>
                        )}
                      </div>
                      <div className="flex justify-between text-xs mt-1">
                        <span>{event.timeRange}</span>
                        {isAdminMode && event.type !== 'off' && 
                          <span className="text-xs">{event.title}</span>
                        }
                      </div>
                    </div>
                  </div>
                ))
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