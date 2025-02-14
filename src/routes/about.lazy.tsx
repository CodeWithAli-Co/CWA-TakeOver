import Welcome from '@/MyComponents/welcome'
import { createLazyFileRoute } from '@tanstack/react-router'


function About() {
  return (
    <>
      <Welcome />
    </>
  )
}

export const Route = createLazyFileRoute('/about')({
  component: About,
})
