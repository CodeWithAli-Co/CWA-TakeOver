
import { WeeklyQuotas } from '@/components/WeeklyQuota'
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