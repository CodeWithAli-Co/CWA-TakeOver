import * as React from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
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
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { RolePreviewSelector } from "./ui/Dashboard/role-preview";

function SidebarBrand() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <img
        src="/codewithali_logo.png"
        alt="CWA"
        className="h-7 w-7 rounded-sm object-contain shrink-0"
      />
      {!isCollapsed && (
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-white/85 tracking-tight truncate">
            CWA Manager
          </span>
          <span className="text-[10px] text-white/20 leading-none">
            v1.2.1
          </span>
        </div>
      )}
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <UserView excludeRoles={Role.Client}>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <SidebarBrand />
            <SidebarTrigger className="text-white/20 hover:text-white/50 hover:bg-white/[0.04] rounded-sm h-6 w-6" />
          </div>

          {/* Role Preview — checks real role internally, never affected by preview */}
          <RolePreviewSelector />
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
          <UserView userRole={Role.ProjectManager}>
            <NavMain items={projectManagerData.navMain} />
            <NavProjects projects={projectManagerData.projects} />
          </UserView>

          {/* Marketing Specialist View */}
          <UserView userRole={Role.Marketing}>
            <NavMain items={marketingData.navMain} />
          </UserView>

          {/* Admin View */}
          <UserView userRole={Role.Admin}>
            <NavMain items={adminData.navMain} />
          </UserView>

          {/* Security Engineer View */}
          <UserView userRole={Role.SecurityEngineer}>
            <NavMain items={securityEngineerData.navMain} />
          </UserView>

          {/* COO View */}
          <UserView userRole={Role.COO}>
            <NavMain items={cooData.navMain} />
            <NavProjects projects={cooData.projects} />
          </UserView>

          {/* CEO View */}
          <UserView userRole={Role.CEO}>
            <NavMain items={ceoData.navMain} />
            <NavProjects projects={ceoData.projects} />
          </UserView>
        </SidebarContent>

        <SidebarFooter>
          <NavUser userData={internData.user} />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
    </UserView>
  );
}
