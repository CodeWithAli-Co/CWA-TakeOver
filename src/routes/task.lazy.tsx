import TaskSettings from '@/MyComponents/SettingNavComponents/handlingTasking/tasks'
import Welcome from '@/MyComponents/welcome'
import { createLazyFileRoute } from '@tanstack/react-router'


function About() {
  return (
    <>
      <TaskSettings />
    </>
  )
}

export const Route = createLazyFileRoute('/task')({
  component: About,
})
