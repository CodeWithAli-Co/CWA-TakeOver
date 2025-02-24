import TaskSettings from '@/MyComponents/SettingNavComponents/handlingTasking/tasks'
import Welcome from '@/MyComponents/welcome'
import { createLazyFileRoute } from '@tanstack/react-router'
// In your parent component or route
import { Suspense } from 'react';


function About() {
  return (
   <div>
    {/* i think blaze already has one but if not this is for leaading */}
    <Suspense fallback={<div>Loading...</div>}>
      <TaskSettings />
    </Suspense>
   </div>
  )
}


export const Route = createLazyFileRoute('/task')({
  component: About,
})
