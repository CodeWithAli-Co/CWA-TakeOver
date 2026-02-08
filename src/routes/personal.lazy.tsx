import PersonalLifeManager from "@/MyComponents/personalLifeManager";
import { createLazyFileRoute } from "@tanstack/react-router";

export const Route = createLazyFileRoute("/personal")({
  component: PersonalLifeManager
});