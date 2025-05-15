import React, { useState, useEffect } from "react";
import { 
  X, 
  CheckSquare, 
  Square, 
  Edit2, 
  Trash2, 
  Info, 
  Check, 
  ChevronDown,
  Clock,
  Calendar,
  Briefcase,
  Coffee,
  Home,
  Users
} from "lucide-react";
import { useSchedule } from "./ScheduleComponents";
import { generateScheduleData, employees } from "./ScheduleData";
import { EditingEvent } from "./AdminMode";

// Import shadcn components
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Textarea } from "@/components/ui/textarea";


import { Checkbox } from "@/components/ui/shadcnComponents/checkbox";
import { Label } from "@/components/ui/shadcnComponents/label";
import { Input } from "@/components/ui/shadcnComponents/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/shadcnComponents/dropdown-menu";

export const AddShiftModal: React.FC = () => {
  const {
    setShowAddShiftModal,
    selectedEmployees,
    setSelectedEmployees,
    clearSelectedEmployees,
    setScheduleData,
    weekOffset,
    selectedDay,
    isAdminMode
  } = useSchedule();

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingEvent, setEditingEvent] = useState<EditingEvent | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>(
    selectedDay !== null ? [selectedDay] : []
  );
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [shiftType, setShiftType] = useState<"shift" | "training" | "break" | "off" | "meeting">("shift");
  const [isRequested, setIsRequested] = useState<boolean>(false);
  const [requestReason, setRequestReason] = useState<string>("");
  const [showRequestFields, setShowRequestFields] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(true);

  // Check for editing event from hidden input (passed from AdminModeComponent)
  useEffect(() => {
    const hiddenInput = document.getElementById('editing-event-data') as HTMLInputElement;
    if (hiddenInput && hiddenInput.value) {
      try {
        const eventData = JSON.parse(hiddenInput.value) as EditingEvent;
        setEditingEvent(eventData);
        setIsEditMode(true);
        
        // Extract time range
        if (eventData.timeRange && eventData.timeRange !== "All Day") {
          const [start, end] = eventData.timeRange.split(" - ");
          setStartTime(start);
          setEndTime(end);
        }
        
        // Set shift type
        setShiftType(eventData.type as any);
        
        // Set selected day
        if (eventData.dayIndex !== undefined) {
          setSelectedDays([eventData.dayIndex]);
        }
        
        // Set selected employee
        if (eventData.employeeId !== undefined) {
          setSelectedEmployees([eventData.employeeId]);
        }
      } catch (error) {
        console.error("Error parsing editing event data:", error);
      }
    }
  }, [setSelectedEmployees]);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(() => setShowAddShiftModal(false), 300); // Allow animation to complete
  };

  const toggleEmployeeSelection = (employeeId: number) => {
    if (isEditMode) {
      // In edit mode, we only allow one employee
      setSelectedEmployees([employeeId]);
    } else {
      setSelectedEmployees((prev) => {
        if (prev.includes(employeeId)) {
          return prev.filter((id) => id !== employeeId);
        } else {
          return [...prev, employeeId];
        }
      });
    }
  };

  const toggleDaySelection = (dayIndex: number) => {
    if (isEditMode) {
      // In edit mode, we only allow one day
      setSelectedDays([dayIndex]);
    } else {
      setSelectedDays((prev) => {
        if (prev.includes(dayIndex)) {
          return prev.filter((d) => d !== dayIndex);
        } else {
          return [...prev, dayIndex];
        }
      });
    }
  };

  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Get shift type icon and description
  const getShiftTypeInfo = (type: string) => {
    switch (type) {
      case 'shift':
        return { icon: <Briefcase size={16} />, label: 'Regular Shift', color: 'text-red-400' };
      case 'training':
        return { icon: <Calendar size={16} />, label: 'Training', color: 'text-emerald-400' };
      case 'break':
        return { icon: <Coffee size={16} />, label: 'Break', color: 'text-blue-400' };
      case 'off':
        return { icon: <Home size={16} />, label: 'Day Off', color: 'text-gray-400' };
      case 'meeting':
        return { icon: <Users size={16} />, label: 'Meeting', color: 'text-purple-400' };
      default:
        return { icon: <Briefcase size={16} />, label: 'Shift', color: 'text-red-400' };
    }
  };

  const handleAddOrUpdateShift = () => {
    // Generate a base schedule
    const data = generateScheduleData(weekOffset);
    
    if (isEditMode && editingEvent) {
      // Update existing shift
      const dayIndex = selectedDays[0];
      const day = data.week[dayIndex];
      
      // Find and update the event
      const updatedEvents = day.events.map(event => {
        if (event.id === editingEvent.id) {
          return {
            ...event,
            type: shiftType,
            title: getShiftTitle(shiftType, startTime),
            timeRange: shiftType === "off" ? "All Day" : `${startTime} - ${endTime}`,
            employeeId: selectedEmployees[0],
            employeeName: employees.find(emp => emp.id === selectedEmployees[0])?.name || "Unknown",
            isRequested: isRequested || showRequestFields,
            requestReason: requestReason
          };
        }
        return event;
      });
      
      // Update day's events
      data.week[dayIndex].events = updatedEvents;
    } else {
      // Add new shifts for all selected days and employees
      selectedDays.forEach(dayIndex => {
        selectedEmployees.forEach(employeeId => {
          const employee = employees.find(emp => emp.id === employeeId);
          if (!employee) return;
          
          // Create a new event
          const newEvent: any = {
            id: `new-${dayIndex}-${employeeId}-${Date.now()}`,
            type: shiftType,
            title: getShiftTitle(shiftType, startTime),
            timeRange: shiftType === "off" ? "All Day" : `${startTime} - ${endTime}`,
            employeeName: employee.name,
            employeeId: employee.id,
            isRequested: isRequested || showRequestFields,
            requestReason: requestReason
          };
          
          // Add the event to the appropriate day
          data.week[dayIndex].events.push(newEvent);
        });
      });
    }
    
    // Update context with new data
    setScheduleData(data);
    handleClose();
  };

  const getShiftTitle = (type: string, time: string): string => {
    if (type === "shift") {
      const hour = parseInt(time.split(":")[0]);
      if (hour >= 7 && hour < 12) return "Morning Shift";
      if (hour >= 12 && hour < 17) return "Afternoon Shift";
      return "Evening Shift";
    }
    
    if (type === "training") return "Training Session";
    if (type === "break") return "Break";
    if (type === "off") return "Day Off";
    if (type === "meeting") return "Team Meeting";
    return "Shift";
  };

  const handleDeleteShift = () => {
    if (!isEditMode || !editingEvent) return;
    
    // Generate a base schedule
    const data = generateScheduleData(weekOffset);
    
    // Find day index and remove the event
    const dayIndex = selectedDays[0];
    data.week[dayIndex].events = data.week[dayIndex].events.filter(
      event => event.id !== editingEvent.id
    );
    
    // Update context with new data
    setScheduleData(data);
    handleClose();
  };

  // Check if the form is valid
  const isFormValid = selectedEmployees.length > 0 && selectedDays.length > 0 && 
    (shiftType !== "off" ? startTime && endTime : true);

  // Get current shift type info
  const shiftTypeInfo = getShiftTypeInfo(shiftType);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="bg-black border border-red-900/40 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-red-400 flex items-center">
            {isEditMode ? (
              <>
                <Edit2 size={20} className="mr-2" />
                Edit {shiftType.charAt(0).toUpperCase() + shiftType.slice(1)}
              </>
            ) : (
              <>{isAdminMode ? "Add Shift" : "Request Schedule Change"}</>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Employee Selection */}
        <div className="mb-6">
          <h3 className="text-white text-sm font-medium mb-3">
            {isEditMode ? "Employee" : "Select Employees"}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1">
            {employees.map((employee) => (
              <div
                key={employee.id}
                onClick={() => toggleEmployeeSelection(employee.id)}
                className={`flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 ${
                  selectedEmployees.includes(employee.id)
                    ? "bg-red-900/40 border border-red-500"
                    : "hover:bg-gray-800 border border-gray-700"
                } ${isEditMode && editingEvent?.employeeId !== employee.id && selectedEmployees.includes(employee.id) ? "bg-yellow-900/20 border border-yellow-500" : ""}`}
              >
                <div className="mr-2">
                  <Checkbox 
                    checked={selectedEmployees.includes(employee.id)}
                    className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                  />
                </div>
                <div className="flex items-center">
                  <div className="w-6 h-6 rounded-full bg-red-800 flex items-center justify-center mr-2">
                    <span className="text-white text-xs">
                      {employee.avatar}
                    </span>
                  </div>
                  <span className="text-white text-sm truncate">{employee.name}</span>
                </div>
              </div>
            ))}
          </div>
          {!isEditMode && (
            <div className="mt-2 text-right">
              <Button
                onClick={clearSelectedEmployees}
                variant="ghost"
                className="text-xs text-red-400 hover:text-red-300 hover:bg-transparent"
              >
                Clear Selection
              </Button>
            </div>
          )}
        </div>

        {/* Day and Time Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-white text-sm font-medium mb-3">
              {isEditMode ? "Day" : "Select Days"}
            </h3>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {days.map((day, index) => (
                <div
                  key={index}
                  onClick={() => toggleDaySelection(index)}
                  className={`flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 ${
                    selectedDays.includes(index)
                      ? "bg-red-900/40 border border-red-500"
                      : "hover:bg-gray-800 border border-gray-700"
                  } ${isEditMode && editingEvent?.dayIndex !== index && selectedDays.includes(index) ? "bg-yellow-900/20 border border-yellow-500" : ""}`}
                >
                  <div className="mr-2">
                    <Checkbox 
                      checked={selectedDays.includes(index)}
                      className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600"
                    />
                  </div>
                  <span className="text-white text-sm">{day}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white text-sm font-medium mb-3">Shift Details</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="shift-type" className="text-red-400 text-xs">
                  Shift Type
                </Label>
                
                {/* shadcn/ui DropdownMenu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      id="shift-type" 
                      variant="outline"
                      className="w-full justify-between mt-1 bg-black border border-red-900 text-white hover:bg-red-950"
                    >
                      <div className="flex items-center gap-2">
                        <span className={shiftTypeInfo.color}>{shiftTypeInfo.icon}</span>
                        <span>{shiftTypeInfo.label}</span>
                      </div>
                      <ChevronDown size={16} className="opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-[200px] bg-black border border-red-900 text-white"
                    align="start"
                  >
                    <DropdownMenuLabel className="text-red-300">Shift Types</DropdownMenuLabel>
                    <DropdownMenuSeparator className="bg-red-900/30" />
                    <DropdownMenuGroup>
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer hover:bg-red-900 focus:bg-red-900"
                        onClick={() => setShiftType("shift")}
                      >
                        <Briefcase size={16} className="text-red-400" />
                        <span>Regular Shift</span>
                        {shiftType === "shift" && (
                          <Check size={16} className="ml-auto text-green-500" />
                        )}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer hover:bg-red-900 focus:bg-red-900"
                        onClick={() => setShiftType("training")}
                      >
                        <Calendar size={16} className="text-emerald-400" />
                        <span>Training</span>
                        {shiftType === "training" && (
                          <Check size={16} className="ml-auto text-green-500" />
                        )}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer hover:bg-red-900 focus:bg-red-900"
                        onClick={() => setShiftType("break")}
                      >
                        <Coffee size={16} className="text-blue-400" />
                        <span>Break</span>
                        {shiftType === "break" && (
                          <Check size={16} className="ml-auto text-green-500" />
                        )}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer hover:bg-red-900 focus:bg-red-900"
                        onClick={() => setShiftType("off")}
                      >
                        <Home size={16} className="text-gray-400" />
                        <span>Day Off</span>
                        {shiftType === "off" && (
                          <Check size={16} className="ml-auto text-green-500" />
                        )}
                      </DropdownMenuItem>
                      
                      <DropdownMenuItem
                        className="flex items-center gap-2 cursor-pointer hover:bg-red-900 focus:bg-red-900"
                        onClick={() => setShiftType("meeting")}
                      >
                        <Users size={16} className="text-purple-400" />
                        <span>Meeting</span>
                        {shiftType === "meeting" && (
                          <Check size={16} className="ml-auto text-green-500" />
                        )}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {shiftType !== "off" && (
                <>
                  <div>
                    <Label htmlFor="start-time" className="text-red-400 text-xs">
                      Start Time
                    </Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="bg-black border border-red-900 text-white mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-time" className="text-red-400 text-xs">
                      End Time
                    </Label>
                    <Input
                      id="end-time"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="bg-black border border-red-900 text-white mt-1"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Schedule Change Request (only visible in employee mode or when editing) */}
        {(!isAdminMode || isEditMode) && (
          <div className="mt-4 p-3 border border-yellow-700/30 bg-yellow-900/10 rounded-md">
            <div className="flex items-start">
              <div className="mr-2 mt-1">
                <Info size={16} className="text-yellow-500" />
              </div>
              <div>
                <h4 className="text-yellow-400 text-sm font-medium mb-1">
                  {isEditMode ? "Schedule Change" : "Request Schedule Change"}
                </h4>
                <p className="text-xs text-yellow-300/70 mb-2">
                  {isEditMode 
                    ? "Mark this change as a request that requires approval." 
                    : "This will send a request to your manager for approval."}
                </p>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="request-change"
                      checked={showRequestFields}
                      onCheckedChange={(checked) => setShowRequestFields(!!checked)}
                      className="data-[state=checked]:bg-yellow-600 data-[state=checked]:border-yellow-600"
                    />
                    <Label 
                      htmlFor="request-change" 
                      className="text-white text-xs cursor-pointer"
                    >
                      {isEditMode ? "Mark as a schedule change request" : "Request schedule change"}
                    </Label>
                  </div>
                  
                  {showRequestFields && (
                    <div className="mt-2">
                      <Label 
                        htmlFor="request-reason" 
                        className="block text-yellow-400 text-xs mb-1"
                      >
                        Reason for request
                      </Label>
                      <Textarea
                        id="request-reason"
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                        placeholder="Please provide a reason for this schedule change..."
                        className="bg-black border border-yellow-700/50 text-white text-xs h-16 min-h-[64px]"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <DialogFooter className="mt-6 flex justify-between">
          {isEditMode && (
            <Button
              onClick={handleDeleteShift}
              variant="destructive"
              className="bg-red-900/60 hover:bg-red-800 text-white flex items-center"
            >
              <Trash2 size={16} className="mr-1" />
              Delete
            </Button>
          )}
          
          <div className={`flex gap-3 ${isEditMode ? 'ml-auto' : ''}`}>
            <Button
              onClick={handleClose}
              variant="outline"
              className="bg-gray-800 hover:bg-gray-700 text-white border-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleAddOrUpdateShift}
              className={`bg-red-800 hover:bg-red-700 text-white`}
              disabled={!isFormValid}
            >
              {isEditMode ? "Update" : "Add"} {shiftType.charAt(0).toUpperCase() + shiftType.slice(1)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};