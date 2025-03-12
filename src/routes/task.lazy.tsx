import TaskSettings from '@/MyComponents/Sidebar/handlingTasking/tasks'
import { createLazyFileRoute } from '@tanstack/react-router'


function tasking() {
  return (
    <>
      <TaskSettings />
    </>
  )
}

export const Route = createLazyFileRoute('/task')({
  component: tasking,
})
