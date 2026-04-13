/**
 * chat.lazy.tsx — Slim wrapper that renders the new ChatLayout.
 *
 * All chat logic lives in MyComponents/Chat/. See README in that folder
 * for the full architecture (state flow, components, schema requirements).
 */

import { createLazyFileRoute } from "@tanstack/react-router";
import { ChatLayout } from "@/MyComponents/Chat/ChatLayout";

function ChatRoute() {
  return <ChatLayout />;
}

export const Route = createLazyFileRoute("/chat")({
  component: ChatRoute,
});

export default ChatRoute;
