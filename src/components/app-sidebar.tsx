import { useState } from "react";
import { Home, Mail, UserCog, Bot, Settings, Info, ShieldCheck, Users } from "lucide-react"; // Lucide Icons
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import "../assets/sidebar.css"; // Make sure this file exists

const items = [
  { title: "Home", url: "#", icon: <Home /> },
  { title: "Email Broadcast", url: "#", icon: <Mail /> },
  { title: "Account Management", url: "#", icon: <UserCog /> },
  { title: "Bot Management", url: "#", icon: <Bot /> },
  { title: "Settings", url: "#", icon: <Settings /> },
  { title: "About", url: "#", icon: <Info /> },
  { title: "Security", url: "#", icon: <ShieldCheck /> },
  { title: "Users", url: "#", icon: <Users /> },
];

export function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`sidebar ${isExpanded ? "expanded" : ""}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <Sidebar>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <a href={item.url} className="sidebar-item">
                        <span className="sidebar-icon">{item.icon}</span>
                        <span className={`sidebar-text ${isExpanded ? "visible" : ""}`}>
                          {item.title}
                        </span>
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </div>
  );
}
