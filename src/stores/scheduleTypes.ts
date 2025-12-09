// Schedule Types and Utilities

export interface Employee {
  id: number;
  name: string;
  avatar: string;
  role: string;
  email?: string;
  phone?: string;
}

export interface ScheduleEvent {
  id: string;
  employeeId: number;
  employeeName: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  type: "shift" | "meeting" | "break" | "off" | "training";
  color: string;
  notes?: string;
  location?: string;
  isRecurring?: boolean;
  recurringPattern?: "daily" | "weekly" | "monthly";
}

export interface DayCell {
  date: Date;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: ScheduleEvent[];
}

export const EVENT_TYPES = {
  shift: { 
    color: "bg-blue-500", 
    label: "Shift",
    lightColor: "bg-blue-100",
    darkColor: "bg-blue-900/30",
    textColor: "text-blue-600",
  },
  meeting: { 
    color: "bg-purple-500", 
    label: "Meeting",
    lightColor: "bg-purple-100",
    darkColor: "bg-purple-900/30",
    textColor: "text-purple-600",
  },
  break: { 
    color: "bg-green-500", 
    label: "Break",
    lightColor: "bg-green-100",
    darkColor: "bg-green-900/30",
    textColor: "text-green-600",
  },
  off: { 
    color: "bg-gray-500", 
    label: "Off Day",
    lightColor: "bg-gray-100",
    darkColor: "bg-gray-900/30",
    textColor: "text-gray-600",
  },
  training: { 
    color: "bg-orange-500", 
    label: "Training",
    lightColor: "bg-orange-100",
    darkColor: "bg-orange-900/30",
    textColor: "text-orange-600",
  },
};

// Utility Functions
export const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export const formatTimeRange = (startTime: string, endTime: string): string => {
  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
};

export const calculateDuration = (startTime: string, endTime: string): number => {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  
  const startTotalMinutes = startHours * 60 + startMinutes;
  const endTotalMinutes = endHours * 60 + endMinutes;
  
  return (endTotalMinutes - startTotalMinutes) / 60; // Returns hours
};

export const isEventToday = (eventDate: string): boolean => {
  const today = new Date();
  const event = new Date(eventDate);
  return (
    event.getDate() === today.getDate() &&
    event.getMonth() === today.getMonth() &&
    event.getFullYear() === today.getFullYear()
  );
};

export const isEventThisWeek = (eventDate: string): boolean => {
  const today = new Date();
  const event = new Date(eventDate);
  
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() - today.getDay() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return event >= weekStart && event <= weekEnd;
};

export const getUpcomingEvents = (
  events: ScheduleEvent[],
  limit: number = 5
): ScheduleEvent[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return events
    .filter((event) => new Date(event.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, limit);
};

export const getEventsByEmployee = (
  events: ScheduleEvent[],
  employeeId: number
): ScheduleEvent[] => {
  return events.filter((event) => event.employeeId === employeeId);
};

export const getEventsByDateRange = (
  events: ScheduleEvent[],
  startDate: Date,
  endDate: Date
): ScheduleEvent[] => {
  return events.filter((event) => {
    const eventDate = new Date(event.date);
    return eventDate >= startDate && eventDate <= endDate;
  });
};

export const validateEvent = (event: Partial<ScheduleEvent>): string[] => {
  const errors: string[] = [];
  
  if (!event.employeeId) {
    errors.push("Employee is required");
  }
  
  if (!event.title || event.title.trim() === "") {
    errors.push("Title is required");
  }
  
  if (!event.date) {
    errors.push("Date is required");
  }
  
  if (!event.startTime) {
    errors.push("Start time is required");
  }
  
  if (!event.endTime) {
    errors.push("End time is required");
  }
  
  if (event.startTime && event.endTime && event.startTime >= event.endTime) {
    errors.push("End time must be after start time");
  }
  
  return errors;
};

// Sample Data Generator (for testing/demo purposes)
export const generateSampleEmployees = (): Employee[] => {
  return [
    { id: 1, name: "John Smith", avatar: "JS", role: "Manager", email: "john@example.com" },
    { id: 2, name: "Sarah Johnson", avatar: "SJ", role: "Server", email: "sarah@example.com" },
    { id: 3, name: "Mike Chen", avatar: "MC", role: "Chef", email: "mike@example.com" },
    { id: 4, name: "Emily Davis", avatar: "ED", role: "Server", email: "emily@example.com" },
    { id: 5, name: "David Wilson", avatar: "DW", role: "Bartender", email: "david@example.com" },
    { id: 6, name: "Lisa Anderson", avatar: "LA", role: "Host", email: "lisa@example.com" },
    { id: 7, name: "Tom Martinez", avatar: "TM", role: "Server", email: "tom@example.com" },
    { id: 8, name: "Anna Lee", avatar: "AL", role: "Chef", email: "anna@example.com" },
  ];
};

export const generateSampleEvents = (): ScheduleEvent[] => {
  const today = new Date();
  const events: ScheduleEvent[] = [];
  
  // Generate events for the next 30 days
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateString = date.toISOString().split("T")[0];
    
    // Add 2-4 random events per day
    const numEvents = Math.floor(Math.random() * 3) + 2;
    for (let j = 0; j < numEvents; j++) {
      const employeeId = Math.floor(Math.random() * 8) + 1;
      const types = Object.keys(EVENT_TYPES) as Array<keyof typeof EVENT_TYPES>;
      const type = types[Math.floor(Math.random() * types.length)];
      
      events.push({
        id: `event-${i}-${j}`,
        employeeId,
        employeeName: `Employee ${employeeId}`,
        title: `${EVENT_TYPES[type].label} ${j + 1}`,
        startTime: "09:00",
        endTime: "17:00",
        date: dateString,
        type,
        color: EVENT_TYPES[type].color,
      });
    }
  }
  
  return events;
};