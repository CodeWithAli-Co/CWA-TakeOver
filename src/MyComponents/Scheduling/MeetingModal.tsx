// BLUE FILE
import React, { useState } from "react";
import { X, CheckSquare, Square, Users, Clock } from "lucide-react";
import { useSchedule } from "./ScheduleComponents";
import { generateScheduleData } from "./ScheduleData";
interface MeetingModalProps {
  setShowMeetingModal: (value: boolean) => void;
}

export const MeetingModal: React.FC<MeetingModalProps> = ({ setShowMeetingModal }) => {
  const {
    selectedEmployees,
    setSelectedEmployees,
    clearSelectedEmployees,
    setScheduleData,
    weekOffset,
    selectedDay,
    employees,
  } = useSchedule();

  // State variables
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  
  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleCreateMeeting = () => {
    // Generate a base schedule
    const data = generateScheduleData(weekOffset);
    
    // Find the day index based on the selected date
    // This is a simplified approach - you might need a more robust way to map dates to days
    const today = new Date();
    const selectedDate = new Date(meetingDate);
    const daysDiff = Math.floor((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const dayIndex = (today.getDay() + daysDiff) % 7;
    
    // Add new meeting for all selected employees
    selectedEmployees.forEach(employeeId => {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;
      
      // Create a new meeting event
      const newEvent = {
        id: `meeting-${dayIndex}-${employeeId}-${Date.now()}`,
        type: "meeting",
        title: meetingTitle || "Team Meeting",
        timeRange: `${startTime} - ${endTime}`,
        employeeName: employee.name,
        employeeId: employee.id,
        location: meetingLocation,
        description: meetingDescription,
        isRequired: isRequired
      };
      
      // Add the event to the appropriate day
      data.week[dayIndex].events.push(newEvent);
    });
    
    // Update context with new data
    setScheduleData(data);
    
    // Close modal
    setShowMeetingModal(false);
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-black border border-red-900/40 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto p-6 transform transition-all animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-blue-400 flex items-center">
            <Users size={20} className="mr-2" />
            Create Meeting
          </h2>
          <button
            onClick={() => setShowMeetingModal(false)}
            className="p-1 rounded-full hover:bg-red-900/30 text-red-400"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Meeting Details */}
        <div className="mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-white text-sm mb-1">
                Meeting Title*
              </label>
              <input
                type="text"
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Enter meeting title"
                className="w-full bg-black border border-blue-900 rounded-md p-2 text-white"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm mb-1">
                  Date*
                </label>
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full bg-black border border-blue-900 rounded-md p-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-white text-sm mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="Conference room, Zoom, etc."
                  className="w-full bg-black border border-blue-900 rounded-md p-2 text-white"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-white text-sm mb-1">
                  Start Time*
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-black border border-blue-900 rounded-md p-2 text-white"
                />
              </div>
              
              <div>
                <label className="block text-white text-sm mb-1">
                  End Time*
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-black border border-blue-900 rounded-md p-2 text-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-white text-sm mb-1">
                Description
              </label>
              <textarea
                value={meetingDescription}
                onChange={(e) => setMeetingDescription(e.target.value)}
                placeholder="Meeting agenda, preparation instructions, etc."
                className="w-full bg-black border border-blue-900 rounded-md p-2 text-white h-20"
              />
            </div>
            
            <div className="flex items-center">
              <label className="flex items-center text-white text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={() => setIsRequired(!isRequired)}
                  className="mr-2"
                />
                Attendance required
              </label>
            </div>
          </div>
        </div>

        {/* Employee Selection */}
        <div className="mb-6">
          <h3 className="text-white text-sm font-medium mb-3 flex items-center">
            <Users size={16} className="mr-1" />
            Invite Employees
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
            {employees.map((employee) => (
              <div
                key={employee.id}
                onClick={() => toggleEmployeeSelection(employee.id)}
                className={`flex items-center p-2 rounded-md cursor-pointer transition-colors ${
                  selectedEmployees.includes(employee.id)
                    ? "bg-blue-900/40 border border-blue-500"
                    : "hover:bg-gray-800 border border-gray-700"
                }`}
              >
                <div className="mr-2">
                  {selectedEmployees.includes(employee.id) ? (
                    <CheckSquare size={16} className="text-blue-400" />
                  ) : (
                    <Square size={16} className="text-gray-400" />
                  )}
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-800 flex items-center justify-center mr-2">
                    <span className="text-white text-xs">
                      {employee.avatar || employee.name.charAt(0)}
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
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => setShowMeetingModal(false)}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleCreateMeeting}
            className="px-4 py-2 bg-blue-800 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
            disabled={!meetingTitle || selectedEmployees.length === 0}
          >
            Create Meeting
          </button>
        </div>
      </div>
    </div>
  );
};