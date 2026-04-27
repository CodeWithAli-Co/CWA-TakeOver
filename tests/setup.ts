/**
 * tests/setup.ts — Runs before every Vitest test file.
 *
 * Two responsibilities:
 *   1. Stub `import.meta.env` so any module that touches Vite env
 *      vars (e.g. supabase.ts) doesn't crash on undefined.
 *   2. Mock the Supabase client + Tauri plugins so unit tests stay
 *      hermetic — no network, no IPC, no surprise side effects.
 *
 * If a specific test needs to assert a Supabase / Tauri call, it can
 * override these defaults with `vi.mocked(...)` inside the test body.
 */
import { vi } from "vitest";

// ─── Mock Supabase ────────────────────────────────────────────────
// Anything that imports `@/MyComponents/supabase` gets this stub.
// Returns a chainable object so naive `.from(...).select()` etc. don't
// throw — they just resolve to empty.
const mkChain = () => {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    update: vi.fn(() => chain),
    delete: vi.fn(() => Promise.resolve({ data: null, error: null })),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    eq: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
  };
  return chain;
};

vi.mock("@/MyComponents/supabase", () => ({
  default: {
    from: vi.fn(() => mkChain()),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      unsubscribe: vi.fn(),
      track: vi.fn(() => Promise.resolve()),
      presenceState: vi.fn(() => ({})),
    })),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: "test-user" } }, error: null }),
      ),
    },
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: "test://avatar" } })),
      })),
    },
  },
}));

// ─── Mock Tauri plugins ───────────────────────────────────────────
// Tests run in jsdom, not in a Tauri runtime, so the IPC bridge
// doesn't exist. Every plugin we import is no-op'd here.
vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
  isPermissionGranted: vi.fn(() => Promise.resolve(true)),
  requestPermission: vi.fn(() => Promise.resolve("granted")),
  registerActionTypes: vi.fn(() => Promise.resolve()),
  onAction: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  message: vi.fn(() => Promise.resolve()),
  ask: vi.fn(() => Promise.resolve(true)),
  confirm: vi.fn(() => Promise.resolve(true)),
}));
