//  was import type * as React from "react"
import * as React from "react";
// quick check
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
  securityEngineerData,
} from "./ui/Dashboard/role-datas";
import UserView from "@/MyComponents/Reusables/userView";

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

        {/* Project Manager View */}
        <UserView userRole="Project Manager">
          <NavMain items={projectManagerData.navMain} />
          <NavProjects projects={projectManagerData.projects} />
        </UserView>

        {/* Marketing Specialist View */}
        <UserView userRole="Marketing Specialist">
          <NavMain items={marketingData.navMain} />
        </UserView>

        {/* Admin View */}
        <UserView userRole="Admin">
          <NavMain items={adminData.navMain} />
        </UserView>

        {/* Security Engineer View */}
        <UserView userRole={"Security Engineer"}>
          <NavMain items={securityEngineerData.navMain} />
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
