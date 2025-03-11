import { createLazyFileRoute } from '@tanstack/react-router'
import React from 'react'

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