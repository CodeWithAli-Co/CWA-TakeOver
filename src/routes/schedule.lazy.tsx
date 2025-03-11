import EmployeeSchedule from '@/MyComponents/Sidebar/EmployeeSchedule'
import { createLazyFileRoute } from '@tanstack/react-router'


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
