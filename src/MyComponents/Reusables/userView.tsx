import { ActiveUser } from "@/stores/query";
import React from "react";

export const enum Role {
  Intern = "Intern",
  Member = "Member",
  Marketing = "Marketing Specialist",
  Admin = "Admin",
  ProjectManager = "Project Manager",
  COO = "COO",
  CEO = "CEO"
}

type Roles = "Intern" | "Member" | "Marketing Specialist" | "Admin" | "Project Manager" | "COO" | "CEO"

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
