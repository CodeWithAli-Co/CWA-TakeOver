import EmployeeSchedule from '@/MyComponents/Sidebar/EmployeeSchedule'
import { createLazyFileRoute } from '@tanstack/react-router'
import React from 'react'


function About() {
  return (
    <>
      <EmployeeSchedule />
    </>
  )
}

export const Route = createLazyFileRoute('/schedule')({
  component: About,
})
