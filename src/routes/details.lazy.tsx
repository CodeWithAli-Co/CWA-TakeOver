import { createLazyFileRoute } from "@tanstack/react-router";

function Details() {
  return (
    <>
      <h3>Details Page</h3>
    </>
  );
}

export const Route = createLazyFileRoute("/details")({
  component: Details,
});
