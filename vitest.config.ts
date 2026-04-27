/**
 * vitest.config.ts — Standalone test config.
 *
 * Kept separate from vite.config.ts because the dev-server config
 * runs the webhook plugin and pulls in `import.meta.env.VITE_*`
 * variables that don't belong in tests. This file only sets:
 *   · the `@` path alias (matches vite.config.ts)
 *   · jsdom env (so zustand-persist + window-touching helpers work)
 *   · a global setup file that mocks Supabase + Tauri plugins so
 *     unit tests never reach the network or the Rust runtime.
 */
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    // Node env, not jsdom — every current test is a pure-function
    // assertion that doesn't need a window / document / localStorage.
    // jsdom v29 also has an ESM/CJS interop bug with html-encoding-
    // sniffer that breaks Vitest worker startup on Windows. If a
    // future test genuinely needs the DOM, opt-in per-file with
    // `// @vitest-environment jsdom` at the top.
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Tauri build output + node_modules excluded by default; the
    // Rust target dir would otherwise be walked by Vitest's file
    // discovery and slow startup considerably.
    exclude: ["node_modules", "src-tauri/target", "dist"],
  },
});
