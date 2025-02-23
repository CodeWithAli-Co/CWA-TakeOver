import type * as React from "react"
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  MessageCircle,
  Home
} from "lucide-react"


import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, SidebarTrigger } from "@/components/ui/sidebar"
import { TeamSwitcher } from "./ui/Dashboard/team-switch"
import { NavMain } from "./ui/Dashboard/nav-main"
import { NavProjects } from "./ui/Dashboard/nav-project"
import { NavUser } from "./ui/Dashboard/nav-user"


// This is sample data.
const data = {
  user: {
    name: "CodeWithAli",
    email: "unfold@codewithali.com",
    avatar: "/public/codewithali_logo.png",
  },
  teams: [
    {
      name: "CodeWithAli Co.",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    },
    {
      name: "Interns",
      logo: AudioWaveform,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: Command,
      plan: "Free",
    },
  ],
  navMain: [
    {
      title: "Admin Permissions",
      url: "/details",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Email Broadcast",
          url: "/broadcast",
        },
        {
          title: "Account Management",
          url: "/details",
        },
        {
          title: "Users",
          url: "/employee",
        },
    
      ],
    },
    {
      title: "Bot Management",
      url: "/bot",
      icon: Bot,
    },
    // {
    //   title: "Documentation",
    //   url: "#",
    //   icon: BookOpen,
    //   items: [
    //     {
    //       title: "Introduction",
    //       url: "#",
    //     },
    //     {
    //       title: "Get Started",
    //       url: "#",
    //     },
    //     {
    //       title: "Tutorials",
    //       url: "#",
    //     },
    //     {
    //       title: "Changelog",
    //       url: "#",
    //     },
    //   ],
    // },
    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },
    {
      title: "Settings",
      url: "/settings",
      icon: Settings2,
      items: [
        {
          // // In your sidebar navigation <Link to="/settings">Settings</Link>
          title: "General",
          url: "/settings",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    },
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
    }
  ],
  projects: [
    {
      name: "Design Engineering",
      url: "#",
      icon: Frame,
    },
    {
      name: "Sales & Marketing",
      url: "#",
      icon: PieChart,
    },
    {
      name: "Travel",
      url: "#",
      icon: Map,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavProjects projects={data.projects} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser userData={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
