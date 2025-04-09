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
    }
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
  },
}));