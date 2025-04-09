import React from "react";
import Welcome from '@/MyComponents/Beginning/welcome'
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
