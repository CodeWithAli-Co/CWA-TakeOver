# Full-Stack Engineer Training Plan
### From Conceptual Understanding → Production-Level Expertise
**Duration:** 6–12 Months | **Target:** 60+ hrs/week | **Goal:** Match senior-level full-stack + systems fluency

---

## Overview

This plan is structured in **4 Phases** that build on each other. Each phase has weekly targets, hands-on projects, and checkpoints. Conceptual knowledge is assumed — the focus is pure **execution and depth**.

> "You understand the map. Now you walk every road until it becomes muscle memory."

---

## Weekly Hour Breakdown (60 hrs/week)

| Block | Hours | Focus |
|---|---|---|
| Morning deep work (Mon–Fri) | 25 hrs | Core topic of the week (5 hrs/day) |
| Project build time (Mon–Fri) | 15 hrs | Apply what was learned that day (3 hrs/day) |
| Weekend sprint | 10 hrs | Build a complete mini-project or challenge |
| Reading / docs / review | 5 hrs | MDN, official docs, source code reading |
| Code review + debugging practice | 5 hrs | Read others' code, fix broken repos |

---

---

# PHASE 1 — Foundation Hardening
## Months 1–2 | "Make the Concepts Bleed Code"

**Goal:** Turn every concept you understand into something you can build cold, without reference.

---

### Month 1 — TypeScript, React Depth, and the DOM

#### Week 1 — TypeScript Mastery
- [ ] Rewrite 3 JavaScript files you've previously written, fully typed in TypeScript
- [ ] Understand: `generics`, `utility types` (Partial, Required, Pick, Omit, Record), `discriminated unions`, `type guards`, `infer`
- [ ] Build: A fully-typed REST API response handler that validates and narrows types at runtime
- [ ] Challenge: Write a typed event bus system from scratch (pub/sub pattern)
- **Daily drill:** Read 1 TypeScript compiler error, understand it completely, write code that causes it intentionally then fixes it

#### Week 2 — React Internals + Hooks Deep Dive
- [ ] Understand: How React's reconciler works (fiber architecture — conceptually)
- [ ] Master: `useReducer`, `useContext`, `useMemo`, `useCallback`, `useRef`, `useLayoutEffect` — know when NOT to use each
- [ ] Build: A global state manager from scratch (no Zustand/Redux) using only Context + useReducer
- [ ] Build: A virtualized list component (render only visible rows, no library)
- [ ] Challenge: Build a form library from scratch that handles validation, touched state, and submission
- **Forbidden this week:** useState for anything that could be useReducer

#### Week 3 — Component Architecture + Design Patterns
- [ ] Study: Compound components, render props, HOCs — know when each is appropriate
- [ ] Study: Component composition vs. inheritance — why composition wins
- [ ] Build: A fully reusable `<DataTable>` component with sorting, filtering, pagination (zero dependencies)
- [ ] Build: A modal/dialog system with portal rendering and focus trapping
- [ ] Refactor: Take a messy component you've written and redesign it with proper separation of concerns
- **Deliverable:** Document your component architecture decisions with inline comments explaining WHY

#### Week 4 — State Management at Scale
- [ ] Learn Zustand internals — read the source code (it's ~100 lines)
- [ ] Learn when Zustand vs Context vs Server State (React Query/TanStack) is correct
- [ ] Build: A full CRUD app (todo/notes) using Zustand, with persist middleware, devtools, and slices
- [ ] Build: Migrate the same app to TanStack Query — understand what changes and why
- [ ] Study: Optimistic updates, cache invalidation strategies, stale-while-revalidate
- **Challenge:** Implement optimistic UI for a delete operation that rolls back on failure

---

### Month 2 — Backend Fundamentals + Node/Server Mastery

#### Week 5 — Node.js Runtime and Event Loop
- [ ] Understand deeply: Event loop phases (timers, I/O, poll, check, close), microtask queue vs macrotask queue
- [ ] Understand: `libuv`, non-blocking I/O, why Node is single-threaded but handles concurrency
- [ ] Build: An HTTP server from raw `node:http` — no Express, no framework
- [ ] Build: A simple middleware pipeline implementation (how Express works under the hood)
- [ ] Challenge: Write a rate limiter middleware from scratch using a sliding window algorithm
- **Daily drill:** Read one Node.js core module source file (stream, events, http, etc.)

#### Week 6 — Express / Hono / Server Frameworks
- [ ] Build a REST API from scratch: auth, CRUD, validation, error handling, logging
- [ ] Learn: Request lifecycle, middleware ordering, error middleware signature `(err, req, res, next)`
- [ ] Implement: JWT authentication with refresh tokens (access: 15min, refresh: 7 days)
- [ ] Implement: Role-based access control (RBAC) — user, admin, superadmin roles
- [ ] Build: A file upload endpoint with validation, size limits, and storage abstraction
- [ ] Challenge: Build the same API in Hono for a Cloudflare Workers target — understand the runtime differences
- **Deliverable:** A production-ready API template you can clone for any future project

#### Week 7 — Databases: SQL Mastery
- [ ] Master: JOINs (inner, left, right, full, cross, self), subqueries, CTEs, window functions
- [ ] Master: Indexes — when to add them, composite indexes, covering indexes, what an index scan vs seq scan means
- [ ] Master: Transactions — ACID properties, isolation levels (read uncommitted → serializable), deadlocks
- [ ] Practice: Write 20 non-trivial queries against a real dataset (use a public PostgreSQL dataset)
- [ ] Study: Query execution plans — use `EXPLAIN ANALYZE` on every query you write this week
- [ ] Build: A schema migration system from scratch (up/down migrations, version tracking)
- **Challenge:** Optimize a slow query — take a query with a full seq scan, add appropriate index, verify improvement with EXPLAIN ANALYZE

#### Week 8 — Supabase / PostgreSQL + Row Level Security
- [ ] Study: Supabase architecture — how it wraps PostgreSQL, PostgREST, GoTrue auth, Realtime
- [ ] Master: Row Level Security (RLS) policies — write policies for every table you create from now on
- [ ] Build: A multi-tenant data schema — one database, multiple organizations, full isolation via RLS
- [ ] Implement: Supabase Realtime subscriptions in a React app (live updates, presence)
- [ ] Study: Supabase Edge Functions — deploy one, understand cold starts and runtime limits
- [ ] Challenge: Replicate this project's Supabase schema from memory, then audit the RLS policies

---

---

# PHASE 2 — Systems & Infrastructure
## Months 3–4 | "Understand What Runs Your Code"

**Goal:** Understand every layer between your code and the user. Servers, caching, queues, deployments.

---

### Month 3 — Caching, Redis, and Performance

#### Week 9 — Redis Fundamentals
- [ ] Understand: Redis data structures — String, Hash, List, Set, Sorted Set, Stream — know when to use each
- [ ] Understand: Redis eviction policies (LRU, LFU, noeviction) — when to use which
- [ ] Understand: Persistence — RDB snapshots vs AOF logs, tradeoffs
- [ ] Build: A session store using Redis Hashes (replace JWT with server-side sessions)
- [ ] Build: A leaderboard using Redis Sorted Sets
- [ ] Build: A pub/sub notification system using Redis Pub/Sub channels
- **Daily drill:** Connect to Redis CLI, run commands manually — feel the data structures

#### Week 10 — Caching Strategies
- [ ] Study: Cache-aside, read-through, write-through, write-behind — implement each pattern
- [ ] Build: An API response cache layer — cache GET requests, invalidate on mutations
- [ ] Study: Cache stampede / thundering herd problem — implement a mutex lock pattern to solve it
- [ ] Build: A rate limiter using Redis (token bucket algorithm)
- [ ] Study: CDN caching — cache-control headers, ETags, stale-while-revalidate, vary headers
- [ ] Challenge: Profile an API endpoint, identify N+1 query, add Redis cache, measure improvement
- **Deliverable:** A caching middleware you can drop into any Express/Hono app

#### Week 11 — Background Jobs and Queues
- [ ] Understand: Why you need a queue (long-running tasks, retries, rate limiting external APIs)
- [ ] Study: BullMQ (Redis-backed) — job lifecycle, concurrency, priorities, delayed jobs, repeatable jobs
- [ ] Build: An email queue — jobs are added on user signup, worker sends emails, retries on failure
- [ ] Build: A report generation queue — user requests report, job processes async, result stored, user notified
- [ ] Study: Dead letter queues — what happens to jobs that keep failing
- [ ] Challenge: Simulate a queue under load — 1000 jobs, 5 workers, measure throughput and latency

#### Week 12 — API Design and Integration
- [ ] Study: REST API design — resource naming, versioning (URL vs header), pagination (cursor vs offset), HATEOAS
- [ ] Study: REST vs GraphQL vs tRPC — know when each is the right choice and why
- [ ] Build: A fully versioned REST API with `/v1` and `/v2` endpoints, with deprecation headers
- [ ] Build: A tRPC backend with a React frontend — experience end-to-end type safety
- [ ] Study: API rate limiting, throttling, circuit breakers — implement a circuit breaker pattern
- [ ] Study: Webhooks — implement a webhook receiver with signature verification (HMAC-SHA256)
- **Challenge:** Build a webhook delivery system — stores webhook, retries with exponential backoff, tracks delivery status

---

### Month 4 — Financial APIs, Plaid, and External Integrations

#### Week 13 — HTTP Internals + API Security
- [ ] Master: HTTP/1.1 vs HTTP/2 vs HTTP/3 — headers, connection keep-alive, multiplexing, QUIC
- [ ] Master: CORS — what it is, why it exists, preflight requests, when `credentials: true` matters
- [ ] Master: Authentication patterns — session cookies, JWT, OAuth2, API keys — security tradeoffs of each
- [ ] Study: HTTPS — TLS handshake, certificates, HSTS, certificate pinning
- [ ] Build: An OAuth2 server from scratch (authorization code flow, PKCE)
- [ ] Study: Common API vulnerabilities — broken object level auth, mass assignment, injection
- **Daily drill:** Intercept one API call per day in browser devtools — read every header, understand every field

#### Week 14 — Plaid Integration
- [ ] Read Plaid docs completely before writing a single line of code
- [ ] Understand: Plaid Link flow — how it works, why it uses a hosted iframe, what tokens you get
- [ ] Understand: Token exchange — `public_token` → `access_token` — why this two-step exists (security)
- [ ] Understand: Products — Auth, Transactions, Identity, Balance, Investments, Liabilities
- [ ] Build: Full Plaid Link integration — frontend (Link component), backend (token exchange, storage)
- [ ] Build: Transaction sync — use `/transactions/sync` to incrementally fetch new/modified/removed transactions
- [ ] Build: Balance polling — fetch real-time account balances, store in DB with timestamp
- [ ] Study: Plaid webhooks — implement handlers for `TRANSACTIONS_REMOVED`, `DEFAULT_UPDATE`, `HISTORICAL_UPDATE`
- [ ] Study: Plaid error handling — `ITEM_LOGIN_REQUIRED`, `INSTITUTION_DOWN`, `RATE_LIMIT_EXCEEDED`
- **Challenge:** Build a complete personal finance data pipeline: connect bank → sync transactions → categorize → store → expose via API

#### Week 15 — Stripe and Payment Systems
- [ ] Understand: Stripe's object model — Customer, PaymentIntent, SetupIntent, Subscription, Invoice
- [ ] Understand: Idempotency keys — why they exist, how to use them, what happens without them
- [ ] Build: A one-time payment flow with Stripe Elements (client) + PaymentIntent (server)
- [ ] Build: A subscription system — create, upgrade, downgrade, cancel, handle payment failure
- [ ] Build: A webhook handler — handle `payment_intent.succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`
- [ ] Study: PCI compliance — why you never touch raw card data, what SAQ-A means
- **Challenge:** Build a metered billing system — track usage events, bill at end of period

#### Week 16 — Third-Party API Patterns
- [ ] Build: An API integration layer — abstract any third-party API behind an interface so it's swappable
- [ ] Build: An API key management system — rotate keys, track usage, alert on anomalies
- [ ] Study: Dealing with flaky external APIs — timeouts, retries, circuit breakers, fallbacks
- [ ] Build: A data sync engine — pull from external API, diff against local state, apply changes
- [ ] Study: Pagination patterns across different APIs (cursor, offset, link header, next_url)
- **Deliverable:** A reusable adapter pattern template for any external API integration

---

---

# PHASE 3 — Server-Side Actions, Frameworks & Deployment
## Months 5–6 | "Build Like It's Going to Production"

**Goal:** Ship real applications with real infrastructure. Everything works under load and failure.

---

### Month 5 — Next.js / Server-Side Rendering + Server Actions

#### Week 17 — Next.js App Router Deep Dive
- [ ] Understand: App Router vs Pages Router — layout system, nested layouts, route groups, parallel routes, intercepting routes
- [ ] Understand: Server Components vs Client Components — rendering boundaries, serialization constraints, when to use each
- [ ] Understand: Streaming and Suspense — how partial hydration works, progressive rendering
- [ ] Build: A full app using App Router — implement layouts, loading states, error boundaries, not-found pages
- [ ] Study: Data fetching in Server Components — no useEffect, no client state — fetch directly in the component
- **Daily drill:** For every feature you build, ask: "Should this be a Server Component or Client Component and why?"

#### Week 18 — Server Actions and Mutations
- [ ] Understand: What Server Actions are — RPC calls from client to server, automatically serialized
- [ ] Understand: Progressive enhancement — Server Actions work without JavaScript enabled
- [ ] Build: A full CRUD app using only Server Actions (no API routes, no fetch calls from client)
- [ ] Build: Optimistic updates with `useOptimistic` hook paired with Server Actions
- [ ] Study: Server Action security — CSRF protection (built-in), input validation with Zod, authentication checks
- [ ] Build: A file upload using Server Actions — multipart form data, validation, storage
- **Challenge:** Rebuild a section of this project using Server Actions instead of client-side API calls — compare complexity

#### Week 19 — Authentication at Scale
- [ ] Build: Auth from scratch in Next.js — cookies, sessions, middleware-based route protection
- [ ] Implement: Auth.js (NextAuth) with multiple providers — Google, GitHub, credentials
- [ ] Implement: Supabase Auth with SSR — server-side session management, middleware, cookie handling
- [ ] Study: Session vs JWT in Next.js — why cookies are often better than localStorage for auth tokens
- [ ] Build: A complete auth system: signup, login, logout, password reset, email verification, 2FA (TOTP)
- **Challenge:** Implement a "magic link" authentication flow from scratch

#### Week 20 — Performance + Core Web Vitals
- [ ] Study: LCP, FID/INP, CLS — what they measure, what causes poor scores, how to fix
- [ ] Study: Image optimization — WebP/AVIF, lazy loading, `srcset`, Next.js Image component internals
- [ ] Study: Bundle analysis — use `@next/bundle-analyzer`, identify and eliminate dead code
- [ ] Study: Font optimization — font display swap, subsetting, preloading, variable fonts
- [ ] Practice: Take a slow Next.js app, audit with Lighthouse, fix 3 specific issues, re-measure
- [ ] Study: React Server Components and their impact on bundle size — measure before/after
- **Challenge:** Get a Next.js app from a Lighthouse score of ~60 to 90+ on all metrics

---

### Month 6 — Embedded Systems Fundamentals

#### Week 21 — C/C++ Fundamentals for Embedded
- [ ] Understand: Memory model — stack vs heap, memory layout of a program (text, data, bss, heap, stack)
- [ ] Understand: Pointers — pointer arithmetic, function pointers, pointers to pointers
- [ ] Understand: Manual memory management — malloc/free, common bugs (use-after-free, double-free, buffer overflow)
- [ ] Build: Implement common data structures in C — linked list, stack, queue, hash map
- [ ] Study: Undefined behavior in C — why it's dangerous, how compilers exploit it
- [ ] Study: Bit manipulation — AND, OR, XOR, shifts — implement setting, clearing, toggling bits in a register
- **Daily drill:** Read one piece of embedded C source code (Linux driver, Arduino library, FreeRTOS)

#### Week 22 — Microcontroller Basics (Arduino/STM32)
- [ ] Understand: GPIO — digital input/output, pull-up/pull-down resistors, open-drain
- [ ] Understand: Interrupts — ISR requirements (fast, no blocking, volatile variables), interrupt priority
- [ ] Understand: Timers — PWM generation, input capture, output compare
- [ ] Build: LED control, button debouncing, PWM motor/servo control
- [ ] Understand: Communication protocols — UART (serial), SPI, I2C — know the electrical and software differences
- [ ] Build: Read data from a sensor over I2C or SPI, display it, transmit over UART
- **Challenge:** Implement a software UART (bit-bang serial) from scratch using a timer interrupt

#### Week 23 — Real-Time Operating Systems (RTOS)
- [ ] Study: RTOS concepts — tasks, scheduler (preemptive vs cooperative), priorities, context switching
- [ ] Study: Synchronization — mutexes, semaphores, message queues — understand priority inversion
- [ ] Study: FreeRTOS — task creation, delays (`vTaskDelay` vs `vTaskDelayUntil`), queues, event groups
- [ ] Build: A multi-task embedded app — one task reads sensor, one task processes data, one task communicates
- [ ] Study: Stack overflow detection in RTOS — stack watermarking, high water marks
- [ ] Study: When NOT to use an RTOS — bare-metal loop vs RTOS tradeoffs
- **Challenge:** Port a bare-metal application to FreeRTOS, maintaining the same behavior

#### Week 24 — Embedded + Web Bridge (IoT)
- [ ] Study: MQTT protocol — broker, topics, QoS levels, retained messages, last will
- [ ] Study: WebSocket vs MQTT vs HTTP for IoT — power, reliability, latency tradeoffs
- [ ] Build: Embedded device publishes sensor data via MQTT → server subscribes → stores in DB → web dashboard live updates
- [ ] Study: OTA (over-the-air) updates — how firmware updates are delivered safely
- [ ] Study: Security in IoT — TLS on embedded, certificate provisioning, secure boot
- **Deliverable:** End-to-end IoT pipeline: hardware → MQTT → Node server → Redis pub/sub → WebSocket → React dashboard

---

---

# PHASE 4 — Mastery and Ownership
## Months 7–12 | "Build the Things That Scare You"

**Goal:** Tackle complex, production-grade systems. Independent problem-solving at senior level.

---

### Month 7–8 — Architecture and System Design

#### Topics to Master
- [ ] Study: CAP theorem — consistency, availability, partition tolerance — real-world implications
- [ ] Study: Database scaling — vertical vs horizontal, read replicas, sharding strategies
- [ ] Study: Microservices vs monolith vs modular monolith — know when each is the right choice
- [ ] Study: Event-driven architecture — event sourcing, CQRS, saga pattern
- [ ] Study: Message brokers — Kafka vs RabbitMQ vs Redis Streams — when to use which
- [ ] Study: API Gateway patterns — rate limiting, auth, routing, circuit breakers at the gateway level

#### Build Targets
- [ ] **Project:** Design and build a system that handles 10,000 concurrent WebSocket connections
- [ ] **Project:** Build a distributed task queue that survives worker crashes and server restarts
- [ ] **Project:** Implement a simplified event sourcing system — every state change is an event, state is derived by replaying events
- [ ] **Project:** Build a multi-region data sync system — data written in one region appears in another within 500ms

---

### Month 9–10 — DevOps, CI/CD, and Infrastructure

#### Topics to Master
- [ ] Docker — multi-stage builds, layer caching, minimal images, compose for local dev
- [ ] CI/CD — GitHub Actions: lint, test, build, deploy pipelines
- [ ] Infrastructure as Code — Terraform basics, understand what it manages
- [ ] Monitoring and Observability — structured logging, distributed tracing, metrics (Prometheus/Grafana)
- [ ] Security hardening — secrets management (no secrets in code), SAST tools, dependency scanning

#### Build Targets
- [ ] Containerize this project — Dockerfile, docker-compose, environment-specific configs
- [ ] Set up a GitHub Actions pipeline — runs tests on PR, deploys on merge to main
- [ ] Implement structured logging — every log has correlationId, userId, duration, status
- [ ] Set up error tracking (Sentry) — catch unhandled errors, group them, alert on spikes
- [ ] Implement health check endpoints — liveness and readiness probes

---

### Month 11–12 — Specialization Sprint

#### Choose 2–3 deep dives based on where you want to be exceptional:

**Option A — Data Pipeline Engineering**
- [ ] Learn: ETL patterns, change data capture (CDC), stream processing
- [ ] Build: A financial data pipeline — ingest transactions from Plaid, normalize, categorize, aggregate, serve via API

**Option B — Real-Time Systems**
- [ ] Learn: WebRTC fundamentals, STUN/TURN servers, signaling
- [ ] Build: A peer-to-peer video/audio communication feature

**Option C — Machine Learning Integration**
- [ ] Learn: Vector embeddings, semantic search, RAG (retrieval-augmented generation)
- [ ] Build: A codebase search tool using embeddings — natural language query returns relevant code

**Option D — High-Performance Computing**
- [ ] Learn: SIMD, memory alignment, cache-friendly data structures
- [ ] Build: Optimize a hot code path — profile, identify bottleneck, rewrite for performance, measure

---

---

# CHECKPOINTS AND MILESTONES

## Month 2 Checkpoint
- [ ] Can build a full REST API with auth, validation, and DB integration from scratch in < 4 hours
- [ ] Can explain the React rendering cycle and demonstrate it by breaking and fixing it
- [ ] Has at least 1 deployed project with real users or real data

## Month 4 Checkpoint
- [ ] Can architect and implement a Redis caching layer for any existing API
- [ ] Can integrate Plaid or Stripe from scratch without referencing tutorials
- [ ] Can write PostgreSQL queries using window functions and explain the execution plan

## Month 6 Checkpoint
- [ ] Can build and deploy a full Next.js app with Server Actions and server-side auth
- [ ] Can write C code that controls hardware (GPIO, UART) without assistance
- [ ] Can design a system for 100k users and articulate the tradeoffs

## Month 9 Checkpoint
- [ ] Has shipped at least 3 features to a real production environment
- [ ] Can debug production issues using logs, metrics, and tracing
- [ ] Can conduct a meaningful code review — not just style, but architecture and correctness

## Month 12 Checkpoint — Target: Senior Level
- [ ] Can lead the technical design of a new feature end-to-end
- [ ] Independently identifies problems before they become bugs
- [ ] Code requires minimal review changes
- [ ] Can onboard another developer to any system they've built

---

---

# DAILY HABITS (NON-NEGOTIABLE)

| Habit | Why |
|---|---|
| Read 1 piece of unfamiliar source code per day | Builds pattern recognition faster than tutorials |
| Write code before reading the solution | Struggle sharpens understanding |
| Explain what you built in writing | Forces clarity — if you can't explain it, you don't understand it |
| Review yesterday's code the next morning | Fresh eyes catch what tired eyes miss |
| One deliberate debugging session per week | Debugging is a skill; practice it intentionally |

---

# RESOURCES

## Books (Read in order of phase)
1. **Phase 1:** *You Don't Know JS* series (Kyle Simpson) — free online
2. **Phase 1:** *TypeScript Deep Dive* (Basarat) — free online
3. **Phase 2:** *Designing Data-Intensive Applications* (Kleppmann) — the single most important backend book
4. **Phase 3:** *Clean Architecture* (Martin) — understand why code is structured the way it is
5. **Phase 4:** *Systems Performance* (Gregg) — for when you need to go deep

## Practice Platforms
- **SQL:** pgexercises.com, mode.com/sql-tutorial
- **Algorithms (for interviews only, not a focus):** leetcode.com — solve Easy/Medium only
- **System Design:** systemdesign.one, blog.bytebytego.com
- **Embedded:** nand2tetris.org (understand hardware from logic gates up)

## Reference Documentation (Bookmark these, read them directly)
- MDN Web Docs — the authoritative source for web APIs
- Node.js official docs — especially the `stream`, `events`, `http` modules
- PostgreSQL docs — especially the Query Planning and Performance Tips sections
- Redis docs — the data structures section
- Plaid API Reference — read every endpoint you use

---

# HOW TO USE THIS PLAN

1. **Start each week on Sunday.** Read the week's tasks, estimate your hours, schedule them.
2. **Build something every single day.** No day is theory-only. Even 20 lines of code counts.
3. **Track your progress.** Check off tasks. Write one sentence each day about what was hard.
4. **Bring your problems here.** When stuck for more than 30 minutes, articulate the problem in writing before asking for help — often the act of writing it reveals the answer.
5. **Revisit earlier phases.** If something from Phase 1 felt shaky in Phase 3, go back and rebuild it.

---

*Last updated: April 2026*
*Managed by: [Your Name]*
