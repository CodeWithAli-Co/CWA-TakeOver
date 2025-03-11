import { createLazyFileRoute } from '@tanstack/react-router'

const Budgetary = () => {
  return (
    <>
      <h3 style={{ userSelect: 'none' }}><i>Coming Soon...</i></h3>
    </>
  )
}

export const Route = createLazyFileRoute('/budgetary')({
  component: Budgetary
})