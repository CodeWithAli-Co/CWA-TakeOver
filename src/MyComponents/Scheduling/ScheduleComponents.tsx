import React, { createContext, useContext, useState, useEffect, useTransition } from 'react';

// Types
export interface EventType {
  [x: string]: undefined;
  id: string;
  type: 'shift' | 'training' | 'break' | 'off';
  title: string;
  timeRange: string;
  location?: string | null;
}

export interface DayData {
  date: string;
  month: number;
  dayName: string;
  shortName: string;
  isToday: boolean;
  events: EventType[];
}

export interface StatsType {
  hoursThisWeek: number;
  maxHours: number;
  shiftsCompleted: number;
  totalShifts: number;
  upcomingBreaks: number;
}

export interface WeekRangeType {
  start: {
    date: number;
    month: string;
  };
  end: {
    date: number;
    month: string;
  };
}

export interface ScheduleDataType {
  week: DayData[];
  stats: StatsType;
  weekRange: WeekRangeType;
  weekOffset: number;
}

export interface EmployeeType {
  id: number;
  name: string;
  shifts: number;
  avatar: string;
}

// Context type
interface ScheduleContextType {
  currentView: 'day' | 'week' | 'month';
  setCurrentView: React.Dispatch<React.SetStateAction<'day' | 'week' | 'month'>>;
  selectedDay: number | null;
  setSelectedDay: React.Dispatch<React.SetStateAction<number | null>>;
  sidebarView: 'schedule' | 'team';
  setSidebarView: React.Dispatch<React.SetStateAction<'schedule' | 'team'>>;
  isSidebarOpen: boolean;
  setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  scheduleData: ScheduleDataType | null;
  setScheduleData: React.Dispatch<React.SetStateAction<ScheduleDataType | null>>;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  isLoading: boolean;
  isError: boolean;
  isAdminMode: boolean;
  setIsAdminMode: React.Dispatch<React.SetStateAction<boolean>>;
  selectedEmployees: number[];
  setSelectedEmployees: React.Dispatch<React.SetStateAction<number[]>>;
  toggleEmployeeSelection: (employeeId: number) => void;
  clearSelectedEmployees: () => void;
  showAddShiftModal: boolean;
  setShowAddShiftModal: React.Dispatch<React.SetStateAction<boolean>>;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  goToToday: () => void;
  isPending: boolean;
  employees: EmployeeType[];
}

// Mock coworkers data
export const coworkersData: EmployeeType[] = [
  { id: 1, name: 'John Smith', shifts: 5, avatar: 'JS' },
  { id: 2, name: 'Lisa Johnson', shifts: 4, avatar: 'LJ' },
  { id: 3, name: 'Mark Williams', shifts: 3, avatar: 'MW' },
  { id: 4, name: 'Emily Davis', shifts: 5, avatar: 'ED' },
  { id: 5, name: 'Robert Brown', shifts: 2, avatar: 'RB' },
  { id: 6, name: 'Sarah Thompson', shifts: 5, avatar: 'ST' },
  { id: 7, name: 'Michael Garcia', shifts: 3, avatar: 'MG' },
  { id: 8, name: 'Jennifer Miller', shifts: 4, avatar: 'JM' }
];

// Create the context with a default value of null
export const ScheduleContext = createContext<ScheduleContextType | null>(null);

// Custom hook to use Schedule Context
export const useSchedule = (): ScheduleContextType => {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
};

// Example mock data structure
export const generateMockWeekData = (weekOffset = 0): ScheduleDataType => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7)); // Start with Sunday

  const weekData: DayData[] = [];
  const shiftTypes: ('shift' | 'training' | 'break' | 'off')[] = ['shift', 'training', 'break', 'off'];
  
  // Since it's all remote, we don't need location data
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startOfWeek);
    currentDate.setDate(startOfWeek.getDate() + i);
    
    const dayData: DayData = {
      date: currentDate.getDate().toString(),
      month: currentDate.getMonth(), // Get actual month for formatting
      dayName: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(currentDate),
      shortName: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(currentDate),
      isToday: currentDate.toDateString() === today.toDateString(),
      events: []
    };
    
    // Generate random events (more likely on weekdays, less on weekends)
    const eventCount = i === 0 || i === 6 ? 
      Math.floor(Math.random() * 2) : // Weekend: 0-1 events
      Math.floor(Math.random() * 3) + (Math.random() > 0.3 ? 1 : 0); // Weekday: 1-3 events
    
    for (let j = 0; j < eventCount; j++) {
      const eventType = shiftTypes[Math.floor(Math.random() * shiftTypes.length)];
      // Don't add more events if it's a day off
      if (j > 0 && dayData.events.some(e => e.type === 'off')) continue;
      if (eventType === 'off' && dayData.events.length > 0) continue;
      
      let timeRange;
      let title;
      
      if (eventType === 'off') {
        timeRange = 'All Day';
        title = 'Day Off';
      } else {
        const startHour = 7 + Math.floor(Math.random() * 6); // 7 AM to 12 PM
        const duration = eventType === 'training' ? 6 : 4; // Training is longer
        const endHour = startHour + duration;
        
        const startTime = `${startHour.toString().padStart(2, '0')}:00`;
        const endTime = `${endHour.toString().padStart(2, '0')}:00`;
        timeRange = `${startTime} - ${endTime}`;
        
        if (eventType === 'shift') {
          title = startHour < 12 ? 'Morning Shift' : 
                 startHour < 16 ? 'Afternoon Shift' : 'Evening Shift';
        } else if (eventType === 'training') {
          title = 'Training Session';
        } else if (eventType === 'break') {
          title = 'Break';
          timeRange = `${startTime} - ${(startHour + 1).toString().padStart(2, '0')}:00`;
        } else {
          title = 'Unknown Event';
        }
      }
      
      dayData.events.push({
        id: `${weekOffset}-${i}-${j}`,
        type: eventType,
        title,
        timeRange,
        location: null // Remote work, no physical location
      });
    }
    
    weekData.push(dayData);
  }
  
  // Calculate stats - make sure we account for all days in the week
  const totalHours = weekData.reduce((total, day) => {
    // Calculate hours for the current day by iterating through events
    return total + day.events.reduce((dayTotal, event) => {
      if (event.type === 'off') return dayTotal;
      if (event.timeRange === 'All Day') return dayTotal;
      
      const [start, end] = event.timeRange.split(' - ');
      const [startHour] = start.split(':').map(Number);
      const [endHour] = end.split(':').map(Number);
      return dayTotal + (endHour - startHour);
    }, 0);
  }, 0);

  const totalShifts = weekData.reduce((total, day) => {
    return total + day.events.filter(event => event.type === 'shift').length;
  }, 0);
  
  // For the selected day, calculate the proportion of weekly hours completed so far
  const currentDayIndex = weekData.findIndex(day => day.isToday);
  
  // Calculate hours up to and including the current day
  let hoursUpToToday = 0;
  if (currentDayIndex >= 0) {
    hoursUpToToday = weekData.slice(0, currentDayIndex + 1).reduce((total, day) => {
      return total + day.events.reduce((dayTotal, event) => {
        if (event.type === 'off') return dayTotal;
        if (event.timeRange === 'All Day') return dayTotal;
        
        const [start, end] = event.timeRange.split(' - ');
        const [startHour] = start.split(':').map(Number);
        const [endHour] = end.split(':').map(Number);
        return dayTotal + (endHour - startHour);
      }, 0);
    }, 0);
  }
  
  const stats = {
    hoursThisWeek: weekOffset === 0 ? hoursUpToToday : totalHours, // Show hours up to today for current week
    maxHours: 40,
    shiftsCompleted: weekOffset < 0 ? totalShifts : Math.floor(totalShifts / 2),
    totalShifts,
    upcomingBreaks: weekData.reduce((total, day) => {
      return total + day.events.filter(event => event.type === 'break').length;
    }, 0)
  };
  
  // First day of the week
  const firstDay = new Date(startOfWeek);
  const lastDay = new Date(startOfWeek);
  lastDay.setDate(startOfWeek.getDate() + 6);
  
  const weekRange = {
    start: {
      date: firstDay.getDate(),
      month: firstDay.toLocaleString('default', { month: 'short' })
    },
    end: {
      date: lastDay.getDate(),
      month: lastDay.toLocaleString('default', { month: 'short' })
    }
  };
  
  return {
    week: weekData,
    stats,
    weekRange,
    weekOffset
  };
};

// Schedule Context Provider
export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [sidebarView, setSidebarView] = useState<'schedule' | 'team'>('schedule');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [scheduleData, setScheduleData] = useState<ScheduleDataType | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  const [showAddShiftModal, setShowAddShiftModal] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  // Fetch data when week changes
  useEffect(() => {
    const fetchData = async () => {
      // Only show loading for slow connections
      const loadingTimeout = setTimeout(() => {
        setIsLoading(true);
      }, 300);
      
      setIsError(false);
      
      try {
        // Mock data generation - instant
        const data = generateMockWeekData(weekOffset);
        
        // Use React 18 transitions for smoother UI
        startTransition(() => {
          setScheduleData(data);
          
          // Find today or set to first day with events
          if (weekOffset === 0) {
            const todayIndex = data.week.findIndex(day => day.isToday);
            setSelectedDay(todayIndex >= 0 ? todayIndex : 0);
          } else if (selectedDay === null) {
            setSelectedDay(0);
          }
        });
      } catch (error) {
        console.error('Error fetching schedule data:', error);
        setIsError(true);
      } finally {
        clearTimeout(loadingTimeout);
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [weekOffset, selectedDay]);
  
  // Navigation functions
  const goToPreviousWeek = () => setWeekOffset(prev => prev - 1);
  const goToNextWeek = () => setWeekOffset(prev => prev + 1);
  const goToCurrentWeek = () => {
    setWeekOffset(0);
    // Jump to today when returning to current week
    const todayIndex = scheduleData?.week.findIndex(day => day.isToday);
    if (todayIndex !== undefined && todayIndex >= 0) setSelectedDay(todayIndex);
  };
  
  // Go to today function
  const goToToday = () => {
    if (weekOffset !== 0) {
      setWeekOffset(0);
    } else {
      const todayIndex = scheduleData?.week.findIndex(day => day.isToday);
      if (todayIndex !== undefined && todayIndex >= 0) setSelectedDay(todayIndex);
    }
  };
  
  // Employee selection functions
  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };
  
  const clearSelectedEmployees = () => {
    setSelectedEmployees([]);
  };
  
  const contextValue: ScheduleContextType = {
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
    setWeekOffset,
    isLoading,
    isError,
    isAdminMode, 
    setIsAdminMode,
    selectedEmployees,
    setSelectedEmployees,
    toggleEmployeeSelection,
    clearSelectedEmployees,
    showAddShiftModal,
    setShowAddShiftModal,
    goToPreviousWeek,
    goToNextWeek,
    goToCurrentWeek,
    goToToday,
    isPending,
    employees: coworkersData
  };
  
  return (
    <ScheduleContext.Provider value={contextValue}>
      {children}
    </ScheduleContext.Provider>
  );
};