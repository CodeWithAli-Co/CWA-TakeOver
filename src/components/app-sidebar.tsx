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
  cfoData,
  cooData,
  internData,
  marketingData,
  memberData,
  projectManagerData,
  securityEngineerData,
  filterNavByCompany,
  filterProjectsByCompany,
  accountManagerData,
} from "./ui/Dashboard/role-datas";
import UserView, { Role } from "@/MyComponents/Reusables/userView";
import { RolePreviewSelector } from "./ui/Dashboard/role-preview";
import { CompanyToggle } from "@/MyComponents/CompanyToggle/CompanyToggle";
import { useCompanyFilter } from "@/stores/store";

function SidebarBrand() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { activeCompany } = useCompanyFilter();
  const isSimplicity = activeCompany === "simplicityFunds";

  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <img
        src={isSimplicity ? "/simplicity_logo.png" : "/codewithali_logo.png"}
        alt={isSimplicity ? "Simplicity" : "CWA"}
        className="h-7 w-7 rounded-sm object-contain shrink-0"
        onError={(e) => {
          (e.target as HTMLImageElement).src = "/codewithali_logo.png";
        }}
      />
      {!isCollapsed && (
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] font-semibold text-foreground/85 tracking-tight truncate transition-colors duration-300">
            {isSimplicity ? "Simplicity" : "CWA TakeOver"}
          </span>
          <span className="text-[10px] text-muted-foreground leading-none">
            {/* {isSimplicity ? "Funds Admin" : "v1.4.0"} */}
            {/* *This is the version of TakeOver app */}
            v1.4.0
          </span>
        </div>
      )}
    </div>
  );
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { activeCompany } = useCompanyFilter();

  return (
    <UserView excludeRoles={Role.Client}>
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <SidebarBrand />
            <SidebarTrigger className="text-muted-foreground/60 hover:text-muted-foreground/80 hover:bg-muted/50 rounded-sm h-6 w-6" />
          </div>

          {/* Company Toggle — switches entire dashboard theme */}
          <UserView userRole={[Role.CEO, Role.COO, Role.AccManager]}>
            <CompanyToggle />
          </UserView>

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

          {/* Account Manager View */}
          <UserView userRole={Role.AccManager}>
            <NavMain items={filterNavByCompany(accountManagerData.navMain as any, activeCompany)} />
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

          {/* COO View — company-filtered */}
          <UserView userRole={Role.COO}>
            <NavMain items={filterNavByCompany(cooData.navMain as any, activeCompany)} />
            <NavProjects projects={filterProjectsByCompany(cooData.projects as any, activeCompany)} />
          </UserView>

          {/* CEO View — company-filtered */}
          <UserView userRole={Role.CEO}>
            <NavMain items={filterNavByCompany(ceoData.navMain as any, activeCompany)} />
            <NavProjects projects={filterProjectsByCompany(ceoData.projects as any, activeCompany)} />
          </UserView>

          {/* CFO View — company-filtered */}
          <UserView userRole={Role.CFO}>
            <NavMain items={filterNavByCompany(cfoData.navMain as any, activeCompany)} />
            <NavProjects projects={filterProjectsByCompany(cfoData.projects as any, activeCompany)} />
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
