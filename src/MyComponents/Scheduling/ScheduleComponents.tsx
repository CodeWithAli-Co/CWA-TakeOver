import React, { createContext, useContext, useState, useEffect, useTransition } from 'react';
import { generateScheduleData, employees } from './ScheduleData';

// Types
export interface EventType {
  id: string;
  type: 'shift' | 'training' | 'break' | 'off';
  title: string;
  timeRange: string;
  location?: string | null;
  employeeName?: string;
  employeeId?: number;
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

// Rename coworkersData to just use the imported employees
export { employees as coworkersData };

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
        // Get consistent data from ScheduleData
        const data = generateScheduleData(weekOffset);
        
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
    employees
  };
  
  return (
    <ScheduleContext.Provider value={contextValue}>
      {children}
    </ScheduleContext.Provider>
  );
};