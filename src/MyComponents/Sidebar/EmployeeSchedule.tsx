import React, { useEffect } from "react";
import { CalendarCheck, Plus } from "lucide-react";
// Add this to your exports
// export { AddShiftModal } from '../Scheduling/AddShiftModal';

// Header component
const Header = ({ isSidebarOpen, setIsSidebarOpen, isAdminMode, setIsAdminMode, currentView, setCurrentView }) => {
  // Header implementation from Header.tsx
  return (
    <header className="bg-black border-b border-red-900/40 py-2 px-4">
      {/* Header content */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
          {isAdminMode ? "Admin: Schedule Management" : "Employee Schedule"}
        </h1>
        
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

        <button
          onClick={() => setIsAdminMode(!isAdminMode)}
          className={`px-3 py-1 text-xs rounded-md ${isAdminMode ? "bg-green-800 text-white" : "bg-gray-800 text-gray-300"}`}
          aria-label={isAdminMode ? "Switch to employee mode" : "Switch to admin mode"}
        >
          {isAdminMode ? "Admin Mode" : "Employee Mode"}
        </button>
      </div>
    </header>
  );
};

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
    setScheduleData,
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

// Load schedule data
useEffect(() => {
  const data = generateScheduleData(weekOffset);
  setScheduleData(data);
  
  if (selectedDay === null) {
    const todayIndex = data.week.findIndex(day => day.isToday);
    setSelectedDay(todayIndex >= 0 ? todayIndex : 0);
  }
}, [weekOffset, setScheduleData, selectedDay, setSelectedDay]);

// Loading and error states
if (isLoading) return <LoadingState />;
if (isError) return <ErrorState retry={() => setScheduleData(generateScheduleData(weekOffset))} />;
if (!scheduleData || selectedDay === null) return <LoadingState />;

  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Header Component */}
      <Header 
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
        currentView={currentView}
        setCurrentView={setCurrentView}
      />

      {/* Week Navigator */}
      <div className="bg-black border-b border-red-900/40 px-4 py-3 flex justify-between items-center">
        <button
          className="p-1 rounded-md hover:bg-red-900/30 text-red-400"
          onClick={goToPreviousWeek}
          aria-label="Previous week"
        >
          &lt;
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

        <button
          className="p-1 rounded-md hover:bg-red-900/30 text-red-400"
          onClick={goToNextWeek}
          aria-label="Next week"
        >
          &gt;
        </button>
      </div>

      {/* Admin Mode - Employee selector (only visible in admin mode) */}
      {isAdminMode && (
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
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto relative">
          {/* Schedule Content */}
          <div className="p-4">
            {/* Today's Quick Stats */}
            <div className="flex justify-center gap-4 mb-6">
              <StatCard
                title="Weekly Hours"
                value={scheduleData.stats.hoursThisWeek}
                total={scheduleData.stats.maxHours}
                icon={null}
                color="red"
              />

              <StatCard
                title="Shifts Completed"
                value={scheduleData.stats.shiftsCompleted}
                total={scheduleData.stats.totalShifts}
                icon={null}
                color="blue"
              />
            </div>

            {/* Weekly Schedule Grid */}
            <div className="mt-6 border border-red-900/30 rounded-lg overflow-hidden mb-6">
              <div className="bg-red-900/20 border-b border-red-900/30 px-4 py-2">
                <h3 className="text-white font-medium">Weekly Schedule Overview</h3>
              </div>
              
              {/* Calendar Header */}
              <div className="grid grid-cols-7 border-b border-red-900/30">
                {scheduleData.week.map((day, index) => (
                  <div 
                    key={index} 
                    className={`text-center py-2 ${day.isToday ? 'bg-red-900/30' : ''} ${index < 6 ? 'border-r border-red-900/30' : ''}`}
                  >
                    <div className="text-red-400 text-sm">{day.shortName}</div>
                    <div className="text-white font-medium">{day.date}</div>
                  </div>
                ))}
              </div>
              
              {/* Calendar Body */}
              <div className="grid grid-cols-7 min-h-[300px]">
                {scheduleData.week.map((day, index) => (
                  <div 
                    key={index} 
                    className={`p-2 ${index < 6 ? 'border-r border-red-900/30' : ''} ${day.isToday ? 'bg-red-900/10' : ''} ${selectedDay === index ? 'bg-red-950/80' : ''} overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-red-900 cursor-pointer`}
                    onClick={() => setSelectedDay(index)}
                  >
                    {day.events.length > 0 ? (
                      day.events
                        // In employee mode, filter to show only current user's events
                        .filter(event => isAdminMode || event.employeeId === 0)
                        .map((event, eventIndex) => (
                          <div key={eventIndex} className="mb-2">
                            <div 
                              className={`px-2 py-1 text-xs rounded ${
                                event.type === 'shift' ? 'bg-red-900/40 text-white' : 
                                event.type === 'training' ? 'bg-emerald-900/40 text-white' :
                                event.type === 'break' ? 'bg-blue-900/40 text-white' :
                                'bg-gray-800/40 text-gray-300'
                              }`}
                            >
                              <div className="font-medium truncate flex items-center">
                                {isAdminMode ? (event.employeeName || "Unassigned") : event.title}
                                {event.title.includes("Morning") && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-green-700 text-white rounded">low</span>
                                )}
                                {event.title.includes("Afternoon") && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-yellow-600 text-white rounded">medium</span>
                                )}
                                {event.title.includes("Evening") && (
                                  <span className="ml-2 px-2 py-0.5 text-xs bg-red-700 text-white rounded">high</span>
                                )}
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span>{event.timeRange}</span>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="text-center py-6 text-red-400/50 text-xs">
                        No shifts
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Day Details */}
            {selectedDay !== null && (
              <div className="mb-4">
                <h2 className="text-xl font-bold text-red-100">
                  {scheduleData.week[selectedDay].dayName}, {scheduleData.week[selectedDay].date}
                </h2>
                
                <div className="space-y-1 mt-3">
                  {/* Display filtered events based on mode */}
                  {scheduleData.week[selectedDay].events
                    .filter(event => isAdminMode || event.employeeId === 0)
                    .map((event) => (
                      <div 
                        key={event.id}
                        className="bg-gradient-to-r from-red-900/40 to-red-950/50 border-l-4 border-red-600 rounded-md shadow-sm p-3 mb-2"
                      >
                        <div className="flex justify-between">
                          <div className="font-medium text-white">
                            {isAdminMode ? event.employeeName : event.title}
                          </div>
                          <div className="text-xs text-red-300">
                            {event.timeRange}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* "Today" quick-jump button */}
          <button
            className="fixed bottom-4 right-4 bg-red-700 text-white rounded-full p-2 shadow-lg"
            onClick={goToToday}
            aria-label="Jump to today"
          >
            <CalendarCheck size={20} />
          </button>
        </div>
        <Sidebar 

  isSidebarOpen={isSidebarOpen}
  sidebarView={sidebarView}
  setSidebarView={setSidebarView}
  setIsSidebarOpen={setIsSidebarOpen}
  isAdminMode={isAdminMode}
  setIsAdminMode={setIsAdminMode}
  goToToday={goToToday}
  scheduleStats={{
    hoursThisWeek: scheduleData.stats.hoursThisWeek,
    totalShifts: scheduleData.stats.totalShifts,
    upcomingBreaks: scheduleData.stats.upcomingBreaks
  }}
  employees={employees}
  selectedEmployees={selectedEmployees}
  setShowAddShiftModal={setShowAddShiftModal}
/>
      </div>

      {/* Add Shift Modal */}
      {showAddShiftModal && <AddShiftModal />}

      {/* Sidebar */}

    </div>
  );
};

// Export the main component
export default function ScheduleApp() {
  return (
    <ScheduleProvider>
      <EmployeeSchedule />
    </ScheduleProvider>
  );
}

// Import here to avoid circular dependency
import { ScheduleProvider, useSchedule } from "../Scheduling/ScheduleComponents";

import { AddShiftModal} from "../Scheduling/addShiftModal";
import { generateScheduleData } from "../Scheduling/ScheduleData";import { LoadingState, ErrorState, StatCard } from "../Scheduling/UtilityComponents";
import { Sidebar } from "../Scheduling/sidebar";

