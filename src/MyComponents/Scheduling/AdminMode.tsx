import React, { useState } from "react";
import { 
  Plus, 
  Users, 
  Edit2, 
  AlertCircle, 
  ChevronDown,
  Check,
  User
} from "lucide-react";
import { MeetingModal } from "./MeetingModal";
import { EmployeeType } from "./ScheduleComponents";

// Import shadcn components
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/shadcnComponents/dropdown-menu";

// Props interface
interface AdminModeProps {
  isAdminMode: boolean;
  setIsAdminMode: (value: boolean) => void;
  showAddShiftModal: boolean;
  setShowAddShiftModal: (value: boolean) => void;
  employees: EmployeeType[];
  selectedEmployees: number[];
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
    <Button
      onClick={() => setIsAdminMode(!isAdminMode)}
      variant="outline" 
      size="sm"
      className={`px-3 py-1 text-xs rounded-md transition-colors duration-150 ${
        isAdminMode ? "bg-green-800 text-white hover:bg-green-700 border-green-700" : "bg-gray-800 text-gray-300 hover:bg-gray-700 border-gray-700"
      }`}
      aria-label={isAdminMode ? "Switch to employee mode" : "Switch to admin mode"}
    >
      {isAdminMode ? "Admin Mode" : "Employee Mode"}
    </Button>
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

  // Get the selected employee name for display
  const selectedEmployee = employees.find(
    emp => emp.id.toString() === selectedEmployeeId
  );

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
    <div className="bg-blue-900/30 border border-blue-900 rounded-lg p-4 my-4">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-white text-sm">Select Employee:</label>
        
        {/* shadcn/ui DropdownMenu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-[200px] justify-between bg-red-950 border border-red-700 text-white hover:bg-red-900 hover:border-red-600"
            >
              {selectedEmployee ? (
                <div className="flex items-center">
                  <div className="h-5 w-5 rounded-full bg-red-800 flex items-center justify-center mr-2">
                    <span className="text-white text-xs">{selectedEmployee.avatar}</span>
                  </div>
                  <span>{selectedEmployee.name}</span>
                </div>
              ) : (
                "Select Employee"
              )}
              <ChevronDown size={16} className="ml-2 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
          // kinda want the comments to be hidden
            className="w-[200px] bg-black border border-red-700 text-white"
            align="start"
          >
            <DropdownMenuLabel className="text-white">Employees</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-red-950" />
            <DropdownMenuGroup className="max-h-64 overflow-y-auto">
              {employees.map((employee) => (
                <DropdownMenuItem
                  key={employee.id}
                  className={`cursor-pointer hover:bg-red-900 focus:bg-red-900 ${
                    selectedEmployeeId === employee.id.toString() ? "bg-red-900" : ""
                  }`}
                  onClick={() => setSelectedEmployeeId(employee.id.toString())}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <div className="h-6 w-6 rounded-full bg-red-800 flex items-center justify-center mr-2">
                        <span className="text-white text-xs">{employee.avatar}</span>
                      </div>
                      <span>{employee.name}</span>
                    </div>
                    {selectedEmployeeId === employee.id.toString() && (
                      <Check size={16} className="text-green-500" />
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex flex-wrap gap-2 mt-2 sm:mt-0">
          <Button
            onClick={() => setShowMeetingModal(true)}
            className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-md flex items-center gap-1 transition-colors duration-150"
            aria-label="Create meeting"
          >
            <Users size={16} />
            <span className="hidden sm:inline">Create Meeting</span>
            <span className="sm:hidden">Meeting</span>
          </Button>
          
          <Button
            onClick={() => {
              setEditingEvent(null); // Ensure we're creating a new shift
              setShowAddShiftModal(true);
            }}
            className="px-3 py-1.5 bg-red-900/50 hover:bg-red-600 text-white text-sm rounded-md flex items-center gap-1 transition-colors duration-150"
            aria-label="Add shift"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Add Shift</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </div>

      {/* Additional admin toolbar with schedule change requests */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-red-700/40">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-yellow-500" />
          <span className="text-yellow-500 text-xs">2 schedule change requests pending</span>
        </div>
        
        <Button 
          variant="outline"
          className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-white rounded border-red-700/40"
        >
          Review Requests
        </Button>
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

// Helper function to filter events based on admin mode
export const filterEventsByAdminMode = (
  events: any[], // Update with your actual event type
  isAdminMode: boolean,
  employeeId: number = 0
) => {
  return events.filter((event) => isAdminMode || event.employeeId === employeeId);
};

export default AdminModeComponent;