import React, { useState } from "react";
import { X, CheckSquare, Square } from "lucide-react";
import { useSchedule, EventType } from "./ScheduleComponents";
import { generateScheduleData, employees } from "./ScheduleData";

export const AddShiftModal: React.FC = () => {
  const {
    setShowAddShiftModal,
    selectedEmployees,
    setSelectedEmployees,
    clearSelectedEmployees,
    setScheduleData,
    weekOffset,
    selectedDay,
  } = useSchedule();

  const [selectedDays, setSelectedDays] = useState<number[]>(
    selectedDay !== null ? [selectedDay] : []
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [shiftType, setShiftType] = useState<"shift" | "training" | "break" | "off">("shift");

  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

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

  const handleAddShift = () => {
    // Generate a base schedule
    const data = generateScheduleData(weekOffset);
    
    // Add new shifts for all selected days and employees
    selectedDays.forEach(dayIndex => {
      selectedEmployees.forEach(employeeId => {
        const employee = employees.find(emp => emp.id === employeeId);
        if (!employee) return;
        
        // Create a new event
        const newEvent: EventType = {
          id: `new-${dayIndex}-${employeeId}-${Date.now()}`,
          type: shiftType,
          title: shiftType === "shift" 
            ? (startTime.includes("07") || startTime.includes("08") || startTime.includes("09") || startTime.includes("10") || startTime.includes("11")) 
              ? "Morning Shift" 
              : startTime.includes("12") || startTime.includes("13") || startTime.includes("14") || startTime.includes("15") || startTime.includes("16")
                ? "Afternoon Shift"
                : "Evening Shift"
            : shiftType === "training" 
              ? "Training Session" 
              : shiftType === "break"
                ? "Break"
                : "Day Off",
          timeRange: shiftType === "off" ? "All Day" : `${startTime} - ${endTime}`,
          employeeName: employee.name,
          employeeId: employee.id
        };
        
        // Add the event to the appropriate day
        data.week[dayIndex].events.push(newEvent);
      });
    });
    
    // Update context with new data
    setScheduleData(data);
    
    // Close modal
    setShowAddShiftModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-black border border-red-900/40 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto p-6 transform transition-all animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-red-400">Add Shift</h2>
          <button
            onClick={() => setShowAddShiftModal(false)}
            className="p-1 rounded-full hover:bg-red-900/30 text-red-400"
            aria-label="Close modal"
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
            {employees.map((employee) => (
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
                <select 
                  className="w-full bg-black border border-red-900 rounded-md p-2 text-white"
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value as any)}
                >
                  <option value="shift">Regular Shift</option>
                  <option value="training">Training</option>
                  <option value="break">Break</option>
                  <option value="off">Day Off</option>
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
          <button 
            onClick={handleAddShift}
            className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
            disabled={selectedEmployees.length === 0 || selectedDays.length === 0}
          >
            Add Shift
          </button>
        </div>
      </div>
    </div>
  );
};