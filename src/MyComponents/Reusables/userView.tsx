import { ActiveUser } from "@/stores/query";
import React from "react";

export const enum Role {
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

// const enum RoleRanks {
//   Intern = 1,
//   Member,
//   SoftwareDev,
//   Marketing,
//   Admin,
//   ProjectManager,
//   COO,
//   CEO
// }

// we alreaady have role defined as enum, so we just variable it instead of redundant code whe we have to add changes to both sides when addng a new role
type Roles = keyof typeof Role | Role;

type UserViewProps = {
  userRole?: Roles | Roles[]; // we make this an option for an inclusion list
  excludeRoles?: Roles | Roles [];  //so that we now have an exclusion list
  children: React.ReactNode;
};

const UserView = ({ userRole, excludeRoles = [], children }: UserViewProps) => {
  const { data: user } = ActiveUser();
  const defaultRole: any = "Member";
  // This is to fix error when fetching user data for the first time, it needs a placeholder for this component to not give error
  const role: any = user?.[0]?.role || defaultRole;
  
 // Exclusion logic
  if (excludeRoles.includes(role)) {
    return null;
  }

  // Since we created an exclusion now we have to specify the inclusion logic more detailed
  if ( userRole) 
  {
    const allowedRoles = Array.isArray(userRole) ? userRole : [userRole];
    if(!allowedRoles.includes(role)) {
      return null;
    }
  }
  return <>{children}</>

  // The old Broad inclusion list
  // This doesn't work anymore becaause the excludeRoles prop isn't even being read or used.
  // if (Array.isArray(userRole) ? userRole.includes(role) : role === userRole) {
  //   return <>{children}</>;
  // }
  // return null;
};

export default UserView;
