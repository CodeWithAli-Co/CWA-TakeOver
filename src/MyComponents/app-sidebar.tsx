// app-sidebar.tsx
import { useState } from "react";
import { Home, Mail, UserCog, Bot, Settings, Info, ShieldCheck, Users, ChevronDown } from "lucide-react";
import { Link } from "@tanstack/react-router";

const adminItems = [
  { title: "Email Broadcast", url: "/broadcast", icon: <Mail size={20} /> },
  { title: "Account Management", url: "/details", icon: <UserCog size={20} /> },
  { title: "Bot Management", url: "/bot", icon: <Bot size={20} /> },
];

const bottomItems = [
  { title: "Settings", url: "/settings", icon: <Settings size={20} /> },
  { title: "About", url: "/about", icon: <Info size={20} /> },
  { title: "Security", url: "/security", icon: <ShieldCheck size={20} /> },
  { title: "Users", url: "/employee", icon: <Users size={20} /> },
];

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  return (
    <div
      className={`sidebar ${isExpanded ? "expanded" : ""}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Top section */}
      <div className="sidebar-top">
        <Link to="/" className="sidebar-item">
          <span className="sidebar-icon"><Home size={20} /></span>
          <span className="sidebar-text">Home</span>
        </Link>

        <div className="admin-section">
          <button 
            className="sidebar-item"
            onClick={() => setIsAdminOpen(!isAdminOpen)}
          >
            <span className="sidebar-icon">
              <ChevronDown 
                size={20}
                className={`transition-transform ${isAdminOpen ? "rotate-180" : ""}`}
              />
            </span>
            <span className="sidebar-text">Admin Perm</span>
          </button>

          {isAdminOpen && adminItems.map((item) => (
            <Link key={item.title} to={item.url} className="sidebar-item">
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-text">{item.title}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <div className="bottom-nav">
          {bottomItems.map((item) => (
            <Link key={item.title} to={item.url} className="sidebar-item">
              <span className="sidebar-icon">{item.icon}</span>
              <span className="sidebar-text">{item.title}</span>
          </Link>
          ))}
        </div>
        
        <div className="profile-button">
          <span className="sidebar-icon">
            <img 
              src="/codewithali_logo.png"
              alt="Profile" 
              className="profile-avatar"
            />
          </span>
          <div className="sidebar-text profile-info">
            <span className="profile-name">Ali</span>
            <span className="profile-tag">admin</span>
          </div>
        </div>
      </div>
    </div>
  );
}