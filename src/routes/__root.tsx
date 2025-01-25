import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => {
    return (
      <>
        <div>
          <Link to="/"></Link>{" "}
        </div>
        <hr />
        <Outlet />
      </>
    );
  },
});
