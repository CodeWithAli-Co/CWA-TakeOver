import React, { useState } from 'react';
import { 
  Calendar, Clock, ChevronLeft, ChevronRight, 
  Users, Briefcase, Clipboard, Coffee, Home,
  Bell, Settings, User, PieChart, BarChart4,
  Info, CalendarDays, FileText, MessageSquare
} from 'lucide-react';

// Mock data
const scheduleData = {
  stats: {
    hoursThisWeek: 32,
    maxHours: 40,
    shiftsCompleted: 3,
    totalShifts: 8,
    upcomingBreaks: 2
  },
  week: [
    {
      date: '20',
      dayName: 'Sunday',
      shortName: 'Sun',
      isToday: false,
      events: [
        { id: 1, type: 'off', title: 'Day Off', timeRange: 'All Day' }
      ]
    },
    {
      date: '21',
      dayName: 'Monday',
      shortName: 'Mon',
      isToday: false,
      events: [
        { id: 2, type: 'shift', title: 'Morning Shift', timeRange: '08:00 - 12:00', location: 'Main Floor' },
        { id: 3, type: 'shift', title: 'Afternoon Shift', timeRange: '13:00 - 17:00', location: 'Service Desk' }
      ]
    },
    {
      date: '22',
      dayName: 'Tuesday',
      shortName: 'Tue',
      isToday: true,
      events: [
        { id: 4, type: 'training', title: 'Training', timeRange: '09:00 - 15:00', location: 'Training Room' }
      ]
    },
    {
      date: '23',
      dayName: 'Wednesday',
      shortName: 'Wed',
      isToday: false,
      events: [
        { id: 5, type: 'off', title: 'Day Off', timeRange: 'All Day' }
      ]
    },
    {
      date: '24',
      dayName: 'Thursday',
      shortName: 'Thu',
      isToday: false,
      events: [
        { id: 6, type: 'shift', title: 'Morning Shift', timeRange: '08:00 - 12:00', location: 'Main Floor' },
        { id: 7, type: 'shift', title: 'Afternoon Shift', timeRange: '13:00 - 17:00', location: 'Back Office' }
      ]
    },
    {
      date: '25',
      dayName: 'Friday',
      shortName: 'Fri',
      isToday: false,
      events: [
        { id: 8, type: 'shift', title: 'Late Shift', timeRange: '12:00 - 20:00', location: 'Main Floor' }
      ]
    },
    {
      date: '26',
      dayName: 'Saturday',
      shortName: 'Sat',
      isToday: false,
      events: []
    }
  ],
  coworkers: [
    { id: 1, name: 'John', shifts: 5, avatar: 'J' },
    { id: 2, name: 'Lisa', shifts: 4, avatar: 'L' },
    { id: 3, name: 'Mark', shifts: 3, avatar: 'M' },
    { id: 4, name: 'Emily', shifts: 5, avatar: 'E' },
    { id: 5, name: 'Robert', shifts: 2, avatar: 'R' }
  ]
};

const EventCard = ({ event }) => {
  // Get event-specific styles
  const getEventStyles = (type) => {
    switch(type) {
      case 'shift':
        return {
          bg: 'bg-gradient-to-r from-red-900/20 to-red-950/50',
          border: 'border-l-4 border-red-600',
          icon: <Briefcase className="text-red-500" size={16} />
        };
      case 'training':
        return {
          bg: 'bg-gradient-to-r from-emerald-900/20 to-emerald-950/50',
          border: 'border-l-4 border-emerald-600',
          icon: <Clipboard className="text-emerald-500" size={16} />
        };
      case 'break':
        return {
          bg: 'bg-gradient-to-r from-blue-900/20 to-blue-950/50',
          border: 'border-l-4 border-blue-600',
          icon: <Coffee className="text-blue-500" size={16} />
        };
      case 'off':
        return {
          bg: 'bg-gradient-to-r from-gray-800/20 to-gray-900/50',
          border: 'border-l-4 border-gray-600',
          icon: <Home className="text-gray-500" size={16} />
        };
      default:
        return {
          bg: 'bg-gradient-to-r from-red-900/20 to-red-950/50',
          border: 'border-l-4 border-red-600',
          icon: <Calendar className="text-red-500" size={16} />
        };
    }
  };

  const styles = getEventStyles(event.type);

  return (
    <div className={`${styles.bg} ${styles.border} rounded-md shadow-sm p-3 mb-2`}>
      <div className="flex">
        <div className="mr-2 mt-0.5">
          {styles.icon}
        </div>
        <div>
          <div className="font-medium text-white">{event.title}</div>
          <div className="text-xs text-red-300/80 flex items-center gap-1">
            <Clock size={12} />
            {event.timeRange}
            {event.location && (
              <>
                <span className="mx-1">•</span>
                {event.location}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EmployeeSchedule = () => {
  const [currentView, setCurrentView] = useState('week');
  const [selectedDay, setSelectedDay] = useState(2); // Index of the selected day (Tuesday)
  const [sidebarView, setSidebarView] = useState('schedule');
  
  return (
    <div className="flex flex-col h-screen bg-black">
      {/* Top Navigation */}
      <header className="bg-black border-b border-red-900/40 py-2 px-4">
        <div className="flex items-center justify-between">
          {/* Logo and Title */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              Employee Schedule
            </h1>
          </div>
          
          {/* View Selector */}
          <div className="flex bg-red-950/30 rounded-lg overflow-hidden border border-red-900/30">
            <button 
              onClick={() => setCurrentView('day')}
              className={`px-4 py-1.5 text-sm ${currentView === 'day' ? 'bg-red-900/80 text-white' : 'text-red-300 hover:bg-red-900/30'}`}
            >
              Day
            </button>
            <button 
              onClick={() => setCurrentView('week')}
              className={`px-4 py-1.5 text-sm ${currentView === 'week' ? 'bg-red-900/80 text-white' : 'text-red-300 hover:bg-red-900/30'}`}
            >
              Week
            </button>
            <button 
              onClick={() => setCurrentView('month')}
              className={`px-4 py-1.5 text-sm ${currentView === 'month' ? 'bg-red-900/80 text-white' : 'text-red-300 hover:bg-red-900/30'}`}
            >
              Month
            </button>
          </div>
          
          {/* User Controls */}
          <div className="flex items-center gap-3">
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
      
      {/* Week Navigator */}
      <div className="bg-black border-b border-red-900/40 px-4 py-3 flex justify-between items-center">
        <button className="p-1 rounded-md hover:bg-red-900/30 text-red-400">
          <ChevronLeft size={20} />
        </button>
        
        <h2 className="text-red-100 font-bold text-lg">Week of Aug 20 - Aug 26</h2>
        
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 text-xs rounded-md bg-red-900/30 hover:bg-red-900/50 text-red-200">
            This Week
          </button>
          <button className="p-1 rounded-md hover:bg-red-900/30 text-red-400">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          {/* Day Selector (Timeline View) */}
          <div className="flex justify-between border-b border-red-900/30 bg-black/60">
            {scheduleData.week.map((day, index) => (
              <button 
                key={index}
                className={`relative py-2 flex-1 flex flex-col items-center ${selectedDay === index ? 'bg-red-900/20' : 'hover:bg-red-900/10'}`}
                onClick={() => setSelectedDay(index)}
              >
                <span className={`text-sm ${day.isToday ? 'text-red-400 font-semibold' : 'text-red-300'}`}>
                  {day.shortName}
                </span>
                <span className={`text-lg ${day.isToday ? 'text-white font-bold' : 'text-red-100'}`}>
                  {day.date}
                </span>
                {selectedDay === index && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-600"></div>
                )}
              </button>
            ))}
          </div>
          
          {/* Schedule Content */}
          <div className="p-4">
            {/* Today's Quick Stats */}
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="flex-1 min-w-[200px] p-4 rounded-lg bg-gradient-to-br from-red-950/40 to-black border border-red-900/40">
                <h3 className="text-red-400 text-sm font-medium mb-2">Weekly Hours</h3>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-white">{scheduleData.stats.hoursThisWeek} <span className="text-sm text-red-300">/ {scheduleData.stats.maxHours} hrs</span></div>
                  <PieChart size={32} className="text-red-600" />
                </div>
                <div className="mt-2 h-2 bg-red-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-700 to-red-500" 
                    style={{ width: `${(scheduleData.stats.hoursThisWeek / scheduleData.stats.maxHours) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="flex-1 min-w-[200px] p-4 rounded-lg bg-gradient-to-br from-red-950/40 to-black border border-red-900/40">
                <h3 className="text-red-400 text-sm font-medium mb-2">Shifts Completed</h3>
                <div className="flex items-end justify-between">
                  <div className="text-2xl font-bold text-white">{scheduleData.stats.shiftsCompleted} <span className="text-sm text-red-300">/ {scheduleData.stats.totalShifts}</span></div>
                  <BarChart4 size={32} className="text-red-600" />
                </div>
                <div className="mt-2 h-2 bg-red-950 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-red-700 to-red-500" 
                    style={{ width: `${(scheduleData.stats.shiftsCompleted / scheduleData.stats.totalShifts) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Selected Day Header */}
            <div className="mb-4">
              <h2 className="text-xl font-bold text-red-100">{scheduleData.week[selectedDay].dayName}, Aug {scheduleData.week[selectedDay].date}</h2>
              <p className="text-red-400 text-sm">
                {scheduleData.week[selectedDay].events.length > 0 
                  ? `${scheduleData.week[selectedDay].events.length} scheduled ${scheduleData.week[selectedDay].events.length === 1 ? 'activity' : 'activities'}` 
                  : 'No scheduled activities'
                }
              </p>
            </div>
            
            {/* Selected Day Events */}
            <div className="space-y-1">
              {scheduleData.week[selectedDay].events.length > 0 ? (
                scheduleData.week[selectedDay].events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className="p-8 rounded-lg border border-red-900/20 bg-black/50 flex flex-col items-center justify-center text-center">
                  <Calendar className="text-red-700 mb-3" size={40} />
                  <p className="text-red-300">No activities scheduled for this day</p>
                  <button className="mt-4 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 rounded-md text-white text-sm">
                    Request Shift
                  </button>
                </div>
              )}
            </div>
            
            {/* Upcoming Activities (visible for weekly view) */}
            {currentView === 'week' && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-red-200 mb-4">Full Week at a Glance</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {scheduleData.week.map((day, index) => (
                    index !== selectedDay && day.events.length > 0 && (
                      <div key={index} className="p-3 rounded-lg bg-black/70 border border-red-900/30">
                        <h4 className="text-red-300 font-medium mb-2">{day.dayName}, Aug {day.date}</h4>
                        <div className="space-y-2">
                          {day.events.map(event => (
                            <div key={event.id} className="text-sm px-3 py-2 rounded bg-red-950/30 border-l-2 border-red-700">
                              <div className="font-medium text-white">{event.title}</div>
                              <div className="text-xs text-red-300/80">{event.timeRange}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="w-52 border-l border-red-900/40 bg-black/90 flex flex-col">
          {/* Sidebar Navigation */}
          <div className="flex border-b border-red-900/40">
            <button 
              className={`flex-1 py-3 text-center text-sm ${sidebarView === 'schedule' ? 'text-red-300 border-b-2 border-red-700' : 'text-red-400/70 hover:text-red-300'}`}
              onClick={() => setSidebarView('schedule')}
            >
              Schedule
            </button>
            <button 
              className={`flex-1 py-3 text-center text-sm ${sidebarView === 'team' ? 'text-red-300 border-b-2 border-red-700' : 'text-red-400/70 hover:text-red-300'}`}
              onClick={() => setSidebarView('team')}
            >
              Team
            </button>
          </div>
          
          <div className="p-3 overflow-y-auto flex-1">
            {sidebarView === 'schedule' ? (
              <div className="space-y-4">
                {/* Schedule Actions */}
                <div className="space-y-2">
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm">
                    <CalendarDays size={16} />
                    My Schedule
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm">
                    <FileText size={16} />
                    Request Time Off
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-900/30 text-red-200 text-sm">
                    <MessageSquare size={16} />
                    Schedule Notes
                  </button>
                </div>
                
                {/* Schedule Summary */}
                <div className="pt-3 border-t border-red-900/30">
                  <h3 className="text-red-400 text-xs font-medium uppercase mb-2">This Week</h3>
                  <div className="space-y-2">
                    <div className="text-sm flex justify-between">
                      <span className="text-red-300/80">Total Hours:</span>
                      <span className="text-white font-medium">{scheduleData.stats.hoursThisWeek} hrs</span>
                    </div>
                    <div className="text-sm flex justify-between">
                      <span className="text-red-300/80">Shifts:</span>
                      <span className="text-white font-medium">{scheduleData.stats.totalShifts}</span>
                    </div>
                    <div className="text-sm flex justify-between">
                      <span className="text-red-300/80">Breaks:</span>
                      <span className="text-white font-medium">{scheduleData.stats.upcomingBreaks}</span>
                    </div>
                  </div>
                </div>
                
                {/* Quick Notes */}
                <div className="pt-3 border-t border-red-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-red-400 text-xs font-medium uppercase">Notes</h3>
                    <button className="text-red-400 hover:text-red-300 p-1 rounded-full hover:bg-red-900/30">
                      <Info size={14} />
                    </button>
                  </div>
                  <div className="p-2 bg-red-950/20 rounded-md border border-red-900/40 text-xs text-red-200/90">
                    Remember to check inventory levels before your Thursday shift. - Manager
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Team Members On Shift */}
                <h3 className="text-red-400 text-xs font-medium uppercase mb-2">Coworkers This Week</h3>
                <div className="space-y-2">
                  {scheduleData.coworkers.map(coworker => (
                    <div key={coworker.id} className="flex items-center justify-between p-2 hover:bg-red-900/20 rounded-md">
                      <div className="flex items-center">
                        <div className="w-7 h-7 rounded-full bg-red-800 flex items-center justify-center mr-2">
                          <span className="text-white text-xs">{coworker.avatar}</span>
                        </div>
                        <span className="text-red-200 text-sm">{coworker.name}</span>
                      </div>
                      <span className="text-xs bg-red-900/30 px-2 py-0.5 rounded-full text-red-300">
                        {coworker.shifts} shifts
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Team Lead */}
                <div className="pt-3 border-t border-red-900/30">
                  <h3 className="text-red-400 text-xs font-medium uppercase mb-2">Shift Manager</h3>
                  <div className="flex items-center p-2 bg-red-950/30 rounded-md">
                    <div className="w-8 h-8 rounded-full bg-red-700 flex items-center justify-center mr-3">
                      <User size={16} className="text-white" />
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">Sarah Thompson</div>
                      <div className="text-red-300/80 text-xs">On duty Mon-Fri</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Request Schedule Change Button */}
          <div className="p-3 border-t border-red-900/40">
            <button className="w-full py-2 bg-red-800 hover:bg-red-700 text-white rounded-md text-sm transition-colors">
              Request Schedule Change
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeSchedule;