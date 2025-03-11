import { createLazyFileRoute } from '@tanstack/react-router'
import ModLogsPage from "@/MyComponents/Sidebar/logs";




function logs() {
  return <div>
    <ModLogsPage />
    </div>
}


export const Route = createLazyFileRoute('/mod_logs')({
  component: logs,
})
