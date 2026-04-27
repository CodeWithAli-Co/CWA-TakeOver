# Testing

Two test suites:

- **TypeScript** — Vitest, runs against the React/TypeScript source.
- **Rust** — `cargo test`, runs against the Tauri backend.

## Running

```sh
bun run test          # TypeScript suite (one-shot)
bun run test:watch    # TypeScript suite, re-runs on file change
bun run test:rust     # Rust suite (requires the dist/ folder; run `bun run build` once first)
```

CI should run both. `bun run test` plus `bun run test:rust` is the canonical pre-merge gate.

## What's covered (and why these specifically)

The bar for adding a test is **"a regression here causes real damage that won't be obvious from staring at a diff."** Coverage is intentionally narrow on high-stakes pure logic, not broad on UI rendering.

| File | Why it matters |
|---|---|
| [src/lib/chatNotify.test.ts](src/lib/chatNotify.test.ts) | `matchesKeyword`, `isMentioned`, `isHereCall` decide who gets pinged. A subtle word-boundary bug means employees miss messages or get spammed. |
| [src/MyComponents/Chat/reactionMarkers.test.ts](src/MyComponents/Chat/reactionMarkers.test.ts) | `{rx:...}` codec is the only thing keeping reactions working on rows in deployments without the JSONB column. A regression silently loses reaction data. |
| [src/Axon/engine/loyaltyMonitor.test.ts](src/Axon/engine/loyaltyMonitor.test.ts) | `detectCeoSlander` / `detectDirectDisrespect` decide whether AXON publicly roasts an employee + DMs the CEO. False positives are HR incidents. The Axon-self-skip tests prevent feedback loops. |
| [src-tauri/src/lib.rs](src-tauri/src/lib.rs) (`#[cfg(test)] mod tests`) | AES-256-GCM `encrypt`/`decrypt` round-trip + nonce-uniqueness. A regression here doesn't corrupt one feature — it permanently destroys encrypted data with no recovery path. |

## Architecture notes

**Pure-helper extraction.** The notification-matching logic used to live inline in `__root.tsx`, and the reactions codec used to live inside `MessageBubble.tsx` next to JSX. To make them testable, the pure logic was lifted into:

- [src/lib/chatNotify.ts](src/lib/chatNotify.ts)
- [src/MyComponents/Chat/reactionMarkers.ts](src/MyComponents/Chat/reactionMarkers.ts)

The original call sites (`__root.tsx`, `chatStore.ts`, `MessageBubble.tsx`) now delegate to those modules. Behavior is unchanged — the test suite encodes the existing semantics, not new ones.

**Test environment is `node`, not `jsdom`.** Every current test is a pure-function assertion that doesn't need `window`/`document`/`localStorage`. Keeping the env minimal makes the suite ~5× faster to start and dodges a known jsdom v29 ↔ Vitest ESM/CJS interop bug.

If a future test genuinely needs the DOM, opt in per-file with a comment at the top:

```ts
// @vitest-environment jsdom
```

(You'll also need to `bun add -d jsdom` again — it was uninstalled when we switched the global env to `node`.)

**Hermetic boundaries.** [tests/setup.ts](tests/setup.ts) globally mocks the Supabase client and the Tauri plugin imports (`plugin-notification`, `api/core`, `plugin-dialog`) so tests never reach the network or the Rust IPC bridge. If a future test needs to assert that a specific Supabase call happened, override the mock locally with `vi.mocked(...)` — don't disable the global mock.

**Rust tests live alongside the code** in `#[cfg(test)] mod tests` blocks at the bottom of `src-tauri/src/lib.rs`. They compile only for `cargo test`, so the production binary is unaffected.

The Rust suite needs the `dist/` folder to exist because Tauri's `generate_context!` macro validates it. `bun run build` produces it; CI should run the frontend build before the Rust suite.

## Adding a new test

1. **Is the function pure?** If yes, write a test. If no, ask whether the impure parts can be lifted out into a pure helper (almost always yes — that's how `chatNotify.ts` was born).
2. **Co-locate the test file** with the source: `foo.ts` → `foo.test.ts` in the same directory. The Vitest config picks up anything matching `src/**/*.{test,spec}.{ts,tsx}`.
3. **Lead with false positives.** Tests that prove "this DOESN'T fire when it shouldn't" catch more real regressions than "this DOES fire when it should." See `loyaltyMonitor.test.ts` for the pattern.
4. **Keep tests fast.** No DB, no network, no `setTimeout`. If a test takes >50ms it's testing the wrong thing.

## Known gaps

These weren't covered in the initial pass and are good follow-ups:

- **Realtime subscription wiring** — `__root.tsx` builds a Supabase channel with several `.on('postgres_changes', ...)` handlers. The handlers themselves call pure helpers (which ARE tested), but the wiring (filter strings, table names, the `if (sentBy === currentUsername) return` guard) isn't.
- **Company filter coverage on every Supabase query** — there's no test that asserts every query that reads company-scoped data passes `.eq("company", ...)`. A lint rule or a query helper would be more useful here than a unit test.
- **Updater + relaunch flow** — currently uncovered. Hard to test without integration infrastructure.
- **AXON action registry** — large surface, currently uncovered. Would benefit from contract tests on each action's input/output schema.
