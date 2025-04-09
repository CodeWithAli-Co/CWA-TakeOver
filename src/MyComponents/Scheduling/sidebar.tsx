import React from "react";
import { 
  CalendarDays, 
  FileText, 
  MessageSquare, 
  Info, 
  User, 
  Users, 
  CalendarCheck, 
  Settings 
} from "lucide-react";
import { EmployeeType } from "./ScheduleComponents";

interface SidebarProps {
  isSidebarOpen: boolean;
  sidebarView: 'schedule' | 'team';
  setSidebarView: (view: 'schedule' | 'team') => void;
  setIsSidebarOpen: (open: boolean) => void;
  isAdminMode: boolean;
  setIsAdminMode: (admin: boolean) => void;
  goToToday: () => void;
  scheduleStats: {
    hoursThisWeek: number;
    totalShifts: number;
    upcomingBreaks: number;
  };
  employees: EmployeeType[];
  selectedEmployees: number[];
  setShowAddShiftModal: (show: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  sidebarView,
  setSidebarView,
  setIsSidebarOpen,
  isAdminMode,
  setIsAdminMode,
  goToToday,
  scheduleStats,
  employees,
  selectedEmployees,
  setShowAddShiftModal
}) => {
  if (!isSidebarOpen) {
    // Bottom navigation for mobile when sidebar is closed
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-red-900/40 flex justify-around p-2 lg:hidden z-20">
        <button
          className={`p-2 rounded-md flex flex-col items-center ${sidebarView === "schedule" && !isSidebarOpen ? "text-red-400" : "text-red-400/70"}`}
          onClick={() => {
            setSidebarView("schedule");
            setIsSidebarOpen(true);
          }}
          aria-label="Open schedule view"
        >
       <CalendarDays size={20} />
          <span className="text-xs mt-1">Schedule</span>
        </button>
        <button
          className="p-2 rounded-md flex flex-col items-center text-red-400/70"
          onClick={goToToday}
          aria-label="Go to today"
        >
          <CalendarCheck size={20} />
          <span className="text-xs mt-1">Today</span>
        </button>
        <button
          className={`p-2 rounded-md flex flex-col items-center ${sidebarView === "team" && !isSidebarOpen ? "text-red-400" : "text-red-400/70"}`}
          onClick={() => {
            setSidebarView("team");
            setIsSidebarOpen(true);
          }}
          aria-label="Open team view"
        >
          <Users size={20} />
          <span className="text-xs mt-1">Team</span>
        </button>
        <button
          className={`p-2 rounded-md flex flex-col items-center ${isAdminMode ? "text-green-400" : "text-red-400/70"}`}
          onClick={() => setIsAdminMode(!isAdminMode)}
          aria-label={isAdminMode ? "Switch to employee mode" : "Switch to admin mode"}
        >
          <Settings size={20} />
          <span className="text-xs mt-1">
            {isAdminMode ? "Admin" : "Settings"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-52 lg:w-64 border-l border-red-900/40 bg-black/90 flex flex-col fixed inset-y-0 right-0 top-14 bottom-0 lg:static z-20 transform transition-transform duration-200 ease-in-out">
      {/* Sidebar Navigation */}
      <div className="flex border-b border-red-900/40">
        <button
          className={`flex-1 py-3 text-center text-sm ${sidebarView === "schedule" ? "text-red-300 border-b-2 border-red-700" : "text-red-400/70 hover:text-red-300"}`}
          onClick={() => setSidebarView("schedule")}
        >
          Schedule
        </button>
        <button
          className={`flex-1 py-3 text-center text-sm ${sidebarView === "team" ? "text-red-300 border-b-2 border-red-700" : "text-red-400/70 hover:text-red-300"}`}
          onClick={() => setSidebarView("team")}
        >
          Team
        </button>
      </div>

      <div className="p-3 overflow-y-auto flex-1">
        {sidebarView === "schedule" ? (
          <div className="space-y-4">
            {/* Schedule Actions */}
            <div className="space-y-2">
              <button 
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm transition-colors duration-150"
                aria-label="View my schedule"
              >
                <CalendarDays size={16} />
                My Schedule
              </button>
              <button 
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm transition-colors duration-150"
                aria-label="Request time off"
              >
                <FileText size={16} />
                Request Time Off
              </button>
              <button 
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm transition-colors duration-150"
                aria-label="View schedule notes"
              >
                <MessageSquare size={16} />
                Schedule Notes
              </button>
            </div>

            {/* Schedule Summary */}
            <div className="pt-3 border-t border-red-900/30">
              <h3 className="text-red-400 text-xs font-medium uppercase mb-2">
                This Week
              </h3>
              <div className="space-y-2">
                <div className="text-sm flex justify-between">
                  <span className="text-red-300/80">Total Hours:</span>
                  <span className="text-white font-medium">
                    {scheduleStats.hoursThisWeek} hrs
                  </span>
                </div>
                <div className="text-sm flex justify-between">
                  <span className="text-red-300/80">Shifts:</span>
                  <span className="text-white font-medium">
                    {scheduleStats.totalShifts}
                  </span>
                </div>
                <div className="text-sm flex justify-between">
                  <span className="text-red-300/80">Breaks:</span>
                  <span className="text-white font-medium">
                    {scheduleStats.upcomingBreaks}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Notes */}
            <div className="pt-3 border-t border-red-900/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-red-400 text-xs font-medium uppercase">
                  Notes
                </h3>
                <button 
                  className="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-red-900/30"
                  aria-label="Notes information"
                >
                  <Info size={14} />
                </button>
              </div>
              <div className="p-2 bg-red-950/20 rounded-md border border-red-900/40 text-xs text-red-200/90">
                Remember to check inventory levels before your Thursday
                shift. - Manager
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Team Members On Shift */}
            <h3 className="text-red-400 text-xs font-medium uppercase mb-2">
              Coworkers This Week
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {employees.map((coworker) => (
                <div
                  key={coworker.id}
                  className={`flex items-center justify-between p-2 ${isAdminMode ? "cursor-pointer" : ""} hover:bg-red-900/20 rounded-md transition-colors duration-150 ${
                    isAdminMode && selectedEmployees.includes(coworker.id)
                      ? "bg-red-900/40 border border-red-500"
                      : ""
                  }`}
                  onClick={() =>
                    isAdminMode && setShowAddShiftModal(true)
                  }
                  role={isAdminMode ? "button" : undefined}
                  tabIndex={isAdminMode ? 0 : undefined}
                  onKeyDown={(e) => isAdminMode && e.key === 'Enter' && setShowAddShiftModal(true)}
                >
                  <div className="flex items-center">
                    <div className="w-7 h-7 rounded-full bg-red-800 flex items-center justify-center mr-2">
                      <span className="text-white text-xs">
                        {coworker.avatar}
                      </span>
                    </div>
                    <span className="text-red-200 text-sm">
                      {coworker.name}
                    </span>
                  </div>
                  <span className="text-xs bg-red-900/30 px-2 py-0.5 rounded-full text-red-300">
                    {coworker.shifts} shifts
                  </span>
                </div>
              ))}
            </div>

            {/* Team Lead */}
            <div className="pt-3 border-t border-red-900/30">
              <h3 className="text-red-400 text-xs font-medium uppercase mb-2">
                Shift Manager
              </h3>
              <div className="flex items-center p-2 bg-red-950/30 rounded-md">
                <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center mr-3">
                  <User size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-medium">
                    Sarah Thompson
                  </div>
                  <div className="text-red-300/80 text-xs">
                    On duty Mon-Fri
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Request Schedule Change Button */}
      <div className="p-3 border-t border-red-900/40">
        <button
          className="w-full py-2 bg-red-800 hover:bg-red-700 text-white rounded-md text-sm transition-colors duration-150"
          onClick={() => isAdminMode && setShowAddShiftModal(true)}
        >
          {isAdminMode ? "Update Schedule" : "Request Schedule Change"}
        </button>
      </div>
    </div>
  );
};