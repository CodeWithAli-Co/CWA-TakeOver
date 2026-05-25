/**
 * /code — GitHub-lookalike repo dashboard for AI-generated code.
 * Open to all authenticated users for now; per-role scoping will
 * tighten once we wire real Supabase data + permissions.
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { CodePage } from "@/MyComponents/Code/CodePage";

export const Route = createLazyFileRoute("/code")({
  component: CodePage,
});

export default CodePage;
