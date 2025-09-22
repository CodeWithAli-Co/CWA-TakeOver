import ColdEmailGenerator from '@/MyComponents/HomeDashboard/coldEmailGenerator'
import { createLazyFileRoute } from '@tanstack/react-router'


function coldEmail() {
  return <ColdEmailGenerator />
}
export const Route = createLazyFileRoute('/coldEmail')({
  component: coldEmail,
})
