
import { WeeklyQuotas } from '@/MyComponents/WeeklyQuota'
import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/quota')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <>
      <WeeklyQuotas />
    </>
  )
}