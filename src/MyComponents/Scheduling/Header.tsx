import React from "react";
import { Bell, Menu, Settings, X } from "lucide-react";

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isAdminMode: boolean;
  setIsAdminMode: (admin: boolean) => void;
  currentView: 'day' | 'week' | 'month';
  setCurrentView: (view: 'day' | 'week' | 'month') => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isAdminMode,
  setIsAdminMode,
  currentView,
  setCurrentView
}) => {
  return (
    <header className="bg-black border-b border-red-900/40 py-2 px-4">
      <div className="flex items-center justify-between">
        {/* Logo and Title */}
        <div className="flex items-center">
          <button
            className="mr-2 p-1.5 rounded-full lg:hidden hover:bg-red-900/30"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {isSidebarOpen ? (
              <X size={20} className="text-red-400" />
            ) : (
              <Menu size={20} className="text-red-400" />
            )}
          </button>
          <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
            {isAdminMode ? "Admin: Schedule Management" : "Employee Schedule"}
          </h1>
        </div>

        {/* View Selector */}
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

        {/* User Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdminMode(!isAdminMode)}
            className={`px-3 py-1 text-xs rounded-md ${isAdminMode ? "bg-green-800 text-white" : "bg-gray-800 text-gray-300"} hidden sm:block`}
            aria-label={isAdminMode ? "Switch to employee mode" : "Switch to admin mode"}
          >
            {isAdminMode ? "Admin Mode" : "Employee Mode"}
          </button>
          <button 
            className="relative p-1.5 rounded-full hover:bg-red-900/30"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-red-400" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-red-600 rounded-full"></span>
          </button>
          <button 
            className="p-1.5 rounded-full hover:bg-red-900/30"
            aria-label="Settings"
          >
            <Settings size={18} className="text-red-400" />
          </button>
          <div className="h-8 w-8 bg-red-800 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">CU</span>
          </div>
        </div>
      </div>
    </header>
  );
};