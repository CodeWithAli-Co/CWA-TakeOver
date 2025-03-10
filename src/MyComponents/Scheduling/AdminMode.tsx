import React, { useState } from "react";
import { Plus, CalendarPlus, Users, Edit2, AlertCircle } from "lucide-react";
import { MeetingModal } from "./MeetingModal";

// Props interface
interface AdminModeProps {
  isAdminMode: boolean;
  setIsAdminMode: (value: boolean) => void;
  showAddShiftModal: boolean;
  setShowAddShiftModal: (value: boolean) => void;
  employees: any[]; // Update with your actual employee type
  selectedEmployees: any[]; // Update with your actual employee type
  scheduleData?: any; // Schedule data for editing
}

// Event interface
export interface EditingEvent {
  id: string;
  type: string;
  title: string;
  timeRange: string;
  employeeName: string;
  employeeId: number;
  dayIndex?: number;
}

// Add TypeScript interface for window to include our global functions
declare global {
  interface Window {
    editShift?: (event: EditingEvent) => void;
    setShowAddShiftModal?: (value: boolean) => void;
  }
}

// Toggle button component for reuse
export const AdminModeToggle: React.FC<{
  isAdminMode: boolean;
  setIsAdminMode: (value: boolean) => void;
}> = ({ isAdminMode, setIsAdminMode }) => {
  return (
    <button
      onClick={() => setIsAdminMode(!isAdminMode)}
      className={`px-3 py-1 text-xs rounded-md ${
        isAdminMode ? "bg-green-800 text-white" : "bg-gray-800 text-gray-300"
      }`}
      aria-label={isAdminMode ? "Switch to employee mode" : "Switch to admin mode"}
    >
      {isAdminMode ? "Admin Mode" : "Employee Mode"}
    </button>
  );
};

// Main Admin Mode Component
export const AdminModeComponent: React.FC<AdminModeProps> = ({
  isAdminMode,
  setIsAdminMode,
  showAddShiftModal,
  setShowAddShiftModal,
  employees,
  selectedEmployees,
  scheduleData,
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [showMeetingModal, setShowMeetingModal] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);

  if (!isAdminMode) return null;

  // Handler for starting shift edit
  const handleEditShift = (event: EditingEvent) => {
    setEditingEvent(event);
    setShowAddShiftModal(true);
  };
  
  // Register the edit handler globally
  if (typeof window !== 'undefined') {
    window.editShift = (event: EditingEvent) => {
      setEditingEvent(event);
      setShowAddShiftModal(true);
    };
  }

  return (
    <div className="bg-red-900/30 border-b border-red-700/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-white text-sm">Select Employee:</label>
        <select
          className="bg-red-950 border border-red-700 rounded-md text-white text-sm px-3 py-1.5"
          aria-label="Select an employee"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
        >
          <option value="">Select Employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowMeetingModal(true)}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-md flex items-center gap-1"
            aria-label="Create meeting"
          >
            <Users size={16} />
            Create Meeting
          </button>
          
          <button
            onClick={() => {
              setEditingEvent(null); // Ensure we're creating a new shift
              setShowAddShiftModal(true);
            }}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-md flex items-center gap-1"
            aria-label="Add shift"
          >
            <Plus size={16} />
            Add Shift
          </button>
        </div>
      </div>

      {/* Additional admin toolbar with schedule change requests */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-red-700/40">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-yellow-500" />
          <span className="text-yellow-500 text-xs">2 schedule change requests pending</span>
        </div>
        
        <button 
          className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-white rounded"
        >
          Review Requests
        </button>
      </div>

      {/* Pass the editing event to the AddShiftModal */}
      {editingEvent && (
        <input type="hidden" id="editing-event-data" value={JSON.stringify(editingEvent)} />
      )}

      {/* Render MeetingModal conditionally */}
      {showMeetingModal && <MeetingModal setShowMeetingModal={setShowMeetingModal} employees={employees} />}
    </div>
  );
};

// Import MeetingModal


// Helper function to filter events based on admin mode
export const filterEventsByAdminMode = (
  events: any[], // Update with your actual event type
  isAdminMode: boolean,
  employeeId: number = 0
) => {
  return events.filter((event) => isAdminMode || event.employeeId === employeeId);
};

export default AdminModeComponent;