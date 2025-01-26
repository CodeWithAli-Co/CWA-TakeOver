import { createLazyFileRoute } from "@tanstack/react-router";

function Bot() {
  return (
    <>
      <h3>Bot Page</h3>
    </>
  );
}

export const Route = createLazyFileRoute("/bot")({
  component: Bot,
});
