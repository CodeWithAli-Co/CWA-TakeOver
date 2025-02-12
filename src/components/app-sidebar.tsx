// app-sidebar.tsx
import { useState } from "react";
import { Home, Mail, UserCog, Bot, Settings, Info, ShieldCheck, Users } from "lucide-react";

const items = [
  { title: "Home", url: "/", icon: <Home size={24} /> },
  { title: "Email Broadcast", url: "/broadcast", icon: <Mail size={24} /> },
  { title: "Account Management", url: "/account", icon: <UserCog size={24} /> },
  { title: "Bot Management", url: "/bot", icon: <Bot size={24} /> },
  { title: "Settings", url: "/settings", icon: <Settings size={24} /> },
  { title: "About", url: "/about", icon: <Info size={24} /> },
  { title: "Security", url: "/security", icon: <ShieldCheck size={24} /> },
  { title: "Users", url: "/users", icon: <Users size={24} /> },
];

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`sidebar ${isExpanded ? "expanded" : ""}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {items.map((item) => (
        <a key={item.title} href={item.url} className="sidebar-item">
          <span className="sidebar-icon">{item.icon}</span>
          <span className="sidebar-text">{item.title}</span>
        </a>
      ))}
    </div>
  );
}