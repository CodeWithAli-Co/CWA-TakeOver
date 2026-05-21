/**
 * axonSwarm.lazy.tsx — Route for the Axon Swarm control room.
 *
 * Visit `/axonSwarm` (or however you choose to wire it into the
 * sidebar) to open the admin page that visualizes all eight Axons,
 * their live state, the inter-agent message bus, and each agent's
 * capabilities and OS hooks.
 *
 * The page is intentionally heavy on motion. If you find it visually
 * loud during real work, lower `framer-motion`'s `reducedMotion`
 * preference at the user level — the orbs respect it.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { AxonSwarmPage } from "@/Axon/swarm/AxonSwarmPage";

// TanStack Router auto-generates `src/routeTree.gen.ts` from the
// files in this directory. Until you run `bun dev` (which triggers
// the route-tree generator) the path literal isn't yet in the
// generated FileRoutesByPath union. The plugin regenerates on every
// save once the dev server is running.
// @ts-expect-error — routeTree.gen.ts regenerates on next `bun dev` / `bun build`
export const Route = createLazyFileRoute("/axonSwarm")({
  component: AxonSwarmPage,
});
