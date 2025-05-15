import React, { useState } from "react";
import { 
  Clock, 
  Users, 
  ChevronDown, 
  Check, 
  CalendarIcon, 
  MapPin
} from "lucide-react";
import { useSchedule } from "./ScheduleComponents";
import { generateScheduleData } from "./ScheduleData";
import { EmployeeType } from "./ScheduleComponents";
import { format } from "date-fns"; // For date formatting
import { cn } from "@/lib/utils"; // For conditional class names

// Import shadcn components
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Textarea } from "@/components/ui/textarea";
// import { Label } from "@/components/ui/label";


import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Checkbox } from "@/components/ui/shadcnComponents/checkbox";
import { Input } from "@/components/ui/shadcnComponents/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/shadcnComponents/dropdown-menu";
// We'll use input type="date" instead of the Calendar component since there might be a conflict
// or an incompatible import

interface MeetingModalProps {
  setShowMeetingModal: (value: boolean) => void;
  employees: EmployeeType[];
}

export const MeetingModal: React.FC<MeetingModalProps> = ({ 
  setShowMeetingModal,
  employees
}) => {
  const {
    selectedEmployees,
    setSelectedEmployees,
    clearSelectedEmployees,
    setScheduleData,
    weekOffset,
    selectedDay,
  } = useSchedule();

  // State variables
  const [isOpen, setIsOpen] = useState(true);
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingDate, setMeetingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [meetingLocation, setMeetingLocation] = useState("");
  const [meetingDescription, setMeetingDescription] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  
  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setShowMeetingModal(false), 300); // Allow animation to complete
  };

  const toggleEmployeeSelection = (employeeId: number) => {
    setSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleCreateMeeting = () => {
    if (!meetingDate) return;
    
    // Generate a base schedule
    const data = generateScheduleData(weekOffset);
    
    // Find the day index based on the selected date
    const today = new Date();
    const selectedDate = new Date(meetingDate);
    const daysDiff = Math.floor((selectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const dayIndex = (today.getDay() + daysDiff) % 7;
    
    // Add new meeting for all selected employees
    selectedEmployees.forEach(employeeId => {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) return;
      
      // Create a new meeting event
      const newEvent = {
        id: `meeting-${dayIndex}-${employeeId}-${Date.now()}`,
        type: "meeting" as const,
        title: meetingTitle || "Team Meeting",
        timeRange: `${startTime} - ${endTime}`,
        employeeName: employee.name,
        employeeId: employee.id,
        location: meetingLocation,
        description: meetingDescription,
        isRequired: isRequired
      };
      
      // Add the event to the appropriate day
      data.week[dayIndex].events.push(newEvent);
    });
    
    // Update context with new data
    setScheduleData(data);
    handleClose();
  };

  // Form validation
  const isFormValid = meetingTitle.trim() !== "" && 
    selectedEmployees.length > 0 && 
    meetingDate !== undefined &&
    startTime && endTime;

  // Helper function to format date for display
  const formatDisplayDate = (dateString: string) => {
    if (!dateString) return "Pick a date";
    try {
      const date = new Date(dateString);
      return format(date, "PPP"); // e.g., "May 15th, 2025"
    } catch (error) {
      return "Invalid date";
    }
  };

  // Generate time options for the dropdowns
  const generateTimeOptions = () => {
    const options = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = minute.toString().padStart(2, '0');
        options.push(`${formattedHour}:${formattedMinute}`);
      }
    }
    return options;
  };

  const timeOptions = generateTimeOptions();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-black border border-blue-900/40 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-blue-400 flex items-center">
            <Users size={20} className="mr-2" />
            Create Meeting
          </DialogTitle>
        </DialogHeader>

        {/* Meeting Details */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="meeting-title" className="text-white text-sm">
              Meeting Title*
            </Label>
            <Input
              id="meeting-title"
              type="text"
              value={meetingTitle}
              onChange={(e) => setMeetingTitle(e.target.value)}
              placeholder="Enter meeting title"
              className="bg-black border border-blue-900 text-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 mt-1"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date-picker" className="text-white text-sm">
                Date*
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                  <CalendarIcon className="h-4 w-4 text-blue-400" />
                </div>
                <Input
                  id="date-picker"
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="bg-black border border-blue-900 text-white pl-10 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 mt-1 w-full"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="meeting-location" className="text-white text-sm">
                Location
              </Label>
              <div className="flex items-center mt-1">
                <MapPin size={16} className="text-blue-400 absolute ml-3" />
                <Input
                  id="meeting-location"
                  type="text"
                  value={meetingLocation}
                  onChange={(e) => setMeetingLocation(e.target.value)}
                  placeholder="Conference room, Zoom, etc."
                  className="bg-black border border-blue-900 text-white pl-9 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-time" className="text-white text-sm">
                Start Time*
              </Label>
              
              {/* Start Time Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="start-time"
                    variant="outline"
                    className="w-full justify-between mt-1 bg-black border border-blue-900 text-white hover:bg-blue-950/50"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-400" />
                      <span>{startTime}</span>
                    </div>
                    <ChevronDown size={16} className="opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[180px] bg-gray-950 border border-blue-900 text-white"
                  align="start"
                >
                  <DropdownMenuLabel className="text-blue-300">Start Time</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-blue-900/30" />
                  <div className="max-h-[300px] overflow-y-auto">
                    {timeOptions.map((time) => (
                      <DropdownMenuItem
                        key={time}
                        className="flex items-center gap-2 cursor-pointer hover:bg-blue-900/40 focus:bg-blue-900/40"
                        onClick={() => setStartTime(time)}
                      >
                        <Clock size={16} className="text-blue-400" />
                        <span>{time}</span>
                        {startTime === time && (
                          <Check size={16} className="ml-auto text-green-500" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <div>
              <Label htmlFor="end-time" className="text-white text-sm">
                End Time*
              </Label>
              
              {/* End Time Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    id="end-time"
                    variant="outline"
                    className="w-full justify-between mt-1 bg-black border border-blue-900 text-white hover:bg-blue-950/50"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-400" />
                      <span>{endTime}</span>
                    </div>
                    <ChevronDown size={16} className="opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-[180px] bg-gray-950 border border-blue-900 text-white"
                  align="start"
                >
                  <DropdownMenuLabel className="text-blue-300">End Time</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-blue-900/30" />
                  <div className="max-h-[300px] overflow-y-auto">
                    {timeOptions.map((time) => (
                      <DropdownMenuItem
                        key={time}
                        className="flex items-center gap-2 cursor-pointer hover:bg-blue-900/40 focus:bg-blue-900/40"
                        onClick={() => setEndTime(time)}
                      >
                        <Clock size={16} className="text-blue-400" />
                        <span>{time}</span>
                        {endTime === time && (
                          <Check size={16} className="ml-auto text-green-500" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          <div>
            <Label htmlFor="meeting-description" className="text-white text-sm">
              Description
            </Label>
            <Textarea
              id="meeting-description"
              value={meetingDescription}
              onChange={(e) => setMeetingDescription(e.target.value)}
              placeholder="Meeting agenda, preparation instructions, etc."
              className="bg-black border border-blue-900 text-white h-20 min-h-[80px] focus:border-blue-600 focus:ring-1 focus:ring-blue-600 mt-1"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Checkbox
              id="required-attendance"
              checked={isRequired}
              onCheckedChange={(checked) => setIsRequired(!!checked)}
              className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <Label 
              htmlFor="required-attendance" 
              className="text-white text-sm cursor-pointer"
            >
              Attendance required
            </Label>
          </div>
        </div>

        {/* Employee Selection */}
        <div className="my-6">
          <h3 className="text-white text-sm font-medium mb-3 flex items-center">
            <Users size={16} className="mr-1" />
            Invite Employees*
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
            {employees.map((employee) => (
              <div
                key={employee.id}
                onClick={() => toggleEmployeeSelection(employee.id)}
                className={`flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 ${
                  selectedEmployees.includes(employee.id)
                    ? "bg-blue-900/40 border border-blue-500"
                    : "hover:bg-gray-800 border border-gray-700"
                }`}
              >
                <div className="mr-2">
                  <Checkbox 
                    checked={selectedEmployees.includes(employee.id)}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-800 flex items-center justify-center mr-2">
                    <span className="text-white text-xs">
                      {employee.avatar || employee.name.charAt(0)}
                    </span>
                  </div>
                  <span className="text-white text-sm truncate">{employee.name}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 text-right">
            <Button
              onClick={clearSelectedEmployees}
              variant="ghost"
              className="text-xs text-blue-400 hover:text-blue-300 hover:bg-transparent"
            >
              Clear Selection
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        <DialogFooter className="flex justify-end gap-3">
          <Button
            onClick={handleClose}
            variant="outline"
            className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleCreateMeeting}
            className="bg-blue-800 hover:bg-blue-700 text-white flex items-center gap-1"
            disabled={!isFormValid}
          >
            <Clock size={14} />
            Create Meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};