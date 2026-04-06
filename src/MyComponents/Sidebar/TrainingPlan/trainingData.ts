// ─────────────────────────────────────────────────────────────────────────────
// Training Plan Data — Full 6–12 Month Full-Stack Mastery Curriculum
// ─────────────────────────────────────────────────────────────────────────────

export type TaskType = "study" | "build" | "challenge" | "deliverable";
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface Task {
  id: string;
  text: string;
  type: TaskType;
  day: DayOfWeek;
  hours: number;
}

export interface DayBlock {
  day: DayOfWeek;
  hours: number;
  focus: string;
}

export interface Week {
  id: string;
  weekNumber: number;
  title: string;
  monthId: string;
  phaseId: string;
  topics: string[];
  tasks: Task[];
  dailySchedule: DayBlock[];
}

export interface Month {
  id: string;
  monthNumber: number;
  title: string;
  phaseId: string;
  weeks: Week[];
}

export interface Phase {
  id: string;
  phaseNumber: number;
  title: string;
  subtitle: string;
  goal: string;
  duration: string;
  color: string;
  months: Month[];
}

export interface Checkpoint {
  phaseId: string;
  title: string;
  items: string[];
}

// ─── HELPER ──────────────────────────────────────────────────────────────────
const makeDay = (day: DayOfWeek, hours: number, focus: string): DayBlock => ({
  day,
  hours,
  focus,
});

const makeTask = (
  id: string,
  text: string,
  type: TaskType,
  day: DayOfWeek,
  hours: number
): Task => ({ id, text, type, day, hours });

// ─────────────────────────────────────────────────────────────────────────────
// PHASES
// ─────────────────────────────────────────────────────────────────────────────
export const PHASES: Phase[] = [
  // ══════════════════════════════════════════════════════════════════
  // PHASE 1 — Foundation Hardening
  // ══════════════════════════════════════════════════════════════════
  {
    id: "phase1",
    phaseNumber: 1,
    title: "Foundation Hardening",
    subtitle: "Make the Concepts Bleed Code",
    goal: "Turn every concept you understand into something you can build cold, without reference.",
    duration: "Months 1–2",
    color: "red",
    months: [
      {
        id: "month1",
        monthNumber: 1,
        title: "TypeScript, React Depth & Component Architecture",
        phaseId: "phase1",
        weeks: [
          // ── Week 1
          {
            id: "week1",
            weekNumber: 1,
            title: "TypeScript Mastery",
            monthId: "month1",
            phaseId: "phase1",
            topics: ["Generics", "Utility Types", "Discriminated Unions", "Type Guards", "Infer"],
            dailySchedule: [
              makeDay("monday", 9, "Generics & Utility Types deep dive"),
              makeDay("tuesday", 9, "Discriminated unions & type guards"),
              makeDay("wednesday", 9, "Build: Typed REST API response handler"),
              makeDay("thursday", 9, "Advanced: infer, conditional types, template literals"),
              makeDay("friday", 8, "Review + intentional error drills"),
              makeDay("saturday", 7, "Challenge: Typed event bus system (pub/sub)"),
              makeDay("sunday", 5, "Code review + plan Week 2"),
            ],
            tasks: [
              makeTask("w1t1", "Rewrite 3 JS files you've written, fully typed in TypeScript", "build", "monday", 3),
              makeTask("w1t2", "Master generics, utility types: Partial, Required, Pick, Omit, Record", "study", "monday", 4),
              makeTask("w1t3", "Master discriminated unions, type guards, and the infer keyword", "study", "tuesday", 4),
              makeTask("w1t4", "Build: Fully-typed REST API response handler with runtime type narrowing", "build", "wednesday", 5),
              makeTask("w1t5", "Drill: Read 1 TS compiler error per day — cause it intentionally, then fix it", "study", "thursday", 1),
              makeTask("w1t6", "Challenge: Typed event bus system from scratch (publish/subscribe pattern)", "challenge", "saturday", 5),
            ],
          },
          // ── Week 2
          {
            id: "week2",
            weekNumber: 2,
            title: "React Internals + Hooks Deep Dive",
            monthId: "month1",
            phaseId: "phase1",
            topics: ["Fiber Architecture", "useReducer", "useMemo", "useCallback", "useRef", "useLayoutEffect"],
            dailySchedule: [
              makeDay("monday", 9, "React fiber + reconciler (conceptual)"),
              makeDay("tuesday", 9, "useReducer + useContext — build global state manager"),
              makeDay("wednesday", 9, "useMemo, useCallback — when NOT to use them"),
              makeDay("thursday", 9, "Build: Virtualized list component (no library)"),
              makeDay("friday", 8, "Review + refactor this week's code"),
              makeDay("saturday", 7, "Challenge: Form library from scratch"),
              makeDay("sunday", 5, "Code review + plan Week 3"),
            ],
            tasks: [
              makeTask("w2t1", "Understand React's reconciler and fiber architecture conceptually", "study", "monday", 3),
              makeTask("w2t2", "Build: Global state manager using only Context + useReducer (no Zustand)", "build", "tuesday", 5),
              makeTask("w2t3", "Master useMemo and useCallback — identify when each is a pessimization", "study", "wednesday", 3),
              makeTask("w2t4", "Build: Virtualized list component — render only visible rows, zero dependencies", "build", "thursday", 5),
              makeTask("w2t5", "Challenge: Form library from scratch — validation, touched state, submission", "challenge", "saturday", 5),
            ],
          },
          // ── Week 3
          {
            id: "week3",
            weekNumber: 3,
            title: "Component Architecture + Design Patterns",
            monthId: "month1",
            phaseId: "phase1",
            topics: ["Compound Components", "Render Props", "HOCs", "Composition vs Inheritance", "Portal Rendering"],
            dailySchedule: [
              makeDay("monday", 9, "Compound components, render props, HOCs — when to use each"),
              makeDay("tuesday", 9, "Build: Zero-dependency DataTable with sort/filter/pagination"),
              makeDay("wednesday", 9, "Build: Modal system with portal + focus trapping"),
              makeDay("thursday", 9, "Refactor: Redesign a messy component you've written"),
              makeDay("friday", 8, "Document every architecture decision with inline comments explaining WHY"),
              makeDay("saturday", 7, "Challenge: Headless component design pattern"),
              makeDay("sunday", 5, "Review + plan Week 4"),
            ],
            tasks: [
              makeTask("w3t1", "Study: Compound components, render props, HOCs — know when each is appropriate", "study", "monday", 3),
              makeTask("w3t2", "Build: Reusable <DataTable> with sorting, filtering, pagination — zero dependencies", "build", "tuesday", 5),
              makeTask("w3t3", "Build: Modal/dialog system with portal rendering and focus trapping", "build", "wednesday", 4),
              makeTask("w3t4", "Refactor: Take a messy component, redesign with proper separation of concerns", "build", "thursday", 5),
              makeTask("w3t5", "Deliverable: Document your architecture decisions with WHY comments inline", "deliverable", "friday", 3),
            ],
          },
          // ── Week 4
          {
            id: "week4",
            weekNumber: 4,
            title: "State Management at Scale",
            monthId: "month1",
            phaseId: "phase1",
            topics: ["Zustand Internals", "TanStack Query", "Optimistic Updates", "Cache Invalidation", "Stale-While-Revalidate"],
            dailySchedule: [
              makeDay("monday", 9, "Read Zustand source code — understand the ~100 line core"),
              makeDay("tuesday", 9, "Build: Full CRUD with Zustand + persist middleware + slices"),
              makeDay("wednesday", 9, "Migrate same app to TanStack Query — understand what changes"),
              makeDay("thursday", 9, "Optimistic updates + stale-while-revalidate deep dive"),
              makeDay("friday", 8, "Month 1 review + code cleanup"),
              makeDay("saturday", 7, "Challenge: Optimistic UI for delete with rollback on failure"),
              makeDay("sunday", 5, "Month 1 retrospective + plan Month 2"),
            ],
            tasks: [
              makeTask("w4t1", "Learn Zustand internals — read the actual source code (~100 lines)", "study", "monday", 2),
              makeTask("w4t2", "Build: Full CRUD app using Zustand with persist middleware, devtools, slices", "build", "tuesday", 5),
              makeTask("w4t3", "Migrate the same app to TanStack Query — understand what each tool is for", "build", "wednesday", 5),
              makeTask("w4t4", "Study: Optimistic updates, cache invalidation strategies, stale-while-revalidate", "study", "thursday", 3),
              makeTask("w4t5", "Challenge: Implement optimistic UI for delete that rolls back on server failure", "challenge", "saturday", 5),
            ],
          },
        ],
      },
      // ── Month 2
      {
        id: "month2",
        monthNumber: 2,
        title: "Backend, Node.js & Databases",
        phaseId: "phase1",
        weeks: [
          // ── Week 5
          {
            id: "week5",
            weekNumber: 5,
            title: "Node.js Runtime & Event Loop",
            monthId: "month2",
            phaseId: "phase1",
            topics: ["Event Loop Phases", "libuv", "Non-blocking I/O", "Streams", "Raw HTTP Server"],
            dailySchedule: [
              makeDay("monday", 9, "Event loop phases — timers, I/O, poll, check, close + microtask queue"),
              makeDay("tuesday", 9, "Build: HTTP server from raw node:http — no Express"),
              makeDay("wednesday", 9, "Streams, pipe, backpressure — read Node.js stream source"),
              makeDay("thursday", 9, "Build: Middleware pipeline from scratch (how Express works)"),
              makeDay("friday", 8, "Read one Node.js core module source file — events, http, or stream"),
              makeDay("saturday", 7, "Challenge: Rate limiter via sliding window algorithm"),
              makeDay("sunday", 5, "Review + plan Week 6"),
            ],
            tasks: [
              makeTask("w5t1", "Understand event loop phases deeply — microtask vs macrotask queue, libuv", "study", "monday", 4),
              makeTask("w5t2", "Build: HTTP server from raw node:http — no framework whatsoever", "build", "tuesday", 5),
              makeTask("w5t3", "Build: Middleware pipeline implementation (understand how Express works internally)", "build", "thursday", 4),
              makeTask("w5t4", "Drill: Read one Node.js core module source file per day this week", "study", "friday", 1),
              makeTask("w5t5", "Challenge: Rate limiter middleware from scratch using sliding window algorithm", "challenge", "saturday", 5),
            ],
          },
          // ── Week 6
          {
            id: "week6",
            weekNumber: 6,
            title: "Express + Server Frameworks",
            monthId: "month2",
            phaseId: "phase1",
            topics: ["REST API", "JWT + Refresh Tokens", "RBAC", "Hono / Cloudflare Workers", "File Upload"],
            dailySchedule: [
              makeDay("monday", 9, "Build full REST API: auth, CRUD, validation, error handling, logging"),
              makeDay("tuesday", 9, "Implement JWT + refresh tokens (access: 15min, refresh: 7 days)"),
              makeDay("wednesday", 9, "Implement RBAC — user / admin / superadmin roles"),
              makeDay("thursday", 9, "Build: File upload endpoint with validation, size limits, storage abstraction"),
              makeDay("friday", 9, "Rebuild same API in Hono for Cloudflare Workers — understand runtime diff"),
              makeDay("saturday", 7, "Deliverable: Production-ready API template"),
              makeDay("sunday", 5, "Review + plan Week 7"),
            ],
            tasks: [
              makeTask("w6t1", "Build REST API from scratch: auth, CRUD, validation, error middleware, logging", "build", "monday", 5),
              makeTask("w6t2", "Implement JWT authentication with refresh token rotation", "build", "tuesday", 4),
              makeTask("w6t3", "Implement Role-Based Access Control — user, admin, superadmin", "build", "wednesday", 4),
              makeTask("w6t4", "Build: File upload endpoint with validation, size limits, storage abstraction", "build", "thursday", 4),
              makeTask("w6t5", "Challenge: Rebuild same API in Hono targeting Cloudflare Workers runtime", "challenge", "friday", 5),
              makeTask("w6t6", "Deliverable: Production-ready API template you can clone for any project", "deliverable", "saturday", 4),
            ],
          },
          // ── Week 7
          {
            id: "week7",
            weekNumber: 7,
            title: "SQL Mastery",
            monthId: "month2",
            phaseId: "phase1",
            topics: ["JOINs + CTEs", "Window Functions", "Indexes", "Transactions + ACID", "EXPLAIN ANALYZE"],
            dailySchedule: [
              makeDay("monday", 9, "JOINs, subqueries, CTEs — write 20 non-trivial queries"),
              makeDay("tuesday", 9, "Window functions — ROW_NUMBER, RANK, LAG, LEAD, PARTITION BY"),
              makeDay("wednesday", 9, "Indexes — composite, covering, when to add, seq scan vs index scan"),
              makeDay("thursday", 9, "Transactions — ACID, isolation levels (read uncommitted → serializable), deadlocks"),
              makeDay("friday", 9, "EXPLAIN ANALYZE on every query written this week — understand execution plans"),
              makeDay("saturday", 7, "Challenge: Take a seq-scan query to index scan, verify with EXPLAIN ANALYZE"),
              makeDay("sunday", 5, "Review + plan Week 8"),
            ],
            tasks: [
              makeTask("w7t1", "Master: JOINs (inner, left, right, full, cross, self), subqueries, CTEs", "study", "monday", 4),
              makeTask("w7t2", "Master: Window functions — ROW_NUMBER, RANK, LAG, LEAD, PARTITION BY", "study", "tuesday", 4),
              makeTask("w7t3", "Master: Indexes — when to add, composite vs covering, what each scan type means", "study", "wednesday", 4),
              makeTask("w7t4", "Master: Transactions — ACID properties, isolation levels, deadlocks", "study", "thursday", 3),
              makeTask("w7t5", "Practice: Write 20 non-trivial queries against a real PostgreSQL dataset", "build", "monday", 3),
              makeTask("w7t6", "Challenge: Optimize a slow query — take full seq scan to index scan, verify with EXPLAIN ANALYZE", "challenge", "saturday", 5),
            ],
          },
          // ── Week 8
          {
            id: "week8",
            weekNumber: 8,
            title: "Supabase + PostgreSQL + RLS",
            monthId: "month2",
            phaseId: "phase1",
            topics: ["Row Level Security", "PostgREST", "GoTrue Auth", "Realtime Subscriptions", "Edge Functions", "Multi-tenant Schema"],
            dailySchedule: [
              makeDay("monday", 9, "Supabase architecture — PostgREST, GoTrue, Realtime, storage"),
              makeDay("tuesday", 9, "Row Level Security — write policies for every table from now on"),
              makeDay("wednesday", 9, "Build: Multi-tenant schema — one DB, multiple orgs, full isolation via RLS"),
              makeDay("thursday", 9, "Implement: Supabase Realtime subscriptions + presence in React"),
              makeDay("friday", 9, "Supabase Edge Functions — deploy one, understand cold starts + runtime limits"),
              makeDay("saturday", 7, "Challenge: Replicate this project's Supabase schema from memory, audit RLS"),
              makeDay("sunday", 5, "Phase 1 retrospective + plan Phase 2"),
            ],
            tasks: [
              makeTask("w8t1", "Study: Supabase architecture — PostgREST, GoTrue auth, Realtime, cold storage", "study", "monday", 3),
              makeTask("w8t2", "Master: Row Level Security — write policies for EVERY table you create from now on", "study", "tuesday", 4),
              makeTask("w8t3", "Build: Multi-tenant schema — one database, multiple organizations, RLS isolation", "build", "wednesday", 5),
              makeTask("w8t4", "Implement: Supabase Realtime subscriptions in React (live updates, presence)", "build", "thursday", 4),
              makeTask("w8t5", "Challenge: Replicate this project's full Supabase schema from memory, then audit the RLS policies", "challenge", "saturday", 6),
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // PHASE 2 — Systems & Infrastructure
  // ══════════════════════════════════════════════════════════════════
  {
    id: "phase2",
    phaseNumber: 2,
    title: "Systems & Infrastructure",
    subtitle: "Understand What Runs Your Code",
    goal: "Understand every layer between your code and the user. Servers, caching, queues, deployments.",
    duration: "Months 3–4",
    color: "amber",
    months: [
      {
        id: "month3",
        monthNumber: 3,
        title: "Caching, Redis & Performance",
        phaseId: "phase2",
        weeks: [
          // ── Week 9
          {
            id: "week9",
            weekNumber: 9,
            title: "Redis Fundamentals",
            monthId: "month3",
            phaseId: "phase2",
            topics: ["Data Structures", "Eviction Policies", "Persistence (RDB/AOF)", "Pub/Sub", "Sorted Sets"],
            dailySchedule: [
              makeDay("monday", 9, "Redis data structures — String, Hash, List, Set, Sorted Set, Stream"),
              makeDay("tuesday", 9, "Build: Session store using Redis Hashes"),
              makeDay("wednesday", 9, "Build: Leaderboard using Redis Sorted Sets"),
              makeDay("thursday", 9, "Build: Pub/Sub notification system"),
              makeDay("friday", 9, "Eviction policies (LRU, LFU) + persistence: RDB vs AOF tradeoffs"),
              makeDay("saturday", 7, "Drill: Redis CLI — run every data structure command manually"),
              makeDay("sunday", 5, "Review + plan Week 10"),
            ],
            tasks: [
              makeTask("w9t1", "Understand all Redis data structures and when to use each one", "study", "monday", 3),
              makeTask("w9t2", "Build: Session store using Redis Hashes (replace JWT with server-side sessions)", "build", "tuesday", 4),
              makeTask("w9t3", "Build: Leaderboard using Redis Sorted Sets", "build", "wednesday", 3),
              makeTask("w9t4", "Build: Pub/Sub notification system using Redis channels", "build", "thursday", 4),
              makeTask("w9t5", "Study: Eviction policies (LRU, LFU, noeviction) + RDB vs AOF persistence", "study", "friday", 3),
            ],
          },
          // ── Week 10
          {
            id: "week10",
            weekNumber: 10,
            title: "Caching Strategies",
            monthId: "month3",
            phaseId: "phase2",
            topics: ["Cache-Aside", "Read/Write-Through", "Cache Stampede", "Token Bucket Rate Limiter", "CDN + ETags"],
            dailySchedule: [
              makeDay("monday", 9, "Cache-aside, read-through, write-through, write-behind — implement each"),
              makeDay("tuesday", 9, "Build: API response cache layer — cache GETs, invalidate on mutations"),
              makeDay("wednesday", 9, "Cache stampede / thundering herd — implement mutex lock solution"),
              makeDay("thursday", 9, "Build: Rate limiter using Redis token bucket algorithm"),
              makeDay("friday", 9, "CDN caching — cache-control headers, ETags, stale-while-revalidate, vary"),
              makeDay("saturday", 7, "Challenge: Profile API endpoint, find N+1 query, add cache, measure improvement"),
              makeDay("sunday", 5, "Review + plan Week 11"),
            ],
            tasks: [
              makeTask("w10t1", "Study + implement: Cache-aside, read-through, write-through, write-behind patterns", "study", "monday", 4),
              makeTask("w10t2", "Build: API response cache middleware — cache GET requests, invalidate on mutations", "build", "tuesday", 4),
              makeTask("w10t3", "Study + solve: Cache stampede / thundering herd problem with mutex lock pattern", "build", "wednesday", 4),
              makeTask("w10t4", "Build: Rate limiter using Redis token bucket algorithm", "build", "thursday", 4),
              makeTask("w10t5", "Challenge: Profile API, identify N+1 query, add Redis cache, measure improvement", "challenge", "saturday", 5),
              makeTask("w10t6", "Deliverable: Drop-in caching middleware for any Express/Hono app", "deliverable", "friday", 3),
            ],
          },
          // ── Week 11
          {
            id: "week11",
            weekNumber: 11,
            title: "Background Jobs & Queues",
            monthId: "month3",
            phaseId: "phase2",
            topics: ["BullMQ", "Job Lifecycle", "Concurrency + Priority", "Dead Letter Queues", "Delayed Jobs"],
            dailySchedule: [
              makeDay("monday", 9, "Why queues exist + BullMQ job lifecycle, concurrency, priorities"),
              makeDay("tuesday", 9, "Build: Email queue — add on signup, worker sends, retries on failure"),
              makeDay("wednesday", 9, "Build: Report generation queue — async, result stored, user notified"),
              makeDay("thursday", 9, "Dead letter queues + delayed jobs + repeatable jobs"),
              makeDay("friday", 9, "Review queue implementation, add monitoring"),
              makeDay("saturday", 7, "Challenge: 1000 jobs, 5 workers — measure throughput and latency"),
              makeDay("sunday", 5, "Review + plan Week 12"),
            ],
            tasks: [
              makeTask("w11t1", "Understand why you need a queue and study BullMQ job lifecycle", "study", "monday", 3),
              makeTask("w11t2", "Build: Email queue — jobs added on user signup, worker processes, retries on failure", "build", "tuesday", 5),
              makeTask("w11t3", "Build: Report generation queue — user requests, job processes async, user notified", "build", "wednesday", 5),
              makeTask("w11t4", "Study: Dead letter queues, delayed jobs, repeatable jobs, job priorities", "study", "thursday", 3),
              makeTask("w11t5", "Challenge: Load test queue — 1000 jobs, 5 workers, measure throughput and latency", "challenge", "saturday", 5),
            ],
          },
          // ── Week 12
          {
            id: "week12",
            weekNumber: 12,
            title: "API Design & Integration Patterns",
            monthId: "month3",
            phaseId: "phase2",
            topics: ["REST Design", "GraphQL vs tRPC", "API Versioning", "Webhooks + HMAC", "Circuit Breakers"],
            dailySchedule: [
              makeDay("monday", 9, "REST API design — resource naming, versioning, pagination, HATEOAS"),
              makeDay("tuesday", 9, "REST vs GraphQL vs tRPC — when each is the right call and why"),
              makeDay("wednesday", 9, "Build: Versioned REST API with /v1 and /v2 + deprecation headers"),
              makeDay("thursday", 9, "Build: tRPC backend + React frontend — end-to-end type safety"),
              makeDay("friday", 9, "Webhooks — implement HMAC-SHA256 signature verification"),
              makeDay("saturday", 7, "Challenge: Webhook delivery system with exponential backoff"),
              makeDay("sunday", 5, "Review + plan Month 4"),
            ],
            tasks: [
              makeTask("w12t1", "Study: REST design — resource naming, versioning, cursor vs offset pagination", "study", "monday", 3),
              makeTask("w12t2", "Study: REST vs GraphQL vs tRPC — know when each is the right choice", "study", "tuesday", 3),
              makeTask("w12t3", "Build: Versioned REST API — /v1 and /v2 endpoints, deprecation headers", "build", "wednesday", 5),
              makeTask("w12t4", "Build: tRPC backend with React frontend — experience end-to-end type safety", "build", "thursday", 5),
              makeTask("w12t5", "Challenge: Webhook delivery system — store, retry with exponential backoff, track status", "challenge", "saturday", 5),
            ],
          },
        ],
      },
      // ── Month 4
      {
        id: "month4",
        monthNumber: 4,
        title: "Financial APIs & External Integrations",
        phaseId: "phase2",
        weeks: [
          // ── Week 13
          {
            id: "week13",
            weekNumber: 13,
            title: "HTTP Internals + API Security",
            monthId: "month4",
            phaseId: "phase2",
            topics: ["HTTP/2 vs HTTP/3", "CORS + Preflight", "OAuth2 + PKCE", "TLS Handshake", "API Vulnerabilities"],
            dailySchedule: [
              makeDay("monday", 9, "HTTP/1.1 vs HTTP/2 vs HTTP/3 — multiplexing, QUIC, headers"),
              makeDay("tuesday", 9, "CORS — preflight requests, credentials, same-origin policy"),
              makeDay("wednesday", 9, "HTTPS — TLS handshake, certificates, HSTS, certificate pinning"),
              makeDay("thursday", 9, "Build: OAuth2 server from scratch — authorization code flow + PKCE"),
              makeDay("friday", 9, "API vulnerabilities — broken object auth, mass assignment, injection"),
              makeDay("saturday", 7, "Drill: Intercept 1 API call/day in devtools — read every header"),
              makeDay("sunday", 5, "Review + plan Week 14"),
            ],
            tasks: [
              makeTask("w13t1", "Master: HTTP/1.1 vs HTTP/2 vs HTTP/3 — multiplexing, QUIC, connection handling", "study", "monday", 4),
              makeTask("w13t2", "Master: CORS — what it is, why it exists, preflight, when credentials:true matters", "study", "tuesday", 3),
              makeTask("w13t3", "Study: HTTPS — TLS handshake, certificates, HSTS, certificate pinning", "study", "wednesday", 3),
              makeTask("w13t4", "Build: OAuth2 server from scratch — authorization code flow + PKCE", "build", "thursday", 5),
              makeTask("w13t5", "Study: Common API vulnerabilities — broken object-level auth, mass assignment, injection", "study", "friday", 3),
            ],
          },
          // ── Week 14
          {
            id: "week14",
            weekNumber: 14,
            title: "Plaid Integration",
            monthId: "month4",
            phaseId: "phase2",
            topics: ["Plaid Link Flow", "Token Exchange", "Transaction Sync", "Plaid Webhooks", "Error Handling"],
            dailySchedule: [
              makeDay("monday", 9, "Read ALL Plaid docs completely before writing one line of code"),
              makeDay("tuesday", 9, "Build: Full Plaid Link — frontend component + backend token exchange"),
              makeDay("wednesday", 9, "Build: Transaction sync using /transactions/sync incremental API"),
              makeDay("thursday", 9, "Build: Balance polling + all Plaid webhook handlers"),
              makeDay("friday", 9, "Plaid error handling — ITEM_LOGIN_REQUIRED, INSTITUTION_DOWN, RATE_LIMIT_EXCEEDED"),
              makeDay("saturday", 7, "Challenge: Full finance data pipeline (Plaid → DB → categorize → serve via API)"),
              makeDay("sunday", 5, "Review + plan Week 15"),
            ],
            tasks: [
              makeTask("w14t1", "Read all Plaid documentation completely before writing any code", "study", "monday", 5),
              makeTask("w14t2", "Build: Full Plaid Link — Link component (frontend) + token exchange (backend)", "build", "tuesday", 5),
              makeTask("w14t3", "Build: Transaction sync — use /transactions/sync to incrementally fetch changes", "build", "wednesday", 4),
              makeTask("w14t4", "Build: Plaid webhooks — TRANSACTIONS_REMOVED, DEFAULT_UPDATE, HISTORICAL_UPDATE", "build", "thursday", 4),
              makeTask("w14t5", "Challenge: Full finance pipeline — Plaid → DB → categorize → expose via API", "challenge", "saturday", 7),
            ],
          },
          // ── Week 15
          {
            id: "week15",
            weekNumber: 15,
            title: "Stripe + Payment Systems",
            monthId: "month4",
            phaseId: "phase2",
            topics: ["PaymentIntent", "Subscriptions", "Idempotency Keys", "Stripe Webhooks", "PCI Compliance"],
            dailySchedule: [
              makeDay("monday", 9, "Stripe object model — Customer, PaymentIntent, SetupIntent, Subscription, Invoice"),
              makeDay("tuesday", 9, "Build: One-time payment — Stripe Elements (client) + PaymentIntent (server)"),
              makeDay("wednesday", 9, "Build: Subscription system — create, upgrade, downgrade, cancel, handle failure"),
              makeDay("thursday", 9, "Build: Webhook handler — payment_intent.succeeded, invoice.payment_failed"),
              makeDay("friday", 9, "Idempotency keys + PCI compliance — why you never touch raw card data"),
              makeDay("saturday", 7, "Challenge: Metered billing system — track usage, bill at end of period"),
              makeDay("sunday", 5, "Review + plan Week 16"),
            ],
            tasks: [
              makeTask("w15t1", "Understand Stripe object model and idempotency keys — why they exist", "study", "monday", 3),
              makeTask("w15t2", "Build: One-time payment flow with Stripe Elements + PaymentIntent", "build", "tuesday", 5),
              makeTask("w15t3", "Build: Subscription system — create, upgrade, downgrade, cancel, payment failure", "build", "wednesday", 5),
              makeTask("w15t4", "Build: Webhook handler for payment_intent.succeeded and invoice.payment_failed", "build", "thursday", 4),
              makeTask("w15t5", "Challenge: Metered billing system — track usage events, bill at end of billing period", "challenge", "saturday", 5),
            ],
          },
          // ── Week 16
          {
            id: "week16",
            weekNumber: 16,
            title: "Third-Party API Patterns",
            monthId: "month4",
            phaseId: "phase2",
            topics: ["Adapter Pattern", "API Key Management", "Circuit Breaker", "Data Sync Engine", "Pagination Patterns"],
            dailySchedule: [
              makeDay("monday", 9, "Build: API integration layer — abstract any third-party behind an interface"),
              makeDay("tuesday", 9, "Build: API key management — rotate, track usage, alert on anomalies"),
              makeDay("wednesday", 9, "Dealing with flaky APIs — timeouts, retries, circuit breakers, fallbacks"),
              makeDay("thursday", 9, "Build: Data sync engine — pull from API, diff against local, apply changes"),
              makeDay("friday", 9, "Pagination patterns across different APIs — cursor, offset, link header, next_url"),
              makeDay("saturday", 7, "Deliverable: Reusable adapter pattern template for any external API"),
              makeDay("sunday", 5, "Phase 2 retrospective + plan Phase 3"),
            ],
            tasks: [
              makeTask("w16t1", "Build: API integration layer — abstract any third-party API behind a swappable interface", "build", "monday", 5),
              makeTask("w16t2", "Build: API key management — rotate keys, track usage, alert on anomalies", "build", "tuesday", 4),
              makeTask("w16t3", "Study + implement: Circuit breaker pattern for flaky external APIs", "build", "wednesday", 4),
              makeTask("w16t4", "Build: Data sync engine — pull from external API, diff vs local state, apply changes", "build", "thursday", 5),
              makeTask("w16t5", "Deliverable: Reusable adapter pattern template for any external API integration", "deliverable", "saturday", 4),
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // PHASE 3 — Server-Side + Frameworks + Deployment
  // ══════════════════════════════════════════════════════════════════
  {
    id: "phase3",
    phaseNumber: 3,
    title: "Server-Side + Frameworks",
    subtitle: "Build Like It's Going to Production",
    goal: "Ship real applications with real infrastructure. Everything works under load and failure.",
    duration: "Months 5–6",
    color: "blue",
    months: [
      {
        id: "month5",
        monthNumber: 5,
        title: "Next.js App Router + Server Actions",
        phaseId: "phase3",
        weeks: [
          // ── Week 17
          {
            id: "week17",
            weekNumber: 17,
            title: "Next.js App Router Deep Dive",
            monthId: "month5",
            phaseId: "phase3",
            topics: ["App Router vs Pages Router", "Server Components", "Client Components", "Streaming + Suspense", "Parallel Routes"],
            dailySchedule: [
              makeDay("monday", 9, "App Router — layouts, route groups, parallel routes, intercepting routes"),
              makeDay("tuesday", 9, "Server vs Client Components — rendering boundaries, serialization"),
              makeDay("wednesday", 9, "Streaming and Suspense — partial hydration, progressive rendering"),
              makeDay("thursday", 9, "Build: Full App Router app — layouts, loading, error, not-found"),
              makeDay("friday", 9, "Data fetching in Server Components — no useEffect, no client state"),
              makeDay("saturday", 7, "Challenge: Rebuild a page of this project using App Router"),
              makeDay("sunday", 5, "Review + plan Week 18"),
            ],
            tasks: [
              makeTask("w17t1", "Understand App Router vs Pages Router — layout system, route groups, parallel routes", "study", "monday", 4),
              makeTask("w17t2", "Understand Server vs Client Components — rendering boundaries, serialization constraints", "study", "tuesday", 4),
              makeTask("w17t3", "Understand: Streaming + Suspense — how partial hydration and progressive rendering works", "study", "wednesday", 3),
              makeTask("w17t4", "Build: Full App Router app — layouts, loading states, error boundaries, not-found pages", "build", "thursday", 5),
              makeTask("w17t5", "Drill: For every feature ask — 'Server Component or Client Component and WHY?'", "study", "friday", 1),
            ],
          },
          // ── Week 18
          {
            id: "week18",
            weekNumber: 18,
            title: "Server Actions + Mutations",
            monthId: "month5",
            phaseId: "phase3",
            topics: ["Server Actions", "useOptimistic", "Progressive Enhancement", "Zod Validation", "File Upload via Actions"],
            dailySchedule: [
              makeDay("monday", 9, "What Server Actions are — RPC, auto-serialized, progressive enhancement"),
              makeDay("tuesday", 9, "Build: Full CRUD using only Server Actions — no API routes, no client fetch"),
              makeDay("wednesday", 9, "Optimistic updates with useOptimistic + Server Actions"),
              makeDay("thursday", 9, "Server Action security — CSRF protection, Zod validation, auth checks"),
              makeDay("friday", 9, "Build: File upload using Server Actions — multipart, validate, store"),
              makeDay("saturday", 7, "Challenge: Rebuild part of this project using Server Actions — compare complexity"),
              makeDay("sunday", 5, "Review + plan Week 19"),
            ],
            tasks: [
              makeTask("w18t1", "Understand: What Server Actions are, how they work under the hood, progressive enhancement", "study", "monday", 3),
              makeTask("w18t2", "Build: Full CRUD app using only Server Actions — no API routes, no client-side fetch", "build", "tuesday", 5),
              makeTask("w18t3", "Build: Optimistic updates with useOptimistic paired with Server Actions", "build", "wednesday", 4),
              makeTask("w18t4", "Study: Server Action security — CSRF protection, Zod validation, authentication checks", "study", "thursday", 3),
              makeTask("w18t5", "Challenge: Rebuild a section of this project using Server Actions — note complexity differences", "challenge", "saturday", 5),
            ],
          },
          // ── Week 19
          {
            id: "week19",
            weekNumber: 19,
            title: "Authentication at Scale",
            monthId: "month5",
            phaseId: "phase3",
            topics: ["Auth from Scratch", "Auth.js + OAuth Providers", "Supabase SSR Auth", "Magic Links", "2FA TOTP"],
            dailySchedule: [
              makeDay("monday", 9, "Build auth from scratch in Next.js — cookies, sessions, middleware protection"),
              makeDay("tuesday", 9, "Implement Auth.js with multiple providers — Google, GitHub, credentials"),
              makeDay("wednesday", 9, "Implement Supabase Auth with SSR — server-side session management"),
              makeDay("thursday", 9, "Full auth system — signup, login, logout, password reset, email verification"),
              makeDay("friday", 9, "Session vs JWT in Next.js — why cookies often beat localStorage for tokens"),
              makeDay("saturday", 7, "Challenge: Magic link authentication from scratch"),
              makeDay("sunday", 5, "Review + plan Week 20"),
            ],
            tasks: [
              makeTask("w19t1", "Build: Auth from scratch in Next.js — cookies, sessions, middleware route protection", "build", "monday", 5),
              makeTask("w19t2", "Implement: Auth.js with multiple providers — Google, GitHub, email/password", "build", "tuesday", 4),
              makeTask("w19t3", "Implement: Supabase Auth with SSR — server-side session management, cookie handling", "build", "wednesday", 4),
              makeTask("w19t4", "Build: Complete auth — signup, login, logout, password reset, email verification, 2FA", "build", "thursday", 5),
              makeTask("w19t5", "Challenge: Implement magic link authentication from scratch", "challenge", "saturday", 5),
            ],
          },
          // ── Week 20
          {
            id: "week20",
            weekNumber: 20,
            title: "Performance + Core Web Vitals",
            monthId: "month5",
            phaseId: "phase3",
            topics: ["LCP + INP + CLS", "Bundle Analysis", "Image Optimization", "Font Optimization", "RSC Bundle Impact"],
            dailySchedule: [
              makeDay("monday", 9, "LCP, INP, CLS — what they measure, what causes poor scores, how to fix"),
              makeDay("tuesday", 9, "Image optimization — WebP/AVIF, lazy loading, srcset, Next.js Image internals"),
              makeDay("wednesday", 9, "Bundle analysis — @next/bundle-analyzer, identify + eliminate dead code"),
              makeDay("thursday", 9, "Font optimization + RSC impact on bundle size — measure before/after"),
              makeDay("friday", 9, "Audit a slow Next.js app with Lighthouse — fix 3 specific issues, re-measure"),
              makeDay("saturday", 7, "Challenge: Take Lighthouse score from ~60 to 90+ on all metrics"),
              makeDay("sunday", 5, "Review + plan Month 6"),
            ],
            tasks: [
              makeTask("w20t1", "Study: LCP, FID/INP, CLS — what they measure, what causes poor scores, how to fix each", "study", "monday", 4),
              makeTask("w20t2", "Study: Image optimization — WebP/AVIF, lazy loading, srcset, Next.js Image internals", "study", "tuesday", 3),
              makeTask("w20t3", "Study: Bundle analysis — use @next/bundle-analyzer, identify and eliminate dead code", "study", "wednesday", 4),
              makeTask("w20t4", "Practice: Audit slow Next.js app with Lighthouse, fix 3 issues, re-measure", "build", "friday", 4),
              makeTask("w20t5", "Challenge: Take a Next.js app from Lighthouse ~60 to 90+ on all Core Web Vitals", "challenge", "saturday", 5),
            ],
          },
        ],
      },
      // ── Month 6
      {
        id: "month6",
        monthNumber: 6,
        title: "Embedded Systems + IoT Bridge",
        phaseId: "phase3",
        weeks: [
          // ── Week 21
          {
            id: "week21",
            weekNumber: 21,
            title: "C/C++ Fundamentals for Embedded",
            monthId: "month6",
            phaseId: "phase3",
            topics: ["Memory Model", "Pointers + Pointer Arithmetic", "Manual Memory Management", "Bit Manipulation", "Undefined Behavior"],
            dailySchedule: [
              makeDay("monday", 9, "Memory model — stack vs heap, text/data/bss/heap/stack program layout"),
              makeDay("tuesday", 9, "Pointers — arithmetic, function pointers, pointers-to-pointers"),
              makeDay("wednesday", 9, "Manual memory — malloc/free, use-after-free, double-free, buffer overflow"),
              makeDay("thursday", 9, "Build: Linked list, stack, queue, hash map in pure C"),
              makeDay("friday", 9, "Bit manipulation — AND, OR, XOR, shifts — set/clear/toggle register bits"),
              makeDay("saturday", 7, "Drill: Read one embedded C source file (Linux driver or FreeRTOS)"),
              makeDay("sunday", 5, "Review + plan Week 22"),
            ],
            tasks: [
              makeTask("w21t1", "Understand: Memory model — stack vs heap, text/data/bss/heap/stack layout", "study", "monday", 4),
              makeTask("w21t2", "Understand: Pointers — arithmetic, function pointers, pointers to pointers", "study", "tuesday", 4),
              makeTask("w21t3", "Study: Manual memory management bugs — use-after-free, double-free, buffer overflow", "study", "wednesday", 3),
              makeTask("w21t4", "Build: Linked list, stack, queue, hash map in pure C with no stdlib", "build", "thursday", 5),
              makeTask("w21t5", "Study: Bit manipulation — AND/OR/XOR/shifts, setting/clearing/toggling register bits", "study", "friday", 3),
              makeTask("w21t6", "Drill: Read one embedded C source file per day (Linux driver, Arduino lib, or FreeRTOS)", "study", "saturday", 2),
            ],
          },
          // ── Week 22
          {
            id: "week22",
            weekNumber: 22,
            title: "Microcontroller Basics",
            monthId: "month6",
            phaseId: "phase3",
            topics: ["GPIO", "Interrupts", "PWM + Timers", "UART / SPI / I2C", "Sensor Reading"],
            dailySchedule: [
              makeDay("monday", 9, "GPIO — digital I/O, pull-up/pull-down resistors, open-drain"),
              makeDay("tuesday", 9, "Interrupts — ISR requirements, volatile, interrupt priority, no blocking in ISR"),
              makeDay("wednesday", 9, "Timers — PWM generation, input capture, output compare"),
              makeDay("thursday", 9, "Communication protocols — UART, SPI, I2C — electrical and software differences"),
              makeDay("friday", 9, "Build: LED control, button debouncing, PWM servo control"),
              makeDay("saturday", 7, "Challenge: Software UART (bit-bang serial) from scratch via timer interrupt"),
              makeDay("sunday", 5, "Review + plan Week 23"),
            ],
            tasks: [
              makeTask("w22t1", "Understand: GPIO — digital input/output, pull-up/pull-down, open-drain", "study", "monday", 3),
              makeTask("w22t2", "Understand: Interrupts — ISR requirements, volatile variables, priority, no blocking", "study", "tuesday", 4),
              makeTask("w22t3", "Understand: UART vs SPI vs I2C — electrical and software differences", "study", "thursday", 4),
              makeTask("w22t4", "Build: LED control, button debouncing, PWM motor/servo control", "build", "friday", 5),
              makeTask("w22t5", "Challenge: Software UART (bit-bang serial) from scratch using a timer interrupt", "challenge", "saturday", 5),
            ],
          },
          // ── Week 23
          {
            id: "week23",
            weekNumber: 23,
            title: "Real-Time Operating Systems",
            monthId: "month6",
            phaseId: "phase3",
            topics: ["FreeRTOS", "Tasks + Scheduler", "Mutexes + Semaphores", "Priority Inversion", "Stack Overflow Detection"],
            dailySchedule: [
              makeDay("monday", 9, "RTOS concepts — tasks, scheduler (preemptive vs cooperative), context switching"),
              makeDay("tuesday", 9, "Synchronization — mutexes, semaphores, message queues, priority inversion"),
              makeDay("wednesday", 9, "FreeRTOS — task creation, vTaskDelay vs vTaskDelayUntil, queues, event groups"),
              makeDay("thursday", 9, "Build: Multi-task app — sensor task + processing task + communication task"),
              makeDay("friday", 9, "Stack overflow detection + when NOT to use an RTOS (bare-metal loop tradeoffs)"),
              makeDay("saturday", 7, "Challenge: Port a bare-metal app to FreeRTOS, maintaining same behavior"),
              makeDay("sunday", 5, "Review + plan Week 24"),
            ],
            tasks: [
              makeTask("w23t1", "Study: RTOS concepts — tasks, preemptive vs cooperative scheduler, context switching", "study", "monday", 4),
              makeTask("w23t2", "Study: Synchronization — mutexes, semaphores, message queues, priority inversion", "study", "tuesday", 3),
              makeTask("w23t3", "Study: FreeRTOS — vTaskDelay vs vTaskDelayUntil, queues, event groups, stack watermarks", "study", "wednesday", 3),
              makeTask("w23t4", "Build: Multi-task embedded app — one task reads sensor, one processes, one communicates", "build", "thursday", 5),
              makeTask("w23t5", "Challenge: Port a bare-metal application to FreeRTOS, maintaining identical behavior", "challenge", "saturday", 5),
            ],
          },
          // ── Week 24
          {
            id: "week24",
            weekNumber: 24,
            title: "Embedded + Web Bridge (IoT Pipeline)",
            monthId: "month6",
            phaseId: "phase3",
            topics: ["MQTT", "WebSocket vs MQTT vs HTTP for IoT", "OTA Updates", "IoT Security", "End-to-End Pipeline"],
            dailySchedule: [
              makeDay("monday", 9, "MQTT — broker, topics, QoS levels, retained messages, last will and testament"),
              makeDay("tuesday", 9, "WebSocket vs MQTT vs HTTP for IoT — power, reliability, latency tradeoffs"),
              makeDay("wednesday", 9, "Build: Full pipeline — hardware → MQTT → Node → Redis pub/sub → WS → React"),
              makeDay("thursday", 9, "OTA updates + IoT security — TLS on embedded, certificate provisioning, secure boot"),
              makeDay("friday", 9, "Phase 3 full review — test all pipelines end-to-end"),
              makeDay("saturday", 7, "Deliverable: Complete IoT pipeline demo running end-to-end"),
              makeDay("sunday", 5, "Phase 3 retrospective + plan Phase 4"),
            ],
            tasks: [
              makeTask("w24t1", "Study: MQTT — broker, topics, QoS levels, retained messages, last will", "study", "monday", 3),
              makeTask("w24t2", "Study: WebSocket vs MQTT vs HTTP for IoT — power, reliability, latency tradeoffs", "study", "tuesday", 2),
              makeTask("w24t3", "Build: hardware → MQTT → Node server → Redis pub/sub → WebSocket → React dashboard", "build", "wednesday", 6),
              makeTask("w24t4", "Study: OTA updates + IoT security — TLS on embedded, certificate provisioning", "study", "thursday", 3),
              makeTask("w24t5", "Deliverable: End-to-end IoT pipeline running — hardware → MQTT → Node → Redis → WebSocket → React", "deliverable", "saturday", 7),
            ],
          },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════
  // PHASE 4 — Mastery & Ownership
  // ══════════════════════════════════════════════════════════════════
  {
    id: "phase4",
    phaseNumber: 4,
    title: "Mastery & Ownership",
    subtitle: "Build the Things That Scare You",
    goal: "Tackle complex, production-grade systems. Independent problem-solving at senior level.",
    duration: "Months 7–12",
    color: "purple",
    months: [
      {
        id: "month7",
        monthNumber: 7,
        title: "Architecture & System Design",
        phaseId: "phase4",
        weeks: [
          {
            id: "week25",
            weekNumber: 25,
            title: "Distributed Systems Fundamentals",
            monthId: "month7",
            phaseId: "phase4",
            topics: ["CAP Theorem", "Database Scaling", "Microservices vs Monolith", "Event Sourcing", "CQRS", "Saga Pattern"],
            dailySchedule: [
              makeDay("monday", 9, "CAP theorem + database scaling — vertical vs horizontal, read replicas, sharding"),
              makeDay("tuesday", 9, "Microservices vs monolith vs modular monolith — when each is correct"),
              makeDay("wednesday", 9, "Event-driven architecture — event sourcing, CQRS, saga pattern"),
              makeDay("thursday", 9, "Message brokers — Kafka vs RabbitMQ vs Redis Streams — when to use which"),
              makeDay("friday", 9, "API Gateway patterns — rate limiting, auth, routing, circuit breakers"),
              makeDay("saturday", 7, "Challenge: Design system for 10k concurrent WebSocket connections"),
              makeDay("sunday", 5, "Review + plan Week 26"),
            ],
            tasks: [
              makeTask("w25t1", "Study: CAP theorem, consistency vs availability, real-world implications", "study", "monday", 4),
              makeTask("w25t2", "Study: Microservices vs monolith vs modular monolith — when each is the right choice", "study", "tuesday", 3),
              makeTask("w25t3", "Study: Event sourcing + CQRS + saga pattern — understand the tradeoffs", "study", "wednesday", 4),
              makeTask("w25t4", "Study: Message brokers — Kafka vs RabbitMQ vs Redis Streams", "study", "thursday", 3),
              makeTask("w25t5", "Project: Design + build system handling 10,000 concurrent WebSocket connections", "build", "saturday", 7),
            ],
          },
          {
            id: "week26",
            weekNumber: 26,
            title: "Architecture Projects Sprint",
            monthId: "month7",
            phaseId: "phase4",
            topics: ["Distributed Task Queue", "Event Sourcing Implementation", "Multi-Region Sync"],
            dailySchedule: [
              makeDay("monday", 9, "Project: Distributed task queue surviving worker crashes + server restarts"),
              makeDay("tuesday", 9, "Project: Event sourcing — every state change is an event, replay to derive state"),
              makeDay("wednesday", 9, "Project: Multi-region sync — data in one region appears in another in <500ms"),
              makeDay("thursday", 9, "System design practice — verbalize every tradeoff decision"),
              makeDay("friday", 9, "Architecture review — document all three projects"),
              makeDay("saturday", 7, "Full architecture sprint — polish all three projects"),
              makeDay("sunday", 5, "Review + plan Month 8"),
            ],
            tasks: [
              makeTask("w26t1", "Project: Distributed task queue that survives worker crashes and server restarts", "build", "monday", 8),
              makeTask("w26t2", "Project: Simplified event sourcing — every state change is an event, state derived from replay", "build", "tuesday", 8),
              makeTask("w26t3", "Project: Multi-region data sync — data written in one region appears in another <500ms", "build", "wednesday", 8),
              makeTask("w26t4", "Practice: System design — articulate every tradeoff verbally as you make decisions", "study", "thursday", 5),
            ],
          },
        ],
      },
      {
        id: "month8",
        monthNumber: 8,
        title: "DevOps, CI/CD & Observability",
        phaseId: "phase4",
        weeks: [
          {
            id: "week27",
            weekNumber: 27,
            title: "Docker + CI/CD Pipelines",
            monthId: "month8",
            phaseId: "phase4",
            topics: ["Docker + Multi-stage Builds", "docker-compose", "GitHub Actions", "Terraform Basics", "Zero-Downtime Deploy"],
            dailySchedule: [
              makeDay("monday", 9, "Docker — multi-stage builds, layer caching, minimal images"),
              makeDay("tuesday", 9, "docker-compose for local dev environment setup"),
              makeDay("wednesday", 9, "GitHub Actions — lint, test, build, deploy pipeline"),
              makeDay("thursday", 9, "Containerize this project — Dockerfile, compose, env configs"),
              makeDay("friday", 9, "Terraform basics — understand what infrastructure as code manages"),
              makeDay("saturday", 7, "Challenge: Zero-downtime deployment strategy"),
              makeDay("sunday", 5, "Review + plan Week 28"),
            ],
            tasks: [
              makeTask("w27t1", "Docker: multi-stage builds, layer caching, minimal images, compose for local dev", "study", "monday", 4),
              makeTask("w27t2", "CI/CD: GitHub Actions — runs lint + tests on PR, deploys on merge to main", "build", "wednesday", 5),
              makeTask("w27t3", "Containerize this project — Dockerfile, docker-compose, env-specific configs", "build", "thursday", 5),
              makeTask("w27t4", "Terraform basics — understand what infrastructure as code manages", "study", "friday", 3),
            ],
          },
          {
            id: "week28",
            weekNumber: 28,
            title: "Observability + Security Hardening",
            monthId: "month8",
            phaseId: "phase4",
            topics: ["Structured Logging", "Distributed Tracing", "Sentry Error Tracking", "Secrets Management", "Health Checks"],
            dailySchedule: [
              makeDay("monday", 9, "Structured logging — correlationId, userId, duration, status on every log"),
              makeDay("tuesday", 9, "Distributed tracing + metrics with Prometheus/Grafana"),
              makeDay("wednesday", 9, "Sentry: error tracking, grouping, alerting on spikes"),
              makeDay("thursday", 9, "Security — secrets management, no secrets in code, SAST, dependency scanning"),
              makeDay("friday", 9, "Health check endpoints — liveness and readiness probes"),
              makeDay("saturday", 7, "Challenge: Full observability setup for this project"),
              makeDay("sunday", 5, "Phase 4 mid-review + plan Specialization Sprint"),
            ],
            tasks: [
              makeTask("w28t1", "Implement: Structured logging — every log has correlationId, userId, duration, status", "build", "monday", 4),
              makeTask("w28t2", "Set up: Error tracking with Sentry — catch unhandled errors, group, alert on spikes", "build", "wednesday", 4),
              makeTask("w28t3", "Security hardening — secrets management (no secrets in code), SAST, dependency scanning", "study", "thursday", 4),
              makeTask("w28t4", "Implement: Health check endpoints — liveness and readiness probes", "build", "friday", 3),
              makeTask("w28t5", "Challenge: Full observability setup for this project with all the above working", "challenge", "saturday", 6),
            ],
          },
        ],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHECKPOINTS
// ─────────────────────────────────────────────────────────────────────────────
export const CHECKPOINTS: Checkpoint[] = [
  {
    phaseId: "phase1",
    title: "Month 2 Checkpoint",
    items: [
      "Can build a full REST API with auth, validation, DB integration from scratch in < 4 hours",
      "Can explain the React rendering cycle and demonstrate it by breaking and fixing it",
      "Has at least 1 deployed project with real users or real data",
      "Can write PostgreSQL queries using window functions and explain the execution plan",
    ],
  },
  {
    phaseId: "phase2",
    title: "Month 4 Checkpoint",
    items: [
      "Can architect and implement a Redis caching layer for any existing API",
      "Can integrate Plaid or Stripe from scratch without referencing tutorials",
      "Can write PostgreSQL queries using window functions and explain the execution plan",
      "Can design and implement a webhook delivery system with retry logic",
    ],
  },
  {
    phaseId: "phase3",
    title: "Month 6 Checkpoint",
    items: [
      "Can build and deploy a full Next.js app with Server Actions and server-side auth",
      "Can write C code that controls hardware (GPIO, UART) without assistance",
      "Can design a system for 100k users and articulate the tradeoffs",
      "Can ship a feature end-to-end from DB schema to UI without guidance",
    ],
  },
  {
    phaseId: "phase4",
    title: "Month 12 Checkpoint — Senior Level",
    items: [
      "Can lead the technical design of a new feature end-to-end",
      "Independently identifies problems before they become bugs",
      "Code requires minimal review changes",
      "Can onboard another developer to any system they've built",
      "Can debug production issues using logs, metrics, and distributed tracing",
    ],
  },
];

// ─── DERIVED HELPERS ─────────────────────────────────────────────────────────
export const ALL_WEEKS: Week[] = PHASES.flatMap((p) =>
  p.months.flatMap((m) => m.weeks)
);

export const ALL_TASKS: Task[] = ALL_WEEKS.flatMap((w) => w.tasks);

export const getWeekById = (id: string): Week | undefined =>
  ALL_WEEKS.find((w) => w.id === id);

export const getPhaseForWeek = (week: Week): Phase =>
  PHASES.find((p) => p.id === week.phaseId)!;

export const getMonthForWeek = (week: Week): Month =>
  PHASES.flatMap((p) => p.months).find((m) => m.id === week.monthId)!;

export const DAY_ORDER: DayOfWeek[] = [
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
];

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

export const DAY_FULL_LABELS: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export const TASK_TYPE_CONFIG: Record<
  TaskType,
  { label: string; color: string; bg: string; icon: string }
> = {
  study:       { label: "Study",       color: "text-blue-400",   bg: "bg-blue-900/30 border-blue-700/50",   icon: "📖" },
  build:       { label: "Build",       color: "text-green-400",  bg: "bg-green-900/30 border-green-700/50", icon: "🔨" },
  challenge:   { label: "Challenge",   color: "text-amber-400",  bg: "bg-amber-900/30 border-amber-700/50", icon: "⚡" },
  deliverable: { label: "Deliverable", color: "text-purple-400", bg: "bg-purple-900/30 border-purple-700/50",icon: "🏆" },
};

export const PHASE_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; muted: string; line: string; nodeFill: string }
> = {
  phase1: {
    bg:       "bg-red-900/20",
    border:   "border-red-700/60",
    text:     "text-red-400",
    muted:    "text-red-300/70",
    line:     "#dc2626",
    nodeFill: "#450a0a",
  },
  phase2: {
    bg:       "bg-amber-900/20",
    border:   "border-amber-700/60",
    text:     "text-amber-400",
    muted:    "text-amber-300/70",
    line:     "#d97706",
    nodeFill: "#451a03",
  },
  phase3: {
    bg:       "bg-blue-900/20",
    border:   "border-blue-700/60",
    text:     "text-blue-400",
    muted:    "text-blue-300/70",
    line:     "#2563eb",
    nodeFill: "#172554",
  },
  phase4: {
    bg:       "bg-purple-900/20",
    border:   "border-purple-700/60",
    text:     "text-purple-400",
    muted:    "text-purple-300/70",
    line:     "#7c3aed",
    nodeFill: "#2e1065",
  },
};
