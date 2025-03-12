import React, { useState, useEffect } from "react";
import { X, CheckSquare, Square, Edit2, Trash2, Info } from "lucide-react";
import { useSchedule } from "./ScheduleComponents";
import { generateScheduleData, employees } from "./ScheduleData";
import { EditingEvent } from "./AdminMode";


export const AddShiftModal: React.FC = () => {
  const {
    setShowAddShiftModal,
    selectedEmployees,
    setSelectedEmployees,
    clearSelectedEmployees,
    setScheduleData,
    weekOffset,
    selectedDay,
    isAdminMode
  } = useSchedule();

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>(
    selectedDay !== null ? [selectedDay] : []
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [shiftType, setShiftType] = useState<"shift" | "training" | "break" | "off" | "meeting">("shift");
  const [isRequested, setIsRequested] = useState<boolean>(false);
  const [requestReason, setRequestReason] = useState<string>("");
  const [showRequestFields, setShowRequestFields] = useState<boolean>(false);

  // Check for editing event from hidden input (passed from AdminModeComponent)
  useEffect(() => {
    const hiddenInput = document.getElementById('editing-event-data') as HTMLInputElement;
    if (hiddenInput && hiddenInput.value) {
      try {
        const eventData = JSON.parse(hiddenInput.value) as EditingEvent;
        setEditingEvent(eventData);
        setIsEditMode(true);
        
        // Extract time range
        if (eventData.timeRange && eventData.timeRange !== "All Day") {
          const [start, end] = eventData.timeRange.split(" - ");
          setStartTime(start);
          setEndTime(end);
        }
        
        // Set shift type
        setShiftType(eventData.type as any);
        
        // Set selected day
        if (eventData.dayIndex !== undefined) {
          setSelectedDays([eventData.dayIndex]);
        }
        
        // Set selected employee
        if (eventData.employeeId !== undefined) {
          setSelectedEmployees([eventData.employeeId]);
        }
      } catch (error) {
        console.error("Error parsing editing event data:", error);
      }
    }
  }, [setSelectedEmployees]);

  const toggleEmployeeSelection = (employeeId: number) => {
    if (isEditMode) {
      // In edit mode, we only allow one employee
      setSelectedEmployees([employeeId]);
    } else {
      setSelectedEmployees((prev) => {
        if (prev.includes(employeeId)) {
          return prev.filter((id) => id !== employeeId);
        } else {
          return [...prev, employeeId];
        }
      });
    }
  };

  const toggleDaySelection = (dayIndex: number) => {
    if (isEditMode) {
      // In edit mode, we only allow one day
      setSelectedDays([dayIndex]);
    } else {
      setSelectedDays((prev) => {
        if (prev.includes(dayIndex)) {
          return prev.filter((d) => d !== dayIndex);
        } else {
          return [...prev, dayIndex];
        }
      });
    }
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

  const handleAddOrUpdateShift = () => {
    // Generate a base schedule
    const data = generateScheduleData(weekOffset);
    
    if (isEditMode && editingEvent) {
      // Update existing shift
      const dayIndex = selectedDays[0];
      const day = data.week[dayIndex];
      
      // Find and update the event
      const updatedEvents = day.events.map(event => {
        if (event.id === editingEvent.id) {
          return {
            ...event,
            type: shiftType,
            title: getShiftTitle(shiftType, startTime),
            timeRange: shiftType === "off" ? "All Day" : `${startTime} - ${endTime}`,
            employeeId: selectedEmployees[0],
            employeeName: employees.find(emp => emp.id === selectedEmployees[0])?.name || "Unknown",
            isRequested: isRequested,
            requestReason: requestReason
          };
        }
        return event;
      });
      
      // Update day's events
      data.week[dayIndex].events = updatedEvents;
    } else {
      // Add new shifts for all selected days and employees
      selectedDays.forEach(dayIndex => {
        selectedEmployees.forEach(employeeId => {
          const employee = employees.find(emp => emp.id === employeeId);
          if (!employee) return;
          
          // Create a new event
          const newEvent: any = {
            id: `new-${dayIndex}-${employeeId}-${Date.now()}`,
            type: shiftType,
            title: getShiftTitle(shiftType, startTime),
            timeRange: shiftType === "off" ? "All Day" : `${startTime} - ${endTime}`,
            employeeName: employee.name,
            employeeId: employee.id,
            isRequested: isRequested,
            requestReason: requestReason
          };
          
          // Add the event to the appropriate day
          data.week[dayIndex].events.push(newEvent);
        });
      });
    }
    
    // Update context with new data
    setScheduleData(data);
    
    // Close modal
    setShowAddShiftModal(false);
  };

  const getShiftTitle = (type: string, time: string): string => {
    if (type === "shift") {
      const hour = parseInt(time.split(":")[0]);
      if (hour >= 7 && hour < 12) return "Morning Shift";
      if (hour >= 12 && hour < 17) return "Afternoon Shift";
      return "Evening Shift";
    }
    
    if (type === "training") return "Training Session";
    if (type === "break") return "Break";
    if (type === "off") return "Day Off";
    if (type === "meeting") return "Team Meeting";
    return "Shift";
  };

  const handleDeleteShift = () => {
    if (!isEditMode || !editingEvent) return;
    
    // Generate a base schedule
    const data = generateScheduleData(weekOffset);
    
    // Find day index and remove the event
    const dayIndex = selectedDays[0];
    data.week[dayIndex].events = data.week[dayIndex].events.filter(
      event => event.id !== editingEvent.id
    );
    
    // Update context with new data
    setScheduleData(data);
    
    // Close modal
    setShowAddShiftModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-black border border-red-900/40 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto p-6 transform transition-all animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-red-400 flex items-center">
            {isEditMode ? (
              <>
                <Edit2 size={20} className="mr-2" />
                Edit {shiftType.charAt(0).toUpperCase() + shiftType.slice(1)}
              </>
            ) : (
              <>Add Shift</>
            )}
          </h2>
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
            {isEditMode ? "Employee" : "Select Employees"}
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
                } ${isEditMode && editingEvent?.employeeId !== employee.id && selectedEmployees.includes(employee.id) ? "bg-yellow-900/20 border border-yellow-500" : ""}`}
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
          {!isEditMode && (
            <div className="mt-2 text-right">
              <button
                onClick={clearSelectedEmployees}
                className="text-xs text-red-400 hover:text-red-300"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {/* Day and Time Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-white text-sm font-medium mb-3">
              {isEditMode ? "Day" : "Select Days"}
            </h3>
            <div className="space-y-2">
              {days.map((day, index) => (
                <div
                  key={index}
                  onClick={() => toggleDaySelection(index)}
                  className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                    selectedDays.includes(index)
                      ? "bg-red-900/40 border border-red-500"
                      : "hover:bg-gray-800 border border-gray-700"
                  } ${isEditMode && editingEvent?.dayIndex !== index && selectedDays.includes(index) ? "bg-yellow-900/20 border border-yellow-500" : ""}`}
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
            <h3 className="text-white text-sm font-medium mb-3">Shift Details</h3>
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
                  <option value="meeting">Meeting</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Change Request (only visible in employee mode or when editing) */}
        {(!isAdminMode || isEditMode) && (
          <div className="mt-4 p-3 border border-yellow-700/30 bg-yellow-900/10 rounded-md">
            <div className="flex items-start">
              <div className="mr-2 mt-1">
                <Info size={16} className="text-yellow-500" />
              </div>
              <div>
                <h4 className="text-yellow-400 text-sm font-medium mb-1">
                  {isEditMode ? "Schedule Change" : "Request Schedule Change"}
                </h4>
                <p className="text-xs text-yellow-300/70 mb-2">
                  {isEditMode 
                    ? "Mark this change as a request that requires approval." 
                    : "This will send a request to your manager for approval."}
                </p>
                
                <div className="space-y-2">
                  <label className="flex items-center text-white text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showRequestFields}
                      onChange={() => setShowRequestFields(!showRequestFields)}
                      className="mr-2"
                    />
                    {isEditMode ? "Mark as a schedule change request" : "Request schedule change"}
                  </label>
                  
                  {showRequestFields && (
                    <div className="mt-2">
                      <label className="block text-yellow-400 text-xs mb-1">
                        Reason for request
                      </label>
                      <textarea
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        placeholder="Please provide a reason for this schedule change..."
                        className="w-full bg-black border border-yellow-700/50 rounded-md p-2 text-white text-xs h-16"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex justify-between">
          {isEditMode && (
            <button
              onClick={handleDeleteShift}
              className="px-4 py-2 bg-red-900/60 hover:bg-red-800 text-white rounded-md text-sm transition-colors flex items-center"
            >
              <Trash2 size={16} className="mr-1" />
              Delete
            </button>
          )}
          
          <div className={`flex gap-3 ${isEditMode ? 'ml-auto' : ''}`}>
            <button
              onClick={() => setShowAddShiftModal(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleAddOrUpdateShift}
              className="px-4 py-2 bg-red-800 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
              disabled={selectedEmployees.length === 0 || selectedDays.length === 0}
            >
              {isEditMode ? "Update" : "Add"} {shiftType.charAt(0).toUpperCase() + shiftType.slice(1)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};