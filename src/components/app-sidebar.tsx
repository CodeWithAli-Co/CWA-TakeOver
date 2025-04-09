//  was import type * as React from "react"
import * as React from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/shadcnComponents/sidebar";
import { NavMain } from "./ui/Dashboard/nav-main";
import { NavProjects } from "./ui/Dashboard/nav-project";
import { NavUser } from "./ui/Dashboard/nav-user";
import {
  adminData,
  ceoData,
  cooData,
  internData,
  marketingData,
  memberData,
  projectManagerData,
} from "./ui/Dashboard/role-datas";
import UserView from "@/MyComponents/Reusables/userView";
import { TeamSwitcher } from "./ui/Dashboard/team-switch";
// import { tasks } from "@/MyComponents/SettingNavComponents/taskTypes"
// import SettingsPage from 

// test  commmito
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

    {
      title: "Chat",
      url: "/chat",
      isActive: false,
      icon: MessageCircle,
    },
   
    {
      title: "Task",
      url: "/task",
      isActive: false,
      icon: ClipboardList,
    },
    {
      title: "Home",
      url: "/",
      isActive: false,
      icon: Home,
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
          url: "/settings?tab=teams",
        },
        {
          title: "Tasks",
          url: "/settings?tab=tasks",
        },
        {
          title: "Company",
          url: "/settings?tab=company",
        },
        {
          title: "Notification",
          url: "/settings?tab=notification",
        },
      ],
    },
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
        {/* Admin View */}
        {/* <UserView userRole="Admin">
          <TeamSwitcher teams={adminData.teams} />
        </UserView> */}

        {/* Project Manager View */}
        {/* <UserView userRole="Project Manager">
          <TeamSwitcher teams={projectManagerData.teams} />
        </UserView> */}

        {/* COO View */}
        {/* <UserView userRole="COO">
          <TeamSwitcher teams={cooData.teams} />
        </UserView> */}

        {/* CEO View */}
        {/* <UserView userRole="CEO">
          <TeamSwitcher teams={ceoData.teams} />
        </UserView> */}
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        {/* Intern View */}
        <UserView userRole="Intern">
          <NavMain items={internData.navMain} />
        </UserView>

        {/* Member View */}
        <UserView userRole="Member">
          <NavMain items={memberData.navMain} />
        </UserView>

        {/* Marketing Specialist View */}
        <UserView userRole="Marketing Specialist">
          <NavMain items={marketingData.navMain} />
        </UserView>

        {/* Admin View */}
        <UserView userRole="Admin">
          <NavMain items={adminData.navMain} />
        </UserView>

        {/* Project Manager View */}
        <UserView userRole="Project Manager">
          <NavMain items={projectManagerData.navMain} />
          <NavProjects projects={projectManagerData.projects} />
        </UserView>

        {/* COO View */}
        <UserView userRole="COO">
          <NavMain items={cooData.navMain} />
          <NavProjects projects={cooData.projects} />
        </UserView>

        {/* CEO View */}
        <UserView userRole="CEO">
          <NavMain items={ceoData.navMain} />
          <NavProjects projects={ceoData.projects} />
        </UserView>
      </SidebarContent>
      <SidebarFooter>
        {/* Using InternData here bc it's default role, so everyone has access to it */}
        <NavUser userData={internData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
