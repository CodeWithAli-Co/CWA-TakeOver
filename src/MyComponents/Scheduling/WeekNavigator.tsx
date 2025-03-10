import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WeekRangeType } from "./ScheduleComponents";

interface WeekNavigatorProps {
  weekRange: WeekRangeType;
  weekOffset: number;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
}

export const WeekNavigator: React.FC<WeekNavigatorProps> = ({
  weekRange,
  weekOffset,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek
}) => {
  return (
    <div className="bg-black border-b border-red-900/40 px-4 py-3 flex justify-between items-center">
      <button
        className="p-1 rounded-md hover:bg-red-900/30 text-red-400"
        onClick={goToPreviousWeek}
        aria-label="Previous week"
      >
        <ChevronLeft size={20} />
      </button>

      <div className="flex flex-col items-center">
        <h2 className="text-red-100 font-bold text-lg text-center">
          {weekRange.start.month}{" "}
          {weekRange.start.date} -
          {weekRange.start.month !==
          weekRange.end.month
            ? ` ${weekRange.end.month}`
            : ""}{" "}
          {weekRange.end.date}
        </h2>
        <div className="text-xs text-red-400">
          {weekOffset === 0
            ? "Current Week"
            : weekOffset < 0
              ? `${Math.abs(weekOffset)} ${Math.abs(weekOffset) === 1 ? "Week" : "Weeks"} Ago`
              : `${weekOffset} ${weekOffset === 1 ? "Week" : "Weeks"} From Now`}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {weekOffset !== 0 && (
          <button
            className="px-3 py-1 text-xs rounded-md bg-red-900/30 hover:bg-red-900/50 text-red-200"
            onClick={goToCurrentWeek}
          >
            Current Week
          </button>
        )}
        <button
          className="p-1 rounded-md hover:bg-red-900/30 text-red-400"
          onClick={goToNextWeek}
          aria-label="Next week"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
};