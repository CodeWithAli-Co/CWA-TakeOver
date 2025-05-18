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

type Roles = "Intern" | "Member" | "UI/UX Designer" | "Software Developer" | "Mechanical engineer" | "Recruiter" | "AI Specialist" | "Database Administrator" | "Account Manager" | "Data Scientist" | "Project Manager" | "Marketing Specialist" | "Customer Support" | "Admin" | "Security Engineer" | "Partnership Lead" | "COO" | "CEO"

type UserViewProps = {
  userRole: Roles | Roles[];
  children: React.ReactNode;
};

const UserView = ({ userRole, children }: UserViewProps) => {
  const { data: user } = ActiveUser();
  const defaultRole: any = "Member";
  // This is to fix error when fetching user data for the first time, it needs a placeholder for this component to not give error
  const role: any = user[0]?.role || defaultRole;
  if (Array.isArray(userRole) ? userRole.includes(role) : role === userRole) {
    return <>{children}</>;
  }
  return null;
};

export default UserView;
