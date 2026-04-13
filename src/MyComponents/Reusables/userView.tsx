import { ActiveUser } from "@/stores/query";
import { useRolePreview } from "@/stores/store";
import React from "react";

export const enum Role {
  Client =  "Client",
  Intern = "Intern",
  Member = "Member",
  UIDesigner = "UI/UX Designer",
  SoftwareDev = "Software Developer",
  MechEngineer = "Mechanical engineer",
  Recruiter = "Recruiter",
  AiDev = "AI Specialist",
  DBAdmin = "Database Administrator",
  AccManager = "Account Manager",
  DataScientist = "Data Scientist",
  ProjectManager = "Project Manager",
  Marketing = "Marketing Specialist",
  CustomerSupport = "Customer Support",
  Admin = "Admin",
  SecurityEngineer = "Security Engineer",
  Partner = "Partnership Lead",
  COO = "COO",
  CEO = "CEO"
}

type Roles = keyof typeof Role | Role;

type UserViewProps = {
  userRole?: Roles | Roles[];
  excludeRoles?: Roles | Roles [];
  children: React.ReactNode;
};

const UserView = ({ userRole, excludeRoles = [], children }: UserViewProps) => {
  const { data: user } = ActiveUser();
  const { previewRole } = useRolePreview();
  const defaultRole: any = "Member";

  // Use preview role if active, otherwise use actual role
  const role: any = previewRole || user?.[0]?.role || defaultRole;

  // Exclusion logic
  if (excludeRoles.includes(role)) {
    return null;
  }

  // Inclusion logic
  if (userRole) {
    const allowedRoles = Array.isArray(userRole) ? userRole : [userRole];
    if(!allowedRoles.includes(role)) {
      return null;
    }
  }
  return <>{children}</>
};

export default UserView;
