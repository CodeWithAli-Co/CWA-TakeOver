import { createLazyFileRoute } from "@tanstack/react-router";

function Employee() {
  return (
    <>
      <h3>Employee Page</h3>
    </>
  );
}

export const Route = createLazyFileRoute("/employee")({
  component: Employee,
});
