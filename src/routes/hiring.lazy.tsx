/**
 * /hiring — Candidate inbox & Axon-driven ranking.
 *
 * Reads the public.candidates table that the /apply form on
 * takeover-B2B writes into. Recruiter triages, Axon parses + scores,
 * recruiter moves status / schedules interview / pre-fills offer.
 *
 * Hook-up: see src/MyComponents/Hiring/HiringDashboard.tsx for the
 * actual UI. This route file is intentionally thin so the page is
 * easy to swap or wrap with a role gate later.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { HiringDashboard } from "@/MyComponents/Hiring/HiringDashboard";

function HiringPage() {
  return <HiringDashboard />;
}

export const Route = createLazyFileRoute("/hiring")({
  component: HiringPage,
});
