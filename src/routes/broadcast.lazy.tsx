import { createLazyFileRoute } from "@tanstack/react-router";

function Broadcast() {
  return (
    <>
      <h3>Broadcast Page</h3>
    </>
  );
}

export const Route = createLazyFileRoute("/broadcast")({
  component: Broadcast,
});
