import TaskSettings from '@/MyComponents/SettingNavComponents/handlingTasking/tasks'
import { createLazyFileRoute } from '@tanstack/react-router'
import React from 'react'


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
