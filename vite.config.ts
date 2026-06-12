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
    TanStackRouterVite(),
    {
      name: 'webhook-handler',
      configureServer(server) {
        // Parse JSON and URL-encoded bodies
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST' && req.url.startsWith('/webhooks/github')) {
            let body = '';
            req.on('data', chunk => {
              body += chunk.toString();
            });
            req.on('end', () => {
              try {
                if (req.headers['content-type']?.includes('application/json')) {
                  req.body = JSON.parse(body);
                } else {
                  // Simple URL-encoded parser
                  const params = new URLSearchParams(body);
                  req.body = Object.fromEntries(params.entries());
                }
              } catch (e) {
                console.error('Error parsing webhook body:', e);
                req.body = {};
              }
              next();
            });
          } else {
            next();
          }
        });

        // GitHub webhook handler
        server.middlewares.use('/webhooks/github', (req, res) => {
          if (req.method !== 'POST') {
            return res.end('Method not allowed');
          }

          const event = req.headers['x-github-event'];
          console.log(`Received GitHub ${event} event`);
          
          // Handle ping event
          if (event === 'ping') {
            console.log('Ping event received - webhook configured correctly');
            return res.end('Pong!');
          }
          
          // Handle push event
          if (event === 'push') {
            try {
              const payload = req.body;
              
              const webhookEvent = {
                id: `github_${Date.now()}`,
                event_type: 'push',
                repo: payload.repository?.full_name || 'unknown',
                branch: payload.ref ? payload.ref.split('/').pop() : 'unknown',
                author: payload.pusher?.name || 'unknown',
                author_avatar: payload.sender?.avatar_url || '',
                timestamp: new Date().toISOString(),
                commits: (payload.commits || []).map(commit => ({
                  id: commit.id || 'unknown',
                  message: commit.message || '',
                  author: commit.author?.name || 'unknown',
                  timestamp: commit.timestamp || new Date().toISOString(),
                })),
              };
              
              webhooks.push(webhookEvent);
              
              // Save webhooks to file
              const dataDir = path.resolve(__dirname, 'data');
              if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
              }
              fs.writeFileSync(
                path.join(dataDir, 'github-webhooks.json'),
                JSON.stringify(webhooks.slice(-100))
              );
              
              console.log(`Processed webhook for ${webhookEvent.repo}`);
            } catch (err) {
              console.error('Error processing webhook:', err);
            }
          }
          
          // Always return 200 OK to GitHub
          res.statusCode = 200;
          res.end('OK');
        });
        
        // API endpoint to get stored webhooks
        server.middlewares.use('/api/webhooks/github', (req, res) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(webhooks));
        });
      }
    },
    {
      // Re-run the Observatory repo scan whenever the app/dev-server starts, so
      // src/admin/observatory/data/scan.json is always fresh when you open the
      // app. (history:false keeps dev restarts out of the posture trend.)
      // Later, the backend server takes over this job and the UI fetches live.
      name: 'observatory-audit',
      async buildStart() {
        try {
          const { runAudit } = await import('./scripts/observatory-audit.mjs');
          await runAudit({ write: true, history: false });
          console.log('[observatory] repo scan refreshed');
        } catch (e) {
          console.warn('[observatory] audit skipped:', (e && e.message) || e);
        }
      },
      configureServer(server) {
        const CWA_ROOT = __dirname;
        const B2B_ROOT = path.resolve(__dirname, '..', 'takeover-B2B');
        const rootFor = (repo) => (repo === 'b2b' ? B2B_ROOT : CWA_ROOT);

        // On-demand re-scan: the Observatory hits this after you edit code to
        // see whether the change made things safer. Writes scan.json (no
        // history), Vite HMR then reloads the updated data into the UI.
        server.middlewares.use('/__obs/rescan', async (_req, res) => {
          try {
            const { runAudit } = await import('./scripts/observatory-audit.mjs');
            const { scan } = await runAudit({ write: true, history: false });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, generatedAt: scan.generatedAt, summary: scan.summary }));
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e) }));
          }
        });

        // Read a repo-relative source file (server-side fs = correct paths,
        // no Tauri scope needed). Path traversal is rejected.
        server.middlewares.use('/__obs/file', (req, res) => {
          try {
            const u = new URL(req.url || '/', 'http://x');
            const root = rootFor(u.searchParams.get('repo'));
            const abs = path.resolve(root, u.searchParams.get('path') || '');
            if (!abs.startsWith(root)) { res.statusCode = 403; return res.end('forbidden'); }
            if (!fs.existsSync(abs)) { res.statusCode = 404; return res.end('not found'); }
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('X-Obs-File', '1');
            res.end(fs.readFileSync(abs, 'utf8'));
          } catch (e) { res.statusCode = 500; res.end(String((e && e.message) || e)); }
        });

        // Open a file in the editor (VS Code if available, else OS default).
        server.middlewares.use('/__obs/open', async (req, res) => {
          try {
            const u = new URL(req.url || '/', 'http://x');
            const root = rootFor(u.searchParams.get('repo'));
            const abs = path.resolve(root, u.searchParams.get('path') || '');
            if (!abs.startsWith(root)) { res.statusCode = 403; return res.end('forbidden'); }
            const line = u.searchParams.get('line') || '1';
            const cp = await import('node:child_process');
            const tryOpen = (cmd, args) => new Promise((ok) => {
              const c = cp.spawn(cmd, args, { stdio: 'ignore', detached: true, shell: process.platform === 'win32' });
              c.on('error', () => ok(false)); c.on('spawn', () => { c.unref(); ok(true); });
            });
            let opened = await tryOpen('code', ['-g', `${abs}:${line}`]);
            if (!opened) {
              const o = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', abs]]
                : process.platform === 'darwin' ? ['open', [abs]] : ['xdg-open', [abs]];
              opened = await tryOpen(o[0], o[1]);
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: opened }));
          } catch (e) { res.statusCode = 500; res.end(String((e && e.message) || e)); }
        });
      },
    }
  ],
  css: {
    postcss: './postcss.config.ts',
  },
  // Pre-bundle the heavy / many-module deps with esbuild so the dev
  // server ships each as ONE request instead of hundreds of live module
  // requests. lucide-react is the worst offender (a separate module per
  // icon); recharts / framer-motion / react-syntax-highlighter behave
  // the same. This is the fix for `tauri dev` cold-loading hundreds of
  // .js requests. Production builds already bundle, so this is dev-only.
  optimizeDeps: {
    include: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "@supabase/supabase-js",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "@tanstack/react-form",
      "react-hook-form",
      "@hookform/resolvers",
      "zod",
      "date-fns",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "cmdk",
      "zustand",
      "react-day-picker",
      "react-select",
      "react-virtuoso",
    ],
  },
  build: {
    target: "es2024",
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
    // Pre-transform the boot-critical modules on server start so first
    // paint isn't blocked waiting on them to be transformed on demand.
    warmup: {
      clientFiles: [
        "./src/main.tsx",
        "./src/routes/__root.tsx",
        "./src/routes/index.lazy.tsx",
        "./src/MyComponents/supabase.ts",
        "./src/stores/query.ts",
      ],
    },
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
  },
}));