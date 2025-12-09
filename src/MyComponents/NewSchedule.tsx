import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Users,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  X,
  Zap,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/shadcnComponents/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcnComponents/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/shadcnComponents/Label";
import supabase from "./supabase";

// Types
interface Employee {
  id: number;
  name: string;
  avatar: string;
  role: string;
  status: "active" | "break" | "offline";
}

interface ScheduleEvent {
  id: string;
  employeeId: number;
  employeeName: string;
  title: string;
  startTime: string;
  endTime: string;
  date: string;
  type: "shift" | "meeting" | "break" | "off";
  notes?: string;
}

// Sample employees
const EMPLOYEES: Employee[] = [
  { id: 1, name: "Alex Morgan", avatar: "AM", role: "Lead", status: "active" },
  { id: 2, name: "Jordan Lee", avatar: "JL", role: "Server", status: "active" },
  { id: 3, name: "Casey Kim", avatar: "CK", role: "Chef", status: "break" },
  { id: 4, name: "Riley Chen", avatar: "RC", role: "Server", status: "active" },
  { id: 5, name: "Sam Park", avatar: "SP", role: "Bar", status: "offline" },
];

const EVENT_COLORS = {
  shift: "bg-red-950/50 border-red-900/50 hover:bg-red-900/40",
  meeting: "bg-zinc-800 border-zinc-700 hover:bg-zinc-700",
  break: "bg-zinc-900 border-zinc-800 hover:bg-zinc-800",
  off: "bg-black border-zinc-900 hover:bg-zinc-950",
};

const EmployeeSchedule: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Load events
  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .schema("schedule")
        .from("event")
        .select("*");

      if (error) {
        console.error("Error loading events:", error);
        return;
      }

      const transformedEvents: ScheduleEvent[] = (data || []).map((event: any) => ({
        id: event.id || `event-${Date.now()}`,
        employeeId: event.employee_id || 0,
        employeeName: event.employee_name || "Unknown",
        title: event.title || "Shift",
        startTime: event.start_time || "09:00",
        endTime: event.end_time || "17:00",
        date: event.date || new Date().toISOString().split("T")[0],
        type: event.type || "shift",
        notes: event.notes || "",
      }));

      setEvents(transformedEvents);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };

  // Generate calendar
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: any[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateString = date.toISOString().split("T")[0];
      const dayEvents = events.filter(
        (e) =>
          e.date === dateString &&
          (selectedEmployee === null || e.employeeId === selectedEmployee)
      );

      days.push({
        date,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        events: dayEvents,
      });
    }

    // Next month days
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      days.push({
        date,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: false,
        events: [],
      });
    }

    return days;
  };

  const days = generateCalendarDays();
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const monthName = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const handleAddEvent = (date?: Date) => {
    setSelectedDate(date || null);
    setEditingEvent(null);
    setIsAddEventOpen(true);
  };

  const handleEditEvent = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setIsAddEventOpen(true);
  };

  const handleDeleteEvent = (eventId: string) => {
    setEvents(events.filter((e) => e.id !== eventId));
  };

  // Stats calculations
  const totalEvents = events.length;
  const thisWeekEvents = events.filter((e) => {
    const eventDate = new Date(e.date);
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()));
    const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6));
    return eventDate >= weekStart && eventDate <= weekEnd;
  }).length;
  const activeEmployees = EMPLOYEES.filter(e => e.status === "active").length;
  const totalMeetings = events.filter(e => e.type === "meeting").length;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-red-950 to-red-900 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-zinc-100">Schedule</h1>
                  <p className="text-xs text-zinc-500">Team management</p>
                </div>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleAddEvent()}
                className="bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-900/50 gap-2 font-medium"
              >
                <Plus className="w-4 h-4" />
                New Event
              </Button>
              <div className="w-9 h-9 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-lg flex items-center justify-center border border-zinc-800">
                <span className="text-zinc-300 font-bold text-sm">AD</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-red-950/30 border border-red-900/30 rounded-lg">
                <Zap className="w-5 h-5 text-red-400" />
              </div>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total</span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-zinc-100">{totalEvents}</div>
              <div className="text-sm text-zinc-500">Scheduled events</div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <TrendingUp className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Week</span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-zinc-100">{thisWeekEvents}</div>
              <div className="text-sm text-zinc-500">Events this week</div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <Activity className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Active</span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-zinc-100">{activeEmployees}</div>
              <div className="text-sm text-zinc-500">Team members online</div>
            </div>
          </div>

          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 hover:border-zinc-800 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg">
                <Users className="w-5 h-5 text-zinc-400" />
              </div>
              <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Meetings</span>
            </div>
            <div className="space-y-1">
              <div className="text-3xl font-bold text-zinc-100">{totalMeetings}</div>
              <div className="text-sm text-zinc-500">Scheduled meetings</div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Date Navigation */}
            <div className="flex items-center gap-3">
              <Button
                onClick={goToPreviousMonth}
                variant="ghost"
                size="icon"
                className="h-9 w-9 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                <h2 className="text-sm font-bold text-zinc-100 min-w-[180px] text-center">
                  {monthName}
                </h2>
              </div>
              <Button
                onClick={goToNextMonth}
                variant="ghost"
                size="icon"
                className="h-9 w-9 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                onClick={goToToday}
                variant="ghost"
                className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 text-xs font-medium px-3"
              >
                Today
              </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-56 bg-zinc-900 border-zinc-800 text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-700"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 gap-2">
                    <Filter className="w-4 h-4" />
                    {selectedEmployee
                      ? EMPLOYEES.find((e) => e.id === selectedEmployee)?.name
                      : "All Staff"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 bg-zinc-950 border-zinc-800">
                  <DropdownMenuItem 
                    onClick={() => setSelectedEmployee(null)}
                    className="text-zinc-300 focus:bg-zinc-900 focus:text-zinc-100"
                  >
                    All Staff
                  </DropdownMenuItem>
                  {EMPLOYEES.map((employee) => (
                    <DropdownMenuItem
                      key={employee.id}
                      onClick={() => setSelectedEmployee(employee.id)}
                      className="text-zinc-300 focus:bg-zinc-900 focus:text-zinc-100"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-6 h-6 bg-zinc-800 border border-zinc-700 rounded-md flex items-center justify-center">
                          <span className="text-zinc-400 text-xs font-bold">
                            {employee.avatar}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm">{employee.name}</div>
                          <div className="text-xs text-zinc-500">{employee.role}</div>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${
                          employee.status === "active" ? "bg-green-500" :
                          employee.status === "break" ? "bg-yellow-500" :
                          "bg-zinc-600"
                        }`} />
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden">
          {/* Week Header */}
          <div className="grid grid-cols-7 border-b border-zinc-900">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-4 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider bg-black"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => (
              <div
                key={index}
                className={`min-h-[140px] border-r border-b border-zinc-900 p-3 ${
                  !day.isCurrentMonth ? "bg-zinc-950/50" : "bg-black"
                } ${
                  day.isToday
                    ? "bg-red-950/10 border-red-900/30"
                    : "hover:bg-zinc-950/50"
                } transition-colors cursor-pointer group relative`}
                onClick={() => handleAddEvent(day.date)}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-sm font-bold ${
                      day.isToday
                        ? "bg-red-900/50 text-red-300 w-7 h-7 rounded-md flex items-center justify-center border border-red-900/50"
                        : day.isCurrentMonth
                        ? "text-zinc-300"
                        : "text-zinc-700"
                    }`}
                  >
                    {day.dayNumber}
                  </span>
                  {day.isCurrentMonth && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-900 hover:bg-zinc-800 border border-zinc-800"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddEvent(day.date);
                      }}
                    >
                      <Plus className="w-3 h-3 text-zinc-400" />
                    </Button>
                  )}
                </div>

                {/* Events */}
                <div className="space-y-1.5">
                  {day.events.slice(0, 3).map((event: ScheduleEvent) => (
                    <div
                      key={event.id}
                      className={`${EVENT_COLORS[event.type]} rounded-md px-2.5 py-1.5 text-xs font-medium flex items-center justify-between group/event cursor-pointer transition-all border`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEvent(event);
                      }}
                    >
                      <div className="flex-1 truncate">
                        <div className="text-zinc-300 font-semibold truncate">
                          {event.employeeName}
                        </div>
                        <div className="text-zinc-500 text-[10px] mt-0.5">
                          {event.startTime} - {event.endTime}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover/event:opacity-100 hover:bg-zinc-800/50 border-0"
                          >
                            <MoreHorizontal className="w-3 h-3 text-zinc-400" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-zinc-950 border-zinc-800">
                          <DropdownMenuItem 
                            onClick={() => handleEditEvent(event)}
                            className="text-zinc-300 focus:bg-zinc-900 focus:text-zinc-100"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteEvent(event.id)}
                            className="text-red-400 focus:bg-red-950/50 focus:text-red-300"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                  {day.events.length > 3 && (
                    <div className="text-[10px] text-zinc-600 pl-2 pt-1">
                      +{day.events.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal */}
      <EventModal
        isOpen={isAddEventOpen}
        onClose={() => {
          setIsAddEventOpen(false);
          setEditingEvent(null);
          setSelectedDate(null);
        }}
        event={editingEvent}
        employees={EMPLOYEES}
        selectedDate={selectedDate}
        onSave={(newEvent) => {
          if (editingEvent) {
            setEvents(events.map((e) => (e.id === editingEvent.id ? newEvent : e)));
          } else {
            setEvents([...events, newEvent]);
          }
          setIsAddEventOpen(false);
          setEditingEvent(null);
          setSelectedDate(null);
        }}
      />
    </div>
  );
};

// Event Modal
interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: ScheduleEvent | null;
  employees: Employee[];
  selectedDate: Date | null;
  onSave: (event: ScheduleEvent) => void;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  event,
  employees,
  selectedDate,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    employeeId: event?.employeeId || employees[0].id,
    title: event?.title || "",
    date: event?.date || (selectedDate ? selectedDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
    startTime: event?.startTime || "09:00",
    endTime: event?.endTime || "17:00",
    type: event?.type || "shift" as const,
    notes: event?.notes || "",
  });

  useEffect(() => {
    if (event) {
      setFormData({
        employeeId: event.employeeId,
        title: event.title,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        type: event.type,
        notes: event.notes || "",
      });
    } else if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        date: selectedDate.toISOString().split("T")[0],
      }));
    }
  }, [event, selectedDate]);

  const handleSubmit = () => {
    const selectedEmployee = employees.find((e) => e.id === formData.employeeId);
    const newEvent: ScheduleEvent = {
      id: event?.id || `event-${Date.now()}`,
      employeeId: formData.employeeId,
      employeeName: selectedEmployee?.name || "",
      title: formData.title,
      startTime: formData.startTime,
      endTime: formData.endTime,
      date: formData.date,
      type: formData.type,
      notes: formData.notes,
    };
    onSave(newEvent);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-100">
            {event ? "Edit Event" : "New Event"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Employee */}
          <div>
            <Label className="text-zinc-400 text-sm font-medium mb-2 block">Employee</Label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: Number(e.target.value) })}
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-900/50 focus:border-red-900/50"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} - {emp.role}
                </option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <Label className="text-zinc-400 text-sm font-medium mb-2 block">Event Type</Label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-900/50 focus:border-red-900/50"
            >
              <option value="shift">Shift</option>
              <option value="meeting">Meeting</option>
              <option value="break">Break</option>
              <option value="off">Off Day</option>
            </select>
          </div>

          {/* Title */}
          <div>
            <Label className="text-zinc-400 text-sm font-medium mb-2 block">Title</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Morning Shift"
              className="bg-zinc-900 border-zinc-800 text-zinc-300 placeholder:text-zinc-600 focus:border-red-900/50 focus:ring-red-900/50"
            />
          </div>

          {/* Date */}
          <div>
            <Label className="text-zinc-400 text-sm font-medium mb-2 block">Date</Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="bg-zinc-900 border-zinc-800 text-zinc-300 focus:border-red-900/50 focus:ring-red-900/50"
            />
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-zinc-400 text-sm font-medium mb-2 block">Start</Label>
              <Input
                type="time"
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="bg-zinc-900 border-zinc-800 text-zinc-300 focus:border-red-900/50 focus:ring-red-900/50"
              />
            </div>
            <div>
              <Label className="text-zinc-400 text-sm font-medium mb-2 block">End</Label>
              <Input
                type="time"
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="bg-zinc-900 border-zinc-800 text-zinc-300 focus:border-red-900/50 focus:ring-red-900/50"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-zinc-400 text-sm font-medium mb-2 block">Notes (Optional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Add notes..."
              className="bg-zinc-900 border-zinc-800 text-zinc-300 placeholder:text-zinc-600 min-h-[100px] focus:border-red-900/50 focus:ring-red-900/50"
            />
          </div>
        </div>

        <DialogFooter className="gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-900/50"
          >
            {event ? "Update" : "Create"} Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeSchedule;