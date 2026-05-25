/**
 * /reports/submit — Primary writer surface for reports.
 * Available to every authenticated user; the leadership inbox
 * still lives at /reports.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { SubmitReportPage } from "@/MyComponents/Reports/SubmitReportPage";

export const Route = createLazyFileRoute("/reports/submit")({
  component: SubmitReportPage,
});

export default SubmitReportPage;
