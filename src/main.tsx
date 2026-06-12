import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import "./assets/main.css";
// theme.css adds the new dashboard token layer (surface / fg-muted /
// line / accent / success-bg etc.) AFTER main.css so its tokens win
// where they overlap. See src/styles/theme.css for the full map.
import "./styles/theme.css";

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

// App-wide React Query defaults. Without these, staleTime is 0, so
// EVERY query refetches on each mount/navigation — which is why the
// dashboard re-shows all its skeletons every time you land on it.
//   · staleTime 60s   — data is treated fresh for a minute; remounting
//                       a screen you just visited serves from cache.
//   · gcTime 30m      — keep cached results around so back-nav is instant.
//   · refetchOnWindowFocus false — desktop app; don't refetch on alt-tab.
// Mutations still invalidate their queries explicitly, so writes show
// up immediately regardless of staleTime.
const queryclient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Keep the ActiveUser cache honest across Supabase auth events
// (INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED / SIGNED_OUT).
// Without this, the suspense query can cache an empty result during
// a boot race and the sidebar shows "Unknown / Member" until the
// user manually signs out and back in. See stores/query.ts.
import { subscribeActiveUserAuth } from "@/stores/query";
subscribeActiveUserAuth(queryclient);

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
