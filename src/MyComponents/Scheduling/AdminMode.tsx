import React from "react";
import { Plus } from "lucide-react";

// Props interface
interface AdminModeProps {
  isAdminMode: boolean;
  setIsAdminMode: (value: boolean) => void;
  showAddShiftModal: boolean;
  setShowAddShiftModal: (value: boolean) => void;
  employees: any[]; // Update with your actual employee type
  selectedEmployees: any[]; // Update with your actual employee type
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
}) => {
  if (!isAdminMode) return null;

  return (
    <div className="bg-red-900/30 border-b border-red-700/40 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-white text-sm">Select Employee:</label>
        <select
          className="bg-red-950 border border-red-700 rounded-md text-white text-sm px-3 py-1.5"
          aria-label="Select an employee"
        >
          <option value="">Select Employee</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowAddShiftModal(true)}
          className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-md ml-auto flex items-center gap-1"
          aria-label="Add shift"
        >
          <Plus size={16} />
          Add Shift
        </button>
      </div>
    </div>
  );
};

// Helper function to filter events based on admin mode
export const filterEventsByAdminMode = (
  events: any[], // Update with your actual event type
  isAdminMode: boolean,
  employeeId: number = 0
) => {
  return events.filter((event) => isAdminMode || event.employeeId === employeeId);
};

export default AdminModeComponent;