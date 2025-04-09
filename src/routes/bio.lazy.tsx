import React from "react";
import BiotechDashboard from '@/MyComponents/Sidebar/bioTech'
import { createLazyFileRoute } from '@tanstack/react-router'


function Biology() {
  return (
    <>
      <BiotechDashboard />
    </>
  )
}

export const Route = createLazyFileRoute("/bio")({
    component: Biology,
  })
  