import React, { useState } from "react";
import {
  Briefcase,
  Calendar,
  Clock,
  Coffee,
  Home,
  Clipboard,
  PieChart,
  BarChart4,
  User,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import { useSchedule, EventType, coworkersData } from "./ScheduleComponents";

// Enhanced event card with better contrast and mobile responsiveness
export const EventCard: React.FC<{ event: EventType }> = ({ event }) => {
  // Get event-specific styles with improved contrast
  const getEventStyles = (type: string) => {
    switch (type) {
      case "shift":
        return {
          bg: "bg-gradient-to-r from-red-900/40 to-red-950/50",
          border: "border-l-4 border-red-600",
          icon: <Briefcase className="text-red-500" size={16} />,
        };
      case "training":
        return {
          bg: "bg-gradient-to-r from-emerald-900/40 to-emerald-950/50",
          border: "border-l-4 border-emerald-600",
          icon: <Clipboard className="text-emerald-500" size={16} />,
        };
      case "break":
        return {
          bg: "bg-gradient-to-r from-blue-900/40 to-blue-950/50",
          border: "border-l-4 border-blue-600",
          icon: <Coffee className="text-blue-500" size={16} />,
        };
      case "off":
        return {
          bg: "bg-gradient-to-r from-gray-800/20 to-gray-900/50",
          border: "border-l-4 border-gray-600",
          icon: <Home className="text-gray-500" size={16} />,
        };
      default:
        return {
          bg: "bg-gradient-to-r from-red-900/40 to-red-950/50",
          border: "border-l-4 border-red-600",
          icon: <Calendar className="text-red-500" size={16} />,
        };
    }
  };

  const styles = getEventStyles(event.type);

  return (
    <div
      className={`${styles.bg} ${styles.border} rounded-md shadow-sm p-3 mb-2 transition-all hover:shadow-md max-w-md transform hover:translate-y-px`}
    >
      <div className="flex">
        <div className="mr-2 mt-0.5">{styles.icon}</div>
        <div className="flex-1">
          <div className="font-medium text-white">{event.title}</div>
          <div className="text-xs text-red-300/80 flex items-center gap-1 flex-wrap">
            <Clock size={12} />
            {event.timeRange}
            {event.location && (
              <>
                <span className="mx-1">•</span>
                {event.location}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat card component
type StatCardProps = {
  title: string;
  value: number;
  total: number;
  icon: React.ReactNode;
  color?: "red" | "green" | "blue";
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  total,
  icon,
  color = "red",
}) => {
  const percentage = (value / total) * 100;

  // Map color names to CSS classes
  const colorMap = {
    red: {
      border: "border-red-900/40",
      bg: "from-red-950/40",
      text: "text-red-400",
      fill: "from-red-700 to-red-500",
    },
    green: {
      border: "border-green-900/40",
      bg: "from-green-950/40",
      text: "text-green-400",
      fill: "from-green-700 to-green-500",
    },
    blue: {
      border: "border-blue-900/40",
      bg: "from-blue-950/40",
      text: "text-blue-400",
      fill: "from-blue-700 to-blue-500",
    },
  };

  const colorClasses = colorMap[color] || colorMap.red;

  return (
    <div
      className={`flex-1 min-w-[200px] max-w-xs p-4 rounded-lg bg-gradient-to-br ${colorClasses.bg} to-black border ${colorClasses.border}`}
    >
      <h3 className={`${colorClasses.text} text-sm font-medium mb-2`}>
        {title}
      </h3>
      <div className="flex items-end justify-between">
        <div className="text-2xl font-bold text-white">
          {value}{" "}
          <span className="text-sm text-white/70">
            / {total} {title.includes("Hour") ? "hrs" : ""}
          </span>
        </div>
        {icon}
      </div>
      <div className="mt-2 h-2 bg-black/50 rounded-full overflow-hidden">
        <div
          className={`h-full bg-gradient-to-r ${colorClasses.fill}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

// Add Shift Modal component
export const AddShiftModal: React.FC = () => {
  const {
    setShowAddShiftModal,
    selectedEmployees,
    toggleEmployeeSelection,
    clearSelectedEmployees,
  } = useSchedule();

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const toggleDaySelection = (dayIndex: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((d) => d !== dayIndex);
      } else {
        return [...prev, dayIndex];
      }
    });
  };

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-black border border-red-900/40 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto p-6 transform transition-all animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-red-400">Add Shift</h2>
          <button
            onClick={() => setShowAddShiftModal(false)}
            className="p-1 rounded-full hover:bg-red-900/30 text-red-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Employee Selection */}
        <div className="mb-6">
          <h3 className="text-white text-sm font-medium mb-3">
            Select Employees
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
            {coworkersData.map((employee) => (
              <div
                key={employee.id}
                onClick={() => toggleEmployeeSelection(employee.id)}
                className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                  selectedEmployees.includes(employee.id)
                    ? "bg-red-900/40 border border-red-500"
                    : "hover:bg-gray-800 border border-gray-700"
                }`}
              >
                <div className="mr-2">
                  {selectedEmployees.includes(employee.id) ? (
                    <CheckSquare size={16} className="text-red-400" />
                  ) : (
                    <Square size={16} className="text-gray-400" />
                  )}
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-red-800 flex items-center justify-center mr-2">
                    <span className="text-white text-xs">
                      {employee.avatar}
                    </span>
                  </div>
                  <span className="text-white text-sm">{employee.name}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-right">
            <button
              onClick={clearSelectedEmployees}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {/* Day and Time Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-white text-sm font-medium mb-3">Select Days</h3>
            <div className="space-y-2">
              {days.map((day, index) => (
                <div
                  key={index}
                  onClick={() => toggleDaySelection(index)}
                  className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                    selectedDays.includes(index)
                      ? "bg-red-900/40 border border-red-500"
                      : "hover:bg-gray-800 border border-gray-700"
                  }`}
                >
                  <div className="mr-2">
                    {selectedDays.includes(index) ? (
                      <CheckSquare size={16} className="text-red-400" />
                    ) : (
                      <Square size={16} className="text-gray-400" />
                    )}
                  </div>
                  <span className="text-white text-sm">{day}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white text-sm font-medium mb-3">Shift Time</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-red-400 text-xs mb-1">
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-black border border-red-900 rounded-md p-2 text-white"
                />
              </div>
              <div>
                <label className="block text-red-400 text-xs mb-1">
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-black border border-red-900 rounded-md p-2 text-white"
                />
              </div>

              <div>
                <label className="block text-red-400 text-xs mb-1">
                  Shift Type
                </label>
                <select className="w-full bg-black border border-red-900 rounded-md p-2 text-white">
                  <option value="shift">Regular Shift</option>
                  <option value="training">Training</option>
                  <option value="break">Break</option>
                  <option value="off">Day Off</option>
                </select>
              </div>

              <div>
                <label className="block text-red-400 text-xs mb-1">
                  Location
                </label>
                <select className="w-full bg-black border border-red-900 rounded-md p-2 text-white">
                  <option value="Main Floor">Main Floor</option>
                  <option value="Service Desk">Service Desk</option>
                  <option value="Back Office">Back Office</option>
                  <option value="Training Room">Training Room</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setShowAddShiftModal(false)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm transition-colors"
          >
            Cancel
          </button>
          <button className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-md text-sm transition-colors">
            Add Shift
          </button>
        </div>
      </div>
    </div>
  );
};

// Loading Component
export const LoadingState: React.FC = () => (
  <div className="flex flex-col h-screen bg-black items-center justify-center">
    <div className="text-red-500 animate-spin mb-4">
      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24">
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    </div>
    <p className="text-red-300 text-lg">Loading schedule data...</p>
  </div>
);

// Error State Component
export const ErrorState: React.FC<{ retry: () => void }> = ({ retry }) => (
  <div className="flex flex-col h-screen bg-black items-center justify-center">
    <svg
      className="w-10 h-10 text-red-500 mb-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      ></path>
    </svg>
    <p className="text-red-300 text-lg mb-4">Error loading schedule data</p>
    <button
      onClick={retry}
      className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-md inline-flex items-center gap-2"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        ></path>
      </svg>
      Retry
    </button>
  </div>
);
