import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/client/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello Client Sorry About the Mess <br /> But we are under MAJOR Construction !</div>
  
}
