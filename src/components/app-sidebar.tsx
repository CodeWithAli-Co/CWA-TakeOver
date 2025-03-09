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
// import { tasks } from "@/MyComponents/SettingNavComponents/taskTypes"
// import SettingsPage from

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent>
        {/* Intern View */}
        <UserView userRole="intern">
          <NavMain items={internData.navMain} />
        </UserView>

        {/* Member View */}
        <UserView userRole="member">
          <NavMain items={memberData.navMain} />
        </UserView>

        {/* Marketing Specialist View */}
        <UserView userRole="marketing specialist">
          <NavMain items={marketingData.navMain} />
        </UserView>

        {/* Admin View */}
        <UserView userRole="admin">
          <NavMain items={adminData.navMain} />
        </UserView>

        {/* Project Manager View */}
        <UserView userRole="project manager">
          <NavMain items={projectManagerData.navMain} />
        </UserView>

        {/* COO View */}
        <UserView userRole="coo">
          <NavMain items={cooData.navMain} />
        </UserView>

        {/* CEO View */}
        <UserView userRole="ceo">
          <NavMain items={ceoData.navMain} />
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
