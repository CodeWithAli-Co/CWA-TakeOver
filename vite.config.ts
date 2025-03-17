import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import path from "path";
import fs from "fs";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST || "127.0.0.1"; // Correct - just hostname

// Webhook storage
const webhooks = [];

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [
    react(), 
    TanStackRouterVite()
  ],
  css: {
    postcss: './postcss.config.ts',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/webhooks/github": {
        target: "https://8da8-2601-646-877f-b250-d803-2002-3004-be19.ngrok-free.app",
        changeOrigin: true
      },
      "/api/webhooks/github": {
        target: "https://8da8-2601-646-877f-b250-d803-2002-3004-be19.ngrok-free.app",
        changeOrigin: true
      }
    }
  },
}));