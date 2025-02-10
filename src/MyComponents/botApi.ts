import { Hono } from "hono";
import { logger } from "hono/logger";

const api = new Hono();

// Middleware log (usefull for debug)
api.use('*', logger())

// Backend base URL
const BASE_URL = "https://koi-climbing-squid.ngrok-free.app";

// Status endpoint
api.get("/status", async (c) => {
  const token = c.req.header("Authorization")!;
  const res = await fetch(`${BASE_URL}/status`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  return c.json(await res.json());
});

// Send message endpoint
api.post("/send-message", async (c) => {
  const body = await c.req.json();
  const token = c.req.header("Authorization");
  const res = await fetch(`/send-message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  console.log('API send-msg Body:', body)
  return c.json(await res.json());
});

api.post("/shutdown", async (c) => {
  const body = await c.req.json();
  const token = c.req.header("Authorization");
  const res = await fetch('/shutdown', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return c.json(await res.json());
});

// Token generation endpoint
api.post("/token", async () => {
  const res = await fetch(`${BASE_URL}/token`, { method: "POST" });
  return new Response(JSON.stringify(await res.json()), { status: 200 });
});

export default api;
