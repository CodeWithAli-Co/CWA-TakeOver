import { ActiveUser } from "@/stores/query"
import React from "react"


type UserViewProps = {
  userRole: string,
  children: React.ReactNode
}

const UserView = ({ userRole, children }: UserViewProps) => {
  const { data: user } = ActiveUser();
  const defaultRole: any = 'intern'
  // This is to fix error when fetching user data for the first time, it needs a placeholder for this component to not give error
  const role: any = user[0]?.role || defaultRole
  if (role === userRole) {
    return <>{children}</>;
  }
  return null;
}

export default UserView