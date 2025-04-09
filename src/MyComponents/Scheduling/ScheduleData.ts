// ScheduleData.ts - Consistent data for schedule
import { 
    ScheduleDataType, 
    EventType, 
    EmployeeType, 
    DayDataType 
  } from "./ScheduleComponents";
  
  // Employee data
  export const employees: EmployeeType[] = [
    { id: 0, name: "Current User", shifts: 4, avatar: "CU" },
    { id: 1, name: "John Smith", shifts: 5, avatar: "JS" },
    { id: 2, name: "Lisa Johnson", shifts: 4, avatar: "LJ" },
    { id: 3, name: "Mark Williams", shifts: 3, avatar: "MW" },
    { id: 4, name: "Emily Davis", shifts: 5, avatar: "ED" },
    { id: 5, name: "Robert Brown", shifts: 2, avatar: "RB" },
    { id: 6, name: "Sarah Thompson", shifts: 5, avatar: "ST" },
    { id: 7, name: "Michael Garcia", shifts: 3, avatar: "MG" }
  ];
  
  // Base event data that remains consistent
  const baseEvents: EventType[][] = [
    // Sunday
    [
      { 
        id: "sun-1", 
        type: "off", 
        title: "Day Off", 
        timeRange: "All Day", 
        employeeName: "Current User", 
        employeeId: 0 
      }
    ],
    // Monday
    [
      { 
        id: "mon-1", 
        type: "break", 
        title: "Break", 
        timeRange: "10:00 - 11:00", 
        employeeName: "Current User", 
        employeeId: 0 
      },
      { 
        id: "mon-2", 
        type: "shift", 
        title: "Morning Shift", 
        timeRange: "08:00 - 12:00", 
        employeeName: "John Smith", 
        employeeId: 1 
      },
      { 
        id: "mon-3", 
        type: "shift", 
        title: "Afternoon Shift", 
        timeRange: "13:00 - 17:00", 
        employeeName: "Lisa Johnson", 
        employeeId: 2 
      }
    ],
    // Tuesday
    [
      { 
        id: "tue-1", 
        type: "break", 
        title: "Break", 
        timeRange: "09:00 - 10:00", 
        employeeName: "Current User", 
        employeeId: 0 
      },
      { 
        id: "tue-2", 
        type: "break", 
        title: "Break", 
        timeRange: "08:00 - 09:00", 
        employeeName: "Mark Williams", 
        employeeId: 3 
      },
      { 
        id: "tue-3", 
        type: "training", 
        title: "Training Session", 
        timeRange: "08:00 - 14:00", 
        employeeName: "Current User", 
        employeeId: 0 
      }
    ],
    // Wednesday
    [
      { 
        id: "wed-1", 
        type: "break", 
        title: "Break", 
        timeRange: "09:00 - 10:00", 
        employeeName: "Current User", 
        employeeId: 0 
      },
      { 
        id: "wed-2", 
        type: "shift", 
        title: "Morning Shift", 
        timeRange: "11:00 - 15:00", 
        employeeName: "Current User", 
        employeeId: 0 
      },
      { 
        id: "wed-3", 
        type: "shift", 
        title: "Afternoon Shift", 
        timeRange: "12:00 - 16:00", 
        employeeName: "Emily Davis", 
        employeeId: 4 
      }
    ],
    // Thursday
    [
      { 
        id: "thu-1", 
        type: "off", 
        title: "Day Off", 
        timeRange: "All Day", 
        employeeName: "Current User", 
        employeeId: 0 
      }
    ],
    // Friday
    [
      { 
        id: "fri-1", 
        type: "break", 
        title: "Break", 
        timeRange: "12:00 - 13:00", 
        employeeName: "Current User", 
        employeeId: 0 
      },
      { 
        id: "fri-2", 
        type: "shift", 
        title: "Evening Shift", 
        timeRange: "16:00 - 22:00", 
        employeeName: "Robert Brown", 
        employeeId: 5 
      }
    ],
    // Saturday
    [
      { 
        id: "sat-1", 
        type: "training", 
        title: "Training Session", 
        timeRange: "08:00 - 14:00", 
        employeeName: "Current User", 
        employeeId: 0 
      }
    ]
  ];
  
  // Store added shifts to persist them during the session
  let userAddedEvents: (EventType & { dayIndex?: number })[] = [];
  
  // Function to save newly added shifts
  export const saveNewEvent = (event: EventType, dayIndex: number): void => {
    userAddedEvents.push({ ...event, dayIndex });
  };
  
  // Function to clear all added shifts
  export const clearAddedEvents = (): void => {
    userAddedEvents = [];
  };
  
  // Fixed schedule data that doesn't change
  export const generateScheduleData = (weekOffset = 0): ScheduleDataType => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (weekOffset * 7)); // Start with Sunday
    
    // Create week data with fixed events plus any user-added events
    const weekData: DayDataType[] = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startOfWeek);
      currentDate.setDate(startOfWeek.getDate() + i);
      
      // Get base events for this day
      const dayEvents: EventType[] = [...baseEvents[i]];
      
      // Add any user-added events for this day
      const addedEventsForDay = userAddedEvents.filter(event => event.dayIndex === i);
      if (addedEventsForDay.length > 0) {
        addedEventsForDay.forEach(event => {
          const { dayIndex, ...eventWithoutDay } = event;
          dayEvents.push(eventWithoutDay);
        });
      }
      
      const dayData: DayDataType = {
        date: currentDate.getDate().toString(),
        month: currentDate.getMonth(),
        dayName: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(currentDate),
        shortName: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(currentDate),
        isToday: currentDate.toDateString() === today.toDateString(),
        events: dayEvents
      };
      
      weekData.push(dayData);
    }
    
    // Calculate statistics based on all events
    const allEvents = weekData.flatMap(day => day.events);
    
    const totalHours = allEvents.reduce((total, event) => {
      if (event.type === 'off' || event.timeRange === 'All Day') return total;
      
      const [start, end] = event.timeRange.split(' - ');
      const [startHour] = start.split(':').map(Number);
      const [endHour] = end.split(':').map(Number);
      return total + (endHour - startHour);
    }, 0);
    
    const totalShifts = allEvents.filter(event => 
      event.type === 'shift' && event.employeeId === 0
    ).length;
    
    const shiftsCompleted = weekOffset <= 0 ? Math.floor(totalShifts / 2) : 0;
    
    const upcomingBreaks = allEvents.filter(event => 
      event.type === 'break' && event.employeeId === 0
    ).length;
    
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
      stats: {
        hoursThisWeek: weekOffset <= 0 ? Math.floor(totalHours * 0.7) : totalHours,
        maxHours: 40,
        shiftsCompleted,
        totalShifts,
        upcomingBreaks
      },
      weekRange,
      weekOffset
    };
  };