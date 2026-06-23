import { createLazyFileRoute } from "@tanstack/react-router";
import { TodayFrame } from "@/MyComponents/Today/TodayFrame";

export const Route = createLazyFileRoute("/today")({
  component: TodayFrame,
});

export default TodayFrame;
