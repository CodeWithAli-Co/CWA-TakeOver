import React, { useEffect } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Bell,
  Settings,
  Menu,
  X,
  CalendarCheck,
  CalendarDays,
  FileText,
  MessageSquare,
  Info,
  Plus,
  User,
} from "lucide-react";

import { useSchedule } from "../Scheduling/ScheduleComponents";
import {
  EventCard,
  StatCard,
  AddShiftModal,
  LoadingState,
  ErrorState,
} from "../Scheduling/ScheduleContext";

const EmployeeSchedule: React.FC = () => {
  // Use Schedule Context
  const {
    currentView,
    setCurrentView,
    selectedDay,
    setSelectedDay,
    sidebarView,
    setSidebarView,
    isSidebarOpen,
    setIsSidebarOpen,
    scheduleData,
    weekOffset,
    isLoading,
    isError,
    isAdminMode,
    setIsAdminMode,
    selectedEmployees,
    showAddShiftModal,
    setShowAddShiftModal,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    goToToday,
    isPending,
    employees,
  } = useSchedule();

  // Handle window resize for responsive layout
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setIsSidebarOpen]);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error state
  if (isError) {
    return <ErrorState retry={goToCurrentWeek} />;
  }

  // If data is not loaded yet
  if (!scheduleData || selectedDay === null) {
    return <LoadingState />;
  }

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Top Navigation */}
      <header className="bg-black border-b border-red-900/40 py-2 px-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center">
            <button
              className="mr-2 p-1.5 rounded-full lg:hidden hover:bg-red-900/30"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {isSidebarOpen ? (
                <X size={20} className="text-red-400" />
              ) : (
                <Menu size={20} className="text-red-400" />
              )}
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              {isAdminMode ? "Admin: Schedule Management" : "Employee Schedule"}
            </h1>
          </div>

          {/* View Selector */}
          <div className="hidden md:flex bg-red-950/30 rounded-lg overflow-hidden border border-red-900/30">
            <button
              onClick={() => setCurrentView("day")}
              className={`px-4 py-1.5 text-sm ${currentView === "day" ? "bg-red-900/80 text-white" : "text-red-300 hover:bg-red-900/30"}`}
            >
              Day
            </button>
            <button
              onClick={() => setCurrentView("week")}
              className={`px-4 py-1.5 text-sm ${currentView === "week" ? "bg-red-900/80 text-white" : "text-red-300 hover:bg-red-900/30"}`}
            >
              Week
            </button>
            <button
              onClick={() => setCurrentView("month")}
              className={`px-4 py-1.5 text-sm ${currentView === "month" ? "bg-red-900/80 text-white" : "text-red-300 hover:bg-red-900/30"}`}
            >
              Month
            </button>
          </div>

          {/* User Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAdminMode(!isAdminMode)}
              className={`px-3 py-1 text-xs rounded-md ${isAdminMode ? "bg-green-800 text-white" : "bg-gray-800 text-gray-300"} hidden sm:block`}
            >
              {isAdminMode ? "Admin Mode" : "Employee Mode"}
            </button>
            <button className="relative p-1.5 rounded-full hover:bg-red-900/30">
              <Bell size={18} className="text-red-400" />
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full"></span>
            </button>
            <button className="p-1.5 rounded-full hover:bg-red-900/30">
              <Settings size={18} className="text-red-400" />
            </button>
            <div className="h-8 w-8 bg-red-800 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">JS</span>
            </div>
          </div>
        </div>
      </header>

      {/* Week Navigator with pagination */}
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
            {scheduleData.weekRange.start.month}{" "}
            {scheduleData.weekRange.start.date} -
            {scheduleData.weekRange.start.month !==
            scheduleData.weekRange.end.month
              ? ` ${scheduleData.weekRange.end.month}`
              : ""}{" "}
            {scheduleData.weekRange.end.date}
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

      {/* Admin Mode - Employee selector (only visible in admin mode) */}
      {isAdminMode && (
        <div className="bg-red-900/30 border-b border-red-700/40 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-white text-sm">Select Employee:</label>
            <select
              className="bg-red-950 border border-red-700 rounded-md text-white text-sm px-3 py-1.5"
              value={selectedEmployees.length === 1 ? selectedEmployees[0] : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val !== "") {
                  // Set as the only selected employee
                  const employeeId = parseInt(val, 10);
                  const newSelection = [employeeId];
                  setShowAddShiftModal(true);
                }
              }}
            >
              <option value="">Select Employee</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>

            <span className="text-xs text-green-400 ml-2">
              Advanced: {selectedEmployees.length}{" "}
              {selectedEmployees.length === 1 ? "employee" : "employees"}{" "}
              selected
            </span>

            <button
              onClick={() => setShowAddShiftModal(true)}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-sm rounded-md ml-auto flex items-center gap-1"
            >
              <Plus size={16} />
              Add Shift
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div
          className={`flex-1 overflow-auto relative ${isPending ? "opacity-70" : "opacity-100"} transition-opacity duration-200`}
        >
          {/* Day Selector (Timeline View) with horizontal scroll on mobile */}
          <div className="flex overflow-x-auto border-b border-red-900/30 bg-black/60 scrollbar-thin scrollbar-thumb-red-900 scrollbar-track-transparent">
            {scheduleData.week.map((day, index) => (
              <button
                key={index}
                className={`relative py-2 flex-1 min-w-[70px] flex flex-col items-center ${selectedDay === index ? "bg-red-900/20" : "hover:bg-red-900/10"} transition-colors duration-150`}
                onClick={() => setSelectedDay(index)}
                aria-selected={selectedDay === index}
              >
                <span
                  className={`text-sm ${day.isToday ? "text-red-400 font-semibold" : "text-red-300"}`}
                >
                  {day.shortName}
                </span>
                <span
                  className={`text-lg ${day.isToday ? "text-white font-bold" : "text-red-100"}`}
                >
                  {day.date}
                </span>
                {day.isToday && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
                {selectedDay === index && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"></div>
                )}
              </button>
            ))}
          </div>

          {/* "Today" quick-jump button */}
          <button
            className="fixed bottom-16 right-4 md:bottom-4 z-10 bg-red-700 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transform transition-transform hover:scale-105"
            onClick={goToToday}
            aria-label="Jump to today"
          >
            <CalendarCheck size={20} />
          </button>

          {/* Schedule Content */}
          <div className="p-4">
            {/* Today's Quick Stats */}
            <div className="flex justify-center gap-4 mb-6">
              <StatCard
                title="Weekly Hours"
                value={scheduleData.stats.hoursThisWeek}
                total={scheduleData.stats.maxHours}
                icon={
                  <div className="text-red-600 w-8 h-8">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" />
                    </svg>
                  </div>
                }
                color="red"
              />

              <StatCard
                title="Shifts Completed"
                value={scheduleData.stats.shiftsCompleted}
                total={scheduleData.stats.totalShifts}
                icon={
                  <div className="text-blue-600 w-8 h-8">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M8 18h12M8 14h12M8 10h12M8 6h12M3 18h1M3 14h1M3 10h1M3 6h1" />
                    </svg>
                  </div>
                }
                color="blue"
              />
            </div>

            {/* Selected Day Header */}
            <div className="mb-4">
              <h2 className="text-xl font-bold text-red-100">
                {scheduleData.week[selectedDay].dayName},{" "}
                {scheduleData.week[selectedDay].date}
              </h2>
              <p className="text-red-400 text-sm">
                {scheduleData.week[selectedDay].events.length > 0
                  ? `${scheduleData.week[selectedDay].events.length} scheduled ${scheduleData.week[selectedDay].events.length === 1 ? "activity" : "activities"}`
                  : "No scheduled activities"}
              </p>
            </div>

            {/* Selected Day Events */}
            <div className="space-y-1">
              {scheduleData.week[selectedDay].events.length > 0 ? (
                scheduleData.week[selectedDay].events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className="p-8 rounded-lg border border-red-900/20 bg-black/50 flex flex-col items-center justify-center text-center">
                  <Calendar className="text-red-700 mb-3" size={40} />
                  <p className="text-red-300">
                    No activities scheduled for this day
                  </p>
                  <button
                    className="mt-4 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded-md text-white text-sm"
                    onClick={() => isAdminMode && setShowAddShiftModal(true)}
                  >
                    {isAdminMode ? "Add Shift" : "Request Shift"}
                  </button>
                </div>
              )}
            </div>

            {/* Upcoming Activities (visible for weekly view) */}
            {currentView === "week" && (
              <WeekGlance days={scheduleData.week} selectedDay={selectedDay} />
            )}
          </div>
        </div>

        {/* Sidebar - transforms to bottom navigation on mobile */}
        {isSidebarOpen ? (
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
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm transition-colors duration-150">
                      <CalendarDays size={16} />
                      My Schedule
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm transition-colors duration-150">
                      <FileText size={16} />
                      Request Time Off
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm transition-colors duration-150">
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
                          {scheduleData.stats.hoursThisWeek} hrs
                        </span>
                      </div>
                      <div className="text-sm flex justify-between">
                        <span className="text-red-300/80">Shifts:</span>
                        <span className="text-white font-medium">
                          {scheduleData.stats.totalShifts}
                        </span>
                      </div>
                      <div className="text-sm flex justify-between">
                        <span className="text-red-300/80">Breaks:</span>
                        <span className="text-white font-medium">
                          {scheduleData.stats.upcomingBreaks}
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
                      <button className="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-red-900/30">
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
        ) : (
          // Bottom navigation for mobile when sidebar is closed
          <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-red-900/40 flex justify-around p-2 lg:hidden z-20">
            <button
              className={`p-2 rounded-md flex flex-col items-center ${sidebarView === "schedule" && !isSidebarOpen ? "text-red-400" : "text-red-400/70"}`}
              onClick={() => {
                setSidebarView("schedule");
                setIsSidebarOpen(true);
              }}
            >
              <CalendarDays size={20} />
              <span className="text-xs mt-1">Schedule</span>
            </button>
            <button
              className="p-2 rounded-md flex flex-col items-center text-red-400/70"
              onClick={goToToday}
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
            >
              <Users size={20} />
              <span className="text-xs mt-1">Team</span>
            </button>
            <button
              className={`p-2 rounded-md flex flex-col items-center ${isAdminMode ? "text-green-400" : "text-red-400/70"}`}
              onClick={() => setIsAdminMode(!isAdminMode)}
            >
              <Settings size={20} />
              <span className="text-xs mt-1">
                {isAdminMode ? "Admin" : "Settings"}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Add Shift Modal */}
      {showAddShiftModal && <AddShiftModal />}
    </div>
  );
};

// Wrap main component with Schedule Provider
import { ScheduleProvider } from "../Scheduling/ScheduleComponents";
import { WeekGlance } from "../Scheduling/WeekGlance";

// Export the main component
export default function ScheduleApp() {
  return (
    <ScheduleProvider>
      <EmployeeSchedule />
    </ScheduleProvider>
  );
}