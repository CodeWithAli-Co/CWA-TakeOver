"use client"
import React, { useState, useEffect, useTransition } from 'react';
import { generateScheduleData, employees } from './ScheduleData';
import { 
  ScheduleContextType, 
  ScheduleContext, 
  ViewType, 
  SidebarViewType 
} from './ScheduleComponents';

export const ScheduleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentView, setCurrentView] = useState<ViewType>('week');
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarViewType>('schedule');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [scheduleData, setScheduleData] = useState<ScheduleDataType | null>(null);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([0]); // Default to Current User
  const [showAddShiftModal, setShowAddShiftModal] = useState<boolean>(false);
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
  }, [weekOffset]);
  
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

// Export employees as coworkersData
export { employees as coworkersData };