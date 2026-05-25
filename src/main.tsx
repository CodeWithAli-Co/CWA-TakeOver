import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import "./assets/main.css";

// ── Buffer polyfill ────────────────────────────────────────────
// @react-pdf/renderer uses Node's Buffer internally for PDF
// generation. The Tauri webview is browser-like and doesn't ship
// Buffer by default, so we polyfill it once at boot.
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}

// ── Diagnostic capture ─────────────────────────────────────────
// Wraps console + fetch + XHR so the in-app bug reporter can
// attach the last ~50 console lines and ~20 network requests when
// the user files a report. Idempotent and never throws — safe to
// install at the very top of boot.
import { installDiagnostics } from "./diagnostics/captureBuffer";
installDiagnostics();

// ── Theme mode ─────────────────────────────────────────────────
// Importing the store runs its top-level `applyTheme()` call, so
// the persisted light/dark choice lands on <html> before React
// mounts — avoids the brief flash of the wrong theme on reload.
import "./stores/themeModeStore";

// Need this in order for app to see routes during production mode
// Read more: https://tanstack.com/router/latest/docs/framework/react/guide/history-types
const memoryHistory = createMemoryHistory({
  initialEntries: ['/']
})

// Create a new router instance. Exported so non-React callers (e.g. the
// OS-notification onAction handler in __root.tsx) can navigate to /chat
// when a user clicks a message notification.
export const router = createRouter({ routeTree, history: memoryHistory });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const queryclient = new QueryClient();

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryclient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
