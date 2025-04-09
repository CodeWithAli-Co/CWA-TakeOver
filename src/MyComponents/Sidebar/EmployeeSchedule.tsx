import React, { useEffect } from "react";
import { CalendarCheck } from "lucide-react";
// Import the new AdminModeComponent

// Header component - updated to use AdminModeToggle
const Header = ({ isSidebarOpen, setIsSidebarOpen, isAdminMode, setIsAdminMode, currentView, setCurrentView }) => {
  return (
    <header className="bg-black border-b border-red-900/40 py-2 px-4">
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

        {/* Use the extracted AdminModeToggle component */}
        <AdminModeToggle 
          isAdminMode={isAdminMode} 
          setIsAdminMode={setIsAdminMode} 
        />
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

      {/* Use the AdminModeComponent */}
      <AdminModeComponent
        isAdminMode={isAdminMode}
        setIsAdminMode={setIsAdminMode}
        showAddShiftModal={showAddShiftModal}
        setShowAddShiftModal={setShowAddShiftModal}
        employees={employees}
        selectedEmployees={selectedEmployees}
        scheduleData={scheduleData}
      />

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
              
              {/* Calendar Body - using the filterEventsByAdminMode helper */}
              <div className="grid grid-cols-7 min-h-[300px]">
                {scheduleData.week.map((day, index) => (
                  <div 
                    key={index} 
                    className={`p-2 ${index < 6 ? 'border-r border-red-900/30' : ''} ${day.isToday ? 'bg-red-900/10' : ''} ${selectedDay === index ? 'bg-red-950/80' : ''} overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-red-900 cursor-pointer`}
                    onClick={() => setSelectedDay(index)}
                  >
                    {day.events.length > 0 ? (
                      filterEventsByAdminMode(day.events, isAdminMode)
                        .map((event, eventIndex) => (
                          <div key={eventIndex} className="mb-2">
                            <div 
                              className={`px-2 py-1 text-xs rounded ${
                                event.type === 'shift' ? 'bg-red-900/40 text-white' : 
                                event.type === 'training' ? 'bg-emerald-900/40 text-white' :
                                event.type === 'break' ? 'bg-blue-900/40 text-white' :
                                event.type === 'meeting' ? 'bg-blue-900/40 text-white' :
                                'bg-gray-800/40 text-gray-300'
                              }`}
                            >
                              <div className="font-medium truncate flex items-center">
                                {isAdminMode ? (event.employeeName || "Unassigned") : event.title}
                                {event.title.includes("Morning")}
                                {event.title.includes("Afternoon")}
                                {event.title.includes("Evening")}
                              </div>
                              <div className="flex justify-between text-xs mt-1">
                                <span>{event.timeRange}</span>
                                {isAdminMode && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Access the editShift function from context
                                      if (window.editShift) {
                                        window.editShift({...event, dayIndex: index});
                                      }
                                    }}
                                    className="ml-1 px-1 bg-red-800/60 hover:bg-red-800 rounded text-xs"
                                    title="Edit"
                                  >
                                    Edit
                                  </button>
                                )}
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

            {/* Selected Day Details - using the filterEventsByAdminMode helper */}
            {selectedDay !== null && (
              <div className="mb-4">
                <h2 className="text-xl font-bold text-red-100">
                  {scheduleData.week[selectedDay].dayName}, {scheduleData.week[selectedDay].date}
                </h2>
                
                <div className="space-y-1 mt-3">
                  {filterEventsByAdminMode(scheduleData.week[selectedDay].events, isAdminMode)
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

      {/* Add/Edit Shift Modal - render conditionally */}
      {showAddShiftModal && <AddShiftModal />}
      
      

      {/* "Today" quick-jump button */}
      <button
        className="fixed top-2 right-40 bg-red-700 text-white rounded-full p-2 shadow-lg"
        onClick={goToToday}
        aria-label="Jump to today"
      >
        <CalendarCheck size={20} />
      </button>
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
import { AddShiftModal } from "../Scheduling/addShiftModal";
import { generateScheduleData } from "../Scheduling/ScheduleData";
import { LoadingState, ErrorState, StatCard } from "../Scheduling/UtilityComponents";
import { Sidebar } from "../Scheduling/sidebar";
import AdminModeComponent, { AdminModeToggle, filterEventsByAdminMode } from "../Scheduling/AdminMode";

// Declare global window interface to support our global functions
declare global {
  interface Window {
    editShift?: (event: any) => void;
    setShowAddShiftModal?: (value: boolean) => void;
  }
}