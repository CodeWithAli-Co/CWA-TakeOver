import { ActiveUser } from "@/stores/query"
import React from "react"


type UserViewProps = {
  userRole: string,
  children: React.ReactNode
}

const UserView = ({ userRole, children }: UserViewProps) => {
  const { data: user } = ActiveUser();
  if (user[0].role === userRole) {
    return <>{children}</>;
  }
  return null;
}

export default UserView